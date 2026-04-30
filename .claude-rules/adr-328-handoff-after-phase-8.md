# ADR-328 Handoff — After Phase 8: Award Flow + Reason Capture

**Date:** 2026-04-30
**Phase completed:** 8 (Award Flow, §5.F / §5.X)
**Phase next:** 9 (Versioning, §5.AA) — depends on Phases 5 ✓ and 8 ✓

## What was built

### New files (3)

- `src/subapps/procurement/utils/quote-cheapest.ts` (~20 lines):
  - `eligibleForComparison(q)` — status not rejected/draft + subtotal > 0
  - `isCheapestEligible(targetQuote, quotes)` — naive pre-VAT net comparison
  - `cheapestEligibleQuote(quotes)` — returns cheapest eligible Quote
  - NOTE: ADR-331 will refine to normalized TCO. `quote-cheapest.ts` is a Phase 9 utility too.

- `src/subapps/procurement/hooks/useAwardFlow.ts` (~95 lines):
  - `UseAwardFlowOptions`: `comparison`, `currentWinnerId`, `onFireAward`
  - `UseAwardFlowResult`: `optimisticWinnerId`, `pendingEntry`, `cheapestEntry`, `handleAwardIntent`, `handleDialogConfirm`, `handleDialogCancel`
  - `executeAward()`: optimistic → API → Sonner toast (8s, Undo action)
  - Undo re-awards `prevId`; no Undo button for first-ever award (prevId null)
  - Error path: retry action in toast
  - **Deviation**: spec called it `quote-award-service.ts` — placed in hooks/ because it uses React state + `useTranslation`

- `src/subapps/procurement/components/AwardReasonDialog.tsx` (~130 lines):
  - 8 CATEGORIES: `better_delivery`, `better_quality`, `existing_relationship`, `certifications`, `inclusions`, `stock_availability`, `past_consistency`, `other`
  - `other` category requires non-empty note
  - `DialogDescription` visible only when awarding over a cheaper option
  - Props: `open`, `entry`, `cheapestEntry`, `onConfirm(category, note)`, `onCancel`

### Modified (4)

- `src/subapps/procurement/components/ComparisonPanel.tsx`:
  - `onAward(winnerQuoteId, overrideReason)` → `onAwardIntent(entry: QuoteComparisonEntry)`
  - `winnerQuoteId?: string | null` prop added
  - `ComparisonRow`: `isWinner = winnerQuoteId === entry.quoteId`; emerald-50/60 bg for winner; Trophy icon for winner OR rank===1; lockedBadge label when isWinner
  - `rfqAwarded={!!effectiveWinnerId}` prevents double-award during optimistic state

- `src/app/procurement/rfqs/[id]/RfqDetailClient.tsx`:
  - `handleAward` renamed → `onFireAward`
  - `useAwardFlow` wired with `comparison ?? null`, `rfq?.winnerQuoteId ?? null`, `onFireAward`
  - `effectiveWinnerId = optimisticWinnerId ?? rfq?.winnerQuoteId ?? null`
  - `winnerQuote` derived from `effectiveWinnerId`
  - Winner banner in comparison tab: CheckCircle2 + vendor name + total + disabled Create PO CTA
  - `AwardReasonDialog` rendered outside `<Tabs>` (portal behavior)
  - Imports added: `CheckCircle2`, `formatCurrency`, `useAwardFlow`, `AwardReasonDialog`

- `src/i18n/locales/el/quotes.json` + `en/quotes.json`:
  - Added `rfqs.award.*` (8 keys): `lockedBadge`, `successToast`, `undoButton`, `undoneToast`, `errorToast`, `errorRetry`, `winnerBanner.title`, `createPO`
  - Added `rfqs.awardReason.*` (24 keys): `dialog.title/body`, `label.category/note/noteRequired`, `placeholder.note.*` (8 placeholders), `category.*` (8 categories), `cancelButton`, `confirmButton`

- `adrs/ADR-328-rfq-detail-contacts-layout.md`: Phase 8 changelog row added

## Deviations from ADR spec

- **`quote-award-service.ts` → `useAwardFlow.ts`** — placed in hooks/ (React state + useTranslation). Spec named it a service.
- **Cheapest detection uses `entry.flags.includes('cheapest')`** — comparison engine already flags entries; more accurate than recalculating with `quote-cheapest.ts`. The utility is retained for Phase 9 versioning.
- **Undo for first award disabled** — no API endpoint for clear-award. Undo shown only when `prevId` (previous winner) is non-null.
- **Create PO button disabled** — Phase 8 scope is detection + CTA placeholder. PO creation flow is Phase 12+.

## Verification status

Per §7.12 validation checklist:
- [ ] Award cheapest → no reason modal, optimistic + Undo snackbar — **needs manual QA**
- [ ] Award non-cheapest → reason modal first, then optimistic + Undo — **needs manual QA**
- [ ] Header banner appears with «Δημιουργία Εντολής Αγοράς» CTA — **needs manual QA**
- [ ] Concurrent test: simulate stale write → ConflictDialog from Phase 5 fires — **needs manual QA**
- [ ] TypeScript: no new errors — **not yet run; tsc --noEmit recommended**

## Files modified / created

### Modified (6)
- `src/subapps/procurement/components/ComparisonPanel.tsx`
- `src/app/procurement/rfqs/[id]/RfqDetailClient.tsx`
- `src/i18n/locales/el/quotes.json`
- `src/i18n/locales/en/quotes.json`
- `adrs/ADR-328-rfq-detail-contacts-layout.md` (changelog Phase 8 row)

### Created (4)
- `src/subapps/procurement/utils/quote-cheapest.ts`
- `src/subapps/procurement/hooks/useAwardFlow.ts`
- `src/subapps/procurement/components/AwardReasonDialog.tsx`
- `.claude-rules/adr-328-handoff-after-phase-8.md`

## Required reads for Phase 9

- This handoff (`.claude-rules/adr-328-handoff-after-phase-8.md`)
- Phase 7 handoff (`.claude-rules/adr-328-handoff-after-phase-7.md`) for sort/search context
- ADR §7.13 Phase 9: Versioning
- ADR §5.AA (versioning spec)
- `src/subapps/procurement/services/quote-versioning-service.ts` — Phase 5 scaffolding, must be extended (not forked)
- `src/subapps/procurement/utils/quote-cheapest.ts` — `cheapestEligibleQuote()` needed for Phase 9 dedup logic

## Phase 9 scaffolding already present (Phase 5)

- `quote-versioning-service.ts` — `ConflictError`, `assertVersionMatches`, `nextVersionFields`, `runVersionedUpdate`; needs `supersede()`, `revertSupersede()`, `createRevision()` added
- `ConflictDialog.tsx` — generic conflict dialog, already wired
- `useLiveChangeToasts.ts` — live change toasts, already wired

## Suggested model for Phase 9

- **Sonnet 4.6** — 3-4 new files (~80+30+120+badge lines) + versioning-service extend + QuoteList badge modification

## Pending Giorgio decisions

- Manual QA of Phase 7 sort+search and Phase 8 award flow before Phase 9
- Phase 5 scaffolding verification: confirm `ConflictDialog`, `useLiveChangeToasts` not swept
- `?status=` URL state for QuickFilters: deferred from Phase 7 — accept or add in Phase 12 cleanup?
