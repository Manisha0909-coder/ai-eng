# DS-011 · HTML Mockup Reference Kit

**Type:** Task  
**Wave:** 2.5 (runs in parallel with Wave 2, after DS-001 is signed off)  
**Effort:** M  
**Blocked by:** DS-001  
**Blocks:** DS-007, DS-008, DS-009, DS-010

## Goal

Produce a set of self-contained HTML files showing the proposed visual redesign of Newton. Each file represents a full application page, opens standalone in any browser with no build step, and includes light and dark mode via a floating toggle.

These are the **visual contract** that Wave 3 developers match their implementations against. They must be reviewed and signed off before any Wave 3 ticket begins.

> **Design direction:** The mockups propose a fresh aesthetic — viridian/brass palette, Bricolage Grotesque display type, Instrument Sans body — departing from the DS-001 blue/indigo system. DS-001 will need a follow-up spec update once this direction is approved. Do not begin Wave 3 implementation until both the mockups and the DS-001 update are signed off.

## Deliverables

**Directory:** `plan/mockups/`

| File | Page |
|------|------|
| `login.html` | Login / BFF auth screen |
| `chat-welcome.html` | Chat shell + welcome screen + persona picker |
| `chat-conversation.html` | Chat shell + full message showcase + input states |
| `settings.html` | Settings dialog over dimmed chat backdrop |
| `visualization.html` | Visualization dashboard (chart tab + data tab) |
| `share-chat.html` | Shared chat view (read-only) |
| `documents.html` | Documents page |
| `admin-dashboard.html` | Admin console (Overview tab + generic CRUD pattern) |
| `README.md` | Index, how to open, canonical-chrome rule, design tokens |

Each file:
- Uses `<script src="https://cdn.tailwindcss.com">` — no build step
- Has an identical shared `<head>` block with the token system, fonts, and CSS variables
- Has a fixed floating **"Theme" pill** (bottom-right) that toggles `dark` on `<html>` and persists choice to `localStorage`
- Defaults to light mode; reviewers must check both

## Dark mode

Dark background is `rgb(13 20 17)` — a green-tinged near-black specific to this palette. Do **not** substitute `bg-gray-900`.

## Implementation Notes

Shared `tailwind.config` used in every file:

```html
<script>
  tailwind.config = {
    darkMode: 'class',
    theme: {
      extend: {
        colors: {
          background: 'rgb(var(--c-background) / <alpha-value>)',
          surface:    'rgb(var(--c-surface) / <alpha-value>)',
          /* … see README.md for full token list */
        },
        fontFamily: {
          display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
          sans:    ['"Instrument Sans"', 'system-ui', 'sans-serif'],
          mono:    ['"Spline Sans Mono"', 'ui-monospace', 'monospace'],
        }
      }
    }
  }
</script>
```

The canonical app header + sidebar markup lives in `chat-welcome.html` between `<!-- BEGIN/END shared-header -->` and `<!-- BEGIN/END shared-sidebar -->` markers and is duplicated verbatim to files that share the chat shell. See `README.md` for the maintenance rule.

## Review Gate

DS-011 must be reviewed and signed off before any of DS-007/008/009/010 begins.

## Acceptance Criteria

- [ ] All 8 HTML files open in a browser with no build step
- [ ] Floating Theme toggle re-themes every page; choice persists across files via `localStorage`
- [ ] Dark mode uses `rgb(13 20 17)` background, not `bg-gray-900`
- [ ] Each file covers the feature inventory described in the plan file (`plan/mockups/README.md`)
- [ ] Shared-chrome blocks are identical across files that share the app shell
- [ ] Shared `<head>` (token config) is identical across all files
- [ ] PR description contains explicit written approval from at least one reviewer confirming the visual direction works in both light and dark mode — **Wave 3 tickets and DS-001 update must not open until this sign-off appears in the PR**
