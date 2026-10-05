# Architecture (MVP)

## Overview

```
┌─────────────────┐   HTTPS        ┌──────────────────┐
│  React client   │◄──────────────►│  SpeakCoach API  │
│  (Vite/TS)      │                │  (Node/TS)       │
└────────┬────────┘                └────────┬─────────┘
         │                                  │
         │ voice (via Node proxy            │ create session,
         │ or signed-URL pattern)           │ save transcript,
         │                                  │ score via chat API
         ▼                                  ▼
┌─────────────────┐                ┌──────────────────┐
│ Sarvam Voice    │                │ Postgres         │
│ Agents runtime  │                │                  │
│ apps.sarvam.ai  │                └──────────────────┘
└─────────────────┘
```

## Principles

1. **Latency path is sacred** — mic audio must not round-trip through SpeakCoach business logic. Prefer Sarvam’s realtime Voice Agents path.  
2. **Never ship voice/chat API keys to the browser** — Node holds secrets; browser uses empty `apiKey` + proxy (Sarvam) or ephemeral tokens (future Gemini).  
3. **SpeakCoach API owns truth** — users, scenario content, sessions, transcripts, scores.  
4. **Voice runtime is pluggable** — `VOICE_PROVIDER` Strategy (`sarvam` live; `gemini` scaffold).  
5. **Score after the call** — `CHAT_PROVIDER` Strategy (`sarvam-105b` or Gemini) on transcript; do not block mid-call UX.

## Components

### React client
- Auth, Learn/Watch/Practice, live call UI, feedback.  
- Mic + speaker via `ConversationAgent` + `BrowserAudioInterface` (16 kHz PCM mono).  
- Buffers live transcripts from `transcriptCallback`.

### SpeakCoach API (Node)
- Auth + profile.  
- **Catalog:** tracks + scenarios from Postgres (seeded; Learn/Watch JSON).  
- **Voice agents:** one Sarvam app per track; scenarios inject `agent_variables`; optional scenario override.  
- `POST /sessions` → create DB row with language/voice; resolve track/scenario agent + variables; return proxy config.  
- `POST /sessions/:id/complete` → persist transcript; score via chat API; return scorecard.

## Env

| Var | Purpose |
|---|---|
| `CHAT_PROVIDER` | `sarvam` (default) or `gemini` — scoring Strategy |
| `VOICE_PROVIDER` | `sarvam` (default) or `gemini` — live voice Strategy (`gemini` scaffold only) |
| `SARVAM_VOICE_API_KEY` | Voice Agents key (`sk_samvaad_…`) for `/api/sarvam` proxy |
| `SARVAM_CHAT_API_KEY` | Platform/dashboard key for Chat Completions (**not** `sk_samvaad_`) |
| `GEMINI_API_KEY` | Required when either provider is `gemini` |

Code: `server/src/modules/ai/chat` and `server/src/modules/ai/voice` (Strategy factories).

### Sarvam
- **Voice Agents:** track-level apps + scenario variables ([indus-track-agents.md](./indus-track-agents.md)).  
- **Chat Completions** for scoring when `CHAT_PROVIDER=sarvam`.

### Postgres
- Local: Docker Compose service only (`docker-compose.yml`).  
- API and frontend always run on the host with Node — not containerized for MVP.

## Session lifecycle

1. Client: `POST /sessions` → SpeakCoach `sessionId`.  
2. Client ↔ Sarvam (via Node proxy): live voice until End call / `interaction_end`.  
3. Client: send transcript turns to `POST /sessions/:id/complete`.  
4. API: score via `CHAT_PROVIDER` Strategy; persist; return scorecard.  
5. Client: Feedback screen.

## Latency-critical path

```
Mic → Sarvam ASR → Sarvam LLM → Sarvam TTS → speaker
```

Do **not** insert SpeakCoach REST in this loop.

## Security

- HTTPS / WSS everywhere.  
- Voice Agents key: `SARVAM_VOICE_API_KEY` (`sk_samvaad_…`) in API env only.  
- Chat key: `SARVAM_CHAT_API_KEY` (platform key) separate from Voice Agents.  
- JWT for SpeakCoach API.
