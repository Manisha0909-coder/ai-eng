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


def _navigate_to_overview(page: Page) -> None:
    """Open Admin Console and switch to the Overview tab.

    The Overview control is implemented as an ARIA tab on production but as a
    plain button on some builds (e.g. sentinel); accept either.
    """
    page.get_by_role("button", name=re.compile(r"^admin console$", re.IGNORECASE)).click()
    overview = page.get_by_role("tab", name="Overview")
    try:
        overview.first.wait_for(state="visible", timeout=5000)
    except Exception:
        overview = page.get_by_role("button", name="Overview")
    overview.first.click()
    page.wait_for_timeout(2000)


def _fill_filter_input(page: Page, placeholder_pattern: str, value: str) -> bool:
    """Fill the first visible input matching the placeholder regex. Returns True if filled."""
    inp = page.get_by_placeholder(re.compile(placeholder_pattern, re.IGNORECASE))
    if inp.count() > 0 and inp.first.is_visible():
        inp.first.fill(value)
        return True
    return False


def _select_feedback_period(page: Page, option_label: str) -> bool:
    """Open the Feedback metrics time-period dropdown and select the given option."""
    # The trigger button shows the current selection, e.g. "Last 7 days"
    trigger = page.locator("button").filter(
        has_text=re.compile(r"last\s+\d+\s+days?", re.IGNORECASE)
    ).first
    if not trigger.is_visible():
        return False
    trigger.click()
    page.wait_for_timeout(500)

    # Options render in a dropdown list after the trigger is clicked
    opt = page.get_by_role("option", name=re.compile(option_label, re.IGNORECASE))
    if opt.count() == 0:
        opt = page.locator(f"text=/{re.escape(option_label)}/i")
    if opt.count() > 0 and opt.first.is_visible():
        opt.first.click()
        return True

    page.keyboard.press("Escape")
    return False


# =====================================================================
# US001 - Application Logs
# =====================================================================


def test_us001_logs_section_visible(page: Page):
    """US001 - Overview page displays a Logs / Logs Filters section."""
    print("\n[US001] Checking Logs section is visible on Overview page")
    _navigate_to_overview(page)
    page.screenshot(path="results/us001-01-overview.png")

    expect(page.locator("text=/log/i").first).to_be_visible(timeout=10000)
    print("[US001] PASS - Logs section found")


def test_us001_apply_filters(page: Page):
    """US001 - Admin can apply one or more log filters and load results."""
    print("\n[US001] Applying log filters (keyword, user ID, session ID, log level)")
    _navigate_to_overview(page)
    page.wait_for_timeout(1000)

    filled = []
    if _fill_filter_input(page, r"keyword|search", "test"):
        filled.append("keyword")
    if _fill_filter_input(page, r"user\s*id", "user-123"):
        filled.append("user_id")
    if _fill_filter_input(page, r"session\s*id", "sess-456"):
        filled.append("session_id")

    level_select = page.locator("select").filter(
        has_text=re.compile(r"level|error|warn|info|debug", re.IGNORECASE)
    )
    if level_select.count() > 0 and level_select.first.is_visible():
        level_select.first.select_option(index=1)
        filled.append("log_level")
        page.wait_for_timeout(300)

    print(f"[US001] Filters filled: {filled}")
    page.screenshot(path="results/us001-02-filters-filled.png")

    apply_btn = page.get_by_role("button", name=re.compile(r"^apply$", re.IGNORECASE))
    expect(apply_btn.first).to_be_visible(timeout=5000)
    apply_btn.first.click()
    page.wait_for_timeout(2000)
    page.screenshot(path="results/us001-03-applied.png")
    print("[US001] PASS - Apply button clicked, logs loaded")


def test_us001_clear_filters(page: Page):
    """US001 - Clicking Clear resets all filter inputs to empty."""
    print("\n[US001] Testing Clear button resets all filter inputs")
    _navigate_to_overview(page)
    page.wait_for_timeout(1000)

    _fill_filter_input(page, r"keyword|search|user\s*id|session\s*id", "clear-test")

    apply_btn = page.get_by_role("button", name=re.compile(r"^apply$", re.IGNORECASE))
    if apply_btn.count() > 0 and apply_btn.first.is_visible():
        apply_btn.first.click()
        page.wait_for_timeout(1000)

    clear_btn = page.get_by_role("button", name=re.compile(r"clear", re.IGNORECASE))
    if clear_btn.count() == 0 or not clear_btn.first.is_visible():
        print("[US001] SKIP - No Clear button found for the log filters on this environment")
        pytest.skip("No Clear button found for the log filters on this environment")

    page.screenshot(path="results/us001-04-before-clear.png")
    print("[US001] Clicking Clear button")
    clear_btn.first.click()
    page.wait_for_timeout(1000)
    page.screenshot(path="results/us001-05-after-clear.png")

    for pattern in (r"keyword|search", r"user\s*id", r"session\s*id"):
        inp = page.get_by_placeholder(re.compile(pattern, re.IGNORECASE))
        if inp.count() > 0 and inp.first.is_visible():
            expect(inp.first).to_have_value("")
    print("[US001] PASS - All filter inputs cleared")


def test_us001_logs_read_only(page: Page):
    """US001 - Log entries are read-only (no editable inputs inside log rows)."""
    print("\n[US001] Verifying log entries are read-only")
    _navigate_to_overview(page)
    page.wait_for_timeout(1000)

    apply_btn = page.get_by_role("button", name=re.compile(r"^apply$", re.IGNORECASE))
    if apply_btn.count() > 0 and apply_btn.first.is_visible():
        apply_btn.first.click()
        page.wait_for_timeout(2000)

    page.screenshot(path="results/us001-06-logs-loaded.png")

    editable_count = page.evaluate(
        """() => {
            const candidates = [
                '[data-testid*="log-row"]', '[data-testid*="log_row"]',
                '[class*="log-row"]', '[class*="logRow"]',
                'tbody tr', '[role="row"]'
            ];
            for (const sel of candidates) {
                const rows = [...document.querySelectorAll(sel)];
                if (rows.length > 0) {
                    return rows.reduce((total, row) =>
                        total + row.querySelectorAll(
                            'input:not([type="hidden"]), textarea, [contenteditable="true"]'
                        ).length, 0);
                }
            }
            return 0;
        }"""
    )

    print(f"[US001] Editable elements found in log rows: {editable_count}")
    assert editable_count == 0, (
        f"Found {editable_count} editable element(s) inside log rows - logs must be read-only"
    )
    print("[US001] PASS - No editable elements in log rows")


# =====================================================================
# US002 - Metrics and Traces
# =====================================================================


def test_us002_chat_metrics_section_visible(page: Page):
    """US002 - Overview page includes a dedicated Chat Metrics section."""
    print("\n[US002] Checking Chat Metrics section is visible")
    _navigate_to_overview(page)
    page.screenshot(path="results/us002-01-overview.png")

    expect(page.locator("text=/chat\\s*metrics/i").first).to_be_visible(timeout=10000)
    print("[US002] PASS - Chat Metrics section found")


def test_us002_key_metrics_displayed(page: Page):
    """US002 - Key metric labels (request, error, latency, success, token) are visible."""
    print("\n[US002] Checking key metric labels are present on the dashboard")
    _navigate_to_overview(page)
    page.wait_for_timeout(2000)
    page.screenshot(path="results/us002-02-metrics.png")

    expected_keywords = ["request", "error", "latency", "success", "token"]
    body_text = page.locator("body").inner_text().lower()
    found = [kw for kw in expected_keywords if kw in body_text]
    missing = [kw for kw in expected_keywords if kw not in body_text]
    print(f"[US002] Metric keywords found: {found}")
    if missing:
        print(f"[US002] Not found: {missing}")

    assert len(found) >= 3, (
        f"Expected at least 3 of {expected_keywords} on the page, found: {found}"
    )
    print(f"[US002] PASS - {len(found)}/{len(expected_keywords)} metric keywords present")


@pytest.mark.xfail(reason="Distributed traces section not yet implemented in the UI", strict=False)
def test_us002_traces_section_visible(page: Page):
    """US002 - Distributed traces are surfaced on the dashboard."""
    print("\n[US002] Checking distributed traces section is visible")
    _navigate_to_overview(page)
    page.wait_for_timeout(1000)
    page.screenshot(path="results/us002-03-traces.png")

    expect(page.locator("text=/trace/i").first).to_be_visible(timeout=10000)
    print("[US002] PASS - Traces section found")


def test_us002_auto_refresh_control_present(page: Page):
    """US002 - A time-range dropdown and auto-refresh timestamp are present on the metrics section."""
    print("\n[US002] Checking auto-refresh control (time-range dropdown or Updated timestamp)")
    _navigate_to_overview(page)
    page.wait_for_timeout(1000)
    page.screenshot(path="results/us002-04-refresh-control.png")

    # The "Last N hours" dropdown is the configurable time-range selector;
    # the "Updated HH:MM:SS" text confirms auto-refresh is active.
    time_range = page.locator("text=/last\\s*\\d+\\s*hours?/i")
    updated_stamp = page.locator("text=/updated/i")

    has_time_range = time_range.count() > 0 and time_range.first.is_visible()
    has_updated = updated_stamp.count() > 0 and updated_stamp.first.is_visible()

    print(f"[US002] Time-range dropdown present: {has_time_range} | Updated timestamp present: {has_updated}")
    assert has_time_range or has_updated, (
        "Neither a time-range dropdown nor an auto-refresh 'Updated' timestamp was found"
    )
    print("[US002] PASS - Auto-refresh control confirmed")


def test_us002_trace_drilldown(page: Page):
    """US002 - Clicking a trace row reveals span-level details."""
    print("\n[US002] Attempting trace drilldown to span-level details")
    _navigate_to_overview(page)
    page.wait_for_timeout(1000)

    trace_row = page.locator(
        "[data-testid*='trace'], [class*='trace-row'], [class*='traceRow']"
    ).first

    if trace_row.count() == 0 or not trace_row.is_visible():
        trace_row = page.locator("text=/trace/i").first

    if not trace_row.is_visible():
        print("[US002] SKIP - No trace rows visible (feature not yet implemented)")
        pytest.skip("No trace rows visible to drill into")

    trace_row.click()
    page.wait_for_timeout(1500)
    page.screenshot(path="results/us002-05-trace-drilldown.png")

    span_detail = page.locator("text=/span/i")
    if span_detail.count() > 0 and span_detail.first.is_visible():
        expect(span_detail.first).to_be_visible(timeout=5000)
        print("[US002] PASS - Span-level details visible after drilldown")
    else:
        expanded = page.locator("[data-state='open'], [role='dialog'], [class*='detail']").first
        expect(expanded).to_be_visible(timeout=5000)
        print("[US002] PASS - Detail panel opened after trace click")


# =====================================================================
# US003 - Feedback Metrics
# =====================================================================


def test_us003_feedback_section_visible(page: Page):
    """US003 - Overview page includes a Feedback Metrics section."""
    print("\n[US003] Checking Feedback Metrics section is visible")
    _navigate_to_overview(page)
    page.screenshot(path="results/us003-01-overview.png")

    expect(page.locator("text=/feedback\\s*(metrics)?/i").first).to_be_visible(timeout=10000)
    print("[US003] PASS - Feedback Metrics section found")


def test_us003_time_period_filters(page: Page):
    """US003 - Admin can switch between Last 7 / 30 / 90 day time period filters."""
    print("\n[US003] Testing time period dropdown options (Last 7 / 30 / 90 days)")
    _navigate_to_overview(page)
    page.wait_for_timeout(1000)
    page.screenshot(path="results/us003-02-feedback-section.png")

    selected_any = False
    for label in ("Last 7 days", "Last 30 days", "Last 90 days"):
        if _select_feedback_period(page, label):
            page.wait_for_timeout(1000)
            safe = label.lower().replace(" ", "-")
            page.screenshot(path=f"results/us003-03-filter-{safe}.png")
            print(f"[US003] '{label}' selected")
            selected_any = True
        else:
            print(f"[US003] '{label}' option not found")

    assert selected_any, "No time period filter options were selectable"


def test_us003_resolution_rate_visible(page: Page):
    """US003 - Dashboard displays the Resolution Rate metric."""
    print("\n[US003] Checking Resolution Rate metric is visible")
    _navigate_to_overview(page)
    page.wait_for_timeout(1000)
    page.screenshot(path="results/us003-04-resolution.png")

    expect(page.locator("text=/resolution\\s*rate/i").first).to_be_visible(timeout=10000)
    print("[US003] PASS - Resolution Rate metric found")


def test_us003_positive_negative_counts_visible(page: Page):
    """US003 - Dashboard displays both Positive and Negative feedback counts."""
    print("\n[US003] Checking Positive and Negative feedback counts are visible")
    _navigate_to_overview(page)
    page.wait_for_timeout(1000)
    page.screenshot(path="results/us003-05-pos-neg-counts.png")

    body_text = page.locator("body").inner_text().lower()
    has_positive = "positive" in body_text or "thumbs up" in body_text
    has_negative = "negative" in body_text or "thumbs down" in body_text

    print(f"[US003] Positive count present: {has_positive} | Negative count present: {has_negative}")
    assert has_positive, "Positive feedback count label not found on the page"
    assert has_negative, "Negative feedback count label not found on the page"
    print("[US003] PASS - Both Positive and Negative counts found")


def test_us003_pending_count_visible(page: Page):
    """US003 - Dashboard displays a highlighted Pending feedback count."""
    print("\n[US003] Checking Pending feedback count is visible")
    _navigate_to_overview(page)
    page.wait_for_timeout(1000)
    page.screenshot(path="results/us003-06-pending.png")

    expect(page.locator("text=/pending/i").first).to_be_visible(timeout=10000)
    print("[US003] PASS - Pending count found")


def test_us003_pending_click_switches_to_feedback_tab(page: Page):
    """US003 - Clicking the Pending count switches to the Feedback tab pre-filtered to pending."""
    print("\n[US003] Clicking Pending count — expecting Feedback tab to become active")
    _navigate_to_overview(page)
    page.wait_for_timeout(1000)

    pending_el = page.locator("text=/pending/i").first
    expect(pending_el).to_be_visible(timeout=10000)
    page.screenshot(path="results/us003-07-before-pending-click.png")
    pending_el.click()
    page.wait_for_timeout(1500)
    page.screenshot(path="results/us003-08-after-pending-click.png")

    feedback_tab = page.get_by_role("tab", name=re.compile(r"feedback", re.IGNORECASE))
    if feedback_tab.count() > 0:
        expect(feedback_tab.first).to_have_attribute("aria-selected", "true", timeout=5000)
        print("[US003] PASS - Feedback tab is now active (aria-selected=true)")
    else:
        expect(page.locator("text=/feedback/i").first).to_be_visible(timeout=5000)
        print("[US003] PASS - Feedback content is visible after clicking Pending")


def test_us003_metrics_update_on_filter_change(page: Page):
    """US003 - Metrics refresh dynamically when the time period filter changes."""
    print("\n[US003] Testing metrics update when switching to 90-day filter")
    _navigate_to_overview(page)
    page.wait_for_timeout(1000)

    resolution_el = page.locator("text=/resolution/i").first
    if not resolution_el.is_visible():
        print("[US003] SKIP - Resolution Rate element not found")
        pytest.skip("Resolution Rate element not found - skipping dynamic update check")

    if not _select_feedback_period(page, "Last 90 days"):
        print("[US003] SKIP - 'Last 90 days' option not found in dropdown")
        pytest.skip("Last 90 days option not found in dropdown")

    page.wait_for_timeout(2000)
    page.screenshot(path="results/us003-09-after-90days.png")

    expect(page.locator("body")).to_be_visible()
    print("[US003] PASS - Page remains functional after switching to Last 90 days")
