FROM node:22-bookworm-slim

WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN corepack enable && COREPACK_NPM_REGISTRY=$NPM_REGISTRY corepack prepare pnpm@10.13.1 --activate
RUN pnpm config set registry $NPM_REGISTRY

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=flipbook-web-pnpm,target=/pnpm/store pnpm install --frozen-lockfile --store-dir=/pnpm/store
COPY . .

EXPOSE 5175
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--strictPort"]
