# DS-006 · Hover & Interactive State Vocabulary

**Type:** Task  
**Wave:** 2  
**Effort:** XS  
**Blocked by:** DS-001  
**Blocks:** DS-007, DS-008, DS-009, DS-010

## Problem

Four different hover background opacity variants are in use for what should be one concept:

| Class in use | File(s) |
|-------------|---------|
| `hover:bg-surface` | Dashboard, ChatContainer, most sidebar items |
| `hover:bg-surface/50` | Mobile menu items in `Header.tsx` |
| `hover:bg-surface/80` | Sidebar session filter dropdown items |
| `hover:bg-white/10` | UserMessage dictate button |
| `hover:bg-gray-500`, `hover:bg-gray-600`, `hover:bg-gray-700` | UserMessage edit-UI file picker buttons |

Additionally, two active/selected patterns exist:
- `bg-primary/10 text-primary` (sidebar active session)
- `bg-blue-100 text-blue-600` (some inline active states — hardcoded, won't theme)

## Canonical Hover Rules (from DS-001)

| Context | Class |
|---------|-------|
| List rows, sidebar items, standard interactive elements | `hover:bg-surface` |
| Buttons on a non-default background (modal overlays, colored panels) | `hover:bg-surface/50` |
| Active / selected row or item | `bg-primary/10 text-primary` |

## Changes

### `src/layouts/Header.tsx`
- Mobile menu items: `hover:bg-surface/50` → `hover:bg-surface`

### `src/layouts/Sidebar/AppSidebar.tsx`
- Filter dropdown items: `hover:bg-surface/80` → `hover:bg-surface`

### `src/features/chat/components/ChatMessage/UserMessage.tsx`
- Dictate button: `hover:bg-white/10` → `hover:bg-surface/50`
- Edit-UI file picker: `hover:bg-gray-500`, `hover:bg-gray-600`, `hover:bg-gray-700` → `hover:bg-surface`
- Any hardcoded active/selected state with `bg-blue-*` → `bg-primary/10 text-primary`

### `src/features/dashboard/components/DashboardTopChrome.tsx`
- Audit for any non-standard hover variants and normalize

## Acceptance Criteria

- [ ] `grep -rn 'hover:bg-surface/80\|hover:bg-white/10\|hover:bg-gray-[0-9]' src/features/ src/layouts/` returns zero results
- [ ] All hover states work correctly in light and dark mode
- [ ] `npm run build` passes
