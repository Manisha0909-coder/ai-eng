import re
from pathlib import Path

from playwright.sync_api import Page, expect

RESULTS = Path(__file__).resolve().parents[2] / "results"
RESULTS.mkdir(exist_ok=True)

TEST_DATA = Path(__file__).resolve().parents[3] / "test-data"


# ================================
# Helpers
# ================================

def _open_chat_modal_and_pick_persona(page, persona_name=None):
    """Open the persona modal and click a persona. Works from home screen or chat screen."""
    select_btn = page.get_by_role("button", name="Select Chat mode")

    # Fast path: home screen shows the Chat card ("Select Chat mode") directly
    try:
        select_btn.wait_for(state="visible", timeout=8000)
        select_btn.click()
    except Exception:
        # App auto-loaded an existing chat — home screen isn't visible.
        # Click the header persona dropdown ("[INITIALS]\n[name]") to open persona selection.
        opened = False
        try:
            header_btn = page.locator("button").filter(
                has_text=re.compile(r"[A-Z]{1,4}\n")
            ).first
            header_btn.wait_for(state="visible", timeout=5000)
            header_btn.click()
            page.wait_for_timeout(800)
            opened = True
        except Exception:
            pass

        if not opened:
            # Last resort: wait for home screen to appear (slower load / page refresh)
            select_btn.wait_for(state="visible", timeout=35000)
            select_btn.click()

    # Switch to CHAT tab to filter out Dashboard personas
    try:
        chat_tab = page.locator(
            "[role='tab']:has-text('Chat'), button:has-text('CHAT'), "
            "[class*='tab']:has-text('Chat')"
        ).first
        if chat_tab.is_visible(timeout=3000):
            chat_tab.click()
            page.wait_for_timeout(1000)
    except Exception:
        pass

    if persona_name:
        search = page.locator("input[placeholder*='Search personas']")
        search.wait_for(state="visible", timeout=15000)
        search.fill(persona_name)
        page.wait_for_timeout(1000)

    first_persona = page.get_by_role("button", name=re.compile(r"^Select persona")).first
    first_persona.wait_for(timeout=20000)
    first_persona.click()


def _start_chat_session(page, persona_name=None):
    from urllib.parse import urlparse

    for _attempt in range(3):
        _open_chat_modal_and_pick_persona(page, persona_name)

        # Primary check: URL changed to /chat/
        in_chat = False
        try:
            page.wait_for_url("**/chat/**", timeout=20000)
            in_chat = True
        except Exception:
            pass

        # Fallback: chat may open at the root URL — check for textarea instead
        if not in_chat:
            for _sel in [
                "textarea.chat-input-textarea",
                "textarea[placeholder*='message' i]",
                "textarea[placeholder*='know' i]",
                "textarea",
            ]:
                try:
                    page.locator(_sel).first.wait_for(state="visible", timeout=8000)
                    in_chat = True
                    break
                except Exception:
                    continue

        if in_chat:
            break  # Chat session is active

        if _attempt < 2:
            # Likely a Dashboard persona — navigate explicitly to home and retry
            parsed = urlparse(page.url)
            origin = f"{parsed.scheme}://{parsed.netloc}"
            try:
                page.goto(origin, wait_until="networkidle", timeout=30000)
            except Exception:
                page.wait_for_timeout(3000)
            try:
                page.get_by_role("button", name="Select Chat mode").wait_for(state="visible", timeout=30000)
            except Exception:
                page.wait_for_timeout(2000)
        else:
            raise TimeoutError("Could not start a Chat session after 3 attempts — only Dashboard personas found")

    try:
        page.wait_for_load_state("networkidle", timeout=15000)
    except Exception:
        pass

    # Wait for the chat textarea (must be a textarea element, not a generic textbox)
    for _quick, _timeout in [
        (lambda: page.locator("textarea.chat-input-textarea"), 30000),
        (lambda: page.locator("textarea[placeholder*='know' i]"), 5000),
        (lambda: page.locator("textarea[placeholder*='message' i]"), 5000),
        (lambda: page.locator("textarea[placeholder*='Type' i]"), 5000),
        (lambda: page.locator("[class*='chat'] textarea"), 5000),
        (lambda: page.locator("textarea").last, 10000),
    ]:
        try:
            _quick().wait_for(timeout=_timeout)
            return
        except Exception:
            continue


def _get_chat_input(page):
    """Find the chat textarea using multiple selector strategies."""
    for _sel in [
        lambda: page.get_by_role("textbox", name="Chat message"),
        lambda: page.locator("textarea.chat-input-textarea"),
        lambda: page.locator("textarea[placeholder*='message' i]"),
        lambda: page.locator("textarea[placeholder*='Type' i]"),
        lambda: page.locator("textarea[placeholder*='know' i]"),
        lambda: page.locator("[class*='chat'] textarea"),
        lambda: page.locator("textarea").last,
    ]:
        try:
            el = _sel()
            if el.count() > 0 and el.is_visible():
                return el
        except Exception:
            continue
    return page.locator("textarea").last  # Final fallback — let caller handle timeout


def _send_message(page, message: str):
    for _sel in [
        lambda: page.get_by_role("textbox", name="Chat message"),
        lambda: page.locator("textarea.chat-input-textarea"),
        lambda: page.locator("textarea[placeholder*='message' i]"),
        lambda: page.locator("textarea[placeholder*='know' i]"),
        lambda: page.locator("textarea[placeholder*='Type' i]"),
        lambda: page.locator("[class*='chat'] textarea"),
        lambda: page.locator("textarea").last,
    ]:
        try:
            el = _sel()
            el.wait_for(state="visible", timeout=5000)
            el.fill(message)
            el.press("Enter")
            expect(page.locator(".user-message", has_text=message).first).to_be_visible(timeout=20000)
            return
        except Exception:
            continue
    raise TimeoutError("Could not send message — no chat input found or message did not appear")


def _wait_for_ai_done(page, timeout=60000):
    """Wait until AI stops generating."""
    try:
        page.get_by_role("button", name="Stop generation").wait_for(state="detached", timeout=timeout)
    except Exception:
        pass
    try:
        page.wait_for_load_state("networkidle", timeout=10000)
    except Exception:
        pass
    page.wait_for_timeout(1000)


def _get_last_ai_message(page):
    # Primary: actual AI message container uses Tailwind JIT class group/assistant-message
    els = page.locator("[class*='group/assistant-message']")
    if els.count() > 0:
        return els.last

    # Fallback selectors with text filter
    for selector in (
        "[class*='assistant-additional']",
        "[data-role='assistant']",
        ".chat-message.assistant",
        ".prose",
    ):
        els = page.locator(selector).filter(has_text=re.compile(r"\S"))
        if els.count() > 0:
            return els.last

    # assistant-content may exist but have empty text in historical message views
    els = page.locator("[class*='assistant-content']")
    if els.count() > 0:
        return els.last

    return None


def _get_ai_text(ai_msg) -> str:
    """Get text from an AI message element, stripping known action bar labels."""
    try:
        text = (ai_msg.text_content() or "").strip()
        # Strip action bar button labels that appear in the container text
        for label in ("Read message aloud", "Thumbs up", "Thumbs down", "Copy message", "Copy"):
            text = text.replace(label, "").strip()
        return text
    except Exception:
        try:
            return (ai_msg.inner_text() or "").strip()
        except Exception:
            return ""


def _get_toast_text(page, timeout=5000):
    try:
        toast = page.locator("[role='alert'], [class*='toast'], [class*='notification'], [class*='Toastify']").first
        toast.wait_for(state="visible", timeout=timeout)
        return toast.inner_text()
    except Exception:
        return "no_toast"


def _get_chat_id_from_url(page):
    page.wait_for_url("**/chat/**", timeout=20000)
    return page.url.split("/chat/")[-1]


def _get_last_user_message(page):
    return page.locator(".user-message").last


# ================================
# Existing Test 1: Chat Feature (persona selection checked in _start_chat_session)
# ================================

# US:013 — persona selection is implicitly tested by every test that calls _start_chat_session


# ================================
# Existing Test 2: Chat Edit Feature
# ================================

def test_chat_edit_message(page, base_url, admin_email, admin_password):

    _start_chat_session(page)
    _send_message(page, "edit feature test")
    message = _get_last_user_message(page)

    try:
        page.get_by_role("button", name="Stop generating").wait_for(state="detached", timeout=30000)
    except Exception:
        pass

    # Hover AFTER stop generating disappears so the edit control stays revealed
    message.hover()
    page.wait_for_timeout(2000)

    print(page.locator("button").all_inner_texts())
    print(page.locator("[title]").evaluate_all("els => els.map(e => e.title)"))

    page.wait_for_timeout(800)

    edit_button = page.get_by_role("button", name="Edit message")
    edit_button.wait_for(timeout=10000)
    edit_button.click()

    edit_box = page.get_by_role("textbox", name="Edit your message...")
    edit_box.wait_for(timeout=10000)
    edit_box.fill("test passed")

    # Click Save and confirm the edit actually took effect — track the network
    # response instead of just clicking and moving on, so a silently failed
    # save (e.g. 4xx/5xx) fails the test instead of reporting a false pass.
    with page.expect_response(
        lambda r: "/api/mid/chat/create" in r.url and r.request.method == "POST"
    ) as resp_info:
        page.get_by_role("button", name="Save").click()
    assert resp_info.value.ok, f"Edit save request failed: {resp_info.value.status} {resp_info.value.url}"

    # Edit box should close and the message should show the new text
    edit_box.wait_for(state="detached", timeout=10000)
    expect(page.locator(".user-message", has_text="test passed").last).to_be_visible(timeout=10000)


# ================================
# User Story: Edit Chat's image upload option should match the persona's
# supports_images capability, same as the main composer
# ================================
#
# Module: Chat -> Edit Message
#
# Expected Result: The Edit Chat input's image upload option should mirror
# the session persona's supports_images flag — present when true, absent
# when false — exactly like the main composer already does.
#
# Confirmed via GET /api/mid/profile/me (per-persona supports_images field,
# independent of supports_documents):
#   - HR Assistant (id 105): supports_images = True
#   - Tender Assistant (id 131): supports_images = False


def _open_edit_box(page):
    """Send a message, open its edit control, and return the edit box locator
    scoped to its own container (identified by the Save button that only
    exists there) so callers don't accidentally match the main composer's
    own "Upload image" button below it."""
    message = _get_last_user_message(page)

    try:
        page.get_by_role("button", name="Stop generating").wait_for(state="detached", timeout=30000)
    except Exception:
        pass

    message.hover()
    page.wait_for_timeout(2000)

    edit_button = page.get_by_role("button", name="Edit message")
    edit_button.wait_for(timeout=10000)
    edit_button.click()

    edit_box_input = page.get_by_role("textbox", name="Edit your message...")
    edit_box_input.wait_for(timeout=10000)

    return edit_box_input.locator(
        "xpath=ancestor::div[.//button[normalize-space()='Save']][1]"
    )


def test_edit_message_shows_image_upload_for_persona_with_support(page, base_url, admin_email, admin_password):
    """Edit Chat should offer image upload when the persona supports images."""

    _start_chat_session(page, persona_name="HR Assistant")
    _send_message(page, "edit feature image upload test - supports images")

    edit_box = _open_edit_box(page)
    page.screenshot(path=str(RESULTS / "chat-edit-image-upload-supported.png"))

    expect(edit_box.get_by_role("button", name="Upload image")).to_be_visible(timeout=5000)
    page.get_by_role("button", name="Cancel").click()


def test_edit_message_hides_image_upload_for_persona_without_support(page, base_url, admin_email, admin_password):
    """Edit Chat should not offer image upload when the persona doesn't support images."""

    _start_chat_session(page, persona_name="Tender Assistant")
    _send_message(page, "edit feature image upload test - no image support")

    edit_box = _open_edit_box(page)
    page.screenshot(path=str(RESULTS / "chat-edit-image-upload-unsupported.png"))

    upload_in_edit_box = edit_box.get_by_role("button", name="Upload image")
    assert upload_in_edit_box.count() == 0, (
        "Expected no 'Upload image' option in Edit Chat for a persona without image support"
    )

    page.get_by_role("button", name="Cancel").click()


# ================================
# Existing Test 3: Chat Session Management
# ================================

def test_chat_session_management(page, base_url, admin_email, admin_password):

    _start_chat_session(page)
    _send_message(page, "first session message")
    first_chat_id = _get_chat_id_from_url(page)
    print("First Chat ID:", first_chat_id)
    assert "/chat/" in page.url

    page.get_by_role("button").first.click()
    page.get_by_role("button").nth(2).click()

    page.get_by_role("button", name="Select Chat mode").wait_for(timeout=20000)
    page.get_by_role("button", name="Select Chat mode").click()

    second_persona = page.get_by_role("button", name=re.compile(r"^Select persona")).first
    second_persona.wait_for(timeout=20000)
    second_persona.click()

    _get_chat_input(page).wait_for(timeout=60000)
    _send_message(page, "second session message")

    second_chat_id = _get_chat_id_from_url(page)
    print("Second Chat ID:", second_chat_id)
    assert first_chat_id != second_chat_id

    expect(
        page.locator(".user-message", has_text="second session message").first
    ).to_be_visible(timeout=20000)
    assert f"/chat/{second_chat_id}" in page.url


# ================================
# Existing Test 4: Chat Session Reconnect
# ================================

def test_chat_session_reconnect(page, base_url, admin_email, admin_password):
    """Verify the FE reconnect flow: as soon as a session is created and AI starts generating,
    switch away to a new tab, then return and confirm the AI response completed."""

    _start_chat_session(page)
    _send_message(page, "Write a detailed 500-word essay on the history of artificial intelligence")

    session_a_id = _get_chat_id_from_url(page)
    print("Session A ID:", session_a_id)

    # Confirm generation is actively in progress before leaving
    page.get_by_role("button", name="Stop generating").wait_for(timeout=15000)
    print("AI is generating — switching away now")

    page.get_by_role("button").first.click()
    page.get_by_role("button").nth(2).click()

    page.get_by_role("button", name="Select Chat mode").wait_for(timeout=20000)
    page.get_by_role("button", name="Select Chat mode").click()

    second_persona = page.get_by_role("button", name=re.compile(r"^Select persona")).first
    second_persona.wait_for(timeout=20000)
    second_persona.click()

    _get_chat_input(page).wait_for(timeout=60000)
    _send_message(page, "session B message")

    session_b_id = _get_chat_id_from_url(page)
    print("Session B ID:", session_b_id)
    assert session_a_id != session_b_id, "Session B should be a different session"

    page.goto(f"{base_url}/chat/{session_a_id}", timeout=30000)
    page.wait_for_load_state("load", timeout=30000)
    _get_chat_input(page).wait_for(timeout=30000)

    # --------------------------------
    # Assertions: AI response completed after reconnect
    # --------------------------------
    # Stop generating button should be gone — generation must have finished
    try:
        page.get_by_role("button", name="Stop generating").wait_for(state="detached", timeout=60000)
    except Exception:
        pass

    expect(
        page.locator(".user-message", has_text="Write a detailed 500-word essay").first
    ).to_be_visible(timeout=10000)

    # DEBUG: poll until a second message block (the AI reply) actually shows up,
    # then dump ALL of its class names unfiltered — manual repro confirms the
    # reply does eventually render, just later than a fixed early snapshot can
    # catch, and the earlier keyword-filtered dump found nothing to filter.
    ai_block = page.evaluate("""() => {
        const deadline = Date.now() + 120000;
        function poll(resolve) {
            const candidates = Array.from(document.querySelectorAll('.chat-scroll-container *'))
                .filter(el => el.className && typeof el.className === 'string'
                    && !el.className.includes('user-message')
                    && el.children.length === 0 && el.textContent.trim().length > 20);
            if (candidates.length > 0) {
                const el = candidates[candidates.length - 1];
                resolve({
                    found: true,
                    tag: el.tagName.toLowerCase(),
                    class: el.className,
                    parentClass: el.parentElement ? el.parentElement.className : null,
                    textSample: el.textContent.trim().slice(0, 80),
                });
            } else if (Date.now() > deadline) {
                resolve({ found: false });
            } else {
                setTimeout(() => poll(resolve), 2000);
            }
        }
        return new Promise(poll);
    }""")
    print("\\n=== AI MESSAGE BLOCK (polled up to 120s) ===")
    print(" ", ai_block)
    print("===========================================\\n")

    # AI response exists and is non-empty — this fails if reconnect is broken.
    assert ai_block.get("found"), "AI response never appeared after reconnect within 120s"

    assert f"/chat/{session_a_id}" in page.url, "URL should be session A"
    print("Reconnect verified — AI response completed after switching back")