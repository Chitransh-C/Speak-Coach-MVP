# SpeakCoach v1 scope

Initial product version after the single-scenario MVP.

## Goal

Multi-track catalog of top-level scenarios, practice setup (language + voice), live Sarvam calls, transcript-backed scores — with **scenario data in Postgres** and **shared secrets only in env**.

## In scope

| Area | v1 |
|---|---|
| Auth | Email/password JWT |
| Catalog | Tracks + scenarios from DB — active tracks: **Interviews** + **Sales** |
| Content fill | Interviews live (`scenario-001`+); Sales seeded (`scenario-sales-001`, live when Sales agent set) |
| Journey | Learn → Watch → Setup → Practice → Feedback |
| Setup | Central language catalog + voices filtered by character gender |
| Live call | **One Voice Agent per track** + scenario `agent_variables`; optional scenario agent override |
| Feedback | Shared rubric; `passMark` from scenario row |
| Env | `DATABASE_URL`, `JWT_SECRET`, `SARVAM_API_KEY` (+ optional chat key), `PORT`, `CORS_ORIGIN` |

## Out of scope

Nested sub-scenarios, admin CMS UI, Bixy, My Journey, streaks/XP, teams, Live Studio, 74 languages, auto-creating Indus agents from SpeakCoach.

## Success bar

1. Home lists Interviews + Sales tracks + scenarios from DB.  
2. `scenario-001` completes full loop via Interviews track agent.  
3. Coming-soon / missing-agent scenarios cannot start a call.  
4. No agent ids or API keys in env except shared `SARVAM_API_KEY`.
