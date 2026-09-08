from playwright.sync_api import expect


# ================================
# Logout Test (with token validation)
# ================================


def _get_access_token(page, base_url):
    """
    Helper to extract access_token from cookies
    """
    cookies = page.context.cookies(base_url)
    return next((c for c in cookies if c["name"] == "access_token"), None)


def test_logout(page, base_url):
    """
    Validates:
    - User can logout
    - access_token is removed/invalidated
    - User is redirected to login screen
    """

    # page fixture already provides a logged-in session via auth_storage_state

    # Step 1: Ensure token exists BEFORE logout
    access_cookie = _get_access_token(page, base_url)
    assert access_cookie is not None, "❌ access_token missing after login"

    # Step 3: Click Logout
    page.get_by_role("button", name="Logout").click()

    page.wait_for_load_state("networkidle")

    # Step 4: Validate UI logout
    expect(page.get_by_role("button", name="Login")).to_be_visible()
    assert "login" in page.url.lower()

    # Step 5: Validate token AFTER logout
    access_cookie_after = _get_access_token(page, base_url)

    # 🔥 Two valid behaviors depending on backend:
    if access_cookie_after is None:
        print("✅ access_token removed after logout")
    else:
        print("⚠️ access_token still present — checking if invalidated")

        # If cookie still exists, verify it's NOT usable
        response = page.context.request.post(
            f"{base_url}/api/mid/chat/create",
            headers={
                "x-title": "Newton Chat",
                "Content-Type": "application/json",
                "Cookie": f"access_token={access_cookie_after['value']}",
            },
            data='{"query":"hi","persona_id":105,"language":"EN"}'
        )

        assert response.status in [401, 403], "❌ Token still valid after logout"