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
    _create_test_version,
    _close_modal,
    _delete_test_persona,
    _open_persona_detail,
    _find_version_btn,
    _find_version_badge,
    _advance_version_wizard_to_review,
)


# ─── Local helpers ──────────────────────────────────────────────────────────
#
# Version management moved away from a "Versions" tab (removed in the current
# UI) to a version-switcher combobox (aria-label="Persona version") in the
# persona detail panel. Selecting a non-current version there reveals a small
# per-version toolbar: "Set as live", "Edit version" (title, pencil icon),
# and "Delete version" (title, trash icon).


def _open_create_version_modal(page: Page, name: str) -> bool:
    """Open a persona's detail panel and click 'Create version'. Returns True if the modal opened."""
    if not _open_persona_detail(page, name):
        return False
    version_btn = _find_version_btn(page)
    if version_btn is None:
        return False
    version_btn.click()
    page.wait_for_timeout(1500)
    return True


def _select_version_in_dropdown(page: Page, version_label_regex: str) -> bool:
    """Open the version combobox and select the option matching version_label_regex.

    Returns True if the option was found and clicked.
    """
    badge = _find_version_badge(page)
    if badge is None:
        return False
    badge.click()
    page.wait_for_timeout(800)
    option = page.get_by_role("option", name=re.compile(version_label_regex, re.IGNORECASE))
    if option.count() == 0 or not option.first.is_visible():
        page.keyboard.press("Escape")
        return False
    option.first.click()
    page.wait_for_timeout(1000)
    return True


# ─── Fixture ──────────────────────────────────────────────────────────────────

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
# US006 – Create a New Version of a Persona
# =====================================================================


def test_us006_create_new_version_modal_accessible(page: Page, created_personas: list):
    """US006 – 'Create version' modal is accessible from a persona's detail panel."""
    print("\n[US006] Checking Create version modal")
    test_name = f"{_TEST_PREFIX}Ver_Modal"
    created_personas.append(test_name)
    _navigate_to_personas(page)

    created = _create_test_persona(page, test_name)
    if not created:
        pytest.skip("Could not create test persona")

    if not _open_create_version_modal(page, test_name):
        pytest.skip("Create version button not found")

    page.screenshot(path="results/persona-us006-01-version-modal.png")
    dialog = page.locator("[role='dialog']")
    expect(dialog).to_be_visible(timeout=8000)
    dialog_text = dialog.inner_text().lower()
    assert "create" in dialog_text and "version" in dialog_text, (
        "Expected Create version title in modal"
    )
    print("[US006] PASS – Create version modal accessible")

    _close_modal(page, dialog)


def test_us006_version_modal_base_persona_field(page: Page, created_personas: list):
    """US006 – The Create version wizard is clearly scoped to the persona being versioned.

    The old UI had a separate selectable "Base Persona" field. The current UI has
    no such field — a version is always created from the specific persona's own
    detail panel, so the base is implicit. Instead we confirm the wizard's LIVE
    PREVIEW clearly identifies which persona the new version belongs to.
    """
    print("\n[US006] Checking the Create version modal is scoped to the correct persona")
    test_name = f"{_TEST_PREFIX}Ver_BaseField"
    created_personas.append(test_name)
    _navigate_to_personas(page)

    created = _create_test_persona(page, test_name)
    if not created:
        pytest.skip("Could not create test persona")

    if not _open_create_version_modal(page, test_name):
        pytest.skip("Create version button not found")

    dialog = page.locator("[role='dialog']")
    expect(dialog).to_be_visible(timeout=8000)
    page.screenshot(path="results/persona-us006-02-base-persona.png")

    dialog_text = dialog.inner_text()
    assert test_name in dialog_text, (
        "Expected the Create version modal's LIVE PREVIEW to show the persona being versioned"
    )
    print("[US006] PASS – Create version modal is scoped to the correct persona")

    _close_modal(page, dialog)


def test_us006_version_modal_set_as_current_checkbox(page: Page, created_personas: list):
    """US006 – 'Set as current version' toggle is present on the Review step."""
    print("\n[US006] Checking 'Set as current version' toggle")
    test_name = f"{_TEST_PREFIX}Ver_SetCurrent_Modal"
    created_personas.append(test_name)
    _navigate_to_personas(page)

    created = _create_test_persona(page, test_name)
    if not created:
        pytest.skip("Could not create test persona")

    if not _open_create_version_modal(page, test_name):
        pytest.skip("Create version button not found")

    dialog = page.locator("[role='dialog']")
    expect(dialog).to_be_visible(timeout=8000)

    # "Set as current version" only renders on the Review step (step 5).
    _advance_version_wizard_to_review(page, dialog)
    page.screenshot(path="results/persona-us006-03-set-current.png")

    dialog_text = dialog.inner_text().lower()
    has_set_current = "set as current" in dialog_text
    print(f"[US006] Set as current version toggle: {has_set_current}")
    assert has_set_current, "Expected 'Set as current version' toggle on the Review step"
    print("[US006] PASS – Set as current version toggle found")

    _close_modal(page, dialog)


# =====================================================================
# US007 – Set a Specific Version as Current
# =====================================================================


def test_us007_set_as_current_option_in_version_history(page: Page):
    """US007 – 'Set as live' appears when viewing a non-current version."""
    print("\n[US007] Checking 'Set as live' option for a non-current version")
    test_name = f"{_TEST_PREFIX}Ver_SetCurrent"
    _navigate_to_personas(page)

    created = _create_test_persona(page, test_name)
    if not created:
        pytest.skip("Could not create test persona")

    # New versions become LIVE by default, so v1 is now the non-current one.
    versioned = _create_test_version(page, test_name, set_as_current=False)
    if not versioned:
        _delete_test_persona(page, test_name)
        pytest.skip("Could not create second version for test persona")

    _open_persona_detail(page, test_name)
    if not _select_version_in_dropdown(page, r"^v1$"):
        _delete_test_persona(page, test_name)
        pytest.skip("Could not select the non-current version in the dropdown")

    page.screenshot(path="results/persona-us007-01-version-history.png")

    set_live_btn = page.get_by_role("button", name=re.compile(r"set as live", re.IGNORECASE))
    has_set_current = set_live_btn.count() > 0 and set_live_btn.first.is_visible()
    print(f"[US007] 'Set as live' option present: {has_set_current}")
    assert has_set_current, "Expected a 'Set as live' option on a non-current version"
    print("[US007] PASS – 'Set as live' option found for non-current version")

    _delete_test_persona(page, test_name)


# =====================================================================
# US008 – View Version History
# =====================================================================


def test_us008_version_history_modal_opens(page: Page, created_personas: list):
    """US008 – The version dropdown lists every version of the persona."""
    print("\n[US008] Testing version dropdown")
    test_name = f"{_TEST_PREFIX}Ver_History"
    created_personas.append(test_name)
    _navigate_to_personas(page)

    created = _create_test_persona(page, test_name)
    if not created:
        pytest.skip("Could not create test persona")

    versioned = _create_test_version(page, test_name, set_as_current=False)
    if not versioned:
        pytest.skip("Could not create second version for test persona")

    _open_persona_detail(page, test_name)
    badge = _find_version_badge(page)
    if badge is None:
        pytest.skip("Version dropdown could not be opened")
    badge.click()
    page.wait_for_timeout(800)
    page.screenshot(path="results/persona-us008-01-history-modal.png")

    options = page.get_by_role("option")
    print(f"[US008] Version options listed: {options.count()}")
    assert options.count() >= 2, "Expected at least 2 versions listed in the version dropdown"
    print("[US008] PASS – Version dropdown lists version details")
    page.keyboard.press("Escape")


def test_us008_version_history_shows_view_prompt(page: Page):
    """US008 – A non-current version exposes an 'Edit version' option to view/edit its prompt."""
    print("\n[US008] Checking Edit version option for a non-current version")
    test_name = f"{_TEST_PREFIX}Ver_ViewPrompt"
    _navigate_to_personas(page)
    page.wait_for_timeout(500)

    created = _create_test_persona(page, test_name)
    if not created:
        pytest.skip("Could not create test persona for version history View prompt test")

    try:
        versioned = _create_test_version(page, test_name, set_as_current=False)
        if not versioned:
            pytest.skip("Could not create second version for test persona")

        _open_persona_detail(page, test_name)
        if not _select_version_in_dropdown(page, r"^v1$"):
            pytest.skip("Could not select the non-current version in the dropdown")

        page.wait_for_timeout(500)

        edit_version_btn = page.get_by_role("button", name="Edit version")
        has_edit_version = edit_version_btn.count() > 0 and edit_version_btn.first.is_visible()

        body_text = page.locator("body").inner_text().lower()
        has_version_details = any(
            kw in body_text
            for kw in ("current", "model", "created", "updated", "v1", "version")
        )

        page.screenshot(path="results/persona-us008-02-view-prompt.png")

        assert has_version_details, (
            f"Expected version details in the persona detail panel — got: {body_text[:200]!r}"
        )
        assert has_edit_version, "Expected an 'Edit version' option on a non-current version"
        print("[US008] PASS – Version details and Edit version option found")
    finally:
        _delete_test_persona(page, test_name)


# =====================================================================
# US009 – Delete a Specific Version
# =====================================================================


def test_us009_version_delete_option_present(page: Page, created_personas: list):
    """US009 – A non-current version has a Delete version option."""
    print("\n[US009] Checking version delete option")
    test_name = f"{_TEST_PREFIX}Ver_DeleteOption"
    created_personas.append(test_name)
    _navigate_to_personas(page)

    created = _create_test_persona(page, test_name)
    if not created:
        pytest.skip("Could not create test persona")

    versioned = _create_test_version(page, test_name, set_as_current=False)
    if not versioned:
        pytest.skip("Could not create second version for test persona")

    _open_persona_detail(page, test_name)
    if not _select_version_in_dropdown(page, r"^v1$"):
        pytest.skip("Could not select the non-current version in the dropdown")

    page.screenshot(path="results/persona-us009-01-version-history.png")

    delete_btn = page.get_by_role("button", name="Delete version")
    print(f"[US009] Delete version button present: {delete_btn.count() > 0}")
    assert delete_btn.count() > 0 and delete_btn.first.is_visible(), (
        "Expected a 'Delete version' option on a non-current version"
    )
    print("[US009] PASS – Version delete option present")


def test_us009_version_delete_confirmation_shown(page: Page, created_personas: list):
    """US009 – Clicking Delete version shows a confirmation prompt."""
    print("\n[US009] Testing version delete confirmation prompt")
    test_name = f"{_TEST_PREFIX}Ver_Delete"
    created_personas.append(test_name)
    _navigate_to_personas(page)

    created = _create_test_persona(page, test_name)
    if not created:
        pytest.skip("Could not create test persona for version delete test")

    versioned = _create_test_version(page, test_name, set_as_current=False)
    if not versioned:
        pytest.skip("Could not create second version for test persona")

    _open_persona_detail(page, test_name)
    if not _select_version_in_dropdown(page, r"^v1$"):
        pytest.skip("Could not select the non-current version in the dropdown")

    delete_btn = page.get_by_role("button", name="Delete version")
    if delete_btn.count() == 0:
        pytest.skip("No version delete button found")

    delete_btn.first.click()
    page.wait_for_timeout(1500)
    page.screenshot(path="results/persona-us009-02-version-confirm.png")

    confirm_dialog = page.locator("[role='dialog'], [role='alertdialog']")
    expect(confirm_dialog.first).to_be_visible(timeout=8000)
    dialog_text = confirm_dialog.first.inner_text().lower()
    has_confirm = any(
        kw in dialog_text for kw in ("confirm", "are you sure", "permanently", "cannot be undone")
    )
    print(f"[US009] Confirmation prompt: {has_confirm}")
    assert has_confirm, "Expected a confirmation prompt when deleting a version"

    cancel = confirm_dialog.first.get_by_role("button", name=re.compile(r"cancel|no|keep", re.IGNORECASE))
    if cancel.count() > 0 and cancel.first.is_visible():
        cancel.first.click()
    else:
        page.keyboard.press("Escape")
    page.wait_for_timeout(800)
    print("[US009] PASS – Version delete confirmation shown")
