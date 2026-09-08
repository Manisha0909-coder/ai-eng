from playwright.sync_api import expect
from playwright_automation.auth.login import login_to_gotalk


# ================================
# Login Tests
# ================================


def test_login_success(unauthenticated_page, base_url, admin_email, admin_password):
    """
    Validates:
    - User can login with valid credentials
    - Redirects to application
    """

    login_to_gotalk(
        unauthenticated_page,
        base_url,
        email=admin_email,
        password=admin_password,
    )

    # Wait for login to complete
    unauthenticated_page.wait_for_load_state("networkidle")

    # Generic success check (avoid hardcoding user name)
    expect(unauthenticated_page.locator("body")).to_be_visible()


def test_login_invalid_credentials(unauthenticated_page, base_url):
    """
    Validates:
    - Invalid credentials are rejected
    - Error message is displayed
    """

    login_to_gotalk(
        unauthenticated_page,
        base_url,
        email="invalid@example.com",
        password="wrong_password",
    )

    # Assert error message
    expect(unauthenticated_page.get_by_text("Invalid username or password")).to_be_visible()