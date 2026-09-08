import os
import sys
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent))
from auth.login import login_to_gotalk

# Load environment-specific config. PLAYWRIGHT_ENV selects which .env.<name>
# file to load (e.g. "sentinel" -> .env.sentinel). Defaults to the plain
# .env file (production) when unset.
_ENV_NAME = os.getenv("PLAYWRIGHT_ENV", "").strip()
_ENV_FILE = f".env.{_ENV_NAME}" if _ENV_NAME else ".env"
load_dotenv(dotenv_path=Path(__file__).resolve().parent / _ENV_FILE)


def pytest_addoption(parser):
    """Register custom command-line options."""
    # Check if option is already registered to avoid conflicts
    try:
        parser.addoption(
            "--headed",
            action="store_true",
            default=False,
            help="Run browser in headed mode (visible)",
        )
    except Exception:
        # Option already registered, skip
        pass


def _env_bool(name: str, default: str = "true") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


@pytest.fixture(scope="session")
def browser_name() -> str:
    return os.getenv("PLAYWRIGHT_BROWSER", "chromium")


@pytest.fixture(scope="session")
def headless(pytestconfig) -> bool:
    if pytestconfig.getoption("--headed"):
        return False
    return _env_bool("HEADLESS", "true")


@pytest.fixture(scope="session")
def base_url() -> str:
    return os.getenv("PLAYWRIGHT_BASE_URL", "https://gotalk.dev")


# ✅ NEW: user fixtures
# 


@pytest.fixture(scope="session")
def browser(browser_name, headless):
    with sync_playwright() as playwright:
        browser_type = getattr(playwright, browser_name)
        browser = browser_type.launch(
            headless=headless,
            slow_mo=int(os.getenv("PLAYWRIGHT_SLOW_MO", "0")),
            args=[
                "--disable-gpu",
                "--disable-dev-shm-usage",
                "--no-sandbox",
                "--disable-software-rasterizer",
            ],
        )
        yield browser
        browser.close()


@pytest.fixture(scope="session")
def auth_storage_state(browser, base_url, admin_email, admin_password):
    """Log in once for the whole session and capture browser storage state."""
    context = browser.new_context(base_url=base_url, ignore_https_errors=True)
    page = context.new_page()
    login_to_gotalk(page, base_url, admin_email, admin_password)
    try:
        page.wait_for_load_state("networkidle", timeout=10000)
    except Exception:
        pass
    state = context.storage_state()
    page.close()
    context.close()
    return state


@pytest.fixture
def page(browser, base_url, auth_storage_state):
    context = browser.new_context(
        base_url=base_url,
        ignore_https_errors=True,
        storage_state=auth_storage_state,
    )
    page = context.new_page()
    page.goto(base_url, timeout=60000)
    page.wait_for_load_state("networkidle", timeout=60000)
    yield page
    page.close()
    context.close()


@pytest.fixture
def unauthenticated_page(browser, base_url):
    context = browser.new_context(
        base_url=base_url,
        ignore_https_errors=True,
    )
    page = context.new_page()
    page.goto(base_url, timeout=60000)
    page.wait_for_load_state("networkidle", timeout=60000)
    yield page
    page.close()
    context.close()
    

@pytest.fixture(scope="session")
def non_admin_email():
    value = os.getenv("NON_ADMIN_EMAIL")
    assert value, "NON_ADMIN_EMAIL not set"
    return value


@pytest.fixture(scope="session")
def non_admin_password():
    value = os.getenv("NON_ADMIN_PASSWORD")
    assert value, "NON_ADMIN_PASSWORD not set"
    return value


@pytest.fixture(scope="session")
def admin_email():
    value = os.getenv("ADMIN_EMAIL")
    assert value, "ADMIN_EMAIL not set"
    return value


@pytest.fixture(scope="session")
def admin_password():
    value = os.getenv("ADMIN_PASSWORD")
    assert value, "ADMIN_PASSWORD not set"
    return value


@pytest.fixture(scope="session")
def playwright_email():
    value = os.getenv("PLAYWRIGHT_EMAIL")
    assert value, "PLAYWRIGHT_EMAIL not set in .env"
    return value


@pytest.fixture(scope="session")
def playwright_password():
    value = os.getenv("PLAYWRIGHT_PASSWORD")
    assert value, "PLAYWRIGHT_PASSWORD not set in .env"
    return value
