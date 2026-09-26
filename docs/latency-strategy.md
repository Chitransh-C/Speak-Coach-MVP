# Latency Strategy (MVP)

Latency is a first-class MVP goal.

## Targets

| Metric | Target | Stretch |
|---|---|---|
| Mic grant → Sarvam connected | &lt; 2.0s | &lt; 1.0s |
| User stops speaking → first AI audio (p50) | &lt; 800ms | &lt; 500ms |
| Same (p95) | &lt; 1.5s | &lt; 1.0s |
| End call → feedback with scores | &lt; 15s | &lt; 8s |

Measure on desktop Chrome; prefer headset over laptop array for demos.

## Rules

1. **No SpeakCoach API hop on the audio loop** — Voice Agents owns ASR→LLM→TTS.  
2. **Warm / prefetch** — start Sarvam connect while user is on Watch / Start practice.  
3. **Short live prompt** — long Learn copy stays in UI only.  
4. **Stream TTS** — play first audio bytes immediately (`BrowserAudioInterface` buffering).  
5. **Use Sarvam VAD** — do not add a second endpointing layer.  
6. **Score offline** — after call end only.  
7. **Browser proxy** — Node only injects `X-API-Key`; do not relay PCM through extra app servers if avoidable.

## Mic quality affects “latency” perception

Verified: quiet mic → no user transcript → agent appears stuck / hangs up ~10–15s after greeting.

- Preflight: `scripts/mic-check.py`  
- Laptop array: `--gain 8` (or headset device)  
- Demo: wired headset when possible  

## Client UX

- Immediate “Connecting…” state on Start.  
- Agent speaks first (greeting) so silence ≠ broken.  
- Optional live captions.  
- End call → “Scoring…” (no fake stuck progress).

## Instrumentation

```
t0 start_click
t1 mic_ready
t2 sarvam_connected          # interaction_connected
t3 user_utterance_end
t4 first_ai_audio_byte
t5 end_call_click
t6 score_ready
```

Log `{sessionId, deltas}` from client → API.

## Failure modes

| Symptom | Likely cause | Mitigation |
|---|---|---|
| 401 on connect | Wrong key type (`sk_` not `sk_samvaad_`) | Voice Agents API keys |
| Connect OK, hang up ~14s, no `user:` lines | Mic too quiet | `mic-check` + gain / headset |
| Long first reply | Huge prompt | Trim Indus Instructions |
| Choppy audio | Network / buffer | Raise `prebufferMs` on browser SDK; wired net |
| Score slow | Long transcript + 105B | Cap length; keep sync if &lt; 15s |

## Demo checklist

- [ ] Chrome + headset  
- [ ] `mic-check` OK  
- [ ] Prefetch / fast connect  
- [ ] Alex greets quickly  
- [ ] 3+ conversational turns with transcripts  
- [ ] End → feedback &lt; 15s  
