SALES_DASHBOARD_PERSONA_ID = 348

SALES_DASHBOARD_TEST_CASES = [
    # 🤖 1. Chatbot Queries — Answer Data Questions Directly
    {
        "query": "What were my total net sales and gross profit in 2022 vs 2023?",
        "persona_id": SALES_DASHBOARD_PERSONA_ID,
        "expected_tools": ["List Data Sources", "Query Data Source", "Query Data Source"],
        "expect_form": False,
        "enabled": True,
    },
    {
        "query": "Which product category generated the highest revenue?",
        "persona_id": SALES_DASHBOARD_PERSONA_ID,
        "expected_tools": ["List Data Sources", "Query Data Source", "Query Data Source" ],
        "expect_form": False,
        "enabled": True,
    },
    {
        "query": "Show me the top 5 products by sales.",
        "persona_id": SALES_DASHBOARD_PERSONA_ID,
        "expected_tools": ["List Data Sources", "Query Data Source", "Query Data Source"],
        "expect_form": False,
        "enabled": True,
    },
    {
        "query": "What is the average discount percentage across all orders?",
        "persona_id": SALES_DASHBOARD_PERSONA_ID,
        "expected_tools": ["List Data Sources", "Query Data Source", "Query Data Source"],
        "expect_form": False,
        "enabled": True,
    },
    {
        "query": "Which region has the highest profit margin?",
        "persona_id": SALES_DASHBOARD_PERSONA_ID,
        "expected_tools": ["List Data Sources", "Query Data Source", "Query Data Source"],
        "expect_form": False,
        "enabled": True,
    },

    # 📊 2. Chatbot Queries — Build Interactive Dashboards & Charts
    {
        "query": "Create a monthly sales trend chart for the last 2 years.",
        "persona_id": SALES_DASHBOARD_PERSONA_ID,
        "expected_tools": ["List Data Sources", "Query Data Source", "Query Data Source"],
        "expect_form": False,
        "enabled": True,
    },
    {
        "query": "Show a dashboard of sales by region and country.",
        "persona_id": SALES_DASHBOARD_PERSONA_ID,
        "expected_tools": ["List Data Sources", "Query Data Source", "Query Data Source"],
        "expect_form": False,
        "enabled": True,
    },
    {
        "query": "Build a category-wise revenue and profit comparison chart.",
        "persona_id": SALES_DASHBOARD_PERSONA_ID,
        "expected_tools": ["List Data Sources", "Query Data Source", "Query Data Source"],
        "expect_form": False,
        "enabled": True,
    },
    {
        "query": "Visualize discount vs profit relationship across products.",
        "persona_id": SALES_DASHBOARD_PERSONA_ID,
        "expected_tools": ["List Data Sources", "Query Data Source", "Query Data Source"],
        "expect_form": False,
        "enabled": True,
    },
    {
        "query": "Create a customer segment performance dashboard (sales, profit, orders).",
        "persona_id": SALES_DASHBOARD_PERSONA_ID,
        "expected_tools": ["List Data Sources", "Query Data Source", "Query Data Source"],
        "expect_form": False,
        "enabled": True,
    },
]
