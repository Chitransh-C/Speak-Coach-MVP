/** Smoke: signup → Gemini session create → ephemeral Live token mint (language + voice). */
const base = process.env.SMOKE_BASE || "http://localhost:3001";

async function main() {
  const email = `gemini-smoke-${Date.now()}@rolesmith.test`;

  const signupRes = await fetch(`${base}/api/v1/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: "password123",
      displayName: "Gemini Smoke",
    }),
  });
  const signup = await signupRes.json();
  console.log("1_signup", signupRes.status, signup.token ? "token_ok" : signup);
  if (!signup.token) process.exit(1);
  const token = signup.token;

  const scenariosRes = await fetch(`${base}/api/v1/scenarios`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const scenariosBody = await scenariosRes.json();
  const list = Array.isArray(scenariosBody)
    ? scenariosBody
    : scenariosBody.scenarios || scenariosBody.items || [];
  const live =
    list.find((s) => s.canPractice || s.availability === "live") || list[0];
  console.log("2_scenarios", scenariosRes.status, {
    count: list.length,
    pick: live?.id,
    canPractice: live?.canPractice,
    agentSource: live?.agentSource,
  });

  // Prefer a female scenario so Kore is a valid gender match; fall back to Charon.
  const detailRes = await fetch(`${base}/api/v1/scenarios/${live?.id || "scenario-001"}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const detail = await detailRes.json();
  const gender = detail.participantGender === "male" ? "male" : "female";
  const voice = gender === "female" ? "Kore" : "Charon";
  const language = "hi-IN";
  const languageLabel = "Hindi";

  const scenarioId = live?.id || "scenario-001";
  const sessRes = await fetch(`${base}/api/v1/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      scenarioId,
      language,
      voice,
    }),
  });
  const sess = await sessRes.json();
  console.log("3_session", sessRes.status, {
    sessionId: sess.sessionId,
    voiceProvider: sess.voiceProvider,
    language: sess.language,
    languageLabel: sess.languageLabel,
    voice: sess.voice,
    model: sess.voiceRuntime?.config?.model,
    voiceName: sess.voiceRuntime?.config?.voiceName,
    languageCode: sess.voiceRuntime?.config?.languageCode,
    error: sess.error,
  });

  if (!sess.sessionId || sess.voiceProvider !== "gemini") {
    console.error("FAIL: session missing or not gemini");
    process.exit(1);
  }
  if (sess.voiceRuntime?.config?.languageCode !== language) {
    console.error("FAIL: session languageCode mismatch", sess.voiceRuntime?.config);
    process.exit(1);
  }
  if (sess.voiceRuntime?.config?.voiceName !== voice) {
    console.error("FAIL: session voiceName mismatch", sess.voiceRuntime?.config);
    process.exit(1);
  }

  const mintRes = await fetch(`${base}/api/v1/gemini/ephemeral-token`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      languageCode: language,
      languageLabel,
      voiceId: voice,
      gender,
      participantName: sess.participantName || "Coach",
      agentVariables: sess.voiceRuntime?.agentVariables || {},
      callDurationMin: sess.callDurationMin || sess.practiceCallMin || 5,
    }),
  });
  const mintText = await mintRes.text();
  let mint;
  try {
    mint = JSON.parse(mintText);
  } catch {
    mint = { raw: mintText.slice(0, 500) };
  }
  console.log("4_ephemeral", mintRes.status, {
    hasToken: Boolean(mint.token),
    tokenPrefix: mint.token ? String(mint.token).slice(0, 24) + "…" : null,
    model: mint.model,
    voiceName: mint.voiceName,
    languageCode: mint.languageCode,
    callDurationMin: mint.callDurationMin ?? sess.callDurationMin,
    expiresAt: mint.expiresAt,
    error: mint.error,
    rawPreview: mint.raw,
  });

  if (!mintRes.ok || !mint.token) {
    console.error("FAIL: ephemeral mint");
    process.exit(1);
  }
  if (mint.languageCode !== language || mint.voiceName !== voice) {
    console.error("FAIL: mint language/voice mismatch", {
      languageCode: mint.languageCode,
      voiceName: mint.voiceName,
    });
    process.exit(1);
  }

  console.log("SMOKE_OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
