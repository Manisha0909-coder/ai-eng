# UI-002 — Delete PaymentForm and TravelPackage

**Type:** Chore  
**Priority:** P1  
**Epic:** [UI-000](./UI-000-epic.md)  
**Effort:** XS (30 minutes)  
**Risk:** Low — confirmed safe to remove  
**Depends on:** nothing — can start immediately

## What to Delete

```
src/features/payments/                              ← whole folder
src/features/travel/components/TravelPackage/       ← whole folder
```

## Consumers to Clean Up

### `src/features/chat/components/ChatMessage/AssistantMessage.tsx`
- Line 24: remove `import TravelPackage from "@/features/travel/components/TravelPackage/TravelPackage"`
- Line 373: remove `return <TravelPackage packages={message.packages} />`
- Line 377: remove `return <TravelPackage package={message.package} />`

### `src/utils/iconRegistry.ts`
- Remove `payment: CreditCard` (line 273) and the aliases on the next lines: `card`, `credit`, `creditcard` — all point to `CreditCard` and are only used by PaymentForm
- Same for the string map at lines 608–611

## Deletion Order

Delete `TravelPackage/` first — it imports `PaymentForm`, so `payments/` cannot be cleanly removed until `TravelPackage` is gone.

## Acceptance Criteria

- [ ] `src/features/payments/` directory is gone
- [ ] `src/features/travel/components/TravelPackage/` directory is gone
- [ ] `grep -r 'PaymentForm\|TravelPackage' src/` returns zero results
- [ ] `grep -r 'payment\|card\|credit\|creditcard' src/utils/iconRegistry.ts` returns zero results for the removed aliases
- [ ] `AssistantMessage.tsx` compiles without the removed imports and render branches
- [ ] `npm run build` passes
