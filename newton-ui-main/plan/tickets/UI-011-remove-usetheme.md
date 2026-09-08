# UI-011 — Remove useTheme System, Replace with CSS + env vars

**Type:** Refactor  
**Priority:** P0 — Foundational  
**Epic:** [UI-000](./UI-000-epic.md)  
**Effort:** XL (3–4 days — 31 consumers across the codebase)  
**Risk:** High — touches the entire app  
**Blocks:** UI-001, UI-003, UI-004, UI-009, UI-010  
**Can run alongside:** UI-005, UI-006, UI-007

## Why

Each tenant is a separate deployment. Theme values are baked into `index.css` — there is no runtime switching between tenants. This makes the entire `useTheme` system unnecessary:

- `ThemeService` — fetches themes from API that no longer needs to exist
- `ThemesData.ts` — hardcoded theme objects replaced by `index.css`
- `useTheme` hook — replaced by a 6-line utility
- `useThemeColors` — deleted
- `applyShadcnTokens` — deleted
- Tenant assets — replaced by `import.meta.env.VITE_*` variables

## Files to Delete

```
src/hooks/useTheme.ts
src/hooks/useThemeColors.ts
src/services/infrastructure/themeService.ts
src/constants/ThemesData.ts
src/utils/shadcnThemeTokens.ts
src/types/theme.ts                    ← delete entirely, no longer needed
```

## Files to Create

### `src/utils/theme.ts`

```ts
export function initTheme() {
  const saved = localStorage.getItem('color-scheme') ?? 'dark'
  document.documentElement.classList.toggle('dark', saved === 'dark')
}

export function toggleDarkMode(dark?: boolean) {
  const root = document.documentElement
  const next = dark ?? !root.classList.contains('dark')
  root.classList.toggle('dark', next)
  localStorage.setItem('color-scheme', next ? 'dark' : 'light')
}
```

Call `initTheme()` in `main.tsx` before React mounts — prevents color flash on reload.

### `src/config/tenant.ts`

```ts
export const tenantAssets = {
  logoUrl:               import.meta.env.VITE_LOGO_URL ?? '',
  mobileLogoUrl:         import.meta.env.VITE_MOBILE_LOGO_URL ?? '',
  botLogoUrl:            import.meta.env.VITE_BOT_LOGO_URL ?? '',
  botLogoHeight:         Number(import.meta.env.VITE_BOT_LOGO_HEIGHT ?? 48),
  botLogoWidth:          Number(import.meta.env.VITE_BOT_LOGO_WIDTH ?? 48),
  chatbotIcon:           import.meta.env.VITE_CHATBOT_ICON ?? '',
  favicon:               import.meta.env.VITE_FAVICON ?? '',
  loadingAnimation:      import.meta.env.VITE_LOADING_ANIMATION ?? '',
  loadingAnimationHeight:Number(import.meta.env.VITE_LOADING_ANIMATION_HEIGHT ?? 80),
  loadingAnimationWidth: Number(import.meta.env.VITE_LOADING_ANIMATION_WIDTH ?? 80),
} as const
```

Components import directly — no hook, no store, no fetch:
```ts
import { tenantAssets } from '@/config/tenant'
```

## All Consumers (31 files)

Run to confirm full list:
```bash
grep -rl 'useTheme\|useThemeColors\|currentTheme' src/ --include="*.tsx" --include="*.ts"
```

| File | Uses | Migration |
|------|------|-----------|
| `src/App.tsx` | `useTheme` init | Call `initTheme()` in `main.tsx` instead |
| `src/layouts/Header.tsx` | theme switcher | Call `toggleDarkMode()` |
| `src/layouts/Sidebar/AppSidebar.tsx` | `currentTheme.colors.*` | Tailwind classes |
| `src/features/chat/components/ChatMessage/AssistantMessage.tsx` | UAE name check + colors | Delete conditional, use Tailwind classes |
| `src/features/chat/components/ChatMessage/UserMessage.tsx` | `currentTheme.colors.*` | Tailwind classes |
| `src/features/chat/components/ChatMessage/ChatMessage.tsx` | `currentTheme` | Tailwind classes |
| `src/features/chat/components/ChatMessage/ReasoningBlock.tsx` | `currentTheme.colors.*` | Tailwind classes |
| `src/features/chat/components/ChatMessage/NewtonProcessBlock.tsx` | `currentTheme.colors.*` | Tailwind classes |
| `src/features/chat/components/ChatMessage/LoadingMessage.tsx` | `currentTheme.assets.*` | `tenantAssets` from `@/config/tenant` |
| `src/features/chat/components/ChatMessage/types.ts` | `Theme` type | Remove type reference |
| `src/features/chat/components/ChatInput/ChatInput.tsx` | `currentTheme` | Tailwind classes |
| `src/features/chat/components/ChatInput/layouts/DefaultLayout.tsx` | `currentTheme` | Tailwind classes |
| `src/features/chat/components/ChatInput/types.ts` | `Theme` type | Remove type reference |
| `src/features/chat/components/ShareChat/ShareChat.tsx` | `currentTheme.colors.*` | Tailwind classes |
| `src/features/chat/components/WelcomeScreen/WelcomeScreen.tsx` | `currentTheme` | Tailwind classes |
| `src/features/dashboard/components/DashboardTopChrome.tsx` | `currentTheme` | Tailwind classes |
| `src/features/documents/components/Document/DocumentList.tsx` | `currentTheme` | Tailwind classes |
| `src/features/search/components/SearchResultsView/SearchResultsView.tsx` | `currentTheme` | Tailwind classes |
| `src/features/settings/components/Settings.tsx` | `currentTheme` | Tailwind classes |
| `src/features/visualization/components/DraggableDashboard/index.tsx` | `useThemeColors` | `chartColors()` util — see UI-004 |
| `src/features/visualization/components/DraggableDashboard/SortableCard.tsx` | `useThemeColors` | Tailwind classes |
| `src/features/visualization/components/DraggableDashboard/OverlayCard.tsx` | `useThemeColors` | Tailwind classes |
| `src/features/visualization/components/DraggableDashboard/FullScreenModal.tsx` | `useThemeColors` | Tailwind classes |
| `src/features/visualization/components/DraggableDashboard/PlotlyCell.tsx` | `useThemeColors` | `chartColors()` util |
| `src/features/visualization/components/DraggableDashboard/ChartContent.tsx` | `useThemeColors` | `chartColors()` util |
| `src/features/visualization/components/VisualizationSidebar/index.tsx` | `currentTheme` | Tailwind classes |
| `src/hooks/useThemeColors.ts` | wraps `useTheme` | Delete |
| `src/types/theme.ts` | `Theme` interface | Delete |
| `src/utils/plotlyLayoutUtils.ts` | `currentTheme` colors | `chartColors()` util |

> Audit `src/features/dashboard/Dashboard.tsx` and `src/features/chat/components/DynamicForm/DynamicForm.tsx` — they appear in greps but may not actually consume useTheme. Verify before editing.

## Three Migration Patterns

### Pattern A — Component reads colors (most common)
```tsx
// Before
const { currentTheme } = useTheme()
<div style={{ color: currentTheme.colors.text }}>

// After
<div className="text-text-main">
```

### Pattern B — Component reads asset dimensions
```tsx
// Before
const { currentTheme } = useTheme()
<img style={{ height: `${currentTheme.assets.botLogoHeight}px` }} />

// After
import { tenantAssets } from '@/config/tenant'
<img style={{ height: `${tenantAssets.botLogoHeight}px` }} />
```

### Pattern C — Plotly / chart colors (needs raw CSS var string)
```ts
// After — read CSS var at render time for Plotly
const raw = getComputedStyle(document.documentElement)
              .getPropertyValue('--color-primary').trim()
const color = `rgb(${raw.replace(/ /g, ',')})`
```

Extract a `chartColors()` utility in `src/utils/chartColors.ts` so this pattern isn't duplicated across visualization files.

## Acceptance Criteria

- [ ] `grep -r 'useTheme\|useThemeColors' src/` returns zero results
- [ ] `grep -r 'ThemeService\|ThemesData\|shadcnThemeTokens' src/` returns zero results
- [ ] `src/types/theme.ts` is deleted
- [ ] `initTheme()` runs before first paint — no color flash on reload
- [ ] Dark mode toggle works
- [ ] Plotly charts still render with correct colors
- [ ] Logo, bot icon, loading animation render from `tenantAssets`
- [ ] `npm run build` passes
