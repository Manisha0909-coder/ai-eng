from playwright.sync_api import expect
from playwright_automation.auth.login import login_to_gotalk


ADMIN_ENDPOINTS = [
    "/api/mid/admin/users/non-admins?limit=50&offset=0",
    "/api/mid/admin/users/list?limit=50&offset=0",
]


# ================================
# US005 – Admin access control
# ================================


def _get_access_token(page, base_url):
    """
    Extract access_token from cookies using base_url (no hardcoding)
    """
    cookies = page.context.cookies(base_url)

    access_cookie = next((c for c in cookies if c["name"] == "access_token"), None)
    assert access_cookie is not None, "❌ access_token not found after login"

    return access_cookie["value"]


def test_admin_can_access(page, base_url):
    """
    Admin user → should get 200
    """

    # Extract token from already-authenticated session
    access_token = _get_access_token(page, base_url)

    # Call APIs
    for endpoint in ADMIN_ENDPOINTS:
        response = page.context.request.get(
            f"{base_url}{endpoint}",
            headers={
                "Cookie": f"access_token={access_token}"
            }
        )

        print(f"[ADMIN] {endpoint} → {response.status}")

        assert response.status == 200


def test_non_admin_blocked(unauthenticated_page, base_url, non_admin_email, non_admin_password):
    """
    Non-admin user → should get 403
    """
    page = unauthenticated_page

    # Login as non-admin
    login_to_gotalk(page, base_url, non_admin_email, non_admin_password)

    # Ensure login completed
    page.wait_for_load_state("networkidle")
    print("CURRENT URL:", page.url)

    # Extract token
    access_token = _get_access_token(page, base_url)

    # Call APIs
    for endpoint in ADMIN_ENDPOINTS:
        response = page.context.request.get(
            f"{base_url}{endpoint}",
            headers={
                "Cookie": f"access_token={access_token}"
            }
        )

        print(f"[NON-ADMIN] {endpoint} → {response.status}")

        assert response.status == 403