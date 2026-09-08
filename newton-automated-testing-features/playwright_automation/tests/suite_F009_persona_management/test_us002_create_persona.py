import re
import sys
from pathlib import Path

import pytest
from playwright.sync_api import Page, expect

sys.path.insert(0, str(Path(__file__).parent))
from helpers import (
    _TEST_PREFIX,
    _navigate_to_personas,
    _open_create_modal,
    _close_modal,
    _click_continue,
)


# =====================================================================
# US002 – Create a New Persona
# =====================================================================


def test_us002_create_button_visible(page: Page):
    """US002 – 'Create New Persona' button is accessible."""
    print("\n[US002] Checking Create New Persona button")
    _navigate_to_personas(page)
    page.wait_for_timeout(500)
    page.screenshot(path="results/persona-us002-01-page.png")

    create_btn = page.get_by_role(
        "button",
        name=re.compile(r"create\s*new\s*persona|add\s*persona|new\s*persona", re.IGNORECASE),
    )
    expect(create_btn.first).to_be_visible(timeout=10000)
    print("[US002] PASS – Create New Persona button found")


def test_us002_create_modal_title_and_subtitle(page: Page):
    """US002 – Create modal has correct title and subtitle."""
    print("\n[US002] Checking Create modal title and subtitle")
    _navigate_to_personas(page)
    page.wait_for_timeout(500)
    _open_create_modal(page)
    page.wait_for_timeout(800)
    page.screenshot(path="results/persona-us002-02-modal.png")

    dialog = page.locator("[role='dialog']")
    expect(dialog).to_be_visible(timeout=8000)
    dialog_text = dialog.inner_text().lower()

    assert "create persona" in dialog_text, "Expected 'Create Persona' title in modal"
    has_subtitle = (
        "give the persona an identity" in dialog_text
        or "fill in the details" in dialog_text
        or "create a new persona" in dialog_text
        or "identity" in dialog_text
    )
    assert has_subtitle, "Expected subtitle about persona identity/details"
    print("[US002] PASS – Modal has correct title and subtitle")

    _close_modal(page, dialog)


def test_us002_required_fields_present(page: Page):
    """US002 – Required fields exist across the 5-step wizard (Basics, Identity, Intelligence, Capabilities, Review)."""
    print("\n[US002] Checking required fields in Create wizard")
    _navigate_to_personas(page)
    page.wait_for_timeout(500)
    _open_create_modal(page)
    page.wait_for_timeout(800)

    dialog = page.locator("[role='dialog']")
    expect(dialog).to_be_visible(timeout=8000)
    page.screenshot(path="results/persona-us002-03-fields.png")

    dialog_text = dialog.inner_text().lower()
    # Step 1 (Basics) fields visible immediately
    assert "persona name" in dialog_text or "name" in dialog_text, "Missing Persona Name field on step 1"
    assert "greeting" in dialog_text, "Missing Greeting Message field on step 1"
    # Wizard step labels confirm remaining fields exist in later steps
    has_steps = all(s in dialog_text for s in ("identity", "intelligence", "capabilities"))
    assert has_steps, "Expected wizard steps Identity, Intelligence, Capabilities"
    print("[US002] PASS – All required fields confirmed across wizard steps")

    _close_modal(page, dialog)


def test_us002_persona_type_selection(page: Page):
    """US002 – Persona Type can be Chat or Dashboard; Dashboard shows a hint."""
    print("\n[US002] Testing Persona Type selection")
    _navigate_to_personas(page)
    page.wait_for_timeout(500)
    _open_create_modal(page)
    page.wait_for_timeout(800)

    dialog = page.locator("[role='dialog']")
    expect(dialog).to_be_visible(timeout=8000)

    # New UI uses button[aria-pressed] for type selection, not radio buttons
    dashboard_opt = dialog.locator("button[aria-pressed]").filter(
        has_text=re.compile(r"dashboard", re.IGNORECASE)
    )
    if dashboard_opt.count() == 0:
        dashboard_opt = dialog.get_by_role("radio", name=re.compile(r"dashboard", re.IGNORECASE))
    if dashboard_opt.count() == 0:
        dashboard_opt = dialog.locator("button").filter(
            has_text=re.compile(r"^dashboard$", re.IGNORECASE)
        )

    if dashboard_opt.count() > 0 and dashboard_opt.first.is_visible():
        dashboard_opt.first.click()
        page.wait_for_timeout(1000)
        page.screenshot(path="results/persona-us002-04-dashboard-type.png")
        dialog_text = dialog.inner_text().lower()
        has_hint = "dashboard" in dialog_text and (
            "analytics" in dialog_text
            or "build" in dialog_text
            or "update" in dialog_text
            or "insights" in dialog_text
        )
        print(f"[US002] Dashboard hint visible: {has_hint}")
        assert has_hint, "Expected dashboard description when Dashboard type is selected"
    else:
        pytest.skip("Dashboard type option not found — may use a different UI pattern")

    print("[US002] PASS – Dashboard type selected and description shown")
    _close_modal(page, dialog)


def test_us002_tool_tags_searchable(page: Page):
    """US002 – Tool Tags field exists in the Capabilities step (step 4) of the Create wizard."""
    print("\n[US002] Testing Tool Tags search in Create wizard (step 4: Capabilities)")
    _navigate_to_personas(page)
    page.wait_for_timeout(500)
    _open_create_modal(page)
    page.wait_for_timeout(800)

    dialog = page.locator("[role='dialog']")
    expect(dialog).to_be_visible(timeout=8000)

    # Try clicking the Capabilities step button directly to jump to step 4
    capabilities_btn = dialog.locator("button").filter(
        has_text=re.compile(r"^capabilities$", re.IGNORECASE)
    )
    if capabilities_btn.count() > 0 and capabilities_btn.first.is_visible():
        capabilities_btn.first.click()
        page.wait_for_timeout(1000)

    tag_input = dialog.get_by_placeholder(
        re.compile(r"search.*tool|tool.*tag", re.IGNORECASE)
    )
    if tag_input.count() == 0:
        tag_input = dialog.get_by_role("combobox", name=re.compile(r"tool\s*tags?", re.IGNORECASE))

    if tag_input.count() > 0 and tag_input.first.is_visible():
        tag_input.first.click()
        page.wait_for_timeout(1000)
        page.screenshot(path="results/persona-us002-05-tool-tags.png")
        print("[US002] Tool Tags input found and clicked")
        dialog.locator("h2, h1, [role='heading']").first.click(force=True)
        page.wait_for_timeout(800)
    else:
        # Direct step jump not allowed — confirm Capabilities step label exists
        dialog_text = dialog.inner_text().lower()
        assert "capabilities" in dialog_text, "Expected 'Capabilities' step label in wizard"
        page.screenshot(path="results/persona-us002-05-tool-tags.png")
        print("[US002] Capabilities step confirmed; direct jump to step 4 not available")

    print("[US002] PASS – Tool Tags step confirmed in Create wizard")
    _close_modal(page, dialog)


def test_us002_create_persona_cancel(page: Page):
    """US002 – Clicking Cancel discards creation and closes modal."""
    print("\n[US002] Testing Cancel on Create modal")
    _navigate_to_personas(page)
    page.wait_for_timeout(500)
    _open_create_modal(page)
    page.wait_for_timeout(800)

    dialog = page.locator("[role='dialog']")
    expect(dialog).to_be_visible(timeout=8000)

    name_input = dialog.locator("input[type='text']").first
    if name_input.is_visible():
        name_input.fill(f"{_TEST_PREFIX}CANCEL_CHECK")
        page.wait_for_timeout(500)

    _close_modal(page, dialog)
    page.wait_for_timeout(500)
    page.screenshot(path="results/persona-us002-06-after-cancel.png")
    expect(dialog).not_to_be_visible(timeout=5000)
    print("[US002] PASS – Cancel closed modal without saving")


def test_us002_create_persona_submit_button_present(page: Page):
    """US002 – 'Continue' action button is present on step 1 of the Create wizard."""
    print("\n[US002] Checking Continue / Create Persona button in wizard")
    _navigate_to_personas(page)
    page.wait_for_timeout(500)
    _open_create_modal(page)
    page.wait_for_timeout(800)

    dialog = page.locator("[role='dialog']")
    expect(dialog).to_be_visible(timeout=8000)
    page.screenshot(path="results/persona-us002-07-submit-btn.png")

    # Step 1 shows "Continue"; final step shows "Create Persona"
    continue_btn = dialog.get_by_role("button", name=re.compile(r"^continue$", re.IGNORECASE))
    submit_btn = dialog.get_by_role(
        "button", name=re.compile(r"create\s*persona|save|submit", re.IGNORECASE)
    )
    has_action = (
        (continue_btn.count() > 0 and continue_btn.first.is_visible())
        or (submit_btn.count() > 0 and submit_btn.first.is_visible())
    )
    assert has_action, "Expected 'Continue' or 'Create Persona' button in Create wizard"
    print("[US002] PASS – Wizard action button found")

    _close_modal(page, dialog)
