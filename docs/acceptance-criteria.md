# Acceptance criteria (v1)

## Environment
- [ ] `docker compose up -d` starts Postgres only
- [ ] `server/.env` has `DATABASE_URL`, `JWT_SECRET`, `SARVAM_API_KEY` — **no** scenario app/org/workspace
- [ ] `npx prisma db push` + `npm run db:seed` load tracks + scenario-001 + stubs

## Catalog
- [ ] `GET /tracks` returns Interviews + Sales
- [ ] Home shows multiple cards + track filter
- [ ] Live scenarios resolve Voice Agent from track (or scenario override)
- [ ] Session create returns `agentVariables` + `initialBotMessage`
- [ ] Coming-soon stubs cannot start practice
- [ ] `scenario-001` Learn → Watch → Setup → Practice → Feedback works

## Sessions
- [ ] Setup language/voice persisted on session
- [ ] Agent config for call comes from Scenario row
- [ ] Signed URL via `/api/sarvam/...` returns 200

## Demo notes
- Chrome + mic; headset preferred
- End & score required for feedback
