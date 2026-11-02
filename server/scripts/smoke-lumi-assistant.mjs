/**
 * Smoke: assistant-token mint + tool-backed APIs Lumi uses (list/create/navigate targets).
 * Usage: node scripts/smoke-lumi-assistant.mjs
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

const stamp = Date.now();
const email = `lumi-${stamp}@smoke.local`;
const password = "SmokePass123!";

const signup = await api("/auth/signup", {
  method: "POST",
  body: { email, password, displayName: "Lumi Smoke" },
});
assert(signup.status === 201 && signup.data?.token, `signup failed ${signup.status}`);
const token = signup.data.token;

const mint = await api("/gemini/assistant-token", {
  method: "POST",
  token,
  body: { languageCode: "en-IN", voiceId: "Aoede" },
});
assert(mint.status === 200 && mint.data?.token, `assistant mint failed ${mint.status} ${JSON.stringify(mint.data)}`);
assert(mint.data.callDurationMin === 2, `expected 2 min, got ${mint.data.callDurationMin}`);
console.log("1_mint_ok", { model: mint.data.model, voice: mint.data.voiceName, callMin: mint.data.callDurationMin });

const list = await api("/scenarios", { token });
assert(list.status === 200 && Array.isArray(list.data?.scenarios), "list scenarios failed");
console.log("2_list_ok", { count: list.data.scenarios.length });

const created = await api("/scenarios/mine", {
  method: "POST",
  token,
  body: {
    title: `Lumi smoke ${stamp}`,
    description: "Created via Lumi smoke create_scenario payload",
    level: "beginner",
    estDurationMin: 10,
    practiceCallMin: 5,
    availability: "live",
    defaultLanguage: "en-IN",
    defaultVoice: "Aoede",
    languages: ["en-IN"],
    voices: ["Aoede"],
    learn: {
      situation: "Help smoke test",
      greeting: "Hi from Lumi smoke",
      participant: { name: "SmokeBot", role: "Helper", gender: "female", tone: "warm", agenda: "test" },
      objectives: ["Confirm create works"],
      whatGoodLooksLike: ["Clear ask"],
    },
    watch: { turns: [{ speaker: "SmokeBot", text: "Ready?" }] },
  },
});
assert(created.status === 201 && created.data?.id, `create failed ${created.status}`);
console.log("3_create_ok", { id: created.data.id });

const sessions = await api("/sessions", { token });
assert(sessions.status === 200, "sessions list failed");
console.log("4_sessions_ok", { count: sessions.data?.sessions?.length ?? 0 });

await api(`/scenarios/mine/${created.data.id}`, { method: "DELETE", token });

console.log("SMOKE_OK lumi-assistant");
