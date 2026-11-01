import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envText = readFileSync(resolve(root, ".env"), "utf8");
const env = Object.fromEntries(
  envText.split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    let v = l.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    return [l.slice(0, i).trim(), v];
  }),
);
const apiKey = env.GEMINI_API_KEY.trim();
const model = env.GEMINI_VOICE_MODEL || "gemini-3.8-live";
const expireTime = new Date(Date.now() + 30 * 60_000).toISOString();
const newSessionExpireTime = new Date(Date.now() + 2 * 60_000).toISOString();

async function tryMint(label, url, body, headers = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log("\n==", label, res.status, text.slice(0, 280));
}

const keyQ = `https://generativelanguage.googleapis.com/v1beta/auth_tokens?key=${encodeURIComponent(apiKey)}`;
const keyQAlpha = `https://generativelanguage.googleapis.com/v1alpha/auth_tokens?key=${encodeURIComponent(apiKey)}`;

await tryMint("A simple v1beta", keyQ, { uses: 1, expireTime, newSessionExpireTime });
await tryMint("B header key simple", "https://generativelanguage.googleapis.com/v1beta/auth_tokens", { uses: 1, expireTime, newSessionExpireTime }, { "x-goog-api-key": apiKey });
await tryMint("C bidiGenerateContentSetup", keyQ, {
  uses: 1,
  expireTime,
  newSessionExpireTime,
  bidiGenerateContentSetup: {
    model: `models/${model}`,
    generationConfig: { responseModalities: ["AUDIO"] },
  },
});
await tryMint("D authToken wrap + bidi", keyQ, {
  authToken: {
    uses: 1,
    expireTime,
    newSessionExpireTime,
    bidiGenerateContentSetup: {
      model: `models/${model}`,
      generationConfig: { responseModalities: ["AUDIO"] },
    },
  },
});
await tryMint("E v1alpha liveConnectConstraints", keyQAlpha, {
  uses: 1,
  expireTime,
  newSessionExpireTime,
  liveConnectConstraints: {
    model: `models/${model}`,
    config: { responseModalities: ["AUDIO"], sessionResumption: {} },
  },
});
await tryMint("F v1alpha simple", keyQAlpha, { uses: 1, expireTime, newSessionExpireTime });
