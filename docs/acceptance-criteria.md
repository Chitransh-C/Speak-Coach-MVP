# Acceptance criteria (MVP)

## Environment
- [ ] `docker compose up -d` starts Postgres only (no app containers)
- [ ] `server` and `frontend` run with host Node (`npm run dev`)
- [ ] `server/.env` has `DATABASE_URL` + Voice Agents `sk_samvaad_…` keys

## Auth & scenario
- [ ] Signup / login works; JWT required for scenario/session APIs
- [ ] Home lists Scenario 001
- [ ] Learn → Watch → Practice flow is navigable

## Live practice (Chrome)
- [ ] Start call obtains signed URL via `/api/sarvam/...` proxy (key never in browser)
- [ ] Two-way English audio with Alex Rivera
- [ ] Live transcript shows Alex / Learner turns
- [ ] Mic: prefer headset; laptop array often needs ~8× gain (see scripts)

## Scoring
- [ ] End & score persists transcript and returns scorecard (or clear insufficient-transcript error)
- [ ] Feedback shows overall, pass/fail (≥70), criteria bars, strengths, improvements

## Demo notes
- Use Chrome; grant mic permission
- Pin agent version `1`
- If call drops in ~10–15s, mic level is usually too quiet — run `scripts/mic-check.py`
