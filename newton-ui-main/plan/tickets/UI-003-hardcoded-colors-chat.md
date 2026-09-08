# UI-003 — Purge Hardcoded Colors: Chat Components

**Type:** Refactor  
**Priority:** P1  
**Epic:** [UI-000](./UI-000-epic.md)  
**Effort:** L (4–6 hours — more files than originally scoped)  
**Risk:** Low  
**Depends on:** [UI-001](./UI-001-design-tokens.md)

## Files and Instances

### `src/features/chat/components/ChatMessage/ReasoningBlock.tsx`
- `#B68A35` — 4 occurrences (lines 77 ×2, 91, 100): `bg-[#B68A35]/10`, `border-[#B68A35]/20`
- Replace with `bg-[rgb(var(--color-gold))]/10`, `border-[rgb(var(--color-gold))]/20` or add `gold` token to tailwind config

### `src/features/chat/components/ChatMessage/AssistantMessage.tsx`
- `#B68A35`, `#D4A843` — UAE gold conditionals → delete conditional, use `text-primary` (UAE theme sets primary to gold in CSS)
- `#436bff` (lines 491, 492, 498) → `text-primary` / `bg-primary`
- `#2a2d35` (lines 491, 492) → `bg-surface`
- `rgba(255, 182, 171, 0.4)` (line 722) — highlighted message background → add `--color-highlight` CSS var or use `bg-red-200/40`

### `src/features/chat/components/ChatMessage/UserMessage.tsx`
- `#B68A35`, `#D4A843` (line 1078) — same UAE gold pattern → `text-primary`
- `rgba(255, 182, 171, 0.4)` (line 705) — same highlight → `bg-red-200/40`
- `#9CA3AF` (line 1050) → `text-text-muted`

### `src/features/chat/components/ChatMessage/NewtonProcessBlock.tsx`
- `#B68A35`, `rgba(182, 138, 53, 0.05)` — UAE gold → `text-primary`, `bg-primary/5`

### `src/features/chat/components/ChatInput/layouts/RallyLayout.tsx`
- `rgba(96, 165, 250, 0.1)` (line 83) → `bg-primary/10`
- `#60a5fa` (line 80) → `text-primary`

### `src/features/chat/components/ChatMessage/MarkdownRenderer.tsx`
- `var(--color-text, #ffffff)` fallback pattern — 6 occurrences (lines 104, 122, 136, 149, 161, 174)
- Remove hex fallbacks → `var(--color-text)` (always set by theme CSS)

### `src/layouts/Sidebar/AppSidebar.tsx`
- `#B68A35` (lines 1250, 1299, 1317) → `text-primary`

### `src/features/visualization/components/WebAnalysis/WebAnalysis.tsx`
- Audit all `rgba()` inline styles → replace with CSS variable equivalents

## Common Pattern

For every occurrence:
- UAE gold (`#B68A35`, `#D4A843`) → `text-primary` / `bg-primary` (UAE theme sets `--color-primary` to gold in CSS — the component should never check the theme name)
- Text grays (`#9CA3AF`) → `text-text-muted`
- Surface grays (`#2a2d35`) → `bg-surface`
- `rgba(X, Y, Z, 0.N)` with a brand color → `bg-primary/[N*100]` using Tailwind opacity modifier

## Acceptance Criteria

- [ ] `grep -rn '#[0-9a-fA-F]\{6\}' src/features/chat/ src/layouts/Sidebar/AppSidebar.tsx` returns zero results
- [ ] No component contains `currentTheme.name === "UAE"` or any theme-name conditional for color
- [ ] ReasoningBlock renders gold accents in UAE theme, blue in Newton — via CSS, not JS
- [ ] AssistantMessage highlighted messages still show the pink tint
- [ ] `npm run build` passes
