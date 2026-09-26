# Product Requirements (MVP)

## Problem

Professionals need realistic practice for high-stakes conversations. Generic tips and one-off role-play do not give repeatable, evidence-based feedback.

## MVP proposition

SpeakCoach MVP lets a learner prepare for a single interview-style conversation, rehearse it live against a Sarvam AI participant, and leave with a scored transcript they can act on.

## Primary user

Early-career or mid-career professional preparing for a job interview (or similar structured conversation).

## Jobs to be done

1. Understand the situation before speaking (Learn).  
2. See what “good” looks like (Watch).  
3. Practice out loud in real time (Practice).  
4. Know what to improve next (Feedback).

## Functional requirements

### FR-1 Auth
- User can sign up / sign in and reach the home screen.  
- Session persists across refresh.

### FR-2 Single scenario home
- Home shows one scenario card: title, short description, estimated duration, completion status.  
- CTA opens the scenario journey.

### FR-3 Learn
- Show situation context, AI participant profile, and learner objectives.  
- CTA advances to Watch.

### FR-4 Watch
- Show a short model conversation (text script for MVP; optional audio later).  
- CTA advances to Practice setup / call.

### FR-5 Live practice
- Start a Sarvam Voice Agents session (Alex Rivera persona, English).  
- Show elapsed time and End call.  
- Persist transcript with timestamps when the call ends.  
- Browser SDK + Node proxy; never expose `SARVAM_API_KEY` to the client.

### FR-6 Scoring
- After call end, run scoring against the five-criteria rubric.  
- Pass mark: **70 / 100**.  
- Show overall score, per-criterion scores, strengths, improvement priorities, coach notes, transcript.

### FR-7 Retry
- Learner can practice the same scenario again from the scenario page or feedback screen.

## Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | Voice turn latency targets in [latency-strategy.md](./latency-strategy.md) |
| NFR-2 | Works on modern Chrome/Edge desktop; mic permission required |
| NFR-3 | English only |
| NFR-4 | No webcam required |
| NFR-5 | Secrets (Sarvam keys) server-side only |

## Success metrics (MVP)

- Time from End call → feedback screen &lt; 15s for typical 3–5 min call.  
- Median AI response latency within target band.  
- ≥ 1 completed scored session per internal tester without support.

## Assumptions

- Sarvam Voice Agents provides realtime voice (verified locally with Alex Rivera agent).  
- Scoring runs post-call via `sarvam-105b` chat completions on the transcript.  
- Product API is Node/TS; browser never holds the Voice Agents API key.
