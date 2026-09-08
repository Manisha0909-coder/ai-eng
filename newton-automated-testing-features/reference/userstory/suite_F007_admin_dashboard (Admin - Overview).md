## US: 001

As a Super Admin, I want to access application logs directly from the admin dashboard, so that I can monitor system activity and diagnose issues without needing direct server access.

**Acceptance Criteria:**
    - Logs are read-only and cannot be modified from the dashboard.
    - Admin navigates to the Overview page and sees the Logs Filters section.
    - Admin applies one or more filters (service, keyword, User ID, Session ID, log level) and clicks "Apply" to load filtered logs.
    - Admin clicks "Clear" to reset all filters.


## US: 002

As a Super Admin, I want to view metrics and traces from the admin dashboard, so that I can monitor system performance and trace requests across services.

**Acceptance Criteria:**
    - Admin dashboard includes a dedicated "Chat Metrics" section.
    - Key metrics are displayed (e.g. request rate, error rate, latency, success rate, input and output tokens).
    - Distributed traces are available and linked to specific requests or sessions.
    - Metrics refresh automatically at a configurable interval.
    - Admin can drill down into a specific trace to view span-level details.
    - Data is sourced from the configured observability backend (e.g. OpenTelemetry, Prometheus, Jaeger).


## US: 003

As a Super Admin, I want to view feedback metrics from the admin dashboard, so that I can track user satisfaction and identify areas of the application that need improvement.

**Acceptance Criteria:**
    - Admin dashboard includes a dedicated "Feedback Metrics" 
    - Admin can filter feedback data by time period: Last 7 days, Last 30 days, or Last 90 days.
    - Dashboard displays the Resolution Rate as a percentage along with the resolved/total count (e.g. 3/6 resolved).
    - Dashboard displays the count of Positive feedback (thumbs up).
    - Dashboard displays the count of Negative feedback (thumbs down).
    - Dashboard displays the count of Pending feedback items, highlighted distinctly (e.g. red badge).
    - Clicking on the Pending count navigates the admin to the Feedback page, pre-filtered to display only pending feedback items.
    - All metrics update dynamically when the time period filter is changed.
