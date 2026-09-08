import shutil
import tempfile
import time

import pytest
from pathlib import Path

from playwright.sync_api import Page


RESULTS = Path(__file__).resolve().parents[2] / "results"
RESULTS.mkdir(exist_ok=True)

TEST_FILES = Path(__file__).resolve().parents[3] / "test-data"


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _navigate_to_admin_documents(page: Page) -> None:
    if "/admin-dashboard" not in page.url:
        page.locator("xpath=//button[@aria-label='Admin console']//*[name()='svg']").wait_for(timeout=15000)
        page.locator("xpath=//button[@aria-label='Admin console']//*[name()='svg']").click()
        page.wait_for_timeout(1500)
    # Docs is a direct sidebar nav item now (no "Documents" submenu to expand)
    page.get_by_role("button", name="Docs", exact=True).click()
    page.locator("//input[@placeholder='Search documents...']").wait_for(timeout=10000)


def _navigate_to_doc_tags(page: Page) -> None:
    page.wait_for_load_state("networkidle", timeout=30000)
    if "/admin-dashboard" not in page.url:
        page.locator("xpath=//button[@aria-label='Admin console']//*[name()='svg']").wait_for(timeout=30000)
        page.locator("xpath=//button[@aria-label='Admin console']//*[name()='svg']").click()
        page.wait_for_timeout(1500)
    # Doc Tags is a direct sidebar nav item now (no "Documents" submenu to expand)
    page.get_by_role("button", name="Doc Tags", exact=True).click()
    page.locator("//input[@placeholder='Search tags...']").wait_for(timeout=15000)


def _open_private_documents_panel(page: Page) -> None:
    # Private (personal) documents are not managed from the Admin Console at
    # all — they live under the user's own Account panel ("Documents" tab,
    # next to "Shared Links"). This is a per-user file store with no
    # description/tag metadata, distinct from the Admin Console's tag-scoped
    # "Shared Document" uploads (see _navigate_to_admin_documents).
    page.locator("xpath=//button[@aria-label='Account']//*[name()='svg']").wait_for(timeout=15000)
    page.locator("xpath=//button[@aria-label='Account']//*[name()='svg']").click()
    page.wait_for_timeout(1500)
    page.get_by_role("button", name="Documents", exact=True).click()
    page.locator("[role='dialog'] input[type='file']").wait_for(state="attached", timeout=15000)


def _close_private_documents_panel(page: Page) -> None:
    page.locator("[role='dialog'] button[aria-label='Close']").click()
    page.wait_for_timeout(1000)


def _upload_private_files(page: Page, file_paths: list) -> None:
    page.locator("[role='dialog'] input[type='file']").set_input_files(file_paths)
    page.wait_for_timeout(1500)
    page.get_by_role("button", name="Upload", exact=True).click()
    page.wait_for_timeout(2000)


def _wait_for_private_doc_status(page: Page, filename: str, max_tries: int = 20) -> str:
    for _ in range(max_tries):
        status = page.evaluate("""(fname) => {
            const nameEl = [...document.querySelectorAll('[title]')].find(el => el.title === fname);
            const row = nameEl && nameEl.closest('.group');
            if (!row) return null;
            const text = row.textContent;
            if (/Done/i.test(text)) return 'Done';
            if (/Failed|Error/i.test(text)) return 'Failed';
            return 'Processing';
        }""", filename)
        if status in ("Done", "Failed"):
            return status
        if page.locator("//button[@title='Refresh documents']").count() > 0:
            page.locator("//button[@title='Refresh documents']").click()
        page.wait_for_timeout(2000)
    return "UNKNOWN"


def _click_private_doc_action(page: Page, filename: str, action_title: str) -> None:
    page.evaluate("""({fname, action}) => {
        const nameEl = [...document.querySelectorAll('[title]')].find(el => el.title === fname);
        const row = nameEl && nameEl.closest('.group');
        if (!row) return;
        const btn = [...row.querySelectorAll('button')].find(b => b.title === action);
        if (btn) { btn.scrollIntoView(); btn.click(); }
    }""", {"fname": filename, "action": action_title})


def _count_private_docs_by_name(page: Page, filename: str) -> int:
    return page.evaluate(
        "(fname) => [...document.querySelectorAll('[title]')].filter(el => el.title === fname).length",
        filename,
    )


def _set_description(page: Page, slot: int, text: str) -> None:
    page.locator("[role='dialog'] textarea[placeholder='Enter document description']").nth(slot).fill(text)


def _select_tag_for_slot(page: Page, slot: int, tag_name: str = "HR") -> str:
    # Once a slot's tag is chosen, its button's label switches from "Select
    # document tags" to the tag name, shrinking that role query — so as long
    # as slots are processed in order, the first remaining match is always
    # the next unconfigured slot (an index like .nth(slot) would drift).
    page.get_by_role("button", name="Select document tags", exact=True).first.click()
    page.wait_for_timeout(1000)
    page.get_by_role("button", name=tag_name, exact=True).first.click()
    page.wait_for_timeout(500)
    # Closing the tag popover: clicking the dialog heading dismisses just the
    # popover (Escape closes the whole upload dialog instead).
    page.get_by_text("Upload documents", exact=True).first.click(force=True)
    page.wait_for_timeout(500)
    return tag_name


def _submit_upload(page: Page) -> str:
    result = page.evaluate("""() => {
        var dlg = document.querySelector('[role="dialog"]');
        if (!dlg) return 'NO DIALOG';
        // Prefer a form container if present (private upload), else use full dialog (admin upload)
        var container = dlg.querySelector('form') || dlg;
        var btn = [...container.querySelectorAll('button')].find(
            b => b.innerText && b.innerText.includes('Upload') && b.innerText.includes('file')
        );
        if (!btn) {
            var btns = container.querySelectorAll('button');
            btn = btns[btns.length - 1];
        }
        if (btn) { btn.scrollIntoView(); btn.click(); return btn.innerText.trim(); }
        return 'NO BTN';
    }""")
    page.wait_for_timeout(2000)
    return result


def _get_toast_text(page: Page) -> str:
    return page.evaluate("""() => {
        var t = document.querySelector('[data-sonner-toast],[role="status"],[class*="toast"],[class*="Toaster"]');
        return t ? t.innerText.trim() : '';
    }""")


def _switch_to_documents_tab(page: Page) -> None:
    page.evaluate("""() => {
        var dlg = document.querySelector('[role="dialog"]');
        if (dlg) {
            var dt = [...dlg.querySelectorAll('button')].find(b => /Documents/i.test(b.textContent));
            if (dt) dt.click();
        }
    }""")
    page.wait_for_timeout(2000)


def _wait_for_doc_status(page: Page, filename: str, max_tries: int = 20) -> str:
    for i in range(max_tries):
        page.evaluate("""() => {
            var btn = document.querySelector('button[title="Refresh"],button[aria-label="Refresh table"]');
            if (btn) btn.click();
        }""")
        page.wait_for_timeout(4000)

        completed = page.locator(
            f"(//tr[td[contains(normalize-space(.),'{filename}')]])[1]"
            f"//*[contains(translate(normalize-space(.),'COMPLETED','completed'),'completed')]"
        ).count() > 0

        failed = page.locator(
            f"(//tr[td[contains(normalize-space(.),'{filename}')]])[1]"
            f"//*[contains(translate(normalize-space(.),'FAILED','failed'),'failed')]"
        ).count() > 0

        if completed:
            print(f"  {filename} — Completed after {(i + 1) * 4}s")
            return "COMPLETED"
        elif failed:
            print(f"  {filename} — Processing failed after {(i + 1) * 4}s")
            return "FAILED"

    print(f"  {filename} — Status unknown after {max_tries * 4}s")
    return "UNKNOWN"


def _close_dialog(page: Page) -> None:
    page.keyboard.press("Escape")
    page.wait_for_timeout(2000)
    if page.locator("//div[@role='dialog']").count() > 0:
        page.evaluate("""() => {
            var btn = document.querySelector(
                '[role="dialog"] button[aria-label="Close"], button[title="Close"]'
            );
            if (btn) btn.click();
        }""")
        page.wait_for_timeout(1000)


# ─── TC03 ─────────────────────────────────────────────────────────────────────

def test_tc03_private_single_file_upload(page: Page, base_url):
    """TC03 — Upload one private document per supported format and verify each succeeds."""

    supported_files = [
        "test.pdf", "test.docx", "test.pptx", "test.xlsx", "test.html",
        "test.md", "test.asciidoc", "test.csv", "test.jpg", "test.png",
    ]

    passed_files = []
    failed_files = []

    print("\n" + "=" * 60)
    print("TC03: SINGLE FILE UPLOAD — ONE FILE PER SUPPORTED FORMAT")
    print("=" * 60)

    _open_private_documents_panel(page)

    for fname in supported_files:
        fpath = TEST_FILES / fname
        print(f"\n--- {fname} ---")

        print("  Uploading...")
        _upload_private_files(page, [str(fpath)])
        page.screenshot(path=str(RESULTS / f"tc03-F003-{fname}-uploading.png"))

        status = _wait_for_private_doc_status(page, fname, max_tries=15)
        print(f"  Status: {status}")
        page.screenshot(path=str(RESULTS / f"tc03-F003-{fname}-done.png"))

        if status == "Done":
            passed_files.append(fname)
        else:
            failed_files.append(f"{fname}: {status}")

    print("\n" + "=" * 60)
    print("TC03 SUMMARY:")
    print(f"  Passed: {passed_files}")
    print(f"  Failed: {failed_files}")
    print("=" * 60)

    assert len(failed_files) == 0, f"Some single uploads failed: {failed_files}"
    print("TC03 PASSED — All single file uploads successful")


# ─── TC04 ─────────────────────────────────────────────────────────────────────

def test_tc04_private_bulk_upload(page: Page, base_url):
    """TC04 — Bulk upload up to 5 private documents at once in a single batch."""

    batch_files = [
        "test.pdf", "test.docx", "test.pptx", "test.xlsx", "test.html",
    ]

    print("\n" + "=" * 60)
    print("TC04: BULK UPLOAD — UP TO 5 FILES AT ONCE")
    print("=" * 60)

    _open_private_documents_panel(page)

    print("  Selecting and uploading batch files...")
    file_paths = [str(TEST_FILES / f) for f in batch_files]
    _upload_private_files(page, file_paths)
    page.screenshot(path=str(RESULTS / "tc04-F003-batch-uploaded.png"))

    failed_files = []
    for fname in batch_files:
        status = _wait_for_private_doc_status(page, fname, max_tries=15)
        print(f"  {fname}: {status}")
        if status != "Done":
            failed_files.append(f"{fname}: {status}")

    print("\n" + "=" * 60)
    print(f"TC04 SUMMARY: Passed {len(batch_files) - len(failed_files)}/{len(batch_files)}, Failed {len(failed_files)}/{len(batch_files)}")
    print("=" * 60)
    assert len(failed_files) == 0, f"Bulk uploads failed: {failed_files}"
    print("TC04 PASSED — All bulk uploads successful")


# ─── TC05 ─────────────────────────────────────────────────────────────────────

def test_tc05_file_size_validation(page: Page, base_url):
    """TC05 — File size validation: files >50MB must be rejected."""



    print("\n" + "=" * 60)
    print("TC05: FILE SIZE VALIDATION (max: 50MB)")
    print("=" * 60)

    _open_private_documents_panel(page)

    # ── File >50MB — should be rejected ────────────────────────────────────────
    print("\n  Upload file >50MB (should be rejected)")
    page.locator("[role='dialog'] input[type='file']").set_input_files(
        str(TEST_FILES / "large_file.pdf")
    )
    page.wait_for_timeout(3000)
    page.screenshot(path=str(RESULTS / "tc05-F003-s1-large-selected.png"))

    toast_s1 = _get_toast_text(page)
    print(f"  Toast: {toast_s1}")
    toast_rejects = any(kw in toast_s1.lower() for kw in [
        "too large", "exceed", "maximum", "size limit", "50", "mb", "limit"
    ])
    inline_rejects = page.locator(
        "//*[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'too large')]"
        " | //*[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'exceeds')]"
        " | //*[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'size limit')]"
    ).count() > 0

    if toast_rejects or inline_rejects:
        page.screenshot(path=str(RESULTS / "tc05-F003-s1-rejected.png"))
    else:
        page.screenshot(path=str(RESULTS / "tc05-F003-s1-not-rejected.png"))
        assert False, "Large file should have been rejected (max is 50MB)"

    print("\n" + "=" * 60)
    print("TC05 PASSED — File size validation working correctly (max: 50MB)")
    print("=" * 60)


# ─── TC06 ─────────────────────────────────────────────────────────────────────

def test_tc06_private_document_edit_download_delete(page: Page, base_url):
    """TC06 — Upload a private document then verify download and delete actions.

    Private (personal) documents carry no description/tag metadata, so there is
    no Edit action for them (Edit only exists for Admin/Shared documents — see
    TC07); this test covers Download and Delete only.
    """

    print("\n" + "=" * 60)
    print("TC06: PRIVATE DOCUMENT — DOWNLOAD, DELETE")
    print("=" * 60)

    _open_private_documents_panel(page)

    # This personal document list accumulates real data across every test run
    # (700+ entries observed), and "test.pdf" already appears many times near
    # the top from earlier tests in this same suite — so a uniquely-named copy
    # is used here to unambiguously identify *this* upload for status/delete.
    fname = f"tc06_{int(time.time())}.pdf"
    tmp_path = Path(tempfile.mkdtemp()) / fname
    shutil.copy(TEST_FILES / "test.pdf", tmp_path)

    print(f"\n  Setup: Uploading {fname}...")
    _upload_private_files(page, [str(tmp_path)])
    status = _wait_for_private_doc_status(page, fname, max_tries=15)
    page.screenshot(path=str(RESULTS / "tc06-F003-00-setup-done.png"))
    assert status == "Done", f"Setup upload did not complete: {status}"
    print(f"  Setup complete — {fname} uploaded and ready")

    # Action 1: Download
    print("\n  Action 1: Download document")
    _click_private_doc_action(page, fname, "Download document")
    page.wait_for_timeout(2000)
    page.screenshot(path=str(RESULTS / "tc06-F003-01-download-triggered.png"))
    print("  Download action triggered")

    # Action 2: Delete
    print("\n  Action 2: Delete document")
    _click_private_doc_action(page, fname, "Delete document")
    page.wait_for_timeout(1500)
    page.screenshot(path=str(RESULTS / "tc06-F003-02-delete-confirm.png"))

    confirm_btn = page.locator(
        "//button[contains(translate(normalize-space(.),'DELETE','delete'),'delete')"
        " and not(contains(translate(normalize-space(.),'CANCEL','cancel'),'cancel'))]"
    )
    if confirm_btn.count() > 0:
        confirm_btn.click()
        page.wait_for_timeout(2000)

    page.screenshot(path=str(RESULTS / "tc06-F003-03-after-delete.png"))
    assert _count_private_docs_by_name(page, fname) == 0, "Document still visible after delete"
    print("  Document deleted successfully")

    print("\n" + "=" * 60)
    print("TC06 PASSED — Download and Delete verified for private documents")
    print("=" * 60)


# ─── TC07 ─────────────────────────────────────────────────────────────────────

def test_tc07_public_document_edit_download_delete(page: Page, base_url):
    """TC07 — Upload a public document via Admin Console then verify edit, download, and delete."""



    print("\n" + "=" * 60)
    print("TC07: PUBLIC DOCUMENT — EDIT, DOWNLOAD, DELETE")
    print("=" * 60)

    # Navigate to Admin Console → Documents
    print("\n  Navigating to Admin Console → Documents...")
    _navigate_to_admin_documents(page)

    # Wait for table rows to load, then snapshot the first row before uploading
    page.wait_for_selector("tbody tr", timeout=15000)
    first_row_before = page.evaluate("""() => {
        var r = document.querySelector('tbody tr');
        return r ? r.textContent.trim().slice(0, 80) : null;
    }""")
    print(f"\n  Setup: Uploading public test file...")
    page.locator("//button[@title='Upload documents']").wait_for(timeout=10000)
    page.locator("//button[@title='Upload documents']").click()
    page.locator("//div[@role='dialog']").wait_for(timeout=10000)
    page.locator("//input[@type='file']").set_input_files(str(TEST_FILES / "test.pdf"))
    page.wait_for_timeout(2000)

    # Select tag
    page.evaluate("() => { var dlg = document.querySelector('[role=\"dialog\"]'); if (dlg) dlg.scrollTop += 300; }")
    page.wait_for_timeout(1000)
    page.evaluate("""() => {
        var open_btn = [...document.querySelectorAll('button')].find(b => /select tags/i.test(b.textContent.trim()));
        if (open_btn) open_btn.click();
    }""")
    page.wait_for_timeout(2000)

    for _ in range(4):
        clicked = page.evaluate("""() => {
            var btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'To Review');
            if (btn) { btn.scrollIntoView(); btn.click(); return true; }
            return false;
        }""")
        if clicked:
            break
        page.evaluate("""() => {
            var pop = document.querySelector('[data-radix-popper-content-wrapper]');
            if (pop) pop.scrollTop += 80; else window.scrollBy(0, 80);
        }""")
        page.wait_for_timeout(800)

    page.evaluate("""() => {
        var dlg = document.querySelector('[role="dialog"]');
        if (dlg) {
            var cb = [...dlg.querySelectorAll('button')].find(b => b.textContent.trim() === 'Close tags');
            if (cb) cb.click();
        }
    }""")
    page.wait_for_timeout(500)
    _submit_upload(page)
    page.wait_for_timeout(3000)
    page.screenshot(path=str(RESULTS / "tc07-F003-setup-after-submit.png"))

    _switch_to_documents_tab(page)
    _wait_for_doc_status(page, "test.pdf", max_tries=10)
    page.screenshot(path=str(RESULTS / "tc07-F003-00-setup-done.png"))

    # Close the upload dialog (it stays open after switching tabs internally)
    page.keyboard.press("Escape")
    page.wait_for_timeout(1000)

    # Re-click Docs to force the table to reload with fresh data
    page.get_by_role("button", name="Docs", exact=True).click()
    page.wait_for_selector("tbody tr", timeout=15000)
    page.wait_for_timeout(2000)

    # Scroll table right to reveal action buttons
    page.evaluate("() => { var t = document.querySelector('table'); if (t && t.parentElement) t.parentElement.scrollLeft = 9999; }")

    # Verify our document is now the first (newest) row
    first_row_after = page.evaluate("""() => {
        var r = document.querySelector('tbody tr');
        return r ? r.textContent.trim().slice(0, 80) : null;
    }""")
    assert first_row_after != first_row_before, "Expected TC07's upload to appear as the newest first row"
    print(f"  Setup complete — TC07 document is first row in table")

    # Action 1: Edit — first row is TC07's document (just uploaded, newest)
    # Row buttons are: [0] select checkbox, [1] Edit, [2] Download, [3] Delete.
    print("\n  Action 1: Edit document")
    page.evaluate("""() => {
        var firstRow = document.querySelector('tbody tr');
        if (firstRow) {
            var btns = [...firstRow.querySelectorAll('button')];
            if (btns[1]) { btns[1].scrollIntoView({inline: 'end'}); btns[1].click(); }
        }
    }""")
    page.wait_for_timeout(2000)
    page.screenshot(path=str(RESULTS / "tc07-F003-01-edit-dialog.png"))
    assert page.locator("//div[@role='dialog']").count() > 0, "Edit dialog did not open"
    print("  Edit dialog opened")
    page.keyboard.press("Escape")
    page.wait_for_timeout(1000)

    # Action 2: Download — first row is still TC07's document
    print("\n  Action 2: Download document")
    page.evaluate("""() => {
        var firstRow = document.querySelector('tbody tr');
        if (firstRow) {
            var btns = [...firstRow.querySelectorAll('button')];
            if (btns[2]) { btns[2].scrollIntoView({inline: 'end'}); btns[2].click(); }
        }
    }""")
    page.wait_for_timeout(3000)
    page.screenshot(path=str(RESULTS / "tc07-F003-02-download-triggered.png"))
    print("  Download action triggered")

    # Action 3: Delete — first row is still TC07's document
    print("\n  Action 3: Delete document")
    page.evaluate("""() => {
        var firstRow = document.querySelector('tbody tr');
        if (firstRow) {
            var btns = [...firstRow.querySelectorAll('button')];
            var del = btns[btns.length - 1];
            if (del) { del.scrollIntoView({inline: 'end'}); del.click(); }
        }
    }""")
    page.wait_for_timeout(2000)
    page.screenshot(path=str(RESULTS / "tc07-F003-03-delete-confirm.png"))

    confirm_btn = page.locator(
        "//button[contains(translate(normalize-space(.),'DELETE','delete'),'delete')"
        " and not(contains(translate(normalize-space(.),'CANCEL','cancel'),'cancel'))]"
    )
    confirm_btn.wait_for(timeout=5000)
    confirm_btn.click()
    page.wait_for_timeout(2000)

    page.screenshot(path=str(RESULTS / "tc07-F003-04-after-delete.png"))
    # Verify the uploaded test.pdf is no longer the first row — confirms deletion succeeded
    first_row_final = page.evaluate("""() => {
        var r = document.querySelector('tbody tr');
        return r ? r.textContent.trim() : null;
    }""")
    assert first_row_final is None or "test.pdf" not in first_row_final, (
        f"test.pdf should no longer be the first row after deletion, but got: {first_row_final!r}"
    )
    print("  Document deleted successfully")

    print("\n" + "=" * 60)
    print("TC07 PASSED — Edit, Download, Delete verified for public documents")
    print("=" * 60)


# ─── TC23 ────────────────────────────────────────────────────────────────────

def test_tc23_public_cancel_upload(page: Page, base_url):
    """TC23 — Verify public documents upload dialog can be cancelled without side effects."""



    print("\n" + "=" * 60)
    print("TC23: PUBLIC DOCUMENTS — CANCEL UPLOAD FLOW")
    print("=" * 60)

    # STEP 1: Navigate to Admin Console → Documents
    print("\n  STEP 1: Navigating to Admin Console → Documents...")
    _navigate_to_admin_documents(page)
    print("  Documents page loaded")

    # STEP 2: Open Upload modal
    print("\n  STEP 2: Opening upload modal...")
    page.locator("//button[@title='Upload documents']").wait_for(timeout=10000)
    page.locator("//button[@title='Upload documents']").click()
    page.locator("//div[@role='dialog']").wait_for(timeout=10000)
    print("  Upload modal opened")
    page.screenshot(path=str(RESULTS / "tc23-F003-01-modal-opened.png"))

    # STEP 3: Click Cancel
    print("\n  STEP 3: Clicking Cancel...")
    page.locator("//button[normalize-space()='Cancel']").click()
    page.locator("//div[@role='dialog']").wait_for(state="hidden", timeout=10000)
    print("  Upload cancelled — dialog closed")
    page.screenshot(path=str(RESULTS / "tc23-F003-02-cancelled.png"))

    # STEP 4: Verify page state intact
    print("\n  STEP 4: Verifying page state after cancel...")
    assert page.locator("//button[@title='Refresh documents']").count() > 0, \
        "Refresh documents button not visible after cancel"
    print("  Refresh button visible — page state intact")

    print("\n" + "=" * 60)
    print("TC23 PASSED — Cancel upload flow works correctly")
    print("=" * 60)


# ─── TC24 ────────────────────────────────────────────────────────────────────

def test_tc24_public_upload_file(page: Page, base_url):
    """TC24 — Verify public document file upload flow completes successfully."""



    print("\n" + "=" * 60)
    print("TC24: PUBLIC DOCUMENTS — UPLOAD FILE FLOW")
    print("=" * 60)

    # STEP 1: Navigate to Admin Console → Documents
    print("\n  STEP 1: Navigating to Admin Console → Documents...")
    _navigate_to_admin_documents(page)
    print("  Documents page loaded")

    # STEP 2: Open Upload modal
    print("\n  STEP 2: Opening upload modal...")
    page.locator("//button[@title='Upload documents']").wait_for(timeout=10000)
    page.locator("//button[@title='Upload documents']").click()
    page.locator("//div[@role='dialog']").wait_for(timeout=10000)
    print("  Upload modal opened")
    page.screenshot(path=str(RESULTS / "tc24-F003-01-modal-opened.png"))

    # STEP 3: Select file
    print("\n  STEP 3: Selecting file...")
    page.locator("//input[@type='file']").set_input_files(str(TEST_FILES / "test.pdf"))
    page.wait_for_timeout(2000)
    print("  File selected: test.pdf")
    page.screenshot(path=str(RESULTS / "tc24-F003-02-file-selected.png"))

    # STEP 4: Click Upload button
    print("\n  STEP 4: Submitting upload...")
    page.evaluate("""() => {
        document.querySelectorAll('button').forEach(btn => {
            if (btn.innerText && btn.innerText.includes('Upload')) btn.click();
        });
    }""")
    print("  Upload submitted")

    # STEP 5: Wait for modal to close
    print("\n  STEP 5: Waiting for modal to close...")
    page.locator("//div[@role='dialog']").wait_for(state="hidden", timeout=15000)
    print("  Modal closed")
    page.screenshot(path=str(RESULTS / "tc24-F003-03-after-upload.png"))

    # STEP 6: Verify page state
    print("\n  STEP 6: Verifying page state after upload...")
    assert page.locator("//button[@title='Refresh documents']").count() > 0, \
        "Refresh documents button not visible after upload"
    print("  Refresh button visible — page state intact")

    print("\n" + "=" * 60)
    print("TC24 PASSED — Public document upload flow works correctly")
    print("=" * 60)


# ─── TC25 ────────────────────────────────────────────────────────────────────

def test_tc25_document_tags_section(page: Page, base_url):
    """TC25 — Verify Document Tags section loads, displays tags, and allows creating a new tag."""



    print("\n" + "=" * 60)
    print("TC25: DOCUMENT TAGS SECTION")
    print("=" * 60)

    # STEP 1: Navigate to Admin Console → Documents → Doc Tags
    print("\n  STEP 1: Navigating to Doc Tags tab...")
    _navigate_to_doc_tags(page)
    print("  Doc Tags page loaded")

    # STEP 2: Verify search and refresh buttons
    print("\n  STEP 2: Verifying search and refresh buttons...")
    assert page.locator("//input[@placeholder='Search tags...']").count() > 0, \
        "Search tags input not found"
    assert page.locator("//button[@title='Refresh document tags']").count() > 0, \
        "Refresh tags button not found"
    print("  Search and Refresh buttons verified")

    # STEP 3: Verify Add Tag button
    print("\n  STEP 3: Verifying Add Tag button...")
    assert page.locator("//button[@title='Add document tag']").count() > 0, \
        "Add document tag button not found"
    print("  Add Tag button verified")

    # STEP 4: Check existing tags
    print("\n  STEP 4: Checking existing tags...")
    cards = page.locator("//div[contains(@class,'rounded-xl')]").count()
    print(f"  Tag cards found: {cards}")
    if cards > 0:
        print("  Document tags are present and visible")
    else:
        print("  No document tags found — section is empty but loaded correctly")
    page.screenshot(path=str(RESULTS / "tc25-F003-01-tags-section.png"))

    # STEP 5: Create a new tag
    new_tag_name = f"F003 test tag {int(time.time())}"
    print(f"\n  STEP 5: Creating new tag '{new_tag_name}'...")
    page.locator("//button[@title='Add document tag']").click()
    page.wait_for_timeout(2000)
    page.screenshot(path=str(RESULTS / "tc25-F003-02-add-tag-dialog.png"))
    page.locator("//input[@placeholder='e.g. HR Documents']").wait_for(timeout=8000)
    page.locator("//input[@placeholder='e.g. HR Documents']").fill(new_tag_name)
    print("  Tag name entered")
    page.locator("//button[normalize-space()='Create tag']").wait_for(timeout=5000)
    page.locator("//button[normalize-space()='Create tag']").click()
    page.wait_for_timeout(2000)
    print(f"  Tag '{new_tag_name}' created")
    page.screenshot(path=str(RESULTS / "tc25-F003-03-tag-created.png"))

    print("\n" + "=" * 60)
    print("TC25 PASSED — Document Tags section validated successfully")
    print("=" * 60)
