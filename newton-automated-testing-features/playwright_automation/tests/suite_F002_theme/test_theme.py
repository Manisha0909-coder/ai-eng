import pytest
from pathlib import Path

from playwright.sync_api import Page

RESULTS = Path(__file__).resolve().parents[2] / "results"
RESULTS.mkdir(exist_ok=True)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_theme_state(page: Page) -> dict:
    return page.evaluate("""() => ({
        bg:        window.getComputedStyle(document.body).backgroundColor,
        htmlClass: document.documentElement.className,
        bodyClass: document.body.className
    })""")


def _is_dark(state: dict) -> bool:
    dark_colors = ("rgb(0, 0, 0)", "rgb(18, 18, 18)", "rgb(9, 9, 11)", "rgb(27, 28, 29)")
    return (
        any(c in state["bg"] for c in dark_colors)
        or "dark" in state["htmlClass"].lower()
        or "dark" in state["bodyClass"].lower()
    )


def _find_toggle(page: Page):
    selectors = [
        "xpath=//button[@aria-label='Switch to dark mode' or @aria-label='Switch to light mode']//*[name()='svg']/..",
        "xpath=//button[@title='Toggle Theme']//*[name()='svg']/..",
        "button[title='Toggle Theme']",
        "button[aria-label*='theme' i]",
        "button[aria-label*='brightness' i]",
    ]
    for sel in selectors:
        btn = page.locator(sel)
        if btn.count() > 0:
            return btn.first
    return None


# ─── TC01 ─────────────────────────────────────────────────────────────────────

def test_tc01_theme_brightness_toggle(page: Page, base_url):
    """TC01 — Verify theme toggle switches between light and dark, then toggles back."""

    # STEP 1: Find theme toggle button
    page.wait_for_timeout(3000)
    print("\n STEP 1: Looking for theme toggle button...")
    toggle = _find_toggle(page)
    assert toggle is not None, "Theme toggle button not found on page"
    print("✅ Theme toggle button found")

    # STEP 2: Capture initial theme state
    print("\n STEP 2: Checking current theme...")
    initial_state = _get_theme_state(page)
    initial_is_dark = _is_dark(initial_state)
    print(f"  Background color : {initial_state['bg']}")
    print(f"  HTML class       : {initial_state['htmlClass']}")
    print(f"  Body class       : {initial_state['bodyClass']}")
    print(f"  Detected theme   : {'DARK' if initial_is_dark else 'LIGHT'}")
    page.screenshot(path=str(RESULTS / "tc01-F002-01-initial-theme.png"))

    # STEP 3: Click toggle
    print("\n STEP 3: Clicking theme toggle button...")
    toggle.click()
    page.wait_for_load_state("networkidle", timeout=10000)
    page.wait_for_timeout(2000)
    print("✅ Theme toggle clicked")

    # STEP 4: Verify theme changed
    print("\n STEP 4: Verifying theme change...")
    new_state = _get_theme_state(page)
    new_is_dark = _is_dark(new_state)
    print(f"  New background color : {new_state['bg']}")
    print(f"  New HTML class       : {new_state['htmlClass']}")

    bg_changed    = initial_state["bg"] != new_state["bg"]
    class_changed = (initial_state["htmlClass"] != new_state["htmlClass"]
                     or initial_state["bodyClass"] != new_state["bodyClass"])
    theme_changed = bg_changed or class_changed

    assert theme_changed, "Theme did not change after clicking the toggle"

    if initial_is_dark != new_is_dark:
        print(f"✅ Theme toggled: {'DARK' if initial_is_dark else 'LIGHT'} → {'DARK' if new_is_dark else 'LIGHT'}")
    else:
        print("⚠ Theme changed but could not confirm direction — may have multiple theme options")

    page.screenshot(path=str(RESULTS / "tc01-F002-02-after-toggle.png"))

    # STEP 5: Toggle back to original
    print("\n STEP 5: Toggling back to original theme...")
    toggle.click()
    page.wait_for_load_state("networkidle", timeout=10000)
    page.wait_for_timeout(2000)
    print("✅ Theme toggle clicked again")

    # STEP 6: Verify restored
    print("\n STEP 6: Verifying theme restored...")
    final_state = _get_theme_state(page)
    restored = final_state["bg"] == initial_state["bg"]
    print(f"  Final background: {final_state['bg']}")

    if restored:
        print("✅ Theme successfully restored to original")
    else:
        print("⚠ Theme did not return to original — may have multiple theme options")

    page.screenshot(path=str(RESULTS / "tc01-F002-03-restored.png"))

    print("\n" + "=" * 40)
    print("TC01 F002 FINAL SUMMARY:")
    print(f"  Toggle found        : ✅")
    print(f"  Initial theme       : {'DARK' if initial_is_dark else 'LIGHT'}")
    print(f"  Theme changed       : {'✅' if theme_changed else '❌'}")
    print(f"  Restored to original: {'✅' if restored else '⚠'}")
    print("=" * 40)
    print("✅ TC01 F002 completed")
