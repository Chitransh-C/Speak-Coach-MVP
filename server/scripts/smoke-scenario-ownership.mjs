/**
 * Smoke: global vs personal scenario visibility + cross-user 404.
 * Usage: node scripts/smoke-scenario-ownership.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envText = readFileSync(resolve(root, ".env"), "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      let v = l.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      return [l.slice(0, i).trim(), v];
    }),
);

const BASE = process.env.SMOKE_BASE || "http://127.0.0.1:3001/api/v1";
const ADMIN_EMAIL = env.ADMIN_EMAIL || "admin@rolesmith.local";
const ADMIN_PASSWORD = env.ADMIN_PASSWORD || "RoleSmithAdmin1!";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function api(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data };
}

async function login(email, password) {
  const { status, data } = await api("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  assert(status === 200 && data?.token, `login failed for ${email}: ${status} ${JSON.stringify(data)}`);
  return data.token;
}

async function signup(email, password, displayName) {
  const { status, data } = await api("/auth/signup", {
    method: "POST",
    body: { email, password, displayName },
  });
  if (status === 201 || status === 200) return data.token;
  // Already exists — login
  return login(email, password);
}

const stamp = Date.now();
const userAEmail = `owner-${stamp}@smoke.local`;
const userBEmail = `other-${stamp}@smoke.local`;
const password = "SmokePass123!";

console.log("Base", BASE);

const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
const userAToken = await signup(userAEmail, password, "Owner Smoke");
const userBToken = await signup(userBEmail, password, "Other Smoke");

const globalId = `smoke-global-${stamp}`;
const createGlobal = await api("/admin/scenarios", {
  method: "POST",
  token: adminToken,
  body: {
    id: globalId,
    trackId: "sales",
    title: "Smoke Global Scenario",
    description: "Visible in shared catalog",
    level: "beginner",
    estDurationMin: 10,
    practiceCallMin: 5,
    points: 100,
    passMark: 70,
    availability: "live",
    defaultLanguage: "en-IN",
    defaultVoice: "Charon",
    languages: ["en-IN"],
    voices: ["Charon"],
    learn: {
      situation: "Smoke global call",
      greeting: "Hi from global",
      participant: { name: "Glob", role: "Buyer", gender: "male", tone: "calm", agenda: "check" },
      objectives: ["Say hello"],
      whatGoodLooksLike: ["Clear greeting"],
    },
    watch: { turns: [{ speaker: "Glob", text: "Hello" }] },
  },
});
assert(createGlobal.status === 201, `admin create failed: ${createGlobal.status} ${JSON.stringify(createGlobal.data)}`);

const catalogA = await api("/scenarios", { token: userAToken });
assert(catalogA.status === 200, "catalog list failed");
assert(
  catalogA.data.scenarios.some((s) => s.id === globalId),
  "global scenario missing from learner catalog",
);
assert(
  !catalogA.data.scenarios.some((s) => s.trackId === "personal"),
  "personal track leaked into catalog",
);

const createPersonal = await api("/scenarios/mine", {
  method: "POST",
  token: userAToken,
  body: {
    title: "Smoke Personal Scenario",
    description: "Owner only",
    level: "beginner",
    estDurationMin: 10,
    practiceCallMin: 5,
    learn: {
      situation: "Smoke personal call",
      greeting: "Hi from personal",
      participant: { name: "Pers", role: "Coach", gender: "female", tone: "warm", agenda: "practice" },
      objectives: ["Practice"],
      whatGoodLooksLike: ["Stay on topic"],
    },
    watch: { turns: [{ speaker: "Pers", text: "Ready?" }] },
  },
});
assert(
  createPersonal.status === 201 && createPersonal.data?.id,
  `personal create failed: ${createPersonal.status} ${JSON.stringify(createPersonal.data)}`,
);
const personalId = createPersonal.data.id;
assert(createPersonal.data.availability === "live", "personal should default to live");
assert(createPersonal.data.ownerUserId, "personal should have ownerUserId");

const catalogAfter = await api("/scenarios", { token: userAToken });
assert(
  !catalogAfter.data.scenarios.some((s) => s.id === personalId),
  "personal scenario leaked into global catalog",
);

const mineA = await api("/scenarios/mine", { token: userAToken });
assert(mineA.data.scenarios.some((s) => s.id === personalId), "owner missing personal in /mine");

const mineB = await api("/scenarios/mine", { token: userBToken });
assert(!mineB.data.scenarios.some((s) => s.id === personalId), "other user saw personal in /mine");

const getOwner = await api(`/scenarios/${personalId}`, { token: userAToken });
assert(getOwner.status === 200, "owner should GET personal scenario");

const getOther = await api(`/scenarios/${personalId}`, { token: userBToken });
assert(getOther.status === 404, `cross-user GET should 404, got ${getOther.status}`);

const getMineOther = await api(`/scenarios/mine/${personalId}`, { token: userBToken });
assert(getMineOther.status === 404, `cross-user GET mine should 404, got ${getMineOther.status}`);

const sessionOther = await api("/sessions", {
  method: "POST",
  token: userBToken,
  body: { scenarioId: personalId, language: "en-IN", voice: "Aoede" },
});
assert(
  sessionOther.status === 404 || sessionOther.status === 409,
  `cross-user session should fail, got ${sessionOther.status}`,
);

const adminList = await api("/admin/scenarios", { token: adminToken });
assert(
  !adminList.data.scenarios.some((s) => s.id === personalId),
  "admin catalog should not list personal scenarios",
);
assert(
  adminList.data.scenarios.some((s) => s.id === globalId),
  "admin catalog missing global smoke scenario",
);

// Cleanup
await api(`/scenarios/mine/${personalId}`, { method: "DELETE", token: userAToken });
await api(`/admin/scenarios/${globalId}`, { method: "DELETE", token: adminToken });

console.log("SMOKE_OK scenario-ownership");
