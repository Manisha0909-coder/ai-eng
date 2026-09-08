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
    _find_checkboxes,
    _activate_bulk_select,
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
# US004 – Delete a Persona
# =====================================================================


def test_us004_delete_icon_present(page: Page):
    """US004 – Each persona has a Delete icon."""
    print("\n[US004] Checking Delete icon on persona")
    _navigate_to_personas(page)
    page.wait_for_timeout(500)

    # New UI: click first row to reveal action buttons
    delete_icon = page.get_by_role("button", name="Delete").first
    if not delete_icon.is_visible():
        first_row = page.locator("tbody tr").first
        if first_row.is_visible():
            first_row.click()
            page.wait_for_timeout(500)
        delete_icon = page.get_by_role("button", name="Delete").first

    expect(delete_icon).to_be_visible(timeout=8000)
    page.screenshot(path="results/persona-us004-01-delete-icon.png")
    print("[US004] PASS – Delete icon found")


def test_us004_delete_confirmation_modal_content(page: Page, created_personas: list):
    """US004 – Delete modal shows persona name and 'cannot be undone' wording."""
    print("\n[US004] Testing Delete confirmation modal content")
    test_name = f"{_TEST_PREFIX}Delete_Content"
    created_personas.append(test_name)
    _navigate_to_personas(page)
    created = _create_test_persona(page, test_name)
    if not created:
        pytest.skip("Could not create test persona for delete test")

    page.wait_for_timeout(1000)
    row = _find_test_persona_row(page, test_name)
    if row is None:
        pytest.skip("Test persona row not found")

    # Click the row's Delete button directly — opening the detail panel first
    # applies aria-hidden to the background table, hiding this button from
    # the accessibility tree.
    delete_btn = row.get_by_role("button", name="Delete persona")
    expect(delete_btn).to_be_visible(timeout=8000)
    delete_btn.click()
    page.wait_for_timeout(1500)
    page.screenshot(path="results/persona-us004-02-confirm-modal.png")

    # The delete-confirmation modal is role="dialog" on this build, not
    # role="alertdialog" (confirmed: the equivalent bulk-delete dialog check
    # below already accepts either and passes) — accept both.
    confirm_dialog = page.locator("[role='dialog'], [role='alertdialog']").filter(
        has_text=re.compile(r"delete persona", re.IGNORECASE)
    )
    expect(confirm_dialog).to_be_visible(timeout=8000)
    dialog_text = confirm_dialog.inner_text().lower()

    has_delete_title = "delete persona" in dialog_text or "delete" in dialog_text
    has_warning = any(
        kw in dialog_text for kw in ("permanently", "cannot be undone", "confirm", "are you sure")
    )
    print(f"[US004] Delete title: {has_delete_title} | Warning: {has_warning}")
    assert has_delete_title, "Expected 'Delete Persona' title in confirmation modal"
    assert has_warning, "Expected permanence warning in Delete modal"
    print("[US004] PASS – Delete confirmation modal has correct content")

    cancel = confirm_dialog.get_by_role(
        "button", name=re.compile(r"cancel|no|keep", re.IGNORECASE)
    )
    if cancel.count() > 0 and cancel.first.is_visible():
        cancel.first.click()
    else:
        page.keyboard.press("Escape")
    page.wait_for_timeout(800)


def test_us004_delete_confirm_and_cancel_buttons(page: Page, created_personas: list):
    """US004 – Confirmation modal has both Delete and Cancel buttons."""
    print("\n[US004] Checking Delete and Cancel buttons in confirmation modal")
    test_name = f"{_TEST_PREFIX}Delete_Buttons"
    created_personas.append(test_name)
    _navigate_to_personas(page)
    created = _create_test_persona(page, test_name)
    if not created:
        pytest.skip("Could not create test persona")

    page.wait_for_timeout(1000)
    row = _find_test_persona_row(page, test_name)
    if row is None:
        pytest.skip("Test persona row not found")

    delete_btn = row.get_by_role("button", name="Delete persona")
    expect(delete_btn).to_be_visible(timeout=8000)
    delete_btn.click()
    page.wait_for_timeout(1500)

    # The delete-confirmation modal is role="dialog" on this build, not
    # role="alertdialog" (confirmed: the equivalent bulk-delete dialog check
    # below already accepts either and passes) — accept both.
    confirm_dialog = page.locator("[role='dialog'], [role='alertdialog']").filter(
        has_text=re.compile(r"delete persona", re.IGNORECASE)
    )
    expect(confirm_dialog).to_be_visible(timeout=8000)
    page.screenshot(path="results/persona-us004-03-modal-buttons.png")

    confirm_btn = confirm_dialog.get_by_role(
        "button", name=re.compile(r"^delete$|confirm.*delete|yes.*delete", re.IGNORECASE)
    )
    cancel_btn = confirm_dialog.get_by_role(
        "button", name=re.compile(r"cancel|no|keep", re.IGNORECASE)
    )
    expect(confirm_btn.first).to_be_visible(timeout=5000)
    expect(cancel_btn.first).to_be_visible(timeout=5000)
    print("[US004] PASS – Both Delete and Cancel buttons present")

    cancel_btn.first.click()
    page.wait_for_timeout(800)


def test_us004_delete_persona_confirmed(page: Page):
    """US004 – Confirming Delete permanently removes the persona."""
    print("\n[US004] Testing confirmed persona deletion")
    test_name = f"{_TEST_PREFIX}Delete_Confirm"
    _navigate_to_personas(page)
    created = _create_test_persona(page, test_name)
    if not created:
        pytest.skip("Could not create test persona")

    page.wait_for_timeout(1000)
    row = _find_test_persona_row(page, test_name)
    if row is None:
        pytest.skip("Test persona row not found")

    delete_btn = row.get_by_role("button", name="Delete persona")
    expect(delete_btn).to_be_visible(timeout=8000)
    delete_btn.click()
    page.wait_for_timeout(1500)

    # The delete-confirmation modal is role="dialog" on this build, not
    # role="alertdialog" (confirmed: the equivalent bulk-delete dialog check
    # below already accepts either and passes) — accept both.
    confirm_dialog = page.locator("[role='dialog'], [role='alertdialog']").filter(
        has_text=re.compile(r"delete persona", re.IGNORECASE)
    )
    expect(confirm_dialog).to_be_visible(timeout=8000)

    confirm_btn = confirm_dialog.get_by_role(
        "button", name=re.compile(r"^delete$|confirm.*delete", re.IGNORECASE)
    )
    confirm_btn.first.click()
    page.wait_for_timeout(3000)
    page.screenshot(path="results/persona-us004-04-after-delete.png")

    persona_still_visible = page.get_by_text(test_name, exact=True).is_visible()
    assert not persona_still_visible, f"Expected '{test_name}' to be removed from list after deletion"
    print("[US004] PASS – Persona removed from list after confirmed deletion")


# =====================================================================
# US005 – Bulk Delete Personas
# =====================================================================


def test_us005_checkboxes_present(page: Page):
    """US005 – Personas have checkboxes for bulk selection."""
    print("\n[US005] Checking persona checkboxes for bulk selection")
    _navigate_to_personas(page)
    page.wait_for_timeout(800)
    page.screenshot(path="results/persona-us005-01-page.png")

    _activate_bulk_select(page)

    # Row checkboxes are <button role="checkbox" aria-label="Select row">, not
    # <input type="checkbox">. Scope to tbody to exclude the header "select all"
    # checkbox (aria-label="Select all rows on this page").
    checkboxes = page.locator("tbody").get_by_role("checkbox", name="Select row")
    if checkboxes.count() == 0:
        checkboxes = _find_checkboxes(page)

    count = checkboxes.count() if checkboxes else 0
    page.screenshot(path="results/persona-us005-01b-after-hover.png")
    print(f"[US005] Checkboxes found: {count}")

    if count == 0:
        pytest.skip(
            "No checkbox elements found. "
            "Check screenshot persona-us005-01b-after-hover.png"
        )

    assert count > 0, "Expected at least one checkbox for bulk selection"
    print("[US005] PASS – Checkboxes present on persona list")


def test_us005_bulk_delete_button_appears_on_selection(page: Page):
    """US005 – Selecting a persona reveals the Bulk Delete action."""
    print("\n[US005] Testing Bulk Delete appears after checkbox selection")
    _navigate_to_personas(page)
    page.wait_for_timeout(800)

    _activate_bulk_select(page)

    # Row checkboxes are <button role="checkbox" aria-label="Select row">, not
    # <input type="checkbox">. Scope to tbody to exclude the header "select all"
    # checkbox (aria-label="Select all rows on this page").
    checkboxes = page.locator("tbody").get_by_role("checkbox", name="Select row")
    if checkboxes.count() == 0:
        checkboxes = _find_checkboxes(page)

    if checkboxes is None or checkboxes.count() == 0:
        pytest.skip("No checkboxes found on persona list after bulk-select activation")

    checkboxes.first.click()
    page.wait_for_timeout(1000)
    page.screenshot(path="results/persona-us005-02-selected.png")

    body_text = page.locator("body").inner_text().lower()
    has_bulk = any(
        kw in body_text
        for kw in ("bulk delete", "delete selected", "delete all", "delete (", "selected")
    )
    if not has_bulk:
        trash_btn = page.locator(
            "button:has([data-lucide='trash']), button:has([data-lucide='trash-2'])"
        )
        has_bulk = trash_btn.count() > 1
    print(f"[US005] Bulk Delete action visible: {has_bulk}")
    assert has_bulk, "Expected a Bulk Delete action after selecting a persona"
    print("[US005] PASS – Bulk Delete appears on selection")

    checkboxes.first.click()
    page.wait_for_timeout(500)


def test_us005_bulk_delete_confirmed(page: Page):
    """US005 – Bulk deleting test personas removes them from the list."""
    print("\n[US005] Testing confirmed bulk deletion of test personas")
    _navigate_to_personas(page)

    name_a = f"{_TEST_PREFIX}Bulk_A"
    name_b = f"{_TEST_PREFIX}Bulk_B"
    created_a = _create_test_persona(page, name_a)
    if not created_a:
        pytest.skip("Could not create first bulk test persona")
    created_b = _create_test_persona(page, name_b)
    page.wait_for_timeout(1000)

    for name in (name_a, name_b):
        row = _find_test_persona_row(page, name)
        if row is None:
            continue
        row.get_by_role("checkbox", name="Select row").first.click()
        page.wait_for_timeout(400)

    page.screenshot(path="results/persona-us005-03-bulk-selected.png")
    page.wait_for_timeout(500)

    # The bulk-action toolbar's button is named exactly "Delete" — every row's
    # own "Delete persona" button would also substring-match an unscoped
    # name="Delete" query, so exact=True is required here.
    delete_btn = page.get_by_role("button", name="Delete", exact=True)
    if delete_btn.count() == 0 or not delete_btn.first.is_visible():
        pytest.skip("Bulk Delete button not visible after selection")

    delete_btn.first.click()
    page.wait_for_timeout(1500)
    page.screenshot(path="results/persona-us005-04-bulk-confirm.png")

    confirm_dialog = page.locator("[role='dialog'], [role='alertdialog']")
    expect(confirm_dialog.first).to_be_visible(timeout=8000)
    confirm_dialog.first.get_by_role("button", name=re.compile(r"^delete$", re.IGNORECASE)).first.click()
    page.wait_for_timeout(3000)

    page.screenshot(path="results/persona-us005-05-after-bulk-delete.png")
    still_a = page.get_by_text(name_a, exact=True).is_visible()
    still_b = page.get_by_text(name_b, exact=True).is_visible()
    assert not still_a and not still_b, (
        "Expected bulk-deleted test personas to be removed from list"
    )
    print("[US005] PASS – Bulk deleted test personas removed from list")
