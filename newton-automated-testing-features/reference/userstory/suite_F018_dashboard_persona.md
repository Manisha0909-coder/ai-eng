## US: 001

As a Dashboard Persona User, I want to ask natural language questions about my data so that I can quickly get accurate insights without writing SQL queries.

**Acceptance Criteria:**

- System must interpret user intent and determine if the request is a data query or visualization.
- System must retrieve available data sources along with schema before querying.
- System must generate and execute a valid **SELECT-only** query based on the user’s question.
- Results must be returned in clear, human-readable format (plain text, bullet points, or tables).
- System must not create a dashboard when the user only requests factual data.

---

## US: 002

As a Dashboard Persona User, I want to request charts and visualizations so that I can better understand trends and patterns in my data.

**Acceptance Criteria:**

- System must detect visualization intent (e.g., “chart”, “graph”, “dashboard”).
- System must create a dashboard with an appropriate name.
- System must validate and inspect the data before building visualizations.
- Each visualization must be added as a separate graph with correct configuration.
- Dashboard must be rendered automatically after creation.
- Visualizations must accurately reflect the queried data and selected metrics.

---

## US: 003

As a Dashboard Persona User, I want to receive both numerical answers and visual representations when requested so that I can get quick insights along with deeper analysis.

**Acceptance Criteria:**

- System must identify combined intent (data + visualization).
- System must first compute and present the direct answer.
- System must then create a corresponding chart or dashboard.
- Both outputs must be consistent (same filters, timeframes, and aggregations).
- Dashboard must render successfully after answering the query.

---

## US: 004

As a Dashboard Persona User, I want the system to use only available and verified data sources so that the insights I receive are accurate and reliable.

**Acceptance Criteria:**

- System must call data source discovery before querying.
- System must only use columns present in the schema.
- System must validate queries before execution.
- System must handle missing or invalid data sources gracefully with clear error messaging.
- System must not assume or fabricate data.

---

## US: 005

As a Dashboard Persona User, I want dashboards to be organized and reusable so that I can build upon existing analyses without duplication.

**Acceptance Criteria:**

- System must check for existing dashboards before creating a new one.
- System must reuse existing dashboards when relevant.
- System must allow adding new graphs to an existing dashboard.
- Dashboard layouts must follow predefined layout presets when applicable.
- Each dashboard must have a clear and descriptive name.

---

## US: 006

As a Dashboard Persona User, I want the system to validate and optimize queries so that performance remains efficient even with large datasets.

**Acceptance Criteria:**

- Queries must be limited to **SELECT operations only**.
- Query results must not exceed **1000 rows**.
- System should prioritize aggregation and filtering at the query level.
- System must avoid unnecessary data loading or transformations.
- Errors in queries must be identified and corrected before execution.

---
