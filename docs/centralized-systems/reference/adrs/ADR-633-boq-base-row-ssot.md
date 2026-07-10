# ADR-633: BIM BOQ base-row SSoT (`bim/services`)

## Status
✅ **ACTIVE — 2026-07-10** — Cluster #21 of the jscpd de-duplication sweep (ADR-584 / N.18), targeting `src/subapps/dxf-viewer/bim/services/`. The ~30 constant default fields every BIM-generated BOQ row stamped are centralised into one factory (plus a single-entity row helper) — **1:1 values**, verified field-by-field.

**Related:**
- **ADR-395 / ADR-449 / ADR-376 / ADR-408** — the BOQ auto-sync features (floor scope, structural finish mirror, opening signature groups, Η-Μ entities) whose rows share the default block.
- **ADR-628 / ADR-629 / ADR-631** — clusters #18/#19/#20 of the same sweep. **ADR-630** — winder walkline (concurrent, unrelated).
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28 / N.18) — gated the iteration.

---

## Context

A real SSoT audit (fresh jscpd pass grouping `bim/services` at **300 cloned lines / 19 intra-dir pairs**, plus full reads of every BOQ writer) found the `BOQItem` payload's ~30 **constant default fields** — `companyId`/`projectId`/`buildingId` + floor scope, the `null` link fields, the zero costs, `source: 'bim-auto'`, `status: 'draft'`, `qaStatus: 'pending'`, timestamps, `sourceType`/`sourceEntity*`, `detached` — stamped inline in **5 writers** (`BimToBoqBridge`, `boq-multi-layer-builder`, `envelope-boq-sync`, `opening-boq-grouper`, `stair-boq-sync`). `boq-multi-layer-builder` already exported a `buildBaseRow` for exactly this (adopted only by `structural-finish-boq`) — the same *adopt-existing* gap as clusters #18–#20: the canonical SSoT existed but the other writers bypassed it.

Additionally, the single-entity writers (`BimToBoqBridge` single-entry + `stair-boq-sync`) shared the identical *tail* on top of the base: an ATOE mapping (`categoryCode`/`titleEL`/`unit`) + measured quantity + the four `null` grouping fields, `stripUndefinedDeep`-sanitised.

---

## Decision

Extract the base-row factory into a dedicated module and adopt it everywhere; add a single-entity row helper for the shared tail. Keep every emitted field value byte-for-byte.

### `boq-base-row.ts`
- **`buildBoqBaseRow(id, context, entityId, entityType, existingCreatedAt): BoqBaseRow`** — the ~30 default fields (moved verbatim from `boq-multi-layer-builder`'s `buildBaseRow`). `context: BoqBaseRowContext` (minimal `company/project/building` + optional `floorId`) which every writer's context structurally satisfies. `entityType: BoqSourceEntityType` (= `BOQItem['sourceEntityType']`, wider than `BimEntityType`) so non-BIM sources like `'envelope'` fit without a cast.
- **`buildSingleEntityBoqRow(id, context, entityId, entityType, mapping, quantity, existingCreatedAt): Record<string, unknown>`** — base + ATOE mapping + quantity + no-grouping tail, `stripUndefinedDeep`-sanitised. The "one BIM entity → one BOQ row" shape.

Adoption:
- `boq-multi-layer-builder` + `structural-finish-boq` → re-point to `buildBoqBaseRow` (old `buildBaseRow` deleted).
- `BimToBoqBridge` (single-entry) + `stair-boq-sync` → `buildSingleEntityBoqRow`.
- `opening-boq-grouper` → `buildBoqBaseRow` (+ its `sourceEntityId: null` group override, preserved 1:1).
- `envelope-boq-sync` → `buildBoqBaseRow` + explicit overrides (`scope: 'floor'`, zoned `title`, `materialId`), preserved 1:1.

### `boq-base-row.ts` — group-parent helper (follow-up)
- **`buildGroupParentBoqRow(parentId, context, entityId, entityType, mapping, quantity, existingCreatedAt): BuiltBoqRow`** — the `isGroupParent: true` summary row (no material/layer link) that `boq-multi-layer-builder` and `structural-finish-boq` both stamped identically (only mapping + quantity differed). `BuiltBoqRow` itself moves here (SSoT home) and is re-exported from `boq-multi-layer-builder` for back-compat.

### `boq-firestore-sync.ts` — sync lifecycle SSoT (follow-up)
The Firestore upsert/delete lifecycle every managed BOQ row shares — **detach guard** (`detached === true` → never auto-touched), `quantity <= 0` → orphan cleanup, `createdAt`-preserving upsert — owned once:
- **`syncManagedBoqRow({ id, quantity, buildPayload, logLabel, logContext? })`** — `buildPayload(existingCreatedAt)` is a closure invoked only when a write is needed. Adopted by `stair-boq-sync` (component rows) + `envelope-boq-sync` (zone rows).
- **`deleteManagedBoqRow(id, logLabel, logContext?)`** — single-id detach-guarded delete. Adopted by `stair-boq-sync` (`deleteStairBoq`) + `BimToBoqBridge` (`deleteBoqItemForBim` cascade).
- `BimToBoqBridge.upsertSingleEntry` deliberately keeps its **bespoke** lifecycle — its detach guard is action-scoped (`updated` only), a different contract. Its two internal prologue/tail clones were instead folded into local `resolveEntityAtoeMapping` + `upsertRowGroup` helpers.

---

## Consequences

- **One SSoT owns the BOQ default block**; a change to a default (e.g. `wastePolicy`) happens once. Divergent rows override explicitly after the spread (`opening` group id, `envelope` scope/material).
- **1:1 values.** No emitted field changed; verified field-by-field + `bim/services` **16 suites / 273 tests** green.
- **No `any` / `as any` (beyond the pre-existing `as unknown as Record` Firestore-sanitise idiom).** The `entityType` param was *widened* to the real `sourceEntityType` type rather than cast.
- **Clone reduction:** the BOQItem-payload clones eliminated; full-scan ratchet **3494 baseline → 3248** working-tree (concurrent with #18–#20 + ADR-630). `jscpd:diff` on the payload construction is clean.
- **Firestore-sync follow-up — DONE (same session).** The BOQ upsert/delete sync clones the base-row extraction surfaced in `jscpd:diff` (6 clones across `envelope`/`stair`/bridge) are now centralised into `boq-firestore-sync.ts` (`syncManagedBoqRow` + `deleteManagedBoqRow`) + the `buildGroupParentBoqRow` group-parent helper + bridge-local `resolveEntityAtoeMapping`/`upsertRowGroup`. `jscpd:diff` clean; **132 BOQ jest green**, no `SKIP_JSCPD_DIFF`.

---

## Changelog
- **2026-07-10** — Created. Cluster #21. New `boq-base-row.ts` (`buildBoqBaseRow` + `buildSingleEntityBoqRow` + `BoqBaseRowContext`/`BoqSourceEntityType`); 6 BOQ writers migrated; ADR + adr-index + memory pointer. Firestore-sync SSoT noted as follow-up. Renumbered ADR-632 → ADR-633 (ADR-632 collision with stairwell-auto-opening).
- **2026-07-10** — Firestore-sync follow-up landed: `boq-firestore-sync.ts` (`syncManagedBoqRow` + `deleteManagedBoqRow`) adopted by `stair`/`envelope`/bridge; `buildGroupParentBoqRow` (+ `BuiltBoqRow` moved to `boq-base-row`) for multi-layer/finish parents; bridge-local `resolveEntityAtoeMapping`/`upsertRowGroup`. 6 co-staged clones eliminated → `jscpd:diff` clean, 132 BOQ jest green, no skip.
