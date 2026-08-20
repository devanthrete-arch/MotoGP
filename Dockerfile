# syntax=docker/dockerfile:1.7
#
# Autoflex hosted API (server-ts, Fastify 5) - production image.
#
# What was wrong with the previous single-stage image, and what changed:
#
#   before                                  | after
#   ----------------------------------------+-------------------------------------------
#   `npm ci` (full dev tree) in the runtime  | dev tree only in the build stage; runtime
#   layer                                    | gets `npm ci --omit=dev`
#   `RUN npm run build` built the *Vite web  | builds only the API; the web app is built
#   app*, which this image never serves      | and served by Vercel
#   `CMD npm run api:start` -> npm -> tsx    | `node server/index.mjs`, a pre-bundled file
#   -> node: three processes, and `tsx` is   | no npm/tsx in the runtime layer at all
#   a devDependency `--omit=dev` removes     |
#   ran as root                              | runs as the unprivileged `node` user
#   npm was PID 1 and swallowed SIGTERM      | dumb-init is PID 1; the app handles SIGTERM
#   no HEALTHCHECK                           | HEALTHCHECK hits /health with no extra deps
#
# Build:  docker build -t autoflex-api:$(git rev-parse --short HEAD) --build-arg APP_VERSION=$(git rev-parse --short HEAD) .
# Run:    docker run --rm -p 3001:3001 -e ADMIN_TOKEN=... -v autoflex-data:/data autoflex-api:<tag>

# Alpine keeps the base near 60 MB versus ~400 MB for the Debian variant, and
# the API has no native dependencies that need glibc.
# Recommendation (not applied): pin by digest - `node:22-alpine@sha256:...` -
# so a rebuild cannot silently pick up a different base. Cost: someone has to
# bump the digest to get security patches; benefit: byte-identical rebuilds.
ARG NODE_VERSION=22

# ---------------------------------------------------------------------------
# Stage 1: build - has the full dev dependency tree, ships none of it.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS build

# ARGs declared before the first FROM are only visible to FROM lines; re-declare
# it here so the esbuild --target below actually gets a value.
ARG NODE_VERSION
WORKDIR /app

# Copied first and on their own: this layer is only invalidated when the
# dependency set changes, not when application code changes.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Only what the API actually compiles from. The Vite app, android-app/,
# server-kotlin/ and docs/ are excluded by .dockerignore.
COPY tsconfig.server.json ./
COPY server-ts ./server-ts
COPY src ./src
COPY scripts/server-runtime.mjs ./scripts/server-runtime.mjs

# esbuild strips types without checking them, so typecheck explicitly first.
# A type error must fail the image build, not surface at runtime.
RUN npx tsc -p tsconfig.server.json --pretty false

# Bundle the API into one file.
#   --packages=external : node_modules stay external and are installed properly
#                         in the runtime stage from the lockfile. Bundling
#                         Fastify's plugin loader is fragile; bundling only our
#                         own TypeScript is not.
#   (no --minify)       : stack traces from production logs stay readable, and
#                         the file is ~30 KB either way.
# This also removes the runtime dependency on `tsx`, a devDependency that
# `npm ci --omit=dev` would delete - the reason the old CMD could not work in a
# production-only install.
RUN npx esbuild scripts/server-runtime.mjs \
      --bundle \
      --platform=node \
      --format=esm \
      --target=node${NODE_VERSION} \
      --packages=external \
      --outfile=/out/server/index.mjs \
      --log-level=warning

# ---------------------------------------------------------------------------
# Stage 2: runtime - production dependencies plus one bundled file.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runtime

# dumb-init is PID 1: it forwards SIGTERM/SIGINT to the app and reaps orphans.
# The app installs its own signal handlers (scripts/server-runtime.mjs), so
# `docker run --init` would also work; dumb-init makes the image correct on its
# own rather than depending on how it is run.
# Deliberately unpinned: Alpine's package index only carries the current patch
# release, so a pin here breaks the build the day upstream bumps it. The image
# tag + digest is where reproducibility belongs.
RUN apk add --no-cache dumb-init

ARG APP_VERSION=dev

# NODE_OPTIONS: cap the heap below the container memory limit so Node GCs
# instead of being OOM-killed. Raise it together with the container limit.
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001 \
    API_DATA_PATH=/data/autoflex-api.json \
    APP_VERSION=${APP_VERSION} \
    NODE_OPTIONS=--max-old-space-size=384

WORKDIR /app

COPY package.json package-lock.json ./

# --omit=dev      : no vitest/tsx/esbuild in the shipped layer.
# --ignore-scripts: no dependency lifecycle script runs with our filesystem;
#                   verified sufficient - nothing in the production tree needs
#                   a postinstall step.
# cache clean     : the npm cache is ~40 MB of pure dead weight in a layer.
#
# KNOWN WART (needs a package.json change, owned by the app team): react,
# react-dom, three, lucide-react, vite, typescript and @vitejs/plugin-react are
# declared as `dependencies` but are build-time-only for the *web* app, so they
# land in this image too - ~180 MB of node_modules where the API needs ~5 MB.
# Moving them to devDependencies is the single biggest size win available here.
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
    && npm cache clean --force

COPY --from=build --chown=node:node /out/server ./server

# The JSON store writes `<path>.tmp` then renames, so the *directory* must be
# writable by the runtime user, not just the file.
RUN mkdir -p /data && chown -R node:node /data

# Never run as root: a container escape via the API should not land on uid 0.
# `node` (uid 1000) ships with the base image.
USER node

EXPOSE 3001

# Uses the /health route the API already exposes, via Node's built-in fetch, so
# the image does not need curl or wget (each an extra attack surface and layer).
# start-period covers cold start; 3 failures at 30s = unhealthy in ~90s.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

# No VOLUME instruction on purpose: it would create a fresh *anonymous* volume
# on every `docker run` that omits -v, which looks like persistence but silently
# starts empty each time. Mount an explicit named volume instead:
#   -v autoflex-data:/data
LABEL org.opencontainers.image.title="autoflex-api" \
      org.opencontainers.image.description="Autoflex hosted community API (Fastify)" \
      org.opencontainers.image.source="https://github.com/devanthrete-arch/MotoGP" \
      org.opencontainers.image.version="${APP_VERSION}"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server/index.mjs"]
