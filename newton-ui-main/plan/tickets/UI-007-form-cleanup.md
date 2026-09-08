# UI-007 — Form System Cleanup

**Type:** Chore  
**Priority:** P2  
**Epic:** [UI-000](./UI-000-epic.md)  
**Effort:** M (3–4 hours)  
**Risk:** Low  
**Depends on:** nothing — can start immediately

## Background

Three "form" directories exist with no clear canonical answer:

| Location | Purpose | Status |
|----------|---------|--------|
| `src/features/dashboard/components/Forms/` | Static admin CRUD dialogs (7 files) | Active — already using ui/ primitives |
| `src/features/chat/components/DynamicForm/` | Schema-driven runtime form for chat flows | Active, keep |
| `src/components/DynamicForms/` | Empty directory | Delete |

**Good news:** All 7 files in `Forms/` already use `Input`, `Label`, `Select` from `src/components/ui/` — no raw HTML input migration needed there.

**Expanded scope:** Raw `<input>` and `<textarea>` elements exist in dashboard **sections and modals outside** the `Forms/` directory. These need migrating too.

## Step 1 — Delete Empty Directory

```bash
rm -rf src/components/DynamicForms/
```

## Step 2 — Migrate Raw Inputs in Dashboard Sections and Modals

Files with raw `<input>` or `<textarea>` elements:

| File | Elements |
|------|----------|
| `sections/UsersSection.tsx` (lines 527, 1003) | `<input>` |
| `sections/RolesSection.tsx` (line 660) | `<input>` |
| `sections/FeedbackSection.tsx` (lines 1018, 1457) | `<input>` / `<textarea>` |
| `sections/DocumentsSection.tsx` (lines 1203, 1462, 1956) | `<input>` |
| `sections/DataSourcesSection.tsx` (line 236) | `<input>` |
| `Modals/CreateVersionModal.tsx` (line 592) | `<input>` |
| `Modals/ToolRulesDialog.tsx` (line 756) | `<input>` |

Replace each with the matching `src/components/ui/` primitive:
- `<input>` → `<Input>`
- `<textarea>` → `<Textarea>`

## Step 3 — Add Direction Comments

In `src/features/chat/components/DynamicForm/index.ts` (top comment, one line):
```ts
// Schema-driven form for API/chat flows — for static admin forms see features/dashboard/components/Forms/
```

## Acceptance Criteria

- [ ] `src/components/DynamicForms/` directory is gone
- [ ] `grep -rn '<input\|<textarea\|<select' src/features/dashboard/` returns zero unintentional raw elements
- [ ] All 7 affected section/modal files render correctly
- [ ] `npm run build` passes
