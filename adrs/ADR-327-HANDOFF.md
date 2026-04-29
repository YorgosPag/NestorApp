# ADR-327 HANDOFF — Multi-Vendor Architecture Phase 1 step (c)

**Date**: 2026-04-29
**Previous session ended at**: Step (b) committed (`d0ef2c3c`) + deployed to production (Firestore rules + 7 composite indexes building server-side). Context ~60%, clean break for fresh-session continuation.
**Next session goal**: Step (c) — **Services**: `sourcing-event-service.ts` (NEW) + `rfq-line-service.ts` (NEW) + `rfq-service.ts` (MODIFY for new fields + sub-collection lines write) + presubmit tests.

---

## 🚦 PROTOCOL FOR NEXT SESSION (in this exact order)

### Step 0 — Model declaration (CLAUDE.md N.14)

**Decision-heavy step.** Atomic transactions (Q28 fan-out), snapshot semantics (Q29), FSM aggregation (Q31). Recommend **Sonnet 4.6** unless complexity escalates.

```
🎯 Modello consigliato: Sonnet 4.6
Motivo: implementation 3 service files (~1000-1300 LOC totali) + tests
        presubmit. Architecture decisions già lock-in Q28-Q32 step (a).
        Sub-collection + transaction patterns già esistenti nel codebase
        (entity-audit-service, accounting transactions) — pattern reuse.
Switch: /model sonnet
⏸️ Aspetta "ok" da Giorgio prima di procedere.
```

**Fallback Opus**: se durante recognition emergono ≥3 ambiguity decisions o se BOQ-snapshot transaction richiede architettura cross-domain → escalate.

### Step 1 — Read in parallel (Phase 1 RECOGNITION, N.0.1)

Re-read these files BEFORE writing code (code = SoT, ADR follows):

1. `adrs/ADR-327-HANDOFF.md` (this file)
2. `docs/centralized-systems/reference/adrs/ADR-327-quote-management-comparison-system.md` §5.2 (collection table) + §17 Q28-Q32 (architecture decisions) + last 3 changelog entries (step a + step b + step b §17 detailed)
3. `src/subapps/procurement/services/rfq-service.ts` (FULL — pattern reference + needs MODIFY)
4. `src/subapps/procurement/services/quote-service.ts` (pattern reference — service shape, audit, ctx.uid usage)
5. `src/subapps/procurement/services/vendor-invite-service.ts` (pattern reference — atomic fan-out batch writes, vendor_invites SSoT)
6. `src/subapps/procurement/types/sourcing-event.ts` (already created in step a — implementing this)
7. `src/subapps/procurement/types/rfq-line.ts` (already created in step a — implementing this)
8. `src/services/entity-audit.service.ts` + `src/services/enterprise-id.service.ts` (audit + ID generators)
9. `src/types/boq/boq-item.ts` (or wherever `BOQItem` lives) — for snapshot semantics in `snapshotFromBoq`
10. `.ssot-registry.json` modules `sourcing-event-entity` + `rfq-line-entity` — confirm canonical service file paths

### Step 2 — Confirm scope with Giorgio

Ask Giorgio for "ok step c" before writing code (Plan Mode incremental, NOT orchestrator — service files are isolated).

**Suggested split** (optional — Giorgio decides):
- **c.1**: `sourcing-event-service.ts` (NEW, ~300 LOC) + tests + ADR update + commit
- **c.2**: `rfq-line-service.ts` (NEW, ~400 LOC, includes BOQ snapshot transaction) + tests + ADR + commit
- **c.3**: `rfq-service.ts` (MODIFY) — populate new fields + sub-collection lines write + atomic Q28 fan-out + tests + ADR + commit

Single-shot bundle is also valid if Giorgio prefers (~1300 LOC, larger atomic commit).

### Step 3 — Implement step (c)

---

## 📋 STEP (c) SCOPE — Services + Tests

### 3.1 — `sourcing-event-service.ts` (NEW, ~300 LOC)

**Path**: `src/subapps/procurement/services/sourcing-event-service.ts`
**Forbidden patterns blocked by**: SSoT registry module `sourcing-event-entity` (Tier 2, registered step a) — only this file may write `sourcing_events`.

```typescript
// Required exports (canonical service shape):
createSourcingEvent(ctx, dto: CreateSourcingEventDTO): Promise<SourcingEvent>
getSourcingEvent(ctx, eventId): Promise<SourcingEvent | null>
listSourcingEvents(ctx, filters?: SourcingEventFilters): Promise<SourcingEvent[]>
updateSourcingEvent(ctx, eventId, dto: UpdateSourcingEventDTO): Promise<SourcingEvent>
archiveSourcingEvent(ctx, eventId): Promise<void>
addRfqToSourcingEvent(ctx, eventId, rfqId): Promise<void>     // batch update rfqIds[] + rfqCount + recompute status
removeRfqFromSourcingEvent(ctx, eventId, rfqId): Promise<void>
recomputeSourcingEventStatus(ctx, eventId): Promise<SourcingEventStatus>  // calls deriveSourcingEventStatus() from types
```

**Implementation notes**:
- Use `generateSourcingEventId()` from enterprise-id service (already wired in step a)
- All writes via Admin SDK (`adminDb`), check `ctx.uid` (NOT `ctx.userId` — known broken pattern in legacy rfq-service)
- `companyId` always = `ctx.companyId`, immutable
- `EntityAuditService.recordChange()` for create/update/archive (tracked entity per ADR-195 Phase 3)
- FSM transitions enforced via `SOURCING_EVENT_STATUS_TRANSITIONS` from types
- `deriveSourcingEventStatus(rfqCount, closedRfqCount, currentStatus)` already implemented in `sourcing-event.ts` (step a)
- Server-side aggregation: when child RFQ closes, the parent's `closedRfqCount` is incremented (atomic transaction)

**Pattern reference**: `quote-service.ts` for shape; `vendor-invite-service.ts` for batch updates.

### 3.2 — `rfq-line-service.ts` (NEW, ~400 LOC)

**Path**: `src/subapps/procurement/services/rfq-line-service.ts`
**Forbidden patterns blocked by**: SSoT registry module `rfq-line-entity` (Tier 2, registered step a) — only this file may write `rfqs/{id}/lines`.

```typescript
// Required exports:
addRfqLine(ctx, rfqId, dto: CreateRfqLineDTO): Promise<RfqLine>
addRfqLinesBulk(ctx, rfqId, dtos: CreateRfqLineDTO[]): Promise<RfqLine[]>   // BATCH/TRANSACTION
snapshotFromBoq(ctx, rfqId, boqItemIds: string[], trade: TradeCode): Promise<RfqLine[]>  // Q29 BOQ-first
listRfqLines(ctx, rfqId): Promise<RfqLine[]>                  // ordered by displayOrder asc
listRfqLinesPublic(ctx, rfqId): Promise<PublicRfqLine[]>      // strips internal via toPublicRfqLine()
updateRfqLine(ctx, rfqId, lineId, dto: UpdateRfqLineDTO): Promise<RfqLine>
deleteRfqLine(ctx, rfqId, lineId): Promise<void>
```

**Implementation notes**:
- Sub-collection path: `rfqs/{rfqId}/lines/{lineId}` — use `adminDb.collection('rfqs').doc(rfqId).collection('lines')`
- Use `generateRfqLineId()` from enterprise-id service (wired step a, prefix `rfqln`)
- `companyId` denormalized on every line (CHECK 3.10 firestore-companyid-baseline) — read parent RFQ once, use its `companyId`
- `displayOrder` auto-assigned: `existing.length + index` if not provided
- `snapshotFromBoq()`:
  - **Q29 snapshot semantics**: read each BOQ item ONCE, copy fields to RfqLine, set `source: 'boq'` + `boqItemId: <id>`
  - DO NOT watch / live-update — snapshot frozen at RFQ creation
  - Map: `BOQItem.title → RfqLine.description`, `BOQItem.categoryCode → RfqLine.categoryCode`, `BOQItem.quantity/unit → RfqLine.quantity/unit`, `BOQItem.unitPrice → RfqLine.unitPrice` (INTERNAL ONLY, stripped from public projection)
  - Tenant filter: `where('companyId', '==', ctx.companyId)` to prevent cross-tenant BOQ reads
- `toPublicRfqLine()` already implemented in `rfq-line.ts` (step a) — just call it in `listRfqLinesPublic()`
- Batch write transaction for `addRfqLinesBulk()`: Firestore batch limit 500, chunk if needed
- Audit: `EntityAuditService.recordChange()` per line operation? OR per-bulk single entry? **Decide**: per-bulk to avoid audit-spam. Use `entityType: 'rfq'`, `action: 'lines_added' | 'lines_updated'`, `changes: { lineCount, source }`.

**Pattern reference**: existing service that uses sub-collections + bulk writes. Search for `.collection('lines')` or `firestore() batch` in codebase.

### 3.3 — `rfq-service.ts` (MODIFY)

**Path**: `src/subapps/procurement/services/rfq-service.ts`

**Changes**:
1. **`createRfq(ctx, dto)`** — populate new optional fields:
   - `sourcingEventId`: from `dto.sourcingEventId` (if multi-trade flow)
   - `sourcingEventStatus`: snapshot of parent at create time
   - `invitedVendorCount`: `dto.invitedVendorIds?.length ?? 0`
   - `respondedCount`: 0 at create
   - `linesStorage`: `'boq' | 'ad_hoc' | 'inline_legacy'` — set based on path:
     - If `dto.boqItemIds` present → `'boq'`
     - If `dto.lines` (inline legacy) → `'inline_legacy'`
     - If `dto.adHocLines` → `'ad_hoc'`
     - Mixed → `'mixed'` (add to type if needed; or keep separate sub-collection writes)

2. **Atomic Q28 fan-out** — when `dto.invitedVendorIds.length > 0`:
   - Single Firestore transaction OR batch:
     - Create RFQ document
     - Create N `vendor_invites` documents (one per vendorId)
     - Update parent `sourcing_events` (if linked): increment `rfqCount`, append `rfqIds`
   - All-or-nothing — no orphan invitations

3. **Lines migration**:
   - When `dto.lines` (legacy) → keep inline (backward compat, set `linesStorage: 'inline_legacy'`)
   - When `dto.boqItemIds` → call `rfqLineService.snapshotFromBoq(ctx, rfqId, boqItemIds, dto.trade)` after RFQ create
   - When `dto.adHocLines` (new field?) → call `rfqLineService.addRfqLinesBulk(ctx, rfqId, dtos)`
   - **Critical**: ensure RFQ document is created BEFORE sub-collection writes (sub-collection requires parent path) — use `await` chain, NOT parallel `Promise.all`

4. **`updateRfq()`**: if `status` changes to `closed` AND `sourcingEventId` is set → call `sourcingEventService.recomputeSourcingEventStatus(ctx, sourcingEventId)` to propagate up

5. **Fix `ctx.userId` → `ctx.uid`** (known issue per P3 changelog) — but only on lines we touch, NOT a sweep refactor (separate cleanup task)

**Pattern reference**: `awardRfq()` in `comparison-service.ts` is a good example of atomic primary-path + post-trigger.

### 3.4 — Tests (Google Presubmit, ~500-700 LOC)

Files:
- `src/subapps/procurement/services/__tests__/sourcing-event-service.test.ts` (NEW)
- `src/subapps/procurement/services/__tests__/rfq-line-service.test.ts` (NEW)
- `src/subapps/procurement/services/__tests__/rfq-service.test.ts` — extend if exists, else NEW

**Coverage targets**:
- ✅ Tenant isolation (companyId match required)
- ✅ FSM transitions (sourcing_events: draft → active → partial → closed → archived)
- ✅ Atomic fan-out: RFQ + N invitations created together OR none (transaction failure path)
- ✅ Snapshot semantics: BOQ change AFTER snapshot does NOT affect existing line
- ✅ Public projection strips `unitPrice`, `boqItemId`, `source`, `companyId`
- ✅ Sub-collection writes only via canonical service (not direct addDoc)
- ✅ `deriveSourcingEventStatus()` aggregation correctness
- ✅ Audit entry written for create/update/archive
- ✅ `companyId` denormalized on every line (CHECK 3.10 prep)

**Pattern reference**: existing `__tests__/` in services directory.

### 3.5 — ADR-327 update

Same-commit update:
1. Top-level changelog (line ~18-43) — short summary line for step (c)
2. §17 Multi-Vendor section (line ~819) — detailed entry with file inventory + Google-level declaration

### 3.6 — Pre-commit hooks expected to fire

- **CHECK 3.7** (SSoT ratchet): blocks new `addDoc` / `.collection().doc()` violations on `sourcing_events` + `rfqs/{id}/lines` — already enforced by registry modules from step a. New service files MUST be the only writers.
- **CHECK 3.10** (companyId baseline): every `query() + where()` on these collections must include `companyId` — denormalize on every line + every event.
- **CHECK 3.15** (firestore-index-coverage): zero-tol on touch — every `subscribe(KEY, { constraints })` or `getAll(KEY, { constraints })` needs matching index. Step (b) already added 7 — verify queries match. May need extra indexes if service queries diverge.
- **CHECK 3.17** (entity-audit-coverage): if any of the 3 service files writes to a tracked collection, MUST call `EntityAuditService.recordChange()`. `sourcing_events` not in tracked list (yet) — RFQs were not previously tracked either; verify before adding to baseline.
- **CHECK 3.22** (dead-code ratchet): types from step a are ABOUT to become reachable — exit ratchet should DECREASE when imports land.
- **N.7.1**: file size ≤500 LOC. If `rfq-line-service.ts` exceeds → split (e.g., `rfq-line-snapshot-helper.ts`).
- **N.11**: zero hardcoded strings. No user-facing strings in service files anyway (server-only); only error messages → use plain English (server logs, not user-facing) per CLAUDE.md exception.

---

## ⚠️ CRITICAL — DO NOT (CLAUDE.md non-negotiables)

1. ❌ **DO NOT push** without explicit order (N.(-1))
2. ❌ **DO NOT skip Phase 3 ADR update** — same commit
3. ❌ **DO NOT use `addDoc()`** anywhere — SSoT registry blocks it via `sourcing-event-entity` + `rfq-line-entity` modules. Use `setDoc(ref, data, { merge: false })` with explicit ID from generator
4. ❌ **DO NOT use `ctx.userId`** — broken in legacy rfq-service per P3 changelog. Use `ctx.uid` only
5. ❌ **DO NOT skip atomic transaction** for Q28 fan-out — orphan vendor_invites are a correctness bug, not a perf concern
6. ❌ **DO NOT live-update from BOQ** — snapshot semantics per Q29. Once line is created with `source: 'boq'`, it freezes
7. ❌ **DO NOT expose `unitPrice` to vendors** — always go through `toPublicRfqLine()` for vendor portal payloads
8. ❌ **DO NOT add hardcoded i18n strings** — service files are server-only (no t() calls); error strings are server-log only
9. ❌ **DO NOT touch UI files** in step (c) — wizard UI is steps (f-h)
10. ❌ **DO NOT touch API routes** in step (c) — that's step (d)

---

## 🎯 ARCHITECTURE DECISIONS ALREADY TAKEN (do not re-litigate)

| Q | Decision | Lock-in |
|---|----------|---------|
| Q28 | HYBRID B fan-out: 1 RFQ → N invitations (vendor anonymity, atomic transaction) | Locked |
| Q29 | HYBRID Γ: lines as sub-collection `rfqs/{id}/lines/{lineId}` with `source: 'boq'\|'ad_hoc'`, snapshot semantics | Locked |
| Q30 | HYBRID Γ: 2 entry points (project tab + sidebar) → shared 5-step wizard (UI step f-h) | Locked |
| Q31 | HYBRID A-Enhanced: 1 RFQ = 1 trade SEMPRE; multi-trade via `sourcing_events` parent; status server-aggregated | Locked |
| Q32 | Option B: retain `vendor_invites` collection name (do NOT rename to `rfq_invitations`) | Locked |

---

## 📐 ROADMAP PROGRESS

```
✅ a. Types + enterprise IDs + SSoT registry      (COMMIT d4c3f5d1, 2026-04-29)
✅ b. Firestore rules + indexes (deployed)        (COMMIT d0ef2c3c, 2026-04-29)
⏸️ c. Services (sourcing-event + rfq-line + rfq-service modify)  ← NEXT SESSION
⏸️ d. API endpoints (POST /api/sourcing-events, etc.)
⏸️ e. Vendor portal HMAC + public route extension (mostly P3, minor extension)
⏸️ f. UI wizard Step1-Step2 (Project select + Trade select)
⏸️ g. UI wizard Step3 (BOQ picker + ad-hoc lines editor)
⏸️ h. UI wizard Step4-Step5 (vendor multi-select + meta + submit)
⏸️ i. Email invitation template extension (mostly P3, minor extension)
⏸️ j. Comparison view extensions (multi-vendor, sourcing event aggregate)
⏸️ k. ADR-327 §17 final + changelog (Phase 1 complete)
```

---

## 🧪 PRE-FLIGHT CHECKLIST (run BEFORE step c implementation)

After Step 1 reads complete, verify in parallel:
1. `git log --oneline -3` → confirm `d0ef2c3c` is HEAD (step b committed)
2. `git status` → working tree clean
3. `npm run ssot:audit` → confirm no SSoT regression from step b
4. Glob `src/subapps/procurement/services/*-service.ts` → confirm pattern files exist
5. Read `src/subapps/procurement/services/rfq-service.ts` (full) — known broken `ctx.userId` pattern, ~600 LOC
6. Read `src/subapps/procurement/services/vendor-invite-service.ts` — fan-out pattern reference
7. Glob `src/types/boq/**` → locate `BOQItem` type for snapshot field mapping

---

## 📚 REFERENCES

- **Master prompt** (Giorgio's original session-start): Q1-Q4 architectural decisions, file inventory NEW vs REFACTOR, 8-index list, non-negotiables checklist
- **ADR-327 master**: `docs/centralized-systems/reference/adrs/ADR-327-quote-management-comparison-system.md`
- **Step (a) commit**: `d4c3f5d1 feat(adr-327): Multi-Vendor Architecture Phase 1 step (a) — Domain Foundation`
- **Step (b) commit**: `d0ef2c3c feat(adr-327): Multi-Vendor Architecture Phase 1 step (b) — Firestore Rules + Indexes`
- **Step (b) deployment**: 2026-04-29 — `firebase deploy --only firestore:rules,firestore:indexes` → rules released, 7 indexes building (2-5 min server-side, ready by next session)
- **Pattern reuse**:
  - Service shape: `src/subapps/procurement/services/quote-service.ts`
  - Atomic fan-out: `src/subapps/procurement/services/vendor-invite-service.ts`
  - Atomic post-trigger (status propagation): `awardRfq()` in `src/subapps/procurement/services/comparison-service.ts`
  - BOQ read pattern: `createRfqFromBoqItems()` in current `rfq-service.ts` (P5-BOQ)
- **Enterprise IDs (already wired step a)**: `generateSourcingEventId()`, `generateRfqLineId()` in `src/services/enterprise-id.service.ts`
- **SSoT registry modules (registered step a)**: `sourcing-event-entity`, `rfq-line-entity` (Tier 2) in `.ssot-registry.json` — block direct writes outside canonical services

---

## 🏁 SUCCESS CRITERIA — step (c)

1. ✅ `sourcing-event-service.ts` exists, exports listed methods, ≤500 LOC
2. ✅ `rfq-line-service.ts` exists, exports listed methods, ≤500 LOC (split if needed)
3. ✅ `rfq-service.ts` populates 5 new optional fields, atomic fan-out for Q28, sub-collection writes via line service
4. ✅ Snapshot semantics verified by test (BOQ change post-create does NOT affect existing line)
5. ✅ Atomic fan-out verified by test (failure mid-transaction → no orphan invitations)
6. ✅ Public projection test confirms `unitPrice` stripped
7. ✅ ADR-327 changelog entry for step (c) — top-level + §17 detailed — same commit
8. ✅ Pre-commit hooks all green (especially CHECK 3.7, 3.10, 3.15, 3.17, 3.22, N.7.1)
9. ✅ No push (only commit)
10. ✅ Google-level declaration at end (target: ✅ FULL — no naming gap on services step; Q32 naming gap is collection-level only, services don't propagate it)

---

## 💬 IF GIORGIO SAYS "VAI"

Proceed with step (c) following the protocol above. If anything in the recognition phase contradicts this handoff, STOP and report — code is SoT, the handoff may be wrong.

If anything blocks (CHECK 3.10 missing companyId, 3.15 missing index for new query shape, transaction limit exceeded), report it as a blocker before forcing through.

**Suggested first user message after /clear**: simply send Giorgio's task or `ΠΡΟΧΩΡΑ ΜΕ Ο,ΤΙ ΑΝΑΦΕΡΕΙ ΤΟ HANDOFF` (same as previous session). Reads this file → declares model → confirms reads → waits for "ok step c" → implements.
