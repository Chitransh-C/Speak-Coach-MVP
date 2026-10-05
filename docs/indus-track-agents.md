# Indus track Voice Agents (SpeakCoach)

SpeakCoach uses **one Sarvam Voice Agent per track**. Scenarios inject content via **agent variables** at session start. Optional: a scenario may override with its own `sarvamAppId`.

## Variable contract

SpeakCoach sends these `agent_variables` (string values) on every call:

| Variable | Source |
|---|---|
| `scenario_id` | Scenario id |
| `scenario_title` | Title |
| `scenario_description` | Description |
| `scenario_level` | Level |
| `situation` | Learn.situation |
| `participant_name` | Learn.participant.name |
| `participant_role` | Learn.participant.role |
| `participant_tone` | Learn.participant.tone |
| `participant_agenda` | Learn.participant.agenda |
| `objectives` | Numbered list |
| `what_good_looks_like` | Numbered list |
| `greeting` | Learn.greeting (also passed as `initial_bot_message` for English only) |
| `call_language` | Selected Setup language as Sarvam name (e.g. `Hindi`) |

### Indus / Samvaad rules (from Genie)

1. **Syntax:** use `{{ variable_name }}` in Instructions and Greeting (spaces inside braces are fine). Do **not** rely on `@name` for SpeakCoach scenario injection — Samvaad only substitutes `{{ }}` for runtime `agent_variables`.
2. **Voice:** write instructions in **neutral third person** (“the agent plays the buyer…”, “the user is the learner…”). Avoid “You are…” when the call has two roles — it confuses which side the agent holds.
3. **Language:** set spoken language in **Settings**, not in the prompt. A “speak English only” line fights multilingual runtime translation.
4. **Input variables:** every `{{ name }}` you use must exist under Variables → Input variables (defaults can be empty).

---

## Track 1 — Interviews (live)

| Field | Value |
|---|---|
| App id | `SpeakCoach--2af8ce6a-b04b` |
| Name | SpeakCoach Interviews |
| Org | `01a10b46-c948-764c-97a1-b2b72a88470d` |
| Workspace | `01a10b46-c953-7fee-8018-bd18dfe8d310` |
| Version | `2` (committed; industry interviewer prompt + multi-language + `call_language`) |

Replaces the old persona-hardcoded Alex Rivera app (`Alex-Rivera-26a1cc8d-9a78`). Interviewer identity now comes from `{{ participant_name }}` / role / tone / agenda. Prompt mirror is also stored in DB `prompts` (`voice.agent.interviews`).

### Instructions (committed)

Neutral third-person interviewer prompt using the variable contract above (`{{ scenario_title }}`, `{{ situation }}`, `{{ objectives }}`, etc.). Greeting default: “Thanks for joining today. Let's begin.” (overridden per session by `initial_bot_message` / `greeting`).

**Languages:** English, Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi (SpeakCoach central catalog). Default English. Voice preference is chosen in Setup by character gender; browser SDK does not yet override agent TTS speaker at call start.

After Indus edits, **Commit** and bump `tracks.sarvamVersion` in seed / DB.

---

## Track 2 — Sales (live)

| Field | Value |
|---|---|
| App id | `SpeakCoach--e8102ca0-0c25` |
| Name | SpeakCoach Sales |
| Org / workspace | Same as Interviews |
| Version | `2` (industry buyer prompt + multi-language + `call_language`) |

Prompt mirror is also stored in DB `prompts` (`voice.agent.sales`).

### Maintain

1. Instructions: Genie’s buyer draft (neutral voice + `{{ }}` vars).  
2. Variables: all names in the table above as Input variables.  
3. Settings: **supported languages** match SpeakCoach central catalog (English + 9 Indic).  
4. Greeting: optional `{{ greeting }}`; SpeakCoach also sends `initial_bot_message`.  
5. After Indus edits, **Commit** and bump `tracks.sarvamVersion` if needed.

### Genie follow-ups — what SpeakCoach needs

| Genie suggestion | Do it? |
|---|---|
| Dynamic intro via `greeting` / `user_name` | Optional. We already send `greeting` + `initial_bot_message`. Wiring Greeting to `{{ greeting }}` is nice; `user_name` is not required for v1. |
| Post-call disposition / success metric in Indus | **Skip for now.** SpeakCoach scores after the call via our own `/sessions/:id/complete` + chat rubric. Indus dispositions would duplicate that. |

Org/workspace for Sales can match Interviews. Only `app_id` is new.

---

## Hybrid override

If a scenario sets `sarvamAppId` (+ org/workspace), SpeakCoach uses that agent instead of the track agent (still sends the same variables).
