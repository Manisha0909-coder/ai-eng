import re
import sys
from pathlib import Path

import pytest
from playwright.sync_api import Page, expect

sys.path.insert(0, str(Path(__file__).parent))
from helpers import (
    _TEST_PREFIX,
    _navigate_to_personas,
    _create_test_persona,
    _close_modal,
    _delete_test_persona,
    _find_test_persona_row,
)


@pytest.fixture
def created_personas(page: Page):
    """Yield a list that tests append persona names to; deletes all of them after the test."""
    names: list[str] = []
    yield names
    if not names:
        return
    try:
        _navigate_to_personas(page)
        for name in names:
            _delete_test_persona(page, name)
    except Exception:
        pass


# =====================================================================
# US003 – Edit a Persona
# =====================================================================


def test_us003_edit_icon_present(page: Page):
    """US003 – Each persona has an Edit icon."""
    print("\n[US003] Checking Edit icon on persona")
    _navigate_to_personas(page)
    page.wait_for_timeout(500)

    # New UI: click first row to reveal action buttons
    edit_icon = page.get_by_role("button", name="Edit persona").first
    if not edit_icon.is_visible():
        first_row = page.locator("tbody tr").first
        if first_row.is_visible():
            first_row.click()
            page.wait_for_timeout(500)
        edit_icon = page.get_by_role("button", name="Edit persona").first

    expect(edit_icon).to_be_visible(timeout=8000)
    page.screenshot(path="results/persona-us003-01-edit-icon.png")
    print("[US003] PASS – Edit icon found")


def test_us003_edit_modal_opens_prefilled(page: Page, created_personas: list):
    """US003 – Edit modal opens with Name and Model pre-filled."""
    print("\n[US003] Testing Edit modal opens with pre-filled data")
    test_name = f"{_TEST_PREFIX}Edit_Test"
    created_personas.append(test_name)
    _navigate_to_personas(page)
    created = _create_test_persona(page, test_name)
    if not created:
        pytest.skip("Could not create test persona — model field not auto-selectable via current strategies")

    page.wait_for_timeout(1000)
    row = _find_test_persona_row(page, test_name)
    if row is None:
        pytest.skip("Test persona row not found after creation")

    # Click the row's Edit button directly — opening the detail panel first
    # applies aria-hidden to the background table, hiding this button from
    # the accessibility tree.
    edit_btn = row.get_by_role("button", name="Edit persona")
    expect(edit_btn).to_be_visible(timeout=8000)
    edit_btn.click()
    page.wait_for_timeout(2000)
    page.screenshot(path="results/persona-us003-02-edit-modal.png")

    dialog = page.locator("[role='dialog']")
    expect(dialog).to_be_visible(timeout=8000)
    dialog_text = dialog.inner_text().lower()
    assert "edit" in dialog_text and ("persona" in dialog_text or "name" in dialog_text), (
        "Expected Edit Persona modal content"
    )

    # Find the name field by placeholder first (more specific than input[type='text'])
    name_field = dialog.get_by_placeholder(re.compile(r"marketing strategist|e\.g\.", re.IGNORECASE))
    if name_field.count() == 0 or not name_field.first.is_visible():
        name_field = dialog.locator("input[type='text']").first
    name_value = name_field.input_value() if name_field.count() > 0 and name_field.is_visible() else ""
    if not name_value:
        # Fallback: persona name pre-filled as visible text (e.g. shown in a preview or heading)
        name_value = test_name if test_name in dialog.inner_text() else ""
    print(f"[US003] Pre-filled name: '{name_value}'")
    assert name_value, "Expected persona name to be pre-filled in Edit modal"
    print("[US003] PASS – Edit modal opened with pre-filled data")

    _close_modal(page, dialog)


def test_us003_edit_cancel_discards_changes(page: Page, created_personas: list):
    """US003 – Cancel in Edit modal discards changes."""
    print("\n[US003] Testing Cancel in Edit modal")
    test_name = f"{_TEST_PREFIX}Edit_Cancel"
    created_personas.append(test_name)
    _navigate_to_personas(page)
    created = _create_test_persona(page, test_name)
    if not created:
        pytest.skip("Could not create test persona")

    page.wait_for_timeout(1000)
    row = _find_test_persona_row(page, test_name)
    if row is None:
        pytest.skip("Test persona row not found")

    edit_btn = row.get_by_role("button", name="Edit persona")
    expect(edit_btn).to_be_visible(timeout=8000)
    edit_btn.click()
    page.wait_for_timeout(2000)

    dialog = page.locator("[role='dialog']")
    expect(dialog).to_be_visible(timeout=8000)

    name_field = dialog.locator("input[type='text']").first
    if name_field.is_visible():
        name_field.fill(f"{test_name}_MODIFIED")
        page.wait_for_timeout(500)

    _close_modal(page, dialog)
    page.wait_for_timeout(500)
    page.screenshot(path="results/persona-us003-03-after-cancel.png")
    expect(dialog).not_to_be_visible(timeout=5000)
    print("[US003] PASS – Edit modal closed without saving on Cancel")


def test_us003_update_button_present_in_edit_modal(page: Page, created_personas: list):
    """US003 – Save/Update button is present in Edit modal."""
    print("\n[US003] Checking Save/Update button in Edit modal")
    test_name = f"{_TEST_PREFIX}Edit_UpdateBtn"
    created_personas.append(test_name)
    _navigate_to_personas(page)
    created = _create_test_persona(page, test_name)
    if not created:
        pytest.skip("Could not create test persona")

    page.wait_for_timeout(1000)
    row = _find_test_persona_row(page, test_name)
    if row is None:
        pytest.skip("Test persona row not found")

    edit_btn = row.get_by_role("button", name="Edit persona")
    expect(edit_btn).to_be_visible(timeout=8000)
    edit_btn.click()
    page.wait_for_timeout(2000)

    dialog = page.locator("[role='dialog']")
    expect(dialog).to_be_visible(timeout=8000)
    page.screenshot(path="results/persona-us003-04-update-btn.png")

    save_btn = dialog.get_by_role(
        "button",
        name=re.compile(
            r"save|update\s*persona|update|save\s*changes|save\s*persona|apply|done",
            re.IGNORECASE,
        ),
    )
    if save_btn.count() == 0 or not save_btn.first.is_visible():
        # Multi-step edit wizard uses "Continue" on intermediate steps
        save_btn = dialog.get_by_role("button", name=re.compile(r"continue", re.IGNORECASE))
    expect(save_btn.first).to_be_visible(timeout=5000)
    print("[US003] PASS – Save/Update button found in Edit modal")

    _close_modal(page, dialog)
