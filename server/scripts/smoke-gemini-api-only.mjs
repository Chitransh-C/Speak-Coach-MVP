/**
 * DB-free smoke: validate GEMINI_API_KEY can mint a Live ephemeral token.
 * Loads server/.env manually (no app boot).
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envText = readFileSync(resolve(root, ".env"), "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      const k = l.slice(0, i).trim();
      let v = l.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      return [k, v];
    }),
);

const apiKey = env.GEMINI_API_KEY?.trim();
const model = env.GEMINI_VOICE_MODEL || "gemini-3.8-live";
if (!apiKey) {
  console.error("FAIL: GEMINI_API_KEY missing in server/.env");
  process.exit(1);
}
console.log("key_present", true, "key_prefix", apiKey.slice(0, 6) + "…", "model", model);

// 1) Cheap generateContent check (chat key path)
const chatModel = env.GEMINI_CHAT_MODEL || "gemini-2.5-flash";
const chatUrl =
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(chatModel)}:generateContent` +
  `?key=${encodeURIComponent(apiKey)}`;
const chatRes = await fetch(chatUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    contents: [{ role: "user", parts: [{ text: "Reply with exactly: ok" }] }],
  }),
});
const chatText = await chatRes.text();
console.log("1_generateContent", chatRes.status, chatText.slice(0, 220));

// 2) Ephemeral Live token mint
const expireTime = new Date(Date.now() + 30 * 60_000).toISOString();
const newSessionExpireTime = new Date(Date.now() + 2 * 60_000).toISOString();
const mintUrl = `https://generativelanguage.googleapis.com/v1beta/auth_tokens?key=${encodeURIComponent(apiKey)}`;
const mintRes = await fetch(mintUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-goog-api-key": apiKey,
  },
  body: JSON.stringify({
    uses: 1,
    expireTime,
    newSessionExpireTime,
    bidiGenerateContentSetup: {
      model: model.startsWith("models/") ? model : `models/${model}`,
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          languageCode: "hi-IN",
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
        },
      },
      systemInstruction: {
        parts: [{ text: "You are a short smoke-test voice agent. Say hello once." }],
      },
      sessionResumption: {},
    },
  }),
});
const mintText = await mintRes.text();
let mint;
try {
  mint = JSON.parse(mintText);
} catch {
  mint = { raw: mintText.slice(0, 500) };
}
console.log("2_auth_tokens", mintRes.status, {
  hasName: Boolean(mint.name),
  namePrefix: mint.name ? String(mint.name).slice(0, 28) + "…" : null,
  error: mint.error,
  rawPreview: mint.raw || (!mint.name ? mintText.slice(0, 400) : undefined),
});

if (!chatRes.ok) {
  console.error("FAIL: generateContent");
  process.exit(1);
}
if (!mintRes.ok || !mint.name) {
  console.error("FAIL: ephemeral token");
  process.exit(1);
}
console.log("GEMINI_API_SMOKE_OK");
