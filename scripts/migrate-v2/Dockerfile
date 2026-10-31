FROM node:22-slim

ENV TZ=UTC
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
RUN DATABASE_URL=postgresql://unused npx prisma generate

COPY src ./src
COPY scripts ./scripts

ENTRYPOINT ["npx", "tsx", "scripts/migrate-v2/index.ts"]
