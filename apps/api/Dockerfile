FROM node:20-alpine AS base

# Install necessary tools
RUN apk add --no-cache libc6-compat
RUN corepack enable pnpm

# Dependencies
FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ ./packages/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app ./
COPY . .
# Generate Prisma client for build-time types
RUN pnpm --filter=@bulog-wms/api exec prisma generate
# Build the schema package and API package using turbo (which ensures correct build order)
RUN pnpm turbo run build --filter=@bulog-wms/api

# Deploy stage: creates a pruned version with production dependencies in /app/pruned
FROM builder AS deploy
WORKDIR /app
RUN pnpm --filter=@bulog-wms/api --prod deploy /app/pruned
# Generate the Prisma client inside the pruned output so it's self-contained
WORKDIR /app/pruned
RUN pnpm prisma generate

# Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy the completely self-contained pruned application
COPY --from=deploy /app/pruned ./

EXPOSE 3002
ENV PORT=3002

CMD ["node", "dist/main.js"]
