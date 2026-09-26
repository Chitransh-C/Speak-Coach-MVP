# API Contracts (MVP)

Base URL: `/api/v1`  
Auth: Bearer session JWT (or cookie) on all except auth routes.  
Product server: **Node/TypeScript**.

## Auth

### `POST /auth/signup`
```json
{ "email": "a@b.com", "password": "…", "displayName": "Sam" }
```
→ `{ "user": { "id", "email", "displayName" }, "token": "…" }`

### `POST /auth/login`
```json
{ "email": "a@b.com", "password": "…" }
```
→ same shape as signup.

### `GET /me`
→ `{ "id", "email", "displayName" }`

---

## Scenario

### `GET /scenarios`
One-element array for MVP (`scenario-001`).

### `GET /scenarios/scenario-001`
Full Learn + Watch payload + learner status + latest score summary if any.

---

## Sessions

### `POST /sessions`
```json
{ "scenarioId": "scenario-001" }
```
→
```json
{
  "sessionId": "…",
  "sarvam": {
    "orgId": "…",
    "workspaceId": "…",
    "appId": "Alex-Rivera-26a1cc8d-9a78",
    "version": 1,
    "proxyBaseUrl": "/api/sarvam/"
  }
}
```

Browser uses `ConversationAgent` with `apiKey: ""` and `baseUrl: proxyBaseUrl` so Node injects `X-API-Key`.

### Sarvam key proxy

` /api/sarvam/*` — reverse-proxy to `https://apps.sarvam.ai/api/app-runtime/…`  
Adds `X-API-Key` from server env. Do not return the raw key to the client.

### `POST /sessions/:sessionId/complete`
```json
{
  "endedAt": "2026-09-26T10:00:00Z",
  "durationMs": 240000,
  "sarvamInteractionId": "…",
  "transcript": {
    "turns": [
      { "speaker": "agent", "text": "…", "startedAtMs": 0, "endedAtMs": 3200 },
      { "speaker": "learner", "text": "…", "startedAtMs": 3500, "endedAtMs": 22000 }
    ]
  },
  "latency": {
    "tConnectMs": 900,
    "tFirstAudioMs": 1100
  }
}
```

**MVP preference:** score synchronously in this request if typically &lt; 15s:

```json
{
  "sessionId": "…",
  "status": "completed",
  "score": { },
  "insufficient": false
}
```

Insufficient dialogue:
```json
{ "sessionId": "…", "status": "abandoned", "insufficient": true }
```

### `GET /sessions/:sessionId`
Session + transcript + score when ready.

---

## Errors

```json
{ "error": { "code": "SARVAM_UNAVAILABLE", "message": "…" } }
```

Codes: `UNAUTHORIZED`, `NOT_FOUND`, `SARVAM_UNAVAILABLE`, `VALIDATION_ERROR`, `SCORING_FAILED`.

## Non-MVP

Teams, Bixy, Studio, analytics, balance, scenario create, upload.
