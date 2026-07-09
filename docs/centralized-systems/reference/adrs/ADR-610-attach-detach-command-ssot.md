# ADR-610: Attach/Detach command factory SSoT (`AttachDetachCommandBase`)

## Status
✅ **ACTIVE — 2026-07-09** — De-duplication of the 9 structural binding attach/detach commands under `src/subapps/dxf-viewer/core/commands/entity-commands/` (`Attach{Columns,ColumnFooting,Stairs,WallsBase,WallsTop}Command` · `Detach{Columns,ColumnFooting,Stairs,Walls}Command`). Each was a ~130–160-line `ICommand` class repeating the SAME plumbing verbatim — `id`/`timestamp`, a lazy-built `patches` array + `wasExecuted`, the identical execute/undo/redo triple (build-once → apply next|prev per patch → post-apply → persist signal), `signalPersist`, `canMergeWith`, the `serialize` envelope, the per-domain geometry recompute, and the snapshot loop. Collapsed onto a **Template-Method class hierarchy** (`AttachDetachCommandBase` → 3 domain bases → 2 shape bases → thin cells), each keeping its exact `new XCommand(...)` public API.

**Related:**
- **ADR-607** (batch-create command factory) — the sibling `entity-commands` de-duplication (create bucket). ADR-610 is the attach/detach (binding-mutation) bucket. Template-Method form here because the attach/detach constructors diverge (`footingId+ids` · `side+hostId+targets` · `columnIds`), which a fixed-ctor factory can't unify without breaking the public API.
- **ADR-605 / 606 / 609** — the same 2026-07-09 jscpd sweep (factory + thin bindings archetype).
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28 / N.18) — gated the sibling-clone iteration: the first cut left 10 structural twins, the second 2; the domain + shape bases drove it to zero.
- **ADR-401 / 459** — the binding semantics + persistence contract (`attach-persist-signal`) reproduced 1:1.

---

## Context

A real SSoT audit (grep + full diffs of all 9 against `AttachColumnFootingCommand.ts`, plus a jscpd pass listing 27 internal clone pairs — the 70-line `WallsBase↔WallsTop` twin being the worst) confirmed the only pre-existing shared owners were `attach-persist-signal.ts` (persist SSoT) and `entity-attach-detach.ts` (`detachEntitySide`). The invariant `ICommand` body was copy-pasted; the variance lives on **two orthogonal axes**:

- **Domain** (column / wall / stair) → the geometry+validation recompute + (walls) the `kind`-carrying patch + the hosted-opening cascade;
- **Shape** (host+targets / footingId+ids / side+targets) → the constructor, `validate`, `serialize().data`, `getAffectedEntityIds`, and the binding mutation.

Single inheritance can't model two axes flatly, so the hierarchy composes them.

---

## Decision

### 1. Generic base — `attach-detach-command-base.ts`
`AttachDetachCommandBase<TParams, TPatch>` owns the `ICommand` plumbing: id/timestamp, the lazy `patches`, execute/undo/redo, `signalPersist`, `postApply` (no-op hook), `canMergeWith`, the `serialize` envelope (subclass supplies only `serializedData()`), and the shared **`snapshotPatches`** loop (read live params → skip absent → `computeNext` returns `null` to skip an idempotent no-op → build patch).

### 2. Domain bases — `attach-detach-domain-commands.ts`
`ColumnAttachDetachCommand` / `StairAttachDetachCommand` / `WallAttachDetachCommand` bind the domain `applyEntityPatch` (→ `attach-detach-entity-recompute.ts`) + a `build*Patches` wrapper over `snapshotPatches`. The wall base additionally binds the hosted-opening cascade (`postApply`) + the `kind`-carrying `WallAttachDetachPatch`.

### 3. Shape bases (same file)
`WallHostAttachCommand` (abstract `side`; owns the host+targets `buildPatches`/`validate`/`serialize`/`getAffected`/`getDescription`) and `ColumnFootingFkCommand` (owns `columnIds` + the FK snapshot wrapper) — the second axis, added to kill the residual sibling clones between the two wall attach cells and the two footing cells.

### 4. Boy-Scout — `attachEntitySide`
Added next to the existing `detachEntitySide` in `bim/entities/entity-attach-detach.ts` (append host id dedup + set `'attached'`), replacing the 3 inline `attach{Column,Stair}Side`/wall copies.

Every concrete cell is now ~20–75 lines and keeps its exact constructor + exported target/side types (re-exported where a shape base subsumed them, e.g. `WallAttachTarget`).

### Consequences
- **−30 jscpd clones** in the full `src/` scan (3667 → 3637, CHECK 3.28) — the largest of the 2026-07-09 sweep.
- All 446 `entity-commands` tests stay green (7 attach/detach suites), so execute/undo/redo/serialize behaviour is byte-identical.
- **Sibling-clone iteration** (N.18): first cut left 10 structural twins (buildPatches loops + wall recompute/cascade + import blocks), second left 2 (wall base/top tail + footing ctor); the domain+shape bases drove `--diff` to zero. Textbook two-axis Template-Method decomposition.
- A future attachable domain = a domain base (recompute) + a shape base reuse; a future binding command = a thin cell.

---

## Changelog
- **2026-07-09** — Created (610; 608 taken by vector-PDF, 609 by ribbon-auto-bridge in the shared tree). Extracted `AttachDetachCommandBase` + 3 domain bases + 2 shape bases + `attach-detach-entity-recompute` + `attachEntitySide`; migrated all 9 commands to thin cells (identical public API). 446 tests green; jscpd −30 (3667 → 3637), `--diff` clean after the two-axis fix.
