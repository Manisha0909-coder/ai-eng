from regression.test_cases_graph import GRAPH_TEST_CASES, GRAPH_PERSONA_ID
from regression.test_cases_asset_manager import ASSET_MANAGER_TEST_CASES, ASSET_MANAGER_PERSONA_ID
from regression.test_cases_tender import TENDER_TEST_CASES, TENDER_PERSONA_ID
from regression.test_cases_hr import HR_TEST_CASES, HR_PERSONA_ID
from regression.test_cases_sales_dashboard import SALES_DASHBOARD_TEST_CASES, SALES_DASHBOARD_PERSONA_ID
from regression.test_cases_qatar_tourism import QATAR_TOURISM_TEST_CASES, QATAR_TOURISM_PERSONA_ID

PERSONA_IDS = {
    "graph": GRAPH_PERSONA_ID,
    "asset_manager": ASSET_MANAGER_PERSONA_ID,
    "tender": TENDER_PERSONA_ID,
    "hr": HR_PERSONA_ID,
    "sales_dashboard": SALES_DASHBOARD_PERSONA_ID,
    "qatar_tourism": QATAR_TOURISM_PERSONA_ID,
}

PERSONA_TEST_CASES = {
    "graph": GRAPH_TEST_CASES,
    "asset_manager": ASSET_MANAGER_TEST_CASES,
    "tender": TENDER_TEST_CASES,
    "hr": HR_TEST_CASES,
    "sales_dashboard": SALES_DASHBOARD_TEST_CASES,
    "qatar_tourism": QATAR_TOURISM_TEST_CASES,
}

def get_test_cases(persona=None, enabled_only=True):
    """
    Returns test cases based on the provided persona name.
    If no persona is specified, returns all test cases.
    """
    cases_to_filter = []
    if persona:
        cases_to_filter = PERSONA_TEST_CASES.get(persona.lower(), [])
    else:
        # Combine all test cases if no persona is filtered
        for cases in PERSONA_TEST_CASES.values():
            cases_to_filter.extend(cases)
    
    if enabled_only:
        return [c for c in cases_to_filter if c.get("enabled", True)]
    
    return cases_to_filter

# Default list for backward compatibility if needed
TEST_CASES = get_test_cases()