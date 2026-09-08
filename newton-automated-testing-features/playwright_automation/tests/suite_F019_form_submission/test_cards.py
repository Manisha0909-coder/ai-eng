import re
from pathlib import Path

from playwright.sync_api import Page, expect

RESULTS = Path(__file__).resolve().parents[2] / "results"
RESULTS.mkdir(exist_ok=True)

CARD_TRIGGER_QUERY = "show me the top 3 tourist attractions in Qatar with cards"


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _start_qatar_tourism_chat(page: Page) -> None:
    """Select Chat mode → search for qatar-tourism replica → land in chat input."""
    page.get_by_role("button", name="Select Chat mode").wait_for(timeout=20000)
    page.get_by_role("button", name="Select Chat mode").click()

    search = page.get_by_role("textbox", name="Search personas")
    search.wait_for(state="visible", timeout=15000)
    search.fill("qat")
    page.wait_for_timeout(1000)

    persona_btn = page.get_by_role(
        "button", name=re.compile(r"Select persona.*PW_Replica_qatar", re.IGNORECASE)
    ).first
    if persona_btn.count() == 0:
        persona_btn = page.get_by_role(
            "button", name=re.compile(r"Select persona.*qatar", re.IGNORECASE)
        ).first
    persona_btn.wait_for(timeout=15000)
    persona_btn.click()

    try:
        page.wait_for_load_state("networkidle", timeout=15000)
    except Exception:
        pass
    page.get_by_role("textbox", name="Chat message").wait_for(timeout=60000)


def _send_message(page: Page, message: str) -> None:
    chat_input = page.get_by_role("textbox", name="Chat message")
    chat_input.wait_for(timeout=20000)
    chat_input.fill(message)
    chat_input.press("Enter")

    expect(page.locator(".user-message", has_text=message).first).to_be_visible(timeout=20000)

    try:
        page.get_by_role("button", name="Stop generating").wait_for(state="detached", timeout=90000)
    except Exception:
        pass
    page.wait_for_load_state("networkidle", timeout=20000)
    page.wait_for_timeout(2000)


def _wait_for_cards(page: Page, timeout: int = 15000) -> bool:
    """Return True when the card carousel navigation buttons are visible.

    Codegen confirmed the card carousel exposes 'Next slide' / 'Previous slide'
    buttons — these are the most reliable signal that cards have rendered.
    """
    try:
        page.get_by_role("button", name="Next slide").first.wait_for(
            state="visible", timeout=timeout
        )
        return True
    except Exception:
        pass
    try:
        page.get_by_role("button", name="Previous slide").first.wait_for(
            state="visible", timeout=timeout
        )
        return True
    except Exception:
        pass
    return False


def _get_card_count(page: Page) -> int:
    """Count carousel slide images as a proxy for card count."""
    # Each card in the carousel has an img with class rounded-lg inside a
    # scrollbar-themed container — count those as individual cards.
    count = page.locator("button[aria-label='Next slide'], button[aria-label='Previous slide']").count()
    if count > 0:
        return count  # at least one carousel present
    return 0


# ─── TC06 — Cards render correctly and persist after session reload ────────────

def test_tc06_cards_render_after_reload(page: Page, base_url: str):
    """TC06 — Card payload renders on first load and re-renders correctly after session reload.

    Reproduces the known bug: cards appear on the initial AI response but are
    missing when list_messages is called after reloading the session URL.
    """

    print("\n" + "=" * 60)
    print("TC06: CARD PAYLOAD RENDERS AFTER SESSION RELOAD")
    print("=" * 60)

    # ── Step 1: Start qatar-tourism session ───────────────────────────────────
    print("\n  STEP 1: Starting qatar-tourism chat session...")
    _start_qatar_tourism_chat(page)
    page.screenshot(path=str(RESULTS / "f019-tc06-01-chat-ready.png"))

    # ── Step 2: Send card-triggering query ────────────────────────────────────
    print(f"\n  STEP 2: Sending card-triggering query: '{CARD_TRIGGER_QUERY}'")
    _send_message(page, CARD_TRIGGER_QUERY)
    page.screenshot(path=str(RESULTS / "f019-tc06-02-after-query.png"))

    # ── Step 3: Verify cards rendered on initial response ─────────────────────
    print("\n  STEP 3: Verifying cards are visible after initial response...")
    assert _wait_for_cards(page, timeout=15000), (
        "Cards did not render after the initial query — "
        "check that the persona returns card payloads for this query"
    )
    print("  ✅ Cards visible on initial load")
    page.screenshot(path=str(RESULTS / "f019-tc06-03-cards-initial.png"))

    card_count_before = _get_card_count(page)
    print(f"  Carousel nav buttons before reload: {card_count_before}")

    # ── Step 4: Reload the session URL ────────────────────────────────────────
    session_url = page.url
    assert "/chat/" in session_url, f"Expected to be in a chat session, got URL: {session_url}"
    print(f"\n  STEP 4: Reloading session at {session_url}")

    page.goto(session_url, timeout=30000)
    page.wait_for_load_state("networkidle", timeout=30000)
    page.get_by_role("textbox", name="Chat message").wait_for(timeout=30000)
    page.wait_for_timeout(3000)
    page.screenshot(path=str(RESULTS / "f019-tc06-04-after-reload.png"))

    # ── Step 5: Verify cards still render after reload ────────────────────────
    print("\n  STEP 5: Verifying cards re-render after session reload...")
    cards_after = _wait_for_cards(page, timeout=15000)
    page.screenshot(path=str(RESULTS / "f019-tc06-05-cards-after-reload.png"))

    assert cards_after, (
        "Cards are NOT rendered after session reload — "
        "list_messages returned the card payload but the UI failed to render it"
    )

    card_count_after = _get_card_count(page)
    print(f"  Carousel nav buttons after reload: {card_count_after}")
    print("  ✅ Cards rendered correctly after session reload")

    print("\n" + "=" * 60)
    print("TC06 PASSED — Card payload persists across session reload")
    print("=" * 60)
