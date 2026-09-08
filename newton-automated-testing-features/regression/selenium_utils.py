import time
from selenium.webdriver.common.by import By
from regression.config import *

def _click_with_retries(driver, locators, timeout_seconds=30, label="target"):
    """Retry click for dynamic pages where elements render slowly."""
    for second in range(timeout_seconds):
        for locator in locators:
            try:
                elements = driver.find_elements(By.XPATH, locator)
            except Exception:
                elements = []

            for element in elements:
                try:
                    if not element.is_displayed():
                        continue
                    element.click()
                    print(f"✅ Clicked {label} using locator: {locator}")
                    return True
                except Exception:
                    try:
                        driver.execute_script("arguments[0].click();", element)
                        print(f"✅ JS-clicked {label} using locator: {locator}")
                        return True
                    except Exception:
                        continue

        # Extra fallback for Noah page variants.
        if label.lower() == "noah":
            try:
                clicked = driver.execute_script(
                    """
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const target = buttons.find(b =>
                      ((b.innerText || b.textContent || '').toLowerCase().includes('noah'))
                    );
                    if (target) { target.click(); return true; }
                    return false;
                    """
                )
                if clicked:
                    print("✅ JS-clicked noah using text fallback")
                    return True
            except Exception:
                pass

        if second % 10 == 0 and second > 0:
            print(f"⏳ Waiting for {label} to become clickable... {second}s")
        time.sleep(1)
    return False

def _is_credentials_form_ready(driver):
    """True only when actual credential form is visible."""
    if _element_exists(driver, CONTINUE_BTN_XPATH):
        return False
    if _element_exists(driver, NOAH_SIGNIN_XPATH) or _element_exists(driver, NOAH_SIGNIN_ALT_XPATH):
        return False
    return _element_exists(driver, EMAIL_INPUT_XPATH) and _element_exists(driver, PASSWORD_INPUT_XPATH)




def _element_exists(driver, xpath):
    try:
        return len(driver.find_elements(By.XPATH, xpath)) > 0
    except Exception:
        return False




def _wait_for_noah_stage(driver, timeout_seconds=60):
    """
    Wait for Noah stage after initial login.
    Handles intermediate "Continue" pages but does NOT click Noah here.
    """
    for second in range(timeout_seconds):
        if _element_exists(driver, NOAH_SIGNIN_XPATH) or _element_exists(driver, NOAH_SIGNIN_ALT_XPATH):
            return True

        if _element_exists(driver, CONTINUE_BTN_XPATH):
            _click_with_retries(driver, [CONTINUE_BTN_XPATH], timeout_seconds=2, label="continue")

        if second % 10 == 0 and second > 0:
            print(f"⏳ Waiting for Noah stage... {second}s")
        time.sleep(1)
    return False

def _wait_for_access_cookie_or_home(driver, timeout_seconds=60):
    """Wait until access cookie exists or app home is visible."""
    for _ in range(timeout_seconds):
        cookies = driver.get_cookies()
        cookie_names = [cookie.get("name") for cookie in cookies]
        if "access_token" in cookie_names:
            return True

        if _element_exists(driver, WELCOME_XPATH) or _element_exists(driver, WELCOME_ALT_XPATH):
            return True

        # Noah Auth sometimes lands on a simple Sign In button page.
        if _element_exists(driver, LOGIN_BTN_XPATH):
            try:
                driver.find_element(By.XPATH, LOGIN_BTN_XPATH).click()
            except Exception:
                pass

        time.sleep(1)
    return False





def _wait_for_noah_or_username(driver, timeout_seconds=50):
    """
    Wait for provider stage or direct credential stage.
    Returns "noah", "username", or None.
    """
    for _ in range(timeout_seconds):
        if _element_exists(driver, NOAH_SIGNIN_XPATH) or _element_exists(driver, NOAH_SIGNIN_ALT_XPATH):
            return "noah"
        if _element_exists(driver, EMAIL_INPUT_XPATH):
            return "username"
        time.sleep(1)
    return None



def _advance_intermediate_login_screens(driver, timeout_seconds=45):
    """
    Handle OIDC intermediate steps such as 'Continue' / repeated 'Noah' pages.
    Returns:
      - "credentials" when the real credential form is visible
      - "authenticated" when already on home / access cookie exists
      - None on timeout
    """
    for second in range(timeout_seconds):
        cookie_names = [cookie.get("name") for cookie in driver.get_cookies()]
        if "access_token" in cookie_names:
            return "authenticated"

        if _element_exists(driver, WELCOME_XPATH) or _element_exists(driver, WELCOME_ALT_XPATH):
            return "authenticated"

        if _is_credentials_form_ready(driver):
            return "credentials"

        if _element_exists(driver, CONTINUE_BTN_XPATH):
            _click_with_retries(driver, [CONTINUE_BTN_XPATH], timeout_seconds=2, label="continue")

        if _element_exists(driver, NOAH_SIGNIN_XPATH) or _element_exists(driver, NOAH_SIGNIN_ALT_XPATH):
            _click_with_retries(
                driver,
                [NOAH_SIGNIN_XPATH, NOAH_SIGNIN_ALT_XPATH],
                timeout_seconds=2,
                label="noah",
            )

        if second % 10 == 0 and second > 0:
            print(f"⏳ Waiting for credential form after redirects... {second}s")
        time.sleep(1)

    if _is_credentials_form_ready(driver):
        return "credentials"

    cookie_names = [cookie.get("name") for cookie in driver.get_cookies()]
    if "access_token" in cookie_names or _element_exists(driver, WELCOME_XPATH) or _element_exists(driver, WELCOME_ALT_XPATH):
        return "authenticated"
    return None



def _debug_login_page(driver):
    """Print concise debug hints for login flow failures."""
    try:
        print(f"🧭 Current URL: {driver.current_url}")
        print(f"🧾 Page title: {driver.title}")
        button_texts = driver.execute_script(
            """
            return Array.from(document.querySelectorAll('button'))
              .map(b => (b.innerText || b.textContent || '').trim())
              .filter(Boolean)
              .slice(0, 12);
            """
        )
        print(f"🔘 Visible button texts: {button_texts}")
    except Exception:
        pass
