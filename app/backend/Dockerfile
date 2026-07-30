FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV HOST=0.0.0.0
ENV PORT=4000
EXPOSE 4000

CMD ["npx", "tsx", "main.ts"]
