# Newton UI — HTML Mockup Reference Kit

Standalone HTML mockups showing the proposed visual redesign of Newton. Each file opens directly in any browser — no build step, no server needed.

## Opening a mockup

```
open plan/mockups/login.html          # macOS
xdg-open plan/mockups/login.html     # Linux
# Or drag any file onto a browser tab
```

All files use the Tailwind CDN and Google Fonts. An internet connection is required for fonts; Tailwind falls back silently offline.

## Light / dark mode

Every page has a **"Theme" pill** fixed at the bottom-right of the screen. Click it to toggle light ↔ dark. The choice persists across files via `localStorage` (`newton-mock-theme`).

Default: light. Reviewers must check both modes — some design decisions (e.g. card blur effects) only become visible in dark mode.

## Files

| File | Page | Notes |
|------|------|-------|
| `login.html` | Login / BFF auth screen | Sets the design direction; establishes the shared token/font system |
| `chat-welcome.html` | Chat — welcome + persona picker | **Canonical chrome** — header/sidebar markup lives here |
| `chat-conversation.html` | Chat — active conversation | Full message type showcase: reasoning, tools, markdown, errors, input states |
| `settings.html` | Settings dialog | Shown over a dimmed chat backdrop (reflects its modal nature in production) |
| `visualization.html` | Visualization dashboard | Dashboard-persona session; split chat/viz layout; Data tab section below |
| `share-chat.html` | Shared chat (read-only) | Minimal header; no input; copy/read-aloud only |
| `documents.html` | Documents | Full-page; upload, file list, empty state |
| `admin-dashboard.html` | Admin console | Own chrome (no chat header); Overview tab + generic CRUD list pattern |
| `connections.html` | Connections (user) | Provider connections against the new `/connections` API — connected list with `pending` / `active` / `needs_reauth` / `error` states, `last_error` display, available-provider grid, credential dialog (`api_key`/`basic`), OAuth handoff + callback landing banners, disconnect confirm |
| `admin-providers.html` | Admin — Provider Catalog | System-admin view of `/connections/providers`: catalog table (auth mode, credentials, enabled/disabled/orphaned), sync action, and the Configure drawer for `PATCH` (write-only client ID/secret, scopes override, provider config, read-only spec) |
| `admin-tables.html` | Admin DataTable patterns | Canonical table shell: sort, filters, pagination, cell types, loading/empty/zero-results states. Column headers use `.th-col` — all caps, mono, `text-2xs`, wide tracking. Card titles stay title case. |

## Design direction

| Token | Light | Dark |
|-------|-------|------|
| Page background | `rgb(246 247 244)` — cool green paper | `rgb(13 20 17)` — observatory green-black |
| Surface | `rgb(255 255 255)` | `rgb(22 32 27)` |
| Primary | `rgb(23 112 92)` — viridian | `rgb(61 185 149)` — lifted viridian |
| Accent | `rgb(168 123 45)` — brass | `rgb(212 169 95)` — lifted brass |
| Display font | Bricolage Grotesque | |
| Body font | Instrument Sans | |
| Code/label font | Spline Sans Mono | |

**Signature element:** the spectrum rule — a 2px gradient hairline (`primary → accent`) used once per page as a top accent. Named `.spectrum-rule` in each file's `<style>`.

This is a deliberate departure from the DS-001 blue/indigo palette. Reviewers should assess the direction before implementation begins; DS-001 will need an update once this direction is approved.

## Shared chrome rule

`chat-welcome.html` contains the **canonical** app header and sidebar markup between:

```html
<!-- BEGIN shared-header --> … <!-- END shared-header -->
<!-- BEGIN shared-sidebar --> … <!-- END shared-sidebar -->
```

These blocks are duplicated verbatim in `chat-conversation.html`, `settings.html` (header only, simplified), and `visualization.html`. If the header design changes, update the canonical copy in `chat-welcome.html` first, then propagate to the other files.

The shared `<head>` block (fonts, Tailwind config, CSS variables) lives between `<!-- BEGIN shared-head -->` / `<!-- END shared-head -->` in every file and must remain byte-identical across all files.

## Annotated states

Components shown inside dashed `<!-- anno -->` boxes are **state variants**, not part of the primary flow. They demonstrate error, loading, empty, and edit-mode states inline for reviewer visibility without requiring interaction.

## Review gate

These mockups must be reviewed and signed off before any DS-007/008/009/010 implementation begins. See `plan/tickets/DS-011-html-mockups.md`.
