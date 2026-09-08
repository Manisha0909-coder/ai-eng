import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))
from helpers import _cleanup_test_personas


@pytest.fixture(scope="session", autouse=True)
def cleanup_pw_personas(browser, base_url, auth_storage_state):
    """After all persona suite tests finish (pass or fail), delete every PW_* persona."""
    yield
    context = browser.new_context(
        base_url=base_url,
        ignore_https_errors=True,
        storage_state=auth_storage_state,
    )
    page = context.new_page()
    try:
        page.goto(base_url, timeout=60000)
        page.wait_for_load_state("networkidle", timeout=60000)
        _cleanup_test_personas(page)
    except Exception:
        pass
    finally:
        page.close()
        context.close()
