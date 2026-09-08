# DS-005 · `<SectionHeading>` and `<PageHeading>` Components

**Type:** Task  
**Wave:** 2  
**Effort:** S  
**Blocked by:** DS-001  
**Blocks:** DS-007, DS-008, DS-009, DS-010

## Problem

The same "section label inside a panel" role is expressed three different ways:

| File | Element | Classes |
|------|---------|---------|
| `AdminOverviewSection.tsx` (filter label) | `<p>` | `text-sm font-semibold text-foreground` |
| `Settings.tsx` (Connected Accounts) | `<h3>` | `text-sm font-semibold text-foreground` |
| `AppSidebar.tsx` (Recent Chats / Archived Chats) | `<h3>` | `text-sm font-medium text-zinc-400` |

The correct semantic element is `<h3>`. The correct color is `text-text-main` (not `text-foreground`, not `text-zinc-400`). The correct weight is `font-semibold`.

Additionally, no shared `<PageHeading>` component exists — page titles are written ad hoc wherever they appear.

## Solution

**File to create:** `src/components/ui/headings.tsx`

```tsx
export function PageHeading({ children, className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1 className={cn("text-2xl font-bold tracking-tight text-text-main", className)} {...props}>
      {children}
    </h1>
  )
}

export function SectionHeading({ children, className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-sm font-semibold text-text-main", className)} {...props}>
      {children}
    </h3>
  )
}
```

The `cn` utility is already available at `src/lib/utils.ts`.

## Migration Targets

### `src/features/dashboard/sections/AdminOverviewSection.tsx`
- `<p className="text-sm font-semibold text-foreground">Logs Filters</p>` → `<SectionHeading>Logs Filters</SectionHeading>`
- Three `CardTitle` elements using different size classes → all normalize to `text-lg font-semibold` (use shadcn `<CardTitle>` with explicit class override or a local `CardTitleMd` wrapper)

### `src/layouts/Sidebar/AppSidebar.tsx`
- `<h3 className="... text-sm font-medium text-zinc-400">Recent Chats</h3>` → `<SectionHeading>Recent Chats</SectionHeading>`
- Same for "Archived Chats"

### `src/features/settings/components/Settings.tsx`
- `<h3 className="text-sm font-semibold text-foreground">Connected Accounts</h3>` → `<SectionHeading>Connected Accounts</SectionHeading>`

## Notes

- Do not add `<PageHeading>` usages yet in this ticket — just create it so DS-007/008/009/010 can adopt it.
- The `className` prop allows callers to add margin/spacing without breaking the base style.

## Acceptance Criteria

- [ ] `src/components/ui/headings.tsx` created with `PageHeading` and `SectionHeading`
- [ ] All listed migration targets updated
- [ ] `grep -rn '<p.*font-semibold.*foreground\|h3.*zinc-400' src/features/ src/layouts/` returns zero results
- [ ] `npm run build` passes
