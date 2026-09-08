#!/usr/bin/env python3
"""
Run a Bruno .bru file with an automatically fetched access token.
Token is validated before use — if expired, it re-logs in automatically.

Usage:
    python run_bruno.py                            # run all
    python run_bruno.py auth                       # run a folder
    python run_bruno.py "auth/Health Check.bru"   # run a single file
"""

import subprocess
import sys
import os
import base64
import json
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dotenv import load_dotenv
load_dotenv()

BRUNO_DIR = Path(__file__).resolve().parent / "bruno"
TOKEN_EXPIRY_BUFFER = 60  # treat token as expired if it expires within 60 seconds

# Playwright venv location (relative to this file)
_PW_VENV = Path(__file__).resolve().parent / "playwright_automation" / ".venv"
_PW_PYTHON = _PW_VENV / "bin" / "python3"


def _is_token_valid(token: str) -> bool:
    try:
        payload_b64 = token.split(".")[1]
        payload_b64 += "=" * (4 - len(payload_b64) % 4)
        payload = json.loads(base64.b64decode(payload_b64))
        exp = payload.get("exp", 0)
        remaining = exp - datetime.now(timezone.utc).timestamp()
        if remaining > TOKEN_EXPIRY_BUFFER:
            print(f"Existing token valid — expires in {int(remaining)}s")
            return True
        print(f"Token expired or expiring soon ({int(remaining)}s remaining) — refreshing...")
        return False
    except Exception:
        return False


def _fetch_token_via_playwright() -> str:
    """Login with Playwright and return the access_token cookie value."""
    script = """
import os, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv
sys.path.insert(0, str(Path({pw_dir!r})))
load_dotenv(dotenv_path=Path({env_path!r}))
from auth.login import login_to_gotalk

email    = os.getenv("ADMIN_EMAIL")
password = os.getenv("ADMIN_PASSWORD")
base_url = os.getenv("PLAYWRIGHT_BASE_URL", "https://gotalk.dev")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(ignore_https_errors=True)
    page = ctx.new_page()
    login_to_gotalk(page, base_url, email, password)
    try:
        page.wait_for_load_state("networkidle", timeout=10000)
    except Exception:
        pass
    token = next((c["value"] for c in ctx.cookies() if c["name"] == "access_token"), "")
    print(token, end="")
    browser.close()
""".format(
        pw_dir=str(Path(__file__).resolve().parent / "playwright_automation"),
        env_path=str(Path(__file__).resolve().parent / "playwright_automation" / ".env"),
    )

    result = subprocess.run(
        [str(_PW_PYTHON), "-c", script],
        capture_output=True, text=True, timeout=120
    )
    if result.returncode != 0:
        print(f"Playwright login error: {result.stderr[:200]}", file=sys.stderr)
        return ""
    return result.stdout.strip()


def _get_token() -> str:
    existing = os.getenv("GOTALK_ACCESS_TOKEN", "").strip()
    if existing and _is_token_valid(existing):
        return existing
    print("Fetching fresh access token via Playwright login...")
    token = _fetch_token_via_playwright()
    if not token:
        print("WARNING: could not obtain access token", file=sys.stderr)
    return token


def main():
    args = list(sys.argv[1:])

    # No args → run all
    if not args or args[0] in ("all", "."):
        bru_file = None
        extra_args = [a for a in args[1:] if a not in ("all", ".")]
    else:
        bru_file = args[0]
        extra_args = args[1:]

    # Always use production env
    if "--env" in extra_args:
        idx = extra_args.index("--env")
        extra_args.pop(idx)
        extra_args.pop(idx)
    extra_args = ["--env", "production"] + extra_args

    token = _get_token()
    if not token:
        print("No JWT token found — running without access_token env-var")

    cmd = ["bru", "run"] + ([bru_file] if bru_file else []) + ["-r"] + extra_args
    if token:
        cmd += ["--env-var", f"access_token={token}"]

    print(f"Running: bru run {bru_file or '(all)'} --env production --env-var access_token=<redacted>")
    result = subprocess.run(cmd, cwd=str(BRUNO_DIR))
    sys.exit(result.returncode)


if __name__ == "__main__":
    main()