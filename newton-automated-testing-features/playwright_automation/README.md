# Playwright Tests

Python Playwright test scaffold for `gotalk.dev`.

## Requirements

- Python 3.11+
- `uv`
- A Chromium-based browser if you want to run headed locally

## Install

From the `playwright/` folder:

```bash
uv sync
uv run playwright install chromium
```

## Environment

Create or update `playwright/.env` with the values you want to use:

```env
PLAYWRIGHT_BASE_URL=https://gotalk.dev
PLAYWRIGHT_BROWSER=chromium
HEADLESS=false
PLAYWRIGHT_EMAIL=test@noah.com
PLAYWRIGHT_PASSWORD=test_password
```

`HEADLESS=false` shows the browser window.

## Run tests

Run all Playwright tests:

```bash
uv run pytest
```

Run one test file:

```bash
uv run pytest tests/smoke/test_dummy.py
```

Run a specific test:

```bash
uv run pytest tests/suite_F015_security_and_authentication/test_feature.py -k test_name
```

## Notes

- Test files must use pytest naming so they are discovered automatically:
  - `test_*.py`
  - `*_test.py`
- Shared login is not automatic. If a test needs login, call:

```python
from auth.login import login_to_gotalk

login_to_gotalk(page, base_url, email, password)
```

- The browser is launched from `conftest.py`, and each test gets a fresh `page`.

