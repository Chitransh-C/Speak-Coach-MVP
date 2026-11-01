# RoleSmith Admin

Platform admin for catalog, users, sessions, prompts, and ops health.

## Login

1. Ensure DB is seeded (`npm run db:seed` in `server/`).
2. Sign in at `/login` with the seeded admin:

| Env | Default |
|-----|---------|
| `ADMIN_EMAIL` | `admin@rolesmith.local` |
| `ADMIN_PASSWORD` | `RoleSmithAdmin1!` |
| `ADMIN_DISPLAY_NAME` | `RoleSmith Admin` |

3. Open **/admin** (also linked from the learner sidebar as **Admin → Dashboard** when `role=admin`).

Change the password in production via env + re-seed, or set a temp password from **Users** in the admin UI.

Public signup always creates `learner` accounts. Only an existing admin (or seed) can promote someone to `admin`.

## Features

| Area | What you can do |
|------|-----------------|
| **Dashboard** | KPIs (users, sessions, pass rate, avg score), top scenarios, recent fails, system strip |
| **Users** | Search, promote/demote role, disable/enable, open detail + recent sessions |
| **Tracks** | List, create, delete (blocked if scenarios remain) |
| **Scenarios** | List, create/edit (basics + learn/watch JSON), publish `live` / `coming_soon` |
| **Prompts** | Edit DB scoring / voice_agent prompt bodies (Gemini Live persona shell still built in code) |
| **Sessions** | Global browse, transcript + score, rescore, export transcript JSON |
| **Health** | DB ping, Gemini key present, models, locale counts |

## API

All under `/api/v1/admin/*` with Bearer JWT + `role=admin` (else `403`).

Examples: `GET /admin/stats`, `GET /admin/users`, `PATCH /admin/scenarios/:id`, `POST /admin/sessions/:id/rescore`, `GET /admin/health`.

## Notes

- Gemini Live system instruction template: `server/src/modules/gemini/services/gemini.system-prompt.ts` (not the Prompt table).
- Soft-disable uses `users.disabled_at`; disabled users cannot log in.
- Do not delete scenarios that already have practice sessions — unpublish instead.
