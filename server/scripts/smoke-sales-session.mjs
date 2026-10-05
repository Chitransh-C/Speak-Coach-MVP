/** Smoke: Sales track session uses SpeakCoach Sales agent + proxy 200. */
const base = "http://localhost:3001";
const EXPECTED_APP = "SpeakCoach--e8102ca0-0c25";
const EXPECTED_VERSION = 2;

const email = `sales-${Date.now()}@speakcoach.test`;
const signupRes = await fetch(`${base}/api/v1/auth/signup`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email,
    password: "password123",
    displayName: "Sales Smoke",
  }),
});
const signup = await signupRes.json();
if (!signup.token) {
  console.error("signup failed", signup);
  process.exit(1);
}

const sessRes = await fetch(`${base}/api/v1/sessions`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${signup.token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    scenarioId: "scenario-sales-001",
    language: "en-IN",
    voice: "priya",
  }),
});
const sess = await sessRes.json();
console.log("session", sessRes.status, {
  trackId: sess.trackId,
  appId: sess.agent?.appId,
  version: sess.agent?.version,
});
if (sess.agent?.appId !== EXPECTED_APP || sess.agent?.version !== EXPECTED_VERSION) {
  console.error("unexpected agent", sess.agent);
  process.exit(1);
}

const a = sess.agent;
const url = `${base}/api/sarvam/orgs/${a.orgId}/workspaces/${a.workspaceId}/apps/${a.appId}/url?interaction_type=call&version=${a.version}`;
const proxy = await fetch(url);
const proxyText = await proxy.text();
console.log("proxy", proxy.status, proxyText.slice(0, 160));
if (proxy.status !== 200) process.exit(1);
console.log("OK sales session + proxy");
