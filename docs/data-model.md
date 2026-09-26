# Data Model (MVP)

Keep the schema small. Scenario content can live as static JSON in the repo for MVP.

## Entities

### users

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| email | text unique | |
| display_name | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### practice_sessions

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users | |
| scenario_id | text | Always `scenario-001` in MVP |
| status | text | `active` \| `completed` \| `abandoned` \| `failed` |
| sarvam_interaction_id | text nullable | External id |
| started_at | timestamptz | |
| ended_at | timestamptz nullable | |
| duration_ms | int nullable | |
| created_at | timestamptz | |

### transcripts

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| session_id | uuid FK → practice_sessions unique | One transcript per session |
| turns | jsonb | Array of `{ speaker, text, startedAtMs, endedAtMs }` |
| raw | jsonb nullable | Raw Sarvam payload if needed |
| created_at | timestamptz | |

### scores

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| session_id | uuid FK → practice_sessions unique | |
| overall | int | 0–100 |
| passed | boolean | |
| criteria | jsonb | Per-criterion breakdown |
| strengths | jsonb | string[] |
| improvements | jsonb | string[] |
| coach_notes | text | |
| metrics | jsonb | talk/listen, questions, fillers |
| model | text | Sarvam model id used |
| created_at | timestamptz | |

### latency_events (optional but recommended)

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| session_id | uuid FK | |
| t_connect_ms | int | |
| t_first_audio_ms | int nullable | |
| t_score_ms | int nullable | |
| meta | jsonb | browser, region |
| created_at | timestamptz | |

## Static content (not in DB for MVP)

```
/content/scenario-001.json
```

Fields: id, title, description, learn, watch, systemPromptRef, estDurationMin.

## Relationships

```
users 1───* practice_sessions 1───1 transcripts
                            1───1 scores
                            1───* latency_events
```

## Indexes

- `practice_sessions (user_id, created_at desc)`  
- `practice_sessions (user_id, scenario_id, status)`
