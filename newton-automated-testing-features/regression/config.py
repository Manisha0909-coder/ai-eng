import os
from dotenv import load_dotenv

load_dotenv()

BASE_URL = "https://gotalk.dev/api/mid/chat/create"
SITE_URL = "https://gotalk.dev"

ACCESS_TOKEN = os.getenv("GOTALK_ACCESS_TOKEN", "")
SESSION_COOKIE_HEADER = os.getenv("GOTALK_COOKIE_HEADER", "")
LOGIN_EMAIL = os.getenv("ADMIN_EMAIL", "")
LOGIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest")

HEADLESS_LOGIN = os.getenv("GOTALK_HEADLESS", "false").lower() in ("1", "true", "yes", "y")
KEEP_BROWSER_OPEN_ON_FAILURE = os.getenv("GOTALK_KEEP_BROWSER_ON_FAILURE", "true").lower() in ("1", "true", "yes", "y")

TENDER_PERSONA_ID = 131
HR_PERSONA_ID = 105


# UI auth locators
INITIAL_LOGIN_BTN_XPATH = "(//button[@type='button'])[1]"

NOAH_SIGNIN_XPATH = "//button[@type='submit' and .//span[normalize-space()='Noah']]"
NOAH_SIGNIN_ALT_XPATH = "//button[contains(.,'Noah')]"

EMAIL_INPUT_XPATH = "(//label[contains(.,'Username')]/following::input[1] | //*[contains(text(),'Username')]/following::input[1])"

PASSWORD_INPUT_XPATH = "(//label[contains(.,'Password')]/following::input[1] | //*[contains(text(),'Password')]/following::input[1] | //input[@type='password'])"

LOGIN_BTN_XPATH = "//button[contains(.,'Log In') or contains(.,'Sign In')]"

CONTINUE_BTN_XPATH = "//button[contains(.,'Continue')]"

WELCOME_XPATH = "//h1[contains(text(),'Hi John')]"
WELCOME_ALT_XPATH = "//button[@id='welcome-persona-select']"