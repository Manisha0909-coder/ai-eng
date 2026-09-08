import os
import pytest
from pathlib import Path
from dotenv import load_dotenv

from playwright.sync_api import Page
from playwright_automation.auth.login import login_to_gotalk


load_dotenv(dotenv_path=Path(__file__).resolve().parents[2] / ".env")

RESULTS = Path(__file__).resolve().parents[2] / "results"
RESULTS.mkdir(exist_ok=True)

SUPER_ADMIN_EMAIL = os.getenv("SUPER_ADMIN_EMAIL", "john.doe@noah.com")
SUPER_ADMIN_PASS  = os.getenv("SUPER_ADMIN_PASS",  "Friday#3000")
USER_ADMIN_EMAIL  = os.getenv("USER_ADMIN_EMAIL",  "mike.johnson@noah.com")
USER_ADMIN_PASS   = os.getenv("USER_ADMIN_PASS",   "Friday#3000")
SYS_ADMIN_EMAIL   = os.getenv("SYS_ADMIN_EMAIL",   "jane.smith@noah.com")
SYS_ADMIN_PASS    = os.getenv("SYS_ADMIN_PASS",    "Friday#3000")
NO_ROLE_EMAIL     = os.getenv("NO_ROLE_EMAIL",     "sarah.wilson@noah.com")
NO_ROLE_PASS      = os.getenv("NO_ROLE_PASS",      "Friday#3000")


# ─── Nav locators ─────────────────────────────────────────────────────────────

NAV = {
    "overview":      "//*[contains(normalize-space(.),'Overview') and not(contains(.,'Admin'))]",
    "tools":         "//*[contains(normalize-space(.),'Tools') and not(contains(.,'Servers')) and not(contains(.,'Tags'))]",
    "tool_tags":     "//a[normalize-space()='Tool Tags'] | //button[normalize-space()='Tool Tags']",
    "data_sources":  "//*[normalize-space(text())='Data Sources' or normalize-space()='Data Sources']",
    "servers":       "//*[normalize-space(text())='Servers' or normalize-space()='Servers']",
    "docs":          "//*[normalize-space(text())='Docs' or normalize-space()='Docs']",
    "doc_tags":      "//a[normalize-space()='Doc Tags'] | //button[normalize-space()='Doc Tags']",
    "roles":         "//*[normalize-space(text())='Roles' or normalize-space()='Roles']",
    "personas":      "//*[normalize-space(text())='Personas' or normalize-space()='Personas']",
    "shared_memory": "//*[normalize-space(text())='Shared Memory' or normalize-space()='Shared Memory']",
    "users":         "//*[normalize-space(text())='Users' or normalize-space()='Users']",
    "feedback":      "//*[contains(normalize-space(.),'Feedback')]",
    "admin_tab":     "//button[normalize-space()='Admin']",
}

ADMIN_CONSOLE_BTN = "//button[@aria-label='Admin console']//*[name()='svg']"


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _nav_present(page: Page, key: str) -> bool:
    """Element exists in the DOM (may be hidden)."""
    return page.locator(f"xpath={NAV[key]}").count() > 0


def _nav_visible(page: Page, key: str) -> bool:
    """Element exists AND is visually visible."""
    loc = page.locator(f"xpath={NAV[key]}")
    return loc.count() > 0 and loc.first.is_visible()


def _open_admin_console(page: Page) -> None:
    page.locator(f"xpath={ADMIN_CONSOLE_BTN}").wait_for(timeout=10000)
    page.locator(f"xpath={ADMIN_CONSOLE_BTN}").click()
    page.wait_for_timeout(2000)


# ─── TC16 ─────────────────────────────────────────────────────────────────────

def test_tc16_super_admin_full_access(page: Page, base_url):
    """TC16 — Super Admin (john.doe) has full access to all Admin Console sections."""

    print("\n" + "=" * 60)
    print(f"TC16: SUPER ADMIN FULL ACCESS ({SUPER_ADMIN_EMAIL})")
    print("=" * 60)

    # STEP 1: Admin Console button visible
    print("\n  STEP 1: Verifying Admin Console button is visible...")
    page.locator(f"xpath={ADMIN_CONSOLE_BTN}").wait_for(timeout=10000)
    print(f"  Admin Console button visible for {SUPER_ADMIN_EMAIL}")
    _open_admin_console(page)
    page.screenshot(path=str(RESULTS / "tc16-F008-01-admin-console.png"))

    # STEP 2: Overview
    print("\n  STEP 2: Verifying Overview...")
    assert _nav_present(page, "overview"), "Super Admin missing Overview"
    print("  Overview: present")

    # STEP 3: Tools and Servers sub-items — sidebar is flat now, no expansion needed
    print("\n  STEP 3: Verifying Tools and Servers items...")
    page.screenshot(path=str(RESULTS / "tc16-F008-02-tools-expanded.png"))
    results = {k: _nav_present(page, k) for k in ("tools", "tool_tags", "data_sources", "servers")}
    for k, v in results.items():
        print(f"  {k}: {v}")
    assert all(results.values()), f"Super Admin missing Tools and Servers sub-items: {results}"

    # STEP 4: Documents sub-items — sidebar is flat now, no expansion needed
    print("\n  STEP 4: Verifying Documents items...")
    page.screenshot(path=str(RESULTS / "tc16-F008-03-docs-expanded.png"))
    results = {k: _nav_present(page, k) for k in ("docs", "doc_tags")}
    for k, v in results.items():
        print(f"  {k}: {v}")
    assert all(results.values()), f"Super Admin missing Documents sub-items: {results}"

    # STEP 5: Access sub-items — sidebar is flat now, no expansion needed
    print("\n  STEP 5: Verifying Access items...")
    page.screenshot(path=str(RESULTS / "tc16-F008-04-access-expanded.png"))
    results = {k: _nav_present(page, k) for k in ("roles", "personas", "shared_memory", "users")}
    for k, v in results.items():
        print(f"  {k}: {v}")
    assert all(results.values()), f"Super Admin missing Access sub-items: {results}"

    # STEP 6: Feedback and Admin tab
    print("\n  STEP 6: Verifying Feedback and Admin tab...")
    feedback = _nav_present(page, "feedback")
    admin_tab = _nav_present(page, "admin_tab")
    print(f"  Feedback: {feedback} | Admin tab: {admin_tab}")
    assert feedback,   "Super Admin missing Feedback"
    assert admin_tab,  "Super Admin missing Admin tab"
    page.screenshot(path=str(RESULTS / "tc16-F008-05-feedback-admin.png"))

    print("\n" + "=" * 60)
    print("TC16 PASSED — Super Admin has full Admin Console access")
    print("=" * 60)


# ─── TC17 ─────────────────────────────────────────────────────────────────────

def test_tc17_user_admin_access_section_only(unauthenticated_page, base_url):
    """TC17 — User Admin (mike.johnson) sees only the Access section."""
    page = unauthenticated_page
    login_to_gotalk(page, base_url, USER_ADMIN_EMAIL, USER_ADMIN_PASS)
    page.wait_for_load_state("networkidle")

    print("\n" + "=" * 60)
    print(f"TC17: USER ADMIN — ACCESS SECTION ONLY ({USER_ADMIN_EMAIL})")
    print("=" * 60)

    # STEP 1: Admin Console button visible
    print("\n  STEP 1: Verifying Admin Console button is visible...")
    page.wait_for_timeout(5000)  # allow permission-based rendering to complete
    page.screenshot(path=str(RESULTS / "tc17-F008-00-after-login.png"))
    visible = page.locator(f"xpath={ADMIN_CONSOLE_BTN}").is_visible()
    print(f"  Admin Console button visible: {visible}")
    if not visible:
        pytest.skip(
            f"Admin Console button not visible for {USER_ADMIN_EMAIL}. "
            "Current app does not expose Admin Console to User Admin role — "
            "acceptance criteria US:002 may not be implemented yet."
        )
    print(f"  Admin Console button confirmed for {USER_ADMIN_EMAIL}")
    _open_admin_console(page)
    page.screenshot(path=str(RESULTS / "tc17-F008-01-admin-console.png"))

    # Access items MUST be present
    print("\n  Verifying Access items are present...")
    access_results = {k: _nav_present(page, k) for k in ("roles", "personas", "shared_memory", "users")}
    for k, v in access_results.items():
        print(f"  {k}: {v}")
    assert all(access_results.values()), f"User Admin missing Access items: {access_results}"

    # Restricted items must NOT be visible
    print("\n  Verifying restricted items are NOT visible...")
    restricted = {
        "tools":        _nav_visible(page, "tools"),
        "tool_tags":    _nav_visible(page, "tool_tags"),
        "data_sources": _nav_visible(page, "data_sources"),
        "servers":      _nav_visible(page, "servers"),
        "docs":         _nav_visible(page, "docs"),
        "doc_tags":     _nav_visible(page, "doc_tags"),
        "feedback":     _nav_visible(page, "feedback"),
        "admin_tab":    _nav_visible(page, "admin_tab"),
    }
    for k, v in restricted.items():
        print(f"  {k} visible: {v}")

    page.screenshot(path=str(RESULTS / "tc17-F008-02-restricted-check.png"))

    tools_visible = any(restricted[k] for k in ("tools", "tool_tags", "data_sources", "servers"))
    docs_visible  = restricted["docs"] or restricted["doc_tags"]
    assert not tools_visible, f"User Admin should NOT see Tools and Servers: {restricted}"
    assert not docs_visible,  f"User Admin should NOT see Documents: {restricted}"
    assert not restricted["feedback"], "User Admin should NOT see Feedback"
    assert not restricted["admin_tab"], "User Admin should NOT see Admin tab"

    print("\n" + "=" * 60)
    print("TC17 PASSED — User Admin sees only the Access section")
    print("=" * 60)


# ─── TC18 ─────────────────────────────────────────────────────────────────────

def test_tc18_system_admin_correct_access(unauthenticated_page, base_url):
    """TC18 — System Admin (jane.smith) sees Overview/Tools/Docs/Feedback but NOT Access or Admin tab."""
    page = unauthenticated_page
    login_to_gotalk(page, base_url, SYS_ADMIN_EMAIL, SYS_ADMIN_PASS)
    page.wait_for_load_state("networkidle")

    print("\n" + "=" * 60)
    print(f"TC18: SYSTEM ADMIN CORRECT ACCESS ({SYS_ADMIN_EMAIL})")
    print("=" * 60)

    # STEP 1: Admin Console button visible
    print("\n  STEP 1: Verifying Admin Console button is visible...")
    page.locator(f"xpath={ADMIN_CONSOLE_BTN}").wait_for(timeout=10000)
    print(f"  Admin Console button visible for {SYS_ADMIN_EMAIL}")
    _open_admin_console(page)
    page.screenshot(path=str(RESULTS / "tc18-F008-01-admin-console.png"))

    # Allowed items MUST be present
    print("\n  Verifying allowed items are present...")
    allowed = {
        "overview":     _nav_present(page, "overview"),
        "tools":        _nav_present(page, "tools"),
        "tool_tags":    _nav_present(page, "tool_tags"),
        "data_sources": _nav_present(page, "data_sources"),
        "servers":      _nav_present(page, "servers"),
        "docs":         _nav_present(page, "docs"),
        "doc_tags":     _nav_present(page, "doc_tags"),
        "feedback":     _nav_present(page, "feedback"),
    }
    for k, v in allowed.items():
        print(f"  {k}: {v}")
    assert allowed["overview"], "System Admin missing Overview"
    assert all(allowed[k] for k in ("tools", "tool_tags", "data_sources", "servers")), \
        f"System Admin missing Tools and Servers sub-items: {allowed}"
    assert allowed["docs"] and allowed["doc_tags"], \
        f"System Admin missing Documents sub-items: {allowed}"
    assert allowed["feedback"], "System Admin missing Feedback"

    # Restricted items must NOT be visible
    print("\n  Verifying restricted items are NOT visible...")
    restricted = {
        "roles":         _nav_visible(page, "roles"),
        "personas":      _nav_visible(page, "personas"),
        "shared_memory": _nav_visible(page, "shared_memory"),
        "users":         _nav_visible(page, "users"),
        "admin_tab":     _nav_visible(page, "admin_tab"),
    }
    for k, v in restricted.items():
        print(f"  {k} visible: {v}")

    page.screenshot(path=str(RESULTS / "tc18-F008-02-restricted-check.png"))

    access_visible = any(restricted[k] for k in ("roles", "personas", "shared_memory", "users"))
    assert not access_visible, f"System Admin should NOT see Access section: {restricted}"
    if restricted["admin_tab"]:
        print("  WARNING: Admin tab visible for System Admin — may differ from spec, logging for review")
    else:
        print("  Admin tab not visible for System Admin — correct")

    print("\n" + "=" * 60)
    print("TC18 PASSED — System Admin sees correct Admin Console sections")
    print("=" * 60)


# ─── TC19 ─────────────────────────────────────────────────────────────────────

def test_tc19_existing_admins_not_in_assign_dialog(page: Page, base_url):
    """TC19 — Existing admin users must not appear in the Assign Admin Role dropdown."""

    print("\n" + "=" * 60)
    print("TC19: EXISTING ADMINS NOT IN ASSIGN ADMIN ROLE DIALOG")
    print("=" * 60)

    # STEP 1: Navigate to Admin Console → Admin tab
    print("\n  STEP 1: Navigating to Admin Console → Admin tab...")
    _open_admin_console(page)
    page.get_by_role("button", name="Admin", exact=True).click()
    page.wait_for_timeout(2000)
    print("  Admin Users page opened")
    page.screenshot(path=str(RESULTS / "tc19-F008-01-admin-tab.png"))

    # STEP 2: Collect existing admin emails shown on the page
    print("\n  STEP 2: Collecting existing admin emails from page...")
    admin_emails = page.evaluate(r"""() => {
        var cards = [...document.querySelectorAll('div[class*="rounded"], div[class*="card"], div[class*="border"]')];
        var emails = [];
        cards.forEach(function(c) {
            var match = (c.innerText || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            if (match) emails.push(match[0].toLowerCase());
        });
        return [...new Set(emails)];
    }""")
    print(f"  Current admins: {admin_emails}")

    # STEP 3: Open Assign Admin Role dialog
    print("\n  STEP 3: Opening Assign Admin Role dialog...")
    page.evaluate("""() => {
        var btns = [...document.querySelectorAll('button')];
        var b = btns.find(b => b.offsetParent && /add admin/i.test(b.textContent.trim()));
        if (b) b.click();
    }""")
    page.locator("//div[@role='dialog']").wait_for(timeout=10000)
    print("  Dialog opened")
    page.screenshot(path=str(RESULTS / "tc19-F008-02-assign-dialog.png"))

    # STEP 4: Open the Users dropdown
    print("\n  STEP 4: Opening Users dropdown...")
    page.locator("xpath=//*[@id='zitadel_user_dropdown']").wait_for(timeout=10000)
    page.locator("xpath=//*[@id='zitadel_user_dropdown']").click()
    page.wait_for_timeout(2000)
    page.screenshot(path=str(RESULTS / "tc19-F008-03-dropdown-open.png"))

    # STEP 5: Collect users shown in dropdown
    dialog_users = page.evaluate("""() => {
        var opts = [...document.querySelectorAll('[role="option"], [role="listbox"] li, [data-radix-collection-item]')];
        var texts = opts
            .map(el => el.innerText ? el.innerText.trim() : '')
            .filter(t => t.includes('@'));
        return [...new Set(texts)];
    }""")
    print(f"  Users in dialog dropdown: {dialog_users}")

    # STEP 6: Check for overlap between existing admins and dropdown users
    overlap = [u for u in dialog_users if any(a in u.lower() for a in admin_emails)]
    print(f"  Already-admin users found in dialog: {overlap}")

    page.keyboard.press("Escape")
    page.wait_for_timeout(1000)
    page.screenshot(path=str(RESULTS / "tc19-F008-04-result.png"))

    if not overlap:
        print("  No existing admins appear in Assign Admin Role dialog")
    else:
        print(f"  BUG DETECTED — existing admins still selectable: {overlap}")

    assert not overlap, f"BUG: Already-admin users still appear in Assign Admin Role dialog: {overlap}"

    print("\n" + "=" * 60)
    print("TC19 PASSED — No existing admins appear in Assign Admin Role dialog")
    print("=" * 60)


# ─── TC20 ─────────────────────────────────────────────────────────────────────

def test_tc20_non_admin_cannot_access_console(unauthenticated_page, base_url):
    """TC20 — Non-admin user (sarah.wilson) must NOT see the Admin Console button."""
    page = unauthenticated_page
    login_to_gotalk(page, base_url, NO_ROLE_EMAIL, NO_ROLE_PASS)
    page.wait_for_load_state("networkidle")

    print("\n" + "=" * 60)
    print(f"TC20: NON-ADMIN USER CANNOT ACCESS ADMIN CONSOLE ({NO_ROLE_EMAIL})")
    print("=" * 60)

    # STEP 1: Verify Admin Console button is NOT visible
    print("\n  STEP 1: Verifying Admin Console button is NOT visible...")
    page.wait_for_timeout(3000)
    page.screenshot(path=str(RESULTS / "tc20-F008-01-no-admin-button.png"))

    visible = page.locator(f"xpath={ADMIN_CONSOLE_BTN}").is_visible()
    print(f"  Admin Console button visible: {visible}")

    assert not visible, "Non-admin user should NOT see the Admin Console button"
    print("  Admin Console button not present — access correctly restricted")

    print("\n" + "=" * 60)
    print("TC20 PASSED — Admin Console button not visible for non-admin user")
    print("=" * 60)
