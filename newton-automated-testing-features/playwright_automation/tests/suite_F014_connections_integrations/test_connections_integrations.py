"""
suite_F014 – Connections & Integrations

Covers:
  US001 – Noah ERP: connect and authenticate
  US005 – Outlook/Microsoft OAuth: connect account
  US006 – Outlook/Microsoft OAuth: disconnect account

Navigation: Settings button → integrations panel.

Card div text (changes with connection state):
  Microsoft connected    → "MicrosoftConnectedDisconnect"
  Microsoft not connected→ "MicrosoftNot connectedConnect"
  Noah connected         → "NNoahConnected<email>Disconnect"
  Noah not connected     → "NNoahNot connectedConnect"

Connect/Disconnect are the same button names in both cards; every button
click is scoped to the relevant card div to avoid hitting the wrong one.

Tests are state-aware: if the required connection state is not present,
the test toggles it first, runs assertions, then restores original state.

Microsoft OAuth tests (US005, US006) use a saved storage-state file
  ms_storage_state.json  (next to this file, git-ignored)
so Microsoft 2FA only needs approval once. On first run the file does not
exist; after a successful OAuth the browser state (including Microsoft
session cookies) is saved there for all future runs.

First-time setup:
  pytest playwright_automation/tests/suite_F014_connections_integrations/ --headed
Subsequent runs restore the Microsoft session automatically.
"""

import contextlib
import io
import json
import re
import sys
from pathlib import Path

import pytest
from playwright.sync_api import Page, expect

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from auth.login import login_to_gotalk

# Saved browser/cookie state — git-ignored, created on first successful OAuth run.
_MS_STORAGE_STATE = Path(__file__).resolve().parent / "ms_storage_state.json"


# =====================================================================
# Card helpers
# =====================================================================


def _navigate_to_connections(page: Page) -> None:
    # The dialog stays open across some interactions (e.g. the OAuth redirect
    # round-trip). Only click Account if it's not already open. Confirmed via
    # DOM inspection: the dialog is role="dialog" aria-label="User Panel" — the
    # old "Connected Accounts" heading check never matched any real element
    # (the visible heading text is actually "Settings"), so it always re-clicked
    # Account even when the panel was already open, which fails once the click
    # gets blocked by the already-open dialog's own backdrop.
    if not page.get_by_role("dialog", name="User Panel").is_visible():
        page.get_by_role("button", name="Account").click()
    page.wait_for_timeout(1500)


def _get_ms_card(page: Page):
    """Microsoft card row — identified by the text 'Microsoft' in the row.

    Row container class is `flex items-center gap-3 px-4 py-3 bg-surface`
    (confirmed via DOM inspection) — not `flex items-center justify-between`,
    and the icon is not an <img> on this build, so match on row text instead.
    """
    return page.locator("div.flex.items-center.gap-3").filter(
        has=page.get_by_text("Microsoft", exact=True)
    ).first


def _get_noah_card(page: Page):
    """Noah card row — identified by the text 'Noah' in the row."""
    return page.locator("div.flex.items-center.gap-3").filter(
        has=page.get_by_text("Noah", exact=True)
    ).first


# =====================================================================
# State-toggle helpers
# =====================================================================


def _noah_is_connected(page: Page) -> bool:
    text = _get_noah_card(page).inner_text().lower()
    return "connected" in text and "not connected" not in text


def _ms_is_connected(page: Page) -> bool:
    text = _get_ms_card(page).inner_text().lower()
    return "connected" in text and "not connected" not in text


def _disconnect_noah(page: Page) -> None:
    """Disconnect Noah if currently connected."""
    if not _noah_is_connected(page):
        return
    card = _get_noah_card(page)
    card.get_by_role("button", name="Disconnect").first.click()
    page.wait_for_timeout(2000)
    print("[setup] Noah disconnected")


def _connect_noah(page: Page, email: str, password: str) -> None:
    """Connect Noah if currently disconnected — fills the Noah login form."""
    if _noah_is_connected(page):
        return
    card = _get_noah_card(page)
    card.get_by_role("button", name="Connect").click()
    page.wait_for_timeout(1500)
    page.get_by_role("textbox", name="Username").fill(email)
    page.get_by_role("textbox", name="Password").fill(password)
    page.get_by_role("button", name="Sign In").click()
    page.wait_for_timeout(3000)
    print("[setup] Noah connected")


def _disconnect_ms(page: Page) -> None:
    """Disconnect Microsoft if currently connected."""
    if not _ms_is_connected(page):
        return
    card = _get_ms_card(page)
    card.get_by_role("button", name="Disconnect").first.click()
    page.wait_for_timeout(2000)
    print("[setup] Microsoft disconnected")


def _connect_ms(page: Page) -> None:
    """Connect Microsoft if currently disconnected.

    Clicks Connect, then waits up to 2 minutes for the Settings button to
    reappear — the Settings button disappears during the OAuth redirect and
    only comes back once you are returned to GoTalk after completing login + 2FA.
    """
    if _ms_is_connected(page):
        return
    card = _get_ms_card(page)
    card.get_by_role("button", name="Connect").first.click()
    print("[setup] Microsoft OAuth started — complete your login + 2FA in the browser...")
    # Account button reappears only when OAuth is done and we're back on GoTalk
    page.get_by_role("button", name="Account").wait_for(timeout=120000)
    page.wait_for_timeout(1000)
    print("[setup] Microsoft connected")


# =====================================================================
# Fixtures
# =====================================================================


@pytest.fixture
def ms_page(page: Page, base_url: str, admin_email: str, admin_password: str):
    """Page for Microsoft OAuth tests.

    Restores saved browser state (including Microsoft session cookies) from
    ms_storage_state.json before logging in, so 2FA is only required on the
    very first run. After each test the state is saved back to the file so
    subsequent runs are authenticated automatically.
    """
    if _MS_STORAGE_STATE.exists():
        try:
            with open(_MS_STORAGE_STATE) as f:
                state = json.load(f)
            if "cookies" in state:
                page.context.add_cookies(state["cookies"])
        except Exception:
            pass

    page.goto(base_url, timeout=60000, wait_until="commit")
    page.wait_for_load_state("networkidle")

    # Restored cookies may have kept the GoTalk session alive; only login if needed.
    if page.get_by_role("button", name="Login").is_visible():
        with contextlib.redirect_stdout(io.StringIO()):
            login_to_gotalk(page, base_url, admin_email, admin_password)
        page.wait_for_load_state("networkidle")
    yield page
    # Save Microsoft session cookies so subsequent runs skip 2FA
    try:
        page.context.storage_state(path=str(_MS_STORAGE_STATE))
    except Exception:
        pass


# =====================================================================
# US001 – Noah ERP – connect and authenticate
# =====================================================================


def test_us001_noah_erp_card_visible(page: Page):
    """US001 – Settings page shows a Noah ERP integration card."""
    print("\n[US001] Checking Noah ERP card is visible")
    _navigate_to_connections(page)
    page.screenshot(path="results/conn-us001-01-page.png")

    noah_card = _get_noah_card(page)
    expect(noah_card).to_be_visible(timeout=8000)
    print("[US001] PASS – Noah ERP card visible")


def test_us001_noah_erp_connection_status_shown(page: Page):
    """US001 – Noah ERP card always shows a connection status label."""
    print("\n[US001] Checking Noah ERP connection status label")
    _navigate_to_connections(page)

    noah_card = _get_noah_card(page)
    expect(noah_card).to_be_visible(timeout=8000)
    card_text = noah_card.inner_text().lower()

    has_status = any(kw in card_text for kw in ("connected", "not connected"))
    print(f"[US001] Noah card text: '{card_text[:100]}' | Status label: {has_status}")
    assert has_status, "Expected 'Connected' or 'Not connected' label in Noah card"

    page.screenshot(path="results/conn-us001-02-status.png")
    print("[US001] PASS – Noah ERP connection status label present")


def test_us001_noah_erp_connect_button_visible_when_not_connected(
    page: Page, admin_email: str, admin_password: str
):
    """US001 – Noah card shows a Connect button when not connected.
    If Noah is currently connected, disconnect it first, verify, then reconnect.
    """
    print("\n[US001] Checking Noah ERP Connect button (not-connected state)")
    _navigate_to_connections(page)

    was_connected = _noah_is_connected(page)
    if was_connected:
        print("[US001] Noah is connected — disconnecting to reach required state")
        _disconnect_noah(page)

    connect_btn = _get_noah_card(page).get_by_role("button", name="Connect")
    page.screenshot(path="results/conn-us001-03-connect-btn.png")
    expect(connect_btn).to_be_visible(timeout=5000)
    print("[US001] PASS – Noah ERP Connect button present in not-connected state")

    # Restore original state
    if was_connected:
        print("[US001] Restoring: reconnecting Noah")
        _connect_noah(page, admin_email, admin_password)


def test_us001_noah_erp_disconnect_button_visible_when_connected(
    page: Page, admin_email: str, admin_password: str
):
    """US001 – Noah card shows a Disconnect button when connected.
    If Noah is not connected, connect it first, verify, then disconnect.
    """
    print("\n[US001] Checking Noah ERP Disconnect button (connected state)")
    _navigate_to_connections(page)

    was_connected = _noah_is_connected(page)
    if not was_connected:
        print("[US001] Noah not connected — connecting to reach required state")
        _connect_noah(page, admin_email, admin_password)

    noah_card = _get_noah_card(page)
    disconnect_btn = noah_card.get_by_role("button", name="Disconnect")
    page.screenshot(path="results/conn-us001-04-disconnect-btn.png")
    expect(disconnect_btn.first).to_be_visible(timeout=5000)
    print("[US001] PASS – Noah ERP Disconnect button present in connected state")

    # Restore original state
    if not was_connected:
        print("[US001] Restoring: disconnecting Noah")
        _disconnect_noah(page)


def test_us001_noah_erp_email_shown_when_connected(
    page: Page, admin_email: str, admin_password: str
):
    """US001 – Noah card shows the authenticated account email when connected.
    If Noah is not connected, connect it first, verify email, then disconnect.
    """
    print("\n[US001] Checking Noah ERP email display when connected")
    _navigate_to_connections(page)

    was_connected = _noah_is_connected(page)
    if not was_connected:
        print("[US001] Noah not connected — connecting to reach required state")
        _connect_noah(page, admin_email, admin_password)

    noah_card = _get_noah_card(page)
    card_text = noah_card.inner_text().lower()
    has_email = "@" in card_text
    print(f"[US001] Email in Noah card: {has_email} | text: '{card_text[:100]}'")
    assert has_email, "Expected an email address in the Noah card when connected"

    page.screenshot(path="results/conn-us001-05-email.png")
    print("[US001] PASS – Authenticated email displayed in Noah card")

    # Restore original state
    if not was_connected:
        print("[US001] Restoring: disconnecting Noah")
        _disconnect_noah(page)


# =====================================================================
# US005 – Outlook / Microsoft OAuth – connect account
# =====================================================================


def test_us005_microsoft_card_visible(ms_page: Page):
    """US005 – Settings page shows a Microsoft integration card."""
    print("\n[US005] Checking Microsoft card is visible")
    _navigate_to_connections(ms_page)
    ms_page.screenshot(path="results/conn-us005-01-page.png")

    ms_card = _get_ms_card(ms_page)
    expect(ms_card).to_be_visible(timeout=8000)
    print("[US005] PASS – Microsoft card visible")


def test_us005_microsoft_connection_status_shown(ms_page: Page):
    """US005 – Microsoft card always shows a connection status label."""
    print("\n[US005] Checking Microsoft connection status label")
    _navigate_to_connections(ms_page)

    ms_card = _get_ms_card(ms_page)
    expect(ms_card).to_be_visible(timeout=8000)
    card_text = ms_card.inner_text().lower()

    has_status = any(kw in card_text for kw in ("connected", "not connected"))
    print(f"[US005] Microsoft card text: '{card_text[:100]}' | Status: {has_status}")
    assert has_status, "Expected 'Connected' or 'Not connected' label in Microsoft card"

    ms_page.screenshot(path="results/conn-us005-02-status.png")
    print("[US005] PASS – Microsoft connection status label present")


def test_us005_microsoft_connect_initiates_oauth(ms_page: Page):
    """US005 – Clicking Connect on the Microsoft card initiates the OAuth redirect.
    If Microsoft is currently connected, disconnect it first, test OAuth, then reconnect.
    """
    print("\n[US005] Testing Microsoft OAuth initiation")
    _navigate_to_connections(ms_page)
    ms_page.wait_for_timeout(500)

    was_connected = _ms_is_connected(ms_page)
    if was_connected:
        print("[US005] Microsoft is connected — disconnecting to reach not-connected state")
        _disconnect_ms(ms_page)
        _navigate_to_connections(ms_page)

    ms_card = _get_ms_card(ms_page)
    connect_btn = ms_card.get_by_role("button", name="Connect")
    expect(connect_btn.first).to_be_visible(timeout=5000)
    ms_page.screenshot(path="results/conn-us005-03-before-connect.png")

    connect_btn.first.click()
    print("[US005] Microsoft OAuth started — complete your login + 2FA in the browser...")
    # Account button disappears during the OAuth redirect and only reappears
    # once the browser is back on GoTalk after a successful login.
    ms_page.get_by_role("button", name="Account").wait_for(timeout=120000)
    ms_page.wait_for_timeout(1000)
    ms_page.screenshot(path="results/conn-us005-03-oauth-done.png")
    print(f"[US005] Back on GoTalk after OAuth — URL: {ms_page.url}")

    # Verify Microsoft is now connected
    _navigate_to_connections(ms_page)
    ms_card = _get_ms_card(ms_page)
    card_text = ms_card.inner_text().lower()
    assert "connected" in card_text and "not connected" not in card_text, (
        "Expected Microsoft to be connected after completing OAuth"
    )
    print("[US005] PASS – Microsoft OAuth flow completed and account connected")

    # Restore original state
    # was_connected=True → we disconnected then OAuth'd back: already restored.
    # was_connected=False → we OAuth'd and connected: disconnect to restore.
    if not was_connected:
        print("[US005] Restoring: disconnecting Microsoft (was not connected before test)")
        _disconnect_ms(ms_page)


def test_us005_microsoft_connected_state(ms_page: Page):
    """US005 – Microsoft card shows 'Connected' and a Disconnect button when connected.
    If Microsoft is not connected, connect it first, verify, then disconnect.
    """
    print("\n[US005] Checking Microsoft connected state")
    _navigate_to_connections(ms_page)

    was_connected = _ms_is_connected(ms_page)
    if not was_connected:
        print("[US005] Microsoft not connected — connecting to reach required state")
        _connect_ms(ms_page)
        _navigate_to_connections(ms_page)

    ms_card = _get_ms_card(ms_page)
    card_text = ms_card.inner_text().lower()
    assert "connected" in card_text and "not connected" not in card_text, (
        "Expected 'Connected' in Microsoft card"
    )
    assert ms_card.get_by_role("button", name="Disconnect").count() > 0, (
        "Expected Disconnect button in Microsoft card when connected"
    )
    ms_page.screenshot(path="results/conn-us005-04-connected.png")
    print("[US005] PASS – Microsoft card shows Connected state with Disconnect button")

    # Restore original state
    if not was_connected:
        print("[US005] Restoring: disconnecting Microsoft")
        _disconnect_ms(ms_page)


# =====================================================================
# US006 – Outlook / Microsoft OAuth – disconnect account
# =====================================================================


def test_us006_microsoft_disconnect_button_present(ms_page: Page):
    """US006 – Microsoft card shows a Disconnect button when connected.
    If Microsoft is not connected, connect it first, verify, then disconnect.
    """
    print("\n[US006] Checking Microsoft Disconnect button")
    _navigate_to_connections(ms_page)
    ms_page.wait_for_timeout(500)

    was_connected = _ms_is_connected(ms_page)
    if not was_connected:
        print("[US006] Microsoft not connected — connecting to reach required state")
        _connect_ms(ms_page)
        _navigate_to_connections(ms_page)

    ms_card = _get_ms_card(ms_page)
    disconnect_btn = ms_card.get_by_role("button", name="Disconnect")
    ms_page.screenshot(path="results/conn-us006-01-disconnect-btn.png")
    expect(disconnect_btn.first).to_be_visible(timeout=5000)
    print("[US006] PASS – Microsoft Disconnect button present")

    # Restore original state
    if not was_connected:
        print("[US006] Restoring: disconnecting Microsoft")
        _disconnect_ms(ms_page)


def test_us006_microsoft_disconnect_updates_status(ms_page: Page):
    """US006 – Clicking Disconnect on the Microsoft card revokes access and updates status.

    Exact flow from the Playwright recording:
      page.get_by_text("MicrosoftConnectedDisconnect").click()
      page.get_by_role("button", name="Disconnect").first.click()

    If Microsoft is not connected, it is connected first. The account is
    reconnected at the end to restore state.
    """
    print("\n[US006] Testing Microsoft disconnect flow")
    _navigate_to_connections(ms_page)
    ms_page.wait_for_timeout(500)

    if not _ms_is_connected(ms_page):
        print("[US006] Microsoft not connected — connecting first")
        _connect_ms(ms_page)
        _navigate_to_connections(ms_page)

    # Exact recorded flow — click the connected card row, then Disconnect
    ms_page.get_by_text(
        re.compile(r"Microsoft.*Connected.*Disconnect", re.IGNORECASE | re.DOTALL)
    ).first.click()
    ms_page.wait_for_timeout(800)

    ms_card = _get_ms_card(ms_page)
    ms_page.screenshot(path="results/conn-us006-02-before-disconnect.png")
    ms_card.get_by_role("button", name="Disconnect").first.click()
    ms_page.wait_for_timeout(2000)
    ms_page.screenshot(path="results/conn-us006-03-after-disconnect.png")

    card_text_after = ms_card.inner_text().lower()
    still_connected = "connected" in card_text_after and "not connected" not in card_text_after
    assert not still_connected, "Expected Microsoft card status to change after Disconnect"
    print("[US006] PASS – Microsoft disconnected; card status updated")

    # Always reconnect to restore account state
    print("[US006] Restoring: reconnecting Microsoft")
    _connect_ms(ms_page)
    ms_page.screenshot(path="results/conn-us006-04-reconnected.png")


def test_us006_microsoft_status_updates_immediately_after_disconnect(ms_page: Page):
    """US006 – Status changes immediately on the same page load after disconnect.
    If Microsoft is not connected, connect it first then run the full verify cycle.
    """
    print("\n[US006] Verifying immediate status update after disconnect")
    _navigate_to_connections(ms_page)
    ms_page.wait_for_timeout(500)

    if not _ms_is_connected(ms_page):
        print("[US006] Microsoft not connected — connecting first")
        _connect_ms(ms_page)
        _navigate_to_connections(ms_page)

    ms_card = _get_ms_card(ms_page)
    card_text_before = ms_card.inner_text().lower()
    assert "connected" in card_text_before and "not connected" not in card_text_before, (
        "Pre-condition: Microsoft should be connected before testing status update"
    )

    # Disconnect
    ms_card.get_by_role("button", name="Disconnect").first.click()
    ms_page.wait_for_timeout(2000)
    ms_page.screenshot(path="results/conn-us006-05-status-updated.png")

    card_text_after = ms_card.inner_text().lower()
    print(f"[US006] Before: '{card_text_before[:80]}' → After: '{card_text_after[:80]}'")
    assert card_text_before != card_text_after, "Expected card text to change after disconnect"
    assert "not connected" in card_text_after or "connect" in card_text_after, (
        "Expected 'Not connected' or Connect button after disconnect"
    )
    print("[US006] PASS – Status updated immediately after disconnect")

    # Restore
    print("[US006] Restoring: reconnecting Microsoft")
    _connect_ms(ms_page)
    ms_page.screenshot(path="results/conn-us006-06-reconnected.png")
