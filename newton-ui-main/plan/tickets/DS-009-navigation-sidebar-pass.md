# DS-009 · Navigation & Sidebar Visual Pass

**Type:** Task  
**Wave:** 3 (parallel with DS-007/008/010)  
**Effort:** M  
**Blocked by:** DS-003, DS-004, DS-006, DS-011

## Scope

`src/layouts/Header.tsx`, `src/features/dashboard/components/DashboardTopChrome.tsx`, `src/layouts/Sidebar/AppSidebar.tsx`.

## Changes

### `Header.tsx`

- **Icon buttons (7+ occurrences):** Replace every raw `<button>` that has an icon child, inline hover JS, and `style={{ borderRadius: 9999 }}` with `<IconButton size="md" variant="ghost" aria-label="...">`.
- **Remove `onMouseEnter`/`onMouseLeave` handlers:** These are the hover state JS workarounds that DS-004 eliminates. After migrating to `<IconButton>`, they should all be gone.
- **Remove `style={{ borderRadius: 9999, transitionDuration: "300ms" }}`:** Both are duplicates of `rounded-full` and `duration-300` already in the class strings.
- **Left margin alignment:** Desktop wrapper currently always applies `mx-4`. DashboardTopChrome applies `mx-0 md:mx-4`. Standardize: align DashboardTopChrome to always `mx-4` (see DashboardTopChrome section below), so both chrome bars are consistent.

### `DashboardTopChrome.tsx`

- **Replace `const iconBtn` with `<IconButton>`:** Drop the local string constant. Each button in the chrome bar → `<IconButton size="md" variant="ghost">`.
- **Margin alignment:** `mx-0 md:mx-4` → `mx-4` (always) to match Header.tsx. **Decision:** DashboardTopChrome was full-bleed on mobile (`mx-0`) to allow its background to run edge-to-edge. With the card tier system in place, the content area already has edge padding from its parent container, so going `mx-4` is correct. If a future design requires edge-to-edge chrome, revisit with a spec update — do not revert silently.
- **Mobile height:** Both `Header.tsx` and `DashboardTopChrome.tsx` should use `h-14` (56px) as the standard chrome bar height on all viewport sizes. Apply `h-14` to both if either currently uses `h-[52px]` or has no explicit height. Any fixed height that diverges from `h-14` requires a spec update to justify the exception.

### `AppSidebar.tsx`

- **Section heading colors:** `<h3 className="... text-zinc-400">Recent Chats</h3>` → `<SectionHeading>Recent Chats</SectionHeading>`. Same for "Archived Chats".
- **Loading/empty text:** `text-zinc-500` → `text-text-muted`.
- **Archived section margin:** `ml-1` on the archived section container → `px-1` to match the standard sidebar item indentation.
- **Session row right padding:** Add `pr-3` to session rows (currently only `pl-2` + no right padding, so action buttons sit against the edge).
- **Hover states:** Any `hover:bg-surface/80` → `hover:bg-surface` (covered by DS-006 but verify it's applied here too).

## Acceptance Criteria

- [ ] `grep -rn 'onMouseEnter\|onMouseLeave' src/layouts/Header.tsx` returns zero results
- [ ] `grep -rn 'borderRadius.*9999\|borderRadius.*999' src/layouts/Header.tsx` returns zero results
- [ ] `grep -rn 'text-zinc-[0-9]' src/layouts/` returns zero results
- [ ] Header.tsx and DashboardTopChrome.tsx have matching left margin behavior
- [ ] AppSidebar section headings use `<SectionHeading>`
- [ ] Session rows have balanced horizontal padding
- [ ] `npm run build` passes
- [ ] Sidebar and header render correctly on mobile and desktop
