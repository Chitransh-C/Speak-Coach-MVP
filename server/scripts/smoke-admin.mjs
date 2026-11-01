/** Smoke: admin login → /admin/stats 200; learner → 403 */
const base = process.env.SMOKE_BASE || "http://localhost:3001";

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@rolesmith.local";
  const adminPassword = process.env.ADMIN_PASSWORD || "RoleSmithAdmin1!";

  const adminLogin = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  const adminBody = await adminLogin.json();
  console.log("1_admin_login", adminLogin.status, {
    role: adminBody.user?.role,
    hasToken: Boolean(adminBody.token),
  });
  if (!adminBody.token || adminBody.user?.role !== "admin") {
    console.error("FAIL: admin login / role");
    process.exit(1);
  }

  const stats = await fetch(`${base}/api/v1/admin/stats`, {
    headers: { Authorization: `Bearer ${adminBody.token}` },
  });
  const statsBody = await stats.json();
  console.log("2_admin_stats", stats.status, {
    usersTotal: statsBody.kpis?.usersTotal,
    voice: statsBody.system?.voiceProvider,
  });
  if (!stats.ok) {
    console.error("FAIL: admin stats", statsBody);
    process.exit(1);
  }

  const learnerEmail = `learner-admin-smoke-${Date.now()}@rolesmith.test`;
  const signup = await fetch(`${base}/api/v1/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: learnerEmail,
      password: "password123",
      displayName: "Learner Smoke",
    }),
  });
  const learner = await signup.json();
  console.log("3_learner_signup", signup.status, { role: learner.user?.role });
  if (!learner.token || learner.user?.role !== "learner") {
    console.error("FAIL: learner signup");
    process.exit(1);
  }

  const forbidden = await fetch(`${base}/api/v1/admin/stats`, {
    headers: { Authorization: `Bearer ${learner.token}` },
  });
  console.log("4_learner_admin_stats", forbidden.status);
  if (forbidden.status !== 403) {
    console.error("FAIL: expected 403 for learner");
    process.exit(1);
  }

  console.log("SMOKE_OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
