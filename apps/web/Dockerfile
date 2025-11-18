FROM node:20-alpine AS base
WORKDIR /app

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web ./apps/web

RUN corepack enable && pnpm install --filter @proofmesh/web... --prod=false

FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=development

COPY --from=base /app/package.json /app/pnpm-workspace.yaml /app/tsconfig.base.json ./
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/web ./apps/web

EXPOSE 5173

WORKDIR /app/apps/web

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]


