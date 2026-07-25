# ─────────────────────────────────────────────
# Stage 1: 构建 Admin 前端（Vite）
# ─────────────────────────────────────────────
FROM node:20-slim AS admin-builder

WORKDIR /build/admin

RUN npm config set registry https://registry.npmmirror.com
RUN npm install -g pnpm
RUN pnpm config set registry https://registry.npmmirror.com

COPY admin-frontend/package.json admin-frontend/pnpm-lock.yaml .npmrc* ./
RUN pnpm install --frozen-lockfile

COPY admin-frontend/ ./
RUN pnpm build

# ─────────────────────────────────────────────
# Stage 2: 运行后端（Express）+ Admin 静态资源
# ─────────────────────────────────────────────
FROM node:20-slim AS runner

# 换阿里云 apt 镜像（Debian bookworm = node:20-slim 基础镜像）
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
    sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list 2>/dev/null || true

# Prisma 需要 OpenSSL
RUN apt-get update -qq && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN npm config set registry https://registry.npmmirror.com
RUN npm install -g pnpm
RUN pnpm config set registry https://registry.npmmirror.com

COPY server/package.json server/pnpm-lock.yaml ./server/
WORKDIR /app/server

RUN pnpm install --frozen-lockfile

COPY server/prisma ./prisma
RUN pnpm exec prisma generate

RUN pnpm prune --prod

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
