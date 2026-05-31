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
RUN pnpm install --frozen-lockfile

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app ./
COPY . .
# Generate Prisma client if needed inside build step
RUN pnpm --filter @bulog-wms/api run build

# Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy built artifacts and production dependencies
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/node_modules ./node_modules
# Adjust based on monorepo structure and execution needs

EXPOSE 3000
ENV PORT=3000

CMD ["node", "dist/main.js"]
