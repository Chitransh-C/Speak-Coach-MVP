# Sarvam credentials & local smoke tests

> Spelling: **Sarvam** AI (Voice Agents / Samvaad).  
> Track agents: [indus-track-agents.md](./indus-track-agents.md)  
> Deploy docs: https://docs.sarvam.ai/conversations/deploy/deploy-with-code

## Env vars

### Product API (`server/.env`) — secrets / infra only

| Var | Meaning | Notes |
|---|---|---|
| `SARVAM_VOICE_API_KEY` | Voice Agents key | Must be `sk_samvaad_…`. Used by `/api/sarvam` proxy |
| `SARVAM_API_KEY` | Deprecated alias | Same as voice key; prefer `SARVAM_VOICE_API_KEY` |
| `SARVAM_CHAT_API_KEY` | Platform / dashboard key | **Required** when `CHAT_PROVIDER=sarvam`. Must **not** be `sk_samvaad_` |
| `SARVAM_CHAT_MODEL` | Chat model | Default `sarvam-105b` |
| `CHAT_PROVIDER` / `VOICE_PROVIDER` | Strategy switches | Scoring: `gemini` recommended (Sarvam chat reasoning models often truncate). Voice: `sarvam` |
| `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CORS_ORIGIN` | Infra | |

**Not in env (v1):** org / workspace / app IDs live on **tracks** (and optional scenario overrides) in the DB seed — see [indus-track-agents.md](./indus-track-agents.md).

### Seed / DB agent fields (`tracks` table)

| Column | Meaning |
|---|---|
| `sarvam_org_id` | Org UUID from Deploy with Code / agent commit |
| `sarvam_workspace_id` | Workspace UUID |
| `sarvam_app_id` | Agent id e.g. `SpeakCoach--2af8ce6a-b04b` |
| `sarvam_version` | Integer committed version pin |

### Python smoke scripts (repo root `.env`)

Scripts may still use `SARVAM_ORG_ID` / `APP_ID` / mic settings locally:

| Var | Notes |
|---|---|
| `SARVAM_SPEAKER` | e.g. `shubh` |
| `SARVAM_LANGUAGE` | e.g. `en-IN` |
| `SARVAM_INPUT_DEVICE_INDEX` | Mic device |
| `SARVAM_MIC_GAIN` | Often `8` for laptop array |

Filled secrets live only in `.env` (never commit).

## Where to get IDs

1. Indus → **Build → Agents** → open **SpeakCoach Interviews** or **SpeakCoach Sales**.  
2. Open **Deploy with Code** on that agent (or use Voice Agents MCP `agents(commit)` response for `org_id` / `workspace_id` / `app_id`).  
3. Copy IDs into [`server/prisma/seed.ts`](../server/prisma/seed.ts) and run `npm run db:seed`.  
4. **API keys:** Voice Agents → `sk_samvaad_…`; platform/dashboard → chat key for scoring.

Skip for MVP: Instant outbound, Batch outbound, Inbound phone.

## SDKs & endpoints

| Use | Package | Runtime |
|---|---|---|
| Live voice (product) | `npm i sarvam-conv-ai-sdk` → `sarvam-conv-ai-sdk/browser` | `ConversationAgent` |
| Live voice (desktop debug) | `pip install "sarvam-conv-ai-sdk[all]"` | `AsyncSamvaadAgent` |
| Signed URL base | — | `https://apps.sarvam.ai/api/app-runtime/` |
| Scoring chat | Fastify → `SarvamChatStrategy` | `POST https://api.sarvam.ai/v1/chat/completions` |

## Agent setup (Indus)

One committed agent **per track**, variable-driven (`{{ participant_name }}`, `{{ situation }}`, `{{ call_language }}`, …). Full contract: [indus-track-agents.md](./indus-track-agents.md).

Current pins (seed):

| Track | App id | Version |
|---|---|---|
| Interviews | `SpeakCoach--2af8ce6a-b04b` | `1` |
| Sales | `SpeakCoach--e8102ca0-0c25` | `1` |

**Languages:** English + 9 Indic (SpeakCoach central catalog). Default English.  
**Speaking:** Voice `shubh` (gender preference in Setup; browser SDK does not yet override TTS speaker at call start). Commit after Indus edits and bump `sarvam_version` in seed.

## Local scripts

| Script | Purpose |
|---|---|
| `server/scripts/smoke-chat.mjs` | Chat Completions auth + ping |
| `server/scripts/smoke-score.mjs` | Session complete → real scorecard (not heuristic) |
| `scripts/smoke-api.mjs` | Signup → session → signed URL proxy |
| `scripts/probe-auth.py` | Signed URL auth check (expect 200) |
| `scripts/mic-check.py` | Confirm PC hears you **before** calling |
| `scripts/talk-to-agent.py` | Full live call smoke test |
| `requirements-smoke.txt` | Python deps for the above |

### Working recipe (verified)

```powershell
python scripts/mic-check.py --device 1 --gain 8 --seconds 8
# expect OK and peak_rms preferably > 1500 while speaking

python scripts/talk-to-agent.py --device 1 --gain 8
# expect: agent audio, user/bot transcripts, peak_rms thousands
```

Optional headset later: `--device 2` or `15` (Airdopes) — often cleaner than array mic.

## Findings log

| Finding | Detail |
|---|---|
| Two key products | Voice Agents (`sk_samvaad_…`) ≠ platform dashboard chat keys |
| Reasoning chat models | `sarvam-105b` may put text in `reasoning_content` with `content: null`; API uses `max_tokens` + extracts JSON from reasoning when needed |
| Ephemeral WS | Signed URL is single-use; reconnect = new `start()` |
| Version field | SDK `version: int` → pin committed version from seed |
| Early disconnect ~14s | Usually **mic too quiet** (no VAD / no user transcript), not auth failure |
| Auth OK but silent call | Run `mic-check` first; use `--gain 8` on laptop array |
| Success signal | Live `user:` / `bot:` transcripts + `peak_rms` ≫ 2000 |
| Ctrl+C traceback | Harmless hangup; script now swallows KeyboardInterrupt cleanly |

## Status

- [x] Track Voice Agents committed (Interviews + Sales v1)  
- [x] Org / workspace / app IDs in seed / DB  
- [x] Voice Agents API key working (signed URL 200)  
- [x] Product Node proxy + browser SDK wired  
- [x] Post-call scoring via chat completions wired (track-aware prompts)  
