# Deploy SpeakCoach on a single EC2 (no Docker for the app)

Target layout:

```text
/var/www/
  frontend/
    dist/          # Vite build output (served by nginx)
  server/          # Node API source + dist + prisma + content + .env
```

Nginx terminates TLS (or HTTP), serves the SPA, and reverse-proxies `/api` → Node on `127.0.0.1:3001`.  
Postgres runs on the same host (apt/yum) or a managed DB — **not** required via Docker Compose for production.

---

## What the seed loads

`npm run db:seed` / `npm run db:deploy` upserts:

| Data | Details |
|---|---|
| Tracks | `interviews`, `sales` + Sarvam org/workspace/app/version |
| Scenarios | 1 interview + 5 sales (learn/watch JSON) |
| Prompts | Track scoring fallbacks, **per-scenario scoring**, user template, voice-agent mirrors |
| Cleanup | Extra tracks/scenarios outside v1 catalog; stale scenario scoring rows |

Requires on disk under `server/`:

- `prisma/schema.prisma`
- `prisma/seed.ts`
- `prisma/prompt-content.ts`
- `content/scenario-001.json`

Seed fails loudly if content is missing or prompt/scenario counts are short.

---

## Prerequisites (EC2)

- Ubuntu 22.04+ (or similar)
- Node.js **20+**
- Postgres **16+** (local service or RDS)
- nginx
- (Optional) Certbot for HTTPS
- Git (or rsync/scp of release artifacts)

---

## 1. System packages

```bash
sudo apt update
sudo apt install -y nginx postgresql postgresql-contrib
# Install Node 20 via NodeSource or nvm, then:
node -v   # >= 20
npm -v
```

Create DB user/db (example):

```bash
sudo -u postgres psql <<'SQL'
CREATE USER speakcoach WITH PASSWORD 'CHANGE_ME_STRONG';
CREATE DATABASE speakcoach OWNER speakcoach;
GRANT ALL PRIVILEGES ON DATABASE speakcoach TO speakcoach;
SQL
```

---

## 2. Place code

```bash
sudo mkdir -p /var/www/frontend /var/www/server
sudo chown -R "$USER":"$USER" /var/www/frontend /var/www/server
```

Copy or clone so that:

- API lives in `/var/www/server` (full `server/` package: `src`, `prisma`, `content`, `package.json`)
- You build frontend elsewhere or on the box into `/var/www/frontend/dist`

---

## 3. Server env

```bash
cd /var/www/server
cp .env.example .env
nano .env
```

Minimum production values:

```env
DATABASE_URL="postgresql://speakcoach:CHANGE_ME_STRONG@127.0.0.1:5432/speakcoach?schema=public"
JWT_SECRET="long-random-secret"
PORT=3001
# Public site origin(s), comma-separated if needed
CORS_ORIGIN="https://your.domain.com"

CHAT_PROVIDER=gemini
VOICE_PROVIDER=sarvam
SARVAM_VOICE_API_KEY=sk_samvaad_...
GEMINI_API_KEY=...
GEMINI_CHAT_MODEL=gemini-2.5-flash
```

Optional if you keep Sarvam chat scoring: `SARVAM_CHAT_API_KEY`.

---

## 4. Install, schema, seed, build API

```bash
cd /var/www/server
npm ci
npm run db:deploy    # prisma db push + seed (tracks, scenarios, prompts)
npm run build
node dist/server.js  # smoke: curl http://127.0.0.1:3001/health
```

`postinstall` runs `prisma generate`. `prisma` and `tsx` are production dependencies so seed works on the server.

---

## 5. systemd unit for the API

`/etc/systemd/system/speakcoach-api.service`:

```ini
[Unit]
Description=SpeakCoach API
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/server
EnvironmentFile=/var/www/server/.env
ExecStart=/usr/bin/node /var/www/server/dist/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Adjust `User` / Node path (`which node`) as needed. Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now speakcoach-api
sudo systemctl status speakcoach-api
curl -s http://127.0.0.1:3001/health
```

---

## 6. Build frontend (same origin)

On the build machine or the EC2:

```bash
cd /path/to/repo/frontend
# Set full API base including /api/v1 (see .env.production.example)
cp .env.production.example .env.production
# Edit: VITE_API_BASE_URL=https://your.domain.com/api/v1
npm ci
npm run build
rsync -a --delete dist/ /var/www/frontend/dist/
```

Locally, `frontend/.env` should set `VITE_API_BASE_URL=http://localhost:3001/api/v1`.  
Do **not** ship `localhost` in the production build.

---

## 7. nginx (SPA + `/api` proxy)

`/etc/nginx/sites-available/speakcoach`:

```nginx
server {
    listen 80;
    server_name your.domain.com;

    root /var/www/frontend/dist;
    index index.html;

    # API + Sarvam signed-URL proxy (browser SDK uses /api/sarvam/...)
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:3001/health;
        proxy_set_header Host $host;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo ln -sf /etc/nginx/sites-available/speakcoach /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Add Certbot when ready (`certbot --nginx -d your.domain.com`) and set `CORS_ORIGIN` to `https://your.domain.com`.

---

## 8. Smoke checks

```bash
curl -s https://your.domain.com/health
curl -s https://your.domain.com/api/v1/tracks   # expect 401 without token — route exists
# Browser: signup → Interviews practice → End & score → Feedback/Reports
```

Live Practice needs HTTPS (or localhost) for mic permissions in Chrome.

---

## Deploy update checklist

```bash
# API
cd /var/www/server
git pull   # or rsync new release
npm ci
npm run db:deploy   # push schema + reseed catalog/prompts (idempotent upserts)
npm run build
sudo systemctl restart speakcoach-api

# Frontend
cd /path/to/frontend
npm ci && npm run build
rsync -a --delete dist/ /var/www/frontend/dist/
```

---

## Common breakages

| Symptom | Fix |
|---|---|
| Seed: missing `scenario-001.json` | Copy `server/content/` onto the host |
| Seed / generate fails without tsx/prisma | Use current `package.json` (both are dependencies); run `npm ci` |
| Practice call hits wrong host | Set `VITE_API_BASE_URL=https://your.domain.com/api/v1`; nginx must proxy `/api` |
| CORS errors | Set `CORS_ORIGIN` to the public site URL (comma-separated if multiple) |
| Empty scores / heuristic notes | Ensure `CHAT_PROVIDER=gemini` + `GEMINI_API_KEY`; reseed scoring prompts |
| Voice agent 404 | Reseed track Sarvam app ids/versions; committed agents must exist on Indus |

---

## Security notes

- Never commit `.env`. Keep secrets only on the server.
- Bind Node to `127.0.0.1` only if you change listen host; default is `0.0.0.0` — firewall so only nginx (80/443) is public.
- Rotate `JWT_SECRET` and DB password for production.
