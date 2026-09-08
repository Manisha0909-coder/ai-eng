# DS-012 · Visual Regression Baseline

**Type:** Task  
**Wave:** 4  
**Effort:** S  
**Blocked by:** DS-007, DS-008 (need Wave 3 complete before taking baseline)

## Goal

After the Wave 3 visual passes are merged and the UI looks correct, capture a screenshot baseline so future changes to any of these components trigger a visual diff alert.

## Approach

Use **Chromatic** (preferred — integrates with Storybook) or **Percy** (CI-first, no Storybook required).

If neither Storybook nor Chromatic is set up yet, use **Playwright's `toHaveScreenshot()`** against the running dev server — lower setup cost, good enough for a first baseline.

## Components to Baseline

Priority order:

1. `AssistantMessage` — light + dark, with markdown / with code block / with tool result
2. `UserMessage` — light + dark, read mode + edit mode
3. `ToolCard` — light + dark, with reasoning block + without
4. `AdminOverviewSection` — light + dark (captures the 3 card tiers in one shot)
5. `Settings` panel — light + dark
6. `AppSidebar` — light + dark

## Acceptance Criteria

- [ ] Screenshot baseline committed in the repo (or Chromatic/Percy project linked in CI)
- [ ] CI pipeline fails if a visual diff exceeds threshold on any baselined component
- [ ] Baseline reviewed visually to confirm it reflects the intended post-Wave-3 design
- [ ] Process documented in `plan/design-spec.md` under a "Visual QA" section
