# ADR-327 HANDOFF — Multi-Vendor Architecture Phase 1 step (g)

**Date**: 2026-04-29
**Previous session ended at**: Step (f) committed — GET /api/boq/items + BoqLinePicker + RfqBuilder split (boqItemIds vs adHocLines). Context ~45%.
**Next session goal**: Step (g) — **Wizard Step4-5**: vendor multi-select + submit.

---

## 📐 ROADMAP PROGRESS

```
✅ a. Types + enterprise IDs + SSoT registry      (COMMIT d4c3f5d1, 2026-04-29)
✅ b. Firestore rules + indexes (deployed)        (COMMIT d0ef2c3c, 2026-04-29)
✅ c. Services (sourcing-event + rfq-line + rfq-service modify)  (COMMIT 84dd62f1)
✅ d. API endpoints (8 routes — rfq lines + sourcing events)     (COMMIT b563db10)
✅ e. UI components — hooks + RfqBuilder migration + RfqLinesPanel + detail page  (COMMIT b563db10)
✅ f. BOQ picker inside RfqBuilder — BoqLinePicker + GET /api/boq/items + handleSubmit split  (THIS SESSION)
⏸️ g. Wizard Step4-5 — vendor multi-select + submit  ← NEXT SESSION
⏸️ h. Email invitation template extension (mostly P3, minor extension)
⏸️ i. Comparison view extensions (multi-vendor aggregate)
```

---

## 🌐 STEP (f) DELIVERABLES — What Was Built

### New files

| File | Description |
|------|-------------|
| `src/app/api/boq/items/route.ts` | GET `/api/boq/items?projectId=X` — tenant-scoped BOQ item list |
| `src/subapps/procurement/components/BoqLinePicker.tsx` | Dialog picker: multi-checkbox + search + "Aggiungi X" CTA |

### Modified files

| File | Change |
|------|--------|
| `src/subapps/procurement/components/RfqBuilder.tsx` | `FormLine` type (extends `RfqLine`), BOQ picker button, `handleBoqSelect`, `handleSubmit` split `boqItemIds`/`adHocLines` |
| `src/i18n/locales/el/quotes.json` | `rfqs.boqPicker.*` (7 keys) |
| `src/i18n/locales/en/quotes.json` | `rfqs.boqPicker.*` (7 keys) |
| `docs/.../ADR-327-*.md` | Step (f) changelog entry |

---

## 🚦 PROTOCOL FOR NEXT SESSION (step g — Vendor Multi-Select)

### Step 0 — Model declaration (CLAUDE.md N.14)

**Modello consigliato: Sonnet 4.6** — UI extension + pattern reuse from existing `VendorInviteSection`, no new architecture.

### Step 1 — Read in parallel (RECOGNITION)

Before writing code:

1. `adrs/ADR-327-HANDOFF.md` (this file)
2. `src/subapps/procurement/components/RfqBuilder.tsx` — current form state
3. `src/subapps/procurement/components/VendorInviteSection.tsx` — existing vendor picker pattern (Combobox + vendor contact list)
4. `src/subapps/procurement/hooks/useVendorInvites.ts` — existing hook for vendor contacts
5. `src/subapps/procurement/types/rfq.ts` — `CreateRfqDTO.invitedVendorIds?: string[]`
6. `src/i18n/locales/el/quotes.json` rfqs section (check existing vendor keys)

### Step 2 — Scope for step (g)

Add vendor multi-select to RfqBuilder:
- Section below Lines: "Vendors da invitare"
- Searchable combobox (uses existing vendor contacts API from P3.b: `/api/rfqs/[id]/vendor-contacts` OR a simpler `/api/contacts?persona=supplier`)
- Selected vendors as chips/badges with remove button
- `form.invitedVendorIds` is already in FormState — just need UI wiring

**Key constraint**: vendor contacts are already pre-fetched in `useVendorInvites.ts` (for an existing RFQ). For the NEW RFQ wizard, vendor contacts must be fetched without an rfqId. Use the existing `/api/contacts` endpoint filtered by supplier persona.

---

## ⚠️ CRITICAL — DO NOT

1. ❌ **DO NOT push** without explicit order (N.(-1))
2. ❌ **DO NOT skip Phase 3 ADR update** — same commit as code
3. ❌ **DO NOT expose `unitPrice` to vendors** — use `toPublicRfqLine()` for portal payloads
4. ❌ **DO NOT hardcode strings** — i18n via `t('quotes.*')` namespace (keys first in locale JSON)
5. ❌ **DO NOT add a wizard 5-step flow** — form remains flat (see step e spec)

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
- **Step (d+e) commit**: `b563db10`
- **Step (f) commit**: see `git log --oneline -1` at session start
- **API endpoints (step d)**: all in `src/app/api/procurement/rfqs/` + `src/app/api/procurement/sourcing-events/`
- **Service layer (step c)**: `src/subapps/procurement/services/rfq-line-service.ts` + `sourcing-event-service.ts`
- **Types**: `src/subapps/procurement/types/rfq-line.ts` + `sourcing-event.ts`
- **BOQ API (step f)**: `src/app/api/boq/items/route.ts`
- **BOQ Picker (step f)**: `src/subapps/procurement/components/BoqLinePicker.tsx`

---

## 💬 IF GIORGIO SAYS "VAI"

Proceed with step (g) following the protocol above. If anything in the recognition phase contradicts this handoff, STOP and report — code is SoT, the handoff may be wrong.
