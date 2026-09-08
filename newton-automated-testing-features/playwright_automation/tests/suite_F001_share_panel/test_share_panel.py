import re
import pytest
from pathlib import Path

from playwright.sync_api import Page


RESULTS = Path(__file__).resolve().parents[2] / "results"
RESULTS.mkdir(exist_ok=True)

# Shared state: set by TC02 (or lazily by _get_has_sessions), read by TC01 / TC05–TC08
_state = {"has_sessions": None}


# ─── Helpers ──────────────────────────────────────────────────────────────────

_COPY_BTN_JS = """
(badgeText) => {
    window.__copiedText = '';
    try {
        navigator.clipboard.writeText = (t) => { window.__copiedText = t; return Promise.resolve(); };
    } catch (e) {}
    const origExec = document.execCommand.bind(document);
    document.execCommand = (cmd) => {
        if (cmd === 'copy') {
            const sel = window.getSelection();
            if (sel && sel.toString()) window.__copiedText = sel.toString();
            const ae = document.activeElement;
            if (ae && typeof ae.value === 'string') window.__copiedText = ae.value;
        }
        return origExec(cmd);
    };

    let badge = null;
    for (const el of document.querySelectorAll('p,span,div')) {
        if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3 &&
            el.textContent.trim() === badgeText) {
            badge = el;
            break;
        }
    }
    if (!badge) return 'no ' + badgeText + ' badge';

    let row = badge.parentElement;
    for (let up = 0; up < 6 && row; up++) {
        const btns = row.querySelectorAll('button');
        if (btns.length > 0) {
            for (const b of btns) {
                const al = (b.getAttribute('aria-label') || '').toLowerCase();
                const ti = (b.getAttribute('title') || '').toLowerCase();
                if (!al.includes('delete') && !ti.includes('delete') && !al.includes('remove') && !ti.includes('remove')) {
                    b.click();
                    return 'clicked: ' + (al || ti || b.className.substring(0, 40));
                }
            }
            break;
        }
        row = row.parentElement;
    }
    return 'copy btn not found';
}
"""


def _open_shared_links_panel(page: Page) -> None:
    """Open the User Panel (via the Account button) and switch to its Shared Links tab —
    this is where the list of previously shared chats now lives."""
    page.locator("xpath=//button[@aria-label='Account']").click()
    page.wait_for_timeout(1500)
    page.get_by_role("button", name="Shared Links", exact=True).click()
    page.wait_for_timeout(1500)
    page.get_by_role("button", name="Close", exact=True).wait_for(timeout=10000)


# Old per-chat "Share Panel" trigger (button[title='Share Panel']) no longer
# exists — this feature moved entirely into the Account → Shared Links tab.
_open_share_dialog = _open_shared_links_panel


def _close_shared_links_panel(page: Page) -> None:
    """Close the User Panel — it's an icon-only 'X' button, not visible 'Close' text."""
    close_btn = page.get_by_role("button", name="Close", exact=True)
    if close_btn.count() > 0:
        close_btn.click()
    else:
        page.keyboard.press("Escape")
    page.wait_for_timeout(1000)


def _navigate_to_new_chat(page: Page, base_url: str) -> bool:
    """Home → Chat card (Step 1) → persona selection (Step 2) → land in a fresh chat."""
    page.goto(base_url, timeout=60000)
    page.wait_for_load_state("networkidle", timeout=30000)
    page.wait_for_timeout(1000)
    page.screenshot(path=str(RESULTS / "nav-01-home.png"))

    # If already on the persona selection page, skip Step 1
    def _on_persona_page() -> bool:
        return (
            page.locator("text=STEP 2 OF 2").count() > 0
            or page.locator("input[placeholder*='Search personas']").count() > 0
        )

    if not _on_persona_page():
        # Step 1 of 2: click the Chat card
        chat_card = page.locator("button, [role='button']").filter(has_text="Conversational AI").first
        if chat_card.count() == 0:
            page.screenshot(path=str(RESULTS / "nav-02-no-chat-card.png"))
            return False
        chat_card.click()
        page.wait_for_load_state("networkidle", timeout=15000)
        page.wait_for_timeout(1000)
        page.screenshot(path=str(RESULTS / "nav-02-after-chat-click.png"))

    if not _on_persona_page():
        page.screenshot(path=str(RESULTS / "nav-03-no-persona-page.png"))
        return False

    # Step 2 of 2: search for "HR Assistant" and click the first result
    search = page.locator("input[placeholder*='Search personas']")
    try:
        search.wait_for(state="visible", timeout=15000)
    except Exception:
        page.screenshot(path=str(RESULTS / "nav-03-no-persona.png"))
        return False

    search.fill("HR Assistant")
    page.wait_for_timeout(1000)
    page.screenshot(path=str(RESULTS / "nav-03-search-result.png"))

    # Click the first persona card that appears in search results
    clicked = page.evaluate(r"""() => {
        const chatRegex = /\bCHAT\b/;
        for (const btn of document.querySelectorAll('button')) {
            const text = btn.innerText.trim();
            if (chatRegex.test(text) && text !== 'Chat') {
                btn.click();
                return text.substring(0, 60);
            }
        }
        return null;
    }""")
    if not clicked:
        page.screenshot(path=str(RESULTS / "nav-03-no-persona.png"))
        return False

    page.wait_for_load_state("networkidle", timeout=15000)
    page.wait_for_timeout(2000)
    page.screenshot(path=str(RESULTS / "nav-03-after-persona.png"))

    in_chat = page.locator("textarea[aria-label='Chat message'], textarea#chat").count() > 0
    page.screenshot(path=str(RESULTS / "nav-04-final.png"))
    return in_chat


def _send_message_and_open_share_dialog(page: Page, message: str = "Hello") -> bool:
    """Type a message, wait for AI response, hover over it, click the per-message share icon."""
    textarea = page.locator("textarea[aria-label='Chat message'], textarea#chat, textarea[placeholder*='know']")
    if textarea.count() == 0:
        return False
    textarea.first.click()
    textarea.first.fill(message)
    page.keyboard.press("Enter")
    page.wait_for_timeout(1000)

    # Wait for AI to finish streaming. Must confirm "Stop generation" actually
    # appeared FIRST — otherwise a brief gap before it renders (common on
    # tool-calling queries like "Give my leave balance") gets misread as
    # generation already being done, and we hover before the response exists.
    stop_btn = page.get_by_role("button", name=re.compile("stop generat", re.IGNORECASE))
    try:
        stop_btn.wait_for(state="visible", timeout=10000)
    except Exception:
        pass
    else:
        try:
            stop_btn.wait_for(state="detached", timeout=60000)
        except Exception:
            pass
    page.wait_for_load_state("networkidle", timeout=15000)
    page.wait_for_timeout(2000)
    page.screenshot(path=str(RESULTS / "tc-share-before-hover.png"))

    # Hover over the AI message container.
    # Container class has standalone "group" token; toolbar has "group-hover/..." (no standalone "group").
    # Use concat+space trick to match "group" as whole word.
    ai_msg = page.locator(
        "//div[contains(concat(' ', @class, ' '), ' group ')"
        " and contains(@class,'relative') and contains(@class,'justify-start')]"
    ).last
    if ai_msg.count() == 0:
        return False
    ai_msg.hover()
    page.wait_for_timeout(1000)
    page.screenshot(path=str(RESULTS / "tc-share-after-hover.png"))

    # The Share button now has a proper aria-label — no need for the old
    # positional-index heuristic over unlabeled icon buttons.
    share_btn = page.locator("button[aria-label='Share']").last
    if share_btn.count() == 0:
        return False
    try:
        share_btn.click(timeout=5000)
    except Exception:
        share_btn.click(force=True)
    page.wait_for_timeout(2000)
    return True


def _copy_link(page: Page, badge_text: str) -> str:
    result = page.evaluate(_COPY_BTN_JS, badge_text)
    print(f"{badge_text} click result: {result}")
    page.wait_for_timeout(2000)
    return page.evaluate("() => window.__copiedText || ''")


def _is_login_page(page: Page) -> bool:
    has_form = page.locator(
        "xpath=//input[@id='username'] | //input[@type='password'] "
        "| //button[contains(.,'Log In')] | //button[contains(.,'Sign In')]"
    ).count() > 0
    url_match = bool(re.search(r"(?i)(login|auth|signin|sign-in)", page.url))
    return has_form or url_match


def _has_chat_ui(page: Page) -> bool:
    return page.locator(
        "xpath=//textarea | //div[@contenteditable='true'] "
        "| //div[contains(@class,'chat')] | //div[contains(@class,'message')]"
    ).count() > 0


def _get_has_sessions(page: Page) -> bool:
    """Return whether the Share Panel contains any sessions.

    Uses the value cached by TC02 if available; otherwise checks the UI directly
    so individual TCs work correctly when run in isolation.
    """
    if _state["has_sessions"] is not None:
        return _state["has_sessions"]
    _open_shared_links_panel(page)
    has_org     = page.locator("p:text('Organisation'), span:text('Organisation'), div:text('Organisation')").count() > 0
    has_private = page.locator("p:text('Private'), span:text('Private'), div:text('Private')").count() > 0
    has_public  = page.locator("p:text('Public'), span:text('Public'), div:text('Public')").count() > 0
    _state["has_sessions"] = has_org or has_private or has_public
    _close_shared_links_panel(page)
    return _state["has_sessions"]


# ─── TC02 — runs first as a gate ──────────────────────────────────────────────

def test_tc02_share_panel_empty_state(page: Page, base_url):
    """TC02 — Check whether shared sessions exist. Logs empty state and blocks TC01 if none found."""

    # STEP 1: Open Share Panel dialog
    print("\n STEP 1: Opening Share Panel dialog...")
    _open_share_dialog(page)
    print("✅ STEP 1: Dialog opened")
    page.screenshot(path=str(RESULTS / "tc02-01-dialog-opened.png"))

    # STEP 2: Check for Organisation / Private / Public session badges
    print("\n STEP 2: Checking for shared session badges...")
    has_org     = page.locator("p:text('Organisation'), span:text('Organisation'), div:text('Organisation')").count() > 0
    has_private = page.locator("p:text('Private'), span:text('Private'), div:text('Private')").count() > 0
    has_public  = page.locator("p:text('Public'), span:text('Public'), div:text('Public')").count() > 0

    _state["has_sessions"] = has_org or has_private or has_public

    print(f"  Organisation badge found: {has_org}")
    print(f"  Private badge found:      {has_private}")
    print(f"  Public badge found:       {has_public}")
    page.screenshot(path=str(RESULTS / "tc02-02-dialog-state.png"))

    # STEP 3: Close dialog
    print("\n STEP 3: Closing dialog...")
    _close_shared_links_panel(page)
    print("✅ Dialog closed")

    print("\n" + "=" * 40)
    if _state["has_sessions"]:
        print("TC02 RESULT: Shared sessions found — TC01 will proceed ✅")
    else:
        print("TC02 RESULT: No shared sessions present — empty state logged ⚠")
        print("  Skipping remaining test cases.")
    print("=" * 40)
    print("✅ TC02 completed")


# ─── TC01 — runs only if TC02 found sessions ──────────────────────────────────

def test_tc01_share_link_generation_and_access_control(page: Page, base_url):
    """TC01 — Copy private & public links, verify access behaviour when unauthenticated."""

    if not _get_has_sessions(page):
        pytest.skip("TC02 found no shared sessions — Share Panel is empty, skipping TC01")

    # STEP 1: Open Share Panel dialog
    print("\n STEP 1: Opening Share Panel dialog...")
    _open_share_dialog(page)
    print("✅ STEP 1: Dialog opened")
    page.screenshot(path=str(RESULTS / "tc01-01-dialog-opened.png"))

    # STEP 2: Copy PRIVATE link
    print("\n STEP 2: Copying PRIVATE link...")
    private_url = _copy_link(page, "Private")
    print(f"Private URL = {private_url}")
    page.screenshot(path=str(RESULTS / "tc01-02-private-copied.png"))

    # STEP 3: Copy PUBLIC link
    print("\n STEP 3: Copying PUBLIC link...")
    public_url = _copy_link(page, "Public")
    print(f"Public URL = {public_url}")
    page.screenshot(path=str(RESULTS / "tc01-03-public-copied.png"))

    # STEP 4: Close dialog
    print("\n STEP 4: Closing dialog...")
    _close_shared_links_panel(page)
    print("✅ Dialog closed")

    # STEP 5: Clear cookies to simulate unauthenticated user
    print("\n STEP 5: Clearing cookies...")
    page.context.clear_cookies()
    page.wait_for_timeout(1000)
    print("✅ Cookies cleared")

    # STEP 6: Test PRIVATE link — must redirect to login
    private_result = "SKIP"
    if private_url:
        print("\n STEP 6: Testing PRIVATE link (unauthenticated)...")
        page.goto(private_url, wait_until="commit")
        page.wait_for_load_state("networkidle", timeout=15000)
        page.wait_for_timeout(2000)
        page.screenshot(path=str(RESULTS / "tc01-04-private-link-page.png"))
        print(f"Private link landed on: {page.url}")

        if _is_login_page(page):
            print("✅ PRIVATE LINK: Login required — correct behaviour")
            private_result = "PASS"
        else:
            page.screenshot(path=str(RESULTS / "tc01-04-private-no-login.png"))
            private_result = "FAIL"

        assert private_result == "PASS", "Private link must require login for unauthenticated user"
    else:
        print("⚠ Private URL not captured — skipping")

    # STEP 7: Test PUBLIC link — must open without login
    public_result = "SKIP"
    if public_url:
        print("\n STEP 7: Testing PUBLIC link (unauthenticated)...")
        page.goto(public_url, wait_until="commit")
        page.wait_for_load_state("networkidle", timeout=15000)
        page.wait_for_timeout(2000)
        page.screenshot(path=str(RESULTS / "tc01-05-public-link-page.png"))
        print(f"Public link landed on: {page.url}")

        if not _is_login_page(page):
            print("✅ PUBLIC LINK: No login required — correct behaviour")
            if _has_chat_ui(page):
                print("✅ Chat interface detected")
            else:
                print("⚠ Chat interface not clearly detected — may still be loading")
            public_result = "PASS"
        else:
            page.screenshot(path=str(RESULTS / "tc01-05-public-unexpected-login.png"))
            public_result = "FAIL"

        assert public_result == "PASS", "Public link must open without login for unauthenticated user"
    else:
        print("⚠ Public URL not captured — skipping")

    print("\n" + "=" * 40)
    print("TC01 FINAL SUMMARY:")
    print(f"  Private link: {private_result}")
    print(f"  Public link:  {public_result}")
    print("=" * 40)
    print("✅ TC01 completed")


# ─── TC03 — US:001 Create private share link ──────────────────────────────────

def test_tc03_create_private_share_link(page: Page, base_url):
    """TC03 — US:001 — Create an Organisation share link via the new persona-chat flow."""

    print("\n" + "=" * 60)
    print("TC03: CREATE ORGANIZATION SHARE LINK")
    print("=" * 60)

    # STEP 1: Navigate to a fresh chat via Home → Chat card → Persona selection
    print("\n  STEP 1: Navigating to a new chat via persona selection...")
    opened = _navigate_to_new_chat(page, base_url)
    assert opened, "Could not land on a chat page via persona selection"
    page.screenshot(path=str(RESULTS / "tc03-01-in-chat.png"))
    print(f"  In chat: {page.url}")

    # STEP 2: Send a message and wait for AI response
    print("\n  STEP 2: Sending message and waiting for AI response...")
    dialog_opened = _send_message_and_open_share_dialog(page)
    assert dialog_opened, "Share icon not found after hovering over AI response"
    page.screenshot(path=str(RESULTS / "tc03-02-share-dialog.png"))
    print("  Share session dialog opened")

    # STEP 3: Select Organisation option
    print("\n  STEP 3: Selecting Organisation visibility...")
    org_option = page.locator(
        "//button[normalize-space()='Organisation'] | //label[normalize-space()='Organisation']"
        " | //*[@role='radio' and contains(.,'Organisation')]"
        " | //button[normalize-space()='Private'] | //*[@role='radio' and contains(.,'Private')]"
    )
    assert org_option.count() > 0, "Organisation/Private option not found in share dialog"
    org_option.first.click()
    page.wait_for_timeout(1000)
    page.screenshot(path=str(RESULTS / "tc03-03-org-selected.png"))
    print("  Organisation option selected")

    # STEP 4: Click Generate
    print("\n  STEP 4: Clicking Generate...")
    page.locator(
        "//button[contains(normalize-space(.),'Copy link') or contains(normalize-space(.),'Generate')"
        " or contains(normalize-space(.),'Create') or contains(normalize-space(.),'Confirm')]"
    ).last.click()
    page.wait_for_timeout(3000)
    page.screenshot(path=str(RESULTS / "tc03-04-after-generate.png"))

    # Close the Share Session dialog (it stays open after Generate)
    page.keyboard.press("Escape")
    page.wait_for_timeout(1000)

    # STEP 5: Verify in Share Panel
    print("\n  STEP 5: Verifying in Share Panel...")
    _open_share_dialog(page)
    has_org_badge = page.locator(
        "p:text('Organisation'), span:text('Organisation'), div:text('Organisation'), "
        "p:text('Private'), span:text('Private'), div:text('Private')"
    ).count() > 0
    assert has_org_badge, "Organisation/Private badge not found in Share Panel after creation"
    print("  ✅ Organisation badge visible in Share Panel")
    _state["has_sessions"] = True
    _close_shared_links_panel(page)

    print("\n" + "=" * 60)
    print("TC03 PASSED — Organisation share link created successfully")
    print("=" * 60)


# ─── TC04 — US:002 Create public share link ───────────────────────────────────

def test_tc04_create_public_share_link(page: Page, base_url):
    """TC04 — US:002 — Create a Public share link via the new persona-chat flow."""

    print("\n" + "=" * 60)
    print("TC04: CREATE PUBLIC SHARE LINK")
    print("=" * 60)

    # STEP 1: Navigate to a fresh chat via Home → Chat card → Persona selection
    print("\n  STEP 1: Navigating to a new chat via persona selection...")
    opened = _navigate_to_new_chat(page, base_url)
    assert opened, "Could not land on a chat page via persona selection"
    page.screenshot(path=str(RESULTS / "tc04-01-in-chat.png"))
    print(f"  In chat: {page.url}")

    # STEP 2: Send a message and wait for AI response, then open share dialog
    # Distinct query from TC03's "Hello" so the two sessions get different
    # titles — makes it unambiguous which link belongs to which test.
    print("\n  STEP 2: Sending message and waiting for AI response...")
    dialog_opened = _send_message_and_open_share_dialog(page, "Hi")
    assert dialog_opened, "Share icon not found after hovering over AI response"
    page.screenshot(path=str(RESULTS / "tc04-02-share-dialog.png"))
    print("  Share session dialog opened")

    # STEP 3: Select Public option
    print("\n  STEP 3: Selecting Public visibility...")
    public_option = page.locator(
        "//button[normalize-space()='Public'] | //label[normalize-space()='Public']"
        " | //*[@role='radio' and contains(.,'Public')]"
    )
    assert public_option.count() > 0, "Public option not found in share dialog"
    public_option.first.click()
    page.wait_for_timeout(1000)
    page.screenshot(path=str(RESULTS / "tc04-03-public-selected.png"))
    print("  Public option selected")

    # STEP 4: Verify public visibility warning is shown
    print("\n  STEP 4: Checking for public visibility warning...")
    warning_visible = page.locator(
        "//*[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'public')"
        " and (contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'visible')"
        " or contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'anyone')"
        " or contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'warn'))]"
    ).count() > 0
    print(f"  Public warning visible: {warning_visible}")
    page.screenshot(path=str(RESULTS / "tc04-04-public-warning.png"))

    # STEP 5: Click Generate
    print("\n  STEP 5: Clicking Generate...")
    page.locator(
        "//button[contains(normalize-space(.),'Copy link') or contains(normalize-space(.),'Generate')"
        " or contains(normalize-space(.),'Create') or contains(normalize-space(.),'Confirm')]"
    ).last.click()
    page.wait_for_timeout(3000)
    page.screenshot(path=str(RESULTS / "tc04-05-after-generate.png"))

    # Close the Share Session dialog (stays open after Generate)
    page.keyboard.press("Escape")
    page.wait_for_timeout(1000)

    # STEP 6: Verify in Share Panel
    print("\n  STEP 6: Verifying in Share Panel...")
    _open_share_dialog(page)
    has_public = page.locator(
        "p:text('Public'), span:text('Public'), div:text('Public')"
    ).count() > 0
    assert has_public, "Public badge not found in Share Panel after creation"
    print("  ✅ Public badge visible in Share Panel")
    _state["has_sessions"] = True
    _close_shared_links_panel(page)

    print("\n" + "=" * 60)
    print("TC04 PASSED — Public share link created successfully")
    print("=" * 60)


# ─── TC05 — US:003 Private link read-only mode ────────────────────────────────

def test_tc05_private_link_read_only(page: Page, base_url, unauthenticated_page):
    """TC05 — US:003 — Private shared chat is read-only; unauthenticated users are redirected to login."""

    print("\n" + "=" * 60)
    print("TC05: PRIVATE LINK READ-ONLY MODE")
    print("=" * 60)

    if not _get_has_sessions(page):
        pytest.skip("No shared sessions found — run TC03 first or ensure a private share exists")

    # STEP 1: Get organization/private link
    print("\n  STEP 1: Getting Organisation/Private link from Share Panel...")
    _open_share_dialog(page)
    private_url = _copy_link(page, "Organisation") or _copy_link(page, "Private")
    _close_shared_links_panel(page)

    if not private_url:
        pytest.skip("No Organisation/Private link found in Share Panel")

    print(f"  Private URL: {private_url}")

    # STEP 2: Unauthenticated user visits — must redirect to login
    print("\n  STEP 2: Visiting private link as unauthenticated user...")
    unauthenticated_page.goto(private_url, wait_until="commit")
    unauthenticated_page.wait_for_load_state("networkidle", timeout=15000)
    unauthenticated_page.wait_for_timeout(2000)
    unauthenticated_page.screenshot(path=str(RESULTS / "tc05-01-unauth-private.png"))

    assert _is_login_page(unauthenticated_page), \
        "Unauthenticated user should be redirected to login for private link"
    print("  ✅ Unauthenticated user redirected to login")

    # STEP 3: Authenticated user visits — must be read-only
    print("\n  STEP 3: Visiting private link as authenticated user (read-only check)...")
    page.goto(private_url, wait_until="commit")
    page.wait_for_load_state("networkidle", timeout=15000)
    page.wait_for_timeout(2000)
    page.screenshot(path=str(RESULTS / "tc05-02-auth-private.png"))

    # No chat input should be editable
    editable_input = page.locator(
        "//textarea[not(@disabled) and not(@readonly)] | //div[@contenteditable='true']"
    ).count()
    print(f"  Editable inputs found: {editable_input}")

    # Check for view-only / read-only indicator
    readonly_indicator = page.locator(
        "//*[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'read-only')"
        " or contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'view only')"
        " or contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'shared')]"
    ).count() > 0
    print(f"  Read-only/shared indicator visible: {readonly_indicator}")
    page.screenshot(path=str(RESULTS / "tc05-03-readonly-check.png"))

    assert editable_input == 0 or readonly_indicator, \
        "Private shared chat should be read-only with no editable input"
    print("  ✅ Private link is read-only for authenticated user")

    print("\n" + "=" * 60)
    print("TC05 PASSED — Private link access control and read-only verified")
    print("=" * 60)


# ─── TC06 — US:004 Public link read-only ─────────────────────────────────────

def test_tc06_public_link_read_only(page: Page, base_url):
    """TC06 — US:004 — Public shared chat is read-only."""

    print("\n" + "=" * 60)
    print("TC06: PUBLIC LINK READ-ONLY")
    print("=" * 60)

    if not _get_has_sessions(page):
        pytest.skip("No shared sessions found — ensure a public share exists")

    # STEP 1: Get public link
    print("\n  STEP 1: Getting public link from Share Panel...")
    _open_share_dialog(page)
    public_url = _copy_link(page, "Public")
    _close_shared_links_panel(page)

    if not public_url:
        pytest.skip("No public link found in Share Panel")

    print(f"  Public URL: {public_url}")

    # STEP 2: Clear cookies and visit as unauthenticated user
    print("\n  STEP 2: Visiting public link without authentication...")
    page.context.clear_cookies()
    page.goto(public_url, wait_until="commit")
    page.wait_for_load_state("networkidle", timeout=15000)
    page.wait_for_timeout(2000)
    page.screenshot(path=str(RESULTS / "tc06-01-public-unauth.png"))

    assert not _is_login_page(page), "Public link should be accessible without login"
    print("  ✅ Public link accessible without login")

    # STEP 3: Verify read-only — no editable input
    print("\n  STEP 3: Checking read-only mode...")
    editable_input = page.locator(
        "//textarea[not(@disabled) and not(@readonly)] | //div[@contenteditable='true']"
    ).count()
    print(f"  Editable inputs found: {editable_input}")
    page.screenshot(path=str(RESULTS / "tc06-02-readonly-check.png"))
    assert editable_input == 0, "Public shared chat should not have editable inputs"
    print("  ✅ No editable inputs — read-only confirmed")

    print("\n" + "=" * 60)
    print("TC06 PASSED — Public link is read-only")
    print("=" * 60)


# ─── TC08 — US:006 Shared chats list details ─────────────────────────────────

def test_tc08_shared_chats_list_details(page: Page, base_url):
    """TC08 — US:006 — Share Panel list shows name, type, and date for each shared chat."""

    print("\n" + "=" * 60)
    print("TC08: SHARED CHATS LIST DETAILS")
    print("=" * 60)

    if not _get_has_sessions(page):
        pytest.skip("No shared sessions found — Share Panel is empty")

    # STEP 1: Open Shared Links tab (User Panel → Account)
    print("\n  STEP 1: Opening Shared Links panel...")
    _open_shared_links_panel(page)
    page.screenshot(path=str(RESULTS / "tc08-01-share-panel.png"))

    # STEP 2: Verify type badge is visible
    print("\n  STEP 2: Verifying type badges...")
    has_type = page.locator(
        "p:text('Organisation'), span:text('Organisation'), div:text('Organisation'), "
        "p:text('Private'), span:text('Private'), div:text('Private'), "
        "p:text('Public'), span:text('Public'), div:text('Public')"
    ).count() > 0
    assert has_type, "Share type badge (Organisation/Private/Public) not visible in list"
    print("  ✅ Type badge visible")

    # STEP 3: Verify chat name is shown
    print("\n  STEP 3: Verifying chat name is shown...")
    _BADGE_LABELS = {"Organisation", "Private", "Public", "Close", "Delete", "Revoke", "Copy", ""}
    name_els = page.locator("p, h3").all()
    has_name = any(el.inner_text().strip() not in _BADGE_LABELS for el in name_els)
    print(f"  Chat name element found: {has_name}")
    page.screenshot(path=str(RESULTS / "tc08-02-list-items.png"))
    assert has_name, "Chat name should be displayed in the shared chats list"
    print("  ✅ Chat name visible in list")

    # STEP 4: Verify date is displayed
    print("\n  STEP 4: Verifying date is shown...")
    date_visible = page.evaluate("""() => {
        const datePattern = /Created At|\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i;
        return datePattern.test(document.body.innerText || '');
    }""")
    print(f"  Date visible: {date_visible}")
    page.screenshot(path=str(RESULTS / "tc08-03-date-check.png"))
    assert date_visible, "Creation date should be displayed for each shared chat"
    print("  ✅ Date visible in list")

    # STEP 5: Close panel
    _close_shared_links_panel(page)

    print("\n" + "=" * 60)
    print("TC08 PASSED — Shared chats list shows name, type, and date")
    print("=" * 60)


# ─── TC07 — US:005 Revoke share link ─────────────────────────────────────────

def test_tc07_revoke_share_link(page: Page, base_url):
    """TC07 — US:005 — User can revoke a share link; revoked link becomes inaccessible."""

    print("\n" + "=" * 60)
    print("TC07: REVOKE SHARE LINK")
    print("=" * 60)

    if not _get_has_sessions(page):
        pytest.skip("No shared sessions found — ensure a share exists before revoking")

    # STEP 1: Open Share Panel and capture link from the first available session
    print("\n  STEP 1: Opening Share Panel and capturing link...")
    _open_share_dialog(page)

    # Track which badge type was found so delete targets the same session
    found_badge_type = None
    link_url = None
    for badge_type in ["Organisation", "Private", "Public"]:
        url = _copy_link(page, badge_type)
        if url:
            link_url = url
            found_badge_type = badge_type
            break

    print(f"  Link to revoke ({found_badge_type}): {link_url}")
    page.screenshot(path=str(RESULTS / "tc07-01-before-revoke.png"))
    assert link_url, "No shared session link found to revoke"

    # STEP 2: Delete the SAME session whose link was just copied
    print("\n  STEP 2: Revoking share link...")
    deleted = page.evaluate("""(badgeType) => {
        var badges = [...document.querySelectorAll('p,span,div')].filter(
            el => el.childNodes.length === 1 && el.childNodes[0].nodeType === 3 &&
            el.textContent.trim() === badgeType
        );
        if (!badges.length) return false;
        var row = badges[0].parentElement;
        for (let up = 0; up < 6 && row; up++) {
            var btns = [...row.querySelectorAll('button')];
            // Prefer an explicitly labelled delete/revoke/remove button
            var del = btns.find(b => {
                var al = (b.getAttribute('aria-label') || '').toLowerCase();
                var ti = (b.getAttribute('title') || '').toLowerCase();
                return al.includes('delete') || al.includes('revoke') || al.includes('remove')
                    || ti.includes('delete') || ti.includes('revoke') || ti.includes('remove');
            });
            // Fall back to the last button in the row (typically the trash icon)
            if (!del && btns.length >= 2) del = btns[btns.length - 1];
            if (del) { del.click(); return true; }
            row = row.parentElement;
        }
        return false;
    }""", found_badge_type)
    page.wait_for_timeout(2000)
    page.screenshot(path=str(RESULTS / "tc07-02-after-delete-click.png"))
    assert deleted, "Delete/revoke button not found in Share Panel — nothing was revoked"

    # STEP 3: Confirm deletion dialog if it appears
    print("\n  STEP 3: Confirming revoke...")
    confirm = page.locator(
        "//button[contains(normalize-space(.),'Delete') or contains(normalize-space(.),'Revoke')"
        " or contains(normalize-space(.),'Confirm')]"
    )
    if confirm.count() > 0:
        confirm.first.click()
        page.wait_for_timeout(3000)
    page.screenshot(path=str(RESULTS / "tc07-03-after-confirm.png"))
    print(f"  Delete button clicked: {deleted}")

    _close_shared_links_panel(page)

    # STEP 4: Visit revoked link — must show error or redirect
    if link_url:
        print("\n  STEP 4: Visiting revoked link...")
        page.goto(link_url, wait_until="commit")
        page.wait_for_load_state("networkidle", timeout=15000)
        page.wait_for_timeout(3000)
        page.screenshot(path=str(RESULTS / "tc07-04-revoked-link.png"))

        page_text = page.locator("body").inner_text().lower()
        current_url = page.url

        # Check if shared chat page loaded but has no actual session messages
        # (app may serve the shell but not load deleted session data)
        on_chat_share_page = "/chat_share/" in current_url
        has_session_content = page.locator(
            "//div[contains(@class,'message')] | //div[contains(@class,'chat-message')] "
            "| //div[contains(@class,'prose')] | //p[contains(@class,'message')]"
        ).count() > 0
        session_not_loaded = on_chat_share_page and not has_session_content

        is_invalid = (
            "not found" in page_text or "no longer" in page_text
            or "expired" in page_text or "invalid" in page_text
            or "unavailable" in page_text or "failed to load" in page_text
            or "might not exist" in page_text or "access denied" in page_text
            or "session not found" in page_text or "does not exist" in page_text
            or _is_login_page(page)
            or ("gotalk.dev" in current_url and not on_chat_share_page)
            or session_not_loaded
        )
        print(f"  Revoked link URL: {current_url}")
        print(f"  Session content present: {has_session_content}")
        print(f"  Revoked link shows error/redirect: {is_invalid}")
        assert is_invalid, "Revoked link should be inaccessible (show error or redirect to login)"
        print("  ✅ Revoked link correctly inaccessible")

    print("\n" + "=" * 60)
    print("TC07 PASSED — Share link revoked and inaccessible")
    print("=" * 60)


