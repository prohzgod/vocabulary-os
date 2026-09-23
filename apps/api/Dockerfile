# Build from the REPO ROOT: docker build -f apps/api/Dockerfile -t vocabulary-os-api .
# Runs anywhere containers run: Fly.io, Railway, Render, Cloudflare Containers, a VPS.

FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @vocab-os/api build

FROM node:22-bookworm-slim
# Prisma's query engine needs OpenSSL.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable
WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
# Migrations run at start-up; Prisma takes an advisory lock, so parallel instances are safe.
CMD ["sh", "-c", "pnpm --filter @vocab-os/api db:deploy && node apps/api/dist/main.js"]
