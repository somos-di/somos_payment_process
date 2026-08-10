# Processo de Pagamento

App de aprovação de pagamentos - **backend Fastify (TypeScript)** + **frontend JS puro** + **Supabase (Postgres)**.

- Frontend não tem chaves nem `supabase-js`: fala só com o backend; sessão em **cookie httpOnly**.
- Backend guarda as chaves do Supabase e faz as operações privilegiadas (sync UAU, escrita).
- Em produção/dev o **nginx serve o front e faz proxy `/api` → backend** (same-origin: cookie funciona sem CORS).

## Rodar com Docker (recomendado)

1. Configure o backend:
   ```bash
   cp app/backend/.env.example app/backend/.env
   # edite app/backend/.env com as credenciais do Supabase e do UAU
   ```
2. Suba:
   ```bash
   docker compose up --build
   ```
3. Acesse **http://localhost:8080**.

O `compose` sobe dois serviços: `backend` (Fastify, interno na 4000) e `frontend` (nginx na 8080, proxy `/api`).

## Banco de dados

O schema/seed/funções/views ficam em `app/database/setup_payment_process.sql` (não versionado).
No SQL Editor do Supabase: rode o arquivo inteiro (idempotente), exponha o schema `payment`
em *Settings → API → Exposed schemas* e crie o bucket `attachments` (Storage, público).

## Desenvolvimento local (sem Docker)

- Backend: `cd app/backend && npm install && npm run dev` (usa `--env-file=.env`, porta 4000).
- Frontend: sirva `app/frontend` (ex.: Live Server). Como o front chama `/api/...` (relativo),
  rode-o atrás de um proxy para o backend, ou defina `window.__API_BASE__` antes do `config.js`.
  Caminho mais simples: use o Docker (já resolve proxy e cookie).

## CI

`.github/workflows/ci.yml` roda em **push/PR na `main`**: typecheck do backend (`tsc --noEmit`)
e build das imagens Docker (backend + frontend).

## Estrutura

```
app/backend   - Fastify (controllers/services/gateways/routes), Dockerfile
app/frontend  - HTML/JS/CSS estáticos + nginx.conf, Dockerfile
app/database  - setup_payment_process.sql (gitignored)
docker-compose.yaml
```

> Não versionados (`.gitignore`): `.env`, `app/database/`, `directives/`, `node_modules/`.
