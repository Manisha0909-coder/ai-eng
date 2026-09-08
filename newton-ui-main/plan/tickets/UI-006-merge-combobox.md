# UI-006 — Extend Combobox, Deprecate SearchableDropdown

**Type:** Refactor  
**Priority:** P1  
**Epic:** [UI-000](./UI-000-epic.md)  
**Effort:** XL (2–3 days — 14 consumers, not 1 as originally scoped)  
**Risk:** High — touches every admin section and many modal forms  
**Depends on:** nothing — can start immediately

## Background

`SearchableDropdown.tsx` has **14 import sites** across the codebase — the original plan significantly underestimated scope by listing only `UserForm.tsx`.

Full consumer list:
- `Forms/UserForm.tsx`
- `Forms/AdminUserForm.tsx`
- `Forms/RoleForm.tsx`
- `Forms/TagForm.tsx`
- `Forms/PersonaMemoryBlockForm.tsx`
- `Modals/CreateVersionModal.tsx`
- `Modals/GuideModal.tsx`
- `Modals/EditDocumentDialog.tsx`
- `Modals/CreatePersonaModal.tsx`
- `sections/ToolsSection.tsx`
- `sections/TagsSection.tsx`
- `sections/UsersSection.tsx`
- `sections/RolesSection.tsx`
- `components/DashboardTabFilterUi.tsx`

## API Mismatch to Resolve First

The current `Combobox` uses `options: string[]`. `SearchableDropdown` uses `items: Option[]` (objects with `label`/`value`). This data model difference must be resolved before migrating any consumer.

**Decision:** Extend `Combobox` to accept `Option[]` (objects) as the primary format. Keep backward-compatible `string[]` support via normalisation inside the component.

## New Combobox API

```tsx
interface Option {
  label: string
  value: string
}

interface ComboboxProps {
  options?: Option[] | string[]              // both formats accepted
  selectedValues: string[]
  onSelect: (value: string) => void
  onRemove: (value: string) => void

  // New props (from SearchableDropdown)
  mode?: 'single' | 'multi'                  // default: 'multi'
  onSearch?: (query: string) => Promise<Option[]>  // async loading
  debounceMs?: number                        // default: 300
  placement?: 'top' | 'bottom'              // default: 'bottom'
  loading?: boolean
  placeholder?: string
  disabled?: boolean
  inputId?: string
  defaultValue?: string
  inputClassName?: string
}
```

## Migration Strategy

Given the risk, migrate in two sub-steps:

**Step 1:** Extend `Combobox` and verify it works for the static-options consumers (Forms). Migrate `UserForm`, `AdminUserForm`, `RoleForm`, `TagForm`, `PersonaMemoryBlockForm` first.

**Step 2:** Migrate async-search consumers (Modals and Sections) once the API is proven stable.

**Step 3:** Delete `SearchableDropdown.tsx`.

## Acceptance Criteria

- [ ] `SearchableDropdown.tsx` is deleted
- [ ] `grep -r 'SearchableDropdown' src/` returns zero results
- [ ] All 14 consumers migrated to `Combobox`
- [ ] Static dropdown consumers (Forms) work correctly
- [ ] Async search consumers (Modals, Sections) search and load results correctly
- [ ] Single-select mode closes on selection and shows selected label in trigger
- [ ] Multi-select mode shows removable badges
- [ ] `npm run build` passes

## Verification

Open and exercise each of the 14 consumer UIs:
- Edit User form → role search works
- Create Persona modal → dropdowns populate
- Tags section → tag filter works
- Dashboard tab filter → filters apply correctly
