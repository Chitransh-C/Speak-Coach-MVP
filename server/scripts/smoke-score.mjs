/** End-to-end: create session → complete with transcript → scorecard via Sarvam chat. */
const base = "http://localhost:3001";

const learnerParagraph =
  "In my last role I led a cross-functional launch for a payments feature used by about fifty thousand customers. " +
  "I started by clarifying the success metric with product, then broke the work into weekly milestones. " +
  "When a dependency slipped, I raised the risk early and proposed a thinner first release so we still hit the date. " +
  "The outcome was a fourteen percent lift in activation and fewer support tickets in the first month. " +
  "I would love to hear how your team measures success for similar initiatives.";

async function main() {
  const email = `score-${Date.now()}@speakcoach.test`;
  const signupRes = await fetch(`${base}/api/v1/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: "password123",
      displayName: "Score Tester",
    }),
  });
  const signup = await signupRes.json();
  if (!signup.token) {
    console.error("signup failed", signupRes.status, signup);
    process.exit(1);
  }
  const token = signup.token;

  const sessRes = await fetch(`${base}/api/v1/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      scenarioId: "scenario-001",
      language: "en-IN",
      voice: "shubh",
    }),
  });
  const sess = await sessRes.json();
  console.log("session", sessRes.status, {
    sessionId: sess.sessionId,
    agent: sess.agent,
  });
  if (!sess.sessionId || !sess.agent) process.exit(1);

  const completeRes = await fetch(`${base}/api/v1/sessions/${sess.sessionId}/complete`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transcript: {
        turns: [
          { speaker: "agent", text: "Thanks for joining. Tell me about a recent project." },
          { speaker: "learner", text: learnerParagraph },
          { speaker: "agent", text: "What would you do differently next time?" },
          {
            speaker: "learner",
            text:
              "I would involve support earlier so we catch edge cases before launch, and I would keep a clearer rollback plan.",
          },
        ],
      },
    }),
  });
  const complete = await completeRes.json();
  console.log("complete", completeRes.status, JSON.stringify(complete, null, 2));

  if (completeRes.status !== 200 || !complete.score) {
    process.exit(1);
  }
  if (typeof complete.score.overall !== "number") {
    console.error("missing overall score");
    process.exit(1);
  }
  // Fetch session detail if model is exposed; otherwise reject heuristic coachNotes.
  const notes = complete.score.coachNotes || "";
  if (/heuristic/i.test(notes)) {
    console.error("FAIL: heuristic fallback still in use");
    process.exit(1);
  }
  console.log("OK scored overall=", complete.score.overall, "passed=", complete.score.passed);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
