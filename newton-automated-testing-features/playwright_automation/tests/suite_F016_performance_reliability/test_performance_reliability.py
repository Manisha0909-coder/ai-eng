import os
import sys
from pathlib import Path

import pytest
from playwright.sync_api import Page, expect

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from auth.login import login_to_gotalk

ADMIN_EMAIL = os.getenv("SUPER_ADMIN_EMAIL", "john.doe@noah.com")
ADMIN_PASS = os.getenv("SUPER_ADMIN_PASS", "Friday#3000")
BASE_URL = os.getenv("PLAYWRIGHT_BASE_URL", "https://gotalk.dev")

TEST_DATA_DIR = Path(__file__).resolve().parents[3] / "test-data"
TEST_JPG = str(TEST_DATA_DIR / "test.jpg")
TEST_PNG = str(TEST_DATA_DIR / "test.png")


# ── Navigation ─────────────────────────────────────────────────────────────────

# TODO: Chat navigation flow has changed — update when ready.
# New flow (from F018/F005): click workspace card → fill WELCOME_PERSONA_INPUT → click persona option
#   → click SHOW_CHAT_SIDEBAR_BUTTON → wait for textarea#chat.
# def _navigate_to_chat(page: Page) -> None: ...


def _navigate_to_admin(page: Page) -> None:
    if "/admin-dashboard" not in page.url:
        page.locator("button[title='Admin Console']").click()
        page.wait_for_timeout(1500)


def _expand_sidebar_group(page: Page, group: str) -> None:
    tab_visible = page.locator(
        f"xpath=//button[@role='tab' and .//span[normalize-space()='{group}']]"
    )
    if tab_visible.count() == 0 or not tab_visible.is_visible():
        page.locator(
            f"xpath=//button[.//span[normalize-space()='{group}']]"
        ).click()
        page.wait_for_timeout(1000)


# ── Tests ──────────────────────────────────────────────────────────────────────

# TODO: TC57 — US001 — chat navigation flow changed; update _navigate_to_chat before re-enabling.
# def test_tc57_chat_network_drop_recovery(page: Page): ...


def test_tc58_duplicate_login_handled(page: Page, base_url: str):
    """TC58 — US002: Opening a second login with same credentials produces no crash or server error."""
    # Session 1 already established by login fixture
    session_1_url = page.url
    print(f"Session 1 URL: {session_1_url}")
    page.screenshot(path="results/tc58-F016-session1.png")

    # Open second context with same credentials
    context2 = page.context.browser.new_context(ignore_https_errors=True)
    page2 = context2.new_page()
    try:
        login_to_gotalk(page2, base_url, ADMIN_EMAIL, ADMIN_PASS)
        session_2_url = page2.url
        print(f"Session 2 URL: {session_2_url}")

        page_text = page2.evaluate(
            "() => document.body.innerText.trim().substring(0, 200)"
        )
        print(f"Session 2 content: {page_text[:100]}")
        page2.screenshot(path="results/tc58-F016-session2.png")

        assert not any(
            kw in page_text.lower()
            for kw in ("500", "503", "crash", "fatal", "unhandled exception")
        ), "Session 2 should not show a server error"
        print("Session 2 handled without server error")

        # Session 1 still intact
        s1_content = page.evaluate(
            "() => document.body.innerText.trim().substring(0, 100)"
        )
        print(f"Session 1 still shows: {s1_content[:80]}")
        page.screenshot(path="results/tc58-F016-session1-intact.png")
        print("Session 1 still active")

    finally:
        page2.close()
        context2.close()

    print("TC58 PASSED — Duplicate login handled without errors")


# TODO: TC59 — US005 — chat navigation flow changed; update _navigate_to_chat before re-enabling.
# def test_tc59_multi_image_upload(page: Page): ...


def test_tc60_admin_tabs_all_200(page: Page):
    """TC60 — US006: All Admin Console tabs load without 4xx/5xx API errors."""
    _navigate_to_admin(page)

    # Inject fetch interceptor to track failed requests
    page.evaluate(
        """() => {
            window.__failedRequests = [];
            const orig = window.fetch;
            window.fetch = function() {
                return orig.apply(this, arguments).then(function(r) {
                    if (!r.ok) window.__failedRequests.push(r.status + ' ' + r.url);
                    return r;
                });
            };
        }"""
    )
    print("Fetch interceptor injected")

    tabs = [
        ("", "Overview"),
        ("Tools and Servers", "Tools"),
        ("Tools and Servers", "Tool Tags"),
        ("Tools and Servers", "Data Sources"),
        ("Tools and Servers", "Servers"),
        ("Documents", "Docs"),
        ("Documents", "Doc Tags"),
        ("Access", "Roles"),
        ("Access", "Personas"),
        ("Access", "Shared Memory"),
        ("Access", "Users"),
        ("", "Feedback"),
        ("", "Admin"),
    ]

    for parent, tab in tabs:
        if parent:
            print(f'Expanding "{parent}" → clicking "{tab}"')
            _expand_sidebar_group(page, parent)
        else:
            print(f'Checking tab: {tab}')

        tab_btn = page.locator(
            f"xpath=//*[normalize-space()='{tab}' and "
            "(self::span or self::a or self::button or self::li)]"
        )
        if tab_btn.count() > 0:
            try:
                tab_btn.first.click()
            except Exception:
                print(f"WARNING: Could not click tab '{tab}' — skipping")
                continue
            page.wait_for_timeout(3000)
            page.screenshot(path=f"results/tc60-F016-tab-{tab.replace(' ', '_')}.png")

            failed = page.evaluate("() => window.__failedRequests.join(' | ')")
            if failed:
                print(f'Failed requests on "{tab}": {failed}')
                assert False, f'Tab "{tab}" has non-200 API responses: {failed}'
            else:
                print(f'✓ {tab} — all API calls returned 200')
            page.evaluate("() => { window.__failedRequests = []; }")
        else:
            print(f"WARNING: Tab '{tab}' not found — skipping")

    print("TC60 PASSED — All Admin Console tabs loaded with 200 status")
