# ─────────────────────────────────────────────
# Stage 1: 构建 Admin 前端（Vite）
# ─────────────────────────────────────────────
FROM node:22-bookworm-slim AS admin-builder

WORKDIR /build/admin

ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN corepack enable && COREPACK_NPM_REGISTRY=$NPM_REGISTRY corepack prepare pnpm@10.13.1 --activate
RUN pnpm config set registry $NPM_REGISTRY

COPY admin-frontend/package.json admin-frontend/pnpm-lock.yaml .npmrc* ./
RUN --mount=type=cache,id=flipbook-admin-pnpm,target=/pnpm/store pnpm install --frozen-lockfile --store-dir=/pnpm/store

COPY admin-frontend/ ./
RUN pnpm build

# ─────────────────────────────────────────────
# Stage 2: 运行后端（Express）+ Admin 静态资源
# ─────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner

# slim 镜像没有系统 CA，先使用 Node 内置可信根证书通过 HTTPS 安装 OpenSSL。
RUN node -e "require('fs').writeFileSync('/tmp/node-ca.pem', require('tls').rootCertificates.join('\n'))" \
    && sed -i 's|http://deb.debian.org|https://mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get -o Acquire::https::CaInfo=/tmp/node-ca.pem -o Acquire::By-Hash=false -o Acquire::https::Timeout=30 update \
    && apt-get -o Acquire::https::CaInfo=/tmp/node-ca.pem -o Acquire::https::Timeout=30 install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* /tmp/node-ca.pem

WORKDIR /app

ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN corepack enable && COREPACK_NPM_REGISTRY=$NPM_REGISTRY corepack prepare pnpm@10.13.1 --activate
RUN pnpm config set registry $NPM_REGISTRY

COPY server/package.json server/pnpm-lock.yaml server/pnpm-workspace.yaml ./server/
WORKDIR /app/server

ARG PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
RUN --mount=type=cache,id=flipbook-server-pnpm,target=/pnpm/store pnpm install --frozen-lockfile --store-dir=/pnpm/store

COPY server/prisma ./prisma
RUN pnpm exec prisma generate

RUN --mount=type=cache,id=flipbook-server-pnpm,target=/pnpm/store CI=true pnpm prune --prod

COPY server/src ./src
COPY server/scripts ./scripts
RUN chmod +x scripts/start.sh

WORKDIR /app
COPY --from=admin-builder /build/admin/dist ./admin-frontend/dist

WORKDIR /app/server

EXPOSE 8888

ENV NODE_ENV=production
ENV PORT=8888

CMD ["sh", "scripts/start.sh"]
