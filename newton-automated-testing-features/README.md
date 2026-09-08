# Newton Automated Testing

Automated test suite for [GoTalk](https://gotalk.dev), covering UI functional tests and API-level persona regression tests.

---

## Structure

```
.
├── playwright_automation/   # UI tests (pytest + Playwright)
├── regression/              # API persona regression tests (aiohttp + Selenium auth)
├── reference/userstory/     # Feature user stories (reference docs)
├── test-data/               # Shared test files (pdf, docx, csv, etc.)
└── .github/workflows/       # CI pipelines
```

---

## Playwright Tests

End-to-end UI tests for GoTalk features, organised by suite.

| Suite | Feature |
|-------|---------|
| F001 | Share Panel |
| F002 | Theme |
| F003 | Documents |
| F004 | Session Logout |
| F006 | Sidebar |
| F008 | Admin Role Access |
| F010 | Admin Role Management |
| F011 | Admin User Management |
| F012 | Admin Shared Memory |
| F013 | Admin Feedback Management |
| F015 | Security & Authentication |
| F016 | Performance & Reliability |
| F017 | Admin Data Sources |

### Setup

```bash
cd playwright_automation
pip install ".[dev]"
playwright install chromium --with-deps
```

### Environment variables

Create `playwright_automation/.env`:

```env
PLAYWRIGHT_BASE_URL=https://gotalk.dev
PLAYWRIGHT_BROWSER=chromium
HEADLESS=true
PLAYWRIGHT_SLOW_MO=0

SUPER_ADMIN_EMAIL=
SUPER_ADMIN_PASS=
USER_ADMIN_EMAIL=
USER_ADMIN_PASS=
SYS_ADMIN_EMAIL=
SYS_ADMIN_PASS=
NO_ROLE_EMAIL=
NO_ROLE_PASS=

# Data source (F017)
DS_PG_HOST=
DS_PG_PORT=
DS_PG_USER=
DS_PG_DB=
DS_PG_PASS=
```

### Run

```bash
# All tests
pytest tests/ -v --tb=short

# Headed (visible browser)
pytest tests/ --headed

# Single suite
pytest tests/suite_F015_security_and_authentication/ -v
```

---

## Regression Tests

API-level tests that authenticate via browser (Selenium), then send queries to GoTalk personas and validate tool calls, form responses, and keyword presence in replies.

### Personas

| Persona | Flag |
|---------|------|
| Graph | `graph` |
| Asset Manager | `asset_manager` |
| Tender | `tender` |
| HR | `hr` |
| Sales Dashboard | `sales_dashboard` |

### Setup

```bash
pip install aiohttp pandas openpyxl python-dotenv selenium webdriver-manager playwright google-genai
playwright install chromium --with-deps
```

### Environment variables

Create `.env` in the repo root:

```env
# Required — login credentials
ADMIN_EMAIL=
ADMIN_PASSWORD=

# Optional — enables AI-judged form field/value checks (skipped if unset)
GEMINI_API_KEY=

The regression module runs API-level test cases against each AI persona to verify tool execution, response content, and form triggering.

### Run all personas
```bash
pytest regression/test_regression.py -v
```

### Run a single persona
```bash
pytest regression/test_regression.py -v --persona graph
pytest regression/test_regression.py -v --persona hr
pytest regression/test_regression.py -v --persona tender
pytest regression/test_regression.py -v --persona asset_manager
pytest regression/test_regression.py -v --persona sales_dashboard
```

### Filter by query keyword
```bash
pytest regression/test_regression.py -v -k "teams"
pytest regression/test_regression.py -v -k "email"
```

### Stop on first failure
```bash
pytest regression/test_regression.py -v -x
```

### Rerun only last failed tests
```bash
pytest regression/test_regression.py -v --lf
```

### Include disabled test cases
```bash
pytest regression/test_regression.py -v --include-disabled
```

### Generate JUnit XML report (used by CI)
```bash
pytest regression/test_regression.py -v --junit-xml=regression/results_regression/regression.xml
```

### Available Personas

| Persona | Key |
|---|---|
| Graph / Microsoft 365 | `graph` |
| HR Assistant | `hr` |
| Tender | `tender` |
| Asset Manager | `asset_manager` |
| Sales Dashboard | `sales_dashboard` |

Secrets required in GitHub repository settings:

After each run:
- **Excel report** saved to `regression/results_regression/regression_<timestamp>.xlsx`
- **JUnit XML** saved to `regression/results_regression/regression.xml` (parsed by GitHub Actions)

---

## Bruno API Tests

Run a single request with auto-fetched access token:

```bash
python run_bruno.py "auth/Health Check.bru"
python run_bruno.py "chat/Create Chat.bru"
python run_bruno.py                          # run all
python run_bruno.py auth                     # run a folder
```

---

## Playwright UI Tests

### Run all suites
```bash
pytest playwright_automation/tests/ -v
```

### Run a single suite
```bash
pytest playwright_automation/tests/suite_F007_admin_dashboard -v
pytest playwright_automation/tests/suite_F009_persona_management -v
```

### Run headed (visible browser)
```bash
pytest playwright_automation/tests/suite_F009_persona_management -v --headed
```

### Run a specific test
```bash
pytest playwright_automation/tests/suite_F009_persona_management/test_us001_view_personas.py -v --headed -rA
```

### Filter by test name
```bash
pytest playwright_automation/tests/ -k "test_us003" -v --headed
