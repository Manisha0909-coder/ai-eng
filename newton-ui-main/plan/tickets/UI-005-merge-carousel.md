# UI-005 — Merge Carousel Components

**Type:** Refactor  
**Priority:** P1  
**Epic:** [UI-000](./UI-000-epic.md)  
**Effort:** M (3–4 hours)  
**Risk:** Low-Medium (one active consumer)  
**Depends on:** nothing — can start immediately

## Background

Two carousel components exist with no guidance on which to use:

| Component | Location | Library | Features |
|-----------|----------|---------|---------|
| `carousel.tsx` | `src/components/ui/carousel.tsx` | Embla | Composable API, keyboard nav, context-based |
| `custom-carousel.tsx` | `src/components/ui/custom-carousel.tsx` | None (custom) | autoPlay, loop, `itemsPerSlide`, touch swipe |

`custom-carousel.tsx` is used in exactly one place: `src/features/travel/components/Cards/CardsContainer.tsx`.

**Decision:** Keep `carousel.tsx` (the composable Embla-based one). Add the missing autoPlay and responsive `itemsPerSlide` features to it. Migrate the one consumer. Delete the custom implementation.

## Steps

1. **Install Embla autoplay plugin** (confirm package name — two exist: `embla-carousel-autoplay` and `embla-carousel-auto-scroll`; use `embla-carousel-autoplay` for simple interval-based play):
   ```bash
   npm install embla-carousel-autoplay
   ```

2. **Update `carousel.tsx`** — add optional props:
   ```tsx
   interface CarouselProps {
     autoPlay?: boolean
     autoPlayDelay?: number   // ms, default 3000
     itemsPerSlide?: number   // default 1
     loop?: boolean
   }
   ```
   Wire `autoPlay` via `useEmblaCarousel([{ loop }, autoScroll({ delay: autoPlayDelay })])`.

3. **Migrate `CardsContainer.tsx`** — replace `CustomCarousel` import with `Carousel` from `@/components/ui/carousel`. Map the old props:
   - `autoPlay` → `autoPlay`
   - `autoPlayInterval` → `autoPlayDelay`
   - `itemsPerSlide` → `itemsPerSlide`
   - `loop` → `loop`

4. **Delete `custom-carousel.tsx`**

5. **Update barrel exports** in `src/components/ui/index.ts` (if it exists) — remove `custom-carousel` export.

## Acceptance Criteria

- [ ] `custom-carousel.tsx` is deleted
- [ ] Travel Cards page renders with autoplay, correct items per slide, and loop
- [ ] Existing uses of `Carousel` (without autoPlay) are unaffected
- [ ] `npm run build` passes
- [ ] No import of `custom-carousel` anywhere in the codebase

## Verification

```bash
grep -r 'custom-carousel\|CustomCarousel' src/
# Should return zero results
```

Navigate to the travel feature → Cards section → confirm carousel autoplays and shows multiple cards per slide.
