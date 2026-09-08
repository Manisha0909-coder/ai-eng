# DS-000 · EPIC — Display Component Visual Consistency

**Type:** Epic  
**Priority:** High  
**Owner:** Tech Lead  
**Status:** Planning  
**Depends on:** UI-000 epic (infrastructure) — particularly UI-011 (useTheme removal) and UI-001 (token restructure)

## Goal

Make every display component in the app visually cohesive and aligned to a single, clearly documented design language. One developer picking up any file should immediately understand which card pattern, typography class, hover state, and icon button shape to use — because the answer is written in `plan/design-spec.md` and enforced by shared primitives.

## Problem Summary

The first epic (UI-000) cleaned up the infrastructure. What remains is that five different card patterns, three names for the same border color, two competing text token systems, and icon button logic duplicated 7+ times in `Header.tsx` have survived into the feature layer.


| Issue                                                                                                                               | Impact                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Dual token vocabulary (`text-foreground` vs `text-text-main`, `border-border` vs `border-border-main`)                              | Developers pick at random; dark-mode guarantees break for shadcn vs custom consumers |
| 5 different card visual patterns with no shared abstraction                                                                         | Every new card is invented from scratch                                              |
| `<IconButton>` duplicated 7+ times in `Header.tsx` with inline hover JS                                                             | Can't change the icon button shape in one place                                      |
| No shared `<SectionHeading>` / `<PageHeading>` — `<p>`, `<h3>`, different colors, different font weights all used for the same role | Visual hierarchy is inconsistent across every page                                   |
| Hardcoded `text-zinc-400`, `bg-gray-*`, `bg-blue-50`, `bg-green-500`, `bg-red-200` in feature files                                 | Won't respond to theme or dark mode                                                  |
| 4 different hover background opacity variants                                                                                       | Interactive states feel inconsistent                                                 |




## Child Tickets


| Ticket                                            | Title                                           | Wave | Effort | Blocked By             |
| ------------------------------------------------- | ----------------------------------------------- | ---- | ------ | ---------------------- |
| [DS-001](./DS-001-design-spec.md)                 | Design specification document                   | 1    | M      | —                      |
| [DS-002](./DS-002-token-vocabulary.md)            | Resolve dual token vocabulary                   | 1    | S      | UI-001                 |
| [DS-003](./DS-003-card-tier-system.md)            | Card tier system                                | 2    | M      | DS-001                 |
| [DS-004](./DS-004-icon-button.md)                 | `<IconButton>` primitive                        | 2    | S      | DS-001                 |
| [DS-005](./DS-005-section-heading.md)             | `<SectionHeading>` / `<PageHeading>` components | 2    | S      | DS-001                 |
| [DS-006](./DS-006-hover-states.md)                | Hover & interactive state vocabulary            | 2   | XS     | DS-001                 |
| [DS-013](./DS-013-design-spec-lint.md)            | Design spec lint script                         | 2    | S      | DS-001                 |
| [DS-011](./DS-011-html-mockups.md)                | HTML mockup reference kit                       | 2.5  | M      | DS-001                 |
| [DS-007](./DS-007-chat-visual-pass.md)            | Chat area visual pass                           | 3    | L      | DS-003/004/005/006/011 |
| [DS-008](./DS-008-dashboard-visual-pass.md)       | Dashboard visual pass                           | 3    | L      | DS-003/004/005/006/011 |
| [DS-009](./DS-009-navigation-sidebar-pass.md)     | Navigation & Sidebar visual pass                | 3    | M      | DS-003/004/006/011     |
| [DS-010](./DS-010-visualization-settings-pass.md) | Visualization & Settings visual pass            | 3    | M      | DS-003/005/006/011     |
| [DS-012](./DS-012-visual-regression.md)           | Visual regression baseline                      | 4    | S      | DS-007/008             |




## Wave Plan

```
Wave 1 (serial):
  DS-001  Design spec document          ← defines all visual decisions
  DS-002  Token vocabulary unification  ← needs UI-001 done first

Wave 2 (parallel — all need DS-001):
  DS-003  Card tier system
  DS-004  IconButton primitive
  DS-005  SectionHeading / PageHeading
  DS-006  Hover state vocabulary
  DS-013  Design spec lint script   ← failing CI gate before Wave 3

Wave 2.5 (parallel with Wave 2, needs DS-001):
  DS-011  HTML mockup reference kit    ← visual contract for Wave 3 developers

Wave 3 (parallel — all need Wave 2 + DS-011):
  DS-007  Chat visual pass
  DS-008  Dashboard visual pass
  DS-009  Navigation & Sidebar pass
  DS-010  Visualization & Settings pass

Wave 4 (serial):
  DS-012  Visual regression baseline
```



## Definition of Done

- `plan/design-spec.md` exists and is signed off
- `grep -r 'text-foreground\|text-muted-foreground\|border-border[^-]' src/features/` returns zero results
- `grep -r 'onMouseEnter\|onMouseLeave' src/layouts/Header.tsx` returns zero results
- `grep -r 'text-zinc-[0-9]\|bg-gray-[0-9]\|bg-blue-50\|bg-green-500\|bg-red-200' src/features/` returns zero results
- Toggle `.dark` class on `<html>` — all components recolor correctly
- HTML mockups reviewed and match the deployed app after Wave 3
- `npm run build` passes after every wave
- `npm run lint:design` passes after every wave (script added in DS-013)

