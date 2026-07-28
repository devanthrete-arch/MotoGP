FROM node:20-alpine

WORKDIR /app
ENV HOST=0.0.0.0 \
    PORT=3001 \
    API_DATA_PATH=/data/autoflex-api.json

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3001
VOLUME ["/data"]
CMD ["npm", "run", "api:start"]
