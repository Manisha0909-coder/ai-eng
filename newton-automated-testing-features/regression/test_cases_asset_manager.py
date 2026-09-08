ASSET_MANAGER_PERSONA_ID = 135

ASSET_MANAGER_TEST_CASES = [
    {
        "query": "Provide a summary of all overdue work orders assigned to MedServ Global.",
        "persona_id": ASSET_MANAGER_PERSONA_ID,
        "expected_tools": [
            "Vendor Performance Scorecard",
            "List Work Orders",
            "Maintenance Compliance Report",
        ],
        "expect_form": False,
        "enabled": True,
    },
    {
        "query": "Run a daily operational report for the last 7 days including all anomalies.",
        "persona_id": ASSET_MANAGER_PERSONA_ID,
        "expected_tools": ["Daily Operations Report"],
        "expect_form": False,
        "enabled": True,
    },
    {
        "query": "Show me the current PM compliance report for BudgetFix Co.",
        "persona_id": ASSET_MANAGER_PERSONA_ID,
        "expected_tools": [
            "Vendor Performance Scorecard",
            "Maintenance Compliance Report"
        ],
        "expect_form": False,
        "enabled": True,
    },
    {
        "query": "Are there any open anomalies for high-criticality assets in the Hospital Main Tower (HMT-A01)?",
        "persona_id": ASSET_MANAGER_PERSONA_ID,
        "expected_tools": [
            "List Anomalies",
            "List Medical Assets"
        ],
        "expect_form": False,
        "enabled": True,
    },
    {
        "query": "Give me the latest telemetry readings for Infusion Pump INF-0115.",
        "persona_id": ASSET_MANAGER_PERSONA_ID,
        "expected_tools": [
            "List Medical Assets",
            "Get Asset Telemetry"
        ],
        "expect_form": False,
        "enabled": True,
    },
    {
    "query": "What's the compliance status for all LIFE_SAFETY criticality assets across the campus?",
    "persona_id": ASSET_MANAGER_PERSONA_ID,
    "expected_tools": [
        "Maintenance Compliance Report",
        "List Medical Assets"
    ],
    "expect_form": False,
    "enabled": True,
},
{
    "query": "Which buildings have the worst PM compliance right now?",
    "persona_id": ASSET_MANAGER_PERSONA_ID,
    "expected_tools": [
        "Maintenance Compliance Report",
        "List Buildings"
    ],
    "expect_form": False,
    "enabled": True,
},
{
    "query": "Show me all open work orders for Radiology Center (RAD-C02) assets, and tell me which vendors are responsible.",
    "persona_id": ASSET_MANAGER_PERSONA_ID,
    "expected_tools": [
        "List Work Orders",
        "List Medical Assets"
    ],
    "expect_form": False,
    "enabled": True,
},
{
    "query": "I need a complete picture of vendor performance — scorecards for all vendors, then drill into any with poor SLA compliance.",
    "persona_id": ASSET_MANAGER_PERSONA_ID,
    "expected_tools": [
        "Vendor Performance Scorecard"
    ],
    "expect_form": False,
    "enabled": True,
},
{
    "query": "Are there any unresolved anomalies in the ICU buildings (HMT-A) that I need to act on?",
    "persona_id": ASSET_MANAGER_PERSONA_ID,
    "expected_tools": [
        "List Anomalies",
        "List Buildings",
        "List Medical Assets"
    ],
    "expect_form": False,
    "enabled": True,
},
{
    "query": "Give me the daily report for the last 30 days — I want to see trends in vendor performance and anomaly patterns.",
    "persona_id": ASSET_MANAGER_PERSONA_ID,
    "expected_tools": [
        "Daily Operations Report"
    ],
    "expect_form": False,
    "enabled": True,
},
{
    "query": "What corrective work orders are currently open for high-criticality assets, and when are they due?",
    "persona_id": ASSET_MANAGER_PERSONA_ID,
    "expected_tools": [
        "List Work Orders",
        "List Medical Assets"
    ],
    "expect_form": False,
    "enabled": True,
},
{
    "query": "Show me the details for asset ID 1042 and any recent anomalies or work orders associated with it.",
    "persona_id": ASSET_MANAGER_PERSONA_ID,
    "expected_tools": [
        "Get Asset Details",
        "List Anomalies",
        "List Work Orders",
        "Get Asset Telemetry"
    ],
    "expect_form": False,
    "enabled": True,
},
{
    "query": "Which vendors have the most open anomalies right now? Break it down by building.",
    "persona_id": ASSET_MANAGER_PERSONA_ID,
    "expected_tools": [
        "Vendor Performance Scorecard",
        "List Anomalies",
        "List Buildings"
    ],
    "expect_form": False,
    "enabled": True,
},
{
    "query": "I want to see overdue preventive maintenance across all Laboratory buildings (LAB-F). What actions are needed to bring us back into compliance?",
    "persona_id": ASSET_MANAGER_PERSONA_ID,
    "expected_tools": [
        "Maintenance Compliance Report",
        "List Medical Assets",
        "List Buildings",
        "List Work Orders"
    ],
    "expect_form": False,
    "enabled": True,
},
{
    "query": "Create a high-priority corrective work order for the CT scanner in RAD-C01 — it's been showing anomalous readings.",
    "persona_id": ASSET_MANAGER_PERSONA_ID,
    "expected_tools": [
        "List Medical Assets",
        "Get Asset Telemetry",
        "Create Work Order"
    ],
    "expect_form": False,
    "enabled": True,
},
{
    "query": "Compare compliance between our top 3 vendors over the past quarter.",
    "persona_id": ASSET_MANAGER_PERSONA_ID,
    "expected_tools": [
        "Vendor Performance Scorecard",
        "Maintenance Compliance Report"
    ],
    "expect_form": False,
    "enabled": True,
},
{
    "query": "What's the current status of every asset in the Emergency Department building (EMR-G01)?",
    "persona_id": ASSET_MANAGER_PERSONA_ID,
    "expected_tools": [
        "List Medical Assets",
        "List Buildings"
    ],
    "expect_form": False,
    "enabled": True,
},
{
    "query": "Show me all resolved and open anomalies from the last week, and flag any that took too long to resolve.",
    "persona_id": ASSET_MANAGER_PERSONA_ID,
    "expected_tools": [
        "List Anomalies",
        "Daily Operations Report"
    ],
    "expect_form": False,
    "enabled": True,
},
{
    "query": "What assets are currently at risk? Show me anything with overdue PM, open anomalies, or failing telemetry in the Data Center buildings (DCT-D).",
    "persona_id": ASSET_MANAGER_PERSONA_ID,
    "expected_tools": [
        "List Medical Assets",
        "Maintenance Compliance Report",
        "List Anomalies",
        "List Buildings"
    ],
    "expect_form": False,
    "enabled": True,
},
]