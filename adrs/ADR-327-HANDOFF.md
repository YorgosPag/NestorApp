# ADR-327 HANDOFF — Multi-Vendor Architecture Phase 1 step (h)

**Date**: 2026-04-29
**Previous session ended at**: Step (g) committed — VendorPickerSection (multi-select combobox+chips) wired to form.invitedVendorIds inside RfqBuilder. Context ~55%.
**Next session goal**: Step (h) — **Email invitation template extension**.

---

## 📐 ROADMAP PROGRESS

```
✅ a. Types + enterprise IDs + SSoT registry      (COMMIT d4c3f5d1, 2026-04-29)
✅ b. Firestore rules + indexes (deployed)        (COMMIT d0ef2c3c, 2026-04-29)
✅ c. Services (sourcing-event + rfq-line + rfq-service modify)  (COMMIT 84dd62f1)
✅ d. API endpoints (8 routes — rfq lines + sourcing events)     (COMMIT b563db10)
✅ e. UI components — hooks + RfqBuilder migration + RfqLinesPanel + detail page  (COMMIT b563db10)
✅ f. BOQ picker inside RfqBuilder — BoqLinePicker + GET /api/boq/items + handleSubmit split
✅ g. Vendor multi-select — VendorPickerSection (combobox+chips) wired to invitedVendorIds
⏸️ h. Email invitation template extension  ← NEXT SESSION
⏸️ i. Comparison view extensions (multi-vendor aggregate)
```

---

## 🌐 STEP (g) DELIVERABLES — What Was Built

### New files

| File | Description |
|------|-------------|
| `src/subapps/procurement/components/VendorPickerSection.tsx` | Controlled multi-select: `SearchableCombobox` + chips + remove |

### Modified files

| File | Change |
|------|--------|
| `src/subapps/procurement/components/RfqBuilder.tsx` | Import + mount `VendorPickerSection` |
| `src/i18n/locales/el/quotes.json` | `rfqs.vendorPicker.*` (4 keys) |
| `src/i18n/locales/en/quotes.json` | `rfqs.vendorPicker.*` (4 keys) |
| `docs/.../ADR-327-*.md` | Step (g) changelog entry |

---

## 🚦 PROTOCOL FOR NEXT SESSION (step h — Email Invitation Template)

### Step 0 — Model declaration (CLAUDE.md N.14)

**Modello consigliato: Sonnet 4.6** — email template extension, pattern reuse from existing P3 channel adapter.

### Step 1 — Read in parallel (RECOGNITION)

Before writing code:

1. `adrs/ADR-327-HANDOFF.md` (this file)
2. `src/subapps/procurement/services/channels/email-channel.ts` — existing email template (vendor portal invite)
3. `src/subapps/procurement/services/rfq-service.ts` — how invites are currently generated on `createRfq()`
4. `src/i18n/locales/el/quotes.json` — existing `rfqs.*` + `invites.*` sections

### Step 2 — Scope for step (h)

Extend the email invitation template to include multi-vendor context:
- When `createRfq()` with `invitedVendorIds[]` → generate vendor invites + send emails
- Current flow: invites created post-RFQ creation manually via `VendorInviteSection`
- Step (h) goal: auto-generate invites on RFQ creation when `invitedVendorIds` are provided

**Key question to answer in RECOGNITION**: Does `createRfq()` currently call `VendorInviteService.createInvite()` for each vendorId in `invitedVendorIds`? Or is that deferred to the UI?

---

## ⚠️ CRITICAL — DO NOT

1. ❌ **DO NOT push** without explicit order (N.(-1))
2. ❌ **DO NOT skip Phase 3 ADR update** — same commit as code
3. ❌ **DO NOT expose `unitPrice` to vendors** — use `toPublicRfqLine()` for portal payloads
4. ❌ **DO NOT hardcode strings** — i18n via `t('quotes.*')` namespace (keys first in locale JSON)

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
- **Step (f+g) commit**: see `git log --oneline -1` at session start
- **BOQ API (step f)**: `src/app/api/boq/items/route.ts`
- **BOQ Picker (step f)**: `src/subapps/procurement/components/BoqLinePicker.tsx`
- **Vendor Picker (step g)**: `src/subapps/procurement/components/VendorPickerSection.tsx`
- **Vendor contacts API (reused)**: `src/app/api/rfqs/[id]/vendor-contacts/route.ts`
