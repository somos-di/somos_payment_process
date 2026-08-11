# Processo de Pagamento — SOMOS

Sistema de **solicitação e aprovação de pagamentos** da SOMOS Desenvolvimento Imobiliário, com fluxo de aprovadores por grupos/níveis, integração com o **UAU** e um **assistente (agente) de IA** para consulta e aprovação pelo chat.

- **Backend:** Node.js + TypeScript (ESM) + Fastify — arquitetura em camadas (`routes → controllers → services → gateways`) com container de injeção de dependência.
- **Frontend:** HTML5 + CSS3 + JavaScript vanilla (ESM), organizado por views — **sem framework**.
- **Dados/Auth:** Supabase (PostgreSQL, RLS, Policies, Storage, RPC, Views).
- **Assistente:** serviço FastAPI (Azure OpenAI, streaming SSE) + servidor MCP (FastMCP) com ferramentas de leitura sobre o Supabase.

O frontend **não** tem chaves nem `supabase-js`: fala só com o backend, e a sessão vive em **cookie `httpOnly`**. O nginx serve o front e faz proxy `/api → backend` e `/agent → agente` (same-origin, sem CORS).

---

## Arquitetura

```
Navegador
   │  (cookie httpOnly, same-origin)
   ▼
nginx (imagem frontend)  ──/api/──►  backend (Fastify)  ──►  Supabase (Postgres + RLS)
   │                                     │                        UAU (gateway HTTP)
   └────────/agent/────►  agent (FastAPI, SSE) ──►  supabase_mcp (FastMCP)  ──►  Supabase
                              │
                              └──►  redis (memória da conversa)
```

Serviços (`docker-compose.yaml`, rede `somos_net`):

| Serviço        | Stack                    | Porta        | Papel |
| -------------- | ------------------------ | ------------ | ----- |
| `frontend`     | nginx + estáticos        | `127.0.0.1:8080:80` | Serve o SPA e faz proxy `/api` e `/agent`. |
| `backend`      | Fastify (TypeScript)     | interna 4000 | API, regras de negócio, chaves do Supabase, integração UAU. |
| `supabase_mcp` | FastMCP (Python)         | interna 8000 | Ferramentas **read-only** sobre o Supabase para o agente. |
| `agent`        | FastAPI (Python)         | interna 8100 | Assistente de chat (Azure OpenAI, SSE), orquestra as tools do MCP. |
| `redis`        | redis:7-alpine           | interna 6379 | Memória (TTL) das conversas do agente. |

### Segurança (camadas)
- **RLS é a primeira linha:** o backend usa o **JWT do usuário** (`userClient`) nas leituras/escritas, então o Postgres já limita tudo ao que a pessoa pode ver/fazer. `service_role` só em operações privilegiadas.
- **Sessão:** cookie `httpOnly` + `SameSite=Lax` + `Secure` (em HTTPS) — sem token no front, mitiga XSS/CSRF.
- **Agente:** todas as tools são de leitura; ele **não** aprova nada. Quem aprova/reprova é o usuário, pelos botões que aparecem no próprio chat e que batem no endpoint gated por RLS.

---

## Rodar com Docker (recomendado)

Cada serviço tem seu `.env` próprio (todos **gitignored**):

```bash
cp app/backend/.env.example app/backend/.env
# preencha: SUPABASE_URL, chaves, credenciais UAU, CORS_ORIGIN, etc.

# criar também (a partir dos exemplos, se houver, ou conforme a doc interna):
#   app/services/agent/.env          (Azure OpenAI, Supabase, cookies de sessão)
#   app/services/mcps/supabase_mcp/.env  (Supabase, schema)
```

Suba tudo:

```bash
docker compose up --build
```

Acesse **http://localhost:8080**.

---

## Banco de dados (Supabase)

A fonte da verdade do schema/funções/policies/views é:

```
app/backend/database/setup_payment_process.sql   (NÃO versionado)
```

No SQL Editor do Supabase:
1. Rode o arquivo inteiro (idempotente).
2. Exponha o schema em *Settings → API → Exposed schemas*.
3. Crie o bucket de anexos no **Storage**.

> Há dois schemas: **`payment`** (setup/dev) e **`payment_process`** (produção). O arquivo de setup usa `search_path = payment`; deltas aplicados no ambiente live usam `search_path = payment_process`.

---

## Desenvolvimento local (sem Docker)

- **Backend:** `cd app/backend && npm install && npm run dev` (usa `--env-file=.env`, porta 4000). Testes: `npm test`. Typecheck: `npx tsc --noEmit`.
- **Frontend:** é estático; sirva `app/frontend` atrás de um proxy que aponte `/api` e `/agent` para os serviços — o caminho mais simples é usar o Docker, que já resolve proxy e cookie.
- **Agente / MCP:** Python + Poetry (`poetry install` em cada pasta). Precisam do Redis e das credenciais no `.env`.

---

## Funcionalidades

- **Solicitar** — processo individual e **em massa** (importação de planilha `.xlsx`/`.csv`, com modelo para download).
- **Correção** — devolução e edição de processos.
- **Consulta** — listagem/filtros de processos (avulso, reembolsos, PJ, taxa de gestão, etc.).
- **Aprovar** — fluxo de aprovação por grupos e níveis; visão de aprovadores elegíveis/concluídos.
- **Departamento / Financeiro** — análise, parcelas e envio à integração.
- **Comissões** — pagamento e empreendimentos.
- **Integração UAU** — sincronização via gateway HTTP.
- **Administração** — grupos/usuários, permissões (empresa/obra/tipo), reaprovações.
- **Assistente (agente)** — consulta e feedback sobre processos; aprova/reprova pelo próprio chat.
- **Frase do dia** — na tela inicial (rotação diária, tabela `quotes` + RPC).

---

## CI/CD

- **`.github/workflows/ci.yml`** — em PRs/branches que não são a `main`: typecheck do backend e build das imagens Docker.
- **`.github/workflows/cd.yml`** — em push na `main`: SSH no droplet → `git reset --hard origin/main` → `docker compose up -d --build`.

Detalhes de infraestrutura (droplet, chaves SSH, secrets, domínio `pagamentos.ngrok.dev` via ngrok) em **[DEPLOY.md](DEPLOY.md)**.

---

## Estrutura

```
app/backend                 Fastify — routes/controllers/services/gateways, factories/container, Dockerfile
app/backend/database        setup_payment_process.sql (gitignored)
app/frontend                HTML/CSS/JS estáticos (views + shared), nginx.conf, Dockerfile
app/services/agent          Assistente FastAPI (Azure OpenAI, SSE, Redis)
app/services/mcps/supabase_mcp   Servidor MCP (FastMCP) com tools de leitura
docker-compose.yaml         Orquestra redis + backend + frontend + supabase_mcp + agent
DEPLOY.md                   Guia de deploy (CI/CD → droplet + ngrok)
```

> **Não versionados** (`.gitignore`): `*.env`, `app/backend/database/`, `directives/`, `node_modules/`, `.venv/`.
