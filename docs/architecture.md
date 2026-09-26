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
2. **Never ship `SARVAM_API_KEY` to the browser** — Node holds the key; browser uses empty `apiKey` + `baseUrl` proxy (Sarvam docs pattern).  
3. **SpeakCoach API owns truth** — users, scenario content, sessions, transcripts, scores.  
4. **Sarvam owns conversation intelligence** — persona, turn-taking, STT/TTS.  
5. **Score after the call** — `sarvam-105b` on transcript; do not block mid-call UX.

## Components

### React client
- Auth, Learn/Watch/Practice, live call UI, feedback.  
- Mic + speaker via `ConversationAgent` + `BrowserAudioInterface` (16 kHz PCM mono).  
- Buffers live transcripts from `transcriptCallback`.

### SpeakCoach API (Node)
- Auth + profile.  
- Serve Scenario 001 content (static JSON OK).  
- `POST /sessions` → create DB row; expose Sarvam proxy or mint signed URL path.  
- `POST /sessions/:id/complete` → persist transcript; call scoring LLM; return scorecard.

### Sarvam
- **Voice Agents** agent: Alex Rivera (`SARVAM_APP_ID`), pinned `version=1`.  
- **Chat Completions** for scoring (`api.sarvam.ai`).

### Postgres
- Local: Docker Compose service only (`docker-compose.yml`).  
- API and frontend always run on the host with Node — not containerized for MVP.

## Session lifecycle

1. Client: `POST /sessions` → SpeakCoach `sessionId`.  
2. Client ↔ Sarvam (via Node proxy): live voice until End call / `interaction_end`.  
3. Client: send transcript turns to `POST /sessions/:id/complete`.  
4. API: score with Sarvam chat; persist; return scorecard.  
5. Client: Feedback screen.

## Latency-critical path

```
Mic → Sarvam ASR → Sarvam LLM → Sarvam TTS → speaker
```

Do **not** insert SpeakCoach REST in this loop.

## Security

- HTTPS / WSS everywhere.  
- Voice Agents key: `sk_samvaad_…` in API env only.  
- JWT/cookie for SpeakCoach API.
