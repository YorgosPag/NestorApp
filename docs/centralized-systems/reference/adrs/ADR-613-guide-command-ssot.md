# ADR-613: Guide command SSoT — BaseCommand + Template-Method guide bases

## Status
✅ **ACTIVE — 2026-07-09** — De-duplication of the construction-guide command family under `src/subapps/dxf-viewer/systems/guides/commands/`. The 7 command files (18 `ICommand` classes: create / delete / move / rotate / scale-equalize / pattern / entity) each repeated three families of boilerplate — the universal `ICommand` envelope (`id`/`timestamp` init, `redo → execute`, `canMergeWith → false`, the `serialize()` shape), the "add guides then restore-on-redo / remove-on-undo" lifecycle, and the guide geometry (entity → guide endpoints, X/Y → XZ rotation). Collapsed onto a generic **`BaseCommand`** base plus two guide Template-Method bases and a pure-geometry helper module, turning every class into a thin subclass with **identical public API**.

**Related:**
- **ADR-189** — Construction Grid & Guide System (all B5/B8/B14/B17/B19/B23/B24/B28-B33/B37 conventions reproduced 1:1).
- **ADR-605 / 606 / 607 / 609 / 610 / 611** — the same multi-day jscpd sweep (factory / Template-Method / composed-computer + thin bindings archetype). ADR-613 is the guide-command bucket; **ADR-610** (attach/detach command base) is the closest class-based precedent.
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28 / N.18) — gated the sibling-clone iteration to zero.

---

## Context

A real SSoT audit (grep for existing command bases + full reads of all 7 guide command files, plus a fresh jscpd pass listing **29 intra-dir clone pairs / 438 cloned lines** — `systems/guides/commands`, a compact command family) showed there was **no generic command base** — only domain-specific bases (`attach-detach-command-base.ts` from ADR-610, `MergeableUpdateCommand`, `AttachWallsBaseCommand`). Every guide command therefore hand-rolled the same `ICommand` plumbing. The variance lived on a small number of axes:

1. **`ICommand` envelope** — `readonly id = generateEntityId()`, `readonly timestamp = Date.now()`, `redo() { this.execute(); }`, `canMergeWith() { return false; }` and the six-field `serialize()` return (`{ type, id, name, timestamp, data, version: 1 }`) — repeated in **all 18** classes. Only `name`/`type`/`data` differ.
2. **Created-guides lifecycle** — `execute()` = restore-cached-else-build, `undo()` = remove-all, `getAffectedEntityIds()` = map ids — **identical** across 9 create/entity/pattern classes. Only the build body differs.
3. **Batch-rotate lifecycle** — a `rotatedEndpoints` map + snapshot-based execute/undo — identical between `RotateAllGuides` and `RotateGuideGroup` (they differ only in *which* guides they select).
4. **Guide geometry** — the entity → guide construction (LINE/ARC → diagonal, CIRCLE → X+Y) was copy-pasted between `GuideFromEntity` and `BatchGuideFromEntities` (34-line clone); the X/Y → XZ rotation endpoint conversion appeared three times across the rotate commands.

---

## Decision

Big-player command architecture (AutoCAD / Figma expose ONE command root and thin per-operation leaves, not bespoke plumbing per command), layered top-down:

### 1. `core/commands/base-command.ts` — generic `BaseCommand` (Template-Method)
The single, reusable `ICommand` root. Owns `id`/`timestamp`, `redo() → execute()`, `canMergeWith() → false`, and the `serialize()` envelope; subclasses supply only `name`/`type`, `execute`/`undo`/`getDescription`/`getAffectedEntityIds` and the serialized payload via **`protected abstract serializeData(): Record<string, unknown>`**. Reusable by future clusters (text / layer / vertex commands) — adopted incrementally (Boy-Scout), zero impact on commands that don't extend it.

### 2. `systems/guides/commands/guide-command-base.ts` — guide Template-Method bases
- **`CreatedGuidesCommand extends BaseCommand`** — owns the created-guides lifecycle; subclass implements only `protected buildGuides(): Guide[]` (run once, cached for redo). Exposes `getCreatedGuide()` for single-guide create commands.
- **`BatchRotateGuidesCommand extends BaseCommand`** — pre-computes `rotatedEndpoints` from the guide set passed via `super(...)`, owns the snapshot-based execute/undo. Subclass provides only the guide selection + serialized payload.

### 3. `systems/guides/commands/guide-command-geometry.ts` — pure helpers
`unitDirection` · `extendThroughPoint` · `pushStyledGuide` (style-cloning collector shared by mirror/copy) · `computeRotatedGuideEndpoints` (X/Y → XZ rotation, the 3× clone) · `buildGuidesFromEntityParams` (entity → guides, the 34-line clone).

### 4. Thin command files (identical public API)
- **CreatedGuidesCommand:** CreateGuide, CreateParallelGuide, CreateDiagonalGuide, GuideFromEntity, GuideOffsetFromEntity, BatchGuideFromEntities, MirrorGuides, PolarArrayGuides, CopyGuidePattern.
- **BatchRotateGuidesCommand:** RotateAllGuides, RotateGuideGroup.
- **BaseCommand (bespoke execute/undo):** CreateGridFromPreset (group-aware), DeleteGuide, BatchDeleteGuides, MoveGuide, RotateGuide (single, snapshot-replace), ScaleAllGuides, EqualizeGuides.

All class names, constructor signatures, the `EntityGuideParams` export and the extra public members (`getCreatedGuide()`, `isValid`, `spacing`, `angleIncrement`, `startAngleDeg`) are preserved. The barrel `commands/index.ts` is unchanged; the 4 external consumers (`useGuideActions`, `useGuideState`, `useCanvasContainerHandlers`, `canvas-click-types`) are untouched.

---

## Consequences

**Positive**
- **−30 jscpd clones** full-scan (3590 → 3560, `.jscpd-baseline.json` relocked); zero new sibling clones (`jscpd:diff` clean on all 10 staged src files).
- One `ICommand` root for the whole subapp going forward; guide commands shrank from ~1949 to well under half the boilerplate.
- New parity test `commands/__tests__/guide-commands-ssot.test.ts` (13 cases) locks execute/undo/redo/serialize behaviour against a real `GuideStore`; full guides suite green (42/42).

**Negative / risk**
- `RotateGuide`/`ScaleAll` now inherit `redo() → execute()` instead of a bespoke redo. Verified equivalent: their `execute()` guards snapshot capture with an "is-first-execution" flag, so a redo re-runs the mutation without re-capturing — byte-identical to the old hand-written redo.

---

## Changelog
- **2026-07-09** — Initial. Created `BaseCommand` (core) + `CreatedGuidesCommand`/`BatchRotateGuidesCommand` (guides) + `guide-command-geometry.ts`; migrated all 7 guide command files to thin subclasses; added parity test suite. jscpd 3590 → 3560.
