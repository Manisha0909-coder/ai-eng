# DS-004 · `<IconButton>` Primitive

**Type:** Task  
**Wave:** 2  
**Effort:** S  
**Blocked by:** DS-001  
**Blocks:** DS-007, DS-008, DS-009

## Problem

`Header.tsx` contains 7+ icon buttons each written as a raw `<button>` with:
- The same padding/shape class string duplicated per button
- `onMouseEnter`/`onMouseLeave` handlers applying hover via JS instead of Tailwind `hover:` classes
- `style={{ borderRadius: 9999, transitionDuration: "300ms" }}` inline styles duplicating what `rounded-full duration-300` already expresses

`DashboardTopChrome.tsx` has extracted this into a local `const iconBtn = "..."` string — a better approach but still not shareable.

## Solution

Create `src/components/ui/icon-button.tsx` — a small wrapper around shadcn `<Button>` (or a plain `<button>`) with variant/size/shape props.

```tsx
// Props — aria-label is required, not optional
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-label": string          // required: icon-only buttons must always be labeled
  size?: "sm" | "md" | "lg"    // maps to icon-sm / icon-md / icon-lg tokens
  variant?: "ghost" | "overlay" | "solid"
  shape?: "circle" | "square"  // default: "circle"
}
```

Size classes:
```ts
const sizeClasses = {
  sm: "w-icon-sm h-icon-sm",
  md: "w-icon-md h-icon-md",
  lg: "w-icon-lg h-icon-lg",
}
```

Variant classes:
```ts
const variantClasses = {
  ghost:   "hover:bg-surface",                         // standard: use on bg-surface / bg-background
  overlay: "hover:bg-surface/50",                      // use on colored or dark-overlay backgrounds
  solid:   "bg-primary text-white hover:bg-primary/90",// filled: prominent single-action only
}
```

Base classes: `inline-flex items-center justify-center shrink-0 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed`

Shape: `rounded-full` (circle) or `rounded-lg` (square).

No `onMouseEnter`/`onMouseLeave`. No inline `style` props.

## Migration Targets

### `src/layouts/Header.tsx`
7+ occurrences of:
```tsx
<button
  onMouseEnter={e => (e.currentTarget.style.backgroundColor = "...")}
  onMouseLeave={e => (e.currentTarget.style.backgroundColor = "")}
  style={{ borderRadius: 9999 }}
  className="p-2 flex items-center ..."
>
```
→ Replace each with:
```tsx
<IconButton size="md" variant="ghost" aria-label="...">
  <SomeIcon />
</IconButton>
```

### `src/features/dashboard/components/DashboardTopChrome.tsx`
Drop `const iconBtn = "..."` local string; replace all `className={iconBtn}` buttons with `<IconButton>`.

### `src/features/chat/components/ChatContainer/ChatContainer.tsx`
The scroll-to-bottom floating button → `<IconButton size="md" variant="ghost">` (keep its absolute positioning classes on a wrapper `<div>`).

### Variant usage guide (for PR reviewers)
- `ghost` is correct for ~90% of icon buttons: toolbar buttons, copy/share/action buttons in message rows, header buttons, sidebar controls.
- `overlay` is for buttons that sit inside a chat bubble, on a gradient panel, or anywhere the background is non-standard. The dictate button in `UserMessage.tsx` is a reference case.
- `solid` is rare — reserve for a clear primary CTA that has no text label.

## Acceptance Criteria

- [ ] `src/components/ui/icon-button.tsx` created
- [ ] `grep -rn 'onMouseEnter\|onMouseLeave' src/layouts/Header.tsx` returns zero results
- [ ] `grep -rn 'borderRadius.*9999\|borderRadius.*999' src/layouts/Header.tsx` returns zero results
- [ ] `DashboardTopChrome.tsx` no longer has a local `iconBtn` const
- [ ] `npm run build` passes
- [ ] All icon buttons still render correctly and hover state works
