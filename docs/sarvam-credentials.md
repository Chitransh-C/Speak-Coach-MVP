# Sarvam credentials & local smoke tests

> Spelling: **Sarvam** AI (Voice Agents / Samvaad).  
> Deploy docs: https://docs.sarvam.ai/conversations/deploy/deploy-with-code

## Env vars (repo root `.env` — never commit)

| Var | Meaning | Notes |
|---|---|---|
| `SARVAM_API_KEY` | Voice Agents key | Must be `sk_samvaad_…`. Platform `sk_…` → 401 on `apps.sarvam.ai` |
| `SARVAM_ORG_ID` | Org UUID | From agent **Deploy with Code** snippet |
| `SARVAM_WORKSPACE_ID` | Workspace UUID | same |
| `SARVAM_APP_ID` | Agent id | `Alex-Rivera-26a1cc8d-9a78` |
| `SARVAM_AGENT_VERSION` | Pin | **`1`** (integer). UI label “v1” ≠ SDK string |
| `SARVAM_SPEAKER` | Voice | `shubh` |
| `SARVAM_LANGUAGE` | Practice lang | `en-IN` / English |
| `SARVAM_INPUT_DEVICE_INDEX` | Local mic | `1` = laptop array (this machine) |
| `SARVAM_MIC_GAIN` | Local boost | `8` required for quiet array mic |

Filled values live only in `.env` (see Part A table historically; do not paste secrets into git).

## Where to get IDs

1. Indus → **Build → Agents** → **Alex Rivera Interview Basics** (committed version).  
2. Open **Deploy with Code** **on that agent** (not the global sidebar Deploy landing page).  
3. Copy `org_id`, `workspace_id`, `app_id` from the SDK snippet.  
4. **API keys** (Voice Agents): Indus → Deploy with code → **API keys** / Generate → `sk_samvaad_…`.

Skip for MVP: Instant outbound, Batch outbound, Inbound phone.

## SDKs & endpoints

| Use | Package | Runtime |
|---|---|---|
| Live voice (product) | `npm i sarvam-conv-ai-sdk` → `sarvam-conv-ai-sdk/browser` | `ConversationAgent` |
| Live voice (desktop debug) | `pip install "sarvam-conv-ai-sdk[all]"` | `AsyncSamvaadAgent` |
| Signed URL base | — | `https://apps.sarvam.ai/api/app-runtime/` |
| Scoring chat | `sarvamai` or raw fetch | `POST https://api.sarvam.ai/v1/chat/completions` |

## Agent setup (Indus) — required settings

**Greeting**

```
Thanks for joining today. I'm Alex Rivera, the hiring manager. To start — tell me about yourself.
```

**Instructions** — stay in character as Alex Rivera; one follow-up; English only; no coaching; ~4–6 min (full text in git history / Indus).

**Language personalisation** (voice alone is not enough — Shubh can speak Hindi):

| Setting | Value |
|---|---|
| Starting language | English |
| Languages allowed | English only |
| Switch language during call | Off |
| Auto-detected language switch | Off |

**Speaking:** Voice Shubh, speed ~1.0x. Then **Commit** (SDK needs a committed version).

## Local scripts

| Script | Purpose |
|---|---|
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
| Two key products | Voice Agents (`sk_samvaad_…` + `X-API-Key`) ≠ platform dashboard keys |
| Ephemeral WS | Signed URL is single-use; reconnect = new `start()` |
| Version field | SDK `version: int` → use `1` |
| Early disconnect ~14s | Usually **mic too quiet** (no VAD / no user transcript), not auth failure |
| Auth OK but silent call | Run `mic-check` first; use `--gain 8` on laptop array |
| Success signal | Live `user:` / `bot:` transcripts + `peak_rms` ≫ 2000 |
| Ctrl+C traceback | Harmless hangup; script now swallows KeyboardInterrupt cleanly |

## Status

- [x] English agent committed (v1 / version 1)  
- [x] Org / workspace / app IDs in `.env`  
- [x] Voice Agents API key working (signed URL 200)  
- [x] Local two-way English smoke test passed (`--device 1 --gain 8`)  
- [ ] Product Node proxy + browser SDK wired  
- [ ] Post-call scoring via chat completions wired  
