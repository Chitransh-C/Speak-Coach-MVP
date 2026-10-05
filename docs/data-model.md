# Data Model (v1)

Catalog lives in Postgres. Scenario JSON under `server/content/` is seed input only.

## Entities

### users

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| email | text unique | |
| password_hash | text | |
| display_name | text | |
| created_at / updated_at | timestamptz | |

### tracks

| Column | Type | Notes |
|---|---|---|
| id | text PK | Slug e.g. `interviews`, `sales` |
| title | text | |
| description | text | |
| sort_order | int | |
| sarvam_org_id, sarvam_workspace_id, sarvam_app_id | text nullable | **Track Voice Agent** (default for all scenarios) |
| sarvam_version | int nullable | |
| created_at / updated_at | timestamptz | |

### scenarios

| Column | Type | Notes |
|---|---|---|
| id | text PK | Slug e.g. `scenario-001` |
| track_id | text FK → tracks | |
| title, description, level | text | |
| est_duration_min, practice_call_min, points, pass_mark | int | |
| availability | text | `live` \| `coming_soon` |
| languages, voices | jsonb | Unused (legacy); catalog is central via `/locales` |
| default_language, default_voice | text | Soft defaults; voice should match `learn.participant.gender` |
| learn | jsonb | Includes `participant.gender` (`male` \| `female`) for voice filtering |
| sarvam_org_id, sarvam_workspace_id, sarvam_app_id | text nullable | Optional **override** agent; else track agent |
| sarvam_version | int nullable | |
| learn, watch | jsonb | Learn/Watch payloads (+ `greeting` for initial_bot_message) |
| created_at / updated_at | timestamptz | |

### practice_sessions

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users | |
| scenario_id | text FK → scenarios | |
| status | text | `created` \| `completed` \| `failed` … |
| language, voice | text nullable | Chosen at setup |
| sarvam_interaction_id | text nullable | |
| started_at, ended_at, duration_ms, created_at | | |

### prompts

| Column | Type | Notes |
|---|---|---|
| id | text PK | e.g. `scoring.system.scenario-001`, `voice.agent.sales` |
| kind | text | `scoring_system` \| `scoring_user` \| `voice_agent` |
| track_id | text nullable | `interviews` \| `sales` \| null (default) |
| scenario_id | text nullable | When set, scenario-specific scoring (preferred over track) |
| title | text | |
| body | text | Full prompt text (source of truth after seed) |
| created_at / updated_at | timestamptz | |

Seeded from [`server/prisma/prompt-content.ts`](../server/prisma/prompt-content.ts).  
**Scoring resolution:** `scenario_id` prompt → track fallback → default. No markdown prompt files.

### transcripts / scores / latency_events

Unchanged from MVP (1:1 transcript + score per session; latency events list).

## Relationships

```
tracks 1───* scenarios 1───* practice_sessions
users 1───* practice_sessions 1───1 transcripts
                             1───1 scores
                             1───* latency_events
```

## Env vs DB

| In env (secrets / infra) | In DB |
|---|---|
| `SARVAM_API_KEY` | Track (primary) + optional scenario override agent ids |
| `DATABASE_URL`, `JWT_SECRET` | tracks, scenarios, learn/watch, languages, voices |
| `PORT`, `CORS_ORIGIN` | availability, pass_mark |

Resolution: scenario override if fully set → else track agent. Session create also returns `agentVariables` + `initialBotMessage` for Indus `@` vars. See [indus-track-agents.md](./indus-track-agents.md).

## Seed

```bash
cd server
npx prisma db push
npx prisma db seed   # or npm run db:seed
```
