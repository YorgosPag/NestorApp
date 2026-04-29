# ADR-327 HANDOFF — Multi-Vendor Architecture Phase 1 step (i)

**Date**: 2026-04-29
**Previous session ended at**: Step (h) committed — email dispatch fire-and-forget in `createRfq()` via `dispatchRfqInviteEmails`. Context ~65%.
**Next session goal**: Step (i) — **Comparison view extensions (multi-vendor aggregate)**.

---

## 📐 ROADMAP PROGRESS

```
✅ a. Types + enterprise IDs + SSoT registry
✅ b. Firestore rules + indexes (deployed)
✅ c. Services (sourcing-event + rfq-line + rfq-service modify)
✅ d. API endpoints (8 routes)
✅ e. UI components — hooks + RfqBuilder migration + RfqLinesPanel + detail page
✅ f. BOQ picker inside RfqBuilder
✅ g. Vendor multi-select — VendorPickerSection
✅ h. Email dispatch on createRfq() — fire-and-forget via dispatchRfqInviteEmails
⏸️ i. Comparison view extensions (multi-vendor aggregate)  ← NEXT SESSION
```

---

## 🌐 STEP (h) DELIVERABLES — What Was Built

### Modified files only (no new files)

| File | Change |
|------|--------|
| `src/subapps/procurement/services/rfq-service.ts` | Imports `emailVendorInviteChannel` + `getContactEmail`; adds `InviteMeta` type + `dispatchRfqInviteEmails()`; collects `inviteMeta[]` during batch; fire-and-forget after sub-collection lines |
| `docs/.../ADR-327-*.md` | Step (h) changelog entry |
| `adrs/ADR-327-HANDOFF.md` | Updated to step (i) |

### Key implementation detail

`createRfq()` now returns `{ rfq, inviteMeta }` from `safeFirestoreOperation` (was: just `rfq`). Destructured externally. The `InviteMeta` shape: `{ inviteId, vendorId, token, expiresAt: string (ISO) }`.

`dispatchRfqInviteEmails` uses `Promise.allSettled` — individual vendor failures are logged but never throw.

---

## 🚦 PROTOCOL FOR NEXT SESSION (step i — Comparison View)

### Step 0 — Model declaration (CLAUDE.md N.14)

**Modello consigliato: Sonnet 4.6** — UI extension to existing ComparisonPanel + sourcing event aggregate.

### Step 1 — Read in parallel (RECOGNITION)

1. `adrs/ADR-327-HANDOFF.md` (this file)
2. `src/subapps/procurement/components/ComparisonPanel.tsx` — existing comparison UI
3. `src/subapps/procurement/services/comparison-service.ts` — `computeRfqComparison()`
4. `src/subapps/procurement/types/sourcing-event.ts` — SourcingEvent shape
5. `src/app/procurement/rfqs/[id]/page.tsx` — how ComparisonPanel is wired
6. `src/i18n/locales/el/quotes.json` — existing `comparison.*` keys

### Step 2 — Scope for step (i)

Multi-vendor aggregate view in ComparisonPanel:
- When RFQ has `sourcingEventId` → show sibling RFQs in the comparison
- Aggregate totals across sibling RFQs (one per trade → multi-vendor package view)
- "Sourcing event summary" card: event title, N trades, N vendors, best total

---

## ⚠️ CRITICAL — DO NOT

1. ❌ **DO NOT push** without explicit order (N.(-1))
2. ❌ **DO NOT skip Phase 3 ADR update** — same commit as code
3. ❌ **DO NOT expose `unitPrice` to vendors**
4. ❌ **DO NOT hardcode strings** — i18n only

---

## 📚 REFERENCES

- **ADR-327 master**: `docs/centralized-systems/reference/adrs/ADR-327-quote-management-comparison-system.md`
- **rfq-service.ts** (step h): `src/subapps/procurement/services/rfq-service.ts`
- **email channel**: `src/subapps/procurement/services/channels/email-channel.ts`
- **ComparisonPanel**: `src/subapps/procurement/components/ComparisonPanel.tsx`
