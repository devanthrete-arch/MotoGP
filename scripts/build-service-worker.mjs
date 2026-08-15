import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

const listFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    }),
  );
  return nested.flat();
};

const files = (await listFiles(dist))
  .filter((file) => !file.endsWith(`${sep}sw.js`))
  .sort();

if (!files.some((file) => file.endsWith(".js")) || !files.some((file) => file.endsWith(".css"))) {
  throw new Error("Autoflex service worker requires built JavaScript and CSS assets.");
}

const hash = createHash("sha256");
for (const file of files) {
  hash.update(relative(dist, file));
  hash.update(await readFile(file));
}

const cacheName = `autoflex-${hash.digest("hex").slice(0, 12)}`;
const precache = [
  "/",
  ...files.map((file) => `/${relative(dist, file).split(sep).join("/")}`),
];

const source = `const CACHE_NAME = ${JSON.stringify(cacheName)};
const PRECACHE = ${JSON.stringify(precache, null, 2)};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", copy));
          }
          return response;
        })
        .catch(() => caches.match("/index.html").then((response) => response || caches.match("/"))),
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok && response.type === "basic") {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    })),
  );
});
`;

await writeFile(resolve(dist, "sw.js"), source);
console.log(`Generated ${cacheName} with ${precache.length} precached URLs.`);
