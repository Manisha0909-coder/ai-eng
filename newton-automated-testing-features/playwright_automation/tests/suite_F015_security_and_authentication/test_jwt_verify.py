from playwright.sync_api import expect
import json


ENDPOINT = "/api/mid/chat/create"


def _get_access_token(page, base_url):
    """
    Extract access_token from cookies scoped to application domain.
    """
    cookies = page.context.cookies(base_url)

    access_cookie = next((c for c in cookies if c["name"] == "access_token"), None)
    assert access_cookie is not None, "❌ JWT token not found after login"

    return access_cookie["value"]


def _get_domain_from_base_url(base_url):
    """
    Extract domain dynamically from base_url
    
    """
    return base_url.replace("https://", "").replace("http://", "")


# --------------------------------------------------
# Test 1: Valid JWT → should succeed
# --------------------------------------------------
def test_jwt_validation_with_playwright(page, base_url):
    """
    Validates:
    - API accepts valid JWT
    - Returns 200 OK
    """

    token = _get_access_token(page, base_url)

    response = page.context.request.post(
        f"{base_url}{ENDPOINT}",
        headers={
            "x-title": "Newton Chat",
            "Content-Type": "application/json",
            "Cookie": f"access_token={token}",
        },
        data=json.dumps({
            "timezone": "Asia/Kolkata",
            "session_id": None,
            "query": "hi",
            "persona_id": 105,
            "language": "EN"
        })
    )

    assert response.status == 200


# --------------------------------------------------
# Test 2: Invalid JWT → should be rejected
# --------------------------------------------------
def test_invalid_jwt_playwright(page, base_url):
    """
    Validates:
    - Invalid token is rejected
    - Returns 401 Unauthorized
    """

    context = page.context

    # Dynamically derive domain (no hardcoding)
    domain = _get_domain_from_base_url(base_url)

    # Override cookie with invalid token
    context.add_cookies([{
        "name": "access_token",
        "value": "invalid_token",
        "domain": domain,
        "path": "/"
    }])

    response = context.request.post(
        f"{base_url}{ENDPOINT}",
        headers={
            "x-title": "Newton Chat",
            "Content-Type": "application/json",
            "Cookie": "access_token=invalid_token"
        },
        data=json.dumps({
            "timezone": "Asia/Kolkata",
            "session_id": None,
            "query": "hi",
            "persona_id": 105,
            "language": "EN"
        })
    )

    print("Status:", response.status)
    print("Response:", response.text())

    assert response.status == 401