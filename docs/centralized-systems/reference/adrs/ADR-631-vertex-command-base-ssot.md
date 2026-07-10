# ADR-631: Vertex/overlay command base SSoT (`core/commands`)

## Status
✅ **ACTIVE — 2026-07-10** — Cluster #20 **Stage 1** of the jscpd de-duplication sweep (ADR-584 / N.18), targeting `src/subapps/dxf-viewer/core/commands/`. The vertex-edit + overlay command families adopt the existing `BaseCommand` and two new thin family bases — **identical public APIs**, **1:1 behaviour**.

**Related:**
- **ADR-613** — `BaseCommand` (the pre-existing command Template-Method base: id/timestamp/`redo()→execute()`/`canMergeWith()→false`/`serialize()` envelope) that ~57 commands still bypassed via `implements ICommand`.
- **ADR-507 §8** — the live-drag coalescing rule (`canMergeDragSamples`) the move commands share.
- **ADR-626 / ADR-628 / ADR-629** — clusters #17/#18/#19 of the same sweep. **ADR-627** — hatch grip parity (concurrent).
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28 / N.18) — gated the iteration; `jscpd:diff` clean on all touched files, no `SKIP_JSCPD_DIFF`.

---

## Context

A real SSoT audit (fresh jscpd pass grouping `core/commands` at **434 cloned lines / 30 intra-dir pairs**, plus full reads of the vertex + overlay command families and the existing `BaseCommand`) found that only 7 of ~64 command classes extended `BaseCommand`; the rest re-declared `id`/`timestamp`, the `serialize()` envelope, `canMergeWith(){return false}`, and `redo(){this.execute()}` verbatim (the same *adopt-existing* gap as clusters #17–#19). The user chose scope **"all, in order"**; Stage 1 covers the vertex + overlay families (the densest clean clones).

Two clone axes remained after a naive `BaseCommand` adoption:
1. **Drag-merge skeleton** — `MoveVertex` / `MoveOverlayVertex` / `MoveOverlay` / the two `Move*Multiple*` commands repeated `redo` + a `canMergeWith` gating on *same concrete command + same target + live-drag window* + a `mergeWith` keeping the original start and adopting the latest end.
2. **Target getters + `validate()`** — `Move`⇄`Remove` (entity) and `Move`⇄`Delete` (overlay) share `getAffectedEntityIds()` + the target guard of `validate()`. Because the move variants are drag and the remove/delete variants are not, a single shared base would need a diamond.

---

## Decision

Adopt `BaseCommand` across the vertex + overlay commands (drop id/timestamp/serialize-envelope/redo/canMergeWith boilerplate, implement only `serializeData()`), and add three thin SSoTs; keep every constructor signature, `serialize()` output, and observable scene/store effect unchanged.

### `DragVertexEditCommand<TSelf>` (drag-merge Template-Method)
Owns `redo()` + the `canMergeWith`/`mergeWith` policy; subclasses supply `isSameCommand` / `sameTarget` / `cloneForMerge`. Adopted by `MoveOverlayCommand`, `MoveMultipleOverlaysCommand`, `MoveMultipleOverlayVerticesCommand` (the drag commands with no family-base sibling). `canMergeDragSamples` (ADR-507 §8) stays the SSoT window predicate.

### `EntityVertexCommand` / `OverlayVertexCommand<TStore>` (family bases)
Own the target surface (`entityId`/`overlayId` + `vertexIndex` + the scene manager / overlay store), `getAffectedEntityIds()`, and the shared `validate()` prologue (via the new `vertex-command-validation.ts` free functions `validateEntityVertexTarget` / `validateOverlayVertexTarget`). `OverlayVertexCommand` is generic over the concrete store so each subclass keeps its full store type. Adopted by:
- `RemoveVertexCommand` → `EntityVertexCommand`; `MoveVertexCommand` → `EntityVertexCommand` + inline drag.
- `DeleteOverlayVertexCommand` → `OverlayVertexCommand` (layers its min-3-vertices check); `MoveOverlayVertexCommand` → `OverlayVertexCommand` + inline drag (layers its bounds check).

The two move-vertex commands inline their `canMergeWith`/`mergeWith` (rather than `DragVertexEditCommand`) because they cannot extend both a family base and the drag base — and their inline drag is not a jscpd clone (distinct target fields), exactly as it was pre-sweep. `AddVertexCommand` stays on `BaseCommand` (its `insertIndex` surface + error strings differ; not a clone).

### Boy-Scout
Removed the dead public getters revealed adjacent by the migration (`getEntityId`/`getVertexIndex`/`getOldPosition`/`getNewPosition`/`getRemovedPosition`/`getRemovedVertex` — all 0 external + 0 test uses).

---

## Consequences

- **`BaseCommand` owns the command envelope once**; the drag policy and the vertex-target surface each own theirs once.
- **Public API unchanged.** Constructor signatures + `serialize()` output preserved; external consumers (`CommandRegistry` deserialize, `useGripMovement`, `useSmartDelete`, `overlay-grip-commit-adapters`, `canvas-mouse-drag-handlers`, `useModifyTools`) untouched.
- **No `any` / `as any` / `@ts-ignore`.** Bases are generic; `MoveOverlayCommand`'s original manual `!isDragging` guard was verified identical to `canMergeDragSamples` before adoption.
- **Clone reduction:** `core/commands` intra-dir clones drop (vertex `Move`⇄`Remove` + overlay `Delete`⇄`Move` clones eliminated); full-scan ratchet **3494 baseline → 3256** working-tree (concurrent with #18/#19 + ADR-627). `jscpd:diff` clean on all 12 touched files, no `SKIP_JSCPD_DIFF`.
- **Tests:** `core/commands` **88 suites / 628 tests** green (incl. `MoveVertexCommand` drag-merge parity + all importers).
- **Stage 2 pending** (same cluster, next session): the entity-command transform/array/edit twins (`Rotate`⇄`Scale` residual, `DeleteArray`⇄`ExplodeArray`, `Extend`⇄`Trim`, `WallMerge`⇄`WallSplit`, the radius-edit family).

---

## Changelog
- **2026-07-10** — Created. Cluster #20 Stage 1. New `drag-vertex-edit-command.ts`, `entity-vertex-command.ts`, `overlay-vertex-command.ts`, `vertex-command-validation.ts`; vertex + overlay command families migrated to thin bindings; dead-getter Boy-Scout; ADR + adr-index + memory pointer. Stage 2 (entity-command pairs) pending.
