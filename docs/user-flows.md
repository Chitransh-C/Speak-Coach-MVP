# User Flows (MVP)

## Flow A — First-time practice (happy path)

```
Sign up / Sign in
  → Home (1 scenario card)
  → Scenario: Learn
  → Scenario: Watch
  → Start practice (mic permission)
  → Live call with Sarvam AI
  → End call
  → Scoring in progress
  → Feedback (score + transcript)
  → Practice again (optional)
```

## Flow B — Returning user

```
Sign in
  → Home (shows Completed / Not started)
  → Open scenario
  → Skip to Practice OR redo Learn/Watch
  → Live call → Feedback
```

## Flow C — Call failure / mic denied

```
Start practice
  → Mic permission denied OR Sarvam connect fails
  → Error state with Retry / Back to scenario
  → No partial score saved
```

## Flow D — Empty / abandoned call

```
Start practice
  → User ends within ~10s / no speech
  → Soft message: “Not enough conversation to score”
  → Option to retry; no pass/fail scorecard
```

## Screen transitions

| From | Action | To |
|---|---|---|
| Auth | Success | Home |
| Home | Open scenario | Learn |
| Learn | Continue | Watch |
| Watch | Start practice | Live call |
| Live call | End | Scoring → Feedback |
| Feedback | Practice again | Live call (or setup) |
| Feedback | Back | Home / Scenario |

## Notes

- No Bixy, no journey map, no setup wizard with language/accent.  
- Default: English + one fixed Sarvam voice/persona for Scenario 001.
