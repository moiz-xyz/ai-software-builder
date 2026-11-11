FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
ARG API_INTERNAL_URL=http://api:4100
ARG NEXT_PUBLIC_ROOT_DOMAIN=localtest.me
ENV API_INTERNAL_URL=$API_INTERNAL_URL NEXT_PUBLIC_ROOT_DOMAIN=$NEXT_PUBLIC_ROOT_DOMAIN NEXT_TELEMETRY_DISABLED=1
COPY package.json pnpm-workspace.yaml ./
COPY packages/templates packages/templates
COPY apps/web apps/web
RUN pnpm install --frozen-lockfile=false --filter @sf/web... \
 && pnpm --filter @sf/templates build \
 && pnpm --filter @sf/web build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3100 HOSTNAME=0.0.0.0
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3100
CMD ["node", "apps/web/server.js"]
