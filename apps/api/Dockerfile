FROM node:20-alpine AS base
WORKDIR /app

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
COPY infra ./infra

# Install all workspace dependencies so runtime deps (fastify, pg, mqtt, etc.) are present.
RUN corepack enable && pnpm install --prod=false

RUN pnpm --filter @proofmesh/shared-types build && \
    pnpm --filter @proofmesh/shared-config build && \
    pnpm --filter @proofmesh/api build

FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production

COPY --from=base /app/package.json /app/pnpm-workspace.yaml /app/tsconfig.base.json ./
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages ./packages
COPY --from=base /app/apps/api/dist ./apps/api/dist
COPY --from=base /app/infra ./infra

RUN mkdir -p node_modules/@proofmesh && \
    ln -s ../../packages/shared-config node_modules/@proofmesh/shared-config && \
    ln -s ../../packages/shared-types node_modules/@proofmesh/shared-types

EXPOSE 3000

# Use the compiled server entry under dist/apps/api/src to ensure we
# run the same code that tsc outputs for the app (including new routes).
CMD ["node", "apps/api/dist/apps/api/src/server.js"]


