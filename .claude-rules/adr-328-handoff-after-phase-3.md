# ADR-328 Handoff — After Phase 3: Comparison Tab Empty States + Drill-Down

**Date:** 2026-04-30
**Phase completed:** 3 (Comparison Tab — empty states 0/1 quote + row drill-down)
**Phase next:** 4 (Setup Tab lock state + banner — §7.8)

## What was built

- `src/subapps/procurement/components/ComparisonEmptyState.tsx` — NEW (~85 lines). Props: `quotes, onNewQuote, onScan, onViewInvites, onViewQuoteDetails`. Branch: `quotes.length === 0` → BarChart3 icon + educational text + 3 CTAs (new/scan/invites). `quotes.length === 1` → same icon + threshold message + vendor card (vendorName, total, `deliveryTerms` as string, QuoteStatusBadge) + viewDetails button + 3 CTAs.
- `src/subapps/procurement/components/ComparisonPanel.tsx` — `onRowClick?: (quoteId: string) => void` added to props + `ComparisonRow`. Row gains `group cursor-pointer hover:bg-muted/50`, keyboard nav (Enter/Space), `tabIndex={0}`, `aria-label`. `ChevronRight` indicator shows on hover. Award button has `e.stopPropagation()`.
- `src/subapps/procurement/hooks/useRfqUrlState.ts` — `handleComparisonDrillDown(quoteId: string)`: single `router.push` with `?tab=quotes&quote=<id>` — one history entry (§5.D.3).
- `src/app/procurement/rfqs/[id]/RfqDetailClient.tsx` — Tab 2: `quotes.length < 2` guard → `ComparisonEmptyState`; ≥2 → `SourcingEventSummaryCard` + `ComparisonPanel` with `onRowClick={handleComparisonDrillDown}`. Import `ComparisonEmptyState` added.
- `src/i18n/locales/el/quotes.json` + `en/quotes.json` — `rfqs.comparison.rowAriaLabel` + `rfqs.comparison.empty.{zero,one}.*` + `rfqs.comparison.empty.deliveryDays` (7 keys each language).

## Deviations from ADR spec

- `rfqs.comparison.empty.deliveryDays` i18n key added but NOT used in component. `Quote.deliveryTerms` is `string | null` (free text, not numeric days), so `deliveryTerms` is displayed as-is instead of formatted "{days} ημέρες παράδοση". The i18n key is kept in locale files for future use when/if a numeric deliveryDays field is added.

## Known issues / TODOs

- `ComparisonEmptyState`: "Δες προσκλήσεις" CTA uses `t('rfqs.actions.activate')` ("Αποστολή σε Vendors") — semantically close but not a perfect label for "view invites". A dedicated key `rfqs.comparison.empty.viewInvites` would be cleaner; deferred as low priority.
- `ComparisonPanel`: existing usage at `/procurement/quotes` (if any) — `onRowClick` is optional, so no breaking change.

## Verification status

- [ ] 0 quotes: educational empty state with 3 CTAs visible
- [ ] 1 quote: summary card + threshold message + viewDetails button
- [ ] "Δες λεπτομέρειες" → switches to Quotes tab with that quote selected
- [ ] ≥2 quotes: existing comparison panel renders normally
- [ ] Click row in ComparisonPanel → switches to Quotes tab + selects quote
- [ ] ChevronRight appears on row hover
- [ ] Keyboard Enter/Space on row triggers drill-down
- [ ] Award button click does NOT trigger row drill-down (stopPropagation)
- [ ] Browser back from drill-down returns to comparison (push history)

## Required reads for next session

- ADR §7.8 Phase 4 spec + §5.G (Setup tab lock state)
- `.claude-rules/adr-328-handoff-after-phase-3.md` (this file)
- `src/app/procurement/rfqs/[id]/RfqDetailClient.tsx`
- `src/subapps/procurement/components/RfqLinesPanel.tsx` (verify lockState prop API)
- `src/subapps/procurement/components/VendorInviteSection.tsx` (verify lockState prop API)

## Suggested model for next session

- **Sonnet 4.6** (Phase 4 is ~5 files, 1 domain)

## Pending Giorgio decisions

- (none)
