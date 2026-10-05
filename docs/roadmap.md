# Roadmap

## Done — MVP
Single scenario (`scenario-001`), Learn → Watch → Practice → Feedback, Sarvam proxy, scoring.

## Done / in progress — v1 architecture
- DB-backed tracks + scenarios
- Practice setup (language / voice)
- Per-scenario Sarvam agent ids in DB; env secrets only
- Seed stubs; content fill later

## Next — Content fill
- Commit Indus agents for stub scenarios; set `availability: live` + agent columns
- Expand to ~6–10 scenarios across Interviews + Sales (and more tracks)
- Wire Sales track agent after Indus create ([indus-track-agents.md](./indus-track-agents.md))

## Later

### Depth
- Knowledge check after Learn
- Watch audio playback
- Retry history list
- Stronger insufficient-dialogue handling

### Guidance
- Bixy, My Journey light, streaks / XP

### Scale & creation
- Admin/content pipeline UI
- My Scenarios, document upload
- Teams + leaderboard

### Studio & polish
- Live Studio formats, analytics, certificates, tokens, privacy controls

## Rule
Do not expand content volume while latency or scoring quality is failing demos.
