# Backend Fastify (TypeScript via tsx). Env injetada pelo compose (env_file).
# Node 22+ expõe `WebSocket` global, exigido pelo Realtime client do supabase-js.
FROM node:22-alpine

WORKDIR /app

# instala deps (inclui tsx, usado para rodar o TS direto)
COPY package.json package-lock.json ./
RUN npm ci

# código
COPY . .

ENV HOST=0.0.0.0
ENV PORT=4000
EXPOSE 4000

CMD ["npx", "tsx", "main.ts"]
