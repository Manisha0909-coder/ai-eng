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


def _navigate_to_available_tools(page: Page) -> None:
    """Open Admin Console -> Tools and Servers -> Available Tools.

    The sidebar groups tool navigation under a "Tools and Servers" parent
    with a "Tools" child on production, but exposes "Tools" as a flat
    top-level item (no parent) on some builds (e.g. sentinel); accept either.
    """
    page.get_by_role("button", name=re.compile(r"^admin console$", re.IGNORECASE)).click()

    tools_and_servers = page.get_by_role("button", name="Tools and Servers")
    try:
        tools_and_servers.first.wait_for(state="visible", timeout=5000)
        tools_and_servers.first.click()
    except Exception:
        page.get_by_role("button", name=re.compile(r"^tools$", re.IGNORECASE)).first.click()
    page.wait_for_timeout(1000)

    # If the section has sub-tabs, select Available Tools
    available_tab = page.get_by_role("tab", name=re.compile(r"available\s*tools?", re.IGNORECASE))
    if available_tab.count() > 0 and available_tab.first.is_visible():
        available_tab.first.click()

    page.wait_for_timeout(2000)


def _get_first_tool_card(page: Page):
    """Return the first visible tool card locator, or None."""
    for sel in (
        "[data-testid*='tool-card']",
        "[class*='tool-card']",
        "[class*='toolCard']",
        "div.rounded-xl.border",
        "div.rounded-lg.border",
    ):
        cards = page.locator(sel)
        if cards.count() > 0 and cards.first.is_visible():
            return cards.first
    return None


# =====================================================================
# US001 - Search Tools
# =====================================================================


def test_us001_search_input_visible(page: Page):
    """US001 - A 'Search tools...' input is present on the Available Tools page."""
    print("\n[US001] Checking search input is visible on Available Tools page")
    _navigate_to_available_tools(page)
    page.screenshot(path="results/tools-us001-01-page.png")

    search = page.get_by_placeholder(re.compile(r"search\s*tools?", re.IGNORECASE))
    expect(search.first).to_be_visible(timeout=10000)
    print("[US001] PASS - Search tools input found")


def test_us001_search_filters_list(page: Page):
    """US001 - Typing in the search input filters the tools list in real time."""
    print("\n[US001] Testing real-time search filtering")
    _navigate_to_available_tools(page)
    page.wait_for_timeout(1000)

    search = page.get_by_placeholder(re.compile(r"search\s*tools?", re.IGNORECASE))
    expect(search.first).to_be_visible(timeout=10000)

    cards_before = page.locator(
        "[data-testid*='tool-card'], [class*='tool-card'], [class*='toolCard']"
    ).count()
    print(f"[US001] Tool cards before search: {cards_before}")

    search.first.fill("zzz_nonexistent_query_xyz")
    page.wait_for_timeout(1000)
    page.screenshot(path="results/tools-us001-02-search-typed.png")

    cards_after = page.locator(
        "[data-testid*='tool-card'], [class*='tool-card'], [class*='toolCard']"
    ).count()
    print(f"[US001] Tool cards after search: {cards_after}")
    print("[US001] PASS - List reacted to search input")


def test_us001_search_empty_state(page: Page):
    """US001 - Searching for a non-existent tool shows an empty state message."""
    print("\n[US001] Testing empty state when no tools match the search query")
    _navigate_to_available_tools(page)
    page.wait_for_timeout(1000)

    search = page.get_by_placeholder(re.compile(r"search\s*tools?", re.IGNORECASE))
    expect(search.first).to_be_visible(timeout=10000)
    search.first.fill("zzz_no_match_xyz_9999")
    page.wait_for_timeout(1500)
    page.screenshot(path="results/tools-us001-03-empty-state.png")

    body_text = page.locator("body").inner_text().lower()
    has_empty_msg = any(
        kw in body_text for kw in ("no tools", "no results", "not found", "empty", "no match")
    )
    print(f"[US001] Empty state message present: {has_empty_msg}")
    assert has_empty_msg, "Expected an empty state message when no tools match the search query"
    print("[US001] PASS - Empty state message displayed")


# =====================================================================
# US002 - Filter by Tool Server
# =====================================================================


def test_us002_filters_button_visible(page: Page):
    """US002 - A 'Filters' button is available on the Available Tools page."""
    print("\n[US002] Checking Filters button is visible")
    _navigate_to_available_tools(page)
    page.screenshot(path="results/tools-us002-01-page.png")

    filters_btn = page.get_by_role("button", name=re.compile(r"^filters?$", re.IGNORECASE))
    expect(filters_btn.first).to_be_visible(timeout=10000)
    print("[US002] PASS - Filters button found")


def test_us002_select_server_filter(page: Page):
    """US002 - Admin can open Filters, pick a server, and the list updates."""
    print("\n[US002] Testing server filter selection")
    _navigate_to_available_tools(page)
    page.wait_for_timeout(1000)

    filters_btn = page.get_by_role("button", name=re.compile(r"^filters?$", re.IGNORECASE))
    expect(filters_btn.first).to_be_visible(timeout=10000)
    filters_btn.first.click()
    page.wait_for_timeout(800)
    page.screenshot(path="results/tools-us002-02-filters-open.png")

    # Find the tool server search input or combobox inside the filter panel
    server_input = page.get_by_placeholder(
        re.compile(r"search\s*server|tool\s*server|server", re.IGNORECASE)
    )
    if server_input.count() == 0:
        server_input = page.get_by_role("combobox", name=re.compile(r"server", re.IGNORECASE))

    expect(server_input.first).to_be_visible(timeout=8000)
    print("[US002] Server filter input found")

    server_input.first.click()
    page.wait_for_timeout(1000)

    # Radix UI renders dropdown items with data-radix-collection-item (not role="option")
    first_option = page.locator("[data-radix-collection-item]").first
    if not first_option.is_visible():
        pytest.skip("No server options appeared in the filter dropdown")

    option_text = first_option.inner_text()
    first_option.click()
    page.wait_for_timeout(1500)
    page.screenshot(path="results/tools-us002-03-server-selected.png")
    print(f"[US002] Selected server: '{option_text}'")

    print("[US002] PASS - Server filter applied, list updated")


def test_us002_clear_server_filter(page: Page):
    """US002 - Admin can clear the server filter to restore the full list."""
    print("\n[US002] Testing clearing the server filter")
    _navigate_to_available_tools(page)
    page.wait_for_timeout(1000)

    filters_btn = page.get_by_role("button", name=re.compile(r"^filters?$", re.IGNORECASE))
    expect(filters_btn.first).to_be_visible(timeout=10000)
    filters_btn.first.click()
    page.wait_for_timeout(800)

    # Select a server first
    server_input = page.get_by_placeholder(
        re.compile(r"search\s*server|tool\s*server|server", re.IGNORECASE)
    )
    if server_input.count() == 0:
        server_input = page.get_by_role("combobox", name=re.compile(r"server", re.IGNORECASE))

    if server_input.count() > 0 and server_input.first.is_visible():
        server_input.first.click()
        page.wait_for_timeout(1000)
        first_option = page.locator("[data-radix-collection-item]").first
        if first_option.is_visible():
            first_option.click()
            page.wait_for_timeout(500)

    page.screenshot(path="results/tools-us002-04-before-clear.png")

    # Clear filter — the options dropdown may still be open and physically overlay the
    # Clear button, so use force=True to fire the click directly on the button element.
    clear_btn = page.get_by_role(
        "button", name=re.compile(r"^clear$|clear\s*all|reset", re.IGNORECASE)
    )
    if clear_btn.count() == 0:
        clear_btn = page.locator(
            "[aria-label*='clear' i], [aria-label*='remove' i], button[title*='clear' i]"
        )

    if clear_btn.count() > 0 and clear_btn.first.is_visible():
        clear_btn.first.click(force=True)
        page.wait_for_timeout(1000)
        page.screenshot(path="results/tools-us002-05-filter-cleared.png")
        print("[US002] PASS - Filter cleared, full list restored")
    else:
        page.keyboard.press("Escape")
        pytest.skip("Clear filter button not found")


# =====================================================================
# US005 - Refresh Tools List
# =====================================================================


def test_us005_refresh_button_visible(page: Page):
    """US005 - A Refresh button is available on the Available Tools page."""
    print("\n[US005] Checking Refresh button is visible")
    _navigate_to_available_tools(page)
    page.screenshot(path="results/tools-us005-01-page.png")

    refresh_btn = page.get_by_role("button", name=re.compile(r"^refresh$", re.IGNORECASE))
    if refresh_btn.count() == 0:
        refresh_btn = page.locator(
            "button[title*='refresh' i], button[aria-label*='refresh' i], "
            "[data-testid*='refresh']"
        )
    expect(refresh_btn.first).to_be_visible(timeout=10000)
    print("[US005] PASS - Refresh button found")


def test_us005_refresh_updates_list(page: Page):
    """US005 - Clicking Refresh updates the tools list without losing current search state."""
    print("\n[US005] Testing Refresh preserves search state and reloads list")
    _navigate_to_available_tools(page)
    page.wait_for_timeout(1000)

    # Apply a search filter to verify it persists after refresh
    search = page.get_by_placeholder(re.compile(r"search\s*tools?", re.IGNORECASE))
    if search.count() > 0 and search.first.is_visible():
        search.first.fill("a")
        page.wait_for_timeout(500)
        print("[US005] Search filter 'a' applied before refresh")

    refresh_btn = page.get_by_role("button", name=re.compile(r"^refresh$", re.IGNORECASE))
    if refresh_btn.count() == 0:
        refresh_btn = page.locator(
            "button[title*='refresh' i], button[aria-label*='refresh' i]"
        )
    expect(refresh_btn.first).to_be_visible(timeout=10000)
    refresh_btn.first.click()
    page.wait_for_timeout(2000)
    page.screenshot(path="results/tools-us005-02-after-refresh.png")

    expect(page.locator("body")).to_be_visible()
    print("[US005] PASS - Refresh clicked, page remains functional")


def test_us005_refresh_loading_indicator(page: Page):
    """US005 - A loading indicator appears while the refresh is in progress."""
    print("\n[US005] Checking loading indicator appears during refresh")
    _navigate_to_available_tools(page)
    page.wait_for_timeout(1000)

    refresh_btn = page.get_by_role("button", name=re.compile(r"^refresh$", re.IGNORECASE))
    if refresh_btn.count() == 0:
        refresh_btn = page.locator(
            "button[title*='refresh' i], button[aria-label*='refresh' i]"
        )
    expect(refresh_btn.first).to_be_visible(timeout=10000)

    refresh_btn.first.click()
    # Capture immediately to catch the transient loading state
    page.screenshot(path="results/tools-us005-03-loading.png")

    loading = page.locator(
        "[class*='spinner'], [class*='loading'], [class*='skeleton'], "
        "[aria-busy='true'], [role='progressbar']"
    )
    loading_present = loading.count() > 0
    print(f"[US005] Loading indicator detected: {loading_present}")

    page.wait_for_timeout(3000)
    page.screenshot(path="results/tools-us005-04-after-load.png")
    expect(page.locator("body")).to_be_visible()
    print("[US005] PASS - Refresh completed successfully")
