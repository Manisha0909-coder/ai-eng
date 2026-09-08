# Blocks.so Integration Guide

## Overview
[Blocks.so](https://blocks.so/) provides 60+ free, copy-paste shadcn/ui components that can be integrated into Newton-UI.

## Integration Method

Blocks.so components are **copy-paste** components, not npm packages. Here's how to integrate them:

### Method 1: Direct Copy-Paste (Recommended)
1. Visit [blocks.so](https://blocks.so/)
2. Browse to the component category you need (e.g., `/sidebar`, `/dialogs`, `/tables`)
3. Click on a specific block to view its code
4. Copy the component code
5. Paste into your project at the appropriate location
6. Ensure all required shadcn/ui dependencies are installed

### Method 2: Using shadcn CLI Registry (If Available)
Some blocks may be available via the shadcn CLI registry:
```bash
npx shadcn@latest add @blocks/[block-name]
```

## Available Blocks

### Sidebar (6 blocks)
- **Location**: `/sidebar`
- **Use Case**: Enhance existing `AppSidebar.tsx` with collapsible sections, navigation groups, etc.

### Dialogs (12 blocks)
- **Location**: `/dialogs`
- **Use Case**: Replace or enhance existing dialog components

### Tables (5 blocks)
- **Location**: `/tables`
- **Use Case**: Dashboard tables, data display

### Stats (15 blocks)
- **Location**: `/stats`
- **Use Case**: Dashboard statistics cards, metrics display

### Command Menu (3 blocks)
- **Location**: `/command-menu`
- **Use Case**: Global command palette (Cmd+K functionality)

### File Upload (6 blocks)
- **Location**: `/file-upload`
- **Use Case**: Enhance file upload functionality

### Form Layout (5 blocks)
- **Location**: `/form-layout`
- **Use Case**: Improve form layouts in DynamicForm and other forms

### Login & Signup (9 blocks)
- **Location**: `/login`
- **Use Case**: Enhance AuthScreen.tsx

### AI Components (4 blocks)
- **Location**: `/ai`
- **Use Case**: AI-specific UI components

## Current Project Compatibility

✅ **Compatible** - Your project already has:
- shadcn/ui configured (`components.json`)
- Required Radix UI primitives installed
- Tailwind CSS configured
- TypeScript setup
- React 18+

## Recommended Integrations for Newton-UI

1. **Sidebar Blocks** - Enhance `AppSidebar.tsx` with collapsible sections
2. **Command Menu** - Add global command palette (Cmd+K)
3. **Stats Blocks** - Enhance Dashboard statistics display
4. **Tables** - Improve Dashboard table layouts
5. **Dialogs** - Standardize dialog components

## Steps to Add a Block

1. Visit the block page on blocks.so
2. Click on the "Code" tab
3. Copy the component code
4. Create a new file in your components directory (or integrate into existing)
5. Adjust imports to match your project structure (`@/components/ui/*`)
6. Customize styling/functionality as needed
7. Test the component

## Example: Adding a Sidebar Block

```bash
# 1. Visit https://blocks.so/sidebar
# 2. Choose a block (e.g., "Sidebar Collapsible Sections")
# 3. Copy the code
# 4. Create: src/components/blocks/SidebarCollapsible.tsx
# 5. Paste and adjust imports
# 6. Import and use in your AppSidebar.tsx
```

## Notes

- All blocks use shadcn/ui components you already have installed
- Blocks are fully customizable
- No additional npm packages required (unless a block uses a new shadcn component)
- If a block requires a new shadcn component, install it first:
  ```bash
  npx shadcn@latest add [component-name]
  ```

## Resources

- [Blocks.so](https://blocks.so/)
- [GitHub Repository](https://github.com/ephraimduncan/blocks)
- [shadcn/ui Documentation](https://ui.shadcn.com/)

