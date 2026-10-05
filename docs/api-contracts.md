# API Contracts (v1)

Base URL: `/api/v1`  
Auth: Bearer JWT on all except auth routes.

## Auth

Unchanged: `POST /auth/signup`, `POST /auth/login`, `GET /me`.

## Tracks

### `GET /tracks`
→ `{ "tracks": [{ "id", "title", "description", "sortOrder", "scenarioCount" }] }`

## Locales (central catalog)

### `GET /locales`
App-wide languages and voices (not per-scenario).

→ `{ "languages": [{ "code", "label", "sarvamName" }], "voices": [{ "id", "label", "gender" }] }`

## Scenarios

### `GET /scenarios?trackId=`
Optional `trackId` filter.

→ `{ "scenarios": [{ "id", "title", "description", "trackId", "trackTitle", "level", "estDurationMin", "availability", "participantName", "participantRole", "status", "latestScore" }] }`

### `GET /scenarios/:scenarioId`
Full detail including `learn`, `watch`, `participantGender`, `languages` / `voices` (from **central** catalog; voices already filtered to character gender), `defaults`, `canPractice`, `agentSource` (`track` \| `scenario` \| null), `passMark`.  
Does **not** return API keys. Scenario DB `languages`/`voices` JSON is unused.

## Sessions

### `POST /sessions`
```json
{ "scenarioId": "scenario-001", "language": "en-IN", "voice": "shubh" }
```
→
```json
{
  "sessionId": "…",
  "status": "created",
  "scenarioId": "scenario-001",
  "trackId": "interviews",
  "language": "en-IN",
  "sarvamLanguageName": "English",
  "voice": "shubh",
  "participantGender": "male",
  "participantName": "Alex Rivera",
  "agentSource": "track",
  "agent": {
    "orgId": "…",
    "workspaceId": "…",
    "appId": "…",
    "version": 2,
    "proxyBaseUrl": "/api/sarvam",
    "initialLanguage": "en-IN",
    "sarvamLanguageName": "English",
    "voice": "shubh",
    "initialBotMessage": "Thanks for joining…",
    "agentVariables": {
      "scenario_title": "…",
      "situation": "…",
      "greeting": "…"
    }
  },
  "tips": { "micGainHint": "…", "language": "en-IN", "voice": "shubh" }
}
```

Errors: `404` unknown scenario; `409 SCENARIO_UNAVAILABLE` if `coming_soon` or no track/scenario agent; `400` invalid language or voice that does not match character gender.

### `GET /sessions/:sessionId`
Session + optional score + `participantName`.

### `POST /sessions/:sessionId/complete`
Transcript + optional latency events → scorecard (uses scenario `passMark`).

## Sarvam proxy

`ALL /api/sarvam/*` — injects shared `X-API-Key` from env. No JWT required (browser SDK).
