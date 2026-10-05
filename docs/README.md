# SpeakCoach Docs

Product docs for SpeakCoach **v1** (multi-scenario catalog) built on the MVP vertical slice.

## Reading order

1. [v1 scope](./v1-scope.md) — current product scope  
2. [MVP scope](./mvp-scope.md) — historical single-scenario slice  
3. [Architecture](./architecture.md)  
4. [Tech stack](./tech-stack.md)  
5. [Data model](./data-model.md) — Track / Scenario in Postgres  
6. [API contracts](./api-contracts.md)  
7. [UI screens](./ui-screens.md)  
8. [Sarvam credentials](./sarvam-credentials.md) — secrets vs DB agent ids  
8b. [Indus track agents](./indus-track-agents.md) — 1 agent/track + Sales create paste  
9. [Sarvam integration](./sarvam-integration.md)  
10. [Scenario 001](./scenario-001-interview-basics.md)  
11. [Scoring rubric](./scoring-rubric.md)  
12. [Latency strategy](./latency-strategy.md)  
13. [Acceptance criteria](./acceptance-criteria.md)  
14. [Roadmap](./roadmap.md)  
15. [Deploy (single EC2)](./deploy.md) — `/var/www/frontend` + `/var/www/server`, nginx, systemd  

Also update Key decisions table for scoring:

## Key decisions (locked)

| Decision | Choice |
|---|---|
| AI provider | **Sarvam** Voice Agents; scoring via **Gemini** (or Sarvam chat) |
| Deploy | Single EC2 + nginx — see [deploy.md](./deploy.md) |
| Product backend | **Node.js (TypeScript)** Fastify |
| Product frontend | **React + Vite + TypeScript** |
| Catalog | **Postgres** `tracks` + `scenarios` (seeded) |
| Voice agents | **One agent per track** + scenario variables; optional scenario override |
| Active tracks | **Interviews** + **Sales** |
| Env secrets | Shared `SARVAM_API_KEY` only — agent ids in DB |
| Live voice | Browser SDK + Node `/api/sarvam` proxy |
| Docker | Postgres only |

## Non-goals (v1)

No nested sub-scenarios, admin CMS UI, Bixy, My Journey, teams, Live Studio, or 303-scenario catalog.
