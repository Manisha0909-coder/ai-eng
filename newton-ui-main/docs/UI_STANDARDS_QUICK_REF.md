# UI Standards Quick Reference 🎨

> For full documentation, see [docs/UI_STANDARDIZATION.md](./docs/UI_STANDARDIZATION.md)

## Icon Standards

| Item | Standard | Example |
|------|----------|---------|
| **Icon Library** | `lucide-react` | `import { Copy } from "lucide-react"` |
| **Icon Size** | `18px` | `<Copy size={18} />` |
| **Button Size** | `h-7 w-7` | `className="h-7 w-7 p-1"` |
| **Button Padding** | `p-1` (4px) | `className="p-1"` |

## Color Standards

```tsx
// ✅ Always use CSS variables
style={{ color: "var(--color-text)" }}
style={{ backgroundColor: "var(--color-surface)" }}

// ❌ Never hardcode
style={{ color: "#ffffff" }}
```

## Font Size Standards

| Size | Class | Pixels | Usage |
|------|-------|--------|-------|
| XS | `text-xs` | 12px | Captions, labels |
| SM | `text-sm` | 14px | Secondary text |
| Base | `text-base` | 16px | Body text (default) |
| LG | `text-lg` | 18px | Subheadings |
| XL | `text-xl` | 20px | Headings |

## Button Template

```tsx
<button
  className="p-1 rounded-lg h-7 w-7 flex items-center justify-center hover:bg-[var(--color-surface)] transition-colors"
  style={{ color: "var(--color-text)" }}
>
  <IconName size={18} />
</button>
```

## Common Spacing

| Purpose | Class | Pixels |
|---------|-------|--------|
| Button group gap | `gap-2` | 8px |
| Element margin | `mt-1`, `mb-2` | 4px, 8px |
| Section spacing | `mt-4`, `mb-4` | 16px |

---

**See full guide:** [docs/UI_STANDARDIZATION.md](./docs/UI_STANDARDIZATION.md)

