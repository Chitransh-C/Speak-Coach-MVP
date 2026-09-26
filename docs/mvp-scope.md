# MVP Scope

## Goal

One guided scenario, low-latency live **Sarvam** voice call, transcript-backed scores.

## In scope

| Area | MVP |
|---|---|
| Auth | Email/password or magic-link |
| Catalog | Exactly **1** scenario (`scenario-001` / Alex Rivera) |
| Journey | Learn → Watch → Practice |
| Call setup | English + fixed voice (Shubh); no accent picker |
| Live call | Sarvam Voice Agents realtime; timer; end call |
| Feedback | 5 criteria, pass ≥ 70, strengths/improvements, transcript |
| Profile | Display name |
| Tokens | Not required (unlimited / hard-coded free) |

## Out of scope

Bixy, My Journey, streaks/XP/certificates, scenario search, My Scenarios/upload, Live Studio, teams/leaderboards, analytics, body-language camera, 74 languages, appearance modes, token ledger, privacy deletion UI.

## Success bar

1. Conversational voice latency (see [latency-strategy.md](./latency-strategy.md)).  
2. Learn → Watch → Practice → Feedback without dead ends.  
3. Scored transcript with five-part rubric.  
4. Single scenario only.

## Constraints

- AI: **Sarvam** only.  
- Product backend: **Node/TS**; Python scripts for local smoke only.  
- English only.  
- Vertical slice over breadth.
