"""
Local smoke test: live voice call with Alex Rivera (Scenario 001) via Sarvam.

Usage (from repo root):
  pip install -r requirements-smoke.txt
  python scripts/talk-to-agent.py
  python scripts/talk-to-agent.py --list-devices

Optional .env:
  SARVAM_INPUT_DEVICE_INDEX=10   # from --list-devices

Speak into your mic. Ctrl+C to end.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import struct
import sys
import time
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from pydantic import SecretStr

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logging.getLogger("sarvam_conv_ai_sdk").setLevel(logging.INFO)
logging.getLogger("httpx").setLevel(logging.WARNING)

_stats = {
    "chunks_out": 0,
    "chunks_in": 0,
    "max_rms": 0.0,
    "last_rms": 0.0,
}


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value or value.startswith("<"):
        print(f"Missing {name} in .env", file=sys.stderr)
        sys.exit(1)
    return value


def pcm16_rms(audio: bytes) -> float:
    if len(audio) < 2:
        return 0.0
    n = len(audio) // 2
    samples = struct.unpack(f"<{n}h", audio[: n * 2])
    if not samples:
        return 0.0
    return (sum(s * s for s in samples) / len(samples)) ** 0.5


def pcm16_gain(audio: bytes, gain: float) -> bytes:
    """Software mic boost (laptop arrays are often too quiet for cloud VAD)."""
    if gain == 1.0 or len(audio) < 2:
        return audio
    n = len(audio) // 2
    samples = struct.unpack(f"<{n}h", audio[: n * 2])
    boosted = []
    for s in samples:
        v = int(s * gain)
        if v > 32767:
            v = 32767
        elif v < -32768:
            v = -32768
        boosted.append(v)
    return struct.pack(f"<{n}h", *boosted)


def list_input_devices() -> None:
    import pyaudio

    p = pyaudio.PyAudio()
    print("Input devices (use index with SARVAM_INPUT_DEVICE_INDEX):\n")
    try:
        default = p.get_default_input_device_info()
        print(f"Default input: [{default['index']}] {default['name']}")
    except Exception as exc:
        print(f"Default input: unavailable ({exc})")
    print()
    for i in range(p.get_device_count()):
        info = p.get_device_info_by_index(i)
        if int(info.get("maxInputChannels") or 0) > 0:
            print(
                f"  [{i}] {info.get('name')}  "
                f"channels={info.get('maxInputChannels')}  "
                f"rate={info.get('defaultSampleRate')}"
            )
    p.terminate()


async def handle_transcript(msg) -> None:
    role_s = str(getattr(msg, "role", ""))
    content = getattr(msg, "content", "") or ""
    if "USER" in role_s:
        label = "You"
    elif "BOT" in role_s or "AGENT" in role_s:
        label = "Alex"
    else:
        label = role_s
    print(f"\n{label}: {content}", flush=True)


async def handle_event(event) -> None:
    etype = str(getattr(event, "type", type(event).__name__))
    if "user_speech_start" in etype:
        print("[vad] Server heard you start speaking", flush=True)
    elif "user_speech_end" in etype:
        print("[vad] Server heard you stop speaking", flush=True)
    elif "interaction_end" in etype:
        print("[event] interaction_end (agent hung up)", flush=True)
    else:
        print(f"[event] {etype}", flush=True)
    for attr in (
        "interaction_id",
        "initial_language_name",
        "initial_state_name",
        "reason",
        "message",
        "error",
        "agent_variables",
    ):
        if hasattr(event, attr):
            val = getattr(event, attr)
            if val not in (None, "", {}):
                print(f"         {attr}={val!r}", flush=True)


async def handle_text(msg) -> None:
    text = getattr(msg, "text", None) or getattr(msg, "content", "") or ""
    if text:
        print(f"[text] {text[:120]}", flush=True)


async def mic_heartbeat(agent, stop: asyncio.Event) -> None:
    while not stop.is_set():
        await asyncio.sleep(2.0)
        sent = getattr(agent, "_client_audio_chunks_sent", 0)
        print(
            f"[mic] chunks_sent={sent} rms~{_stats['last_rms']:.0f} "
            f"peak_rms={_stats['max_rms']:.0f} agent_audio={_stats['chunks_in']}",
            flush=True,
        )


async def main(device_index: Optional[int], gain: float) -> None:
    import pyaudio
    from sarvam_conv_ai_sdk import (
        AsyncDefaultAudioInterface,
        AsyncSamvaadAgent,
        InteractionConfig,
        InteractionType,
        SarvamToolLanguageName,
    )
    from sarvam_conv_ai_sdk.messages.types import OUTPUT_SAMPLE_RATE, UserIdentifierType

    api_key = require_env("SARVAM_API_KEY")
    org_id = require_env("SARVAM_ORG_ID")
    workspace_id = require_env("SARVAM_WORKSPACE_ID")
    app_id = require_env("SARVAM_APP_ID")

    version_raw = os.getenv("SARVAM_AGENT_VERSION", "1").strip()
    if version_raw.isdigit():
        version = int(version_raw)
    elif version_raw.lower() in {"v1", "1"}:
        version = 1
    else:
        version = 1

    if device_index is None:
        raw = os.getenv("SARVAM_INPUT_DEVICE_INDEX", "").strip()
        if raw.isdigit():
            device_index = int(raw)

    gain_env = os.getenv("SARVAM_MIC_GAIN", "").strip()
    if gain_env:
        try:
            gain = float(gain_env)
        except ValueError:
            pass

    class MeteredAudio(AsyncDefaultAudioInterface):
        """Default audio + RMS metering + optional input device index."""

        def __init__(
            self,
            input_sample_rate: int = 16000,
            input_device_index: Optional[int] = None,
            gain: float = 1.0,
        ):
            super().__init__(input_sample_rate=input_sample_rate)
            self.input_device_index = input_device_index
            self.gain = gain

        async def start(self, input_callback):
            self.loop = asyncio.get_running_loop()

            async def wrapped(audio_data: bytes, frame_count: int):
                audio_data = pcm16_gain(audio_data, self.gain)
                rms = pcm16_rms(audio_data)
                _stats["last_rms"] = rms
                _stats["max_rms"] = max(_stats["max_rms"], rms)
                _stats["chunks_out"] += 1
                await input_callback(audio_data, frame_count)

            self.input_callback = wrapped
            self.output_queue = asyncio.Queue()
            self.should_stop = asyncio.Event()
            self.p = pyaudio.PyAudio()

            open_kwargs = dict(
                format=pyaudio.paInt16,
                channels=1,
                rate=self.input_sample_rate,
                input=True,
                stream_callback=self._pyaudio_input_callback,
                frames_per_buffer=self.INPUT_FRAMES_PER_BUFFER,
                start=True,
            )
            if self.input_device_index is not None:
                open_kwargs["input_device_index"] = self.input_device_index
                info = self.p.get_device_info_by_index(self.input_device_index)
                print(f"Using mic device [{self.input_device_index}] {info.get('name')}", flush=True)
            else:
                try:
                    d = self.p.get_default_input_device_info()
                    print(f"Using default mic [{d['index']}] {d.get('name')}", flush=True)
                except Exception:
                    print("Using default mic (unnamed)", flush=True)

            self.input_stream = self.p.open(**open_kwargs)
            self.output_stream = self.p.open(
                format=pyaudio.paInt16,
                channels=1,
                rate=self.output_sample_rate,
                output=True,
                frames_per_buffer=self.OUTPUT_FRAMES_PER_BUFFER,
                start=True,
            )
            self.output_task = asyncio.create_task(self._output_task())

        async def output(self, audio: bytes, sample_rate=None):
            _stats["chunks_in"] += 1
            if _stats["chunks_in"] == 1:
                print(
                    "\n[audio] First agent audio chunk (you should hear Alex).",
                    flush=True,
                )
            await super().output(audio, sample_rate=sample_rate)

    config = InteractionConfig(
        org_id=org_id,
        workspace_id=workspace_id,
        app_id=app_id,
        user_identifier="speakcoach_local_demo",
        user_identifier_type=UserIdentifierType.CUSTOM,
        interaction_type=InteractionType.CALL,
        sample_rate=16000,
        version=version,
        initial_language_name=SarvamToolLanguageName.ENGLISH,
        agent_variables={
            "user_name": "Demo Candidate",
            "call_summary": "",
        },
    )

    print("Connecting to Alex Rivera…")
    print("After connect: unmute speakers, speak clearly. Ctrl+C to hang up.\n")
    print(f"Mic gain={gain}x  (raise with --gain 8 if still quiet)\n")

    agent = AsyncSamvaadAgent(
        api_key=SecretStr(api_key),
        config=config,
        audio_interface=MeteredAudio(
            input_sample_rate=16000,
            input_device_index=device_index,
            gain=gain,
        ),
        transcript_callback=handle_transcript,
        event_callback=handle_event,
        text_callback=handle_text,
    )

    stop_hb = asyncio.Event()
    hb_task: asyncio.Task | None = None

    try:
        await agent.start()
        connected = await agent.wait_for_connect(timeout=20.0)
        if not connected:
            print("Timed out waiting for connection.", file=sys.stderr)
            return

        print("WebSocket up. Waiting for interaction_connected + greeting…\n", flush=True)
        hb_task = asyncio.create_task(mic_heartbeat(agent, stop_hb))

        t0 = time.monotonic()
        await agent.wait_for_disconnect()
        dt = time.monotonic() - t0
        print(f"\nWebSocket ended after {dt:.1f}s", flush=True)
        print(
            f"Stats: mic_chunks={_stats['chunks_out']} "
            f"sdk_sent={getattr(agent, '_client_audio_chunks_sent', '?')} "
            f"peak_rms={_stats['max_rms']:.0f} "
            f"agent_audio_chunks={_stats['chunks_in']}",
            flush=True,
        )
        if _stats["max_rms"] < 200:
            print(
                "\nMic looks nearly silent (peak_rms < 200).\n"
                "  - Windows Settings > Privacy > Microphone: allow desktop apps\n"
                "  - Try another --device / raise --gain\n",
                flush=True,
            )
        if _stats["chunks_in"] == 0:
            print("No agent audio received — check Speakers / volume.", flush=True)
    except (KeyboardInterrupt, asyncio.CancelledError):
        print("\nEnding call…", flush=True)
    except Exception as exc:
        print(f"\nError: {exc}", file=sys.stderr)
        raise
    finally:
        stop_hb.set()
        if hb_task:
            hb_task.cancel()
            try:
                await hb_task
            except asyncio.CancelledError:
                pass
        try:
            await agent.stop()
        except Exception:
            pass
        print("Disconnected.", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SpeakCoach Sarvam voice smoke test")
    parser.add_argument("--list-devices", action="store_true", help="List mic devices and exit")
    parser.add_argument("--device", type=int, default=None, help="PyAudio input device index")
    parser.add_argument("--gain", type=float, default=4.0, help="Software mic gain (default 4)")
    args = parser.parse_args()
    if args.list_devices:
        list_input_devices()
        sys.exit(0)
    try:
        asyncio.run(main(args.device, args.gain))
    except KeyboardInterrupt:
        print("\nBye.", flush=True)
