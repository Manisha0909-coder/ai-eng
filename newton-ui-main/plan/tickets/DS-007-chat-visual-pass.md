# DS-007 · Chat Area Visual Pass

**Type:** Task  
**Wave:** 3 (parallel with DS-008/009/010)  
**Effort:** L  
**Blocked by:** DS-003, DS-004, DS-005, DS-006, DS-011  
**Target:** All components match `plan/mockups/chat-zone.html`

## Scope

`src/features/chat/components/ChatMessage/` (8 files) + ChatInput layouts + WelcomeScreen.

## Changes

### `AssistantMessage.tsx`

- **Spacing normalization:** Replace the ad-hoc mix of `mt-2`, `mt-3`, `mt-4`, `mb-2`, `mb-3`, `my-2` between content blocks with a consistent `mt-4` gap between every top-level block (tool results, markdown, code, reasoning block).
- **Dead class:** Remove `text-white` from the outer div (it is immediately overridden by `style={{ color: "var(--color-text)" }}`). Also remove that inline style — use `text-text-main` class instead.
- **Highlighted message state:** `bg-red-200/40` → `bg-status-error/10`
- **Form submitted button:** `bg-green-500 border-green-700` → `bg-status-success border-status-success`
- **Reasoning block:** `bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/30` → `bg-primary/10 border-border-main` (`/5` is below visible threshold on most monitors — use `/10` minimum)
- **Icon buttons (copy, read aloud, etc.):** Replace with `<IconButton size="sm" variant="ghost">`

### `UserMessage.tsx`

- **Bubble styling:** Normalize bubble to `px-4 py-3 rounded-lg bg-surface border border-border-main` (currently inconsistent padding + colors between read/edit modes).
- **Margin redundancy:** `my-1 mb-4` on the outer wrapper → `mb-4` only (the `my-1` top is redundant given parent spacing).
- **Edit-mode file picker buttons:** `bg-gray-700/50`, `hover:bg-gray-500/600/700` → `bg-surface hover:bg-surface/50` (these appear on a dark overlay background, so `/50` hover is correct).
- **Highlighted state:** `bg-red-200/40` → `bg-status-error/10`
- **Dictate button:** `hover:bg-white/10` → `<IconButton size="sm" variant="overlay">` (the dictate button sits inside a chat bubble / colored background, so use the `overlay` variant — not `ghost`)

### `ChatInput/layouts/DefaultLayout.tsx` and `RallyLayout.tsx`

Both layouts are rendered inside a wrapper `<div>` in `ChatInput.tsx` with no classes. The visual shell (background, top border) is currently handled inconsistently inside each layout file.

- Add consistent shell to the parent in `ChatInput.tsx`: `bg-surface border-t border-border-main`
- In `DefaultLayout.tsx`: remove any `bg-*` and `border-t` classes from the outermost `<div>` that were compensating for the absent parent shell.
- In `RallyLayout.tsx`: same — remove `bg-*` and top-border classes from the outermost element.
- After the change, the two layout files should have no background or border-top declarations; those now live exclusively on the parent in `ChatInput.tsx`. Verify in the browser that neither layout shows a doubled border line or a background mismatch.

### `ChatContainer.tsx`

- Scroll-to-bottom button → `<IconButton size="md" variant="ghost">` (keep outer `absolute bottom-6 ...` positioning wrapper).

### `WelcomeScreen.tsx`

- Audit for hardcoded colors or non-standard classes.
- Apply `<PageHeading>` for the main title.

### `LoadingMessage.tsx` / `ThinkingDots.tsx`

- Confirm use of `text-text-muted` for the loading state text.
- No hardcoded gray values.

### `ErrorCard.tsx`

- Border: `border-status-error/30`; background: `bg-status-error/5`; icon: `text-status-error`.

## Acceptance Criteria

- [ ] `grep -rn 'bg-red-200\|bg-green-500\|border-green-700\|bg-blue-50\|border-blue-200\|text-white' src/features/chat/` returns zero results (except legitimate white text on primary bg)
- [ ] `grep -rn 'bg-gray-[0-9]\|hover:bg-gray-[0-9]' src/features/chat/` returns zero results
- [ ] AssistantMessage spacing between blocks is visually consistent with mockup
- [ ] UserMessage bubble looks correct in read mode and edit mode
- [ ] ChatInput has consistent background/border shell in both layout variants
- [ ] Dark mode: all chat elements recolor correctly
- [ ] `npm run build` passes
