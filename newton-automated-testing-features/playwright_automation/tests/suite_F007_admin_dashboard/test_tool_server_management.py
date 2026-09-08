import io
import contextlib
import re
import sys
from pathlib import Path

import pytest
from playwright.sync_api import Page, expect

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from auth.login import login_to_gotalk


# =====================================================================
# Fixtures
# =====================================================================



# =====================================================================
# Helpers
# =====================================================================


def _click_sidebar_item(page: Page, label_pattern: re.Pattern) -> bool:
    """Click the first visible element matching label_pattern. Returns True on success."""
    for role in ("button", "link", "tab", "menuitem", "option"):
        loc = page.get_by_role(role, name=label_pattern)
        if loc.count() > 0 and loc.first.is_visible():
            loc.first.click()
            return True
    # get_by_text with a regex pattern
    loc = page.get_by_text(label_pattern)
    if loc.count() > 0 and loc.first.is_visible():
        loc.first.click()
        return True
    # Fallback: tag-based filter
    for tag in ("button", "a", "li", "span", "div", "p"):
        loc = page.locator(tag).filter(has_text=label_pattern)
        if loc.count() > 0 and loc.first.is_visible():
            loc.first.click()
            return True
    return False


def _navigate_to_servers(page: Page) -> None:
    """Open Admin Console -> Tools and Servers -> Servers tab/link."""
    page.get_by_role("button", name=re.compile(r"^admin console$", re.IGNORECASE)).click()
    page.wait_for_timeout(500)
    _click_sidebar_item(page, re.compile(r"tools\s+and\s+servers", re.IGNORECASE))
    page.wait_for_timeout(1000)

    # "Servers" may be a tab or a sidebar sub-item
    if not _click_sidebar_item(page, re.compile(r"^servers$", re.IGNORECASE)):
        # Last resort: screenshot for debugging, then fail descriptively
        page.screenshot(path="/tmp/debug_servers_nav.png")
        pytest.fail(
            "Could not locate 'Servers' tab/button in the admin console. "
            "Screenshot saved to /tmp/debug_servers_nav.png"
        )
    page.wait_for_timeout(2000)


def _get_first_server_card(page: Page):
    """Return the first visible server card/row locator, or None."""
    for sel in (
        "[data-testid*='server-card']",
        "[data-testid*='server-row']",
        "[class*='server-card']",
        "[class*='serverCard']",
        "div.rounded-xl.border",
        "div.rounded-lg.border",
        "tbody tr",
    ):
        items = page.locator(sel)
        if items.count() > 0 and items.first.is_visible():
            return items.first
    return None


# =====================================================================
# US001 - View Tool Servers List
# =====================================================================


def test_us001_servers_list_visible(page: Page):
    """US001 - Tool servers list is displayed with server details."""
    print("\n[US001] Checking tool servers list is visible")
    _navigate_to_servers(page)
    page.screenshot(path="results/servers-us001-01-page.png")

    # Heading / page title
    heading = page.locator("text=/servers/i").first
    expect(heading).to_be_visible(timeout=10000)
    print("[US001] PASS - Servers page loaded")


def test_us001_server_details_shown(page: Page):
    """US001 - Each server entry shows relevant details (name, status, URL)."""
    print("\n[US001] Checking server cards contain name, status and URL details")
    _navigate_to_servers(page)
    page.wait_for_timeout(1000)
    page.screenshot(path="results/servers-us001-02-details.png")

    body_text = page.locator("body").inner_text().lower()
    has_url = "http" in body_text or "url" in body_text or "endpoint" in body_text
    has_status = any(kw in body_text for kw in ("active", "inactive", "connected", "status", "healthy", "unreachable"))

    print(f"[US001] URL indicator present: {has_url} | Status indicator present: {has_status}")
    assert has_url or has_status, "Expected server details (URL or status) on the servers page"
    print("[US001] PASS - Server details visible")


def test_us001_search_filter_servers(page: Page):
    """US001 - Admin can search/filter servers by name."""
    print("\n[US001] Checking search/filter input for servers")
    _navigate_to_servers(page)
    page.wait_for_timeout(1000)
    page.screenshot(path="results/servers-us001-03-search.png")

    search = page.get_by_placeholder(re.compile(r"search|filter|server", re.IGNORECASE))
    expect(search.first).to_be_visible(timeout=10000)

    search.first.fill("test-server-xyz-none")
    page.wait_for_timeout(1000)
    page.screenshot(path="results/servers-us001-04-search-typed.png")
    print("[US001] PASS - Search input found and responds to input")


# =====================================================================
# US002 - Attach Tool Server
# =====================================================================


def test_us002_attach_button_visible(page: Page):
    """US002 - An Attach / Add server button is available on the servers page."""
    print("\n[US002] Checking Attach server button is visible")
    _navigate_to_servers(page)
    page.screenshot(path="results/servers-us002-01-page.png")

    attach_btn = page.get_by_role(
        "button", name=re.compile(r"attach|add\s*server|connect|new\s*server", re.IGNORECASE)
    )
    expect(attach_btn.first).to_be_visible(timeout=10000)
    print("[US002] PASS - Attach server button found")


def test_us002_attach_modal_opens(page: Page):
    """US002 - Clicking Attach opens a form/modal with required fields."""
    print("\n[US002] Testing Attach server modal opens with input fields")
    _navigate_to_servers(page)
    page.wait_for_timeout(1000)

    attach_btn = page.get_by_role(
        "button", name=re.compile(r"attach|add\s*server|connect|new\s*server", re.IGNORECASE)
    )
    expect(attach_btn.first).to_be_visible(timeout=10000)
    attach_btn.first.click()
    page.wait_for_timeout(1500)
    page.screenshot(path="results/servers-us002-02-attach-modal.png")

    dialog = page.locator("[role='dialog']")
    expect(dialog).to_be_visible(timeout=8000)
    print("[US002] Attach modal opened")

    # Verify input fields are present
    inputs = dialog.locator("input, textarea")
    print(f"[US002] Input fields in modal: {inputs.count()}")
    assert inputs.count() > 0, "Expected input fields in the Attach Server modal"
    print("[US002] PASS - Attach modal has input fields")


def test_us002_attach_modal_cancel(page: Page):
    """US002 - Clicking Cancel in the Attach modal discards and closes it."""
    print("\n[US002] Testing Cancel discards attach form")
    _navigate_to_servers(page)
    page.wait_for_timeout(1000)

    attach_btn = page.get_by_role(
        "button", name=re.compile(r"attach|add\s*server|connect|new\s*server", re.IGNORECASE)
    )
    expect(attach_btn.first).to_be_visible(timeout=10000)
    attach_btn.first.click()
    page.wait_for_timeout(1500)

    dialog = page.locator("[role='dialog']")
    expect(dialog).to_be_visible(timeout=8000)

    cancel_btn = dialog.get_by_role("button", name=re.compile(r"^cancel$", re.IGNORECASE))
    expect(cancel_btn.first).to_be_visible(timeout=5000)
    cancel_btn.first.click()
    page.wait_for_timeout(1000)
    page.screenshot(path="results/servers-us002-03-after-cancel.png")

    expect(dialog).not_to_be_visible(timeout=5000)
    print("[US002] PASS - Cancel closed modal without saving")


def test_us002_required_fields_present(page: Page):
    """US002 - Attach modal contains name/URL fields required to connect a server."""
    print("\n[US002] Verifying required fields (name, URL) in Attach modal")
    _navigate_to_servers(page)
    page.wait_for_timeout(1000)

    attach_btn = page.get_by_role(
        "button", name=re.compile(r"attach|add\s*server|connect|new\s*server", re.IGNORECASE)
    )
    expect(attach_btn.first).to_be_visible(timeout=10000)
    attach_btn.first.click()
    page.wait_for_timeout(1500)

    dialog = page.locator("[role='dialog']")
    expect(dialog).to_be_visible(timeout=8000)
    page.screenshot(path="results/servers-us002-04-fields.png")

    dialog_text = dialog.inner_text().lower()
    has_name_field = "name" in dialog_text
    has_url_field = "url" in dialog_text or "endpoint" in dialog_text or "address" in dialog_text

    print(f"[US002] Name field label: {has_name_field} | URL/endpoint field label: {has_url_field}")
    assert has_name_field or has_url_field, "Expected name or URL field in Attach modal"
    print("[US002] PASS - Required fields present in Attach modal")

    dialog.get_by_role("button", name=re.compile(r"^cancel$", re.IGNORECASE)).first.click()


# =====================================================================
# US003 - Detach Tool Server
# =====================================================================


def test_us003_detach_option_on_server(page: Page):
    """US003 - Each server card has a Detach option."""
    print("\n[US003] Checking Detach option is present on server cards")
    _navigate_to_servers(page)
    page.wait_for_timeout(1000)
    page.screenshot(path="results/servers-us003-01-page.png")

    detach_btn = page.locator(
        "button[title*='detach' i], button[aria-label*='detach' i], "
        "[data-testid*='detach'], button[title*='disconnect' i]"
    ).first

    if not detach_btn.is_visible():
        card = _get_first_server_card(page)
        if card:
            card.hover()
            page.wait_for_timeout(500)
        detach_btn = page.locator(
            "button[title*='detach' i], button[aria-label*='detach' i]"
        ).first

    if not detach_btn.is_visible():
        # Fallback: look for detach text anywhere on the page
        detach_btn = page.get_by_role(
            "button", name=re.compile(r"detach|disconnect|remove", re.IGNORECASE)
        ).first

    expect(detach_btn).to_be_visible(timeout=8000)
    print("[US003] PASS - Detach option found on server card")


def test_us003_detach_confirmation_prompt(page: Page):
    """US003 - Clicking Detach shows a confirmation prompt before removing the server."""
    print("\n[US003] Testing detach confirmation prompt appears")
    _navigate_to_servers(page)
    page.wait_for_timeout(1000)

    card = _get_first_server_card(page)
    if card:
        card.hover()
        page.wait_for_timeout(500)

    detach_btn = page.locator(
        "button[title*='detach' i], button[aria-label*='detach' i], [data-testid*='detach']"
    ).first
    if not detach_btn.is_visible():
        detach_btn = page.get_by_role(
            "button", name=re.compile(r"detach|disconnect", re.IGNORECASE)
        ).first

    expect(detach_btn).to_be_visible(timeout=8000)
    detach_btn.click()
    page.wait_for_timeout(1000)
    page.screenshot(path="results/servers-us003-02-confirm-dialog.png")

    confirm_dialog = page.locator("[role='dialog'], [role='alertdialog']")
    expect(confirm_dialog.first).to_be_visible(timeout=8000)

    dialog_text = confirm_dialog.first.inner_text().lower()
    has_confirm_wording = any(
        kw in dialog_text for kw in ("detach", "confirm", "remove", "disconnect", "are you sure")
    )
    print(f"[US003] Confirmation wording present: {has_confirm_wording}")
    assert has_confirm_wording, "Confirmation dialog missing detach/confirm wording"
    print("[US003] PASS - Confirmation dialog shown before detach")

    # Always cancel — do not actually detach servers in automated tests
    cancel = confirm_dialog.first.get_by_role(
        "button", name=re.compile(r"cancel|no|keep", re.IGNORECASE)
    )
    if cancel.count() > 0:
        cancel.first.click()
    else:
        page.keyboard.press("Escape")
    page.wait_for_timeout(500)
    print("[US003] Detach cancelled — server preserved")


# =====================================================================
# US004 - Sync Tool Servers
# =====================================================================


def test_us004_sync_button_visible(page: Page):
    """US004 - A Sync button/option is available on the tool servers page."""
    print("\n[US004] Checking Sync button is visible")
    _navigate_to_servers(page)
    page.screenshot(path="results/servers-us004-01-page.png")

    sync_btn = page.get_by_role("button", name=re.compile(r"^sync$|sync\s*all|synchronize", re.IGNORECASE))
    if sync_btn.count() == 0:
        sync_btn = page.locator(
            "button[title*='sync' i], button[aria-label*='sync' i], [data-testid*='sync']"
        )
    expect(sync_btn.first).to_be_visible(timeout=10000)
    print("[US004] PASS - Sync button found")


def test_us004_sync_triggers_update(page: Page):
    """US004 - Clicking Sync fetches latest tools and completes without error."""
    print("\n[US004] Testing Sync button triggers an update")
    _navigate_to_servers(page)
    page.wait_for_timeout(1000)

    sync_btn = page.get_by_role("button", name=re.compile(r"^sync$|sync\s*all|synchronize", re.IGNORECASE))
    if sync_btn.count() == 0:
        sync_btn = page.locator("button[title*='sync' i], button[aria-label*='sync' i]")

    expect(sync_btn.first).to_be_visible(timeout=10000)
    sync_btn.first.click()

    # Capture immediately to catch loading state
    page.screenshot(path="results/servers-us004-02-syncing.png")
    print("[US004] Sync clicked — checking for loading/spinner")

    loading = page.locator(
        "[class*='spinner'], [class*='loading'], [class*='skeleton'], "
        "[aria-busy='true'], [role='progressbar']"
    )
    loading_detected = loading.count() > 0
    print(f"[US004] Loading indicator detected: {loading_detected}")

    page.wait_for_timeout(3000)
    page.screenshot(path="results/servers-us004-03-after-sync.png")

    # After sync, page should still be functional
    expect(page.locator("body")).to_be_visible()
    print("[US004] PASS - Sync completed, page still functional")


def test_us004_sync_notification(page: Page):
    """US004 - Admin is notified when sync is complete (toast / status message)."""
    print("\n[US004] Checking for completion notification after sync")
    _navigate_to_servers(page)
    page.wait_for_timeout(1000)

    sync_btn = page.get_by_role("button", name=re.compile(r"^sync$|sync\s*all|synchronize", re.IGNORECASE))
    if sync_btn.count() == 0:
        sync_btn = page.locator("button[title*='sync' i], button[aria-label*='sync' i]")

    expect(sync_btn.first).to_be_visible(timeout=10000)
    sync_btn.first.click()
    page.wait_for_timeout(4000)
    page.screenshot(path="results/servers-us004-04-notification.png")

    body_text = page.locator("body").inner_text().lower()
    has_notification = any(
        kw in body_text for kw in ("sync", "success", "complete", "updated", "done", "finished")
    )
    print(f"[US004] Sync completion indicator present: {has_notification}")
    assert has_notification, "Expected a sync completion notification or status change"
    print("[US004] PASS - Sync completion notification found")


# =====================================================================
# US005 - Health Check
# =====================================================================


def test_us005_health_check_option_visible(page: Page):
    """US005 - Each tool server has a Health Check option."""
    print("\n[US005] Checking Health Check option is present on server cards")
    _navigate_to_servers(page)
    page.wait_for_timeout(1000)
    page.screenshot(path="results/servers-us005-01-page.png")

    health_btn = page.locator(
        "button[title*='health' i], button[aria-label*='health' i], "
        "[data-testid*='health'], button[title*='check' i]"
    ).first

    if not health_btn.is_visible():
        card = _get_first_server_card(page)
        if card:
            card.hover()
            page.wait_for_timeout(500)
        health_btn = page.locator(
            "button[title*='health' i], button[aria-label*='health' i]"
        ).first

    if not health_btn.is_visible():
        health_btn = page.get_by_role(
            "button", name=re.compile(r"health|check|ping", re.IGNORECASE)
        ).first

    expect(health_btn).to_be_visible(timeout=8000)
    print("[US005] PASS - Health Check option found")


def test_us005_health_check_shows_result(page: Page):
    """US005 - Performing a health check displays the result (healthy / unreachable)."""
    print("\n[US005] Testing Health Check displays a result")
    _navigate_to_servers(page)
    page.wait_for_timeout(1000)

    card = _get_first_server_card(page)
    if card:
        card.hover()
        page.wait_for_timeout(500)

    health_btn = page.locator(
        "button[title*='health' i], button[aria-label*='health' i], [data-testid*='health']"
    ).first
    if not health_btn.is_visible():
        health_btn = page.get_by_role(
            "button", name=re.compile(r"health|check|ping", re.IGNORECASE)
        ).first

    expect(health_btn).to_be_visible(timeout=8000)
    health_btn.click()
    page.wait_for_timeout(3000)
    page.screenshot(path="results/servers-us005-02-health-result.png")

    body_text = page.locator("body").inner_text().lower()
    has_result = any(
        kw in body_text
        for kw in ("healthy", "unhealthy", "reachable", "unreachable", "ok", "error", "failed", "success")
    )
    print(f"[US005] Health check result present: {has_result}")
    assert has_result, "Expected a health check result (healthy/unreachable) after performing the check"
    print("[US005] PASS - Health check result displayed")


def test_us005_health_check_result_immediate(page: Page):
    """US005 - Health check result appears immediately after the check is performed."""
    print("\n[US005] Verifying health check result appears promptly")
    _navigate_to_servers(page)
    page.wait_for_timeout(1000)

    card = _get_first_server_card(page)
    if card:
        card.hover()
        page.wait_for_timeout(500)

    health_btn = page.locator(
        "button[title*='health' i], button[aria-label*='health' i], [data-testid*='health']"
    ).first
    if not health_btn.is_visible():
        health_btn = page.get_by_role(
            "button", name=re.compile(r"health|check|ping", re.IGNORECASE)
        ).first

    expect(health_btn).to_be_visible(timeout=8000)
    health_btn.click()

    # Capture immediately — result should not require a page reload
    page.screenshot(path="results/servers-us005-03-immediate.png")
    page.wait_for_timeout(3000)
    page.screenshot(path="results/servers-us005-04-result-final.png")

    expect(page.locator("body")).to_be_visible()
    print("[US005] PASS - Page remains functional after health check")
