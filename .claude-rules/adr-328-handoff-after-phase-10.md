# ADR-328 Phase 10 Handoff — Expiration + Async Scan UX

**Date:** 2026-04-30
**Phase:** 10 of 15
**Status:** COMPLETE — commit pending

---

## What was built

### New files
| File | Lines | Purpose |
|------|-------|---------|
| `src/subapps/procurement/utils/quote-expiration.ts` | ~60 | Pure expiration helpers: `isExpired`, `daysUntilExpiry`, `expiryBadgeState`, `formatValidUntilDate` |
| `src/subapps/procurement/hooks/useScanQueue.ts` | ~100 | Async scan state: enqueue→poll→stage progression, grouped Sonner toast |
| `src/subapps/procurement/components/ExpiredAwardWarningDialog.tsx` | ~60 | Award gate modal (expired quote: request_renewal / award_anyway / cancel) |
| `src/subapps/procurement/components/QuoteRenewalRequestDialog.tsx` | ~100 | Email composer for renewal requests (stub send) |

### Modified files
| File | Change |
|------|--------|
| `src/subapps/procurement/hooks/useAwardFlow.ts` | Added `quotes?` option, `pendingExpiredEntry` state, `proceedWithAward` helper, `handleExpiredDialogAction` |
| `src/subapps/procurement/components/QuoteList.tsx` | Added scan placeholder props + `ScanPlaceholderRow` component (492 lines, under 500) |
| `src/subapps/procurement/components/QuoteDetailsHeader.tsx` | Added `onRequestRenewal` prop + amber expiry banner |
| `src/domain/cards/quote/QuoteListCard.tsx` | Added `expiryBadge` useMemo (expired/expiring_soon states) |
| `src/app/procurement/rfqs/[id]/RfqDetailClient.tsx` | Wired all above: useScanQueue, ExpiredAwardWarningDialog, QuoteRenewalRequestDialog, renewalQuoteId state, pendingExpiredQuote memo (472 lines) |
| `src/i18n/locales/el/quotes.json` | Added `rfqs.expiry.*` (15 keys) + `rfqs.scan.*` (12 keys) |
| `src/i18n/locales/en/quotes.json` | Same keys, English values |

---

## Key design decisions

- **`expired` is NOT a QuoteStatus** — it is derived at render time from `validUntil < now`. Firestore status field is never mutated by expiration logic. Canonical §5.BB invariant.
- **`expiryBadgeState`** has 7-day threshold for `expiring_soon`. Badge renders in `QuoteListCard` — list entry gives immediate visual signal.
- **`useScanQueue`** is client-only state (browser refresh clears, per §5.H.5). Grouped toast uses stable Sonner ID `'scan-queue'` — replaces itself while multiple scans run.
- **`proceedWithAward` extracted** in `useAwardFlow` so both the normal flow and the `'award_anyway'` expired override path share the same cheapest-check + dialog logic.

---

## Known gaps / deviations (carry to Phase 11)

### V15 gap — renewal email send
`QuoteRenewalRequestDialog.onSend` is a stub. It closes the dialog but does NOT send the email. Actual send requires a new API route (e.g. `POST /api/quotes/{id}/request-renewal`). Phase 11 or dedicated V15 session should wire this.

### Scan retry not wired end-to-end
`useScanQueue` exposes `retry(clientId)` and `remove(clientId)`. `ScanPlaceholderRow` accepts `onRetry`/`onRemove` props. But in `RfqDetailClient`, `onRetryScan={scanQueue.retry}` passes the retry function. `onRemoveScan={scanQueue.remove}` passes remove. These ARE wired correctly. The deviation noted in the ADR changelog was incorrect — both are wired.

### `createRevision` UI not yet wired
Phase 9 deviation: quote header overflow menu (Phase 11 scope) needed to expose manual revision trigger.

---

## Phase 11 context

Phase 11 = **Quote Create/Edit Form** (§7.14 in ADR-328 §7). Scope includes:
- Quote header overflow menu (⋮) with: Edit / Request Revision (wires `createRevision`) / Archive / Copy / Request Renewal → opens `QuoteRenewalRequestDialog` with the actual send API
- The renewal send API (`POST /api/quotes/{id}/request-renewal`) should be built alongside the overflow menu

Next file to read when starting Phase 11:
- `adrs/ADR-328-rfq-detail-contacts-layout.md` §7.14 (Phase 11 spec)
- `src/app/procurement/rfqs/[id]/RfqDetailClient.tsx` (current state, 472 lines)
- `src/subapps/procurement/components/QuoteDetailsHeader.tsx` (will gain overflow menu)

---

## Do NOT do in Phase 11

- Do NOT auto-flip `quote.status` to `'expired'` — §5.BB invariant
- Do NOT add `validUntil` server-side auto-expiry — derived state only
- Do NOT break `useScanQueue` grouped toast pattern — it uses stable `'scan-queue'` ID
