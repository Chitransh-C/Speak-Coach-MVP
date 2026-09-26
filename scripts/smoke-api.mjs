const base = "http://localhost:3001";

async function main() {
  const loginRes = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "demo@speakcoach.test",
      password: "password123",
    }),
  });
  const login = await loginRes.json();
  console.log("login", loginRes.status, login.user?.email || login);
  const token = login.token;
  if (!token) process.exit(1);

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
    body: JSON.stringify({ scenarioId: "scenario-001" }),
  });
  const sess = await sessRes.json();
  console.log("session", sessRes.status, JSON.stringify(sess, null, 2));

  const a = sess.agent;
  const url = `${base}/api/sarvam/orgs/${a.orgId}/workspaces/${a.workspaceId}/apps/${a.appId}/url?interaction_type=call&version=1`;
  console.log("proxy url", url);
  const proxy = await fetch(url);
  const body = await proxy.text();
  console.log("proxy", proxy.status, body.slice(0, 300));

  const complete = await fetch(`${base}/api/v1/sessions/${sess.sessionId}/complete`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transcript: {
        turns: [
          { speaker: "Alex", text: "Tell me about yourself." },
          {
            speaker: "Learner",
            text:
              "I am a product analyst with three years in B2B SaaS. Most recently I owned onboarding metrics at BrightCart where we cut time to value by twenty eight percent. Before that I worked in customer success which taught me how to translate user friction into product changes. I am excited about this role because it sits at the intersection of data and customer outcomes.",
          },
          { speaker: "Alex", text: "What was hardest about that work?" },
          {
            speaker: "Learner",
            text:
              "Getting engineering and support aligned on what activated meant. We ran a workshop, agreed on three events, and instrumented them the same week.",
          },
        ],
      },
    }),
  });
  console.log("complete", complete.status, (await complete.text()).slice(0, 500));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
