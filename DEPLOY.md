# Deploy (CI/CD → Droplet)

Fluxo: **push na `main` → GitHub Actions entra no droplet por SSH → `git reset --hard` + `docker compose up -d --build`**. Sem registry: o build acontece no próprio droplet.

- `.github/workflows/cd.yml` — Deploy (só `main`).
- `.github/workflows/ci.yml` — Validação (PRs e branches que não são a `main`).

---

## 1. Pré-requisitos no droplet (uma vez)

```bash
# Docker + Compose plugin
curl -fsSL https://get.docker.com | sh
docker compose version   # confirma o plugin v2

# Clonar o repo no caminho que o cd.yml espera
sudo mkdir -p /var/www && sudo chown "$USER" /var/www
cd /var/www
git clone git@github.com:luduvico-neto/somos_payment_process.git somos_payment_process
cd somos_payment_process
```

> O caminho **`/var/www/somos_payment_process`** está fixo no `cd.yml`. Se usar outro, ajuste lá.

### Chave de deploy (droplet → GitHub)
O droplet precisa puxar de um repo privado:

```bash
ssh-keygen -t ed25519 -C "droplet-deploy" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```
Adicione essa **pública** no GitHub: repo → *Settings → Deploy keys → Add* (read-only basta).

---

## 2. O `.env` runtime (uma vez, e nunca vai pro git)

O `docker-compose.yaml` lê `app/backend/.env`. Ele é **gitignored** — crie direto no droplet:

```bash
cd /var/www/somos_payment_process
cp app/backend/.env.example app/backend/.env
nano app/backend/.env
```

Pra rodar atrás do domínio **`pagamentos.ngrok.dev`** (HTTPS), garanta:

```
CORS_ORIGIN=https://pagamentos.ngrok.dev
COOKIE_SECURE=true
```

(mais SUPABASE_URL, chaves, UAU, etc.)

---

## 3. Secrets no GitHub (uma vez)

Repo → *Settings → Secrets and variables → Actions → New repository secret*:

| Secret        | Valor                                                       |
| ------------- | ----------------------------------------------------------- |
| `DO_HOST`     | IP público do droplet                                       |
| `DO_USER`     | usuário SSH (ex.: `root` ou `deploy`)                       |
| `DO_SSH_KEY`  | chave **privada** SSH com acesso ao droplet (conteúdo todo) |

> Essa é a chave que o **GitHub Actions** usa pra entrar no droplet — diferente da deploy key do passo 1 (que é droplet→GitHub). A pública correspondente a `DO_SSH_KEY` precisa estar no `~/.ssh/authorized_keys` do droplet.

---

## 4. Primeiro deploy

```bash
# no droplet, valida que sobe à mão antes de automatizar
cd /var/www/somos_payment_process
docker compose up -d --build
docker compose ps
```

Depois disso, **todo push na `main`** dispara o `cd.yml` automaticamente:
`git fetch --prune origin main` → `git reset --hard origin/main` → `docker compose up -d --build` → `docker image prune -f`.

---

## Domínio + HTTPS (ngrok → `pagamentos.ngrok.dev`)

O `docker-compose.yaml` publica o frontend em **`127.0.0.1:8080`** (só loopback). Quem
expõe pra internet com TLS é o **ngrok**, com o domínio reservado `pagamentos.ngrok.dev`
apontando pro `localhost:8080` do droplet.

```bash
# instalar ngrok (Ubuntu/Debian)
curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc \
  | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null \
  && echo "deb https://ngrok-agent.s3.amazonaws.com buster main" \
  | sudo tee /etc/apt/sources.list.d/ngrok.list \
  && sudo apt update && sudo apt install ngrok

# autenticar (token do dashboard ngrok: https://dashboard.ngrok.com)
ngrok config add-authtoken SEU_AUTHTOKEN

# testar o túnel no domínio reservado
ngrok http 8080 --url=https://pagamentos.ngrok.dev
```

Confirmado que abre em `https://pagamentos.ngrok.dev`, rode como **serviço** (sobe no boot):

```bash
# grava o tunnel no config do ngrok
mkdir -p ~/.config/ngrok
cat >> ~/.config/ngrok/ngrok.yml <<'YML'
tunnels:
  payment:
    proto: http
    addr: 8080
    domain: pagamentos.ngrok.dev
YML

sudo ngrok service install --config /root/.config/ngrok/ngrok.yml
sudo ngrok service start
# status / logs:  systemctl status ngrok
```

> O firewall do droplet **não** precisa de portas abertas pro app — o ngrok faz a
> conexão de saída. Mantenha só a 22 (SSH) aberta.

## Notas

- `git reset --hard` no droplet **descarta** qualquer alteração local lá — o droplet é só um espelho da `main`. O `.env` sobrevive porque é ignorado pelo git.
- Sem registry/imagens versionadas: o build roda no droplet a cada deploy. `docker image prune -f` limpa as camadas órfãs pra não encher o disco.
- Rollback: `git reset --hard <sha-anterior> && docker compose up -d --build` no droplet.
