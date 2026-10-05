"""
Smoke: does Sarvam accept runtime text_to_speech_config.speaker_name?

Usage (repo root):
  python scripts/smoke-tts-override.py
  python scripts/smoke-tts-override.py --speaker shubh
  python scripts/smoke-tts-override.py --speaker priya --language Hindi

Uses Interviews track agent by default. Headless (no mic) — waits for bot greeting.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from pydantic import SecretStr

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "server" / ".env", override=False)

from sarvam_conv_ai_sdk import (  # noqa: E402
    AsyncSamvaadAgent,
    InteractionConfig,
    InteractionType,
    SarvamToolLanguageName,
    SpeechSettings,
    TextToSpeechConfig,
)
from sarvam_conv_ai_sdk.messages.types import UserIdentifierType  # noqa: E402

# SpeakCoach Interviews (variable-driven) — committed multi-lang v2
DEFAULT_APP = "SpeakCoach--b8e2a6f8-06c6"
DEFAULT_VERSION = 2

LANG_MAP = {
    "english": SarvamToolLanguageName.ENGLISH,
    "hindi": SarvamToolLanguageName.HINDI,
    "bengali": SarvamToolLanguageName.BENGALI,
    "tamil": SarvamToolLanguageName.TAMIL,
    "telugu": SarvamToolLanguageName.TELUGU,
    "marathi": SarvamToolLanguageName.MARATHI,
    "gujarati": SarvamToolLanguageName.GUJARATI,
    "kannada": SarvamToolLanguageName.KANNADA,
    "malayalam": SarvamToolLanguageName.MALAYALAM,
    "punjabi": SarvamToolLanguageName.PUNJABI,
}


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        print(f"Missing {name}", file=sys.stderr)
        sys.exit(1)
    return value


async def run_once(speaker: str, language: SarvamToolLanguageName, timeout_s: float) -> dict:
    org_id = require_env("SARVAM_ORG_ID")
    workspace_id = require_env("SARVAM_WORKSPACE_ID")
    api_key = require_env("SARVAM_API_KEY")
    app_id = os.getenv("SARVAM_SMOKE_APP_ID", DEFAULT_APP).strip() or DEFAULT_APP
    version = int(os.getenv("SARVAM_SMOKE_VERSION", str(DEFAULT_VERSION)))

    result: dict = {
        "speaker": speaker,
        "language": language.value if hasattr(language, "value") else str(language),
        "app_id": app_id,
        "version": version,
        "connected": False,
        "interaction_id": None,
        "transcripts": [],
        "audio_chunks": 0,
        "error": None,
    }

    async def on_transcript(msg):
        text = (getattr(msg, "content", None) or "").strip()
        role = getattr(msg, "role", None)
        role_s = getattr(role, "value", str(role))
        if text:
            result["transcripts"].append({"role": role_s, "text": text[:200]})
            print(f"  [{role_s}] {text[:160]}")

    async def on_audio(msg):
        result["audio_chunks"] += 1
        if result["audio_chunks"] == 1:
            print("  [audio] first agent audio chunk received")

    async def on_event(event):
        et = getattr(event, "type", None)
        et_s = getattr(et, "value", str(et))
        if "connected" in et_s.lower() or "interaction_connected" in et_s.lower():
            result["connected"] = True
            print(f"  [event] {et_s}")

    config = InteractionConfig(
        user_identifier_type=UserIdentifierType.CUSTOM,
        user_identifier="speakcoach_tts_smoke",
        org_id=org_id,
        workspace_id=workspace_id,
        app_id=app_id,
        version=version,
        interaction_type=InteractionType.CALL,
        sample_rate=16000,
        initial_language_name=language,
        initial_bot_message=(
            f"Hello. This is a SpeakCoach voice smoke test using speaker {speaker}."
        ),
        agent_variables={
            "participant_name": "Alex Rivera",
            "greeting": f"Hello. Smoke test with speaker {speaker}.",
            "scenario_title": "TTS override smoke",
        },
        text_to_speech_config=TextToSpeechConfig(
            speaker_name=speaker,
            speech_settings=SpeechSettings(pace=1.0),
        ),
    )

    print(f"\n=== Start call: speaker={speaker!r} language={result['language']} app={app_id} v{version}")
    agent = AsyncSamvaadAgent(
        api_key=SecretStr(api_key),
        config=config,
        audio_callback=on_audio,
        transcript_callback=on_transcript,
        event_callback=on_event,
    )

    try:
        await agent.start()
        ok = await agent.wait_for_connect(timeout=15.0)
        result["connected"] = bool(ok) or result["connected"]
        result["interaction_id"] = agent.get_interaction_id()
        print(f"  interaction_id={result['interaction_id']}")

        # Wait for greeting audio/transcript, then stop.
        deadline = asyncio.get_event_loop().time() + timeout_s
        while asyncio.get_event_loop().time() < deadline:
            if result["audio_chunks"] > 0 or any(
                t["role"] in ("bot", "BOT", "agent", "AGENT") or "bot" in t["role"].lower()
                for t in result["transcripts"]
            ):
                break
            await asyncio.sleep(0.25)
        await asyncio.sleep(1.0)  # let a bit more audio arrive
    except Exception as exc:
        result["error"] = f"{type(exc).__name__}: {exc}"
        print(f"  ERROR: {result['error']}")
    finally:
        try:
            await agent.stop()
        except Exception:
            pass

    return result


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--speaker", default="priya", help="Sarvam speaker_name override")
    parser.add_argument("--language", default="English", help="Sarvam language name")
    parser.add_argument("--timeout", type=float, default=12.0)
    parser.add_argument(
        "--compare",
        action="store_true",
        help="Run twice: shubh then priya (connection/acceptance check)",
    )
    args = parser.parse_args()

    lang_key = args.language.strip().lower()
    if lang_key not in LANG_MAP:
        print(f"Unknown language {args.language!r}. Known: {', '.join(LANG_MAP)}", file=sys.stderr)
        sys.exit(2)
    language = LANG_MAP[lang_key]

    speakers = ["shubh", "priya"] if args.compare else [args.speaker]
    results = []
    for sp in speakers:
        results.append(await run_once(sp, language, args.timeout))

    print("\n=== SUMMARY ===")
    for r in results:
        status = "OK" if r["connected"] and not r["error"] else "FAIL"
        print(
            f"  [{status}] speaker={r['speaker']} lang={r['language']} "
            f"audio_chunks={r['audio_chunks']} transcripts={len(r['transcripts'])} "
            f"err={r['error']}"
        )

    # Success = at least one run connected without error (field accepted).
    # Voice timbre change cannot be proven headless; acceptance is the smoke gate.
    if any(r["error"] for r in results) or not any(r["connected"] for r in results):
        sys.exit(1)
    print(
        "\nVerdict: Sarvam accepted text_to_speech_config.speaker_name on start "
        "(Python SDK). Listen in a live call to confirm timbre changed."
    )


if __name__ == "__main__":
    asyncio.run(main())
