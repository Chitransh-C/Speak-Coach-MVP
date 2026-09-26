# Scoring Rubric (MVP)

Aligned with the SpeakCoach brochure: **five criteria**, pass mark **70 / 100**.

## Pass / fail

- Total score = weighted sum of criterion scores (each 0–100, then weighted).  
- **Pass if total ≥ 70.**

## Criteria & weights

| ID | Criterion | Weight | What we measure |
|---|---|---|---|
| C1 | Curiosity & Close | 20% | Purposeful questions / forward motion; ending with a clear next step when appropriate |
| C2 | Structure & Clarity | 25% | Organised answer; easy to follow; concise |
| C3 | Listening & Fit | 20% | Answers address what was asked; adapts to follow-ups |
| C4 | Composure Under Pressure | 15% | Handles probes without collapsing; recovers from stumbles |
| C5 | Evidence & Specifics | 20% | Concrete examples, numbers, outcomes — not vague claims |

Weights sum to 100%.

## Scorecard JSON schema (API / Sarvam output)

```json
{
  "overall": 78,
  "passed": true,
  "passMark": 70,
  "criteria": [
    {
      "id": "C1",
      "name": "Curiosity & Close",
      "weight": 20,
      "score": 72,
      "evidence": [
        {
          "timestampMs": 185000,
          "quote": "I’d love to hear how your team measures success…",
          "note": "Closed with a relevant question."
        }
      ]
    }
  ],
  "strengths": ["Clear positioning in the opening 20 seconds."],
  "improvements": ["Add one quantified outcome when describing past work."],
  "coachNotes": "Solid structure. Next time, prepare one metric for the flagship story.",
  "metrics": {
    "talkListenRatio": 0.62,
    "questionsAsked": 1,
    "fillerWordCount": 8
  }
}
```

## Behavioral metrics (MVP)

Compute on transcript where possible:

| Metric | How |
|---|---|
| Talk / listen ratio | Approx. by speaker-labeled durations or word counts |
| Questions asked | Count learner `?` / interrogatives |
| Filler words | Count um, uh, like (as filler), you know |

If durations are unavailable, approximate from word counts and label clearly in UI as estimated.

## Scoring prompt rules

- Use only the transcript (and speaker labels).  
- Every strength / improvement should cite a quote or timestamp when possible.  
- Do not invent events not in the transcript.  
- Return **valid JSON only**.  
- If transcript is too short (&lt; ~40 learner words), return `{ "insufficient": true }` instead of a fake score.

## UI mapping

Feedback screen shows:

1. Overall score + Pass/Fail  
2. Strengths / improvements  
3. Criterion breakdown (expandable evidence)  
4. Coach notes  
5. Metrics row  
6. Full transcript
