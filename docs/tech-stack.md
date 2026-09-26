# Tech Stack (MVP)

Decided stack. Do not reopen unless blocked.

## Frontend

| Choice | Why |
|---|---|
| React + Vite + TypeScript | Product UI |
| React Router | Learn → Watch → Practice → Feedback |
| Custom CSS tokens (no Tailwind required) | Brand-led UI without utility noise |
| `sarvam-conv-ai-sdk/browser` (`ConversationAgent`) | Live voice in Chrome |

## Backend (product)

| Choice | Why |
|---|---|
| **Node.js + TypeScript** (Fastify) | Same language as frontend; thin session/score API |
| Postgres (Docker Compose **DB only**) | Users, sessions, transcripts, scores — app itself is **not** Dockerized |
| Prisma | Simple ORM |

## AI — Sarvam

| Use | Package / API |
|---|---|
| Live practice agent | Voice Agents SDK → `apps.sarvam.ai` signed WebSocket |
| Post-call scoring | `POST https://api.sarvam.ai/v1/chat/completions` model `sarvam-105b` |
| Auth (Voice Agents) | Header `X-API-Key: sk_samvaad_…` |
| Auth (platform chat) | Header `api-subscription-key` (may be a **different** key — see credentials doc) |

## Local / debug only (not production)

| Choice | Why |
|---|---|
| Python + `sarvam-conv-ai-sdk[all]` | Desktop mic smoke tests (`scripts/talk-to-agent.py`) |
| PyAudio | Mic capture for scripts |

## Auth (product)

Email/password + JWT (Fastify). Clerk deferred.

## Local run

- `docker compose up -d` → Postgres only  
- `cd server && npm run dev` → API on host Node  
- `cd frontend && npm run dev` → Vite on host Node  

Do **not** ship Dockerfiles for the app in MVP.

## Hosting (suggested)

| Piece | Option |
|---|---|
| Web | Vercel / Cloudflare Pages |
| API | Railway / Render / Fly.io |
| DB | Neon / Supabase Postgres |

## Explicitly not for MVP

- Python as the production API server  
- DIY STT→LLM→TTS (use Voice Agents runtime)  
- Redis / queues (score inline; queue later if needed)  
- Object storage for call audio (transcript-only)  
- Kubernetes / microservices
