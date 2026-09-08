"""
Pytest-based regression tests for GoTalk.dev persona queries.

Run commands:
  pytest regression/test_regression.py -v                          # all personas
  pytest regression/test_regression.py -v --persona graph          # one persona
  pytest regression/test_regression.py -v -k "teams"               # filter by query keyword
  pytest regression/test_regression.py -v -x                       # stop on first failure
  pytest regression/test_regression.py -v --lf                     # rerun last failed only
  pytest regression/test_regression.py -v --junit-xml=results/regression.xml
"""

import asyncio
import os

import aiohttp
import pytest

from regression.api_client import safe_send_query
from regression.test_cases import get_test_cases, PERSONA_TEST_CASES
from regression.validators import check_keywords, extract_icv_values, check_account_not_connected
from regression.ai_form_judge import judge_form_fields, judge_response, format_field_summary


RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results_regression")
os.makedirs(RESULTS_DIR, exist_ok=True)


# ── Build parametrize list at collection time ──────────────────────────────────

def _collect_params(persona_filter=None, enabled_only=True):
    """Return (test_id, test_case_with_persona_key) pairs."""
    params = []
    sources = (
        {persona_filter: PERSONA_TEST_CASES[persona_filter]}
        if persona_filter and persona_filter in PERSONA_TEST_CASES
        else PERSONA_TEST_CASES
    )
    for persona_key, cases in sources.items():
        for tc in cases:
            if enabled_only and not tc.get("enabled", True):
                continue
            enriched = {**tc, "persona_key": persona_key}
            query_slug = tc["query"][:50].replace(" ", "_").replace("/", "-")
            test_id = f"{persona_key}::{query_slug}"
            params.append(pytest.param(enriched, id=test_id))
    return params


# ── Dynamic parametrize via pytest hook (reads --persona at collection time) ──

def pytest_generate_tests(metafunc):
    if "test_case" in metafunc.fixturenames:
        persona = metafunc.config.getoption("--persona", default="all")
        enabled_only = not metafunc.config.getoption("--include-disabled", default=False)
        persona_filter = None if persona == "all" else persona
        params = _collect_params(persona_filter=persona_filter, enabled_only=enabled_only)
        metafunc.parametrize("test_case", params)


# ── Async helper ───────────────────────────────────────────────────────────────

def _run_query(query, persona_id, cookie_header):
    """Synchronous wrapper: create a fresh aiohttp session and run the query."""
    async def _inner():
        timeout = aiohttp.ClientTimeout(total=180, sock_read=120)
        connector = aiohttp.TCPConnector(ssl=False)
        async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
            return await safe_send_query(
                session, query, persona_id, {"cookie_header": cookie_header}, verbose=False
            )
    return asyncio.run(_inner())


# ── Session-level Excel report ─────────────────────────────────────────────────

_results_log: list[dict] = []


@pytest.fixture(autouse=True)
def _record_result(request, regression_context):
    """Capture each test result for the Excel report."""
    yield
    rep = request.node.stash.get("regression_result", None)
    if rep:
        _results_log.append(rep)


# ── Test ───────────────────────────────────────────────────────────────────────

def test_persona_query(test_case, regression_context, request):
    persona_key      = test_case["persona_key"]
    query            = test_case["query"]
    expected_tools   = test_case.get("expected_tools", [])
    expect_form      = test_case.get("expect_form", False)
    expected_form    = test_case.get("expected_form_title")
    expected_fields  = test_case.get("expected_fields")
    keywords         = test_case.get("keywords", [])
    check_icv        = test_case.get("check_icv", False)
    number_check     = test_case.get("number_check", False)

    orig_to_replica  = regression_context["orig_to_replica"]
    cookie_header    = regression_context["cookie_header"]
    session_ids      = regression_context["session_ids"]
    warn_session_ids = regression_context["warn_session_ids"]

    persona_id = orig_to_replica.get(test_case["persona_id"], test_case["persona_id"])

    tools_called, tools_errored, tool_error_messages, response, final_response, form_title, form_fields, session_id = \
        _run_query(query, persona_id, cookie_header)

    if session_id:
        session_ids.append(session_id)
        if tools_errored:
            warn_session_ids.add(session_id)

    # ── Assertions ────────────────────────────────────────────────────────────
    found_keywords, missing_keywords = check_keywords(response, keywords)

    failures  = []
    warnings  = []

    # Tool errors are warnings only — if the output is still correct, test passes
    if tools_errored:
        err_detail = "; ".join(f"{t}: {tool_error_messages.get(t, 'unknown')}" for t in tools_errored)
        warnings.append(f"Tool errors (retried): {err_detail}")
        print(f"⚠️  [session_id={session_id}] Tool errors: {err_detail}")

    missing_tools = [t for t in expected_tools if t not in tools_called]
    if missing_tools:
        failures.append(f"Missing tools {missing_tools} — got {tools_called}")

    if persona_key == "graph" and check_account_not_connected(response):
        failures.append("Microsoft account not connected — assistant reported account not connected")

    ai_field_check = {"checked": False, "passed": None, "issues": [], "summary": "N/A"}
    if expect_form and form_title != expected_form:
        failures.append(f"Form mismatch — expected '{expected_form}' got '{form_title}'")
    elif not expect_form and form_title is not None:
        failures.append(f"Unexpected form '{form_title}'")
    elif expect_form and form_title == expected_form and form_fields:
        ai_field_check = judge_form_fields(query, form_title, form_fields, expected_fields)
        if ai_field_check["passed"] is False:
            issue_detail = "; ".join(f"{i.get('field')}: {i.get('problem')}" for i in ai_field_check["issues"])
            failures.append(f"AI field check failed: {issue_detail}")

    ai_response_check = judge_response(query, final_response, tools_called)
    if ai_response_check["passed"] is False:
        failures.append(f"AI response check failed: {ai_response_check['problem']}")

    if missing_keywords:
        failures.append(f"Missing keywords: {missing_keywords}")

    if check_icv:
        icv_values = extract_icv_values(response)
        if not icv_values:
            failures.append("No ICV values found in response")

    if number_check:
        numbers = [t for t in response.split() if any(c.isdigit() for c in t)]
        if not numbers:
            failures.append("No numeric values found in response")

    result = "FAIL" if failures else ("WARN" if warnings else "PASS")

    # ── Store for Excel report ────────────────────────────────────────────────
    request.node.stash["regression_result"] = {
        "Persona":         persona_key,
        "Query":           query,
        "Expected Tools":  ", ".join(expected_tools),
        "Actual Tools":    ", ".join(tools_called),
        "Tools Errored":   ", ".join(tools_errored) if tools_errored else "None",
        "Tool Errors":     "; ".join(f"{t}: {m}" for t, m in tool_error_messages.items()) or "None",
        "Form Expected":   expected_form or "N/A",
        "Form Actual":     form_title or "N/A",
        "Form Fields":     format_field_summary(form_fields) if form_fields else "N/A",
        "AI Field Check":  ("PASS" if ai_field_check["passed"] else "FAIL") if ai_field_check["checked"] else "N/A",
        "AI Field Issues": "; ".join(f"{i.get('field')}: {i.get('problem')}" for i in ai_field_check["issues"]) if ai_field_check["issues"] else "None",
        "AI Field Summary": ai_field_check["summary"] or "N/A",
        "AI Response Check": ("PASS" if ai_response_check["passed"] else "FAIL") if ai_response_check["checked"] else "N/A",
        "AI Response Issue": ai_response_check["problem"] or "None",
        "AI Response Summary": ai_response_check["summary"] or "N/A",
        "Keywords":        ", ".join(keywords) if keywords else "N/A",
        "Missing Keywords": ", ".join(missing_keywords) if missing_keywords else "None",
        "Response":        response[:300].replace("\n", " "),
        "Final Response (AI-checked)": final_response[:300].replace("\n", " "),
        "Result":          result,
        "Warnings":        " | ".join(warnings) if warnings else "",
        "Failure Reason":  " | ".join(failures) if failures else "",
    }

    assert not failures, f"[session_id={session_id}] " + " | ".join(failures)
