"""Auth probe for Voice Agents signed URL (X-API-Key)."""
from __future__ import annotations

import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

key = os.environ["SARVAM_API_KEY"]
org = os.environ["SARVAM_ORG_ID"]
ws = os.environ["SARVAM_WORKSPACE_ID"]
app = os.environ["SARVAM_APP_ID"]

print("key_prefix:", key[:12], "len:", len(key))

url = (
    f"https://apps.sarvam.ai/api/app-runtime/orgs/{org}/workspaces/{ws}/apps/{app}"
    f"/url?interaction_type=call"
)
rr = httpx.get(url, headers={"X-API-Key": key}, timeout=20)
print("voice_signed_url:", rr.status_code)
print(rr.text[:400])
if rr.status_code == 401:
    print(
        "\n401 = this key is not accepted by Voice Agents runtime.\n"
        "Error detail usually: Invalid API key format.\n"
        "Fix: Indus -> Voice Agents -> Deploy with code -> API keys\n"
        "     -> Generate API key -> paste into SARVAM_API_KEY in .env"
    )
