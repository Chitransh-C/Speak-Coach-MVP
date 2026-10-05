# SpeakCoach

AI communication practice: **Learn → Watch → Setup → Practice → Feedback**.

**v1** is a multi-track catalog (DB-backed scenarios) with language/voice setup. **One Sarvam Voice Agent per track**; scenarios inject content via agent variables. Active tracks: **Interviews** (Alex Rivera agent live) and **Sales** (create agent in Indus — see [docs/indus-track-agents.md](docs/indus-track-agents.md)).

**Important:** Docker is used **only as the Postgres provider**. The API and frontend run natively on your machine with Node. There are no app Dockerfiles.

---

## Prerequisites

Install these before you start:

| Tool | Version / notes |
|---|---|
| **Node.js** | 20+ recommended (`node -v`) |
| **npm** | Comes with Node (`npm -v`) |
| **Docker Desktop** | Running, with Compose (`docker compose version`) |
| **Git** | Optional, for cloning |
| **Chrome** | Required for live Practice (mic + Sarvam browser SDK) |

Optional (desktop mic smoke tests only):

| Tool | Notes |
|---|---|
| **Python** | 3.10+ |
| **pip** | For `requirements-smoke.txt` |

---

## What you will run

| Piece | How | URL / port |
|---|---|---|
| Postgres | `docker compose up -d` | `localhost:5432` |
| API (Fastify) | `cd server && npm run dev` | http://localhost:3001 |
| Web (Vite/React) | `cd frontend && npm run dev` | http://localhost:5173 |

---

## 1. Clone / open the repo

```bash
cd "e:\VS CODE DUMMY\wisdora\Speak_Coach"
```

(Or your clone path.)

---

## 2. Start Postgres (Docker only)

From the **repo root**:

```bash
docker compose up -d
```

Check that the container is healthy:

```bash
docker ps
```

You should see `speakcoach-postgres` on port `5432`.

Default DB credentials (also used in `server/.env.example`):

| Setting | Value |
|---|---|
| User | `speakcoach` |
| Password | `speakcoach` |
| Database | `speakcoach` |
| URL | `postgresql://speakcoach:speakcoach@localhost:5432/speakcoach?schema=public` |

Stop the DB later with:

```bash
docker compose down
```

(Data persists in the Docker volume unless you use `docker compose down -v`.)

---

## 3. Configure environment files

### 3a. Server — `server/.env`

```bash
cd server
cp .env.example .env
```

Edit `server/.env` — **secrets and infra only** (no per-scenario agent ids):

```env
DATABASE_URL="postgresql://speakcoach:speakcoach@localhost:5432/speakcoach?schema=public"
JWT_SECRET="change-me-in-production"
PORT=3001
CORS_ORIGIN="http://localhost:5173"

# Shared Voice Agents secret — must be sk_samvaad_…
SARVAM_API_KEY=sk_samvaad_...

# Optional: platform key for chat scoring
SARVAM_CHAT_API_KEY=
```

Track-level Sarvam `orgId` / `workspaceId` / `appId` / `version` live on the **`tracks` table** (seeded). Scenarios may optionally override. Secrets stay in env only.

If you already have a root `.env` from earlier setup, copy only `SARVAM_API_KEY` into `server/.env`.

More detail: [docs/sarvam-credentials.md](docs/sarvam-credentials.md) · [docs/indus-track-agents.md](docs/indus-track-agents.md).

Never commit `.env` files (they are gitignored).

### 3b. Frontend — `frontend/.env`

```bash
cd ../frontend
cp .env.example .env
```

For local Vite with the built-in API proxy, you can leave the base URL empty:

```env
VITE_API_BASE_URL=
```

Vite proxies `/api` → `http://localhost:3001`.  
If you prefer calling the API directly (and CORS is set), use:

```env
VITE_API_BASE_URL=http://localhost:3001
```

---

## 4. Install and start the API

```bash
cd server
npm install
npx prisma generate
npx prisma db push
npm run db:seed          # tracks + scenario-001 (live) + stubs
npm run dev
```

Expected:

- Console: `SpeakCoach API on http://localhost:3001`
- Health check: open http://localhost:3001/health → `{"ok":true}`

Useful scripts:

| Command | Purpose |
|---|---|
| `npm run dev` | API with watch reload |
| `npx prisma db push` | Sync Prisma schema to Postgres |
| `npm run db:seed` | Upsert tracks + scenarios |
| `npx prisma generate` | Regenerate Prisma client |
| `npm run build` / `npm start` | Production build + run |

Keep this terminal open while developing.

---

## 5. Install and start the frontend

In a **second** terminal:

```bash
cd frontend
npm install
npm run dev
```

Expected:

- Vite ready at http://localhost:5173/

Open that URL in **Chrome**.

---

## 6. Use the product (end-to-end)

1. **Sign up** (or Sign in) with email + password (min 8 characters).
2. On **Home**, filter by track and open a **live** scenario (stubs show Coming soon).
3. **Learn** → **Watch** → **Setup** (language + voice) → **Practice**.
4. Click **Start call**, allow the microphone, then **End & score**.
5. **Feedback** opens at `/sessions/<id>/feedback`.

Prefer a headset. Laptop array mics are often too quiet.

---

## 7. Optional — Python Sarvam smoke tests

Use these to verify mic + agent before debugging the browser UI:

```bash
# from repo root
pip install -r requirements-smoke.txt

python scripts/mic-check.py --device 1 --gain 8 --seconds 8
# speak while it runs; prefer peak_rms > ~1500

python scripts/talk-to-agent.py --device 1 --gain 8
# expect agent audio + transcripts

python scripts/probe-auth.py
# expect signed URL HTTP 200
```

These scripts read Sarvam vars from the **repo root** `.env`. Device index `1` and gain `8` matched the quiet laptop array on the original setup machine; adjust with `--device` / `--gain` as needed.

---

## Project layout

```
Speak_Coach/
├── docker-compose.yml          # Postgres 16 only
├── README.md
├── .env                        # local secrets (gitignored); optional root copy of Sarvam keys
├── docs/                       # product / architecture / Sarvam docs
├── scripts/                    # Python mic + auth smoke tests
├── requirements-smoke.txt
├── server/                     # Fastify + Prisma API (runs on host Node)
│   ├── .env.example
│   ├── prisma/schema.prisma
│   ├── content/scenario-001.json
│   ├── prompts/                # scoring prompts
│   └── src/modules/            # auth, scenarios, sessions, sarvam, scoring
└── frontend/                   # React + Vite (runs on host Node)
    ├── .env.example
    └── src/modules/            # auth, scenarios, practice, feedback
```

Feature modules follow: `routes → controllers → services → repositories (+ schemas)`.

---

## Troubleshooting

| Symptom | Likely fix |
|---|---|
| `EADDRINUSE` on 3001 or 5173 | Stop the old process using that port, then `npm run dev` again |
| Cannot connect to DB / Prisma errors | `docker compose up -d`, confirm `DATABASE_URL` in `server/.env` |
| Signup/login fails | Ensure API is running; check browser Network tab for `:3001` or `/api` errors |
| Voice call **401** / invalid API key | Use `sk_samvaad_…` Voice Agents key, not a platform `sk_…` key |
| Call connects then drops quickly | Mic too quiet — headset, or raise gain; try `scripts/mic-check.py` |
| No feedback screen | You must click **End & score** on Practice; hanging up alone does not score |
| CORS errors | `CORS_ORIGIN=http://localhost:5173` in `server/.env`; use the Vite port that matches |
| Scoring weak / heuristic notes | Optional: set `SARVAM_CHAT_API_KEY` to a platform key that works on `api.sarvam.ai` |
| Vite `@/` or import errors | Restart `npm run dev` in `frontend` after pull |

Quick API smoke (with API already running):

```bash
node scripts/smoke-api.mjs
```

(Requires a user such as `demo@speakcoach.test` / `password123`, or edit the script.)

---

## Docs

Start here for product detail:

1. [docs/README.md](docs/README.md) — reading order  
2. [docs/v1-scope.md](docs/v1-scope.md)  
3. [docs/indus-track-agents.md](docs/indus-track-agents.md) — track agents + Sales create  
4. [docs/sarvam-credentials.md](docs/sarvam-credentials.md)  
5. [docs/acceptance-criteria.md](docs/acceptance-criteria.md)  
6. [docs/architecture.md](docs/architecture.md) · [docs/tech-stack.md](docs/tech-stack.md)

---

## Restart cheat sheet

```bash
# Terminal A — DB (once)
docker compose up -d

# Terminal B — API
cd server
npm run dev

# Terminal C — Web
cd frontend
npm run dev
```

Then open http://localhost:5173 in Chrome.
