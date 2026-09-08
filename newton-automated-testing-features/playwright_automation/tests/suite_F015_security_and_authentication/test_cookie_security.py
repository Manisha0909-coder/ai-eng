from playwright.sync_api import expect


# ================================
# US004 – HTTP-only secure cookies
# ================================


def _get_all_cookies(page, base_url):
    return page.context.cookies(base_url)


# --------------------------------------------------
# Test 1: Validate cookie security flags
# --------------------------------------------------
def test_cookie_security_flags(page, base_url):
    """
    Validates:
    - access_token exists
    - Cookies are HttpOnly
    - Cookies are Secure
    """

    cookies = _get_all_cookies(page, base_url)

    access_cookies = [c for c in cookies if c["name"] == "access_token"]
    refresh_cookies = [c for c in cookies if c["name"] == "refresh_token"]

    assert access_cookies, "❌ access_token cookie not found"

    if not refresh_cookies:
        print("⚠️ refresh_token not found — skipping strict validation")

    for cookie in access_cookies:
        assert cookie["httpOnly"] is True, "❌ access_token not HttpOnly"
        assert cookie["secure"] is True, "❌ access_token not Secure"

    for cookie in refresh_cookies:
        assert cookie["httpOnly"] is True, "❌ refresh_token not HttpOnly"
        assert cookie["secure"] is True, "❌ refresh_token not Secure"


# --------------------------------------------------
# Test 2: Ensure cookies are NOT accessible via JS
# --------------------------------------------------
def test_cookie_not_accessible_via_js(page, base_url):
    """
    Validates cookies are not exposed via document.cookie
    """

    cookies_js = page.evaluate("document.cookie")

    assert "access_token" not in cookies_js, "❌ access_token exposed to JS"
    assert "refresh_token" not in cookies_js, "❌ refresh_token exposed to JS"
    assert "sessions" not in cookies_js, "❌ session cookie exposed to JS"


# --------------------------------------------------
# Test 3: Validate cookie domain scope
# --------------------------------------------------
def test_cookie_domain_scope(page, base_url):
    """
    Validates cookies are scoped to expected domain (no hardcoding)
    """

    cookies = _get_all_cookies(page, base_url)

    # Extract domain from base_url dynamically
    expected_domain = base_url.replace("https://", "").replace("http://", "")

    for cookie in cookies:
        if cookie["name"] in ["access_token", "refresh_token"]:
            assert expected_domain in cookie["domain"], \
                f"❌ Unexpected domain for {cookie['name']}: {cookie['domain']}"