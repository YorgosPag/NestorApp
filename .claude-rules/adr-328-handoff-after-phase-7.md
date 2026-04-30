# ADR-328 Handoff — After Phase 7: Smart Sort + Pattern-Aware Search

**Date:** 2026-04-30
**Phase completed:** 7 (Sort + Search, §5.P / §5.U / §5.W)
**Phase next:** 8 (Award Flow, §7.12) — depends on Phase 5 ✓ and Phase 7 ✓

## What was built

### New files (2)

- `src/subapps/procurement/utils/quote-sort.ts` (~85 lines):
  - `STATUS_PRIORITY: Record<QuoteStatus, number>` — 8 statuses (accepted=1 … archived=8)
  - `SortKey` type + `VALID_SORT_KEYS` + `DEFAULT_SORT_KEY = 'status-price'`
  - `sortQuotes(quotes, sortKey)` — pure sort function (5 keys)
  - `groupByStatus(sortedQuotes): QuoteGroup[]` — contiguous run grouping for dividers
  - Private helpers: `compareByPrice`, `compareByPriceDesc`, `compareByRecency`, `compareByVendor`
  - `toMs()` helper handles both Firestore Timestamp (`.toMillis()`) and serialized `{ seconds }` objects

- `src/subapps/procurement/utils/quote-search.ts` (~100 lines):
  - `detectPattern(query): SearchPattern` — priority: quote-number → date → numeric → free-text
  - `matchesQuote(quote, query): boolean` — entry point (empty query = true)
  - Quote-number: case-insensitive substring on `displayNumber`
  - Date: DD/MM/YYYY or YYYY-MM-DD → `isSameDay` against `submittedAt` / `createdAt`
  - Numeric: strips €/$ → compares `Math.round(totals.subtotal)` + `Math.round(totals.total)`
  - Free-text: multi-token AND logic, searches vendor/lines/paymentTerms/deliveryTerms/warranty/notes
  - Uses `normalizeSearchText` from `@/lib/search/search` (Greek diacritics + final sigma)

### Modified (3)

- `src/subapps/procurement/components/QuoteList.tsx` (~315 lines):
  - `isRfqMode = !!onSelectQuote` — gates two computation paths
  - **RFQ mode** (new): `useSearchParams`/`useRouter`/`usePathname` → URL sort (`?sort=`) + URL search (`?q=`); `sortQuotes()` + `groupByStatus()`; `<Select>` sort dropdown below CompactToolbar; search empty state with suggestions; group dividers for `status-price` key
  - **Standalone mode** (unchanged): `useSortState` + local `searchTerm`; "Requires Action" pinning; no URL state
  - CompactToolbar `onSearchChange` wired to `handleUrlSearchChange` in RFQ mode
  - `itemCount` in GenericListHeader reflects `rfqSorted.length` / `standaloneSorted.length` correctly

- `src/i18n/locales/el/quotes.json`: added `rfqs.sort.*` (7 keys) + `rfqs.search.*` (6 keys) — 13 new keys
- `src/i18n/locales/en/quotes.json`: same 13 keys in English

## Deviations from ADR spec

- **`?status=` URL persistence deferred** — ADR §5.W.1 mentions `?status=<value>` URL state for QuoteStatusQuickFilters, but §7.11 Phase 7 deliverables only specify sort+search URL. Status chips remain local state (`selectedStatuses: useState`). Deferrable to Phase 12 cleanup or a targeted PR.
- **`totals.subtotal`/`totals.total` instead of `netTotal`/`grandTotal`** — ADR §5.U.1 references `quote.totals.netTotal`/`grandTotal` which don't exist in the Quote type; mapped to `subtotal` (pre-VAT) and `total` (with VAT).
- **`STATUS_PRIORITY` extended to 8 statuses** — ADR §5.P.2 shows only 5 (accepted/under_review/submitted/draft/rejected). Added `sent_to_vendor=4`, `expired=7`, `archived=8` to cover the full `QuoteStatus` union type.

## Verification status

Per §7.11 validation checklist:
- [ ] Default sort is `status-price` with group dividers — **needs manual QA** (RFQ detail tab Προσφορές)
- [ ] Switching sort updates URL via `replace` — **needs manual QA** (check ?sort= in address bar)
- [ ] Search «12500» → matches by price; «Q-2026» → by quote number; «boiler» → free text — **needs manual QA**
- [ ] No matches → empty state with suggestions — **needs manual QA** (type nonexistent vendor name)
- [ ] Refresh preserves sort + search — **needs manual QA** (F5 after setting sort+search)
- [ ] TypeScript: no new errors — **not yet run; tsc --noEmit recommended**
- [ ] Pre-commit hook (i18n ratchet, ssot ratchet, file size) — runs on commit; expected pass

## Files modified / created

### Modified (3)
- `src/subapps/procurement/components/QuoteList.tsx`
- `src/i18n/locales/el/quotes.json`
- `src/i18n/locales/en/quotes.json`
- `adrs/ADR-328-rfq-detail-contacts-layout.md` (changelog Phase 7 row)

### Created (3)
- `src/subapps/procurement/utils/quote-sort.ts`
- `src/subapps/procurement/utils/quote-search.ts`
- `.claude-rules/adr-328-handoff-after-phase-7.md`

## Required reads for Phase 8

- This handoff (`.claude-rules/adr-328-handoff-after-phase-7.md`)
- ADR §7.12 Phase 8: Award Flow + Reason Capture
- ADR §5.F (award flow spec), §5.X (reason capture)
- `src/subapps/procurement/utils/quote-sort.ts` — `sortQuotes()` needed for «cheapest» detection in Phase 8

## Phase 8 scaffolding already present (Phase 5)

- `ConflictDialog.tsx` — `src/subapps/procurement/components/ConflictDialog.tsx`
- `useLiveChangeToasts.ts` — `src/subapps/procurement/hooks/useLiveChangeToasts.ts`
- `quote-versioning-service.ts` — `src/subapps/procurement/services/quote-versioning-service.ts`

These are dead code until Phase 8 wires them into the award flow.

## Suggested model for Phase 8

- **Sonnet 4.6** — 2 new files (~100+150 lines) + ComparisonPanel + RfqDetailClient modifications

## Pending Giorgio decisions

- Manual QA of sort+search before Phase 8
- Phase 5 scaffolding verification: confirm `ConflictDialog`, `useLiveChangeToasts` not swept by other agents
- `?status=` URL state for QuickFilters: accept as deferred or add in Phase 8?
