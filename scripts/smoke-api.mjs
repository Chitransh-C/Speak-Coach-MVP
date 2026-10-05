const base = "http://localhost:3001";

async function main() {
  const email = `v1-${Date.now()}@speakcoach.test`;
  const signupRes = await fetch(`${base}/api/v1/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: "password123",
      displayName: "V1 Tester",
    }),
  });
  const signup = await signupRes.json();
  console.log("signup", signupRes.status, signup.user?.email || signup);
  const token = signup.token;
  if (!token) process.exit(1);

  const tracks = await fetch(`${base}/api/v1/tracks`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("tracks", tracks.status, await tracks.text());

  const scen = await fetch(`${base}/api/v1/scenarios`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("scenarios", scen.status, await scen.text());

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
  console.log("session", sessRes.status, JSON.stringify(sess, null, 2));
  if (!sess.agent) process.exit(1);

  const a = sess.agent;
  const url = `${base}/api/sarvam/orgs/${a.orgId}/workspaces/${a.workspaceId}/apps/${a.appId}/url?interaction_type=call&version=${a.version}`;
  const proxy = await fetch(url);
  console.log("proxy", proxy.status, (await proxy.text()).slice(0, 200));

  const blocked = await fetch(`${base}/api/v1/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ scenarioId: "scenario-002" }),
  });
  console.log("stub blocked", blocked.status, await blocked.text());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
