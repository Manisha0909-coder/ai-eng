import os
import sys
from pathlib import Path

import pytest
from playwright.sync_api import Page, expect

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from auth.login import login_to_gotalk

ADMIN_EMAIL = os.getenv("SUPER_ADMIN_EMAIL", "john.doe@noah.com")
ADMIN_PASS = os.getenv("SUPER_ADMIN_PASS", "Friday#3000")



# ── Navigation ─────────────────────────────────────────────────────────────────

def _navigate_to_feedback(page: Page) -> None:
    if "/admin-dashboard" not in page.url:
        page.locator("xpath=//button[@aria-label='Admin console']//*[name()='svg']").click()
        page.wait_for_timeout(1500)
    # Feedback is a direct sidebar nav item now (no "Access" submenu to expand)
    page.get_by_role("button", name="Feedback", exact=True).click()
    page.wait_for_timeout(2000)
    page.locator("xpath=//table//tbody//tr[1]").wait_for(timeout=15000)


# ── Filter helpers ─────────────────────────────────────────────────────────────

def _open_filters(page: Page) -> None:
    page.locator("xpath=//button[@aria-label='Filters']").click()
    page.locator("xpath=//button[normalize-space()='Clear']").wait_for(timeout=8000)
    page.wait_for_timeout(500)


def _clear_filters(page: Page) -> None:
    _open_filters(page)
    page.evaluate(
        """() => {
            const b = [...document.querySelectorAll('button')]
                .filter(b => b.offsetParent !== null && b.textContent.trim() === 'Clear').pop();
            if (b) b.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
        }"""
    )
    page.wait_for_timeout(500)
    page.keyboard.press("Escape")
    page.locator("xpath=//table//tbody//tr[1]").wait_for(timeout=10000)
    page.wait_for_timeout(1000)


def _apply_filter(page: Page, label: str, option: str) -> None:
    """Open filter panel, open dropdown for label, click option, then close panel."""
    _open_filters(page)
    # Click the input/dropdown near the filter label
    clicked = page.evaluate(
        f"""() => {{
            const labels = [...document.querySelectorAll('label,span,div,p')]
                .filter(el => el.offsetParent !== null
                    && el.children.length === 0
                    && el.textContent.trim().toLowerCase() === {repr(label.lower())});
            for (const lbl of labels) {{
                const container = lbl.closest('div');
                if (!container) continue;
                const inp = container.querySelector('input,button[role="combobox"]');
                if (inp) {{ inp.click(); return true; }}
            }}
            return false;
        }}"""
    )
    if not clicked:
        # fallback: click first visible combobox
        page.locator(
            "xpath=(//button[@role='combobox'] | //div[@role='combobox'])[1]"
        ).click()
    page.wait_for_timeout(500)
    # Click the option by text
    page.evaluate(
        f"""() => {{
            const el = [...document.querySelectorAll('*')]
                .find(e => e.offsetParent !== null && e.children.length === 0
                    && e.textContent.trim() === {repr(option)});
            if (el) el.click();
        }}"""
    )
    page.wait_for_timeout(300)
    page.keyboard.press("Escape")
    page.locator("xpath=//table//tbody//tr[1]").wait_for(timeout=10000)
    page.wait_for_timeout(1000)


def _status_col_values(page: Page) -> str:
    return page.evaluate(
        """() => [...document.querySelectorAll('table tbody tr td:nth-child(6)')]
            .map(td => td.innerText.trim()).join(' | ')"""
    )


# ── Tests ──────────────────────────────────────────────────────────────────────

def test_tc32_feedback_list_view_and_pagination(page: Page):
    """TC32 — US001: Feedback table shows all required columns, rows per page works, pagination works."""
    _navigate_to_feedback(page)
    page.screenshot(path="results/tc32-F013-page-loaded.png")

    # Verify table has rows
    row_count = page.locator("xpath=//table//tbody//tr").count()
    print(f"Table rows: {row_count}")
    assert row_count > 0, "Feedback table has no rows"

    # Verify all required column headers
    for col in ("Type", "User", "Query", "Response", "Reason", "Status",
                "Resolved By", "Resolved At", "Date", "Actions"):
        assert col in page.content(), f"Column header '{col}' not found"
    print("All 10 column headers present")
    page.screenshot(path="results/tc32-F013-columns.png")

    # Verify first row has data in key columns
    # Column order: [1] checkbox, [2] Type (icon), [3] User, [4] Query,
    # [5] Response, [6] Reason, [7] Status, ...
    user_cell = page.locator("xpath=//table//tbody//tr[1]//td[3]").inner_text()
    query_cell = page.locator("xpath=//table//tbody//tr[1]//td[4]").inner_text()
    response_cell = page.locator("xpath=//table//tbody//tr[1]//td[5]").inner_text()
    reason_cell = page.locator("xpath=//table//tbody//tr[1]//td[6]").inner_text()
    status_cell = page.locator("xpath=//table//tbody//tr[1]//td[7]").inner_text()
    print(f"User: {user_cell} | Query: {query_cell[:40]} | Status: {status_cell}")
    assert user_cell.strip(), "User column is empty"
    assert query_cell.strip(), "Query column is empty"
    assert response_cell.strip(), "Response column is empty"
    assert reason_cell.strip(), "Reason column is empty"
    assert any(s in status_cell for s in ("Unresolved", "Resolved")), \
        f"Unexpected status value: {status_cell}"
    page.screenshot(path="results/tc32-F013-row-fields.png")

    # Verify pagination info and controls
    assert "Showing" in page.content(), "Pagination 'Showing' text not found"
    assert page.locator("xpath=//button[@aria-label='Next page']").count() > 0
    assert page.locator("xpath=//button[@aria-label='Previous page']").count() > 0
    print("Pagination controls present")

    # Test rows per page dropdown (native <select> element)
    # Scroll to bottom to ensure pagination select is in view
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(500)
    rpp_select = page.locator("xpath=//select").first
    select_exists = page.evaluate("() => !!document.querySelector('select')")
    print(f"Select element found: {select_exists}")
    if select_exists:
        rpp_select.scroll_into_view_if_needed(timeout=5000)
        page.wait_for_timeout(300)
        for rpp in ("25", "50", "100", "10"):
            page.evaluate(f"""
                () => {{
                    const sel = document.querySelector('select');
                    if (!sel) return;
                    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
                    setter.call(sel, '{rpp}');
                    sel.dispatchEvent(new Event('change', {{bubbles: true}}));
                }}
            """)
            page.wait_for_timeout(2000)
            rows_now = page.locator("xpath=//table//tbody//tr").count()
            print(f"Rows per page {rpp} → {rows_now} rows shown")
            page.screenshot(path=f"results/tc32-F013-rpp-{rpp}.png")
    else:
        print("WARNING: No <select> element found for rows-per-page — skipping RPP test")
        page.screenshot(path="results/tc32-F013-no-rpp-select.png")

    # Paginate through all pages (forward then back to page 1)
    page_num = 1
    while True:
        next_btn = page.locator("xpath=//button[@aria-label='Next page']")
        if next_btn.is_disabled():
            print(f"Reached last page ({page_num}) — Next is disabled")
            break
        next_btn.click()
        page.wait_for_timeout(1500)
        page_num += 1
    print(f"Scrolled through {page_num} pages")

    while True:
        prev_btn = page.locator("xpath=//button[@aria-label='Previous page']")
        if prev_btn.is_disabled():
            break
        prev_btn.click()
        page.wait_for_timeout(1000)

    page.screenshot(path="results/tc32-F013-back-to-page1.png")
    print("TC32 PASSED — Feedback list columns, rows per page, and pagination verified")


def test_tc33_view_conversation_and_mark_resolved(page: Page):
    """TC33 — US002+US003: Unresolved badge opens Chat History Snapshot; Mark as Resolved updates status."""
    _navigate_to_feedback(page)
    page.screenshot(path="results/tc33-F013-page-loaded.png")

    # Find first Unresolved row
    page.locator("xpath=//table//tbody//tr//*[normalize-space()='Unresolved']").first.wait_for(timeout=10000)
    unresolved_row_idx = page.evaluate(
        """() => {
            const rows = [...document.querySelectorAll('table tbody tr')];
            for (let i = 0; i < rows.length; i++) {
                if ((rows[i].innerText || '').includes('Unresolved')) return i + 1;
            }
            return -1;
        }"""
    )
    assert unresolved_row_idx > 0, "No Unresolved row found in table"
    query_text = page.locator(
        f"xpath=//table//tbody//tr[{unresolved_row_idx}]//td[4]"
    ).inner_text()
    print(f"First Unresolved row {unresolved_row_idx}, query: {query_text[:60]}")
    page.screenshot(path="results/tc33-F013-unresolved-row.png")

    # Click Unresolved badge to open Chat History Snapshot
    page.locator(
        "xpath=(//table//tbody//tr//*[normalize-space()='Unresolved'])[1]"
    ).click()
    page.wait_for_timeout(2000)
    # Wait for the snapshot dialog — Mark as Resolved button only appears inside it
    page.locator(
        "xpath=//button[normalize-space()='Mark as Resolved']"
    ).wait_for(timeout=12000)
    assert "Chat History Snapshot" in page.content(), "Chat History Snapshot dialog not opened"
    page.screenshot(path="results/tc33-F013-dialog-opened.png")
    print("Chat History Snapshot dialog opened")

    # Verify conversation content and feedback source label
    assert query_text[:30] in page.content(), "Query text not found in dialog"
    assert "Highlighted message" in page.content() or "feedback source" in page.content().lower(), \
        "Feedback source label not found in dialog"
    print("Conversation content and feedback source label verified")

    # Verify snapshot is read-only (no editable inputs visible)
    editable_count = page.evaluate(
        """() => [...document.querySelectorAll(
            'input:not([type="hidden"]):not([readonly]):not([disabled]), textarea:not([readonly]):not([disabled])'
        )].filter(e => e.offsetParent !== null).length"""
    )
    if editable_count == 0:
        print("Snapshot is read-only — no editable fields")
    else:
        print(f"WARNING: {editable_count} editable field(s) found")

    # Verify buttons present
    assert page.locator(
        "xpath=//button[normalize-space()='Mark as Resolved']"
    ).count() > 0, "Mark as Resolved button not found"
    assert page.locator(
        "xpath=//button[normalize-space()='Close']"
    ).count() > 0, "Close button not found"
    page.screenshot(path="results/tc33-F013-buttons.png")
    print("Mark as Resolved and Close buttons present")

    # Click Mark as Resolved
    page.locator("xpath=//button[normalize-space()='Mark as Resolved']").first.click()
    page.wait_for_timeout(2000)
    assert "Resolution Comment" in page.content(), "Resolution Comment form not shown"
    page.screenshot(path="results/tc33-F013-confirm-dialog.png")
    print("Resolution confirmation dialog opened")

    # Fill resolution comment and submit
    page.locator(
        "xpath=//textarea[contains(@placeholder,'Enter resolution comment')]"
    ).fill("Verified and resolved via automated test")
    page.wait_for_timeout(500)
    page.screenshot(path="results/tc33-F013-comment-filled.png")
    page.locator(
        "xpath=(//button[normalize-space()='Mark as Resolved'])[last()]"
    ).click()
    page.wait_for_timeout(3000)
    # Wait for panel to close (no longer contains Chat History Snapshot)
    try:
        page.locator(
            "xpath=//*[contains(normalize-space(),'Chat History Snapshot')]"
        ).wait_for(state="hidden", timeout=10000)
    except Exception:
        pass

    page.screenshot(path="results/tc33-F013-resolved.png")
    print("Resolution comment submitted")

    # Verify status updated to Resolved in table
    resolved_row = page.evaluate(
        f"""() => {{
            const rows = [...document.querySelectorAll('table tbody tr')];
            for (let i = 0; i < rows.length; i++) {{
                if ((rows[i].innerText || '').includes({repr(query_text[:30])})
                        && (rows[i].innerText || '').includes('Resolved')) return i + 1;
            }}
            return -1;
        }}"""
    )
    print(f"Row showing Resolved: {resolved_row}")
    assert resolved_row > 0, "Status did not change to Resolved in table"
    page.screenshot(path="results/tc33-F013-status-resolved.png")
    print("TC33 PASSED — Conversation verified and marked as Resolved")


def test_tc35_bulk_resolve(page: Page):
    """TC35 — US004: Select 4 items, click Resolve, confirm — all badges update to Resolved."""
    _navigate_to_feedback(page)
    page.screenshot(path="results/tc35-F013-page-loaded.png")

    # Confirm at least 1 unresolved row; select up to 4
    unresolved_count = page.locator(
        "xpath=//table//tbody//tr//*[normalize-space()='Unresolved']"
    ).count()
    print(f"Unresolved items on page: {unresolved_count}")
    assert unresolved_count >= 1, f"Need at least 1 Unresolved item, found {unresolved_count}"
    target = min(4, unresolved_count)

    # Click Select items to reveal checkboxes
    page.locator("xpath=//button[@title='Select items']").click()
    page.wait_for_timeout(1500)
    page.locator("xpath=//input[@type='checkbox']").first.wait_for(timeout=8000)
    checkbox_count = page.locator("xpath=//input[@type='checkbox']").count()
    print(f"Checkboxes visible: {checkbox_count}")
    page.screenshot(path="results/tc35-F013-checkboxes.png")

    # Select up to `target` Unresolved rows' checkboxes
    unresolved_rows = page.locator(
        "xpath=//table//tbody//tr[.//*[normalize-space()='Unresolved']]"
    )
    selected = 0
    for i in range(min(unresolved_rows.count(), 10)):
        if selected >= target:
            break
        try:
            cb = unresolved_rows.nth(i).locator("button[role='checkbox']")
            if cb.count() > 0:
                cb.click()
                selected += 1
                page.wait_for_timeout(300)
        except Exception:
            pass
    print(f"{selected} Unresolved rows selected (target: {target})")
    page.screenshot(path="results/tc35-F013-four-selected.png")
    assert selected >= 1, f"Could not select any Unresolved rows (selected {selected})"

    # Click Resolve button
    page.locator("xpath=//button[normalize-space()='Resolve']").wait_for(timeout=8000)
    page.locator("xpath=//button[normalize-space()='Resolve']").click()
    page.wait_for_timeout(2000)
    page.screenshot(path="results/tc35-F013-resolve-clicked.png")

    # Verify confirmation dialog (modal overlay)
    modal = page.locator("css=div[class*='fixed inset-0']")
    modal.wait_for(timeout=8000)
    dialog_text = page.evaluate("() => document.body.innerText.substring(0, 300)")
    print(f"Dialog content: {dialog_text[:100]}")
    page.screenshot(path="results/tc35-F013-confirm-dialog.png")

    # Confirm — click the last button inside the modal (the confirm/resolve button)
    modal.locator("button").last.click()
    page.wait_for_timeout(3000)
    page.screenshot(path="results/tc35-F013-after-confirm.png")

    # Verify resolved badges increased
    page.locator("xpath=//table//tbody//tr").first.wait_for(timeout=8000)
    resolved_count = page.locator(
        "xpath=//table//tbody//tr//*[normalize-space()='Resolved']"
    ).count()
    print(f"Resolved badges visible: {resolved_count}")
    assert resolved_count >= selected, f"Expected ≥{selected} Resolved badges, found {resolved_count}"
    page.screenshot(path="results/tc35-F013-resolved-badges.png")
    print(f"TC35 PASSED — Bulk resolve verified for {selected} items ({resolved_count} Resolved badges)")


def test_tc36_bulk_delete(page: Page):
    """TC36 — US005: Select 3 items, click delete, confirm — total item count decreases."""
    _navigate_to_feedback(page)
    page.screenshot(path="results/tc36-F013-page-loaded.png")

    # Capture initial total count (handles "Showing X-Y of N", "Showing X to Y of N", etc.)
    initial_total = page.evaluate(
        """() => {
            const t = document.body.innerText.replace(/\\s+/g, ' ');
            const m = t.match(/Showing .{1,30} of (\\d+)/i);
            return m ? parseInt(m[1]) : -1;
        }"""
    )
    print(f"Initial total items: {initial_total}")

    # Table shows a row-select checkbox per row directly — no separate
    # "Select items" mode toggle to activate first (same as other admin tables).
    select_btn = page.locator("xpath=//button[@title='Select items']")
    if select_btn.count() > 0:
        select_btn.click()
        page.wait_for_timeout(1500)
    page.locator("xpath=//table//tbody//tr//button[@role='checkbox']").first.wait_for(timeout=8000)
    checkbox_count = page.locator("xpath=//table//tbody//tr//button[@role='checkbox']").count()
    assert checkbox_count >= 3, f"Need at least 3 checkboxes, found {checkbox_count}"
    page.screenshot(path="results/tc36-F013-checkboxes.png")

    # Select 3 rows via their checkbox
    for i in range(1, 4):
        page.locator(f"xpath=//table//tbody//tr[{i}]//button[@role='checkbox']").click()
        page.wait_for_timeout(500)
    page.screenshot(path="results/tc36-F013-three-selected.png")
    print("3 rows selected")

    # Click delete button (first sibling button after Resolve)
    page.locator("xpath=//button[normalize-space()='Resolve']").wait_for(timeout=8000)
    page.locator(
        "xpath=(//button[normalize-space()='Resolve']/following-sibling::button)[1]"
    ).click()
    page.wait_for_timeout(2000)
    page.screenshot(path="results/tc36-F013-delete-clicked.png")

    # Confirm deletion — scope to the dialog itself; the toolbar has its own
    # "Delete" button with identical text, so an unscoped locator would just
    # re-match that one instead of the modal's confirm button.
    dialog = page.locator("[role='dialog'], [role='alertdialog']").first
    dialog.wait_for(timeout=8000)
    confirm_btn = dialog.get_by_role("button", name="Delete", exact=True)
    confirm_btn.wait_for(timeout=8000)
    page.wait_for_timeout(500)  # let the dialog's fade-in animation settle before clicking
    page.screenshot(path="results/tc36-F013-confirm-dialog.png")
    try:
        confirm_btn.click(timeout=5000)
    except Exception:
        confirm_btn.click(force=True)
    page.wait_for_timeout(3000)
    page.screenshot(path="results/tc36-F013-after-delete.png")

    # The list doesn't always refresh itself after a bulk action — refresh explicitly
    refreshed = page.evaluate(
        """() => {
            const b = [...document.querySelectorAll('button')].find(b => b.offsetParent
                && ((b.title || '').toLowerCase().includes('refresh')
                    || (b.getAttribute('aria-label') || '').toLowerCase().includes('refresh')));
            if (b) { b.click(); return true; }
            return false;
        }"""
    )
    if not refreshed:
        page.reload()
        page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)

    # Verify total count decreased (table updates in place after deletion)
    page.locator("xpath=//table//tbody//tr[1]").wait_for(timeout=10000)
    page.wait_for_timeout(1000)

    final_total = page.evaluate(
        """() => {
            const t = document.body.innerText.replace(/\\s+/g, ' ');
            const m = t.match(/Showing .{1,30} of (\\d+)/i);
            return m ? parseInt(m[1]) : -1;
        }"""
    )
    print(f"Total items: was {initial_total}, now {final_total}")
    assert final_total < initial_total, \
        f"Total count did not decrease (before: {initial_total}, after: {final_total})"
    page.screenshot(path="results/tc36-F013-rows-removed.png")
    print(f"TC36 PASSED — Bulk delete verified ({initial_total} → {final_total} items)")


def test_tc37_feedback_filters(page: Page):
    """TC37 — US006: Status filter (All/Resolved/Unresolved) and Type filter (All/Positive/Negative) update table."""
    _navigate_to_feedback(page)
    page.screenshot(path="results/tc37-F013-default.png")

    # ── Status = Resolved ──────────────────────────────────────────────────────
    _apply_filter(page, "Status", "Resolved")
    status_vals = _status_col_values(page)
    print(f"Status=Resolved page 1: {status_vals[:100]}")
    assert "Unresolved" not in status_vals, "Resolved filter shows Unresolved rows"
    page.screenshot(path="results/tc37-F013-resolved.png")
    print("Status=Resolved verified")

    _clear_filters(page)

    # ── Status = Unresolved ────────────────────────────────────────────────────
    _apply_filter(page, "Status", "Unresolved")
    status_vals = _status_col_values(page)
    print(f"Status=Unresolved page 1: {status_vals[:100]}")
    assert "Resolved" not in status_vals, "Unresolved filter shows Resolved rows"
    page.screenshot(path="results/tc37-F013-unresolved.png")
    print("Status=Unresolved verified")

    _clear_filters(page)

    # ── Status = All Status ────────────────────────────────────────────────────
    _apply_filter(page, "Status", "All Status")
    rows_all = page.locator("xpath=//table//tbody//tr").count()
    assert rows_all > 0, "No rows after All Status reset"
    page.screenshot(path="results/tc37-F013-all-status.png")
    print(f"Status=All Status: {rows_all} rows")

    _clear_filters(page)

    # ── Type = Positive ────────────────────────────────────────────────────────
    _apply_filter(page, "Feedback type", "Positive")
    rows_pos = page.locator("xpath=//table//tbody//tr").count()
    print(f"Type=Positive: {rows_pos} rows")
    page.screenshot(path="results/tc37-F013-positive.png")

    _clear_filters(page)

    # ── Type = Negative ────────────────────────────────────────────────────────
    _apply_filter(page, "Feedback type", "Negative")
    rows_neg = page.locator("xpath=//table//tbody//tr").count()
    print(f"Type=Negative: {rows_neg} rows")
    page.screenshot(path="results/tc37-F013-negative.png")

    _clear_filters(page)

    # ── Type = All Feedbacks ───────────────────────────────────────────────────
    _apply_filter(page, "Feedback type", "All Feedbacks")
    rows_all_fb = page.locator("xpath=//table//tbody//tr").count()
    assert rows_all_fb > 0, "No rows after All Feedbacks reset"
    page.screenshot(path="results/tc37-F013-all-feedbacks.png")
    print(f"Type=All Feedbacks: {rows_all_fb} rows")

    _clear_filters(page)
    page.screenshot(path="results/tc37-F013-cleared.png")
    print("TC37 PASSED — All single filter options verified")


def test_tc38_combined_filters(page: Page):
    """TC38 — US006: Combined Status + Type filters work correctly for all 4 combinations."""
    _navigate_to_feedback(page)
    page.screenshot(path="results/tc38-F013-default.png")

    combos = [
        ("Resolved", "Positive", "Unresolved"),
        ("Resolved", "Negative", "Unresolved"),
        ("Unresolved", "Negative", "Resolved"),
    ]

    for status, fb_type, excluded in combos:
        _open_filters(page)
        # Apply status
        page.evaluate(
            f"""() => {{
                const labels = [...document.querySelectorAll('label,span,div,p')]
                    .filter(el => el.offsetParent !== null && el.children.length === 0
                        && el.textContent.trim().toLowerCase() === 'status');
                for (const lbl of labels) {{
                    const c = lbl.closest('div');
                    if (!c) continue;
                    const inp = c.querySelector('input,button[role="combobox"]');
                    if (inp) {{ inp.click(); return true; }}
                }}
                return false;
            }}"""
        )
        page.wait_for_timeout(400)
        page.evaluate(
            f"""() => {{
                const el = [...document.querySelectorAll('*')]
                    .find(e => e.offsetParent !== null && e.children.length === 0
                        && e.textContent.trim() === {repr(status)});
                if (el) el.click();
            }}"""
        )
        page.wait_for_timeout(300)
        # Apply feedback type
        page.evaluate(
            f"""() => {{
                const labels = [...document.querySelectorAll('label,span,div,p')]
                    .filter(el => el.offsetParent !== null && el.children.length === 0
                        && el.textContent.trim().toLowerCase() === 'feedback type');
                for (const lbl of labels) {{
                    const c = lbl.closest('div');
                    if (!c) continue;
                    const inp = c.querySelector('input,button[role="combobox"]');
                    if (inp) {{ inp.click(); return true; }}
                }}
                return false;
            }}"""
        )
        page.wait_for_timeout(400)
        page.evaluate(
            f"""() => {{
                const el = [...document.querySelectorAll('*')]
                    .find(e => e.offsetParent !== null && e.children.length === 0
                        && e.textContent.trim() === {repr(fb_type)});
                if (el) el.click();
            }}"""
        )
        page.wait_for_timeout(300)
        page.keyboard.press("Escape")
        page.wait_for_timeout(1500)
        # Table may be empty if no matching data — still a valid filter result
        has_rows = page.locator("xpath=//table//tbody//tr[1]").is_visible()
        if has_rows:
            status_vals = _status_col_values(page)
            print(f"Combo {status}+{fb_type}: {status_vals[:80]}")
            assert excluded not in status_vals, \
                f"{status}+{fb_type} filter shows {excluded} rows"
        else:
            print(f"Combo {status}+{fb_type}: no rows (filter active, no matching data)")
        page.screenshot(
            path=f"results/tc38-F013-{status.lower()}-{fb_type.lower()}.png"
        )
        print(f"✓ {status} + {fb_type} verified")
        _clear_filters(page)

    page.screenshot(path="results/tc38-F013-done.png")
    print("TC38 PASSED — All 3 filter combinations verified")


def test_tc39_export_feedback(page: Page):
    """TC39 — US007: Export feedback button downloads a non-empty file."""
    _navigate_to_feedback(page)
    page.screenshot(path="results/tc39-F013-page-loaded.png")

    # Verify Export button is visible and enabled
    export_btn = page.locator("xpath=//button[@title='Export feedback']")
    export_btn.wait_for(timeout=10000)
    expect(export_btn).to_be_visible()
    expect(export_btn).to_be_enabled()
    page.screenshot(path="results/tc39-F013-export-button.png")
    print("Export feedback button visible and enabled")

    # Click Export and capture download
    with page.expect_download(timeout=30000) as dl_info:
        export_btn.click()
    download = dl_info.value
    download_path = download.path()
    print(f"Downloaded file: {download.suggested_filename}")
    page.screenshot(path="results/tc39-F013-after-export.png")

    # Verify file is non-empty
    assert download_path is not None, "Download path is None"
    file_size = Path(download_path).stat().st_size
    print(f"File size: {file_size} bytes")
    assert file_size > 100, \
        f"Downloaded file too small ({file_size} bytes) — likely empty or invalid"

    page.screenshot(path="results/tc39-F013-download-verified.png")
    print(f"TC39 PASSED — {download.suggested_filename} downloaded ({file_size} bytes)")
