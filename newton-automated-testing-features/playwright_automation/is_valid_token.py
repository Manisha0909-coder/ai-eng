from multiprocessing import process
import os

from playwright.sync_api import sync_playwright
import requests
import jwt
from datetime import datetime, timezone
import time

from playwright_automation.auth.login import login_to_gotalk, extract_gotalk_cookies

BASE_URL = "https://gotalk.dev"
API_URL = "https://gotalk.dev/api/mid/profile/me"

EMAIL = os.getenv("ADMIN_EMAIL")
PASSWORD = os.getenv("ADMIN_PASSWORD")


def decode_token(token):
    return jwt.decode(
        token,
        options={"verify_signature": False},
        algorithms=["RS256"]
    )


def wait_until_expiry(exp):
    now = datetime.now(timezone.utc).timestamp()
    wait_time = exp - now 
    wait_time +=10  # Add buffer to ensure token is expired

    if wait_time > 0:
        print(f"⏳ Waiting {int(wait_time)} sec...")
        time.sleep(wait_time + 2)
    else:
        print("⚠️ Already expired")


def run_test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()

        # 🔐 LOGIN
        cookies = login_to_gotalk(page, BASE_URL, EMAIL, PASSWORD)

        # 🔄 Convert cookies
        cookie_dict = extract_gotalk_cookies(cookies)

        access_token = cookie_dict.get("access_token")

        print("\n🍪 Extracted cookies:")
        for k in cookie_dict:
            print(k)

        if not access_token:
            raise Exception("❌ access_token not found")

        # 🧠 Decode
        decoded = decode_token(access_token)
        exp = decoded["exp"]

        print(f"\n🕒 Expiry: {datetime.fromtimestamp(exp)}")

        # 🌐 Create requests session
        session = requests.Session()

        for k, v in cookie_dict.items():
            session.cookies.set(k, v, domain=".gotalk.dev", path="/")

        # ✅ BEFORE expiry
        print("\n✅ BEFORE expiry")
        res = session.get(API_URL)
        print("Status:", res.status_code)

        old_token = session.cookies.get("access_token")

        # ⏳ WAIT
        wait_until_expiry(exp)

        # 🚫 AFTER expiry
        print("\n🚫 AFTER expiry")
        res = session.get(API_URL)
        print("Status:", res.status_code)

        new_token = session.cookies.get("access_token")

        # 🔍 VALIDATION
        print("\n🔍 VALIDATION")

        if new_token != old_token:
            print("✅ Token refreshed")
        else:
            print("⚠️ No refresh")

        # 🧪 OLD TOKEN TEST
        print("\n🧪 Testing old token without session")

        if not old_token:
            print("❌ Old token not found, skipping test")
        else:
            test_session = requests.Session()

            test_session.cookies.set(
                name="access_token",
                value=old_token,
                domain=".gotalk.dev",
                path="/"
            )

            res = test_session.get(API_URL)
            print("Old token status:", res.status_code)

        browser.close()


if __name__ == "__main__":
    run_test()