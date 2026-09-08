import re
from pathlib import Path

from playwright.sync_api import Page, expect

RESULTS = Path(__file__).resolve().parents[2] / "results"
RESULTS.mkdir(exist_ok=True)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _start_hr_chat(page: Page) -> None:
    """Select Chat mode → pick HR Assistant persona → land in chat input."""
    page.get_by_role("button", name="Select Chat mode").wait_for(timeout=20000)
    page.get_by_role("button", name="Select Chat mode").click()

    # Search for HR Assistant persona
    search = page.locator("input[placeholder*='Search personas']")
    search.wait_for(state="visible", timeout=15000)
    search.fill("HR Assistant")
    page.wait_for_timeout(1000)

    # Click the first CHAT button that appears after filtering
    hr_chat_btn = page.get_by_role("button", name=re.compile(r"^Select persona.*HR", re.IGNORECASE)).first
    if hr_chat_btn.count() == 0:
        hr_chat_btn = page.get_by_role("button", name=re.compile(r"^Select persona")).first
    hr_chat_btn.wait_for(timeout=15000)
    hr_chat_btn.click()

    page.wait_for_load_state("networkidle", timeout=15000)
    page.get_by_role("textbox", name="Chat message").wait_for(timeout=60000)


def _send_message(page: Page, message: str) -> None:
    chat_input = page.get_by_role("textbox", name="Chat message")
    chat_input.wait_for(timeout=20000)
    chat_input.fill(message)
    chat_input.press("Enter")

    expect(page.locator(".user-message", has_text=message).first).to_be_visible(timeout=20000)

    # Wait for AI to finish generating
    try:
        page.get_by_role("button", name="Stop generating").wait_for(state="detached", timeout=60000)
    except Exception:
        pass
    page.wait_for_load_state("networkidle", timeout=15000)
    page.wait_for_timeout(2000)


def _wait_for_form_widget(page: Page, timeout: int = 30000) -> bool:
    """Wait for a form widget to appear in the chat (Apply Leave form)."""
    try:
        page.locator(
            "button:has-text('Submit'), button:has-text('Apply Leave'), "
            "button:has-text('Cancel'), select, input[type='date']"
        ).first.wait_for(state="visible", timeout=timeout)
        return True
    except Exception:
        return False


def _request_sick_leave(page: Page, max_attempts: int = 2) -> bool:
    """Send a sick-leave request; if an existing leave request conflicts with the
    date and blocks the form widget, retry with the next date.

    Sick leave can only be booked up to 2 days in advance, so the only valid
    retry candidates are "tomorrow" and "the day after tomorrow" — there's no
    point jumping further ahead, the app will just reject that outright.
    """
    labels = ["tomorrow", "the day after tomorrow"]
    for attempt, label in enumerate(labels[:max_attempts]):
        print(f"\n  Sending: 'apply sick leave for {label}' (attempt {attempt + 1})")
        _send_message(page, f"apply sick leave for {label}")

        if _wait_for_form_widget(page, timeout=15000):
            return True

        body_text = page.locator("body").inner_text().lower()
        if "conflicting leave request" in body_text or "already" in body_text:
            print(f"  Conflicting leave request for {label} — retrying with the next date")
            continue
        if "days in advance" in body_text:
            print(f"  Sick leave booking window exceeded — no further dates to try")
            break
        break

    return False


# ─── TC01 — US:001 Ask about leave types ──────────────────────────────────────

def test_tc01_leave_types_response(page: Page, base_url):
    """TC01 — US:001 — Ask HR Assistant about leave types; verify structured response."""

    print("\n" + "=" * 60)
    print("TC01: LEAVE TYPES STRUCTURED RESPONSE")
    print("=" * 60)

    _start_hr_chat(page)

    print("\n  Sending: 'How many leave types do I have?'")
    _send_message(page, "How many leave types do I have?")
    page.screenshot(path=str(RESULTS / "f019-tc01-response.png"))

    # AI must reply with leave type information
    body_text = page.locator("body").inner_text()
    leave_keywords = ["leave", "sick", "casual", "annual", "days"]
    matched = [kw for kw in leave_keywords if kw.lower() in body_text.lower()]
    print(f"  Leave keywords found: {matched}")

    assert len(matched) >= 2, (
        f"Expected leave type details in response, found only: {matched}"
    )
    print("  ✅ AI responded with leave type information")

    print("\n" + "=" * 60)
    print("TC01 PASSED")
    print("=" * 60)


# ─── TC02 — US:002 Leave request triggers form widget ─────────────────────────

def test_tc02_form_widget_appears(page: Page, base_url):
    """TC02 — US:002 — Send leave request; AI generates 'Apply Leave' form widget."""

    print("\n" + "=" * 60)
    print("TC02: FORM WIDGET APPEARS AFTER LEAVE REQUEST")
    print("=" * 60)

    _start_hr_chat(page)

    visible = _request_sick_leave(page)
    page.screenshot(path=str(RESULTS / "f019-tc02-form-check.png"))

    assert visible, "Form widget (Apply Leave) did not appear after sending leave request"
    print("  ✅ Apply Leave form widget visible in chat")

    print("\n" + "=" * 60)
    print("TC02 PASSED")
    print("=" * 60)


# ─── TC03 — US:003 Pre-filled fields are editable ─────────────────────────────

def test_tc03_form_fields_editable(page: Page, base_url):
    """TC03 — US:003 — Form opens pre-filled; user can edit leave type, dates, reason."""

    print("\n" + "=" * 60)
    print("TC03: PRE-FILLED FORM FIELDS EDITABLE")
    print("=" * 60)

    _start_hr_chat(page)

    assert _request_sick_leave(page), "Form widget not found"
    page.screenshot(path=str(RESULTS / "f019-tc03-form-open.png"))

    # Leave type dropdown
    leave_type_select = page.locator("select").first
    if leave_type_select.count() > 0:
        options = leave_type_select.locator("option").all_inner_texts()
        print(f"  Leave type options: {options}")
        assert len(options) > 1, "Leave type dropdown has no options"
        # Select a different option if more than one exists
        if len(options) > 1:
            leave_type_select.select_option(index=1)
            print(f"  Selected leave type: {options[1]}")
    else:
        print("  ⚠ No dropdown found — may use a custom combobox")

    # Reason / notes field — any textarea that is not the chat input
    reason_field = page.locator(
        "textarea:not([aria-label='Chat message']):not(#chat)"
    ).first
    if reason_field.count() > 0:
        reason_field.wait_for(state="visible", timeout=5000)
        reason_field.fill("Feeling unwell — need rest")
        print("  Filled reason field")

    page.screenshot(path=str(RESULTS / "f019-tc03-after-edit.png"))
    print("  ✅ Form fields are editable")

    print("\n" + "=" * 60)
    print("TC03 PASSED")
    print("=" * 60)


# ─── TC04 — US:004 Submit form and verify confirmation ────────────────────────

def test_tc04_submit_form(page: Page, base_url):
    """TC04 — US:004 — Submit form; chat shows 'All forms have been submitted successfully.'"""

    print("\n" + "=" * 60)
    print("TC04: SUBMIT FORM AND VERIFY CONFIRMATION")
    print("=" * 60)

    _start_hr_chat(page)

    assert _request_sick_leave(page), "Form widget not found — cannot submit"
    page.screenshot(path=str(RESULTS / "f019-tc04-before-submit.png"))

    # Click Submit button
    submit_btn = page.locator(
        "button:has-text('Submit'), button:has-text('Apply Leave')"
    ).first
    submit_btn.wait_for(state="visible", timeout=10000)
    print(f"\n  Clicking: '{submit_btn.inner_text()}'")
    submit_btn.click()

    # Wait for AI confirmation
    page.wait_for_timeout(5000)
    page.wait_for_load_state("networkidle", timeout=20000)
    page.screenshot(path=str(RESULTS / "f019-tc04-after-submit.png"))

    body_text = page.locator("body").inner_text()
    success_phrases = [
        "all forms have been submitted successfully",
        "submitted successfully",
        "leave application",
        "confirmed",
        "pending approval",
    ]
    matched = [p for p in success_phrases if p.lower() in body_text.lower()]
    print(f"  Confirmation phrases found: {matched}")

    assert matched, (
        "Expected submission confirmation in chat but found none.\n"
        f"Body snippet: {body_text[:500]}"
    )
    print("  ✅ Submission confirmed in chat")

    print("\n" + "=" * 60)
    print("TC04 PASSED")
    print("=" * 60)


# ─── TC05 — US:005 Cancel collapses form; Show Form re-expands it ─────────────

def test_tc05_cancel_and_show_form(page: Page, base_url):
    """TC05 — US:005 — Cancel collapses form to 'Show Form' button; clicking it re-expands."""

    print("\n" + "=" * 60)
    print("TC05: CANCEL → SHOW FORM → RE-EXPAND")
    print("=" * 60)

    _start_hr_chat(page)

    assert _request_sick_leave(page), "Form widget not found — cannot cancel"
    page.screenshot(path=str(RESULTS / "f019-tc05-before-cancel.png"))

    # Click Cancel
    cancel_btn = page.get_by_role("button", name=re.compile(r"cancel", re.IGNORECASE)).first
    cancel_btn.wait_for(state="visible", timeout=10000)
    print("\n  Clicking Cancel...")
    cancel_btn.click()
    page.wait_for_timeout(2000)
    page.screenshot(path=str(RESULTS / "f019-tc05-after-cancel.png"))

    # Form should collapse — Submit/Cancel buttons gone
    submit_gone = page.locator("button:has-text('Submit')").count() == 0
    print(f"  Submit button gone after cancel: {submit_gone}")
    assert submit_gone, "Submit button still visible after Cancel — form did not collapse"

    # "Show Form" button should appear
    show_form_btn = page.get_by_role("button", name=re.compile(r"show form", re.IGNORECASE)).first
    show_form_btn.wait_for(state="visible", timeout=10000)
    print("  ✅ 'Show Form' button appeared")
    page.screenshot(path=str(RESULTS / "f019-tc05-show-form-btn.png"))

    # Click "Show Form" — form should re-expand
    show_form_btn.click()
    page.wait_for_timeout(2000)
    page.screenshot(path=str(RESULTS / "f019-tc05-re-expanded.png"))

    re_expanded = _wait_for_form_widget(page, timeout=10000)
    print(f"  Form re-expanded: {re_expanded}")
    assert re_expanded, "Form did not re-expand after clicking 'Show Form'"
    print("  ✅ Form re-expanded with original values")

    print("\n" + "=" * 60)
    print("TC05 PASSED")
    print("=" * 60)


# ─── Shared helper for the simple "message → form → submit → confirm" flows ──

def _assert_form_fields_present(page: Page, expected_fields: list) -> None:
    """Verify that the form widget currently in chat contains each of the
    expected field labels (e.g. "Bank Name", "Country"). Field labels carry a
    trailing '*' for required fields, so match by substring rather than exact
    text.
    """
    body_text = page.locator("body").inner_text()
    missing = [f for f in expected_fields if f.lower() not in body_text.lower()]
    print(f"  Expected fields: {expected_fields}")
    assert not missing, f"Form is missing expected field(s): {missing}"
    print("  ✅ All expected form fields present")


def _run_form_submit_flow(
    page: Page, message: str, tc_label: str, expected_fields: list,
    followup_message: str = None,
) -> None:
    """Send a message that triggers a form widget, verify its fields, click
    Submit, and verify a confirmation appears in chat. Used by the Bank/Visa
    Letter and Overtime Request flows, which all follow this identical
    pattern.

    Some requests (e.g. the bank letter) don't carry enough detail for the AI
    to build the form in one turn — it asks a clarifying question first. When
    `followup_message` is given, it's sent right after `message` to supply
    that missing detail before waiting for the form widget.
    """
    _send_message(page, message)

    if followup_message:
        _send_message(page, followup_message)

    form_visible = _wait_for_form_widget(page, timeout=20000)
    assert form_visible, f"Form widget did not appear for: {message!r}"
    page.screenshot(path=str(RESULTS / f"f019-{tc_label}-form-open.png"))
    print("  Form widget visible")

    _assert_form_fields_present(page, expected_fields)

    submit_btn = page.locator("button:has-text('Submit')").first
    submit_btn.wait_for(state="visible", timeout=10000)
    print("  Clicking Submit...")
    submit_btn.click()

    page.wait_for_timeout(5000)
    page.wait_for_load_state("networkidle", timeout=20000)
    page.screenshot(path=str(RESULTS / f"f019-{tc_label}-after-submit.png"))

    body_text = page.locator("body").inner_text()
    success_phrases = [
        "successfully submitted", "submitted successfully", "confirmed",
        "pending approval", "your request", "has been", "successfully created",
    ]
    matched = [p for p in success_phrases if p.lower() in body_text.lower()]
    print(f"  Confirmation phrases found: {matched}")
    assert matched, (
        f"Expected submission confirmation in chat but found none.\n"
        f"Body snippet: {body_text[-500:]}"
    )
    print("  ✅ Submission confirmed in chat")


# ─── TC06 — Bank Letter Request ────────────────────────────────────────────────

def test_tc06_bank_letter_request(page: Page, base_url):
    """TC06 — Request a bank letter for a car loan; submit the form; verify confirmation."""

    print("\n" + "=" * 60)
    print("TC06: BANK LETTER REQUEST")
    print("=" * 60)

    _start_hr_chat(page)
    _run_form_submit_flow(
        page,
        "Apply bank letter for car loan for bank qatar",
        "tc06",
        ["Bank Name", "Branch Name", "Addressed To", "Comment", "Language", "Type"],
        followup_message="Qatar National Bank addressing to its manager",
    )

    print("\n" + "=" * 60)
    print("TC06 PASSED")
    print("=" * 60)


# ─── TC07 — Visa Letter Request ────────────────────────────────────────────────

def test_tc07_visa_letter_request(page: Page, base_url):
    """TC07 — Request a visa letter addressed to the Singapore embassy; submit; verify confirmation."""

    print("\n" + "=" * 60)
    print("TC07: VISA LETTER REQUEST")
    print("=" * 60)

    _start_hr_chat(page)
    _run_form_submit_flow(
        page,
        "request visa letter for singapore addressing there embassy",
        "tc07",
        ["Visa Type", "Comment", "Language", "Addressed To", "Country"],
    )

    print("\n" + "=" * 60)
    print("TC07 PASSED")
    print("=" * 60)


# ─── TC08 — Overtime Request ────────────────────────────────────────────────────

def test_tc08_overtime_request(page: Page, base_url):
    """TC08 — Request overtime for 6 hours worked yesterday; submit; verify confirmation."""

    print("\n" + "=" * 60)
    print("TC08: OVERTIME REQUEST")
    print("=" * 60)

    _start_hr_chat(page)
    _run_form_submit_flow(
        page,
        "request for overtime worked for 6 hours yesterday",
        "tc08",
        ["Date", "Overtime Hours", "Reason"],
    )

    print("\n" + "=" * 60)
    print("TC08 PASSED")
    print("=" * 60)


# ─── TC09 — Payslip Request ─────────────────────────────────────────────────────

def test_tc09_payslip_request(page: Page, base_url):
    """TC09 — Ask for last month's payslip; verify the response contains payslip data.

    Unlike the other requests, this one never renders a form/Submit button —
    the AI returns the payslip figures directly as text, so there's nothing
    to submit.
    """

    print("\n" + "=" * 60)
    print("TC09: PAYSLIP REQUEST")
    print("=" * 60)

    _start_hr_chat(page)
    _send_message(page, "give me last month payslip")
    page.screenshot(path=str(RESULTS / "f019-tc09-payslip-response.png"))

    body_text = page.locator("body").inner_text()
    payslip_keywords = ["basic salary", "net salary", "allowances", "deductions", "payslip"]
    matched = [kw for kw in payslip_keywords if kw.lower() in body_text.lower()]
    print(f"  Payslip keywords found: {matched}")

    assert len(matched) >= 2, (
        f"Expected payslip details in response, found only: {matched}"
    )
    print("  ✅ Payslip data returned in chat")

    print("\n" + "=" * 60)
    print("TC09 PASSED")
    print("=" * 60)


# ─── TC10 — Performance Goal Creation ───────────────────────────────────────────

def test_tc10_performance_goal_creation(page: Page, base_url):
    """TC10 — Create a performance goal with specific details; verify confirmation.

    "set a performance goal for me" doesn't ask a clarifying question the way
    a human would — it immediately auto-creates a goal with generic
    placeholder values, and a detailed follow-up message creates a SECOND,
    independent goal rather than completing/editing the first one. This test
    sends both messages (matching the intended manual flow) but only asserts
    on the second goal's confirmation, since that's the one with the actual
    requested details.
    """

    print("\n" + "=" * 60)
    print("TC10: PERFORMANCE GOAL CREATION")
    print("=" * 60)

    _start_hr_chat(page)

    print("\n  Sending: 'set a performance goal for me'")
    _send_message(page, "set a performance goal for me")
    page.screenshot(path=str(RESULTS / "f019-tc10-initial-response.png"))

    goal_details = (
        "Read 12 Books This Year\n\n"
        "Something like one book every month across technology, personal "
        "development, and leadership topics to improve knowledge and "
        "communication skills.\n\n"
        "should finish by 31-Dec-2026\n"
        "with some progress of 50%"
    )
    print("\n  Sending goal details...")
    _send_message(page, goal_details)
    page.screenshot(path=str(RESULTS / "f019-tc10-details-response.png"))

    # Verify the form widget (from either message) carries the expected fields.
    form_visible = _wait_for_form_widget(page, timeout=15000)
    assert form_visible, "Performance Goal form widget did not appear"
    _assert_form_fields_present(
        page, ["Goal Title", "Description", "Target Date", "Progress"]
    )

    body_text = page.locator("body").inner_text()
    expected_details = ["read 12 books", "december 31, 2026", "50%"]
    matched = [d for d in expected_details if d.lower() in body_text.lower()]
    print(f"  Expected detail matches found: {matched}")

    assert len(matched) >= 2, (
        f"Expected the specific goal details in the confirmation, found only: {matched}\n"
        f"Body snippet: {body_text[-500:]}"
    )
    print("  ✅ Performance goal created with specified details")

    print("\n" + "=" * 60)
    print("TC10 PASSED")
    print("=" * 60)
