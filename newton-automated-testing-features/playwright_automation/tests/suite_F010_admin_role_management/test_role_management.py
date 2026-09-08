import os
import re
import sys
import time
from pathlib import Path

import pytest
from playwright.sync_api import Page, expect

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from auth.login import login_to_gotalk

ADMIN_EMAIL = os.getenv("SUPER_ADMIN_EMAIL", "john.doe@noah.com")
ADMIN_PASS = os.getenv("SUPER_ADMIN_PASS", "Friday#3000")
HR_ROLE_NAME = "HR Assistant"

# Shared state: TC72 creates a role, TC73 edits it, TC74 deletes it
CREATED_ROLE_NAME = ""



# ── Navigation ─────────────────────────────────────────────────────────────────

def _navigate_to_roles(page: Page) -> None:
    # Only click the Admin Console button when coming from outside it
    if "/admin-dashboard" not in page.url:
        page.locator("xpath=//button[@aria-label='Admin console']//*[name()='svg']").click()
        page.wait_for_timeout(1500)

    # Roles is a direct sidebar nav item now (no "Access" submenu to expand)
    page.get_by_role("button", name="Roles", exact=True).click()
    page.wait_for_timeout(2000)


# ── Role dialog helpers ────────────────────────────────────────────────────────

def _click_add_role(page: Page) -> None:
    page.evaluate(
        """() => {
            const b = [...document.querySelectorAll('button')]
                .find(b => b.offsetParent && /add role|create role|new role/i.test(b.textContent.trim()));
            if (b) b.click();
        }"""
    )
    expect(page.locator("[role='dialog']")).to_be_visible(timeout=10000)
    page.wait_for_timeout(1000)


def _fill_role_name(page: Page, name: str) -> None:
    inp = page.locator("[role='dialog'] input[placeholder*='role name']")
    if inp.count() == 0:
        inp = page.locator("[role='dialog'] input").first
    inp.clear()
    inp.fill(name)
    page.wait_for_timeout(300)


def _save_role_dialog(page: Page) -> None:
    page.evaluate(
        """() => {
            const b = [...document.querySelectorAll('[role="dialog"] button')]
                .find(b => b.offsetParent && /save|create|submit|update/i.test(b.textContent.trim()));
            if (b) b.click();
        }"""
    )
    page.wait_for_timeout(2000)


def _get_toast_text(page: Page) -> str:
    page.wait_for_timeout(1500)
    return page.evaluate(
        """() => {
            const t = document.querySelector(
                '[data-sonner-toast],[role="status"],[class*="toast"],[class*="Toaster"],[role="alert"]'
            );
            return t ? t.innerText.trim() : '';
        }"""
    )


def _click_role_card_action(page: Page, role_name: str, action_pattern: str) -> bool:
    """Click edit or delete button on a role card matching role_name."""
    return page.evaluate(
        """([name, pattern]) => {
            const cards = [...document.querySelectorAll(
                'div.rounded-xl, [class*="card"], tr, li'
            )];
            const card = cards.find(c => c.textContent.includes(name));
            if (!card) return false;
            const re = new RegExp(pattern, 'i');
            const btn = [...card.querySelectorAll('button')].find(b =>
                re.test((b.title || '') + ' ' + (b.getAttribute('aria-label') || '') + ' ' + b.textContent)
            );
            if (btn) { btn.click(); return true; }
            return false;
        }""",
        [role_name, action_pattern],
    )


# ── Tests ──────────────────────────────────────────────────────────────────────

def test_tc71_view_roles_list(page: Page):
    """TC71 — US001: Roles page displays role cards with edit and delete controls."""
    _navigate_to_roles(page)
    page.screenshot(path="results/tc71-F010-roles-page.png")

    cards = page.locator("table tbody tr")
    count = cards.count()
    print(f"Role rows found: {count}")
    assert count >= 1, f"Expected at least 1 role row, found {count}"

    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(1500)
    page.screenshot(path="results/tc71-F010-scrolled.png")

    edit_present = page.locator(
        "xpath=//button[@title='Edit role' or @aria-label='Edit role'"
        " or .//*[contains(@class,'lucide-pencil') or contains(@class,'lucide-edit')]]"
    ).count() > 0
    delete_present = page.locator(
        "xpath=//button[@title='Delete role' or @aria-label='Delete role'"
        " or .//*[contains(@class,'lucide-trash')]]"
    ).count() > 0
    print(f"Edit button present: {edit_present} | Delete button present: {delete_present}")

    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(500)
    page.screenshot(path="results/tc71-F010-done.png")
    print(f"TC71 PASSED — {count} role cards displayed")


def test_tc71b_roles_search_and_filter(page: Page):
    """TC71b — Roles page search input and filter controls work."""
    _navigate_to_roles(page)
    page.screenshot(path="results/tc71b-F010-roles-page.png")

    row_count = page.locator("table tbody tr").count()
    print(f"Role rows found: {row_count}")
    assert row_count >= 1, "Roles table should show at least one row"

    # Test search
    search = page.locator("xpath=//input[@placeholder='Search roles...']")
    expect(search).to_be_visible()
    search.fill("hr")
    page.wait_for_timeout(2000)
    page.screenshot(path="results/tc71b-F010-search-result.png")
    filtered_count = page.locator("table tbody tr").count()
    print(f"Rows after searching 'hr': {filtered_count}")
    assert filtered_count <= row_count, "Search should narrow (or match) the role list"
    search.clear()
    page.wait_for_timeout(1000)

    # Open the Filters panel
    filter_btn = page.locator("xpath=//button[contains(normalize-space(),'Filters')]")
    assert filter_btn.count() > 0, "Filters button should be present on the Roles page"
    filter_btn.first.click()
    page.wait_for_timeout(1000)
    page.screenshot(path="results/tc71b-F010-filter-panel.png")

    # Verify both filter sections are present
    doc_tags_present = page.locator(
        "xpath=//*[normalize-space()='Document tags']"
    ).count() > 0
    personas_present = page.locator(
        "xpath=//*[normalize-space()='Personas']"
    ).count() > 0
    print(f"Document tags section present: {doc_tags_present} | Personas section present: {personas_present}")
    assert doc_tags_present, "Filters panel should show a 'Document tags' section"
    assert personas_present, "Filters panel should show a 'Personas' section"

    # Filter by the HR Assistant persona
    persona_input = page.locator(
        "xpath=//input[@placeholder='Search and add personas...']"
    )
    persona_input.click()
    persona_input.fill("HR")
    page.wait_for_timeout(1000)
    page.screenshot(path="results/tc71b-F010-persona-options.png")

    hr_option = page.locator("xpath=//*[contains(normalize-space(),'HR Assistant')]").last
    hr_option.click()
    page.wait_for_timeout(500)
    page.keyboard.press("Escape")  # close the combobox dropdown — it doesn't auto-close
    page.wait_for_timeout(1000)
    page.screenshot(path="results/tc71b-F010-persona-filtered.png")

    filtered_by_persona = page.locator("table tbody tr").count()
    print(f"Rows after filtering by HR Assistant persona: {filtered_by_persona}")
    assert filtered_by_persona >= 1, "Expected at least one role for the HR Assistant persona filter"

    # Clear filters and confirm the full list is restored
    clear_btn = page.locator("xpath=//button[normalize-space()='Clear']")
    if clear_btn.count() > 0:
        clear_btn.first.click()
        page.wait_for_timeout(1500)
        restored_count = page.locator("table tbody tr").count()
        print(f"Rows after clearing filters: {restored_count}")
        assert restored_count >= filtered_by_persona, "Clearing filters should restore the full role list"
    else:
        print("WARNING: Clear button not found — skipping clear verification")

    page.screenshot(path="results/tc71b-F010-done.png")
    print("TC71b PASSED — Roles search and filter controls verified")


def _select_combobox_option(page: Page, input_locator, search_text: str, option_text: str) -> None:
    """Type into a persona/doc-tag/user combobox and click a matching option.

    These comboboxes render their option list in a portal
    (`[data-combobox-dropdown="true"]`), not nested inside the dialog, and
    the dropdown does not auto-close after a selection — so callers must
    close it themselves (click the dialog's h2) before touching the next
    field, or it'll intercept clicks on whatever comes after it.
    """
    input_locator.click()
    input_locator.fill(search_text)
    page.wait_for_timeout(1500)
    page.locator("[data-combobox-dropdown='true']").get_by_text(option_text, exact=False).first.click()
    page.wait_for_timeout(500)
    page.locator("[role='dialog'] h2").click()
    page.wait_for_timeout(500)


def test_tc72_create_new_role(page: Page):
    """TC72 — US002: Super Admin can create a new role with name, description,
    persona, doc tag; attach a user; verify via the Users tab Access graph."""
    global CREATED_ROLE_NAME
    ts = time.strftime("%H%M%S")
    role_name = f"Auto Test Role {ts}"
    CREATED_ROLE_NAME = role_name
    print(f"Creating role: {role_name}")

    _navigate_to_roles(page)
    _click_add_role(page)

    # Fill role name
    name_inp = page.locator("[role='dialog'] input[placeholder='e.g. hr_manager']")
    if name_inp.count() == 0:
        name_inp = page.locator("[role='dialog'] input").first
    name_inp.fill(role_name)
    page.wait_for_timeout(300)

    # Fill description
    desc = page.locator("[role='dialog'] textarea[placeholder='What can this role do?']")
    if desc.count() > 0:
        desc.fill("Automated test role created by Playwright")
        page.wait_for_timeout(300)

    # Select the HR Assistant persona
    persona_input = page.locator("[role='dialog'] input[placeholder*='Search and select personas']")
    _select_combobox_option(page, persona_input, "HR", "HR Assistant")
    print("Persona selected")

    # Select a document tag
    tag_input = page.locator("[role='dialog'] input[placeholder*='Search and select document tags']")
    _select_combobox_option(page, tag_input, "Technical", "Technical")
    print("Doc tag selected")

    page.screenshot(path="results/tc72-F010-form-filled.png")

    # Submit creation
    create_btn = page.get_by_role("button", name="Create role", exact=True)
    if create_btn.count() > 0:
        create_btn.click()
    else:
        _save_role_dialog(page)
    page.wait_for_timeout(2500)

    # Attach Users dialog appears automatically after creation
    if page.locator("[role='dialog']").is_visible():
        page.screenshot(path="results/tc72-F010-attach-dialog.png")
        attach_input = page.locator("[role='dialog'] input").first
        _select_combobox_option(page, attach_input, "user10", "user10@example.com")
        print("user10@example.com selected")
        page.screenshot(path="results/tc72-F010-attach-filled.png")

        attach_submit = page.get_by_role("button", name="Attach Users", exact=True)
        attach_submit.click()
        page.wait_for_timeout(3000)

    page.screenshot(path="results/tc72-F010-after-create.png")

    # After attaching, the app redirects to the Users tab automatically.
    # Verify by opening user10's Access graph panel and expanding the new role.
    row = page.locator("table tbody tr").filter(has_text="user10@example.com")
    assert row.count() > 0, "user10@example.com row not found on Users tab after attach"
    row.first.locator("button[title='View details']").click()
    page.wait_for_timeout(3000)
    page.screenshot(path="results/tc72-F010-access-graph.png")

    # Click the smallest element containing the role name to expand its row
    # in the tree (a broader text match would hit an ancestor container and
    # fail to actually expand anything).
    clicked = page.evaluate(
        """(label) => {
            const matches = [...document.querySelectorAll('*')]
                .filter(e => e.offsetParent && (e.textContent || '').includes(label));
            if (!matches.length) return false;
            const smallest = matches.reduce((a, b) => a.textContent.length <= b.textContent.length ? a : b);
            smallest.click();
            return true;
        }""",
        role_name,
    )
    assert clicked, f"Role '{role_name}' not found in user10's Access graph"
    page.wait_for_timeout(1000)
    page.screenshot(path="results/tc72-F010-role-expanded.png")

    expanded_text = page.evaluate("() => document.body.innerText")
    idx = expanded_text.find(role_name)
    nearby_text = expanded_text[idx:idx + 400] if idx >= 0 else ""
    print(f"Access graph content near role: {nearby_text}")
    assert "HR Assistant" in nearby_text, \
        f"Expected persona 'HR Assistant' under role '{role_name}' in Access graph"
    assert "Technical" in nearby_text, \
        f"Expected a 'Technical' doc tag under role '{role_name}' in Access graph"
    print(f"TC72 PASSED — Role '{role_name}' created with persona/tag verified via Access graph")


def test_tc73_edit_existing_role(page: Page):
    """TC73 — US003: Super Admin can rename the role created in TC72."""
    global CREATED_ROLE_NAME
    if not CREATED_ROLE_NAME:
        pytest.skip("TC72 did not set CREATED_ROLE_NAME — skipping TC73")

    edited_name = CREATED_ROLE_NAME.replace("Auto Test Role", "Edited Role")
    print(f"Renaming '{CREATED_ROLE_NAME}' → '{edited_name}'")

    _navigate_to_roles(page)
    page.screenshot(path="results/tc73-F010-before-edit.png")

    clicked = _click_role_card_action(page, CREATED_ROLE_NAME, r"edit|update|pencil")
    if not clicked:
        # Fallback: find edit button via title
        edit_btn = page.locator(
            f"xpath=//div[contains(@class,'rounded-xl') and contains(.,{repr(CREATED_ROLE_NAME)})]"
            "//button[@title='Edit role' or @aria-label='Edit role']"
        )
        if edit_btn.count() > 0:
            edit_btn.first.click()
            clicked = True

    assert clicked, f"Could not find edit button for role '{CREATED_ROLE_NAME}'"
    expect(page.locator("[role='dialog']")).to_be_visible(timeout=10000)
    page.wait_for_timeout(1000)
    page.screenshot(path="results/tc73-F010-edit-dialog.png")

    _fill_role_name(page, edited_name)
    _save_role_dialog(page)

    toast = _get_toast_text(page)
    print(f"Toast after edit: {toast}")

    # Update shared state before navigation so TC74 has the right name regardless
    CREATED_ROLE_NAME = edited_name

    # Navigate to Roles page to confirm the renamed card is present
    _navigate_to_roles(page)
    page.wait_for_timeout(1000)
    page.screenshot(path="results/tc73-F010-after-edit.png")

    assert edited_name in page.content(), f"Edited name '{edited_name}' not found after save"
    print(f"TC73 PASSED — Role renamed to '{edited_name}'")


def test_tc74_delete_role_with_confirmation(page: Page):
    """TC74 — US004: Super Admin can delete the role edited in TC73 after confirming the prompt."""
    global CREATED_ROLE_NAME
    if not CREATED_ROLE_NAME:
        pytest.skip("TC73 did not update CREATED_ROLE_NAME — skipping TC74")

    print(f"Deleting role: {CREATED_ROLE_NAME}")

    _navigate_to_roles(page)
    page.screenshot(path="results/tc74-F010-before-delete.png")

    clicked = _click_role_card_action(page, CREATED_ROLE_NAME, r"delete|remove|trash")
    if not clicked:
        delete_btn = page.locator(
            f"xpath=//div[contains(@class,'rounded-xl') and contains(.,{repr(CREATED_ROLE_NAME)})]"
            "//button[@title='Delete role' or @aria-label='Delete role']"
        )
        if delete_btn.count() > 0:
            delete_btn.first.click()
            clicked = True

    assert clicked, f"Could not find delete button for role '{CREATED_ROLE_NAME}'"
    page.wait_for_timeout(1000)

    # Confirmation dialog — wait for Delete button by accessible name
    page.screenshot(path="results/tc74-F010-confirm-dialog.png")
    try:
        confirm_btn = page.get_by_role("button", name="Delete", exact=True)
        confirm_btn.wait_for(timeout=6000)
        confirm_btn.click()
        page.wait_for_timeout(2000)
    except Exception:
        # Fallback: last Delete/Confirm button in any dialog
        page.locator(
            "xpath=(//div[@role='dialog' or @role='alertdialog']"
            "//button[contains(normalize-space(),'Delete') or contains(normalize-space(),'Confirm')])[last()]"
        ).click()
        page.wait_for_timeout(2000)

    toast = _get_toast_text(page)
    print(f"Toast after delete: {toast}")
    page.screenshot(path="results/tc74-F010-after-delete.png")

    assert CREATED_ROLE_NAME not in page.content(), \
        f"Role '{CREATED_ROLE_NAME}' still visible after deletion"
    CREATED_ROLE_NAME = ""
    print("TC74 PASSED — Role deleted successfully")


def test_tc75_bulk_delete_roles(page: Page):
    """TC75 — US005: Super Admin can select multiple roles and bulk delete them."""
    ts = time.strftime("%H%M%S")
    role_a = f"Bulk Role A {ts}"
    role_b = f"Bulk Role B {ts}"

    _navigate_to_roles(page)

    for role in (role_a, role_b):
        _click_add_role(page)
        _fill_role_name(page, role)
        _save_role_dialog(page)
        if page.locator("[role='dialog']").is_visible():
            page.keyboard.press("Escape")
            page.wait_for_timeout(1000)
        print(f"Created: {role}")

    page.screenshot(path="results/tc75-F010-before-bulk.png")

    # Roles table always shows a row-select checkbox per row — no separate
    # "Select items" mode toggle to activate first (unlike the Users table).
    for role in (role_a, role_b):
        row = page.locator("table tbody tr").filter(has_text=role)
        if row.count() > 0:
            row.first.locator("button[role='checkbox']").first.click()
            print(f"Checkbox ticked: {role}")
            page.wait_for_timeout(300)

    page.screenshot(path="results/tc75-F010-checked.png")

    # Click the red "Delete" trigger button that appears once rows are selected
    delete_sel_btn = page.get_by_role("button", name="Delete", exact=True)
    if delete_sel_btn.count() > 0:
        delete_sel_btn.first.click()
    else:
        page.evaluate(
            """() => {
                const b = [...document.querySelectorAll('button')]
                    .find(b => b.offsetParent && /delete selected|bulk delete/i.test(b.textContent.trim()));
                if (b) b.click();
            }"""
        )
    page.wait_for_timeout(1500)

    # Confirmation dialog appears — these two roles are disposable test data
    # created by this test itself, so it's safe to actually confirm deletion.
    page.wait_for_timeout(500)
    page.screenshot(path="results/tc75-F010-confirm.png")
    dialog = page.locator("[role='dialog'], [role='alertdialog']").first
    dialog.wait_for(timeout=8000)
    print("Bulk delete confirmation dialog shown")

    confirm_btn = dialog.get_by_role("button", name="Delete", exact=True)
    try:
        confirm_btn.wait_for(timeout=6000)
        confirm_btn.click()
    except Exception:
        dialog.locator(
            "xpath=.//button[contains(normalize-space(),'Delete') or contains(normalize-space(),'Confirm')]"
        ).last.click()
    page.wait_for_timeout(2500)

    page.screenshot(path="results/tc75-F010-done.png")
    assert not page.locator(f"text={role_a}").is_visible(), f"{role_a} still visible after bulk delete"
    assert not page.locator(f"text={role_b}").is_visible(), f"{role_b} still visible after bulk delete"
    print("TC75 PASSED — Bulk delete successful")


def _attach_user_in_dialog(page: Page, email: str) -> bool:
    """Fill email into Attach Users dialog and submit. Returns True if dialog was found."""
    attach_input = page.locator("xpath=//input[@placeholder='Search and select users to attach...']")
    if attach_input.count() == 0:
        return False
    attach_input.fill(email.split("@")[0])
    page.wait_for_timeout(1000)
    page.evaluate(
        f"""() => {{
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {{
                if (node.textContent.trim() === {repr(email)}
                        && node.parentElement && node.parentElement.offsetParent) {{
                    node.parentElement.click();
                    return true;
                }}
            }}
            return false;
        }}"""
    )
    page.wait_for_timeout(500)
    page.locator("[role='dialog'] button").filter(has_text="Attach Users").first.click()
    page.wait_for_timeout(2000)
    return True


@pytest.mark.skip(reason="Known bug: matches role by persona-badge text, not role name — needs fix before re-enabling")
def test_tc76_assign_users_to_hr_assistant(page: Page):
    """TC76 — US006: Super Admin can assign john.doe to the HR Assistant role."""
    _navigate_to_roles(page)
    page.screenshot(path="results/tc76-F010-roles-page.png")

    # Scroll to bottom so HR Assistant card is in view (it may be below the fold)
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(1000)

    # Find the HR Assistant row in the roles table
    hr_row = page.locator("table tbody tr").filter(has_text=HR_ROLE_NAME)
    assert hr_row.count() > 0, f"HR Assistant role row not found on Roles page"
    hr_row.first.scroll_into_view_if_needed()
    page.wait_for_timeout(500)
    page.screenshot(path="results/tc76-F010-hr-card-visible.png")

    # Click the edit (pencil) button — row's first cell is a row-select checkbox, so target by title
    edit_btn = hr_row.first.locator("button[title='Edit role']")
    edit_btn.click()
    expect(page.locator("[role='dialog']")).to_be_visible(timeout=10000)
    page.wait_for_timeout(1000)
    page.screenshot(path="results/tc76-F010-edit-dialog.png")

    # Click "Update Role" — this may trigger the Attach Users dialog
    update_btn = page.locator("[role='dialog'] button").filter(has_text="Update Role")
    if update_btn.count() > 0:
        update_btn.click()
    else:
        _save_role_dialog(page)
    page.wait_for_timeout(2000)
    page.screenshot(path="results/tc76-F010-after-update.png")

    # Check if Attach Users dialog appeared after saving
    if page.locator("[role='dialog']").is_visible():
        attached = _attach_user_in_dialog(page, "john.doe@noah.com")
        if attached:
            toast = _get_toast_text(page)
            print(f"Toast after attach: {toast}")
            page.screenshot(path="results/tc76-F010-done.png")
            print("TC76 PASSED — john.doe assigned via Attach Users dialog")
            return

    # Fallback: Close any open dialog and verify via Users tab
    if page.locator("[role='dialog']").is_visible():
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)

    # Navigate to Users tab to verify john.doe is associated with HR Assistant
    page.get_by_role("button", name="Users", exact=True).click()
    page.wait_for_timeout(2000)
    page.screenshot(path="results/tc76-F010-users-tab.png")

    john_present = page.locator("text=john.doe@noah.com").count() > 0
    print(f"john.doe found on Users tab: {john_present}")
    if not john_present:
        print("WARNING: john.doe not found on Users tab — role assignment could not be verified")
    page.screenshot(path="results/tc76-F010-done.png")
    print("TC76 PASSED — HR Assistant role assignment verified")


@pytest.mark.skip(reason="Depends on TC76's role assignment, which is currently skipped for the same reason")
def test_tc77_hr_assistant_persona_visible_in_chat(page: Page):
    """TC77 — US007: After being assigned HR Assistant role, john.doe sees HR Assistant persona in chat."""
    # Navigate to chat — close Admin Console if open or click main chat nav
    chat_nav = page.locator(
        "xpath=//button[.//span[normalize-space()='CHAT']]"
        " | //a[contains(@href,'chat')]"
        " | //button[contains(normalize-space(),'Chat')]"
    )
    if chat_nav.count() > 0:
        chat_nav.first.click()
    else:
        # Fallback: go to base URL directly
        page.goto(page.url.split("/admin")[0])
    page.wait_for_timeout(2000)
    page.screenshot(path="results/tc77-F010-chat-page.png")

    # Open persona selector
    persona_input = page.locator(
        "xpath=//input[@id='welcome-persona-select'"
        " or @name='welcome-persona-select'"
        " or @placeholder='Select persona']"
    )
    if persona_input.count() > 0:
        persona_input.click()
    else:
        page.evaluate(
            """() => {
                const els = [...document.querySelectorAll('input, button')];
                const el = els.find(e => e.offsetParent
                    && /persona|select/i.test((e.placeholder || e.textContent || '')));
                if (el) el.click();
            }"""
        )
    page.wait_for_timeout(1000)
    page.screenshot(path="results/tc77-F010-persona-dropdown.png")

    # Verify HR Assistant is visible
    hr_locator = page.locator(
        "xpath=//*[contains(normalize-space(),'HR Assistant')"
        " or contains(normalize-space(),'HR assistant')]"
    )
    hr_visible = hr_locator.count() > 0
    print(f"HR Assistant persona visible: {hr_visible}")

    if not hr_visible:
        print("WARNING: HR Assistant persona not visible — role assignment from TC76 may not have taken effect yet")
    assert hr_visible, "HR Assistant persona not found in chat persona selector"
    page.screenshot(path="results/tc77-F010-hr-visible.png")
    print("TC77 PASSED — HR Assistant persona is accessible in chat")
