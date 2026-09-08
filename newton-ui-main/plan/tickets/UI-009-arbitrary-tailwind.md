# UI-009 — Global Sweep: Replace Arbitrary Tailwind Values

**Type:** Refactor  
**Priority:** P2  
**Epic:** [UI-000](./UI-000-epic.md)  
**Effort:** M (3–4 hours)  
**Risk:** Low — find-replace, visual-only  
**Depends on:** [UI-001](./UI-001-design-tokens.md)

## Background

Approximately 158 occurrences of arbitrary Tailwind bracket syntax exist in feature files. They fall into two categories:

1. **CSS variable references** — `bg-[var(--color-surface)]` — should become `bg-surface` once UI-001 lands
2. **Hardcoded dimensions** — `h-[28px]`, `text-[10px]` — should use the spacing/fontSize tokens from UI-001

This is largely a mechanical find-replace pass.

## Changes by Pattern

Run these as global find-replace operations across `src/` (excluding `src/components/ui/`):

### Color class replacements
| Find | Replace |
|------|---------|
| `bg-\[var(--color-surface)\]` | `bg-surface` |
| `bg-\[var(--color-background)\]` | `bg-background` |
| `text-\[var(--color-text)\]` | `text-text-main` |
| `text-\[var(--color-text-secondary)\]` | `text-text-muted` |
| `border-\[var(--color-border)\]` | `border-border-main` |
| `text-\[var(--color-primary)\]` | `text-brand` |
| `bg-\[var(--color-primary)\]` | `bg-brand` |
| `hover:text-\[var(--color-primary)\]` | `hover:text-brand` |
| `bg-\[var(--color-surface)\]/90` | `bg-surface/90` |

### Dimension replacements (using UI-001 spacing tokens)
| Find | Replace |
|------|---------|
| `h-\[28px\] w-\[28px\]` | `h-icon-md w-icon-md` |
| `w-\[20px\] h-\[20px\]` | `w-icon-sm h-icon-sm` |
| `h-\[42px\] w-\[42px\]` | `h-icon-lg w-icon-lg` |
| `text-\[10px\]` | `text-2xs` |
| `text-\[9px\]` | `text-3xs` |

### High-density files to prioritize
- `src/features/chat/components/ChatMessage/UserMessage.tsx` (20+ occurrences)
- `src/features/dashboard/components/Modals/CreateVersionModal.tsx`
- `src/features/dashboard/components/Modals/CreatePersonaModal.tsx`
- `src/features/chat/components/ChatMessage/HtmlCarousel.tsx`
- `src/features/chat/components/ShareChat/ShareChat.tsx`

## What NOT to change

- `max-w-[95vw]`, `w-[90%]`, `w-[min(80vw,400px)]` — viewport-relative values, no token equivalent
- Dynamic arbitrary values computed at runtime: `w-[${value}px]`
- Anything inside `src/components/ui/` — those are base primitives and managed separately

## Acceptance Criteria

- [ ] `grep -r "bg-\[var(--color-" src/features/` returns zero results
- [ ] `grep -r "text-\[var(--color-" src/features/` returns zero results
- [ ] `grep -r "border-\[var(--color-" src/features/` returns zero results
- [ ] `grep -rE "h-\[(2[0-9]|4[0-9])px\]|w-\[(2[0-9]|4[0-9])px\]" src/features/` returns zero results
- [ ] All affected components visually unchanged
- [ ] `npm run build` passes

## Verification

After replacement, run a theme switch across Newton → UAE → Gemini Light and confirm all colors update. No component should be stuck on a hardcoded color.
