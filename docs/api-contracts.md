# API Contracts (v1)

Base URL: `/api/v1`  
Auth: Bearer JWT on all except auth routes.

Live practice uses **Gemini Live** only (browser ↔ Google with a server-minted ephemeral token).  
Scoring may use `CHAT_PROVIDER=gemini` or `sarvam` (chat completions only — not voice).

## Auth

Unchanged: `POST /auth/signup`, `POST /auth/login`, `GET /me`.

## Tracks

### `GET /tracks`
→ `{ "tracks": [{ "id", "title", "description", "sortOrder", "scenarioCount" }] }`

## Locales (central catalog)

### `GET /locales`
App-wide Gemini Live languages and prebuilt voices.

→ `{ "languages": [{ "code", "label" }], "voices": [{ "id", "label", "gender", "tone" }] }`

`code` is BCP-47 (`speechConfig.languageCode`). `id` is the Gemini Live `voice_name`.

## Scenarios

### `GET /scenarios?trackId=`
Optional `trackId` filter.

→ `{ "scenarios": [{ "id", "title", "description", "trackId", "trackTitle", "level", "estDurationMin", "availability", "participantName", "participantRole", "status", "latestScore" }] }`

### `GET /scenarios/:scenarioId`
Full detail including `learn`, `watch`, `participantGender`, `languages` / `voices` (central catalog; voices filtered to character gender), `defaults`, `canPractice`, `agentSource` (`gemini` \| null), `passMark`.  
Does **not** return API keys.

## Sessions

### `POST /sessions`
```json
{ "scenarioId": "scenario-001", "language": "hi-IN", "voice": "Kore" }
```
→
```json
{
  "sessionId": "…",
  "status": "created",
  "scenarioId": "scenario-001",
  "trackId": "interviews",
  "language": "hi-IN",
  "languageLabel": "Hindi",
  "voice": "Kore",
  "practiceCallMin": 5,
  "callDurationMin": 5,
  "participantGender": "female",
  "participantName": "Alex Rivera",
  "agentSource": "gemini",
  "voiceProvider": "gemini",
  "voiceRuntime": {
    "provider": "gemini",
    "config": {
      "model": "gemini-3.8-live",
      "voiceName": "Kore",
      "languageCode": "hi-IN",
      "languageLabel": "Hindi",
      "tokenPath": "/gemini/ephemeral-token",
      "gender": "female",
      "callDurationMin": 5
    },
    "initialLanguage": "hi-IN",
    "languageLabel": "Hindi",
    "voice": "Kore",
    "agentVariables": { "scenario_title": "…", "situation": "…", "greeting": "…" }
  },
  "tips": { "micGainHint": "…", "language": "hi-IN", "voice": "Kore" }
}
```

Errors: `404` unknown scenario; `409 SCENARIO_UNAVAILABLE` if not live; `400` invalid language or voice that does not match character gender; `503` if `GEMINI_API_KEY` missing.

### `GET /sessions/:sessionId`
Session + optional score + `participantName`.

### `POST /sessions/:sessionId/complete`
Transcript + optional latency events → scorecard (uses scenario `passMark`).

## Gemini Live ephemeral token

### `POST /gemini/ephemeral-token`
Mints a short-lived token. Setup embeds `speechConfig.languageCode` + `prebuiltVoiceConfig.voiceName` (see [Configure language and voice](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api/configure-language-voice)).

```json
{
  "languageCode": "hi-IN",
  "languageLabel": "Hindi",
  "voiceId": "Kore",
  "gender": "female",
  "participantName": "Alex Rivera",
  "agentVariables": {},
  "callDurationMin": 5
}
```
→ `{ "token", "model", "voiceName", "languageCode", "expiresAt", "newSessionExpiresAt", "callDurationMin", "systemInstruction" }`
