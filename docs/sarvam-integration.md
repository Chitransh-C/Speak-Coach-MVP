# Sarvam Integration (MVP)

AI provider is **Sarvam AI** only (Voice Agents / Samvaad + Chat Completions).

Official docs: https://docs.sarvam.ai/conversations/deploy/deploy-with-code

## Responsibilities

| Concern | Sarvam | SpeakCoach |
|---|---|---|
| STT / TTS / turn-taking | Voice Agents runtime | No |
| Scenario persona | Agent Instructions in Indus UI (also mirror in `/prompts`) | Serve Learn/Watch content |
| Live audio | SDK WebSocket | Browser SDK + Node key proxy |
| Transcript | Live `transcriptCallback` | Persist on complete |
| Scoring | `sarvam-105b` chat | Prompt + schema validate + store |
| Catalog / auth / UI | No | Yes |

## 1. Live practice agent

| Field | Value |
|---|---|
| Agent name | Alex Rivera Interview Basics |
| `app_id` | `Alex-Rivera-26a1cc8d-9a78` |
| `org_id` / `workspace_id` | See [sarvam-credentials.md](./sarvam-credentials.md) |
| `version` | **`1`** (integer — not the string `"v1"`) |
| Language | English only (`SarvamToolLanguageName.ENGLISH` / UI Language personalisation) |
| Voice | Shubh |
| Audio | 16-bit PCM mono @ **16 kHz** |

**Persona (committed in Indus):** hiring manager; greet; ask “Tell me about yourself”; one follow-up; English only; no mid-call coaching.

### Product path (Node + browser)

```
Browser ConversationAgent { apiKey: "", baseUrl: "/api/sarvam/" }
  → Node proxy adds X-API-Key
  → apps.sarvam.ai signed WebSocket (single-use)
```

### Debug path (Python only)

```
scripts/talk-to-agent.py  → AsyncSamvaadAgent + PyAudio
```

Not used in production.

## 2. Scoring model

- **Input:** full transcript + rubric.  
- **API:** `POST https://api.sarvam.ai/v1/chat/completions`  
- **Model:** `sarvam-105b`  
- **Output:** JSON per [scoring-rubric.md](./scoring-rubric.md)  
- Validate server-side; retry once on parse failure.  
- Note: platform chat auth uses `api-subscription-key`. If Voice Agents `sk_samvaad_…` is rejected for chat, create/use a **platform** key for scoring only (store as separate env if needed).

## Auth findings (verified)

| Surface | Key | Header | Result |
|---|---|---|---|
| Voice Agents signed URL | `sk_samvaad_…` | `X-API-Key` | **200** |
| Voice Agents signed URL | platform `sk_…` (non-samvaad) | `X-API-Key` | **401 Invalid API key format** |

There is **no separate mint-token API**. SDK `start()` fetches a signed, **single-use** WebSocket URL. After disconnect, create a new agent/session.

## Transcripts

| Mode | Mechanism |
|---|---|
| Live | `transcriptCallback` → `role` USER/BOT + `content` |
| Events | `interaction_connected`, `user_interrupt`, `user_speech_start/end`, `interaction_end` |
| After | Indus Monitor / Log Analyser; optional fetch by `interaction_id` |

MVP: buffer live transcripts in the client; POST to SpeakCoach on complete.

## Client events (map to UI)

| Sarvam signal | UI action |
|---|---|
| `interaction_connected` | Start timer; show Live |
| transcript USER/BOT | Captions / store turns |
| first agent audio | Hide “Connecting…” |
| `interaction_end` / WS close | End call → scoring |
| connect error | Retry / Back |

## Prompt storage

```
/prompts
  scenario-001-system.md      # mirror of Indus Instructions
  scoring-system.md
  scoring-user-template.md
```

Indus agent Instructions are source of truth for the live call; repo copy is for review + scoring context.

## Do not DIY for MVP

Raw STT (`saaras:v3-realtime`) + chat + TTS (`bulbul:v3`) loops add latency and complexity. Use Voice Agents end-to-end for practice calls.
