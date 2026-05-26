FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm@9

# Workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/

# Instalează TOATE dependențele (inclusiv devDeps pentru tsc)
RUN pnpm install --frozen-lockfile

# Copiază sursele și compilează
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/

RUN pnpm --filter api build

EXPOSE 3001

CMD ["sh", "-c", "node apps/api/dist/db/migrate.js && node apps/api/dist/index.js"]
