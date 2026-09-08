import time
import json
import re
from urllib.parse import unquote

JWT_PATTERN = re.compile(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+")

from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from regression.config import *
from regression.selenium_utils import (
    _click_with_retries,
    _element_exists,
    _wait_for_noah_stage,
    _advance_intermediate_login_screens,
    _wait_for_access_cookie_or_home,
    _debug_login_page
)

def _extract_token_from_text(raw_value):
    """Extract token from plain text, encoded value, or JSON string."""
    if not raw_value:
        return None

    candidates = [raw_value]
    try:
        candidates.append(unquote(raw_value))
    except Exception:
        pass

    for candidate in candidates:
        if not candidate:
            continue

        jwt_match = JWT_PATTERN.search(candidate)
        if jwt_match:
            return jwt_match.group(0)

        try:
            parsed = json.loads(candidate)
        except Exception:
            continue

        if isinstance(parsed, dict):
            for key in ("access_token", "id_token", "token", "jwt"):
                value = parsed.get(key)
                if isinstance(value, str):
                    nested_match = JWT_PATTERN.search(value)
                    if nested_match:
                        return nested_match.group(0)
    return None


def _collect_token_from_browser_state(driver):
    """Try cookies and storage for an access token."""
    cookie_token = _extract_token_from_text((driver.get_cookie("access_token") or {}).get("value"))
    if cookie_token:
        return cookie_token

    for cookie in driver.get_cookies():
        cookie_name = (cookie.get("name") or "").lower()
        if "token" in cookie_name:
            token = _extract_token_from_text(cookie.get("value"))
            if token:
                return token

    storage_values = driver.execute_script(
        """
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
        for (let i = 0; i < sessionStorage.length; i++) keys.push(sessionStorage.key(i));
        const values = [];
        for (const k of keys) {
          values.push(localStorage.getItem(k));
          values.push(sessionStorage.getItem(k));
        }
        return values.filter(Boolean);
        """
    )

    for value in storage_values:
        token = _extract_token_from_text(value)
        if token:
            return token

    return None




def _build_cookie_header(cookies):
    pairs = []
    for cookie in cookies or []:
        name = cookie.get("name")
        value = cookie.get("value")
        if name and value:
            pairs.append(f"{name}={value}")
    return "; ".join(pairs)



def fetch_access_token_via_browser():
    """Login through redirects and return auth context for API calls."""
    if ACCESS_TOKEN:
        print("ℹ️ Using token from GOTALK_ACCESS_TOKEN environment variable")
        return {"access_token": ACCESS_TOKEN, "cookie_header": f"access_token={ACCESS_TOKEN}"}

    if SESSION_COOKIE_HEADER:
        print("ℹ️ Using cookie header from GOTALK_COOKIE_HEADER environment variable")
        return {"access_token": None, "cookie_header": SESSION_COOKIE_HEADER}

    if not LOGIN_EMAIL or not LOGIN_PASSWORD:
        raise RuntimeError(
            "Missing credentials. Set ADMIN_EMAIL and ADMIN_PASSWORD, "
            "or provide GOTALK_ACCESS_TOKEN."
        )

    options = webdriver.ChromeOptions()
    # Always use incognito to avoid cached auth state altering the login flow.
    options.add_argument("--incognito")
    if HEADLESS_LOGIN:
        options.add_argument("--headless=new")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")

    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 45)

    should_close_browser = True
    try:
        print("🔐 Fetching fresh access token via browser login flow...")
        driver.get(SITE_URL)

        # If an existing session already has a token, use it immediately.
        token = _collect_token_from_browser_state(driver)
        if token:
            return {"access_token": token, "cookie_header": f"access_token={token}"}

        # Match Robot flow: initial login button first.
        _click_with_retries(driver, [INITIAL_LOGIN_BTN_XPATH], timeout_seconds=40, label="initial login")

        # Step 2: wait for Noah stage (optionally passing through Continue page),
        # then click Noah exactly once.
        reached_noah_stage = _wait_for_noah_stage(driver, timeout_seconds=70)
        if not reached_noah_stage:
            raise TimeoutException("Noah stage did not appear after initial login.")

        print("➡️ Waiting for Noah provider and clicking it...")
        clicked_noah = _click_with_retries(
            driver,
            [NOAH_SIGNIN_XPATH, NOAH_SIGNIN_ALT_XPATH],
            timeout_seconds=70,
            label="noah",
        )
        if not clicked_noah:
            raise TimeoutException("Noah button did not become clickable in time.")

        # Step 3: only proceed once the real credentials form is ready.
        post_noah_state = _advance_intermediate_login_screens(driver, timeout_seconds=90)
        if post_noah_state == "credentials":
            wait.until(EC.visibility_of_element_located((By.XPATH, EMAIL_INPUT_XPATH))).send_keys(LOGIN_EMAIL)
            password_input = wait.until(EC.visibility_of_element_located((By.XPATH, PASSWORD_INPUT_XPATH)))
            password_input.send_keys(LOGIN_PASSWORD)

            # Enter key is a fallback if button click is intercepted during redirects.
            password_input.send_keys(Keys.ENTER)
            try:
                wait.until(EC.element_to_be_clickable((By.XPATH, LOGIN_BTN_XPATH))).click()
            except Exception:
                pass
        elif post_noah_state == "authenticated":
            print("✅ Already authenticated after Noah/redirect flow; skipping credential entry.")
        else:
            raise TimeoutException("Neither credential form nor authenticated home reached after Noah selection.")

        if not _wait_for_access_cookie_or_home(driver, timeout_seconds=75):
            raise TimeoutException("Login completed neither home state nor access token cookie.")
        time.sleep(1.5)

        cookies = driver.get_cookies()
        print(f"🍪 Cookie names after login: {[cookie.get('name') for cookie in cookies]}")
        cookie_header = _build_cookie_header(cookies)
        token = _collect_token_from_browser_state(driver)
        if token:
            return {"access_token": token, "cookie_header": cookie_header or f"access_token={token}"}

        if cookie_header:
            print("ℹ️ JWT token not visible; using authenticated browser cookies for API calls")
            print(f"🍪 Cookie names: {[cookie.get('name') for cookie in cookies]}")
            return {"access_token": None, "cookie_header": cookie_header}

        raise RuntimeError("Token/cookies not found in browser state after login.")
    except TimeoutException as exc:
        _debug_login_page(driver)
        if not HEADLESS_LOGIN and KEEP_BROWSER_OPEN_ON_FAILURE:
            should_close_browser = False
            print("🧪 Browser kept open for inspection (set GOTALK_KEEP_BROWSER_ON_FAILURE=false to auto-close).")
        raise RuntimeError("Timed out while completing login flow/token extraction.") from exc
    finally:
        if should_close_browser:
            driver.quit()

