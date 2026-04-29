# ADR-327 HANDOFF — Multi-Vendor Architecture Phase 1 step (f)

**Date**: 2026-04-29
**Previous session ended at**: Step (e) committed — 2 hooks + 1 component + RfqBuilder migration + detail page extension. Context ~60%.
**Next session goal**: Step (f) — **Wizard Step3**: BOQ picker + ad-hoc lines editor (full 5-step wizard).

---

## 📐 ROADMAP PROGRESS

```
✅ a. Types + enterprise IDs + SSoT registry      (COMMIT d4c3f5d1, 2026-04-29)
✅ b. Firestore rules + indexes (deployed)        (COMMIT d0ef2c3c, 2026-04-29)
✅ c. Services (sourcing-event + rfq-line + rfq-service modify)  (COMMIT 84dd62f1)
✅ d. API endpoints (8 routes — rfq lines + sourcing events)     (COMMIT pending)
✅ e. UI components — hooks + RfqBuilder migration + RfqLinesPanel + detail page  (COMMIT pending)
⏸️ f. UI wizard Step3 (BOQ picker + ad-hoc lines editor)  ← NEXT SESSION
⏸️ f. UI wizard Step1-Step2 (Project select + Trade select)
⏸️ g. UI wizard Step3 (BOQ picker + ad-hoc lines editor)
⏸️ h. UI wizard Step4-Step5 (vendor multi-select + meta + submit)
⏸️ i. Email invitation template extension (mostly P3, minor extension)
⏸️ j. Comparison view extensions (multi-vendor, sourcing event aggregate)
⏸️ k. ADR-327 §17 final + changelog (Phase 1 complete)
```

---

## 🌐 STEP (d) DELIVERABLES — What Was Built

8 new route files (all under `src/app/api/procurement/`):

| Route | Methods | Service calls |
|-------|---------|---------------|
| `rfqs/[rfqId]/lines/route.ts` | GET, POST | `listRfqLines`, `addRfqLine` |
| `rfqs/[rfqId]/lines/[lineId]/route.ts` | PATCH, DELETE | `updateRfqLine`, `deleteRfqLine` |
| `rfqs/[rfqId]/lines/bulk/route.ts` | POST | `addRfqLinesBulk` |
| `rfqs/[rfqId]/lines/snapshot/route.ts` | POST | `snapshotFromBoq` |
| `sourcing-events/route.ts` | GET, POST | `listSourcingEvents`, `createSourcingEvent` |
| `sourcing-events/[eventId]/route.ts` | GET, PATCH | `getSourcingEvent`, `updateSourcingEvent` |
| `sourcing-events/[eventId]/archive/route.ts` | POST | `archiveSourcingEvent` |
| `sourcing-events/[eventId]/rfqs/route.ts` | POST, DELETE | `addRfqToSourcingEvent`, `removeRfqFromSourcingEvent` |

Pattern applied: `withAuth` + rate-limit + Zod validation + `errorStatus()` helper + `{ success, data }` envelope.

---

## 🚦 PROTOCOL FOR NEXT SESSION (step e — UI Components)

### Step 0 — Model declaration (CLAUDE.md N.14)

**UI-heavy step.** Multiple React components, hooks, and wizard integration. Recommend **Sonnet 4.6**.

```
🎯 Modello consigliato: Sonnet 4.6
Motivo: UI components + hooks, pattern reuse from existing wizard,
        no new architecture decisions — execution step.
Switch: /model sonnet
⏸️ Aspetta "ok" da Giorgio prima di procedere.
```

### Step 1 — Read in parallel (RECOGNITION)

Before writing code:

1. `adrs/ADR-327-HANDOFF.md` (this file)
2. `docs/centralized-systems/reference/adrs/ADR-327-quote-management-comparison-system.md` §17 Q29-Q31 (line editor UX decisions)
3. `src/app/procurement/rfqs/new/page.tsx` — existing wizard (5 steps: Project → Trade → Lines → Vendor → Meta)
4. `src/subapps/procurement/components/RfqBuilder.tsx` — wizard step components
5. `src/app/api/procurement/rfqs/[rfqId]/lines/route.ts` (step d — POST endpoint shape)
6. `src/app/api/procurement/sourcing-events/route.ts` (step d — POST endpoint shape)
7. `src/subapps/procurement/types/rfq-line.ts` — CreateRfqLineDTO, RfqLine
8. `src/subapps/procurement/types/sourcing-event.ts` — SourcingEvent, CreateSourcingEventDTO

### Step 2 — Scope confirmation

Giorgio confirms what UI components he wants in step (e). Possible scope:

**Option A — Minimal (lines editor only)**:
- `RfqLinesEditor.tsx` (CRUD table for `rfqs/{id}/lines`) — shown in wizard Step 3 when `source = 'ad_hoc'`
- `BulkBoqImporter.tsx` — BOQ item picker → POST `/lines/snapshot`

**Option B — Multi-trade toggle**:
- `SourcingEventToggle.tsx` — "+ Πολλαπλές ειδικότητες σε πακέτο" toggle in RfqBuilder Step 1
- `useSourcingEvent` hook — wraps `sourcing-events` CRUD API
- SourcingEvent summary card in RFQ detail page

**Option C — Full wizard wiring (steps f-h)**:
- Full 5-step wizard connected to new API endpoints (including vendor multi-select + lines)

Giorgio decides scope.

---

## ⚠️ CRITICAL — DO NOT (carry-over from step c/d)

1. ❌ **DO NOT push** without explicit order (N.(-1))
2. ❌ **DO NOT skip Phase 3 ADR update** — same commit as code
3. ❌ **DO NOT expose `unitPrice` to vendors** — use `toPublicRfqLine()` for portal payloads
4. ❌ **DO NOT hardcode strings** — i18n via `t('quotes.*')` namespace (keys first in locale JSON)
5. ❌ **DO NOT call API routes directly** from components — always via custom hooks

---

## 🎯 ARCHITECTURE DECISIONS ALREADY TAKEN (do not re-litigate)

| Q | Decision | Lock-in |
|---|----------|---------|
| Q28 | HYBRID B fan-out: 1 RFQ → N invitations (atomic transaction) | Locked |
| Q29 | HYBRID Γ: lines as sub-collection `rfqs/{id}/lines/{lineId}`, copy-on-create snapshot | Locked |
| Q30 | HYBRID Γ: 2 entry points → shared 5-step wizard | Locked |
| Q31 | HYBRID A-Enhanced: 1 RFQ = 1 trade; multi-trade via `sourcing_events` parent | Locked |
| Q32 | Option B: retain `vendor_invites` collection name | Locked |

---

## 📚 REFERENCES

- **ADR-327 master**: `docs/centralized-systems/reference/adrs/ADR-327-quote-management-comparison-system.md`
- **Step (a) commit**: `d4c3f5d1`
- **Step (b) commit**: `d0ef2c3c` (+ firebase deploy — rules+indexes live in production)
- **Step (c) commit**: `84dd62f1`
- **Step (d) commit**: see `git log --oneline -1` at session start
- **API endpoints (step d)**: all in `src/app/api/procurement/rfqs/` + `src/app/api/procurement/sourcing-events/`
- **Service layer (step c)**: `src/subapps/procurement/services/rfq-line-service.ts` + `sourcing-event-service.ts`
- **Types**: `src/subapps/procurement/types/rfq-line.ts` + `sourcing-event.ts`

---

## 💬 IF GIORGIO SAYS "VAI"

Proceed with step (e) following the protocol above. If anything in the recognition phase contradicts this handoff, STOP and report — code is SoT, the handoff may be wrong.
