# ADR-327 HANDOFF — Multi-Vendor Architecture Phase 1 step (b)

**Date**: 2026-04-29
**Previous session ended at**: Step (a) Domain Foundation committed (`d4c3f5d1`), context ~54%, clean break for fresh-session continuation.
**Next session goal**: Step (b) — Firestore rules + composite indexes + rules tests for the 2 new collections + 1 sub-collection added in step (a).

---

## 🚦 PROTOCOL FOR NEXT SESSION (in this exact order)

### Step 0 — Model declaration (CLAUDE.md N.14)
```
🎯 Modello consigliato: Sonnet 4.6
Motivo: implementation mirata su 4-5 file (Firestore rules + indexes + tests).
        No architectural decision — già prese in step (a).
Switch: /model sonnet
⏸️ Aspetta "ok" da Giorgio prima di procedere.
```

### Step 1 — Read in parallel (Phase 1 RECOGNITION, N.0.1)
Re-read these files BEFORE writing code (code = SoT, ADR follows):
1. `adrs/ADR-327-HANDOFF.md` (this file)
2. `docs/centralized-systems/reference/adrs/ADR-327-quote-management-comparison-system.md` §5.2 (collection table) + §17 Q28-Q32 (architecture decisions) + last 2 changelog entries dated 2026-04-29
3. `firestore.rules` lines 3315-3345 (existing rfqs / quotes / vendor_invites / trades rules — pattern reference)
4. `firestore.indexes.json` lines 2840-2912 (existing rfqs / vendor_invites / quotes indexes — pattern reference)
5. `tests/firestore-rules/_registry/coverage-manifest.ts` lines 1075-1085 (coverage manifest entries — pattern reference)
6. `src/subapps/procurement/types/sourcing-event.ts` (newly created in step a — confirms field names for indexes)
7. `src/subapps/procurement/types/rfq-line.ts` (newly created in step a — confirms field names for indexes + sub-collection structure)
8. `src/config/firestore-collections.ts` line 303 (`SOURCING_EVENTS` const added in step a)

### Step 2 — Confirm scope with Giorgio
Ask Giorgio for "ok step b" before writing code (Plan Mode incremental, not orchestrator).

### Step 3 — Implement step (b)

---

## 📋 STEP (b) SCOPE — Firestore Rules + Indexes + Tests

### 3.1 — `firestore.rules` (additive, ~50 LOC new)

Add 3 new rule blocks AFTER the existing `vendor_invite_tokens` block (insert around line 3336):

```firestore-rules
match /sourcing_events/{eventId} {
  // ADR-327 §17 Q31 — multi-trade RFQ package parent
  allow read: if isAuthenticated()
              && resource.data.keys().hasAny(['companyId'])
              && belongsToCompany(resource.data.companyId);
  allow create: if false;   // service layer Admin SDK only
  allow update: if false;
  allow delete: if false;
}

match /rfqs/{rfqId}/lines/{lineId} {
  // ADR-327 §17 Q29 — sub-collection lines (BOQ-first + ad_hoc)
  allow read: if isAuthenticated()
              && resource.data.keys().hasAny(['companyId'])
              && belongsToCompany(resource.data.companyId);
  allow create: if false;   // service layer Admin SDK only
  allow update: if false;
  allow delete: if false;
}
```

NOTE: there is no separate `rfq_invitations` collection — Q32 retains the existing `vendor_invites` collection name. No new rule for that.

### 3.2 — `firestore.indexes.json` (8 composites)

Per the master prompt (already validated by Giorgio):

```jsonc
// rfq_invitations  → FALSE, retained name is vendor_invites (Q32)
// 3 indexes on vendor_invites (some already exist — verify):
//   - (rfqId, status) — for "list invitations of an RFQ"
//   - (vendorContactId, status) — already exists at line 2905-2911 minus status, EXTEND
//   - (companyId, status, createdAt) — already exists similar at line 2848-2856 minus status, EXTEND

// 2 indexes on rfqs:
//   - (sourcingEventId, status) — "list RFQs of a sourcing event"
//   - existing (companyId, projectId, createdAt, status) sufficient for general

// 2 indexes on rfqs/lines (sub-collection — collectionGroup queries):
//   - (rfqId, displayOrder)
//   - (companyId, source) — for analytics "BOQ vs ad-hoc coverage"

// 2 indexes on sourcing_events:
//   - (companyId, projectId, status)
//   - (companyId, status, createdAt)
```

⚠️ Before adding the rfq_invitations indexes — VERIFY existing `vendor_invites` indexes at lines 2848-2856 and 2905-2911 don't already cover the queries. Don't duplicate.

### 3.3 — `tests/firestore-rules/_registry/coverage-manifest.ts`

Add 2 entries to the existing array (around line 1080):

```typescript
'sourcing_events',  // Admin SDK writes only; read: auth + companyId
// Sub-collection rfqs/{id}/lines is covered via the rfqs collectionGroup test
```

### 3.4 — Firestore rules tests (CHECK 3.16 zero-tol on touch)

When touching `firestore.rules`, the pre-commit hook **3.16 ZERO TOL** requires test coverage for the new rules. Add:

- `tests/firestore-rules/sourcing-events.test.ts` (NEW) — read allowed for company member, denied for cross-tenant, write always denied
- `tests/firestore-rules/rfq-lines.test.ts` (NEW) — same shape, scoped to sub-collection path

Pattern reference: existing `tests/firestore-rules/rfqs.test.ts` (or similar — find via Glob).

### 3.5 — Composite index coverage (CHECK 3.15 zero-tol on touch)

When changing `firestore.indexes.json`, the hook validates that any `query() + where() + orderBy()` in code has a matching index. Since we're not yet writing service code in step (b), this is a check we'll satisfy in step (c) — but verify the new indexes are syntactically valid (no typos) by running `npm run firestore:indexes:validate` or similar (look for the script in package.json).

---

## ⚠️ CRITICAL — DO NOT (CLAUDE.md non-negotiables)

1. ❌ **DO NOT push** without explicit order (N.(-1))
2. ❌ **DO NOT skip Phase 3 ADR update** — append a step (b) changelog entry to `docs/centralized-systems/reference/adrs/ADR-327-quote-management-comparison-system.md` in the SAME commit
3. ❌ **DO NOT use `addDoc()`** anywhere — the new SSoT modules `sourcing-event-entity` and `rfq-line-entity` (registered in step a) actively block it
4. ❌ **DO NOT rename `vendor_invites`** to `rfq_invitations` (Q32 Option B decided, ~30-file refactor cost not justified)
5. ❌ **DO NOT modify `rfq.ts` schema beyond what step (a) already added** — service-layer migration belongs in step (c)
6. ❌ **DO NOT create the canonical `sourcing-event-service.ts` or `rfq-line-service.ts` yet** — they belong in step (c) (the SSoT registry already lists them as future serviceFile paths)
7. ❌ **DO NOT add hardcoded strings** in any TS/TSX you touch (N.11) — only `t('procurement.key')` with keys in `src/i18n/locales/{el,en}/procurement.json` first

---

## 🎯 ARCHITECTURE DECISIONS ALREADY TAKEN (do not re-litigate)

From master prompt + Giorgio's confirmations (re-documented in §17 Q28-Q32):

| Q | Decision | Lock-in |
|---|----------|---------|
| Q28 | HYBRID B fan-out: 1 RFQ → N invitations (vendor anonymity, atomic transaction) | Locked |
| Q29 | HYBRID Γ: lines as sub-collection `rfqs/{id}/lines/{lineId}` with `source: 'boq'\|'ad_hoc'` | Locked |
| Q30 | HYBRID Γ: 2 entry points (project tab + sidebar) → shared 5-step wizard | Locked |
| Q31 | HYBRID A-Enhanced: 1 RFQ = 1 trade SEMPRE; multi-trade via `sourcing_events` parent | Locked |
| Q32 | Option B: retain `vendor_invites` collection name (do NOT rename to `rfq_invitations`) | Locked |

---

## 📐 ROADMAP PROGRESS

```
✅ a. Types + enterprise IDs + SSoT registry      (COMMIT d4c3f5d1, 2026-04-29)
⏸️ b. Firestore rules + indexes + rules tests    ← NEXT SESSION
⏸️ c. Services (sourcing-event-service, rfq-line-service)
⏸️ d. API endpoints (POST /api/sourcing-events, etc.)
⏸️ e. Vendor portal HMAC + public route extension (already mostly P3)
⏸️ f. UI wizard Step1-Step2 (Project select + Trade select)
⏸️ g. UI wizard Step3 (BOQ picker + ad-hoc lines editor)
⏸️ h. UI wizard Step4-Step5 (vendor multi-select + meta + submit)
⏸️ i. Email invitation template extension (already P3)
⏸️ j. Comparison view extensions (multi-vendor, sourcing event aggregate)
⏸️ k. ADR-327 §17 final + changelog (Phase 1 complete)
```

---

## 🧪 PRE-FLIGHT CHECKLIST (run these BEFORE step b implementation)

After Step 1 reads complete, verify in parallel:
1. `git log --oneline -3` → confirm `d4c3f5d1` is HEAD (step a committed)
2. `git status` → working tree clean
3. `npm run ssot:audit` → confirm no SSoT regression from step a
4. Glob `tests/firestore-rules/*.test.ts` → identify the rules test pattern to mirror

---

## 📚 REFERENCES

- **Master prompt** (Giorgio's original session-start): Q1-Q4 architectural decisions, file inventory NEW vs REFACTOR, 8-index list, non-negotiables checklist
- **ADR-327 master**: `docs/centralized-systems/reference/adrs/ADR-327-quote-management-comparison-system.md`
- **Step (a) commit**: `d4c3f5d1 feat(adr-327): Multi-Vendor Architecture Phase 1 step (a) — Domain Foundation`
- **Reuse pattern (rules)**: existing `vendor_invites` rule block at `firestore.rules:3323-3335`
- **Reuse pattern (indexes)**: existing `vendor_invites` indexes at `firestore.indexes.json:2848-2856` and `:2905-2911`

---

## 🏁 SUCCESS CRITERIA — step (b)

1. ✅ `firestore.rules` adds 2 rule blocks (sourcing_events + rfqs/lines), syntax valid
2. ✅ `firestore.indexes.json` adds 6-8 composites (some may already exist on vendor_invites — dedupe)
3. ✅ Coverage manifest updated
4. ✅ 2 new rules test files (sourcing-events + rfq-lines) — CHECK 3.16 zero-tol satisfied
5. ✅ ADR-327 changelog entry for step (b) added in the same commit
6. ✅ Pre-commit hooks all green (especially CHECK 3.15, 3.16, 3.18, 3.22)
7. ✅ No push (only commit)
8. ✅ Google-level declaration at end (target: ✅ FULL — no naming gap on this step)

---

## 💬 IF GIORGIO SAYS "VAI"

Proceed with step (b) following the protocol above. If anything in the recognition phase contradicts this handoff, STOP and report — code is SoT, the handoff may be wrong.

If anything blocks (CHECK 3.16 missing fixture, 3.15 missing index, etc.), report it as a blocker before forcing through.
