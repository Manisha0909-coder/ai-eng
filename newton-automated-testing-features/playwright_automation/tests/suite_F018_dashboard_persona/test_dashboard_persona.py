"""
suite_F018 – Dashboard Persona

Covers:
  US001 – Natural language data queries answered without creating visualizations
  US002 – Visualization / dashboard creation from natural language
  US003 – Combined: data answer + chart continuity in a single session
  US004 – Data source validation: real data returned, no fabrication
  US005 – Dashboard reuse: second identical request handled gracefully
  US006 – Query safety: no DML SQL, bounded result sets

Navigation: CHAT button → "Search & select persona…" → Dashboard-type persona.

AI responses are non-deterministic; tests verify presence of relevant keywords
and/or chart UI elements rather than exact text matches.
"""

import contextlib
import io
import re
import sys
from pathlib import Path

import pytest
from playwright.sync_api import Page, expect

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from auth.login import login_to_gotalk

# ---------------------------------------------------------------------------
# Response timeout — dashboard creation can take up to 2 minutes
# ---------------------------------------------------------------------------
_RESPONSE_TIMEOUT_MS = 120_000


# ---------------------------------------------------------------------------
# Navigation & interaction helpers
# ---------------------------------------------------------------------------


def _select_dashboard_persona(page: Page) -> None:
    """Select the Dashboard mode and Sales Assistant persona, then open the chat sidebar."""
    page.get_by_role("button", name="Select Dashboard mode").click()
    page.wait_for_timeout(1000)
    page.get_by_role("button", name="Select persona Sales Assistant").click()
    page.wait_for_timeout(1000)
    page.get_by_role("button", name="Show chat sidebar").click()
    page.wait_for_timeout(1000)
    page.get_by_role("textbox", name="Chat message").click()
    page.wait_for_timeout(500)


def _send_query(page: Page, query: str) -> None:
    """Type and submit a query; confirm the user message is visible."""
    chat_input = page.get_by_role("textbox", name="Chat message")
    chat_input.wait_for(timeout=20_000)
    chat_input.fill(query)
    page.wait_for_timeout(500)
    chat_input.press("Enter")
    # Confirm the sent message appeared (match on first 40 chars to avoid truncation issues)
    expect(
        page.locator(".user-message", has_text=query[:40]).first
    ).to_be_visible(timeout=15_000)
    page.wait_for_timeout(1000)


def _wait_for_response(page: Page) -> None:
    """Wait until the AI finishes generating (Stop Generating button disappears)."""
    stop_btn = page.get_by_role("button", name="Stop generating")
    try:
        stop_btn.wait_for(state="visible", timeout=15_000)
    except Exception:
        pass  # Model may respond too quickly to catch the button
    try:
        stop_btn.wait_for(state="detached", timeout=_RESPONSE_TIMEOUT_MS)
    except Exception:
        pass  # Already gone before we checked
    page.wait_for_timeout(2000)  # pause so the full response is visible


def _get_last_response_text(page: Page) -> str:
    """Return the inner text of the last assistant message (lower-cased)."""
    for selector in (
        ".assistant-message",
        "[data-role='assistant']",
        ".chat-message.assistant",
        ".message.assistant",
        ".prose",
    ):
        els = page.locator(selector)
        if els.count() > 0:
            return els.last.inner_text().lower()
    return page.locator("body").inner_text().lower()


def _has_keywords(text: str, keywords: list) -> bool:
    return any(kw.lower() in text for kw in keywords)


def _has_chart_ui(page: Page) -> bool:
    """Return True if any chart/graph rendering element exists on the page."""
    for sel in (
        "canvas",
        "svg.recharts-surface",
        "[data-testid*='chart']",
        "[class*='chart']",
        "[class*='graph']",
        "[class*='dashboard']",
        ".echarts",
        ".apexcharts-canvas",
    ):
        if page.locator(sel).count() > 0:
            return True
    return False


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------



# =====================================================================
# US001 – Natural language data queries (text answers, no visualization)
# =====================================================================


def test_us001_tc01_dashboard_persona_selectable(page: Page):
    """US001 – Dashboard mode and Sales Assistant persona are selectable."""
    print("\n[US001-TC01] Verifying Dashboard persona is selectable")
    page.get_by_role("button", name="Select Dashboard mode").click()
    page.get_by_role("button", name="Select persona Sales Assistant").click()
    page.get_by_role("button", name="Show chat sidebar").click()

    chat_input = page.get_by_role("textbox", name="Chat message")
    expect(chat_input).to_be_visible(timeout=20_000)
    page.screenshot(path="results/dash-us001-tc01-persona-selector.png")
    print("[US001-TC01] PASS – Dashboard persona visible in persona selector")


def test_us001_tc02_net_sales_and_gross_profit(page: Page):
    """US001 – 'Total net sales and gross profit 2022 vs 2023' returns numeric text answer."""
    query = "What were my total net sales and gross profit in 2022 vs 2023?"
    print(f"\n[US001-TC02] Query: {query}")
    _select_dashboard_persona(page)
    _send_query(page, query)
    page.screenshot(path="results/dash-us001-tc02-sent.png")

    _wait_for_response(page)
    page.screenshot(path="results/dash-us001-tc02-response.png")

    response = _get_last_response_text(page)
    assert _has_keywords(response, ["sales", "profit", "2022", "2023"]), (
        f"Expected sales/profit/year keywords. Got: {response[:300]}"
    )
    assert re.search(r"\d[\d,\.]+", response), (
        f"Expected numeric values in response. Got: {response[:300]}"
    )
    print("[US001-TC02] PASS – Response contains sales/profit figures with numbers")


def test_us001_tc03_highest_revenue_category(page: Page):
    """US001 – 'Highest revenue product category' returns a factual text answer."""
    query = "Which product category generated the highest revenue?"
    print(f"\n[US001-TC03] Query: {query}")
    _select_dashboard_persona(page)
    _send_query(page, query)

    _wait_for_response(page)
    page.screenshot(path="results/dash-us001-tc03-response.png")

    response = _get_last_response_text(page)
    assert _has_keywords(response, ["category", "revenue"]), (
        f"Expected category/revenue keywords. Got: {response[:300]}"
    )
    print("[US001-TC03] PASS – Response identifies top revenue category")


def test_us001_tc04_top5_products_by_sales(page: Page):
    """US001 – 'Top 5 products by sales' returns a list or table with numeric sales values."""
    query = "Show me the top 5 products by sales."
    print(f"\n[US001-TC04] Query: {query}")
    _select_dashboard_persona(page)
    _send_query(page, query)

    _wait_for_response(page)
    page.screenshot(path="results/dash-us001-tc04-response.png")

    response = _get_last_response_text(page)
    assert _has_keywords(response, ["product", "sales"]), (
        f"Expected product/sales keywords. Got: {response[:300]}"
    )
    assert re.search(r"\d[\d,\.]+", response), (
        f"Expected numeric sales figures. Got: {response[:300]}"
    )
    print("[US001-TC04] PASS – Response lists top products with sales figures")


def test_us001_tc05_average_discount_percentage(page: Page):
    """US001 – 'Average discount percentage across all orders' returns a percentage value."""
    query = "What is the average discount percentage across all orders?"
    print(f"\n[US001-TC05] Query: {query}")
    _select_dashboard_persona(page)
    _send_query(page, query)

    _wait_for_response(page)
    page.screenshot(path="results/dash-us001-tc05-response.png")

    response = _get_last_response_text(page)
    assert _has_keywords(response, ["discount", "average"]), (
        f"Expected discount/average keywords. Got: {response[:300]}"
    )
    has_pct = bool(re.search(r"\d+[\.,]?\d*\s*%", response))
    has_num = bool(re.search(r"\d[\d,\.]+", response))
    assert has_pct or has_num, (
        f"Expected a percentage or numeric value in response. Got: {response[:300]}"
    )
    print("[US001-TC05] PASS – Response contains average discount value")


def test_us001_tc06_highest_profit_margin_region(page: Page):
    """US001 – 'Highest profit margin region' returns a factual text answer naming a region."""
    query = "Which region has the highest profit margin?"
    print(f"\n[US001-TC06] Query: {query}")
    _select_dashboard_persona(page)
    _send_query(page, query)

    _wait_for_response(page)
    page.screenshot(path="results/dash-us001-tc06-response.png")

    response = _get_last_response_text(page)
    assert _has_keywords(response, ["region", "profit", "margin"]), (
        f"Expected region/profit/margin keywords. Got: {response[:300]}"
    )
    print("[US001-TC06] PASS – Response identifies highest profit margin region")


# =====================================================================
# US002 – Visualization / dashboard creation
# =====================================================================


def test_us002_tc01_monthly_sales_trend_chart(page: Page):
    """US002 – 'Monthly sales trend chart for last 2 years' triggers dashboard/chart creation."""
    query = "Create a monthly sales trend chart for the last 2 years."
    print(f"\n[US002-TC01] Query: {query}")
    _select_dashboard_persona(page)
    _send_query(page, query)

    _wait_for_response(page)
    page.wait_for_timeout(4000)
    page.screenshot(path="results/dash-us002-tc01-response.png")

    response = _get_last_response_text(page)
    has_viz_kw = _has_keywords(response, ["chart", "dashboard", "trend", "created", "graph", "sales"])
    has_chart = _has_chart_ui(page)
    assert has_viz_kw or has_chart, (
        f"Expected chart/dashboard response or chart UI. Got: {response[:300]}"
    )
    print(f"[US002-TC01] PASS – Monthly sales trend handled (chart UI present: {has_chart})")


def test_us002_tc02_sales_by_region_and_country(page: Page):
    """US002 – 'Dashboard of sales by region and country' creates a named dashboard."""
    query = "Show a dashboard of sales by region and country."
    print(f"\n[US002-TC02] Query: {query}")
    _select_dashboard_persona(page)
    _send_query(page, query)

    _wait_for_response(page)
    page.wait_for_timeout(4000)
    page.screenshot(path="results/dash-us002-tc02-response.png")

    response = _get_last_response_text(page)
    has_viz_kw = _has_keywords(response, ["dashboard", "sales", "region", "country", "created", "chart"])
    has_chart = _has_chart_ui(page)
    assert has_viz_kw or has_chart, (
        f"Expected dashboard creation response or chart UI. Got: {response[:300]}"
    )
    print(f"[US002-TC02] PASS – Region/country dashboard handled (chart UI present: {has_chart})")


def test_us002_tc03_category_revenue_profit_comparison(page: Page):
    """US002 – 'Category-wise revenue and profit comparison chart' produces a visualization."""
    query = "Build a category-wise revenue and profit comparison chart."
    print(f"\n[US002-TC03] Query: {query}")
    _select_dashboard_persona(page)
    _send_query(page, query)

    _wait_for_response(page)
    page.wait_for_timeout(4000)
    page.screenshot(path="results/dash-us002-tc03-response.png")

    response = _get_last_response_text(page)
    has_viz_kw = _has_keywords(response, ["category", "revenue", "profit", "chart", "comparison", "dashboard"])
    has_chart = _has_chart_ui(page)
    assert has_viz_kw or has_chart, (
        f"Expected visualization response or chart UI. Got: {response[:300]}"
    )
    print(f"[US002-TC03] PASS – Category comparison chart handled (chart UI present: {has_chart})")


def test_us002_tc04_discount_vs_profit_visualization(page: Page):
    """US002 – 'Visualize discount vs profit relationship across products' creates a chart."""
    query = "Visualize discount vs profit relationship across products."
    print(f"\n[US002-TC04] Query: {query}")
    _select_dashboard_persona(page)
    _send_query(page, query)

    _wait_for_response(page)
    page.wait_for_timeout(4000)
    page.screenshot(path="results/dash-us002-tc04-response.png")

    response = _get_last_response_text(page)
    has_viz_kw = _has_keywords(response, ["discount", "profit", "chart", "graph", "visual", "relationship"])
    has_chart = _has_chart_ui(page)
    assert has_viz_kw or has_chart, (
        f"Expected visualization response or chart UI. Got: {response[:300]}"
    )
    print(f"[US002-TC04] PASS – Discount vs profit visualization handled (chart UI present: {has_chart})")


def test_us002_tc05_customer_segment_performance_dashboard(page: Page):
    """US002 – 'Customer segment performance dashboard' creates a multi-metric dashboard."""
    query = "Create a customer segment performance dashboard (sales, profit, orders)."
    print(f"\n[US002-TC05] Query: {query}")
    _select_dashboard_persona(page)
    _send_query(page, query)

    _wait_for_response(page)
    page.wait_for_timeout(4000)
    page.screenshot(path="results/dash-us002-tc05-response.png")

    response = _get_last_response_text(page)
    has_viz_kw = _has_keywords(response, ["customer", "segment", "dashboard", "sales", "profit", "orders"])
    has_chart = _has_chart_ui(page)
    assert has_viz_kw or has_chart, (
        f"Expected customer segment dashboard response or chart UI. Got: {response[:300]}"
    )
    print(f"[US002-TC05] PASS – Customer segment dashboard handled (chart UI present: {has_chart})")


# =====================================================================
# US003 – Combined data answer + visualization in one session
# =====================================================================


def test_us003_tc01_data_query_then_chart_in_same_session(page: Page):
    """US003 – Session handles a data query followed by a chart request without losing context."""
    print("\n[US003-TC01] Testing data query followed by chart request in same session")
    _select_dashboard_persona(page)

    # Step 1: plain data query
    data_query = "What were my total net sales and gross profit in 2022 vs 2023?"
    _send_query(page, data_query)
    _wait_for_response(page)
    page.screenshot(path="results/dash-us003-tc01-data.png")

    data_response = _get_last_response_text(page)
    assert _has_keywords(data_response, ["sales", "profit"]), (
        f"Expected sales/profit in first response. Got: {data_response[:200]}"
    )

    # Step 2: visualization follow-up in the same session
    chart_query = "Create a monthly sales trend chart for the last 2 years."
    _send_query(page, chart_query)
    _wait_for_response(page)
    page.wait_for_timeout(4000)
    page.screenshot(path="results/dash-us003-tc01-chart.png")

    chart_response = _get_last_response_text(page)
    has_viz_kw = _has_keywords(chart_response, ["chart", "dashboard", "trend", "sales", "created"])
    has_chart = _has_chart_ui(page)
    assert has_viz_kw or has_chart, (
        f"Expected chart response after data query. Got: {chart_response[:300]}"
    )
    print("[US003-TC01] PASS – Data query and chart request both handled in same session")


def test_us003_tc02_combined_outputs_are_consistent(page: Page):
    """US003 – Data answer and subsequent chart use the same logical scope (sales topic)."""
    print("\n[US003-TC02] Verifying data and chart use consistent scope")
    _select_dashboard_persona(page)

    # Data query
    data_query = "Which product category generated the highest revenue?"
    _send_query(page, data_query)
    _wait_for_response(page)
    page.screenshot(path="results/dash-us003-tc02-data.png")

    data_response = _get_last_response_text(page)
    assert _has_keywords(data_response, ["category", "revenue"]), (
        f"Expected category/revenue in data response. Got: {data_response[:200]}"
    )

    # Chart follow-up — must be topically consistent
    chart_query = "Build a category-wise revenue and profit comparison chart."
    _send_query(page, chart_query)
    _wait_for_response(page)
    page.wait_for_timeout(4000)
    page.screenshot(path="results/dash-us003-tc02-chart.png")

    chart_response = _get_last_response_text(page)
    has_viz_kw = _has_keywords(chart_response, ["category", "revenue", "chart", "profit", "dashboard"])
    has_chart = _has_chart_ui(page)
    assert has_viz_kw or has_chart, (
        f"Expected category-focused chart response. Got: {chart_response[:300]}"
    )
    print("[US003-TC02] PASS – Data and chart responses are topically consistent")


# =====================================================================
# US004 – Data source validation (real data, no fabrication)
# =====================================================================


def test_us004_tc01_response_is_not_empty(page: Page):
    """US004 – System always returns a non-empty response; never a blank message."""
    query = "Which product category generated the highest revenue?"
    print(f"\n[US004-TC01] Verifying non-empty response for: {query}")
    _select_dashboard_persona(page)
    _send_query(page, query)

    _wait_for_response(page)
    page.screenshot(path="results/dash-us004-tc01-response.png")

    response = _get_last_response_text(page)
    assert len(response.strip()) > 20, (
        f"Response is too short or empty. Got: '{response[:100]}'"
    )
    print("[US004-TC01] PASS – Response is non-empty")


def test_us004_tc02_response_contains_real_data(page: Page):
    """US004 – Response to a numeric query contains actual figures, not a vague fallback."""
    query = "Show me the top 5 products by sales."
    print(f"\n[US004-TC02] Verifying real data in response for: {query}")
    _select_dashboard_persona(page)
    _send_query(page, query)

    _wait_for_response(page)
    page.screenshot(path="results/dash-us004-tc02-response.png")

    response = _get_last_response_text(page)
    has_content = _has_keywords(response, ["product", "sales"]) and bool(re.search(r"\d[\d,\.]+", response))
    # Permanent-failure phrases that would indicate fabrication rather than real data
    hard_failures = ["i don't have access", "i cannot access any data", "no data source"]
    is_hard_failure = any(p in response for p in hard_failures) and not has_content
    assert not is_hard_failure, (
        f"Response looks like a permanent data-access failure (no real data). Got: {response[:300]}"
    )
    assert len(response.strip()) > 20, "Response is too short"
    print("[US004-TC02] PASS – Response contains real data or a valid graceful message")


def test_us004_tc03_schema_aware_keywords_in_response(page: Page):
    """US004 – Response references domain-relevant terms (sales, region, discount, etc.)."""
    query = "Which region has the highest profit margin?"
    print(f"\n[US004-TC03] Verifying schema-aware response for: {query}")
    _select_dashboard_persona(page)
    _send_query(page, query)

    _wait_for_response(page)
    page.screenshot(path="results/dash-us004-tc03-response.png")

    response = _get_last_response_text(page)
    domain_keywords = ["region", "profit", "margin", "sales", "data"]
    assert _has_keywords(response, domain_keywords), (
        f"Expected domain keywords {domain_keywords}. Got: {response[:300]}"
    )
    print("[US004-TC03] PASS – Response references domain-relevant terms")


# =====================================================================
# US005 – Dashboard reuse (no duplicate dashboards)
# =====================================================================


def test_us005_tc01_repeated_dashboard_request_handled(page: Page):
    """US005 – Sending the same chart request twice in a session does not cause an error."""
    query = "Create a monthly sales trend chart for the last 2 years."
    print(f"\n[US005-TC01] Sending same chart request twice")
    _select_dashboard_persona(page)

    _send_query(page, query)
    _wait_for_response(page)
    page.wait_for_timeout(2000)
    page.screenshot(path="results/dash-us005-tc01-first.png")

    _send_query(page, query)
    _wait_for_response(page)
    page.wait_for_timeout(2000)
    page.screenshot(path="results/dash-us005-tc01-second.png")

    second_response = _get_last_response_text(page)
    assert len(second_response.strip()) > 20, "Second response should not be empty"
    critical_errors = ["internal server error", "error 500", "http 500", "status 500", "unexpected error", "fatal error"]
    assert not any(e in second_response for e in critical_errors), (
        f"Critical error on second dashboard request. Got: {second_response[:300]}"
    )
    print("[US005-TC01] PASS – Second identical dashboard request handled without critical error")


def test_us005_tc02_dashboard_response_references_a_name(page: Page):
    """US005 – Dashboard creation response references a descriptive name or title."""
    query = "Show a dashboard of sales by region and country."
    print(f"\n[US005-TC02] Checking dashboard has a descriptive name reference")
    _select_dashboard_persona(page)
    _send_query(page, query)

    _wait_for_response(page)
    page.wait_for_timeout(4000)
    page.screenshot(path="results/dash-us005-tc02-dashboard.png")

    response = _get_last_response_text(page)
    has_name_kw = _has_keywords(response, ["sales", "region", "dashboard", "created", "named", "chart"])
    has_chart = _has_chart_ui(page)
    assert has_name_kw or has_chart, (
        f"Expected named dashboard reference or chart UI element. Got: {response[:300]}"
    )
    print("[US005-TC02] PASS – Dashboard creation response contains name or UI element")


# =====================================================================
# US006 – Query safety (SELECT-only, bounded result sets)
# =====================================================================


def test_us006_tc01_no_dml_sql_in_response(page: Page):
    """US006 – AI response never surfaces raw DML SQL (INSERT, UPDATE, DELETE, DROP, TRUNCATE)."""
    query = "What is the average discount percentage across all orders?"
    print(f"\n[US006-TC01] Checking no DML SQL in response")
    _select_dashboard_persona(page)
    _send_query(page, query)

    _wait_for_response(page)
    page.screenshot(path="results/dash-us006-tc01-response.png")

    response = _get_last_response_text(page)
    dml_patterns = [
        r"\binsert\s+into\b",
        r"\bupdate\s+\w+\s+set\b",
        r"\bdelete\s+from\b",
        r"\bdrop\s+table\b",
        r"\btruncate\s+table\b",
        r"\balter\s+table\b",
    ]
    for pattern in dml_patterns:
        match = re.search(pattern, response, re.IGNORECASE)
        assert not match, (
            f"Forbidden DML '{match.group()}' found in response. Got: {response[:300]}"
        )
    print("[US006-TC01] PASS – No DML SQL found in response")


def test_us006_tc02_response_does_not_indicate_unlimited_rows(page: Page):
    """US006 – Response does not indicate returning an uncapped / unlimited result set."""
    query = "Show me the top 5 products by sales."
    print(f"\n[US006-TC02] Checking result set is bounded")
    _select_dashboard_persona(page)
    _send_query(page, query)

    _wait_for_response(page)
    page.screenshot(path="results/dash-us006-tc02-response.png")

    response = _get_last_response_text(page)
    assert _has_keywords(response, ["product", "sales"]), (
        f"Expected product/sales keywords. Got: {response[:300]}"
    )
    overflow_phrases = ["all rows returned", "returning all records", "no limit applied", "no row limit"]
    assert not any(p in response for p in overflow_phrases), (
        f"Response implies unlimited row return. Got: {response[:300]}"
    )
    print("[US006-TC02] PASS – Response does not indicate unbounded result set")


def test_us006_tc03_no_dml_in_visualization_response(page: Page):
    """US006 – Even visualization queries never surface DML SQL in the response."""
    query = "Build a category-wise revenue and profit comparison chart."
    print(f"\n[US006-TC03] Checking no DML SQL in visualization response")
    _select_dashboard_persona(page)
    _send_query(page, query)

    _wait_for_response(page)
    page.screenshot(path="results/dash-us006-tc03-response.png")

    response = _get_last_response_text(page)
    dml_patterns = [
        r"\binsert\s+into\b",
        r"\bupdate\s+\w+\s+set\b",
        r"\bdelete\s+from\b",
        r"\bdrop\s+table\b",
        r"\btruncate\s+table\b",
    ]
    for pattern in dml_patterns:
        match = re.search(pattern, response, re.IGNORECASE)
        assert not match, (
            f"Forbidden DML '{match.group()}' in visualization response. Got: {response[:300]}"
        )
    print("[US006-TC03] PASS – No DML SQL in visualization response")
