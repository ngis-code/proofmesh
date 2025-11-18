FROM node:20-alpine AS base
WORKDIR /app

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/validator ./apps/validator

# Install all workspace dependencies so that runtime deps like `mqtt` are available.
RUN corepack enable && pnpm install --prod=false

RUN pnpm --filter @proofmesh/shared-config build && \
    pnpm --filter @proofmesh/shared-types build && \
    pnpm --filter @proofmesh/validator build

FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production

COPY --from=base /app/package.json /app/pnpm-workspace.yaml /app/tsconfig.base.json ./
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages ./packages
COPY --from=base /app/apps/validator/dist ./apps/validator/dist

RUN mkdir -p node_modules/@proofmesh && \
    ln -s ../../packages/shared-config node_modules/@proofmesh/shared-config && \
    ln -s ../../packages/shared-types node_modules/@proofmesh/shared-types

CMD ["node", "apps/validator/dist/apps/validator/src/index.js"]


