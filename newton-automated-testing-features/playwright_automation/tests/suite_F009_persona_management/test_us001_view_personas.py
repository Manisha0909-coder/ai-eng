import re
import sys
from pathlib import Path

import pytest
from playwright.sync_api import Page, expect

sys.path.insert(0, str(Path(__file__).parent))
from helpers import _navigate_to_personas


# =====================================================================
# US001 – View All Personas
# =====================================================================


def test_us001_page_title_and_subtitle(page: Page):
    """US001 – Personas page heading is visible after navigation."""
    print("\n[US001] Checking page title and subtitle")
    _navigate_to_personas(page)
    page.wait_for_timeout(800)
    page.screenshot(path="results/persona-us001-01-page.png")

    body_text = page.locator("body").inner_text().lower()
    # UI changed: heading is now "Personas" rather than "Persona Management"
    has_title = "persona management" in body_text or "personas" in body_text
    assert has_title, "Expected 'Personas' or 'Persona Management' heading on page"
    print("[US001] PASS – Title found")


def test_us001_personas_listed_with_details(page: Page):
    """US001 – Personas are listed with name, type, version, model, timestamps."""
    print("\n[US001] Checking persona list with details")
    _navigate_to_personas(page)
    page.wait_for_timeout(800)
    page.screenshot(path="results/persona-us001-02-list.png")

    body_text = page.locator("body").inner_text().lower()
    has_list = any(kw in body_text for kw in ("version", "model", "created", "updated", "type"))
    assert has_list, "Expected persona detail columns (version, model, timestamps) on the page"
    print("[US001] PASS – Personas listed with details")


def test_us001_search_input_visible(page: Page):
    """US001 – Search input is present on the Personas page."""
    print("\n[US001] Checking search input")
    _navigate_to_personas(page)
    page.wait_for_timeout(500)

    search = page.get_by_role("textbox", name=re.compile(r"search by persona", re.IGNORECASE))
    expect(search.first).to_be_visible(timeout=10000)
    print("[US001] PASS – Search personas input found")


def test_us001_search_filters_list(page: Page):
    """US001 – Typing in search updates the list dynamically."""
    print("\n[US001] Testing search filtering")
    _navigate_to_personas(page)
    page.wait_for_timeout(500)

    search = page.get_by_role("textbox", name=re.compile(r"search by persona", re.IGNORECASE))
    expect(search.first).to_be_visible(timeout=10000)
    search.first.fill("zzz_no_match_xyz")
    page.wait_for_timeout(1500)
    page.screenshot(path="results/persona-us001-03-search.png")

    body_text = page.locator("body").inner_text().lower()
    has_empty = any(
        kw in body_text for kw in (
            "no persona", "no results", "not found", "empty", "0 results", "no data", "zzz_no_match",
        )
    )
    assert has_empty, "Expected empty state or filter feedback after searching nonexistent term"
    print("[US001] PASS – Search filters persona list")


def test_us001_type_filter_options(page: Page):
    """US001 – Type filter shows All types / chat / api / dashboard options."""
    print("\n[US001] Checking Type filter options")
    _navigate_to_personas(page)
    page.wait_for_timeout(800)
    page.screenshot(path="results/persona-us001-04-before-filter.png")

    # Open the Filters panel
    page.get_by_role("button", name="Filters").click()
    page.wait_for_timeout(1000)
    page.screenshot(path="results/persona-us001-04-filter-panel.png")

    # Open the Type dropdown
    page.get_by_role("textbox", name="Type").click()
    page.wait_for_timeout(1000)
    page.screenshot(path="results/persona-us001-04-type-filter.png")

    body_text = page.locator("body").inner_text().lower()
    has_types = all(kw in body_text for kw in ("chat", "api", "dashboard"))
    print(f"[US001] Type options visible: {has_types}")
    assert has_types, "Expected chat, api, dashboard type options in Type filter"
    page.keyboard.press("Escape")
    page.wait_for_timeout(500)
    print("[US001] PASS – Type filter shows expected options")
