/**
 * Browser-path smoke: runtime TTS speaker override via WebSocket start message.
 *
 * The npm sarvam-conv-ai-sdk (0.0.42) createStartInteractionMessageFromConfig
 * ONLY copies agent_variables / initial_language_name / initial_bot_message /
 * initial_state_name — it DROPS text_to_speech_config. So stock ConversationAgent
 * cannot pass speaker overrides even if you set them on config.
 *
 * This script mimics the browser flow (signed URL → WS → interaction_start)
 * and tests:
 *   A) stock start payload (no TTS) — baseline
 *   B) start payload WITH text_to_speech_config.speaker_name — what we'd need
 *
 * Usage (repo root, Node 18+):
 *   node scripts/smoke-tts-browser.mjs
 *   node scripts/smoke-tts-browser.mjs --speaker priya
 *   node scripts/smoke-tts-browser.mjs --via-proxy   # uses localhost:3001/api/sarvam
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const require = createRequire(import.meta.url);

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

loadEnvFile(resolve(ROOT, ".env"));
loadEnvFile(resolve(ROOT, "server", ".env"));

const ORG = process.env.SARVAM_ORG_ID;
const WORKSPACE = process.env.SARVAM_WORKSPACE_ID;
const API_KEY = process.env.SARVAM_API_KEY;
const APP = process.env.SARVAM_SMOKE_APP_ID || "SpeakCoach--b8e2a6f8-06c6";
const VERSION = Number(process.env.SARVAM_SMOKE_VERSION || "2");

const args = process.argv.slice(2);
const speaker =
  args.includes("--speaker") ? args[args.indexOf("--speaker") + 1] : "priya";
const viaProxy = args.includes("--via-proxy");
const timeoutMs = 15000;

function requireEnv(name, value) {
  if (!value) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
}

requireEnv("SARVAM_ORG_ID", ORG);
requireEnv("SARVAM_WORKSPACE_ID", WORKSPACE);
if (!viaProxy) requireEnv("SARVAM_API_KEY", API_KEY);

/** Same helper the SDK uses — stock start message (no TTS). */
function stockStartMessage(extra = {}) {
  return {
    type: "client.action.interaction_start",
    origin: "client",
    timestamp: Date.now() / 1000,
    agent_variables: {
      participant_name: "Alex Rivera",
      greeting: `Browser smoke stock start.`,
      scenario_title: "TTS browser smoke",
      ...extra.agent_variables,
    },
    initial_language_name: "English",
    initial_bot_message: extra.initial_bot_message || "Hello from stock browser start.",
    initial_state_name: undefined,
  };
}

function startWithTts(speakerName) {
  const msg = stockStartMessage({
    initial_bot_message: `Hello from browser path with speaker ${speakerName}.`,
    agent_variables: { greeting: `Hello. Browser TTS override smoke with ${speakerName}.` },
  });
  msg.text_to_speech_config = {
    speaker_name: speakerName,
    speech_settings: { pace: 1.0 },
  };
  return msg;
}

async function getSignedUrl() {
  const base = viaProxy
    ? "http://localhost:3001/api/sarvam/"
    : "https://apps.sarvam.ai/api/app-runtime/";
  let url =
    `${base}orgs/${ORG}/workspaces/${WORKSPACE}/apps/${APP}/url` +
    `?interaction_type=call&version=${VERSION}` +
    `&user_identifier=speakcoach_browser_tts_smoke` +
    `&user_identifier_type=custom`;

  const headers = {};
  if (!viaProxy) headers["X-API-Key"] = API_KEY;

  console.log(`[signed-url] GET ${url.replace(API_KEY || "", "***")}`);
  const res = await fetch(url, { headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`signed URL ${res.status}: ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  const wsUrl = data.url || data.websocket_url || data.signed_url;
  if (!wsUrl) throw new Error(`No ws url in response: ${text.slice(0, 300)}`);
  return wsUrl.includes("interaction_type=")
    ? wsUrl
    : `${wsUrl}${wsUrl.includes("?") ? "&" : "?"}interaction_type=call`;
}

function loadWs() {
  try {
    return require("ws");
  } catch {
    // frontend may have ws transitive; try from frontend node_modules
    return require(
      resolve(ROOT, "frontend/node_modules/ws"),
    );
  }
}

async function runCase(label, startPayload) {
  const WebSocket = loadWs();
  const wsUrl = await getSignedUrl();
  const result = {
    label,
    connected: false,
    audioChunks: 0,
    transcripts: 0,
    errors: [],
    firstTypes: [],
  };

  console.log(`\n=== ${label} ===`);
  console.log("  start keys:", Object.keys(startPayload).join(", "));
  if (startPayload.text_to_speech_config) {
    console.log("  TTS:", JSON.stringify(startPayload.text_to_speech_config));
  }

  await new Promise((resolvePromise, reject) => {
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => {
      try {
        ws.close();
      } catch {}
      resolvePromise();
    }, timeoutMs);

    ws.on("open", () => {
      result.connected = true;
      console.log("  WS open → sending interaction_start");
      ws.send(JSON.stringify(startPayload));
    });

    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const t = msg.type || "?";
      if (result.firstTypes.length < 8) result.firstTypes.push(t);

      if (t.includes("audio")) {
        result.audioChunks += 1;
        if (result.audioChunks === 1) console.log("  [audio] first chunk");
      }
      if (t.includes("transcript") || t.includes("transcription") || t.includes("text")) {
        result.transcripts += 1;
        const text = msg.content || msg.text || "";
        if (text) console.log(`  [text] ${String(text).slice(0, 120)}`);
      }
      if (t.includes("error") || msg.error) {
        result.errors.push(JSON.stringify(msg).slice(0, 200));
        console.log("  [error]", JSON.stringify(msg).slice(0, 200));
      }
      // Enough evidence
      if (result.audioChunks >= 5) {
        clearTimeout(timer);
        try {
          ws.close();
        } catch {}
        resolvePromise();
      }
    });

    ws.on("error", (err) => {
      result.errors.push(String(err.message || err));
      console.log("  WS error:", err.message || err);
    });

    ws.on("close", () => {
      clearTimeout(timer);
      resolvePromise();
    });
  });

  return result;
}

function demonstrateSdkStrip() {
  const sdkMsgPath = resolve(
    ROOT,
    "frontend/node_modules/sarvam-conv-ai-sdk/dist/utils/message.js",
  );
  console.log("\n=== Stock browser SDK strip check ===");
  console.log(`  File: ${sdkMsgPath}`);
  const src = readFileSync(sdkMsgPath, "utf8");
  const hasTtsInBuilder = /text_to_speech_config/.test(src);
  console.log(
    "  createStartInteractionMessageFromConfig includes text_to_speech_config?",
    hasTtsInBuilder ? "YES" : "NO (field is stripped / never copied)",
  );
  // Show the exact keys the builder copies:
  const m = src.match(
    /return \{[\s\S]*?agent_variables:[\s\S]*?\};/,
  );
  if (m) {
    console.log("  Builder snippet:");
    console.log(
      m[0]
        .split("\n")
        .map((l) => `    ${l}`)
        .join("\n"),
    );
  }
}

async function main() {
  console.log(`App=${APP} v${VERSION} speaker=${speaker} viaProxy=${viaProxy}`);

  demonstrateSdkStrip();

  const stock = await runCase("A) stock start (no TTS field)", stockStartMessage());
  const withTts = await runCase(
    `B) start WITH text_to_speech_config.speaker_name=${speaker}`,
    startWithTts(speaker),
  );

  console.log("\n=== SUMMARY ===");
  for (const r of [stock, withTts]) {
    const ok = r.connected && r.errors.length === 0 && r.audioChunks > 0;
    console.log(
      `  [${ok ? "OK" : "FAIL"}] ${r.label} audio=${r.audioChunks} text=${r.transcripts} errors=${r.errors.length}`,
    );
    console.log(`       types: ${r.firstTypes.join(", ") || "(none)"}`);
  }

  const ttsOk =
    withTts.connected && withTts.errors.length === 0 && withTts.audioChunks > 0;
  console.log(
    ttsOk
      ? `\nVerdict: Browser-path WS accepts text_to_speech_config (manual start). Stock ConversationAgent still STRIPS it — PracticePage needs a patch or SDK upgrade.`
      : `\nVerdict: Browser-path TTS override did NOT work cleanly. See errors above.`,
  );
  process.exit(ttsOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
