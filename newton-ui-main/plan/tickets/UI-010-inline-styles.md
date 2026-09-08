# UI-010 — Inline Style Cleanup (Targeted Static Styles)

**Type:** Refactor  
**Priority:** P3  
**Epic:** [UI-000](./UI-000-epic.md)  
**Effort:** M (3–4 hours)  
**Risk:** Low — visual-only  
**Depends on:** [UI-001](./UI-001-design-tokens.md), [UI-002](./UI-002-hardcoded-colors-payment.md)

## Background

56 files contain `style={{}}` inline styles. Most are dynamic (theme asset dimensions, RTL direction) and must stay. This ticket targets only the **static** inline styles — ones that can be moved to Tailwind classes without losing functionality.

Dynamic styles that should **not** be changed:
- `style={{ height: \`${theme.assets.botLogoHeight}px\` }}` — runtime value
- `style={{ direction: isArabicMode ? "rtl" : "ltr" }}` — runtime conditional
- `style={{ width: \`calc(var(--chat-sidebar-width) + ...)\` }}` — complex CSS expression

## Static Styles to Migrate

### `src/layouts/Header.tsx` — Persona avatar button
```tsx
// Before
style={{
  display: "inline-flex", alignItems: "center",
  gap: 4, padding: 4, borderRadius: 999,
  border: "1px solid var(--color-border)",
  background: "var(--color-background)",
  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
}}

// After (Tailwind className)
className="inline-flex items-center gap-1 p-1 rounded-full border border-border-main bg-background shadow-sm"
```

### `src/features/visualization/components/VisualizationSidebar/index.tsx` — Floating action button
```tsx
// Before
style={{ position: "fixed", bottom: 100, right: "calc(...)", width: 42, height: 42, borderRadius: 9999 }}

// After
className="fixed bottom-24 right-[calc(...)] w-icon-lg h-icon-lg rounded-full"
// Note: keep the calc() expression as-is in the right value — it uses CSS vars
```

### `src/features/chat/components/ChatMessage/AssistantMessage.tsx` — Bounce dots
```tsx
// Before
style={{ backgroundColor: "var(--color-primary)", animation: "bounce 1.4s ease-in-out infinite", animationDelay: "200ms" }}

// After
className="bg-brand animate-bounce [animation-delay:200ms]"
```

### `src/features/documents/components/UploadDocument.tsx` — Tooltip shadow
```tsx
// Before
style={{ boxShadow: '0 20px 40px -12px rgba(0,0,0,0.25), ...(complex inset shadows)' }}

// After
// Add to theme.css:  --shadow-tooltip: 0 20px 40px -12px rgba(0,0,0,0.25)...
// Then use:  className="shadow-[var(--shadow-tooltip)]"
// Or simply:  className="shadow-2xl"  if the visual is close enough
```

### `src/features/visualization/components/VisualizationSidebar/index.tsx` — Flex container
```tsx
// Before
style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden" }}

// After
className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden"
```

## Acceptance Criteria

- [ ] Named static inline styles above are replaced with Tailwind classes
- [ ] No functional or visual regressions
- [ ] Dynamic inline styles (runtime values) are untouched
- [ ] `npm run build` passes

## Verification

```bash
# Count of style={{ in feature files before and after — should decrease
grep -r 'style={{' src/features/ src/layouts/ | wc -l
```

Visually inspect Header persona button, visualization FAB, and loading dots across two themes.
