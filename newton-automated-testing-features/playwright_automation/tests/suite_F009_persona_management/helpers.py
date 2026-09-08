import re

import pytest
from playwright.sync_api import Page, expect

_TEST_PREFIX = "PW_Test_Persona_"


def _navigate_to_personas(page: Page) -> None:
    """Open Admin Console -> Personas.

    Personas is a flat top-level sidebar button on the current gotalk.dev
    build — there is no "Access" submenu to expand and no ARIA tab role.
    """
    if "/admin-dashboard" not in page.url:
        page.get_by_role("button", name="Admin Console").click()
        page.wait_for_timeout(1000)
    # exact=True: the personas page itself has a "Refresh personas" button whose
    # accessible name is a substring match for "Personas", causing ambiguity.
    page.get_by_role("button", name="Personas", exact=True).click()
    page.wait_for_timeout(2500)


def _open_create_modal(page: Page) -> None:
    create_btn = page.get_by_role(
        "button",
        name=re.compile(r"create\s*new\s*persona|add\s*persona|new\s*persona", re.IGNORECASE),
    )
    expect(create_btn.first).to_be_visible(timeout=10000)
    create_btn.first.click()
    page.wait_for_timeout(2000)


def _fill_persona_name(dialog, page: Page, name: str) -> None:
    for loc in (
        dialog.get_by_placeholder(re.compile(r"marketing strategist|e\.g\.", re.IGNORECASE)),
        page.get_by_placeholder(re.compile(r"marketing strategist|e\.g\.", re.IGNORECASE)),
        page.get_by_role("textbox", name="Persona Name *"),
        dialog.get_by_role("textbox", name="Persona Name *"),
        dialog.get_by_placeholder(re.compile(r"persona\s*name|enter.*name", re.IGNORECASE)),
        dialog.locator("input[type='text']"),
    ):
        if loc.count() > 0 and loc.first.is_visible():
            loc.first.fill(name)
            page.wait_for_timeout(400)
            return


def _click_continue(page: Page) -> None:
    """Click the Continue button in the multi-step create wizard."""
    btn = page.get_by_role("button", name=re.compile(r"^continue$", re.IGNORECASE))
    if btn.count() > 0 and btn.first.is_visible():
        btn.first.click()
        page.wait_for_timeout(800)


def _fill_persona_text(
    dialog, page: Page,
    text: str = "Playwright automated test persona prompt for testing purposes.",
) -> None:
    for loc in (
        page.get_by_role("textbox", name="Persona Prompt *"),
        dialog.get_by_role("textbox", name="Persona Prompt *"),
        dialog.get_by_placeholder(
            re.compile(r"persona\s*(prompt|text)|system\s*prompt|enter.*prompt", re.IGNORECASE)
        ),
        dialog.locator("textarea"),
    ):
        if loc.count() > 0 and loc.first.is_visible():
            loc.first.fill(text)
            page.wait_for_timeout(400)
            return


def _fill_required_number_fields(dialog) -> None:
    """Temperature and Context window limit render their default (e.g. '0.7',
    '30000') as placeholder text only, not an actual value — the Intelligence
    step's Continue button stays disabled until they're explicitly filled."""
    for inp in dialog.locator("input[type='number']").all():
        try:
            if inp.is_visible() and not inp.input_value():
                placeholder = inp.get_attribute("placeholder") or "1"
                inp.fill(placeholder)
        except Exception:
            pass


def _select_first_model(page: Page, dialog) -> bool:
    """Select a model using the exact flow from the Playwright recording:
    click model header → search textbox → click first model button."""
    model_header = page.get_by_text(
        re.compile(r"Model\s*\*?\s*Select\s*a\s*model", re.IGNORECASE)
    )
    if model_header.count() > 0 and model_header.first.is_visible():
        model_header.first.click()
        page.wait_for_timeout(800)

    model_search = page.get_by_role("textbox", name="Search and select a model...")
    if model_search.count() == 0 or not model_search.first.is_visible():
        model_search = page.get_by_placeholder(
            re.compile(r"search.*select.*model|search.*model", re.IGNORECASE)
        )
    if model_search.count() == 0 or not model_search.first.is_visible():
        page.screenshot(path="results/debug-model-search-not-found.png")
        return False

    model_search.first.click()
    page.wait_for_timeout(800)

    # Model items render as <button> with text "provider/model-name".
    # filter(has_text=regex) goes through Python's regex engine — safe with "/" chars.
    model_btn = page.get_by_role("button").filter(has_text=re.compile(r"^[a-zA-Z0-9][^/\s]+/.+"))
    if model_btn.count() > 0 and model_btn.first.is_visible():
        model_btn.first.click()
        page.wait_for_timeout(600)
        _fill_required_number_fields(dialog)
        return True

    for selector in ("[cmdk-item]", "[role='option']"):
        items = page.locator(selector)
        if items.count() > 0 and items.first.is_visible():
            items.first.click(force=True)
            page.wait_for_timeout(600)
            _fill_required_number_fields(dialog)
            return True

    page.screenshot(path="results/debug-model-no-results.png")
    return False


def _select_dashboard_type(page: Page, dialog) -> None:
    """Select Dashboard persona type on wizard step 1 (codegen: 'Dashboard Builds analytics')."""
    for loc in (
        page.get_by_role(
            "button", name=re.compile(r"dashboard.*analytics|dashboard\s*builds", re.IGNORECASE)
        ),
        dialog.locator("button").filter(has_text=re.compile(r"dashboard", re.IGNORECASE)),
    ):
        if loc.count() > 0 and loc.first.is_visible():
            loc.first.click()
            page.wait_for_timeout(500)
            return


def _go_to_capabilities_step(
    page: Page,
    *,
    persona_type: str = "dashboard",
    name: str = "Wizard_Test",
    prompt: str = "data source check",
) -> bool:
    """Advance the open create-persona wizard to the Capabilities step."""
    dialog = page.locator("[role='dialog']")
    if dialog.count() == 0 or not dialog.first.is_visible():
        return False

    if persona_type.lower() == "dashboard":
        _select_dashboard_type(page, dialog)

    _fill_persona_name(dialog, page, name)
    page.wait_for_timeout(400)
    _click_continue(page)
    page.wait_for_timeout(1000)

    _fill_persona_text(dialog, page, text=prompt)
    page.wait_for_timeout(400)
    _click_continue(page)
    page.wait_for_timeout(1000)

    if not _select_first_model(page, dialog):
        return False
    page.wait_for_timeout(400)
    _click_continue(page)
    page.wait_for_timeout(1000)

    cap_step = page.get_by_role("button", name=re.compile(r"^capabilities$", re.IGNORECASE))
    if cap_step.count() > 0 and cap_step.first.is_visible():
        cap_step.first.click()
        page.wait_for_timeout(500)

    return True


def _verify_capabilities_data_sources_searchable(page: Page, dialog) -> bool:
    """Capabilities step: confirm a searchable Data sources list is present.

    The "Search and select data sources..." input renders directly on the
    Capabilities step for Dashboard personas — there's no header to click to
    reveal it. (The section label is "Data sources" lowercase; the old code's
    exact=True lookup for "Data Sources" actually matched the sidebar nav
    item of the same name, which sits behind the modal backdrop.)
    """
    ds_search = dialog.get_by_role(
        "textbox", name=re.compile(r"search\s*and\s*select\s*data", re.IGNORECASE)
    )
    if ds_search.count() == 0 or not ds_search.first.is_visible():
        ds_search = dialog.get_by_placeholder(
            re.compile(r"search\s*and\s*select\s*data", re.IGNORECASE)
        )
    if ds_search.count() == 0 or not ds_search.first.is_visible():
        page.screenshot(path="results/debug-ds-search-not-found.png")
        return False

    ds_search.first.click()
    page.wait_for_timeout(1000)

    for loc in (
        page.locator("[role='listbox'] [role='option']"),
        page.locator("[cmdk-item]"),
        page.get_by_role("button").filter(
            has_text=re.compile(r"main_db|sales|test\s*data|bench_main", re.IGNORECASE)
        ),
    ):
        if loc.count() > 0 and loc.first.is_visible():
            return True

    page.screenshot(path="results/debug-ds-no-options.png")
    return False


def _close_modal(page: Page, dialog) -> None:
    """Close any modal — tries Cancel/Done first, then Escape, then X icon."""
    for name_pat in (r"^cancel$", r"^done$", r"^dismiss$"):
        btn = dialog.get_by_role("button", name=re.compile(name_pat, re.IGNORECASE))
        if btn.count() > 0 and btn.first.is_visible():
            try:
                btn.first.click(force=True, timeout=3000)
                page.wait_for_timeout(800)
                return
            except Exception:
                pass
    # Escape is more reliable than clicking an X button that may be mid-animation
    page.keyboard.press("Escape")
    page.wait_for_timeout(1000)
    if not dialog.is_visible():
        return
    x_btn = dialog.locator(
        "button[aria-label*='close' i], button[aria-label*='dismiss' i], button[title*='close' i]"
    )
    if x_btn.count() > 0 and x_btn.first.is_visible():
        try:
            x_btn.first.click(timeout=3000)
        except Exception:
            pass
        page.wait_for_timeout(800)


def _cancel_dialog(page: Page, dialog) -> None:
    _close_modal(page, dialog)


def _create_test_persona(page: Page, name: str, persona_type: str = "chat") -> bool:
    """Create a persona via the 5-step wizard. Returns True on success.

    persona_type: "chat" (default) or "dashboard"
    """
    _open_create_modal(page)
    dialog = page.locator("[role='dialog']")
    expect(dialog).to_be_visible(timeout=8000)
    page.screenshot(path="results/debug-create-persona-modal.png")
    page.wait_for_timeout(500)

    # Step 1: Basics – select type if needed, fill name, click Continue
    if persona_type.lower() == "dashboard":
        _select_dashboard_type(page, dialog)

    _fill_persona_name(dialog, page, name)
    page.wait_for_timeout(500)
    _click_continue(page)
    page.wait_for_timeout(1000)

    # Step 2: Personality – fill persona text, click Continue
    _fill_persona_text(dialog, page)
    page.wait_for_timeout(500)
    _click_continue(page)
    page.wait_for_timeout(1000)

    # Step 3: Intelligence – select model, click Continue
    ok = _select_first_model(page, dialog)
    if not ok:
        _close_modal(page, dialog)
        return False
    page.wait_for_timeout(500)
    _click_continue(page)
    page.wait_for_timeout(1000)

    # Step 4: Capabilities – skip tool tags, click Continue
    _click_continue(page)
    page.wait_for_timeout(1000)

    # Step 5: Review – click Create Persona
    submit_btn = page.get_by_role("button", name=re.compile(r"create\s*persona", re.IGNORECASE))
    if submit_btn.count() == 0 or not submit_btn.first.is_visible():
        submit_btn = dialog.get_by_role(
            "button", name=re.compile(r"create\s*persona|save|submit|finish", re.IGNORECASE)
        )
    if submit_btn.count() == 0 or not submit_btn.first.is_visible():
        page.screenshot(path="results/debug-submit-btn-missing.png")
        _close_modal(page, dialog)
        return False
    if submit_btn.first.is_disabled():
        page.screenshot(path="results/debug-submit-btn-disabled.png")
        _close_modal(page, dialog)
        return False

    submit_btn.first.click()
    page.wait_for_timeout(2000)

    # Dismiss any leftover dialog with repeated Escape presses.
    # Avoid clicking the X button — it can detach mid-animation and block for 30 s.
    for _ in range(3):
        open_dialog = page.locator("[role='dialog']")
        if open_dialog.count() == 0 or not open_dialog.first.is_visible():
            break
        page.keyboard.press("Escape")
        page.wait_for_timeout(1200)

    personas_btn = page.get_by_role("button", name="Personas", exact=True)
    if personas_btn.count() > 0 and personas_btn.first.is_visible():
        personas_btn.first.click()
        page.wait_for_timeout(2000)

    return True


def _find_test_persona_row(page: Page, name: str):
    """Return the <tr> row locator for the persona with this exact name, or None.

    The persona list is a data table (not the old card grid) — each row has the
    persona name in a plain <span>, with Edit/Delete icon buttons (title="Edit
    persona" / "Delete persona") always visible in the row's Actions cell.
    """
    row = page.locator("tbody tr").filter(has=page.get_by_text(name, exact=True))
    if row.count() > 0 and row.first.is_visible():
        return row.first
    return None


def _open_persona_detail(page: Page, name: str) -> bool:
    """Click a persona row (by exact name) to open its detail panel."""
    text = page.get_by_text(name, exact=True)
    if text.count() == 0 or not text.first.is_visible():
        return False
    text.first.click()
    page.wait_for_timeout(1000)
    return True


def _hover_row(page: Page, row) -> None:
    row.hover()
    page.wait_for_timeout(1000)


def _get_action_btn(page: Page, title_pattern: str, container=None):
    """Return the first button matching title_pattern, scoped to container (or page-wide)."""
    scope = container if container is not None else page
    return scope.locator(
        f"button[title*='{title_pattern}' i], button[aria-label*='{title_pattern}' i], "
        f"[data-testid*='{title_pattern}']"
    ).first


def _find_checkboxes(page: Page):
    for loc in (
        page.locator("input[type='checkbox']"),
        page.get_by_role("checkbox"),
        page.locator("[role='checkbox']"),
        page.locator("button[data-state='unchecked'], button[data-state='checked']"),
        page.locator("[data-testid*='checkbox'], [class*='checkbox' i]").filter(
            has_not=page.locator("label")
        ),
    ):
        if loc.count() > 0:
            return loc
    return None


def _activate_bulk_select(page: Page) -> bool:
    """Click the pencil/edit Lucide icon in the header toolbar to enter bulk-select mode."""
    for selector in (
        "button:has([data-lucide='pencil-line'])",
        "button:has([data-lucide='pencil'])",
        "button:has([data-lucide='edit'])",
        "button:has([data-lucide='edit-2'])",
        "button:has([data-lucide='edit-3'])",
        "button:has([data-lucide='list-checks'])",
        "button:has([data-lucide='check-square'])",
        "button:has([data-lucide='check-square-2'])",
        "button[title*='select' i]",
        "button[aria-label*='select' i]",
        "button[title*='bulk' i]",
        "button[aria-label*='bulk' i]",
    ):
        btn = page.locator(selector).first
        if btn.is_visible():
            btn.click()
            page.wait_for_timeout(1000)
            return True
    return False


def _delete_test_persona(page: Page, name: str) -> None:
    """Delete a test persona by name via its row's Delete icon. No-op if not found."""
    row = _find_test_persona_row(page, name)
    if row is None:
        return

    delete_btn = row.get_by_role("button", name="Delete persona")
    if delete_btn.count() == 0 or not delete_btn.first.is_visible():
        return

    delete_btn.first.click()
    page.wait_for_timeout(1500)

    confirm_dialog = page.locator("[role='dialog'], [role='alertdialog']")
    if confirm_dialog.count() > 0 and confirm_dialog.first.is_visible():
        confirm_btn = confirm_dialog.first.get_by_role(
            "button", name=re.compile(r"^delete$|confirm.*delete", re.IGNORECASE)
        )
        if confirm_btn.count() > 0 and confirm_btn.first.is_visible():
            confirm_btn.first.click()
            page.wait_for_timeout(2000)


def _cleanup_test_personas(page: Page) -> None:
    """Delete every persona whose name starts with _TEST_PREFIX ('PW_Test_Persona_').

    Filters via the search box first — the persona table paginates (10 rows/page
    by default), so scanning only the current page's <tbody> can silently miss
    stray test personas sitting on page 2+. Loops until none remain or a safety
    limit is hit.
    """
    _navigate_to_personas(page)
    page.wait_for_timeout(2000)

    search = page.get_by_role("textbox", name=re.compile(r"search by persona", re.IGNORECASE))
    if search.count() > 0 and search.first.is_visible():
        search.first.fill(_TEST_PREFIX)
        page.wait_for_timeout(1500)

    for _ in range(50):
        rows = page.locator("tbody tr").filter(has_text=re.compile(rf"^{re.escape(_TEST_PREFIX)}"))
        if rows.count() == 0:
            break
        try:
            name = rows.first.locator("span.font-semibold").first.inner_text().strip()
            _delete_test_persona(page, name)
            page.wait_for_timeout(1000)
        except Exception:
            break


def _find_version_btn(page: Page):
    """Find the 'Create version' button in the open persona detail panel."""
    btn = page.get_by_role("button", name=re.compile(r"^create\s*version$", re.IGNORECASE))
    if btn.count() > 0 and btn.first.is_visible():
        return btn.first
    return None


def _find_version_badge(page: Page):
    """Find the version-switcher control (e.g. 'v1 · Live') in the persona detail panel.

    It's a Radix Select trigger with role="combobox", not a plain button.
    """
    badge = page.get_by_role("combobox", name="Persona version")
    if badge.count() > 0 and badge.first.is_visible():
        return badge.first
    return None


def _advance_version_wizard_to_review(page: Page, dialog) -> None:
    """Click Continue through the Create Version wizard to reach the Review step.

    Unlike the Create Persona wizard, every field here is pre-filled/inherited
    from the persona's current version, so no manual input is required first.
    """
    for _ in range(4):
        cont = dialog.get_by_role("button", name=re.compile(r"^continue$", re.IGNORECASE))
        if cont.count() == 0 or not cont.first.is_visible() or cont.first.is_disabled():
            break
        cont.first.click()
        page.wait_for_timeout(900)


def _create_test_version(page: Page, persona_name: str, set_as_current: bool = False) -> bool:
    """Open a persona's detail panel and create a new version via the wizard.

    Returns True on success. Set set_as_current=True to toggle "Set as current
    version" on the Review step before submitting.
    """
    if not _open_persona_detail(page, persona_name):
        return False

    version_btn = _find_version_btn(page)
    if version_btn is None:
        return False
    version_btn.click()
    page.wait_for_timeout(1500)

    dialog = page.locator("[role='dialog']")
    if dialog.count() == 0 or not dialog.first.is_visible():
        return False

    _advance_version_wizard_to_review(page, dialog)
    page.screenshot(path="results/debug-create-version-review.png")

    if set_as_current:
        toggle = dialog.get_by_text(re.compile(r"set as current version", re.IGNORECASE))
        if toggle.count() > 0 and toggle.first.is_visible():
            toggle.first.click()
            page.wait_for_timeout(400)

    submit_btn = dialog.get_by_role("button", name=re.compile(r"^create version$", re.IGNORECASE))
    if submit_btn.count() == 0 or not submit_btn.first.is_visible():
        page.keyboard.press("Escape")
        return False

    submit_btn.first.click()
    page.wait_for_timeout(2500)

    for _ in range(2):
        open_dialog = page.locator("[role='dialog']")
        if open_dialog.count() == 0 or not open_dialog.first.is_visible():
            break
        page.keyboard.press("Escape")
        page.wait_for_timeout(800)

    return True
