# ADR-335 — RFQ Lifecycle Management

**Status:** IMPLEMENTED
**Date:** 2026-04-30
**Author:** Giorgio Pagonis
**Supersedes:** N/A
**Related:** ADR-328 §5.EE (lifecycle management out of scope, audit and deferral), ADR-327 (procurement domain)

---

## Context

ADR-328 §5.EE audits the current RFQ status field and explicitly declares lifecycle changes out of scope. The detail page used a read-only tolerance contract for `closed` and `archived` statuses. The gap identified: awarding a winner did NOT auto-transition RFQ `status` to `closed` — these were decoupled. There was also no `cancelled` status, no manual close, no reopen, and no read-only enforcement banner on the Setup tab beyond the award lock.

## Design decisions

**Q1 — Auto-close on award:** RFQ status auto-transitions to `closed` when a winner is awarded (`winnerQuoteId` set). No manual step required. Already implemented inside `awardRfq()` at `comparison-service.ts:460`. Industry standard: Primavera Unifier, Procore, SAP Ariba, Linear all auto-close on award.

**Q2 — Cancellation:** Context-dependent:
- **Draft RFQ** → cancellation is allowed without reason (no notifications, no audit detail).
- **Active RFQ** → reason mandatory (enum `RfqCancellationReason`) + optional vendor notification flag (`cancellationNotifiedVendors`).
- New `cancelled` status added to schema. Reason stored as `cancellationReason: RfqCancellationReason | null`, optional free-text in `cancellationDetail`. Server records `cancelledAt` + `cancelledBy`.
- Pattern: Procore (state-dependent) + Primavera (mandatory reason when active) + mirrors PO cancellation pattern (`POCancellationReason`).

**Q3 — Reopen closed RFQ:** Conditional:
- **No PO exists** → Reopen freely (one-click, status back to `active`, `winnerQuoteId` cleared). Audit entry `reopened` written.
- **PO exists** → Reopen blocked with HTTP 409 `PO_EXISTS`. UI surfaces clear toast: «Ακύρωσε πρώτα την Παραγγελία Αγοράς». PO cancellation unlocks Reopen (the check filters out `cancelled` POs).
- Pattern: Procore (PO-gated reopen) + SAP Ariba (free reopen without contract).

## Implementation

### Schema changes (`src/subapps/procurement/types/rfq.ts`)

- `RfqStatus` extended: `'draft' | 'active' | 'closed' | 'cancelled' | 'archived'`.
- `RFQ_STATUS_TRANSITIONS` updated:
  - `draft` → `active | cancelled | archived`
  - `active` → `closed | cancelled | archived`
  - `closed` → `active (reopen) | archived`
  - `cancelled` → `archived`
  - `archived` → `[]`
- New helpers: `RFQ_LIFECYCLE_LOCKED_STATUSES` (set of read-only statuses), `RfqCancellationReason` (enum), `RFQ_CANCELLATION_REASONS` (tuple).
- New optional fields on `RFQ`: `cancellationReason`, `cancellationDetail`, `cancelledAt`, `cancelledBy`, `cancellationNotifiedVendors`.

### Service (`src/subapps/procurement/services/rfq-lifecycle-service.ts` — NEW)

Module split out of `rfq-service.ts` to respect 500-line file budget (Google SRP).

- `cancelRfq(ctx, rfqId, options)` — validates transition + reason rules, writes audit entry, recomputes parent `sourcing_event` status if linked.
- `reopenRfq(ctx, rfqId)` — checks `purchase_orders` for any non-cancelled PO whose `sourceQuoteId` matches the RFQ's `winnerQuoteId`. If found, throws typed error `code: 'PO_EXISTS'`. Otherwise clears `winnerQuoteId`, transitions back to `active`, and writes audit entry.
- Re-exported from `rfq-service.ts` for backward-compatible imports.

### API routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/rfqs/[id]/cancel` | POST | Cancel with optional reason/detail/notifyVendors |
| `/api/rfqs/[id]/reopen` | POST | Reopen closed RFQ; returns 409 + `code: 'PO_EXISTS'` when blocked |

Both use `withSensitiveRateLimit` and `withAuth`. The existing `/api/rfqs/[id]` PATCH route still handles `closed` (used by the auto-close path inside `awardRfq` and by manual close via `lifecycleActions.onClose`). DELETE remains a soft archive.

### UI

- `src/subapps/procurement/utils/rfq-header-actions.ts` — pure factory mirroring `quote-header-actions.ts`. Returns status-conditional descriptors for `close` / `reopen` / `cancel` / `archive`.
- `src/subapps/procurement/components/RfqCancelDialog.tsx` — reason `Select` (active only) + detail `Textarea` (required for `other`) + notify-vendors `Checkbox` (active + has invites).
- `src/app/procurement/rfqs/[id]/RfqDetailClient.tsx` — wires lifecycle handlers, renders header buttons via `customActions`, renders `RfqCancelDialog`. Reopen handler maps `PO_EXISTS` to a localized error toast.
- `src/subapps/procurement/utils/rfq-lock-state.ts` — adds `lifecycleLocked` state derived from `RFQ_LIFECYCLE_LOCKED_STATUSES`.
- `src/subapps/procurement/components/SetupLockBanner.tsx` — renders a slate-colored read-only banner for `lifecycleLocked`, copy varies by status (`closed` / `cancelled` / `archived`).
- `src/subapps/procurement/components/RfqList.tsx` — adds `cancelled` semantic mapping (red badge).

### i18n

New keys under `quotes.rfqs`:
- `statuses.cancelled`
- `detail.action.{close,reopen,cancel,archive}`
- `detail.confirm.{close,reopen,archive}`
- `detail.toast.{closed,reopened,cancelled,archived}`
- `detail.errors.{closeFailed,reopenFailed,reopenBlockedByPo,cancelFailed,archiveFailed}`
- `cancelDialog.*` (10 keys + 6 reasons)
- `setup.banner.lifecycleLocked.{closed,cancelled,archived}`

Both `el` and `en` populated.

## Read-only enforcement

The Setup tab now shows a `lifecycleLocked` banner whenever `rfq.status ∈ {closed, cancelled, archived}`, replacing the previous behavior where only `awardLocked` was surfaced. Existing tolerance contracts elsewhere (e.g. `RfqLinesPanel`, `VendorInviteSection`) continue to receive `lockState` and now block edits/sends for the new lifecycle-locked statuses.

## Out of scope (deferred)

- **Hard delete of draft RFQs.** ADR previously suggested simple-delete for drafts. Deferred to V2 because cleanup needs to handle sub-collection lines (`rfq_lines`) and any vendor invite stubs. Today, draft cancel marks the RFQ `cancelled` (no reason required), which keeps the audit trail intact and avoids cascade-delete complexity.
- **Vendor notification dispatch on cancel.** The flag `cancellationNotifiedVendors` is persisted on the RFQ doc, but the actual email fan-out is deferred — UI shows the checkbox so the operator's intent is recorded for the future hook.
- **Configurable archive delay.** ADR-335 mentioned an automatic `closed → archived` transition with a delay. Deferred — manual archive only for now.

## References

- ADR-328 §5.EE — lifecycle audit, tolerance contract, deferral rationale
- ADR-327 — procurement domain & vendor portal
- ADR-334 — RFQ creation flow (related schema work)
- PO cancellation pattern — `src/types/procurement/purchase-order.ts:77-90`

## Changelog

| Date | Change |
|------|--------|
| 2026-04-30 | Stub created from ADR-328 §5.EE deferral. |
| 2026-04-30 | IMPLEMENTED. Schema (`cancelled` status + cancellation fields), `rfq-lifecycle-service.ts` (cancel + reopen with PO check), 2 API routes (`/cancel`, `/reopen`), `rfq-header-actions.ts` factory, `RfqCancelDialog`, `RfqDetailClient` wired, `SetupLockBanner` lifecycle-locked variant, `RfqList` cancelled badge, i18n el+en. Hard delete of drafts and vendor notify dispatch deferred to V2. |
