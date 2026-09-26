# UI Screens (MVP)

Ship only these screens. Keep visual polish secondary to call reliability.

## 1. Auth
- Email + password (or magic link)  
- Link to Sign up / Sign in  

## 2. Home
- App name: SpeakCoach  
- Single scenario card: title, blurb, duration, status badge  
- Primary CTA: Start / Continue / Practice again  

## 3. Scenario — Learn
- Situation, participant profile, objectives  
- Primary: Continue to Watch  
- Secondary: Back to Home  

## 4. Scenario — Watch
- Model dialogue (chat-style text is enough)  
- Primary: Start practice  
- Optional: Back to Learn  

## 5. Live call
- Agent name + scenario title  
- Connection state: Connecting / Live / Reconnecting  
- Elapsed timer  
- Optional live captions  
- Primary: End call  
- Mic muted indicator if SDK supports mute  

## 6. Scoring interstitial
- “Scoring your conversation…”  
- No fake progress bar that stalls  

## 7. Feedback
- Overall score + Pass / Needs practice  
- Strengths list  
- Improvements list  
- Criterion breakdown (collapsible)  
- Coach notes  
- Metrics: talk/listen, questions, fillers  
- Full transcript  
- CTA: Practice again · Back to Home  

## 8. Error / empty states
- Mic denied  
- Sarvam connect failed  
- Insufficient dialogue to score  

## Navigation rules

- No global sidebar with unused modules.  
- Top bar: logo + display name + Sign out.  
- Deep links: `/`, `/scenarios/scenario-001/learn`, `/watch`, `/practice`, `/sessions/:id/feedback`.

## Accessibility (minimum)

- Focusable End call button  
- Captions readable (if shown)  
- Do not rely on color alone for Pass/Fail
