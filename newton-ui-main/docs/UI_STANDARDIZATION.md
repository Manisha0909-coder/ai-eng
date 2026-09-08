# UI Standardization Guide

This document outlines the standardization guidelines for the Newton UI project to ensure consistency across all components.

## 📦 Icon Library

**Always use:** `lucide-react` for all icons

```tsx
import { Copy, Share2, Mic, Send, PencilIcon } from "lucide-react";
```

### ❌ Don't Use
- `react-icons/md` (Material Design Icons)
- `react-icons/fa` (Font Awesome)
- Other icon libraries (unless absolutely necessary)

---

## 🎨 Icon Sizes

### Standard Icon Size: **18px**

All action icons throughout the application should use `size={18}`:

```tsx
// ✅ Correct
<Copy size={18} />
<Share2 size={18} />
<PencilIcon size={18} />
<Mic size={18} />

// ❌ Incorrect
<Copy size={22} />
<Copy className="h-5 w-5" />
```

### Button Container Sizes

Action buttons should use standardized container dimensions:

```tsx
// ✅ Correct - Standard action button
<button className="p-1 rounded-lg h-7 w-7 flex items-center justify-center">
  <Copy size={18} />
</button>

// ❌ Incorrect
<button className="p-1.5 rounded-lg h-8 w-8">
  <Copy size={22} />
</button>
```

### Where This Applies

- ✅ User message action buttons (copy, edit)
- ✅ Assistant message action buttons (copy, share, read aloud, thumbs up/down)
- ✅ Chat input buttons (send, stop, mic, image upload)
- ✅ Header menu items
- ✅ All interactive UI elements

---

## 🎨 Colors

### CSS Custom Properties

Always use CSS custom properties for theming support:

```tsx
// ✅ Correct
style={{ color: "var(--color-text)" }}
style={{ backgroundColor: "var(--color-surface)" }}
style={{ borderColor: "var(--color-border)" }}

// ❌ Incorrect
style={{ color: "#ffffff" }}
className="text-white bg-gray-800"
```

### Available Color Variables

```css
/* Text Colors */
--color-text              /* Primary text color */
--color-text-secondary    /* Secondary/muted text */
--color-primary           /* Primary brand color */
--color-primary-text      /* Text on primary color background */

/* Background Colors */
--color-background        /* Main background */
--color-surface           /* Surface/card background */
--color-surface-hover     /* Hover state for surfaces */
--color-background-gradient /* Gradient backgrounds (Nakilat theme) */

/* Border Colors */
--color-border            /* Default borders */

/* State Colors */
--color-error             /* Error states */
--color-success           /* Success states */
--color-warning           /* Warning states */
```

### Theme-Specific Overrides

Only override when theme-specific behavior is required:

```tsx
// ✅ Acceptable for theme customization
style={{
  color: currentTheme.name === "Nakilat" 
    ? "var(--color-primary)" 
    : "var(--color-text)"
}}

// But prefer this when possible:
style={{ color: "var(--color-text)" }}
```

---

## 📝 Font Sizes

### Text Size Classes

Use Tailwind utility classes for consistent typography:

```tsx
// Headers
<h1 className="text-2xl font-bold">      // 24px
<h2 className="text-xl font-semibold">   // 20px
<h3 className="text-lg font-semibold">   // 18px

// Body Text
<p className="text-base">                // 16px (default)
<p className="text-sm">                  // 14px (secondary text)
<p className="text-xs">                  // 12px (captions, labels)

// Responsive Text
<p className="text-base sm:text-sm">     // 16px on mobile, 14px on desktop
```

### Font Weights

```tsx
className="font-normal"     // 400 (regular)
className="font-medium"     // 500 (medium)
className="font-semibold"   // 600 (semibold)
className="font-bold"       // 700 (bold)
```

---

## 🔘 Button Standardization

### Action Button Template

```tsx
<button
  type="button"
  onClick={handleAction}
  className="p-1 rounded-lg h-7 w-7 flex items-center justify-center hover:bg-[var(--color-surface)] transition-colors"
  style={{ color: "var(--color-text)" }}
>
  <IconName size={18} />
</button>
```

### Button States

```tsx
// Hover states
className="hover:bg-[var(--color-surface)]"

// Disabled states
className="disabled:opacity-50 disabled:cursor-not-allowed"
disabled={!canSubmit}

// Loading states
{isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
```

---

## 📐 Spacing

### Consistent Padding/Margin

```tsx
// Button padding
className="p-1"           // 4px - Standard for icon buttons
className="p-2"           // 8px - Larger interactive areas

// Gap between elements
className="gap-2"         // 8px - Standard gap for button groups
className="gap-3"         // 12px - Larger spacing

// Margins
className="mt-1"          // 4px
className="mt-2"          // 8px
className="mb-4"          // 16px
```

---

## ✅ Examples

### Good Example: Copy Button

```tsx
import { Copy, Check } from "lucide-react";

<button
  onClick={handleCopy}
  className="p-1 rounded-lg h-7 w-7 flex items-center justify-center hover:bg-[var(--color-surface)] transition-colors"
>
  {copied ? (
    <Check size={18} className="text-green-500" />
  ) : (
    <Copy size={18} style={{ color: "var(--color-text)" }} />
  )}
</button>
```

### Good Example: Action Buttons Row

```tsx
<div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
  <button className="p-1 rounded-lg h-7 w-7 flex items-center justify-center hover:bg-[var(--color-surface)]">
    <Copy size={18} style={{ color: "var(--color-text)" }} />
  </button>
  
  <button className="p-1 rounded-lg h-7 w-7 flex items-center justify-center hover:bg-[var(--color-surface)]">
    <Share2 size={18} style={{ color: "var(--color-text)" }} />
  </button>
  
  <button className="p-1 rounded-lg h-7 w-7 flex items-center justify-center hover:bg-[var(--color-surface)]">
    <PencilIcon size={18} style={{ color: "var(--color-text)" }} />
  </button>
</div>
```

---

## 🚨 Common Mistakes to Avoid

### ❌ Don't Mix Icon Libraries

```tsx
// ❌ Bad
import { MdContentCopy } from "react-icons/md";
import { Copy } from "lucide-react";

// ✅ Good
import { Copy } from "lucide-react";
```

### ❌ Don't Use Hardcoded Sizes with className

```tsx
// ❌ Bad - Hardcoded size in className
<Copy className="h-5 w-5" />

// ✅ Good - Use size prop
<Copy size={18} />
```

### ❌ Don't Use Hardcoded Colors

```tsx
// ❌ Bad
<button className="text-white bg-gray-800">
  <Copy size={18} />
</button>

// ✅ Good
<button style={{ color: "var(--color-text)", backgroundColor: "var(--color-surface)" }}>
  <Copy size={18} />
</button>
```

### ❌ Don't Inconsistently Size Buttons

```tsx
// ❌ Bad - Inconsistent button sizes
<button className="p-2 h-8 w-8">...</button>
<button className="p-1 h-6 w-6">...</button>

// ✅ Good - Consistent button sizes
<button className="p-1 h-7 w-7">...</button>
<button className="p-1 h-7 w-7">...</button>
```

---

## 🔍 Where to Apply

### Components That Should Follow These Standards

- ✅ `ChatMessage.tsx` - All message action buttons
- ✅ `ChatInput.tsx` - All input action buttons
- ✅ `Header.tsx` - All header icons
- ✅ `FeedBackButtons.tsx` - Thumbs up/down
- ✅ `ReadAloud.tsx` - TTS controls
- ✅ `copy-button.tsx` - Copy functionality
- ✅ Any new components with action buttons

---

## 📋 Quick Reference Checklist

When creating new interactive elements:

- [ ] Using `lucide-react` icons
- [ ] Icon size is `18`
- [ ] Button container is `h-7 w-7` with `p-1`
- [ ] Using `var(--color-*)` for colors
- [ ] Using Tailwind text size classes
- [ ] Hover states use `hover:bg-[var(--color-surface)]`
- [ ] Transitions use `transition-colors` or `transition-opacity`
- [ ] Gaps between elements use `gap-2`

---

## 🔄 Migration Guide

If you encounter legacy code that doesn't follow these standards:

1. Replace icon library imports with `lucide-react`
2. Change `size={22}` or `size={20}` to `size={18}`
3. Remove `className="h-X w-X"` from icons
4. Update button containers to `h-7 w-7 p-1`
5. Replace hardcoded colors with CSS custom properties
6. Test in different themes (Newton, Nakilat, Glass, UAE, etc.)

---

## 📞 Questions?

If you have questions about standardization or need to deviate from these guidelines for a specific use case, please:

1. Document the reason in a code comment
2. Discuss with the team in code review
3. Consider if it should be added to this guide

---

**Last Updated:** October 2025  
**Version:** 1.0.0

