"""
Mic preflight — confirm Windows hears you BEFORE any Sarvam call.

Usage:
  python scripts/mic-check.py
  python scripts/mic-check.py --list-devices
  python scripts/mic-check.py --device 10
  python scripts/mic-check.py --device 10 --seconds 8 --gain 4

Speak into the mic. Watch the bar and RMS.
  peak_rms < 200   = almost silent (wrong device / muted / privacy)
  peak_rms 500-2k  = quiet but maybe usable
  peak_rms > 2000  = good for Sarvam VAD
"""

from __future__ import annotations

import argparse
import struct
import sys
import time


def pcm16_rms(audio: bytes) -> float:
    if len(audio) < 2:
        return 0.0
    n = len(audio) // 2
    samples = struct.unpack(f"<{n}h", audio[: n * 2])
    if not samples:
        return 0.0
    return (sum(s * s for s in samples) / len(samples)) ** 0.5


def pcm16_gain(audio: bytes, gain: float) -> bytes:
    if gain == 1.0 or len(audio) < 2:
        return audio
    n = len(audio) // 2
    samples = struct.unpack(f"<{n}h", audio[: n * 2])
    out = []
    for s in samples:
        v = int(s * gain)
        if v > 32767:
            v = 32767
        elif v < -32768:
            v = -32768
        out.append(v)
    return struct.pack(f"<{n}h", *out)


def list_devices() -> None:
    import pyaudio

    p = pyaudio.PyAudio()
    try:
        d = p.get_default_input_device_info()
        print(f"Default input: [{d['index']}] {d['name']}\n")
    except Exception as exc:
        print(f"Default input unavailable: {exc}\n")
    for i in range(p.get_device_count()):
        info = p.get_device_info_by_index(i)
        if int(info.get("maxInputChannels") or 0) > 0:
            print(
                f"  [{i}] {info.get('name')}  "
                f"ch={info.get('maxInputChannels')}  "
                f"rate={info.get('defaultSampleRate')}"
            )
    p.terminate()


def bar(rms: float, width: int = 40) -> str:
    # Map ~0-8000 RMS onto bar
    filled = int(min(width, (rms / 8000.0) * width))
    return "#" * filled + "-" * (width - filled)


def main() -> int:
    parser = argparse.ArgumentParser(description="Confirm mic receives your voice")
    parser.add_argument("--list-devices", action="store_true")
    parser.add_argument("--device", type=int, default=None, help="PyAudio input device index")
    parser.add_argument("--seconds", type=float, default=6.0, help="Listen duration")
    parser.add_argument("--gain", type=float, default=1.0, help="Software gain (try 4 or 8)")
    parser.add_argument("--rate", type=int, default=16000, help="Sample rate (Sarvam uses 16000)")
    args = parser.parse_args()

    if args.list_devices:
        list_devices()
        return 0

    import pyaudio

    p = pyaudio.PyAudio()
    device_index = args.device
    if device_index is None:
        try:
            device_index = int(p.get_default_input_device_info()["index"])
        except Exception:
            print("No default input device found.", file=sys.stderr)
            p.terminate()
            return 1

    info = p.get_device_info_by_index(device_index)
    print(f"Device [{device_index}] {info.get('name')}")
    print(f"Rate={args.rate}  gain={args.gain}x  listen={args.seconds}s")
    print("Speak now (e.g. count 1-2-3 / tell me about yourself)…\n")

    frames_per_buffer = int(args.rate * 0.05)  # 50ms
    stream = p.open(
        format=pyaudio.paInt16,
        channels=1,
        rate=args.rate,
        input=True,
        input_device_index=device_index,
        frames_per_buffer=frames_per_buffer,
    )

    peak = 0.0
    samples_over_500 = 0
    samples_over_2000 = 0
    ticks = 0
    t_end = time.time() + args.seconds

    try:
        while time.time() < t_end:
            data = stream.read(frames_per_buffer, exception_on_overflow=False)
            data = pcm16_gain(data, args.gain)
            rms = pcm16_rms(data)
            peak = max(peak, rms)
            ticks += 1
            if rms > 500:
                samples_over_500 += 1
            if rms > 2000:
                samples_over_2000 += 1
            remaining = max(0.0, t_end - time.time())
            print(
                f"\r[{bar(rms)}] rms={rms:6.0f}  peak={peak:6.0f}  {remaining:4.1f}s ",
                end="",
                flush=True,
            )
    finally:
        stream.stop_stream()
        stream.close()
        p.terminate()

    print("\n")
    print(f"peak_rms={peak:.0f}  frames>{500}={samples_over_500}/{ticks}  frames>{2000}={samples_over_2000}/{ticks}")

    if peak < 200:
        print("FAIL: almost no signal. Fix mic privacy / pick another --device / unmute.")
        print("  python scripts/mic-check.py --list-devices")
        return 2
    if peak < 1500 and samples_over_500 < max(3, ticks // 10):
        print("WEAK: some signal, but probably too quiet for Sarvam VAD.")
        print("  Retry louder, or: python scripts/mic-check.py --device", device_index, "--gain 6")
        return 3

    print("OK: mic is receiving your voice.")
    print(
        f"Next: python scripts/talk-to-agent.py --device {device_index}"
        + (f" --gain {args.gain}" if args.gain != 1.0 else "")
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
