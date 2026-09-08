# Blocks.so Integration Examples for Newton-UI

## Quick Integration Guide

### 1. Command Menu Integration

You already have the `Command` component (`src/components/ui/command.tsx`). You can enhance it with blocks.so command menu blocks:

**Steps:**
1. Visit: https://blocks.so/command-menu
2. Choose a block (e.g., "Command Menu with Groups")
3. Copy the code
4. Create: `src/components/blocks/CommandMenu.tsx`
5. Integrate keyboard shortcut (Cmd+K / Ctrl+K)

**Example Integration:**
```tsx
// src/components/blocks/CommandMenu.tsx
"use client"

import * as React from "react"
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command"
import { useNavigate } from "react-router-dom"

export function CommandMenu() {
  const [open, setOpen] = React.useState(false)
  const navigate = useNavigate()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => { navigate("/"); setOpen(false) }}>
            Home
          </CommandItem>
          <CommandItem onSelect={() => { navigate("/dashboard"); setOpen(false) }}>
            Dashboard
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => { /* Your action */ setOpen(false) }}>
            New Chat
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
```

Then add to `App.tsx`:
```tsx
import { CommandMenu } from "@/components/blocks/CommandMenu"

// In your App component:
<CommandMenu />
```

### 2. Enhanced Table Components

Your Dashboard has multiple tables. Enhance them with blocks.so table blocks:

**Current Tables:**
- `FeedbackTable.tsx`
- `LogsTable.tsx` 
- `PersonaTable.tsx`
- Tables in `DocumentsSection.tsx`
- Tables in `ToolServersSection.tsx`

**Steps:**
1. Visit: https://blocks.so/tables
2. Choose a table block (e.g., "Table with Filters")
3. Copy the code
4. Replace or enhance your existing table components

**Example: Enhanced FeedbackTable**
```tsx
// You can enhance FeedbackTable.tsx with blocks.so table patterns
// Visit https://blocks.so/tables and copy a table block
// Then adapt it to your FeedbackTable structure
```

### 3. Stats Cards for Dashboard

Enhance your Dashboard with stats blocks:

**Steps:**
1. Visit: https://blocks.so/stats
2. Choose stat card blocks
3. Create: `src/components/blocks/StatsCards.tsx`
4. Use in Dashboard sections

**Example:**
```tsx
// src/components/blocks/StatsCards.tsx
// Copy from https://blocks.so/stats
// Adapt to show:
// - Total Tools
// - Total Users
// - Total Tags
// - Total Documents
// etc.
```

### 4. Enhanced Sidebar

Your `AppSidebar.tsx` can be enhanced with blocks.so sidebar patterns:

**Steps:**
1. Visit: https://blocks.so/sidebar
2. Choose "Sidebar Collapsible Sections" or "Sidebar with Navigation Groups"
3. Adapt the pattern to your existing sidebar structure
4. Add collapsible sections for chat groups

### 5. Dialog Enhancements

You have various dialogs. Enhance them with blocks.so dialog blocks:

**Steps:**
1. Visit: https://blocks.so/dialogs
2. Choose dialog patterns (e.g., "Confirmation Dialog", "Form Dialog")
3. Enhance your existing dialogs:
   - `DeleteConfirmationModal.tsx`
   - `CreatePersonaModal.tsx`
   - Form dialogs

## Recommended Priority

1. **Command Menu** - High impact, easy integration
2. **Stats Cards** - Enhance Dashboard visual appeal
3. **Table Enhancements** - Improve data display
4. **Sidebar Enhancements** - Better navigation UX
5. **Dialog Enhancements** - Consistent dialog patterns

## Integration Checklist

- [ ] Choose a block from blocks.so
- [ ] Copy the component code
- [ ] Create new file in `src/components/blocks/`
- [ ] Adjust imports to match your project (`@/components/ui/*`)
- [ ] Test the component
- [ ] Customize styling/functionality
- [ ] Integrate into your app
- [ ] Test on mobile/desktop
- [ ] Update documentation

## Notes

- All blocks use your existing shadcn/ui components
- No new npm packages needed (unless block requires new shadcn component)
- Blocks are fully customizable
- Maintain your existing theme system
- Test thoroughly before deploying

