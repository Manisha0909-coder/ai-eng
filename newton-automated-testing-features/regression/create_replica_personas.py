"""
Create replica personas for regression testing using Playwright UI automation.

The script authenticates via browser, fetches each original persona config from
the API, then drives the 5-step create wizard to make an exact replica.
Network responses are intercepted to capture the new persona ID.

Usage:
    python -m regression.create_replica_personas

Output:
    regression/replica_ids.json  — original → replica ID mapping
    Printed update lines for each test_cases_*.py file.
"""

import json
import os
import re
import sys
import time

import urllib3
import requests
from playwright.sync_api import sync_playwright, Page

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ── Config ────────────────────────────────────────────────────────────────────

SITE_URL = "https://gotalk.dev"
PERSONAS_API = f"{SITE_URL}/api/mid/personas"
ROLES_API   = f"{SITE_URL}/api/mid/roles"
REPLICA_PREFIX = "PW_Replica_"

ORIGINALS = {
    "graph":           220,
    "asset_manager":   135,
    "tender":          131,
    "hr":              105,
    "sales_dashboard": 348,
    "qatar_tourism":   106,
}

TEST_CASE_FILES = {
    "graph":           ("test_cases_graph.py",          "GRAPH_PERSONA_ID"),
    "asset_manager":   ("test_cases_asset_manager.py",  "ASSET_MANAGER_PERSONA_ID"),
    "tender":          ("test_cases_tender.py",          "TENDER_PERSONA_ID"),
    "hr":              ("test_cases_hr.py",              "HR_PERSONA_ID"),
    "sales_dashboard": ("test_cases_sales_dashboard.py", "SALES_DASHBOARD_PERSONA_ID"),
    "qatar_tourism":   ("test_cards.py",                 "QATAR_TOURISM_PERSONA_ID"),
}


# ── Load persona config from local file ───────────────────────────────────────

PERSONAS_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "personas_config.json")

def fetch_persona_config(persona_id: int, cookie_header: str = None) -> dict | None:
    try:
        with open(PERSONAS_CONFIG_PATH) as f:
            data = json.load(f)
        for persona in data.get("personas", []):
            if persona.get("id") == persona_id:
                return persona
        print(f"  ⚠️  Persona ID {persona_id} not found in {PERSONAS_CONFIG_PATH}")
    except Exception as e:
        print(f"  ⚠️  Failed to load {PERSONAS_CONFIG_PATH}: {e}")
    return None


# ── Playwright wizard helpers ─────────────────────────────────────────────────

def _navigate_to_personas(page: Page) -> None:
    page.get_by_role("button", name="Admin Console").click()
    page.wait_for_timeout(1000)
    page.get_by_role("button", name="Access").click()
    page.wait_for_timeout(1500)
    page.get_by_role("tab", name="Personas").click()
    page.wait_for_timeout(2500)


def _open_create_modal(page: Page) -> None:
    btn = page.get_by_role(
        "button",
        name=re.compile(r"create\s*new\s*persona|add\s*persona|new\s*persona", re.IGNORECASE),
    )
    btn.first.click()
    page.wait_for_timeout(2000)


def _select_type(page: Page, dialog, persona_type: str) -> None:
    if persona_type.lower() == "dashboard":
        for loc in (
            page.get_by_role("button", name=re.compile(r"dashboard.*analytics|dashboard\s*builds", re.IGNORECASE)),
            dialog.locator("button").filter(has_text=re.compile(r"^dashboard$", re.IGNORECASE)),
        ):
            if loc.count() > 0 and loc.first.is_visible():
                loc.first.click()
                page.wait_for_timeout(500)
                return


def _fill_name(dialog, page: Page, name: str) -> None:
    for loc in (
        dialog.get_by_placeholder(re.compile(r"marketing strategist|e\.g\.", re.IGNORECASE)),
        page.get_by_placeholder(re.compile(r"marketing strategist|e\.g\.", re.IGNORECASE)),
        dialog.get_by_role("textbox", name="Persona Name *"),
        dialog.locator("input[type='text']"),
    ):
        if loc.count() > 0 and loc.first.is_visible():
            loc.first.fill(name)
            page.wait_for_timeout(300)
            return


def _fill_prompt(dialog, page: Page, prompt: str) -> None:
    for loc in (
        page.get_by_role("textbox", name="Persona Prompt *"),
        dialog.get_by_role("textbox", name="Persona Prompt *"),
        dialog.locator("textarea"),
    ):
        if loc.count() > 0 and loc.first.is_visible():
            loc.first.fill(prompt)
            page.wait_for_timeout(300)
            return


def _click_continue(page: Page) -> None:
    btn = page.get_by_role("button", name=re.compile(r"^continue$", re.IGNORECASE))
    if btn.count() > 0 and btn.first.is_visible():
        btn.first.click()
        page.wait_for_timeout(800)


def _select_model(page: Page, model_id: str) -> bool:
    """Open model search, type the model name, click the matching option."""
    model_name = model_id.split("/")[-1]  # e.g. "gpt-5.5" from "openai-proxy/openai/gpt-5.5"

    # Open the model picker
    header = page.get_by_text(re.compile(r"Model\s*\*?\s*Select\s*a\s*model", re.IGNORECASE))
    if header.count() > 0 and header.first.is_visible():
        header.first.click()
        page.wait_for_timeout(800)

    search = page.get_by_role("textbox", name="Search and select a model...")
    if search.count() == 0 or not search.first.is_visible():
        search = page.get_by_placeholder(re.compile(r"search.*select.*model|search.*model", re.IGNORECASE))
    if search.count() == 0 or not search.first.is_visible():
        return False

    search.first.click()
    search.first.fill(model_name)
    page.wait_for_timeout(800)

    # Try exact model name match first, then partial
    for pattern in (re.escape(model_name), model_name[:6]):
        btn = page.get_by_role("button").filter(has_text=re.compile(pattern, re.IGNORECASE))
        if btn.count() > 0 and btn.first.is_visible():
            btn.first.click()
            page.wait_for_timeout(600)
            return True

    # Fallback: first visible option
    for selector in ("[cmdk-item]", "[role='option']"):
        items = page.locator(selector)
        if items.count() > 0 and items.first.is_visible():
            items.first.click(force=True)
            page.wait_for_timeout(600)
            return True

    return False


def _open_capabilities_section(page: Page, label_pattern: str) -> None:
    """Click a collapsible section header in step 4 (force=True to bypass overlay)."""
    for loc in (
        page.get_by_text(re.compile(label_pattern, re.IGNORECASE)),
        page.locator("button").filter(has_text=re.compile(label_pattern, re.IGNORECASE)),
    ):
        if loc.count() > 0:
            try:
                loc.first.click(force=True, timeout=3000)
                page.wait_for_timeout(600)
                return
            except Exception:
                pass


def _pick_from_search(page: Page, search_pattern: str, item_name: str) -> bool:
    """Open a search input matching search_pattern, type item_name, click the result."""
    search = page.get_by_role("textbox", name=re.compile(search_pattern, re.IGNORECASE))
    if search.count() == 0 or not search.first.is_visible():
        search = page.get_by_placeholder(re.compile(search_pattern, re.IGNORECASE))
    if search.count() == 0 or not search.first.is_visible():
        return False

    search.first.click()
    search.first.fill(item_name)
    page.wait_for_timeout(600)

    for loc in (
        page.locator("[role='option']").filter(has_text=re.compile(re.escape(item_name), re.IGNORECASE)),
        page.locator("[cmdk-item]").filter(has_text=re.compile(re.escape(item_name), re.IGNORECASE)),
        page.get_by_role("button").filter(has_text=re.compile(re.escape(item_name), re.IGNORECASE)),
        page.locator("li").filter(has_text=re.compile(re.escape(item_name), re.IGNORECASE)),
    ):
        if loc.count() > 0 and loc.first.is_visible():
            loc.first.click()
            page.wait_for_timeout(400)
            return True
    return False


def _select_tool_tags(page: Page, dialog, tag_names: list[str]) -> None:
    """In step 4 Capabilities, select each tool tag by name."""
    if not tag_names:
        return

    # Tool Tags section may need opening
    _open_capabilities_section(page, r"tool\s*tags?")
    page.wait_for_timeout(500)

    for tag_name in tag_names:
        # Try search/select first
        if _pick_from_search(page, r"search.*tool|tool.*search|search.*tag", tag_name):
            continue
        # Fallback: checkbox or button directly visible
        for loc in (
            page.get_by_role("checkbox", name=re.compile(re.escape(tag_name), re.IGNORECASE)),
            page.locator("label").filter(has_text=re.compile(re.escape(tag_name), re.IGNORECASE)),
            page.locator("[cmdk-item]").filter(has_text=re.compile(re.escape(tag_name), re.IGNORECASE)),
        ):
            if loc.count() > 0 and loc.first.is_visible():
                loc.first.click(force=True)
                page.wait_for_timeout(400)
                break

    page.wait_for_timeout(400)


def _select_datasources(page: Page, dialog, ds_names: list[str]) -> None:
    """In step 4 Capabilities, attach each data source by name."""
    if not ds_names:
        return

    # Open the Data Sources collapsible section
    _open_capabilities_section(page, r"data\s*sources?")
    page.wait_for_timeout(600)

    for ds_name in ds_names:
        if _pick_from_search(page, r"search.*data|data.*search|search.*select.*data", ds_name):
            continue
        # Fallback: direct option
        for loc in (
            page.locator("[role='option']").filter(has_text=re.compile(re.escape(ds_name), re.IGNORECASE)),
            page.locator("[cmdk-item]").filter(has_text=re.compile(re.escape(ds_name), re.IGNORECASE)),
        ):
            if loc.count() > 0 and loc.first.is_visible():
                loc.first.click()
                page.wait_for_timeout(400)
                break


def _submit_wizard(page: Page, dialog) -> None:
    submit = page.get_by_role("button", name=re.compile(r"create\s*persona", re.IGNORECASE))
    if submit.count() == 0 or not submit.first.is_visible():
        submit = dialog.get_by_role("button", name=re.compile(r"create\s*persona|save|finish", re.IGNORECASE))
    if submit.count() > 0 and not submit.first.is_disabled():
        submit.first.click()
        page.wait_for_timeout(3000)


def _dismiss_any_dialog(page: Page) -> None:
    for _ in range(3):
        dlg = page.locator("[role='dialog']")
        if dlg.count() == 0 or not dlg.first.is_visible():
            break
        page.keyboard.press("Escape")
        page.wait_for_timeout(1000)


# ── Core: create one replica and return its ID ────────────────────────────────

def create_replica(page: Page, config: dict, replica_name: str) -> int | None:
    """Drive the 5-step wizard to create a replica. Returns the new persona ID."""
    captured_id: list[int] = []

    def on_response(response):
        url = response.url
        # Wizard POSTs to gotalk.dev/api/mid/personas which redirects to
        # localhost:5000/personas/ — catch both URL patterns.
        is_persona_url = (
            "/api/mid/personas" in url
            or "localhost:5000/personas" in url
            or "/personas/" in url
        )
        if not is_persona_url:
            return
        if response.status not in (200, 201):
            return
        try:
            body = response.json()
            print(f"    [net] {url} → {str(body)[:120]}")
            persona = (
                body.get("data", {}).get("persona")
                or body.get("persona")
                or body  # some backends return the object directly
            )
            if isinstance(persona, dict):
                pid = persona.get("id")
                if pid and pid not in captured_id:
                    captured_id.append(pid)
        except Exception:
            pass

    page.on("response", on_response)

    try:
        _open_create_modal(page)
        dialog = page.locator("[role='dialog']")
        dialog.first.wait_for(state="visible", timeout=8000)

        # Step 1: type + name
        _select_type(page, dialog, config.get("type", "chat"))
        _fill_name(dialog, page, replica_name)
        page.wait_for_timeout(400)
        _click_continue(page)
        page.wait_for_timeout(1000)

        # Step 2: persona prompt
        prompt = config.get("persona_prompt") or config.get("persona", "Persona replica.")
        _fill_prompt(dialog, page, prompt)
        page.wait_for_timeout(400)
        _click_continue(page)
        page.wait_for_timeout(1000)

        # Step 3: model
        model_id = config.get("model_id", "")
        if not _select_model(page, model_id):
            print(f"    ⚠️  Could not select model '{model_id}', using first available")
            # fallback: first model button
            btn = page.get_by_role("button").filter(has_text=re.compile(r"^[a-zA-Z0-9][^/\s]+/.+"))
            if btn.count() > 0 and btn.first.is_visible():
                btn.first.click()
                page.wait_for_timeout(600)
        page.wait_for_timeout(400)
        _click_continue(page)
        page.wait_for_timeout(1000)

        # Step 4: capabilities — tool tags + data sources
        tag_names = [t["name"] for t in config.get("tool_tags", [])]
        ds_names  = [d["name"] for d in config.get("datasources", [])]
        page.screenshot(path=f"regression/debug-step4-{replica_name[:20]}.png")
        _select_tool_tags(page, dialog, tag_names)
        _select_datasources(page, dialog, ds_names)
        page.wait_for_timeout(500)
        _click_continue(page)
        page.wait_for_timeout(1000)

        # Step 5: review + submit
        _submit_wizard(page, dialog)

    finally:
        page.remove_listener("response", on_response)

    _dismiss_any_dialog(page)

    # Re-click Personas tab to refresh list
    tab = page.get_by_role("tab", name="Personas")
    if tab.count() > 0 and tab.first.is_visible():
        tab.first.click()
        page.wait_for_timeout(2000)

    return captured_id[0] if captured_id else None


# ── Login ─────────────────────────────────────────────────────────────────────

def login(page: Page, base_url: str, email: str, password: str) -> None:
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "playwright_automation"))
    from auth.login import login_to_gotalk
    login_to_gotalk(page, base_url, email, password)
    try:
        page.wait_for_load_state("networkidle", timeout=10000)
    except Exception:
        pass


# ── Shared header builder ─────────────────────────────────────────────────────

def _api_headers(cookie_header: str) -> dict:
    return {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Cookie": cookie_header,
        "Origin": SITE_URL,
        "Referer": f"{SITE_URL}/",
        "User-Agent": "Mozilla/5.0",
    }


# ── Role & user API helpers ───────────────────────────────────────────────────

def _create_role_for_persona(persona_id: int, role_name: str, cookie_header: str) -> int | None:
    """POST /api/mid/roles/ — create a role with the persona already attached. Returns role_id."""
    payload = {
        "name": role_name,
        "description": role_name,
        "document_tag_ids": [],
        "persona_ids": [persona_id],
    }
    try:
        resp = requests.post(
            f"{ROLES_API}/",
            json=payload,
            headers=_api_headers(cookie_header),
            verify=False,
            timeout=20,
            allow_redirects=False,
        )
        if resp.status_code in (200, 201):
            body = resp.json()
            role = body.get("data", {}).get("role") or body.get("role") or body
            if isinstance(role, dict) and role.get("id"):
                return role["id"]
        print(f"    ⚠️  Create role → {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print(f"    ❌ Create role failed: {e}")
    return None


def _attach_role_to_user(role_id: int, email: str, cookie_header: str) -> bool:
    """POST /api/mid/roles/{role_id}/bulk_attach_users — attach a user to a role directly.

    Additive: doesn't touch the user's other roles, so there's no need to
    read-modify-write the user's full roles list (which is also what
    /api/mid/users/by_email/{email} is GET-only for — it has no PATCH/PUT).
    """
    try:
        resp = requests.post(
            f"{ROLES_API}/{role_id}/bulk_attach_users",
            json={"user_ids": [email]},
            headers=_api_headers(cookie_header),
            verify=False,
            timeout=20,
        )
        if resp.status_code == 200 and resp.json().get("success"):
            return True
        print(f"    ⚠️  Attach user to role → {resp.status_code}: {resp.text[:300]}")
    except Exception as e:
        print(f"    ❌ Attach user to role failed: {e}")
    return False


def _delete_role_api(role_id: int, cookie_header: str) -> bool:
    """DELETE /api/mid/roles/{role_id}."""
    try:
        resp = requests.delete(
            f"{ROLES_API}/{role_id}",
            headers=_api_headers(cookie_header),
            verify=False,
            timeout=20,
        )
        return resp.status_code in (200, 204)
    except Exception as e:
        print(f"    ❌ Delete role {role_id} failed: {e}")
    return False


# ── API-based persona creation helpers ───────────────────────────────────────

def _get_cookie_header(email: str, password: str, base_url: str) -> str:
    """Log in via Playwright (login page only) and return cookie header string."""
    print(f"🌐 Launching browser → {base_url}")
    print(f"🔑 Logging in as {email}...")
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = browser.new_context(ignore_https_errors=True)
        page = context.new_page()
        login(page, base_url, email, password)
        cookies = context.cookies()
        browser.close()
    print(f"✅ Login successful — {len(cookies)} cookies captured")
    return "; ".join(f"{c['name']}={c['value']}" for c in cookies)


def _create_persona_api(config: dict, replica_name: str, cookie_header: str) -> int | None:
    """POST /api/mid/personas/ — create a persona. Returns the new persona ID."""
    payload = {
        "persona_name":        replica_name,
        "persona":             config.get("persona") or config.get("persona_prompt", ""),
        "greeting_message":    config.get("greeting_message", ""),
        "model_id":            config.get("model_id", ""),
        "temperature":         config.get("temperature", 0.1),
        "context_window_limit": config.get("context_window_limit", 30000),
        "tool_tag_ids":        [t["id"] for t in config.get("tool_tags", [])],
        "document_tag_ids":    config.get("document_tag_ids", []),
        "datasource_ids":      [d["id"] for d in config.get("datasources", [])],
        "supports_documents":  config.get("supports_documents", False),
        "type":                config.get("type", "chat"),
        "system_prompt":       config.get("system_prompt", ""),
    }
    try:
        # allow_redirects=False: 307 redirect targets localhost:5000 (internal proxy);
        # the first-hop response from gotalk.dev already contains the created persona.
        resp = requests.post(
            f"{PERSONAS_API}/",
            json=payload,
            headers=_api_headers(cookie_header),
            verify=False,
            timeout=30,
            allow_redirects=False,
        )
        body = None
        try:
            body = resp.json()
        except Exception:
            pass
        for status_ok in (resp.status_code in (200, 201), resp.status_code in (301, 302, 307, 308)):
            if status_ok and body:
                persona = (
                    body.get("data", {}).get("persona")
                    or body.get("persona")
                    or body
                )
                if isinstance(persona, dict) and persona.get("id"):
                    return persona["id"]
        print(f"  ⚠️  Unexpected response {resp.status_code}: {resp.text[:300]}")
    except Exception as e:
        print(f"  ❌ POST persona failed: {e}")
    return None


# ── Public API: create all replicas and return IDs + role info + cookie ───────

def run_create_replicas(
    email: str | None = None,
    password: str | None = None,
    base_url: str = SITE_URL,
    persona_filter: str | None = None,
) -> tuple[dict[str, int], dict[str, tuple[int, str]], str]:
    """
    Log in via browser (cookie only), then for each original persona:
      1. Create replica persona via POST
      2. Create a dedicated role with that persona attached via POST
      3. Attach the role to the logged-in user via PUT

    Returns (replica_ids, replica_roles, cookie_header).
      replica_ids   : key → new persona ID
      replica_roles : key → (role_id, role_name)
    persona_filter: one of the ORIGINALS keys, or None for all.
    """
    from dotenv import load_dotenv
    load_dotenv()
    email    = email    or os.getenv("GOTALK_EMAIL", "")
    password = password or os.getenv("GOTALK_PASSWORD", "")

    if not email or not password:
        raise RuntimeError("Set GOTALK_EMAIL and GOTALK_PASSWORD in .env")

    cookie_header  = _get_cookie_header(email, password, base_url)
    targets        = {persona_filter: ORIGINALS[persona_filter]} if persona_filter else ORIGINALS
    replica_ids:   dict[str, int]              = {}
    replica_roles: dict[str, tuple[int, str]]  = {}

    failed_keys: list[str] = []

    for key, original_id in targets.items():
        print(f"\n── {key} (original ID: {original_id}) ──")
        config = fetch_persona_config(original_id, cookie_header)
        if not config:
            print("  ❌ Could not fetch config — skipping.")
            failed_keys.append(key)
            continue

        original_name = config.get("persona_name", str(original_id))
        replica_name  = f"{REPLICA_PREFIX}{original_name}"
        role_name     = f"{REPLICA_PREFIX}role_{key}"

        print(f"  Config: name={original_name!r}  type={config.get('type')}  model={config.get('model_id')}")
        print(f"     tool_tags={[t['name'] for t in config.get('tool_tags', [])]}")
        print(f"     datasources={[d['name'] for d in config.get('datasources', [])]}")

        # 1. Create persona
        print(f"  Creating persona '{replica_name}'...")
        new_persona_id = _create_persona_api(config, replica_name, cookie_header)
        if not new_persona_id:
            print(f"  ❌ Persona creation failed for {key} — skipping role step.")
            failed_keys.append(key)
            continue
        replica_ids[key] = new_persona_id
        print(f"  ✅ Persona created — ID: {new_persona_id}")

        # 2. Create role with this persona already attached
        print(f"  Creating role '{role_name}'...")
        new_role_id = _create_role_for_persona(new_persona_id, role_name, cookie_header)
        if not new_role_id:
            print(f"  ❌ Role creation failed for {key}")
            failed_keys.append(key)
            continue
        replica_roles[key] = (new_role_id, role_name)
        print(f"  ✅ Role created — ID: {new_role_id}")

        # 3. Attach role to user
        ok = _attach_role_to_user(new_role_id, email, cookie_header)
        if not ok:
            print(f"  ❌ Failed to attach role to user for {key}")
            failed_keys.append(key)
        else:
            print("  ✅ Role attached to user")

    return replica_ids, replica_roles, cookie_header, failed_keys


def delete_replica_personas(
    replica_ids:   dict[str, int],
    replica_roles: dict[str, tuple[int, str]],
    cookie_header: str,
) -> None:
    """Delete roles (which also drops the user's association with them), then
    delete replica personas."""
    if not replica_ids and not replica_roles:
        return

    print("\n🗑  Cleaning up replicas...")

    # 1. Delete each role
    for key, (role_id, role_name) in replica_roles.items():
        ok = _delete_role_api(role_id, cookie_header)
        print(f"  {'✅' if ok else '⚠️ '} Deleted role '{role_name}' (ID: {role_id})")

    # 3. Delete each persona
    for key, pid in replica_ids.items():
        try:
            resp = requests.delete(
                f"{PERSONAS_API}/{pid}",
                headers=_api_headers(cookie_header),
                verify=False,
                timeout=20,
            )
            ok = resp.status_code in (200, 204)
            print(f"  {'✅' if ok else '⚠️ '} Deleted persona {key} (ID: {pid})"
                  + ("" if ok else f" → {resp.status_code}: {resp.text[:80]}"))
        except Exception as e:
            print(f"  ❌ DELETE persona {pid} failed: {e}")


def delete_replica_sessions(
    session_ids: list[str],
    cookie_header: str,
) -> None:
    """Delete all chat sessions created during the regression test run."""
    if not session_ids:
        return

    print("\n🗑  Cleaning up sessions...")
    sessions_api = f"{SITE_URL}/api/mid/session/delete_chat_session"

    for session_id in session_ids:
        try:
            resp = requests.post(
                sessions_api,
                json={"session_id": session_id},
                headers=_api_headers(cookie_header),
                verify=False,
                timeout=20,
            )
            ok = resp.status_code in (200, 204)
            print(f"  {'✅' if ok else '⚠️ '} Deleted session {session_id}"
                  + ("" if ok else f" → {resp.status_code}: {resp.text[:80]}"))
        except Exception as e:
            print(f"  ❌ DELETE session {session_id} failed: {e}")


# ── Main (standalone use) ─────────────────────────────────────────────────────

def main() -> None:
    from dotenv import load_dotenv
    load_dotenv()

    base_url = os.getenv("BASE_URL", SITE_URL)
    email    = os.getenv("GOTALK_EMAIL", "")
    password = os.getenv("GOTALK_PASSWORD", "")

    if not email or not password:
        sys.exit("Set GOTALK_EMAIL and GOTALK_PASSWORD in your .env file.")

    # Parse optional --persona <key> from command-line arguments
    persona_filter: str | None = None
    args = sys.argv[1:]
    if "--persona" in args:
        idx = args.index("--persona")
        if idx + 1 < len(args):
            persona_filter = args[idx + 1]
            if persona_filter not in ORIGINALS:
                sys.exit(f"Unknown persona '{persona_filter}'. Valid keys: {list(ORIGINALS)}")
        else:
            sys.exit("--persona requires a value, e.g. --persona qatar_tourism")

    replica_ids, _, __, _failed = run_create_replicas(
        email=email, password=password, base_url=base_url, persona_filter=persona_filter
    )

    # ── Save mapping ──────────────────────────────────────────────────────────
    out = {
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "originals":  ORIGINALS,
        "replicas":   replica_ids,
    }
    out_path = os.path.join(os.path.dirname(__file__), "replica_ids.json")
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"\n📄 Mapping saved to {out_path}")

    if replica_ids:
        print("\n── Paste these into each test_cases_*.py ──")
        for key, new_id in replica_ids.items():
            if key in TEST_CASE_FILES:
                file_, var = TEST_CASE_FILES[key]
                print(f"  {file_:<40}  {var} = {new_id}")
            else:
                print(f"  {key:<40}  persona_id = {new_id}")
    else:
        print("\n⚠️  No replicas created.")


if __name__ == "__main__":
    main()
