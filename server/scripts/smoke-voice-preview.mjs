/** Smoke: login → POST /gemini/voice-preview → audio bytes */
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
const email = env.ADMIN_EMAIL || "admin@rolesmith.local";
const password = env.ADMIN_PASSWORD || "RoleSmithAdmin1!";

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

const login = await api("/auth/login", { method: "POST", body: { email, password } });
assert(login.status === 200 && login.data?.token, `login failed ${login.status}`);
const token = login.data.token;

const locales = await api("/locales", { token });
assert(locales.status === 200, "locales failed");
assert(locales.data.languages.length >= 20, `need ≥20 languages, got ${locales.data.languages.length}`);
const males = locales.data.voices.filter((v) => v.gender === "male");
const females = locales.data.voices.filter((v) => v.gender === "female");
assert(males.length >= 10, `need ≥10 male voices, got ${males.length}`);
assert(females.length >= 10, `need ≥10 female voices, got ${females.length}`);
console.log("1_catalog_ok", {
  languages: locales.data.languages.length,
  male: males.length,
  female: females.length,
});

const preview = await api("/gemini/voice-preview", {
  method: "POST",
  token,
  body: { voiceId: "Kore", languageCode: "en-IN" },
});
assert(preview.status === 200 && preview.data?.audioBase64, `preview failed ${preview.status} ${JSON.stringify(preview.data)}`);
assert(preview.data.audioBase64.length > 100, "audio too short");
console.log("2_preview_ok", {
  mime: preview.data.mimeType,
  bytesApprox: Math.round((preview.data.audioBase64.length * 3) / 4),
  voice: preview.data.voiceId,
});

console.log("SMOKE_OK voice-preview");
