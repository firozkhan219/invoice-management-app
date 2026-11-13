FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN node node_modules/prisma/build/index.js generate --schema prisma/schema.prisma
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build:next && node scripts/prepare-standalone-assets.mjs

FROM build AS migrate
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 UPLOAD_DIR=/app/uploads
COPY --from=build --chown=node:node /app/.next/standalone ./
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 3000
CMD ["node", "server.js"]
