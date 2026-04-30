# ADR-328 Handoff — After Phase 9: Quote Duplicate Detection + Versioning

**Date:** 2026-04-30
**Phase completed:** 9 (Versioning, §5.AA)
**Phase next:** 10 (Expiration + Async Scan UX, §5.BB / §5.H)

## What was built

### New files (3)

- `src/lib/string/fuzzy-greek.ts` (~32 lines):
  - `fuzzyEqualGreek(a, b, maxDistance?)` — Levenshtein ≤ 2 after `normalizeSearchText`
  - Handles Greek diacritics + final sigma via normalizeSearchText

- `src/subapps/procurement/utils/quote-duplicate-detection.ts` (~70 lines):
  - `DuplicateConfidence`, `DuplicateSignal`, `DuplicateDetectionResult` types
  - `detectDuplicate(newQuote, existingActive)` — multi-signal matching
  - Email (lowercased), taxId (exact), name (fuzzyEqualGreek ≤ 2)
  - Confidence: high (email+taxId), medium (email OR taxId), low (name only)
  - Tie-break: highest confidence wins; ties → most recent submittedAt

- `src/subapps/procurement/components/QuoteRevisionDetectedDialog.tsx` (~115 lines):
  - Medium/low confidence dialog per §5.AA.3
  - 3 options: `revision` / `separate` / `cancel_import`
  - Blocks `revision` if `existingQuote.linkedPoId` is set (PO exists)
  - Shows yellow warning if existing is `accepted` (winner)
  - Props: `open`, `detection`, `existingQuote`, `newQuote`, `onConfirm(decision)`, `onCancel`

### Extended (3)

- `src/subapps/procurement/services/quote-versioning-service.ts` (+100 lines):
  - `supersede(oldQuoteId, newQuoteId, userId)` — marks old as `superseded`, promotes new to v(N+1), stores `_previousStatus`
  - `revertSupersede(oldQuoteId, newQuoteId, userId)` — restores old status, clears version chain on new
  - `createRevision(baseQuoteId, newQuoteId, mutator, userId)` — copies base doc + mutator + supersedes atomically

- `src/subapps/procurement/types/quote.ts`:
  - `superseded` added to `QuoteStatus` union + `QUOTE_STATUSES` + `QUOTE_STATUS_TRANSITIONS` + `QUOTE_STATUS_META`
  - Versioning fields added to `Quote`: `version?`, `previousVersionId?`, `supersededBy?`, `supersededAt?`, `_previousStatus?`

### Modified (5)

- `src/subapps/procurement/hooks/useQuotes.ts`:
  - New `options: { includeSuperseded?: boolean }` second param
  - Client-side filter via `filterSupersededRef` — default false (excludes superseded per §5.AA.7)

- `src/subapps/procurement/utils/quote-sort.ts`:
  - `superseded: 9` added to `STATUS_PRIORITY` (always last)

- `src/domain/cards/quote/QuoteListCard.tsx`:
  - `superseded: 'secondary'` added to `STATUS_BADGE_VARIANTS`
  - `hasOlderVersions`, `isVersionExpanded`, `onVersionToggle` props
  - Version badge `v{n}` shown when `quote.version > 1` (info variant)
  - Collapsible chevron toggle (ChevronDown/ChevronRight)

- `src/subapps/procurement/components/QuoteList.tsx`:
  - `SupersededVersionRow` local component (muted dashed border, history icon, version + total + date)
  - `supersededByParentId: Map<string, Quote[]>` — superseded quotes grouped by `supersededBy`
  - `expandedVersions: Set<string>` state + `toggleVersionExpand` callback
  - `rfqSorted` now filters out `status === 'superseded'` before sort
  - rfqGroups + rfqSorted render paths both pass version props + render superseded rows when expanded

- `src/app/procurement/rfqs/[id]/RfqDetailClient.tsx`:
  - `useQuotes(..., { includeSuperseded: true })` — fetches all quotes
  - `activeQuotes` derived (`status !== 'superseded'`) — used for: `useRfqUrlState`, `deriveSetupLockState`, `winnerVendorName`, `underReviewCount`, `recommendationPending`, `buildRfqDashboardStats`, `ComparisonEmptyState`
  - Full `quotes` (including superseded) passed to `QuoteList` for version display

- `src/i18n/locales/el/quotes.json` + `en/quotes.json`:
  - Added `rfqs.versioning.*` (9 keys): toast, undo, badge, tooltip, expand/collapse, supersededLabel
  - Added `rfqs.revisionDialog.*` (16 keys): title, body, vendor, signals, options (3), confirm, signals (3), warnings (2)

- `adrs/ADR-328-rfq-detail-contacts-layout.md`: Phase 9 changelog row added

## Deviations from ADR spec

- **High-confidence auto-version toast + undo NOT wired to UI** — the trigger point is the quote creation/scan flow (when a new quote arrives, call `detectDuplicate` and fire `supersede` or show dialog). This trigger point lives in the scan/QuoteForm completion handlers, which are outside Phase 9 scope. Phase 9 ships the complete service layer + detection + dialog + display — wiring to quote creation is Phase 10+ scope (or a targeted Phase 10a).
- **`createRevision` not wired to UI** — §5.AA.9 manual revision via quote header overflow menu is Phase 11 (quote header actions). The Firestore transaction is ready.
- **`_previousStatus` not in QuoteStatus typespace** — stored as internal Firestore field cast at service layer; TypeScript interface marks it as `_previousStatus?: QuoteStatus` (private convention, not public API).

## Verification status

Per §7.13 validation checklist:
- [ ] Scan duplicate (same email + taxId) → auto-version + Undo toast — **needs integration wiring (scan completion handler)**
- [ ] Scan with only name fuzzy match → modal asks user — **needs integration wiring**
- [ ] Scan with PO → blocked with explanatory modal — **QuoteRevisionDetectedDialog blocks hasPO = true**
- [ ] Older versions hidden by default; expandable via chevron — **implemented, needs manual QA**
- [ ] TypeScript: no new errors — **not yet run; tsc --noEmit recommended**

## Files modified / created

### Created (3)
- `src/lib/string/fuzzy-greek.ts`
- `src/subapps/procurement/utils/quote-duplicate-detection.ts`
- `src/subapps/procurement/components/QuoteRevisionDetectedDialog.tsx`
- `.claude-rules/adr-328-handoff-after-phase-9.md`

### Modified (8)
- `src/subapps/procurement/types/quote.ts`
- `src/subapps/procurement/services/quote-versioning-service.ts`
- `src/subapps/procurement/hooks/useQuotes.ts`
- `src/subapps/procurement/utils/quote-sort.ts`
- `src/domain/cards/quote/QuoteListCard.tsx`
- `src/subapps/procurement/components/QuoteList.tsx`
- `src/app/procurement/rfqs/[id]/RfqDetailClient.tsx`
- `src/i18n/locales/el/quotes.json`
- `src/i18n/locales/en/quotes.json`
- `adrs/ADR-328-rfq-detail-contacts-layout.md`

## Required reads for Phase 10

- This handoff
- ADR §7.14 Phase 10: Expiration + Async Scan UX
- ADR §5.BB (expiration spec), §5.H (async scan UX)
- `src/subapps/procurement/utils/quote-cheapest.ts` — eligibleForComparison needed for expiration checks

## Phase 10 scaffolding present

- `quote-cheapest.ts` — `eligibleForComparison()` usable for expiration logic
- `useQuotes` now accepts `includeSuperseded` — no changes needed for Phase 10

## Pending integration (Phase 10+)

1. Wire `detectDuplicate` into scan completion handler + QuoteForm `onSuccess`
2. Wire `supersede()` for high-confidence path → toast + Undo action calls `revertSupersede()`
3. Wire `QuoteRevisionDetectedDialog` for medium/low path
4. Wire `createRevision()` into quote header overflow menu (Phase 11)

## Suggested model for Phase 10

- **Sonnet 4.6** — 3-4 new files (~50+80+100+80 lines) + QuoteList expiration badges modification
