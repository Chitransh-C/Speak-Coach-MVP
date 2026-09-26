# SpeakCoach MVP Docs

Latency-first MVP: **one scenario**, live **Sarvam** voice practice, transcript-backed scores.

## Reading order

1. [MVP scope](./mvp-scope.md)  
2. [Product requirements](./product-requirements.md)  
3. [User flows](./user-flows.md)  
4. [Architecture](./architecture.md)  
5. [Tech stack](./tech-stack.md) — **Node API + React** (decided)  
6. [Sarvam integration](./sarvam-integration.md)  
7. [Sarvam credentials](./sarvam-credentials.md) — keys, IDs, smoke-test recipe  
8. [Latency strategy](./latency-strategy.md)  
9. [Scenario 001](./scenario-001-interview-basics.md) — Alex Rivera interview  
10. [Scoring rubric](./scoring-rubric.md)  
11. [Data model](./data-model.md)  
12. [API contracts](./api-contracts.md)  
13. [UI screens](./ui-screens.md)  
14. [Acceptance criteria](./acceptance-criteria.md)  
15. [Roadmap](./roadmap.md)  

## Key decisions (locked)

| Decision | Choice |
|---|---|
| AI provider | **Sarvam** Voice Agents (Samvaad) + Chat Completions for scoring |
| Product backend | **Node.js (TypeScript)** — Fastify or Express |
| Product frontend | **React + Vite + TypeScript** |
| Live voice in product | Browser `sarvam-conv-ai-sdk` + **Node proxy** (never ship `SARVAM_API_KEY`) |
| Local debug | Python scripts in `scripts/` only (`talk-to-agent.py`, `mic-check.py`) |
| Scenario | `Alex-Rivera-26a1cc8d-9a78` — Interview Basics, English, voice Shubh |
| Agent version pin | integer **`1`** (SDK field is `int`, not `"v1"`) |

## Proven locally (2026-09-26)

- Voice Agents key format: `sk_samvaad_…` (platform `sk_…` → **401 Invalid API key format**)  
- Signed URL `GET …/apps/{app_id}/url` with `X-API-Key` → **200**  
- Two-way English call + transcripts with:  
  `python scripts/talk-to-agent.py --device 1 --gain 8`  
- Quiet laptop array mic needs software **gain ~8**; confirm first with `mic-check.py`

## Non-goals (MVP)

No teams, Live Studio, Bixy, My Journey, analytics dashboards, multi-language UI, or 303-scenario catalog.
