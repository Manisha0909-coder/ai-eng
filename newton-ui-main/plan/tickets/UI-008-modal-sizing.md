# UI-008 — Standardize Modal/Dialog Sizing

**Type:** Refactor  
**Priority:** P2  
**Epic:** [UI-000](./UI-000-epic.md)  
**Effort:** S (1–2 hours)  
**Risk:** Low  
**Depends on:** [UI-001](./UI-001-design-tokens.md)

## Background

Every modal in the codebase defines its own `max-w-[Xpx]` arbitrary value. There is no shared sizing system, so adding a new dialog means guessing a pixel width.

UI-001 adds three named `maxWidth` tokens to `tailwind.config.js`:
- `dialog-sm` = 360px
- `dialog-md` = 560px  
- `dialog-lg` = 860px

This ticket replaces all arbitrary modal max-widths with those tokens.

## Changes

| Component | File | Current | Replace with |
|-----------|------|---------|-------------|
| `CreateVersionModal` | `src/features/dashboard/components/Modals/CreateVersionModal.tsx` | `max-w-[360px] sm:max-w-2xl` | `max-w-dialog-sm sm:max-w-dialog-lg` |
| `CreatePersonaModal` | `src/features/dashboard/components/Modals/CreatePersonaModal.tsx` | `max-w-[95vw] sm:max-w-[860px]` | `max-w-[95vw] sm:max-w-dialog-lg` |
| `DeleteConfirmationModal` | `src/features/dashboard/components/DeleteConfirmationModal.tsx` | `max-w-[90vw] sm:max-w-md` | `max-w-[90vw] sm:max-w-dialog-md` |
| `ShareDialog` | `src/features/chat/components/ChatMessage/ShareDialog.tsx` | `max-w-md w-[90%]` | `max-w-dialog-md w-[90%]` |

> Note: `sm:max-w-2xl` is 672px — closest token is `dialog-lg` (860px). If the visual result is too wide, use `dialog-md` (560px) and align with the design. Confirm with design before merging.

## Acceptance Criteria

- [ ] No `max-w-\[\d+px\]` patterns remain in modal/dialog files
- [ ] All four modals open and are visually correct at mobile and desktop widths
- [ ] `npm run build` passes

## Verification

```bash
grep -r 'max-w-\[' src/features/ --include='*.tsx' | grep -i 'modal\|dialog'
# Should return zero results
```

Open each modal at 375px viewport (mobile) and 1440px (desktop) — verify width feels appropriate.
