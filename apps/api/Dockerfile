FROM --platform=linux/amd64 node:20-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY nest-cli.json tsconfig.json ./
COPY apps ./apps
COPY libs ./libs

RUN pnpm install --no-frozen-lockfile || pnpm install
# Same as `pnpm run build` / Render: default `nest build` → dist/apps/api/src/main.js
RUN pnpm exec nest build

RUN mkdir -p /app/apps/api/keys

EXPOSE 3000

ENV HOST=0.0.0.0
ENV PORT=3000

WORKDIR /app
CMD ["node", "dist/apps/api/src/main.js"]
