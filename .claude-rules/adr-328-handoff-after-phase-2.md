# ADR-328 Handoff — After Phase 2: Quotes Tab Split Layout

**Date:** 2026-04-30
**Phase completed:** 2 (Quotes Tab Split Layout — desktop + mobile navigated)
**Phase next:** 3 (per §7, next session reads §7.7)

## What was built

- `src/app/procurement/rfqs/[id]/RfqDetailClient.tsx` — Tab 1 now has `md:grid md:grid-cols-[380px_1fr] md:gap-4` split layout. `QuoteList` receives `onSelectQuote={handleSelectQuote}` + `selectedQuoteId={selectedQuote?.id}`. Right pane renders `QuoteDetailsHeader` + `QuoteDetailSummary` when `selectedQuote !== null`. Mobile navigated pattern: `cn(selectedQuote ? 'hidden md:block' : 'block')` on list div, `cn(selectedQuote ? 'block' : 'hidden md:block')` on aside. Mobile back button (ArrowLeft) calls `handleSelectQuote(null)`. Desktop empty state: `hidden md:flex` hint text.
- `src/subapps/procurement/hooks/useRfqUrlState.ts` — added `useIsMobile` import + `isMobile` detection. `handleSelectQuote` now mobile-aware: `push` on mobile (back-gesture), `replace` on desktop (no history clutter). Self-correction `useEffect` with `correctedRef` (fires once when `quotesLoading` transitions to false, corrects stale `?quote=` param via `router.replace`, resets on re-fetch).
- `src/i18n/locales/el/quotes.json` — added `rfqs.mobile.backToList` + `rfqs.selectQuoteHint`
- `src/i18n/locales/en/quotes.json` — same keys in English

## What was NOT built (deferred)

- `handleViewQuote` removed — old `router.push(.../review)` pattern replaced by inline detail. If deep-link to review page is still needed elsewhere, it's available via `QuoteDetailsHeader` actions (onEdit etc.).
- Tab 2 / Tab 3 content unchanged — full-width, no split layout needed.
- `QuoteForm` still shows above the split grid when `showQuoteForm === true` — no layout change there.

## Deviations from ADR spec

- None for Phase 2. §5.E.2 code snapshot followed exactly. §5.E.4 mobile-aware navigation implemented. §5.E.5 i18n keys added.

## Known issues / TODOs

- `QuoteDetailsHeader` actions (onEdit, onArchive, onCreateNew) are not wired in `RfqDetailClient` yet — they render as disabled / hidden stubs per `QuoteDetailsHeader` default behavior. Phase 3+ will wire them.
- The `container mx-auto max-w-5xl` constraint on `<main>` means the split layout is capped at ~1024px. The 380px list + 16px gap leaves ~628px for the detail pane. Sufficient for Phase 2; revisit if detail pane needs more width.
- Self-correction `useEffect` has deps `[quotesLoading, selectedQuote, quoteParam, searchParams, pathname, router]` — ESLint may warn about exhaustive-deps. The `correctedRef` guard prevents infinite loops. If ESLint fires, add `// eslint-disable-next-line react-hooks/exhaustive-deps` on the dep array line.

## Verification status

- [ ] Desktop: list left (380px), detail pane right — visible simultaneously
- [ ] Click quote in list → detail pane opens inline (NO navigation away)
- [ ] `?quote=` URL updates (router.replace on desktop)
- [ ] Refresh with `?quote=xyz` → correct quote loads in detail pane
- [ ] Mobile: only list visible initially (no selected quote)
- [ ] Mobile: click quote → only detail pane visible
- [ ] Mobile: back button (ArrowLeft) → returns to list
- [ ] Mobile: browser back gesture → returns to list (push in history)
- [ ] TypeScript: no new errors
- [ ] QuoteList card highlights selected quote (`isSelected` prop)

## Required reads for next session

- ADR §7.7 Phase 3 spec
- `.claude-rules/adr-328-handoff-after-phase-2.md` (this file)
- `src/app/procurement/rfqs/[id]/RfqDetailClient.tsx` (current state)
- `src/subapps/procurement/hooks/useRfqUrlState.ts` (current state)

## Suggested model for next session

- **Sonnet 4.6** (unless Phase 3 spans 5+ files — re-evaluate per §7.7 scope)

## Pending Giorgio decisions

- (none) — Phase 2 architecture decisions all resolved per ADR spec
