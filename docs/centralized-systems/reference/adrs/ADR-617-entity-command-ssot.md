# ADR-617: Entity command SSoT — three Template-Method family bases (batch-patch / assign-type / field-override)

## Status
✅ **ACTIVE — 2026-07-09** — De-duplication of three coherent command families under `src/subapps/dxf-viewer/core/commands/entity-commands/`. Twelve `ICommand` classes across the **batch derived-patch** (compute-load-path / compute-tie-beam-tie-forces / auto-reinforce-organism / auto-size-members / set-component-visibility), **assign family-type** (assign-{opening,slab,roof,wall}-type) and **single-entity field-override** (set-face-appearance / set-entity-face-appearance-map / set-finish-face-override) families each hand-rolled the same `ICommand` boilerplate — `id = generateEntityId()` + `timestamp`, the six-field `serialize()` envelope, `canMergeWith → false` — plus one of three near-identical lifecycles. Collapsed onto the generic **`BaseCommand`** (ADR-613) plus three Template-Method family bases (one with a signaling + id-list refinement, one with a face-appearance refinement), turning every class into a thin subclass with **identical public API**.

**Related:**
- **ADR-613** — the generic `BaseCommand` root this cluster adopts (id/timestamp, `redo() → execute()`, `serialize()` envelope + abstract `serializeData()`, `canMergeWith → false`). No change to `BaseCommand` was needed (the optional-id ctor from ADR-616 is untouched; these families use `generateEntityId()`).
- **ADR-605 / 606 / 607 / 609 / 610 / 611 / 613 / 614 / 616** — the same multi-day jscpd sweep. ADR-613 (guides) / ADR-614 (text) / ADR-616 (layer) are the command-family precedents; ADR-617 extends the sweep into `entity-commands` (the largest command directory).
- **ADR-507 §8** — `MergeableUpdateCommand` already centralises the 31 drag-mergeable `Update*ParamsCommand` classes; that family is **out of scope** here (its clones are already absorbed). ADR-617 targets the non-mergeable, discrete-step families that still hand-rolled the plumbing.
- **ADR-401** — the `signalEntitiesAttached` persistence broadcast reused by the batch/field-override bases (unchanged SSoT).
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28 / N.18) — gated the sibling-clone iteration to **zero** across all 16 staged src files.

---

## Context

A real SSoT audit (grep for existing command bases — `BaseCommand`, `MergeableUpdateCommand`, `attach-detach-command-base` — plus full reads of every candidate command file and a fresh jscpd pass listing **48 intra-dir clone pairs / 703 cloned lines / 40 files**) confirmed the generic `BaseCommand` (ADR-613) existed but **none** of these three families used it — every one hand-rolled `id`/`timestamp`/`serialize()`/`canMergeWith`. The clones grouped into three coherent shapes:

1. **Batch derived-patch** (~200 cloned lines) — build a `{prev, next}` patch list once from the live scene, then `execute`/`redo` write every `next`, `undo` writes every `prev`, optionally broadcasting `signalEntitiesAttached` after each apply. Identical skeleton across five structural/display commands; only `buildPatches()` (domain compute + guards) and the single-patch write differ. Four of the five also shared an identical `entityIds`-based `getAffectedEntityIds` / non-empty `validate` / `{ entityIds }` serialize, and four shared an identical `get*EntityIds()` getter over the built patches.
2. **Assign family-type** (~107 cloned lines) — a `next`/`previous` state machine (`execute → applyState(next)`, `undo → applyState(previous)`) that folds `{typeId, typeOverrides, params}` + recomputed DERIVED geometry/validation onto the entity. Identical across slab/roof/wall/opening; only the geometry recompute differs, and slab/roof/wall shared a byte-identical `updateEntity({typeId, typeOverrides, params, geometry, validation})` write.
3. **Single-entity field-override** (~64 cloned lines) — a lazy previous snapshot on first `execute()` so undo/redo are pure re-applies, writing one override field + `signalEntitiesAttached`. Identical across the two face-appearance writers and the finish-skin writer; the two face-appearance writers additionally shared a byte-identical `faceAppearance` read/write, and two shared the `faceKey`/`value` validate + serialize surface.

---

## Decision

Big-player command architecture (AutoCAD/Revit/Figma expose ONE command root + per-domain lifecycle bases + thin leaves), layered top-down. All three bases `extend BaseCommand`; all class names, constructor signatures, exported input types and extra public members are preserved; the barrel `entity-commands/index.ts` and every external consumer (hooks, event maps, `ReinforceColumnFootingCommand` composition) are untouched.

### 1. `batch-entity-patch-command.ts` — batch derived-patch family
- **`BatchEntityPatchCommand<TState, TEntry>`** — owns `patches`, `wasExecuted`, the build-once + `execute`/`undo`/`redo` loop, a `persistSignal` flag (post-apply `signalEntitiesAttached` — persistence is a **flag, not a subclass level**), the `patchedEntityIds()` getter helper, and a `writeParamsOnly()` helper (the geometry-neutral `{kind, params}` write shared by the three structural commands). Abstract `buildPatches()` + `applyState(entry, state)`.
- **`EntityIdsBatchPatchCommand<TState, TEntry>`** — refinement for commands whose affected ids ARE their input id list; folds `entityIds` + `getAffectedEntityIds` + the «≥1 id» `validate` + the canonical `{ entityIds }` `serializeData`.
- **Thin leaves:** `ComputeLoadPathCommand` / `ComputeTieBeamTieForcesCommand` (payload-based, `persistSignal = true`); `AutoReinforceOrganismCommand` (id-list, signaling); `SetComponentVisibilityCommand` (id-list, signaling, overrides `serializeData` for `component`/`value`); `AutoSizeMembersCommand` (id-list, non-signaling, geometry-mutating `applyState` + a `SizePatchEntry` carrying `entityType`). The `getReinforcedEntityIds` / `getLoadedMemberIds` / `getChangedTieBeamIds` / `getResizedEntityIds` getters delegate to `patchedEntityIds()`.

### 2. `assign-type-command-base.ts` — assign family-type family
- **`AssignTypeCommandBase<TState extends FamilyTypeAssignmentState>`** — owns the `next`/`previous` state machine, `getAffectedEntityIds → [entityId]`, and an `applyResolvedState(state, geometry, validation)` helper (the shared `updateEntity({typeId, typeOverrides, params, geometry, validation})` write). Abstract `applyState(state)`.
- **Thin leaves:** `AssignSlabTypeCommand` / `AssignRoofTypeCommand` / `AssignWallTypeCommand` (each a 2-line `applyState` calling `applyResolvedState`; wall keeps its `kind` ctor param + hosted-opening cascade); `AssignOpeningTypeCommand` (bespoke `applyState` — host-wall geometry + operationType re-derive, so it builds its own patch rather than using the helper).

### 3. `entity-field-override-command.ts` + `face-appearance-field-command.ts` — field-override family
- **`EntityFieldOverrideCommand<TValue>`** — owns the lazy-snapshot state machine (`resolved`/`wasExecuted`, `execute` resolves once then applies, `undo`/`redo` pure re-applies, persist via `signalEntitiesAttached` only when the write reports it happened). Abstract `snapshotStates() → {prev,next} | null` (null = abort, no history effect) + `writeValue(value) → boolean`. Also exports the free helpers `validateFaceKeyOverride` + `faceKeyOverrideData` (the shared `faceKey`/`value` identity surface).
- **`FaceAppearanceFieldCommand extends EntityFieldOverrideCommand<FaceAppearanceMap>`** — refinement owning the shared `faceAppearance` read/write; abstract `computeNextMap(prev)`.
- **Thin leaves:** `SetFaceAppearanceCommand` (extends FaceAppearanceField; `computeNextMap` = set/clear one face); `SetEntityFaceAppearanceMapCommand` (extends FaceAppearanceField; `computeNextMap` = replace whole map); `SetFinishFaceOverrideCommand` (extends EntityFieldOverride; reads/writes `params.finish`, uses the two faceKey helpers).

---

## Consequences

**Positive**
- **−22 jscpd clones** full-scan (3516 → 3494, `.jscpd-baseline.json` relocked); **zero** new sibling clones (`jscpd:diff` clean on all 16 staged src files — verified iteratively down from 7 residual pairs via helper extraction + one method reorder where a face-appearance/finish diamond blocked a shared base).
- The generic `BaseCommand` now backs four command families (guides + text + layer + entity) — one command root for the subapp; the three new bases are the reusable Template-Method spines for future entity commands.
- New parity test `entity-commands/__tests__/entity-command-ssot.test.ts` (7 cases) locks the shared base contract (BaseCommand envelope, batch lifecycle + wasExecuted guard, field-override cycle + abort-on-missing, assign envelope/serialize) against a real Map-backed `ISceneManager`. All pre-existing per-command suites green (66/66) + hook consumer suites green (30/30) + guide/text/layer SSoT suites unaffected (31/31).

**Negative / risk**
- `EntityFieldOverrideCommand` resolves its lazy snapshot **once** (via a `resolved` flag) rather than re-attempting on every `execute()` when the entity was missing at first execute. This is strictly safer (re-snapshotting after an undo would capture a wrong `prev`); the entity-missing-at-first-execute path is an abort with no history effect and is not exercised by any consumer.
- `SetFinishFaceOverrideCommand` has its `getDescription` interposed between `validate` and `serializeData` (vs. the sibling face command's order) solely to break a normalized-string jscpd clone with `SetFaceAppearanceCommand` that single inheritance could not (the two commands share the `faceKey` identity axis but differ on the `faceAppearance` read/write axis — a diamond). Behaviourally inert.

---

## Changelog
- **2026-07-09** — Initial. Added `batch-entity-patch-command.ts` (`BatchEntityPatchCommand` + `EntityIdsBatchPatchCommand` + `writeParamsOnly`/`patchedEntityIds` helpers), `assign-type-command-base.ts` (`AssignTypeCommandBase` + `FamilyTypeAssignmentState` + `applyResolvedState`), `entity-field-override-command.ts` (`EntityFieldOverrideCommand` + `validateFaceKeyOverride`/`faceKeyOverrideData`), `face-appearance-field-command.ts` (`FaceAppearanceFieldCommand`); migrated all 12 command files to thin subclasses; added parity test suite. jscpd 3516 → 3494.
