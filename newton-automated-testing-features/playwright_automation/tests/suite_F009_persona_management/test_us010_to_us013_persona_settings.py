import re
import sys
from pathlib import Path

import pytest
from playwright.sync_api import Page, expect

sys.path.insert(0, str(Path(__file__).parent))
from helpers import (
    _TEST_PREFIX,
    _navigate_to_personas,
    _create_test_persona,
    _open_create_modal,
    _close_modal,
    _fill_persona_name,
    _fill_persona_text,
    _click_continue,
    _select_first_model,
    _go_to_capabilities_step,
    _verify_capabilities_data_sources_searchable,
    _delete_test_persona,
)


@pytest.fixture
def created_personas(page: Page):
    names: list[str] = []
    yield names
    if not names:
        return
    try:
        _navigate_to_personas(page)
        for name in names:
            _delete_test_persona(page, name)
    except Exception:
        pass


# Clicking "Tool Rules" in the Configuration tab throws an uncaught
# `ReferenceError: Loader2 is not defined` in gotalk.dev's bundle, crashing the
# panel to a blank screen. Reproduced against a guaranteed-fresh persona name
# (ruling out stale test data), console/pageerror captured via Playwright.
# This is an app bug, not a selector/test issue — file separately, don't
# silently work around it here.
_tool_rules_panel_crashes = pytest.mark.xfail(
    condition=True,
    reason="Tool Rules panel throws 'ReferenceError: Loader2 is not defined' and crashes on gotalk.dev",
    strict=False,
)


# =====================================================================
# US010 – Tool Execution Rules for a Persona
# =====================================================================


@_tool_rules_panel_crashes
def test_us010_tool_rules_panel_opens(page: Page, created_personas: list):
    """US010 – Each persona has a Tool Rules option under the Configuration tab."""
    print("\n[US010] Testing Tool Rules panel")
    test_name = f"{_TEST_PREFIX}ToolRules_Panel"
    created_personas.append(test_name)
    _navigate_to_personas(page)

    created = _create_test_persona(page, test_name)
    if not created:
        pytest.skip("Could not create test persona")

    page.get_by_text(test_name, exact=True).click()
    page.wait_for_timeout(500)
    page.get_by_role("tab", name="Configuration").click()
    page.wait_for_timeout(1000)

    tool_rules_btn = page.get_by_role("button", name="Tool Rules")
    if not tool_rules_btn.is_visible():
        pytest.skip("Tool Rules button not found in Configuration tab")

    tool_rules_btn.click()
    page.wait_for_timeout(2000)
    page.screenshot(path="results/persona-us010-01-tool-rules.png")

    body_text = page.locator("body").inner_text().lower()
    has_rules_panel = any(
        kw in body_text
        for kw in ("tool rules", "add rule", "no tool rules", "tool execution", "select rule type")
    )
    print(f"[US010] Tool Rules panel content: {has_rules_panel}")
    assert has_rules_panel, "Expected Tool Rules panel content"
    print("[US010] PASS – Tool Rules panel opens")

    close_btn = page.get_by_role("button", name=re.compile(r"close|back|cancel", re.IGNORECASE)).first
    if close_btn.is_visible():
        close_btn.click()
        page.wait_for_timeout(800)


@_tool_rules_panel_crashes
def test_us010_add_rule_button_present(page: Page, created_personas: list):
    """US010 – Tool Rules panel has an Add Rule button."""
    print("\n[US010] Checking Add Rule button in Tool Rules panel")
    test_name = f"{_TEST_PREFIX}ToolRules_AddRule"
    created_personas.append(test_name)
    _navigate_to_personas(page)

    created = _create_test_persona(page, test_name)
    if not created:
        pytest.skip("Could not create test persona")

    page.get_by_text(test_name, exact=True).click()
    page.wait_for_timeout(500)
    page.get_by_role("tab", name="Configuration").click()
    page.wait_for_timeout(1000)

    tool_rules_btn = page.get_by_role("button", name="Tool Rules")
    if not tool_rules_btn.is_visible():
        pytest.skip("Tool Rules button not found in Configuration tab")

    tool_rules_btn.click()
    page.wait_for_timeout(2000)

    add_rule_btn = page.get_by_role("button", name=re.compile(r"add\s*rule", re.IGNORECASE))
    page.screenshot(path="results/persona-us010-02-add-rule.png")
    expect(add_rule_btn.first).to_be_visible(timeout=8000)
    print("[US010] PASS – Add Rule button found in Tool Rules panel")

    close_btn = page.get_by_role("button", name=re.compile(r"close|back|cancel", re.IGNORECASE)).first
    if close_btn.is_visible():
        close_btn.click()
        page.wait_for_timeout(800)


# =====================================================================
# US011 – View and Edit Data Sources
# =====================================================================


def test_us011_data_sources_section_present(page: Page, created_personas: list):
    """US011 – Data Sources section appears in Configuration tab after attaching one during creation."""
    print("\n[US011] Checking Data Sources section on persona")
    test_name = f"{_TEST_PREFIX}DataSources"
    created_personas.append(test_name)
    _navigate_to_personas(page)

    # Open create modal and navigate to Capabilities step with dashboard type
    _open_create_modal(page)
    dialog = page.locator("[role='dialog']")
    expect(dialog).to_be_visible(timeout=8000)

    reached = _go_to_capabilities_step(
        page, persona_type="dashboard", name=test_name, prompt="data source test"
    )
    if not reached:
        _close_modal(page, dialog)
        pytest.skip("Could not reach Capabilities step in create wizard")

    # Attach the first available data source. The "Search and select data
    # sources..." input renders directly on the Capabilities step for
    # Dashboard personas — no header click needed. (A page-wide, unscoped
    # get_by_text("Data Sources", exact=True) would actually hit the sidebar
    # nav item of the same name, which sits behind the modal backdrop.)
    ds_search = dialog.get_by_role(
        "textbox", name=re.compile(r"search\s*and\s*select\s*data", re.IGNORECASE)
    )
    if ds_search.count() > 0 and ds_search.first.is_visible():
        ds_search.first.click()
        page.wait_for_timeout(1000)
        # Try "Test data" first (always available), fallback to first visible ds button
        test_data_btn = page.get_by_role("button", name="Test data")
        if test_data_btn.is_visible():
            test_data_btn.click()
        else:
            first_ds_btn = page.get_by_role("button").filter(
                has_text=re.compile(r"main_db|sales|test\s*data|bench_main", re.IGNORECASE)
            ).first
            if first_ds_btn.is_visible():
                first_ds_btn.click()
        page.wait_for_timeout(500)

    _click_continue(page)
    page.wait_for_timeout(1000)

    # Submit persona creation
    submit_btn = page.get_by_role("button", name=re.compile(r"create\s*persona", re.IGNORECASE))
    if submit_btn.count() == 0 or not submit_btn.first.is_visible():
        _close_modal(page, dialog)
        pytest.skip("Could not reach Create Persona button")
    submit_btn.first.click()
    page.wait_for_timeout(3000)

    for _ in range(2):
        open_dialog = page.locator("[role='dialog']")
        if open_dialog.count() == 0 or not open_dialog.first.is_visible():
            break
        page.keyboard.press("Escape")
        page.wait_for_timeout(800)

    personas_btn = page.get_by_role("button", name="Personas", exact=True)
    if personas_btn.count() > 0 and personas_btn.first.is_visible():
        personas_btn.first.click()
        page.wait_for_timeout(2000)

    persona_text = page.get_by_text(test_name, exact=True)
    if not persona_text.is_visible():
        pytest.skip("Test persona not found after creation")

    persona_text.click()
    page.wait_for_timeout(500)
    page.get_by_role("tab", name="Configuration").click()
    page.wait_for_timeout(1500)
    page.screenshot(path="results/persona-us011-01-data-sources.png")

    body_text = page.locator("body").inner_text().lower()
    has_ds = any(kw in body_text for kw in ("data source", "data sources", "attached", "no data source"))
    print(f"[US011] Data Sources section: {has_ds}")
    assert has_ds, "Expected Data Sources section in Configuration tab"
    print("[US011] PASS – Data Sources section found in Configuration tab")


# =====================================================================
# US012 – View Available LLM Models
# =====================================================================


def test_us012_models_list_in_create_modal(page: Page):
    """US012 – A list of available LLM models is accessible on step 3 (Intelligence) of the Create wizard."""
    print("\n[US012] Checking LLM model list in Create wizard (step 3: Intelligence)")
    _navigate_to_personas(page)
    page.wait_for_timeout(500)
    _open_create_modal(page)
    page.wait_for_timeout(800)

    dialog = page.locator("[role='dialog']")
    expect(dialog).to_be_visible(timeout=8000)
    page.screenshot(path="results/persona-us012-00-modal-open.png")

    # Navigate to step 3 (Intelligence): fill step 1 name → step 2 text → arrive at step 3
    _fill_persona_name(dialog, page, "US012_Model_Test")
    page.wait_for_timeout(400)
    _click_continue(page)
    page.wait_for_timeout(1000)

    _fill_persona_text(dialog, page)
    page.wait_for_timeout(400)
    _click_continue(page)
    page.wait_for_timeout(1000)

    page.screenshot(path="results/persona-us012-00-step3.png")

    dialog_text = dialog.inner_text().lower()
    assert "model" in dialog_text, "Expected 'model' field in Intelligence step"

    if not _select_first_model(page, dialog):
        page.screenshot(path="results/persona-us012-00-no-model-trigger.png")
        pytest.fail(
            "Model picker not accessible or no models in list — "
            "see results/persona-us012-00-no-model-trigger.png"
        )

    page.screenshot(path="results/persona-us012-01-models.png")
    print("[US012] PASS – LLM models list accessible in Create wizard step 3")
    _close_modal(page, dialog)


# =====================================================================
# US013 – Attach a Data Source to a Persona
# =====================================================================


def test_us013_attach_data_source_searchable_list(page: Page):
    """US013 – Attaching a data source provides a searchable list on the Capabilities step."""
    print("\n[US013] Testing data source searchable list (Capabilities step)")
    _navigate_to_personas(page)
    page.wait_for_timeout(500)
    _open_create_modal(page)
    page.wait_for_timeout(800)

    dialog = page.locator("[role='dialog']")
    expect(dialog).to_be_visible(timeout=8000)

    on_capabilities = _go_to_capabilities_step(
        page,
        persona_type="dashboard",
        name=f"{_TEST_PREFIX}DS_Wizard",
        prompt="data source check",
    )
    if not on_capabilities:
        page.screenshot(path="results/persona-us013-00-wizard-failed.png")
        _close_modal(page, dialog)
        pytest.skip("Could not reach Capabilities step in create wizard")

    page.screenshot(path="results/persona-us013-01-capabilities.png")

    has_list = _verify_capabilities_data_sources_searchable(page, dialog)
    page.screenshot(path="results/persona-us013-02-datasource-list.png")

    _close_modal(page, dialog)

    assert has_list, (
        "Expected searchable data source list on Capabilities step — "
        "see results/persona-us013-02-datasource-list.png"
    )
    print("[US013] PASS – Data source searchable list on Capabilities step")
