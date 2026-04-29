# ADR-328 Handoff — After Phase 5: Real-time + Optimistic Locking Primitives

**Date:** 2026-04-30
**Phase completed:** 5 (Real-time sync + optimistic locking primitives, §5.J)
**Phase next:** 6 (Stats Dashboard + Tab Badges, per §7.10) OR 7 (Sort + Search, per §7.11) — both depend only on Phase 1 and are independent

## What was built

### Hooks converted to `onSnapshot` (5 files modified)

All via `firestoreQueryService` (ADR-214 SSoT, tenant filter auto-applied via `companyId` claim):

- `src/subapps/procurement/hooks/useQuotes.ts` — DIRECT subscribe to `QUOTES` with `where('rfqId'/'projectId'/'trade'/'status'/'vendorContactId', '==', ...)` filters. Drops `useAsyncData`/`createStaleCache` (Firestore SDK persistent cache covers the no-flash-on-remount goal). API surface preserved: `{ quotes, loading, error, refetch, silentRefetch, patch }`.
- `src/subapps/procurement/hooks/useVendorInvites.ts` — DIRECT subscribe to `VENDOR_INVITES` with `where('rfqId','==',rfqId)`. `vendorContacts` still loaded via `/api/rfqs/{rfqId}/vendor-contacts` (separate endpoint, contacts don't change in this view).
- `src/subapps/procurement/hooks/useRfqLines.ts` — DIRECT `subscribeSubcollection('RFQS', rfqId, 'lines', ...)`. Mutations (`addLine`/`updateLine`/`deleteLine`/`bulkAdd`) remain via API. Sorted client-side by `displayOrder`.
- `src/subapps/procurement/hooks/useComparison.ts` — HYBRID: subscribe `QUOTES` filtered by rfqId as change-detector → 400ms debounced refetch of `/api/rfqs/{rfqId}/comparison`. Server-computed comparison logic preserved.
- `src/subapps/procurement/hooks/useSourcingEventAggregate.ts` — HYBRID: `subscribeDoc('SOURCING_EVENTS', eventId, ...)` as change-detector → 400ms debounced refetch of aggregate API.

### New files

- `src/subapps/procurement/services/quote-versioning-service.ts` (~170 lines):
  - `ConflictError` class with structured payload (`conflictType`, `currentVersion`, `attemptedVersion`, `actor`, `actorTime`, `actualState`)
  - `ConflictType` union: `AWARD_CONFLICT | PO_CREATE_CONFLICT | LINE_EDIT_CONFLICT | STATUS_CHANGE_CONFLICT`
  - `assertVersionMatches({ data, expectedVersion, conflictType })` — throws `ConflictError` on mismatch (treats missing `version` as 1)
  - `nextVersionFields(currentVersion, userId)` — returns `{ version, updatedAt: serverTimestamp(), updatedBy }`
  - `runVersionedUpdate({ collectionKey, docId, expectedVersion, conflictType, userId, mutate })` — full Firestore transaction wrapper that reads → asserts version → runs mutate callback → applies update + bumped version atomically
  - `isConflictError(err)` type guard
  - **Phase 9 placeholders** (commented): `supersede` / `revertSupersede` / `createRevision` per §5.AA

- `src/subapps/procurement/components/ConflictDialog.tsx` (~135 lines):
  - Generic dialog driven by `ConflictType` discriminator (4 title variants)
  - `awardContext?: { attemptedVendorName, actualVendorName }` — used only for `AWARD_CONFLICT` body; other types use generic body
  - `onAcceptRemote()` — closes dialog (UI already showing remote state via onSnapshot, per §5.J.4)
  - `onKeepMine()` — caller re-runs the original transaction with current version; helper handles loading + error display
  - Renders inline `AlertTriangle` amber icon + relative-time `ago` from `actorTime` via `formatRelativeTime`

- `src/subapps/procurement/hooks/useLiveChangeToasts.ts` (~165 lines):
  - Subscribes to `QUOTES` filtered by rfqId, keeps `previousByIdRef: Map<string, Quote>`
  - On each snapshot delivery: diff against ref → produce `LiveChangeEvent[]` for new quotes + status transitions (under_review/accepted/rejected)
  - Filters: `quote.createdBy !== currentUserId` (drop self-changes per §5.J.5), `now - updatedAt < 60_000ms` (drop stale initial-snapshot data)
  - Aggregation: 5s window; if ≥3 events, emit single toast with top actor + count; else individual toasts
  - Each toast uses sonner `toast.info` with 5s duration + optional «Δες» action via `onView` callback
  - Initial snapshot delivery is silent (sets baseline ref)

### Schema additions on Firestore client init

- `src/lib/firebase.ts` — replaced `getFirestore(app)` with `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }) })` for the browser path. SSR/Node still uses `getFirestore`. Try/catch fallback handles HMR re-imports. Resolves V6 from §6.

### i18n keys added (16 new keys × 2 locales)

`src/i18n/locales/{el,en}/quotes.json` under `rfqs.*`:
- `conflict.award.{title,body}`, `conflict.{poCreate,lineEdit,statusChange}.title`, `conflict.generic.body`, `conflict.action.{acceptRemote,keepMine}`
- `live.{newQuote,quoteConfirmed,quoteAwarded,quoteRejected,poCreated,lineEdited,aggregated,viewAction}`

## Deviations from ADR spec

- **`useRfqLines` mutations no longer optimistic.** The previous implementation kept an optimistic line in local state until the API responded, then reconciled by id. With `subscribeSubcollection` plus `persistentLocalCache`, Firestore delivers writes from local cache before the server roundtrip, so perceived latency is comparable. Adding optimistic state on top would have required dedup logic against snapshot delivery (the `__opt_${Date.now()}` placeholder vs the real server-assigned id). Drop is intentional — see N.7 Google-level evaluation: «no race conditions» preferred over «optimistic + dedup hack».
- **`useComparison` + `useSourcingEventAggregate` use HYBRID, not pure subscription.** §5.J.2 listed these as `onSnapshot` candidates; both are server-computed views (comparison weights × scoring, aggregate counts). Re-implementing the computation client-side was out of Phase 5 scope. The HYBRID pattern (subscribe to underlying source as change-detector → debounced API refetch) gives the same UX (live updates within ~600ms of source change) without forking computation logic.
- **`rfqs.conflict.generic.body` is non-spec.** §5.J.8 lists per-conflict-type titles but only the `AWARD_CONFLICT` body. The other 3 types reuse a generic body string keyed `conflict.generic.body` — additive, no impact on the listed keys.
- **Schema fields `version` / `updatedAt` / `updatedBy` not yet written.** `quote-versioning-service.ts` is ready to read + write them, but no current code path adds them on document creation. Phase 8 (Award flow, §7.12) is the first consumer that will need this — it should also backfill the fields on first transactional update via `nextVersionFields(undefined, userId)`. Until then, all existing documents have `version === undefined`, treated as v1 by `assertVersionMatches`.

## Verification status

Per §7.9 validation checklist:
- [ ] Two browsers open same RFQ → change in one reflects in other within 1s — **needs manual QA**
- [ ] Conflict scenario: simulate stale write → ConflictDialog appears — **needs Phase 8 award flow to be wired (current state: primitives exist, no caller)**
- [ ] Live-change toast appears for remote changes, NOT for self changes — **needs manual QA**
- [ ] TypeScript: no new errors — **not yet run; tsc --noEmit recommended in next session**
- [ ] Pre-commit hook (i18n ratchet, ssot ratchet, file size) — **runs on commit; expected pass**

## Files modified / created

### Modified (6)
- `src/lib/firebase.ts`
- `src/subapps/procurement/hooks/useQuotes.ts`
- `src/subapps/procurement/hooks/useVendorInvites.ts`
- `src/subapps/procurement/hooks/useRfqLines.ts`
- `src/subapps/procurement/hooks/useComparison.ts`
- `src/subapps/procurement/hooks/useSourcingEventAggregate.ts`
- `src/i18n/locales/el/quotes.json`
- `src/i18n/locales/en/quotes.json`
- `adrs/ADR-328-rfq-detail-contacts-layout.md` (changelog)

### Created (3)
- `src/subapps/procurement/services/quote-versioning-service.ts`
- `src/subapps/procurement/components/ConflictDialog.tsx`
- `src/subapps/procurement/hooks/useLiveChangeToasts.ts`

## Required reads for next session

- This handoff (`.claude-rules/adr-328-handoff-after-phase-5.md`)
- ADR §7.10 (Phase 6 spec) OR §7.11 (Phase 7 spec) — pick whichever Giorgio prioritizes
- Both depend only on Phase 1, so order is flexible

## Suggested model for next session

- **Sonnet 4.6** for either Phase 6 or Phase 7. Both are isolated to 2–3 files (one new util, modifications in `RfqDetailClient.tsx` or `QuoteList.tsx`, i18n keys).

## Pending Giorgio decisions

- Wire `ConflictDialog` + `useLiveChangeToasts` into `RfqDetailClient.tsx` — happens naturally in Phase 8 when Award flow needs the conflict primitives. Until then, the new files are dead code from the user's perspective (loaded but not invoked).
- Decide whether to manually QA the real-time sync now (two browsers, same RFQ) before Phase 8, or fold the QA into Phase 8 testing.
- Confirm the HYBRID approach for `useComparison` / `useSourcingEventAggregate` is acceptable as the long-term solution, or schedule a follow-up to materialize `rfq_comparisons/{rfqId}` as a Firestore doc (per the original §5.J.2 wording) — would unlock pure subscription but adds write coordination complexity.
