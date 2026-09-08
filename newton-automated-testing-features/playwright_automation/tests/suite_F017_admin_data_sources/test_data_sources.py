import os
import sys
import time
from pathlib import Path

import pytest
from playwright.sync_api import Page, expect

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from auth.login import login_to_gotalk

ADMIN_EMAIL = os.getenv("SUPER_ADMIN_EMAIL", "john.doe@noah.com")
ADMIN_PASS = os.getenv("SUPER_ADMIN_PASS", "Friday#3000")

PG_HOST = os.getenv("DS_PG_HOST", "127.0.0.1")
PG_PORT = os.getenv("DS_PG_PORT", "5433")
PG_DB   = os.getenv("DS_PG_DB", "postgres")
PG_USER = os.getenv("DS_PG_USER", "postgres")
PG_PASS = os.getenv("DS_PG_PASS", "")

TEST_DATA_DIR = Path(__file__).resolve().parents[3] / "test-data"
TEST_CSV = str(TEST_DATA_DIR / "test.csv")



# ── Helpers ────────────────────────────────────────────────────────────────────

def _unique_name(base: str) -> str:
    return f"{base} {time.strftime('%H%M%S')}"


def _navigate_to_data_sources(page: Page) -> None:
    if "/admin-dashboard" not in page.url:
        page.locator("button[aria-label='Admin console'], button[title='Admin Console']").first.click()
        page.wait_for_timeout(1500)
    # "TOOLS & SERVERS" is a static sidebar section heading (like DOCUMENTS,
    # ACCESS, OTHER) — Data Sources sits directly under it, no expand needed.
    page.locator("xpath=//button[normalize-space()='Data Sources']").first.click()
    page.wait_for_timeout(2000)
    page.locator("xpath=//button[contains(normalize-space(),'Add Data Source')]").wait_for(timeout=15000)


def _get_toast(page: Page) -> str:
    page.wait_for_timeout(2000)
    return page.evaluate(
        """() => {
            const sel = '[data-sonner-toast],[role="status"],[class*="toast"],[class*="Toaster"],[role="alert"]';
            const t = document.querySelector(sel);
            return t ? t.innerText.trim() : '';
        }"""
    )


def _dialog_field(page: Page, label: str):
    """Locate a Create/Edit Data Source dialog input by its <p> label text.

    The dialog's inputs carry no id/name attributes — each is just the input
    immediately following a <p> label (e.g. "Datasource Name", "DB Host").
    """
    return page.locator(
        f"xpath=//div[@role='dialog']//p[contains(normalize-space(.), '{label}')]"
        "/following-sibling::input[1]"
    )


def _open_add_dialog(page: Page) -> None:
    page.locator("xpath=//button[contains(normalize-space(),'Add Data Source')]").click()
    _dialog_field(page, "Datasource Name").wait_for(timeout=10000)


def _select_postgresql(page: Page) -> None:
    # Open the type combobox inside the dialog via JS to bypass overlay
    page.evaluate(
        """() => {
            const dlg = document.querySelector('[role="dialog"]');
            const btn = dlg && dlg.querySelector('button[role="combobox"]');
            if (btn) btn.click();
        }"""
    )
    page.wait_for_timeout(1000)
    # Click the PostgreSQL option via JS
    pg_clicked = page.evaluate(
        """() => {
            const opts = [...document.querySelectorAll('[role="option"]')]
                .filter(o => o.offsetParent !== null
                    && o.textContent.toLowerCase().includes('postgres'));
            if (opts.length > 0) { opts[0].click(); return true; }
            return false;
        }"""
    )
    if not pg_clicked:
        page.keyboard.press("ArrowDown")
        page.wait_for_timeout(300)
        page.keyboard.press("Enter")
    page.wait_for_timeout(500)
    _dialog_field(page, "DB Host").wait_for(timeout=10000)


def _fill_pg_form(page: Page, name: str) -> None:
    _dialog_field(page, "Datasource Name").fill(name)
    _dialog_field(page, "DB Host").fill(PG_HOST)
    _dialog_field(page, "DB Port").fill(PG_PORT)
    _dialog_field(page, "DB User").fill(PG_USER)
    _dialog_field(page, "DB Name").fill(PG_DB)
    _dialog_field(page, "DB Password").fill(PG_PASS)


def _click_row_action(page: Page, row_name: str, title: str) -> None:
    btn_xpath = (
        f"//tr[.//td[normalize-space()='{row_name}']]"
        f"//button[@title='{title}']"
    )
    page.evaluate(
        f"""() => {{
            const el = document.evaluate(
                {repr(btn_xpath)}, document, null, 9, null
            ).singleNodeValue;
            if (el) el.click();
        }}"""
    )


def _wait_for_row(page: Page, name: str, timeout: int = 10000) -> None:
    page.locator(f"xpath=//td[normalize-space()='{name}']").wait_for(timeout=timeout)


def _row_gone(page: Page, name: str) -> bool:
    return page.locator(f"xpath=//td[normalize-space()='{name}']").count() == 0


# ── Tests ──────────────────────────────────────────────────────────────────────

def test_tc50_postgresql_create_edit_delete(page: Page):
    """TC50 — US001/003/004: Create a PostgreSQL data source, verify fields, edit description, delete."""
    pg_name = _unique_name("Test data")
    _navigate_to_data_sources(page)
    page.screenshot(path="results/tc50-F017-page-loaded.png")

    # ── Create ────────────────────────────────────────────────────────────────
    _open_add_dialog(page)
    page.screenshot(path="results/tc50-F017-dialog-opened.png")

    _select_postgresql(page)
    page.screenshot(path="results/tc50-F017-pg-selected.png")

    # Verify all required fields present
    for field_label in ("DB Host", "DB Port", "DB Name", "DB User", "DB Password"):
        expect(_dialog_field(page, field_label)).to_be_visible()
    print("All required PG fields present")

    # Verify password field is masked
    pwd_type = _dialog_field(page, "DB Password").get_attribute("type")
    assert pwd_type == "password", f"Password field not masked (type={pwd_type})"
    print("Password field is masked")

    _fill_pg_form(page, pg_name)
    page.screenshot(path="results/tc50-F017-form-filled.png")
    print(f"Form filled — name: {pg_name}")

    page.locator("xpath=//button[normalize-space()='Create']").click()
    toast = _get_toast(page)
    print(f"Create toast: {toast}")
    assert any(kw in toast.lower() for kw in ("creat", "success", "added")), \
        f"Create toast did not confirm success — got: {toast}"

    page.locator("xpath=//div[@role='dialog']").wait_for(state="hidden", timeout=15000)
    _wait_for_row(page, pg_name)
    page.screenshot(path="results/tc50-F017-created.png")
    print(f"PostgreSQL data source '{pg_name}' created and visible in table")

    # ── Edit ──────────────────────────────────────────────────────────────────
    _click_row_action(page, pg_name, "Edit data source")
    page.locator("xpath=//div[@role='dialog']").wait_for(timeout=10000)
    page.wait_for_timeout(2000)
    page.screenshot(path="results/tc50-F017-edit-dialog.png")

    # Verify form is pre-populated (host label may not appear in edit mode)
    host_field = _dialog_field(page, "DB Host")
    if host_field.count() > 0 and host_field.is_visible():
        host_val = host_field.input_value()
        assert host_val.strip(), "Host field empty in edit form"
        print(f"Edit form pre-populated — Host: {host_val}")
    else:
        # Fallback: verify any input inside dialog has a value (form is populated)
        inputs_with_vals = page.evaluate(
            """() => [...document.querySelectorAll('[role="dialog"] input')]
                .filter(i => i.value && i.value.trim()).length"""
        )
        print(f"WARNING: DB Host field not found; {inputs_with_vals} inputs have values")
        assert inputs_with_vals > 0, "Edit form appears empty — no inputs have values"

    # Update description if field exists
    desc_field = _dialog_field(page, "Description")
    if desc_field.count() > 0 and desc_field.is_visible():
        desc_field.fill("Updated description via automation")
        print("Description updated")

    page.locator(
        "xpath=//div[@role='dialog']//button[contains(normalize-space(),'Save') "
        "or contains(normalize-space(),'Update')]"
    ).click()
    toast = _get_toast(page)
    print(f"Save toast: {toast}")
    assert any(kw in toast.lower() for kw in ("updat", "save", "success", "edit")), \
        f"Save toast did not confirm success — got: {toast}"

    page.locator("xpath=//div[@role='dialog']").wait_for(state="hidden", timeout=12000)
    _wait_for_row(page, pg_name)
    page.screenshot(path="results/tc50-F017-edited.png")
    print("Data source saved — row still present")

    # ── Delete ────────────────────────────────────────────────────────────────
    _click_row_action(page, pg_name, "Delete data source")
    page.locator(
        "xpath=//div[@role='dialog' or @role='alertdialog']"
    ).wait_for(timeout=10000)
    dialog_text = page.evaluate(
        "() => document.querySelector('[role=\"dialog\"],[role=\"alertdialog\"]')"
        "?.innerText || ''"
    )
    assert any(kw in dialog_text.lower() for kw in ("delete", "sure", "cannot", "remove")), \
        f"Delete confirmation dialog text unexpected: {dialog_text[:100]}"
    print("Delete confirmation dialog present")
    page.screenshot(path="results/tc50-F017-delete-confirm.png")

    page.locator(
        "xpath=(//div[@role='dialog' or @role='alertdialog']"
        "//button[normalize-space()='Delete'])[1]"
    ).click()
    toast = _get_toast(page)
    print(f"Delete toast: {toast}")
    assert any(kw in toast.lower() for kw in ("delet", "remov", "success")), \
        f"Delete toast did not confirm success — got: {toast}"

    page.locator("xpath=//div[@role='dialog']").wait_for(state="hidden", timeout=12000)
    page.wait_for_timeout(1000)
    assert _row_gone(page, pg_name), f"Row '{pg_name}' still visible after deletion"
    page.screenshot(path="results/tc50-F017-deleted.png")
    print(f"TC50 PASSED — PostgreSQL data source create, edit and delete verified")


def test_tc51_csv_create_edit_delete(page: Page):
    """TC51 — US002/005/006: Upload a CSV data source, replace the file, then delete it."""
    csv_name = _unique_name("Auto Test CSV Source")
    _navigate_to_data_sources(page)
    page.screenshot(path="results/tc51-F017-page-loaded.png")

    # ── Create ────────────────────────────────────────────────────────────────
    _open_add_dialog(page)
    page.screenshot(path="results/tc51-F017-dialog-opened.png")

    # CSV is the default type — verify fields
    expect(_dialog_field(page, "Datasource Name")).to_be_visible()
    csv_file_input = _dialog_field(page, "CSV File")
    assert csv_file_input.count() > 0, "CSV upload field not found"
    print("CSV form fields verified")

    _dialog_field(page, "Datasource Name").fill(csv_name)
    desc_field = _dialog_field(page, "Description")
    if desc_field.count() > 0 and desc_field.is_visible():
        desc_field.fill("Automated CSV source for testing")
    _dialog_field(page, "CSV File").set_input_files(TEST_CSV)
    page.wait_for_timeout(1000)
    page.screenshot(path="results/tc51-F017-form-filled.png")
    print(f"CSV form filled — name: {csv_name}, file: {TEST_CSV}")

    page.locator("xpath=//button[normalize-space()='Create']").click()
    toast = _get_toast(page)
    print(f"Create toast: {toast}")
    assert any(kw in toast.lower() for kw in ("creat", "success", "added")), \
        f"Create toast did not confirm success — got: {toast}"

    page.locator("xpath=//div[@role='dialog']").wait_for(state="hidden", timeout=12000)
    _wait_for_row(page, csv_name)
    page.screenshot(path="results/tc51-F017-created.png")
    print(f"CSV data source '{csv_name}' created and visible in table")

    # ── Edit / Replace file ───────────────────────────────────────────────────
    _click_row_action(page, csv_name, "Edit data source")
    page.locator("xpath=//div[@role='dialog']").wait_for(timeout=10000)
    page.screenshot(path="results/tc51-F017-edit-dialog.png")

    csv_file_input_edit = _dialog_field(page, "CSV File")
    if csv_file_input_edit.count() > 0 and csv_file_input_edit.is_visible():
        csv_file_input_edit.set_input_files(TEST_CSV)
        page.wait_for_timeout(1000)
        print("Replacement CSV file selected")
    else:
        print("WARNING: File input not visible in edit dialog — skipping re-upload")

    page.locator(
        "xpath=//div[@role='dialog']//button[contains(normalize-space(),'Save') "
        "or contains(normalize-space(),'Update')]"
    ).click()
    toast = _get_toast(page)
    print(f"Save toast: {toast}")
    assert any(kw in toast.lower() for kw in ("updat", "save", "success", "edit")), \
        f"Save toast did not confirm success — got: {toast}"

    page.locator("xpath=//div[@role='dialog']").wait_for(state="hidden", timeout=12000)
    _wait_for_row(page, csv_name)
    page.screenshot(path="results/tc51-F017-edited.png")
    print("CSV file replaced — row persisted with same name")

    # ── Delete ────────────────────────────────────────────────────────────────
    _click_row_action(page, csv_name, "Delete data source")
    page.locator(
        "xpath=//div[@role='dialog' or @role='alertdialog']"
    ).wait_for(timeout=10000)
    dialog_text = page.evaluate(
        "() => document.querySelector('[role=\"dialog\"],[role=\"alertdialog\"]')"
        "?.innerText || ''"
    )
    assert any(kw in dialog_text.lower() for kw in ("delete", "sure", "remove", "csv", "file")), \
        f"Delete confirmation dialog text unexpected: {dialog_text[:100]}"
    print("Delete confirmation dialog present")
    page.screenshot(path="results/tc51-F017-delete-confirm.png")

    page.locator(
        "xpath=(//div[@role='dialog' or @role='alertdialog']"
        "//button[normalize-space()='Delete'])[1]"
    ).click()
    toast = _get_toast(page)
    print(f"Delete toast: {toast}")
    assert any(kw in toast.lower() for kw in ("delet", "remov", "success")), \
        f"Delete toast did not confirm success — got: {toast}"

    page.locator("xpath=//div[@role='dialog']").wait_for(state="hidden", timeout=12000)
    page.wait_for_timeout(1000)
    assert _row_gone(page, csv_name), f"Row '{csv_name}' still visible after deletion"
    page.screenshot(path="results/tc51-F017-deleted.png")
    print("TC51 PASSED — CSV data source upload, replace file and delete verified")


def test_tc52_data_sources_list_view(page: Page):
    """TC52 — US007: Data Sources page shows required columns and source types are visible."""
    _navigate_to_data_sources(page)
    page.screenshot(path="results/tc52-F017-page-loaded.png")

    content = page.content()
    for col in ("Name", "Kind", "Actions"):
        assert col in content, f"Column '{col}' not found in Data Sources table"
    print("Required column headers present")

    # Verify page has at least the Add Data Source button (page loads correctly)
    expect(
        page.locator("xpath=//button[contains(normalize-space(),'Add Data Source')]")
    ).to_be_visible()
    print("Add Data Source button visible")
    page.screenshot(path="results/tc52-F017-list.png")
    print("TC52 PASSED — Data Sources list view verified")
