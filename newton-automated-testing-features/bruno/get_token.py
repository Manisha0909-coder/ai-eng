"""
Logs in via Playwright and writes the access_token to bruno/.env.

Usage:
    python bruno/get_token.py
Then:
    cd bruno && bru run --env production --dotenv
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

SITE_URL = "https://gotalk.dev"
ENV_FILE  = os.path.join(os.path.dirname(__file__), ".env")


def _read_env(path: str) -> dict[str, str]:
    result = {}
    if os.path.exists(path):
        with open(path) as f:
            for line in f:
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    result[k.strip()] = v.strip()
    return result


def _write_env(path: str, data: dict[str, str]) -> None:
    with open(path, "w") as f:
        for k, v in data.items():
            f.write(f"{k}={v}\n")


def main():
    email    = os.getenv("GOTALK_EMAIL", "")
    password = os.getenv("GOTALK_PASSWORD", "")

    if not email or not password:
        sys.exit("❌ Set GOTALK_EMAIL and GOTALK_PASSWORD in the root .env file.")

    print(f"🌐 Launching browser → {SITE_URL}")
    print(f"🔑 Logging in as {email}...")

    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "playwright_automation"))
    from auth.login import login_to_gotalk

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = browser.new_context(ignore_https_errors=True)
        page    = context.new_page()
        login_to_gotalk(page, SITE_URL, email, password)
        page.wait_for_load_state("load", timeout=60000)
        cookies = context.cookies()
        browser.close()

    token = next((c["value"] for c in cookies if c["name"] == "access_token"), None)

    if not token:
        sys.exit("❌ access_token cookie not found after login.")

    env = _read_env(ENV_FILE)
    env["access_token"] = token
    _write_env(ENV_FILE, env)

    print(f"✅ access_token saved to bruno/.env")


if __name__ == "__main__":
    main()
