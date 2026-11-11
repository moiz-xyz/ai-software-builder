FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-workspace.yaml ./
COPY packages/templates packages/templates
COPY apps/api apps/api
RUN pnpm install --frozen-lockfile=false --filter @sf/api... \
 && pnpm --filter @sf/templates build \
 && cd apps/api && npx prisma generate && pnpm build

FROM node:22-alpine
RUN corepack enable
WORKDIR /repo
COPY --from=build /repo /repo
WORKDIR /repo/apps/api
EXPOSE 4100
# Apply migrations, seed (idempotent), then start API + BullMQ worker.
CMD ["sh", "-c", "npx prisma migrate deploy && node -r ts-node/register/transpile-only prisma/seed.ts && node dist/main.js"]
