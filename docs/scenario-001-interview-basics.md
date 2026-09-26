# Scenario 001 — Interview Basics

The **only** scenario in the SpeakCoach MVP.

## Meta

| Field | Value |
|---|---|
| ID | `scenario-001` |
| Title | Interview Basics: Tell Me About Yourself |
| Track | Interviews |
| Level | Beginner |
| Language | English |
| Est. duration | 8–12 minutes (incl. Learn/Watch) |
| Practice call | ~4–6 minutes |
| Points (display only) | 100 |
| Pass mark | 70 |

## Learner goal

Deliver a clear, structured self-introduction in a first-round interview and handle one follow-up probe.

## Learn — context

### Situation
You are in a first-round screening interview for a professional role. The interviewer opens with a classic prompt and expects a concise, relevant story — not a full life history.

### AI participant profile
- **Name:** Alex Rivera  
- **Role:** Hiring manager  
- **Tone:** Professional, warm, time-conscious  
- **Agenda:** Assess clarity, relevance, and composure under light pressure  

### What good looks like
- Opens with a crisp positioning statement  
- Uses a simple structure (present → past → future, or PREP-style)  
- Ties experience to the role  
- Ends with a soft close / invitation for questions  

### Learner objectives
1. Answer “Tell me about yourself” in under ~90 seconds of speaking time.  
2. Stay relevant to the job context.  
3. Handle one follow-up without freezing.

## Watch — model exchange (text)

**Alex:** Thanks for joining today. To start — tell me about yourself.

**Learner (model):** I’m a product analyst with three years in B2B SaaS. Most recently I owned onboarding metrics at BrightCart, where we cut time-to-value by 28%. Before that I was in customer success, which taught me how to translate user friction into product changes. I’m excited about this role because it sits at that same intersection of data and customer outcomes — and I’d love to go deeper on how your team defines success in the first 90 days.

**Alex:** That’s helpful. What would you say was the hardest part of that onboarding work?

**Learner (model):** Getting engineering and support aligned on what “activated” meant. We ran a two-week workshop, agreed on three events, and instrumented them the same week. Clarity beat more dashboards.

**Alex:** Great — let’s dig into a project next.

*(Watch ends; CTA: Start practice)*

## Practice — Sarvam system prompt (summary)

Full prompt lives in `/prompts/scenario-001-system.md` when implemented. Intent:

- You are Alex Rivera, hiring manager.  
- Open with a brief greeting, then ask “Tell me about yourself.”  
- Ask **one** substantive follow-up based on what they said.  
- Optionally ask a light clarification.  
- If answers are vague, ask for a concrete example once.  
- If learner is silent &gt; ~8s after your question, gently re-prompt once.  
- After ~4–6 minutes or a natural close, thank them and end.  
- Do not break character; do not coach mid-call; do not reveal scoring.

## Completion states

| Status | Meaning |
|---|---|
| `not_started` | Never opened practice |
| `in_progress` | Started a call, not scored |
| `completed` | At least one scored session exists |

Home card uses latest completed score if any.
