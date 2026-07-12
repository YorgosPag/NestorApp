# ADR-640 — Block subsystem: DXF INSERT as a first-class, round-trippable Block instance

- **Status:** 🟢 IMPLEMENTED (M1 import + M2 export round-trip + M3 anonymous-block gate)
- **Date:** 2026-07-12
- **Domain:** DXF Viewer · Import · Entity model · Render/conversion · Explode/transforms
- **Related:** ADR-635 (INSERT import), ADR-575 (GROUP container — architectural mirror; realizes its §6 deferred follow-up), ADR-353 (ArrayEntity — the expand-before-convert pattern), ADR-510 Φ5 (Explode)

---

## 1. Context

Importing a DXF **INSERT** (block reference) flattened it into loose `line`/`arc` scene entities
(`utils/dxf-block-expander.ts instantiateInsert` → the ADR-635 Φ2 explode-on-import). The furniture/
symbol lost its «block» identity: not selectable/movable as one object, no name/properties, no
re-export as INSERT. Giorgio's report (real file `KADOS/ΕΠΙΠΛΟ.dxf`, a single `NEC32_BLOCK` INSERT):
«το έπιπλο σπάει σε γραμμές». Dimensions/position were already correct — ONLY the identity was lost.

Requirement: an INSERT must import as **ONE** object that keeps its type/name/insert-params,
explodes on demand, and re-exports to DXF as an INSERT (full round-trip) — like AutoCAD.

The `BlockEntity` type (`type:'block'`, `name/position/scale/rotation/entities[]`) already existed
(`types/entities.ts`) and already mapped to INSERT on export (`types/dxf-export.types.ts`), but was
**dead scaffolding** — nothing constructed it and it had NO render/hit-test/selection/explode support.
ADR-575 §6 explicitly deferred this «full Block subsystem» pending Giorgio's decision.

## 2. Decision

Realize the deferred subsystem by mirroring GROUP (ADR-575), reusing the existing `BlockEntity` type.

### Fork 1 — REVIVE `type:'block'` (not a new `'block-instance'`)
ADR-575 §4 rejected `'block'` as the GROUP container because ~6 SSoTs treat it as a translate-only
POINT — but that rejection was «a group is not an INSERT». Here the entity **IS** an INSERT, so those
consumers become correct. Verdict of the 6 point-consumers under a real block:

| Consumer | Verdict | Action |
|---|---|---|
| `dxf-export.types` `'block'→INSERT` | CORRECT (a block SHOULD export as INSERT) | none |
| `InsertionSnapEngine` single insertion-point snap | CORRECT & desirable (AutoCAD) | none |
| `bounds-entity` point bbox | **BREAKS** — must contribute member bbox | real bbox (expand+union) |
| `stretch-vertex-classifier` returns position | CORRECT (whole-block rigid anchor) | none |
| `PathCache` fingerprints position/scale/rotation/name | CORRECT (dirty-detection fields) | none |
| `array-validation` allows block as source | CORRECT & desirable (AutoCAD arrays blocks) | none |

One genuine fix (bounds) + additive rotate/scale/mirror cases — vs a parallel discriminant that would
duplicate the whole type/export/guard surface AND still need those cases.

### Fork 2 — Storage: block-LOCAL members + placement transform
Members are stored in BLOCK-LOCAL coords (block **base baked to origin** at construction) plus
`position`/`scale`/`rotation`. Round-trips to INSERT with **zero inverse math** (export = INSERT
placement + BLOCK local geometry), and reuses `applyBlockTransformGeometry` (the `p_world = pos +
Rot·Scale·member` SSoT). Group-style absolute coords would need inverting the transform at export.

### Scope gate (Phase 0)
A **single (non-MINSERT) INSERT with a preservable name** becomes a block
(`name && shouldPreserveBlockName(name) && cols===1 && rows===1`). MINSERT arrays keep the legacy
flatten (a future phase may wrap arrays as `ArrayEntity`-of-block).

**M3 (2026-07-12) — anonymous-block gate refinement.** The original gate `!name.startsWith('*')`
flattened EVERY `*`-prefixed name, which broke real furniture/symbol geometry: AutoCAD stores
anonymous / dynamic blocks as `*U#` (and associative arrays as `*A#`), so a `*U2` furniture block
exploded into loose lines/arcs (repro: `μπλοκ+γραμμοσκιαση.dxf`, INSERT `*U2` @ layer
`EPIPLA_ON_OFF`; the 42MB `Αδείας.Κάτοψη ισογείου.dxf` already kept its 98 named blocks — the bug
was ONLY anonymous). SSoT `utils/dxf-anonymous-block.ts::shouldPreserveBlockName` now preserves
named **and** real-anonymous (`*U`/`*A`/`*E`) blocks, flattening only the `*X#` (R12 hatch, owned by
`dxf-hatch-xdata-converter`) and `*D#` (dimension, owned by the DIMENSION entity) decorations.
Policy = preserve-by-default with a `{*X,*D}` denylist, so new AutoCAD anonymous geometry prefixes
auto-preserve (Revit/AutoCAD parity: an anonymous block reference stays ONE selectable object).
Export mirrors it: `dxf-ascii-insert-writer` emits BLOCK flag `70=1` for a `*`-named block so the
round-trip stays anonymous. **Out of scope (future):** resolving the human dynamic-block name behind
`*U#` (shown as «*U2» today); mapping `*A#` → `ArrayEntity` (kept as a plain block — strict gain).

## 3. Architecture (mirror of ADR-575 §3)

```
systems/block/block-instance.ts   createBlockInstance / explodeBlockInstance   (mirror group-entity.ts)
systems/block/block-expander.ts   placeBlockMembersWorld / expandBlockInstance  (mirror group-expander.ts)
utils/dxf-block-expander.ts        buildLocalBlockMembers (extracted SSoT) + applyBlockTransformGeometry (exported)
```

| Domain | File | Change |
|---|---|---|
| Import | `utils/dxf-block-expander.ts` | extract `buildLocalBlockMembers` (shared by flatten + block); export `applyBlockTransformGeometry` |
| Import | `utils/dxf-scene-builder.ts` | Phase-0 gate → `createBlockInstance`; `resolveEntityLayerAndColor` split so block members register/resolve layers; `boundsOf` expands blocks for import auto-fit (Φ7); **M3** gate uses `shouldPreserveBlockName` |
| Import | `utils/dxf-anonymous-block.ts` | **M3 SSoT** — `shouldPreserveBlockName`/`isAnonymousBlockName`: named + real-anonymous (`*U`/`*A`/`*E`) preserve, `*X`/`*D` flatten |
| Export | `export/core/dxf-ascii-insert-writer.ts` | **M3** — BLOCK flag `70=1` for anonymous names (round-trip fidelity) via `isAnonymousBlockName` |
| Render | `hooks/canvas/useDxfSceneConversion.ts` | `isBlockEntity` expand-before-convert (cached + uncached) — else the container is dropped |
| Explode | `systems/explode/explode-entity.ts` | `+'block'` in `EXPLODABLE_TYPES`; `'block'`→`explodeBlockInstance` |
| Rotate | `utils/rotation-math.ts` | `block` handler (rotate position + accumulate rotation; NOT member-recurse) |
| Scale | `systems/scale/scale-entity-transform.ts` | `block` case (scale position about base + `scale.x/y *= f`) |
| Mirror | `utils/mirror-math.ts` | `block` case (reflect position, `rotation→2α−r`, negate one scale axis) |
| Move | `core/commands/entity-commands/move-entity-geometry.ts` | already correct (translate `position`) |
| Bounds | `systems/zoom/utils/bounds-entity.ts` | real bbox: expand members + union (the one point-consumer fix) |

Selection/hit-test come **for free**: expansion tags every member with the block id, so
`HitTestingService` (post-conversion index) resolves any click to the whole block.

## 4. Alternatives rejected
- **Keep explode-on-import** — loses block identity (the reported problem).
- **New `'block-instance'` discriminant** — duplicates type/export/guard surface; the legacy `'block'`
  point-consumers become correct for a real INSERT (Fork 1), so reuse is cleaner.
- **Group-style absolute-coord members** — needs an inverse transform at export (Fork 2).
- **GROUP wrapper** — quick, but does NOT keep block name / round-trip to INSERT (Giorgio's requirement).

## 5. Testing (jest — N.17, no tsc)
- `systems/block/__tests__/block-instance.test.ts` — create (name/placement/base-bake), explode (world + fresh id), empty→null.
- `systems/block/__tests__/block-expander.test.ts` — place via `applyBlockTransformGeometry`, tag block id, empty→[].
- `systems/block/__tests__/block-transform.test.ts` — move/rotate/scale/mirror (INSERT semantics).
- `utils/__tests__/rotate-entity-coverage.test.ts` — updated: `block` joins `group` as non-renderable handler.
- `utils/__tests__/dxf-block-expansion.test.ts` — updated: expand the preserved block (`flat()`) before geometry asserts.
- **Result: 3 new suites (13) + block-expansion (9) + import-robustness (9) + rotate-coverage GREEN.**
- E2E (real `ΕΠΙΠΛΟ.dxf`): 1 INSERT → 1 block `NEC32_BLOCK`, 28 members, 800×2100 mm bounds, 0 loose lines.

## 6. M2 — export round-trip (INSERT + named BLOCK)

A `BlockEntity` re-exports to the AutoCAD/Revit convention (inverse of the M1 import):

| Domain | File | Change |
|---|---|---|
| Export | `export/core/dxf-ascii-insert-writer.ts` | **NEW** — `emitInsert` (INSERT: `2`=name, `10/20/30`=pos×scale, `41/42/43`=scale-factors raw, `50`=rotation°) + `writeBlockDefinitions` (one named `BLOCK…ENDBLK` per **distinct** `name`, dedup; base `(0,0)`; members via injected `emitMember`). Mirror `dxf-ascii-dimension-block-writer.ts`. |
| Export | `export/core/dxf-ascii-writer.ts` | `case 'block'`→`emitInsert`; the ONE `BLOCKS` section now holds dim `*Di` blocks **and** named block defs; `emitBlockMember` closure re-uses `writeEntity` (dependency injection, mirror `emitHatch(…, emitLine)`) so member line/arc/text/hatch serialization is **not** re-implemented. |

**Zero inverse math** (Fork 2 pays off): the INSERT carries the placement, the BLOCK carries members
in stored BLOCK-LOCAL coords — no transform is inverted at export. **Dedup**: many instances of a name
share one definition (AutoCAD). Testing (jest — N.17): `export/core/__tests__/dxf-roundtrip-block.test.ts`
(10) — INSERT group codes, scale-factors unscaled, one dedup'd BLOCK, section order, zero-regression,
and full `writeDxfAscii → DxfSceneBuilder.buildScene` round-trip (name/pos/scale/rotation/members
idempotent). jscpd clean.

**Scope gate:** M2 covers `'block'` only. `'group'`/`'array'` still fall into the writer's
`default:break` (they'd need a pre-flatten-to-primitives pass) — a discovered side-issue tracked
separately, deliberately OUT of M2 scope.

## 7. BLOCK selection affordance (mirror ADR-575 §8)

A selected/hovered BLOCK now shows the SAME container affordance a GROUP shows — the kept
INSERT is a first-class container, so it MIRRORS/GENERALIZES the group machinery rather than
cloning it. Four visible affordances, all reusing the group SSoT:

1. **Dashed bbox + pill** «Μπλοκ «name» · N αντικείμενα» (N = `block.entities.length`).
2. **Whole-block hover highlight** (same renderer mechanism as group).
3. **ONE whole-block gizmo** (move cross + rotation handle) with per-member grips suppressed.
4. **Status-bar readout** of the selected block.

Blocks are edited via **Explode**, so — unlike groups — there is **NO enter-block** double-click
(no `activeStack` drill-in guard in the grip registry).

| Concern | Shared SSoT (extracted / generalized) | BLOCK sibling |
|---|---|---|
| Bounds | `computeContainerBounds(leaves, memberCount)` extracted from `group-selection-bounds.ts` | `systems/block/block-selection-bounds.ts` — `computeBlockSelectionBounds` (via `expandBlockInstance` + count = `entities.length`), `collectBlockEntities`, `resolveSelectedBlocks` |
| Gizmo grips | `getContainerGizmoGrips(id, bounds, moveKind, rotationKind)` generalized in `group-gizmo-grips.ts` | `systems/block/block-gizmo-grips.ts` — thin `getBlockGizmoGrips` (tags `block-move` / `block-rotation`) |
| Overlay | `GroupSelectionOverlay.tsx` generalized — renders a per-box `label` (each subscriber pre-computes its own `t(...)`), `LabeledSelectionBounds` | `BlockSelectionOverlaySubscriber.tsx` (thin sibling) |
| Gizmo canvas | **NEW** `ContainerGizmoLayer.tsx` — the ONE canvas painter (DPR/paint/temperature); glyph via entity-agnostic `grip.gripKind.kind` | `GroupGizmoLayer` + `BlockGizmoLayer` are ~12-line wrappers injecting `resolveGrips` (N.18 — no twin) |
| Grip registry | `grip-registry.ts` — new `blockEntities` param + block suppression/emission path (mirror `groupEntities`) | fed by `GripRegistryPublisher` (`collectBlockEntities`) |
| Commit | `commitGroupGizmoRotation` generalized (resolves bounds by `raw.type`); `block-move`/`block-rotation` gates in `grip-commit-adapters.ts` | `rotateEntity`/`calculateMovedGeometry` case `'block'` already exist |
| Live ghost | `apply-entity-preview.ts` block branches; `drawGroupGhost` generalized (group ∪ block expander) | container-agnostic |
| Grip kinds | `BlockGripKind = 'block-move' \| 'block-rotation'`; `+block` in `GripKindByEntity` / `GRIP_KIND_ENTITIES` / glyph + hot-grip registries | |
| Status | `StatusBarBlockSelectionLeaf.tsx` (thin sibling) | |
| Hover highlight | `canvas-layer-stack-leaves.tsx` — `groupIds` unions block ids (renderer is container-agnostic) | |
| i18n | `blockSelection.label` / `blockSelection.statusMultiple` (el + en) | |

Tests (jest — N.17): `block-selection-bounds.test.ts` (bounds+count / resolve / collect),
`block-gizmo-grips.test.ts` (grips + glyph + hot-grip wiring). Coverage golden tests updated for
the new `block` domain member (grip-kinds / mode-aware / parametric-dispatch / preview-ghost).
Canvas/micro-leaf touches (CanvasLayerStack, GripRegistryPublisher, canvas-layer-stack-leaves,
apply-entity-preview, ContainerGizmoLayer) → ADR-040 §changelog (CHECK 6B/6D). jscpd clean.

## 6b. Google-level declaration
✅ **YES** for M1 (import→render→select→explode→move/rotate/scale/mirror→bounds), M2 (export
round-trip) **and M3** (anonymous-block gate): SSoT reuse (mirror GROUP + dimension-block writer,
shared placement transform + injected member emitter; M3 = ONE name-classification predicate consumed
by import gate + export flag), zero duplication, fault-tolerant, verified end-to-end (incl. real
`μπλοκ+γραμμοσκιαση.dxf` `*U2` furniture + 42MB `Κάτοψη ισογείου` regression).

## Changelog
- **2026-07-12** — M1 implemented + verified end-to-end (13 new tests). Reused `BlockEntity` type
  (Fork 1) + local-coords storage (Fork 2). Import gate, expand-before-convert, explode delegation,
  rotate/scale/mirror handlers, bounds-entity real bbox, import auto-fit bounds. Render/conversion
  touch → ADR-040 §changelog (CHECK 6B/6D). M2 export round-trip deferred to next session.
- **2026-07-12** — **M2 export round-trip DONE.** New `export/core/dxf-ascii-insert-writer.ts`
  (`emitInsert` + dedup-by-name `writeBlockDefinitions`, mirror of the anonymous-dimension-BLOCK
  writer); `dxf-ascii-writer.ts` wires `case 'block'`→INSERT + shares the single `BLOCKS` section with
  dim blocks + injects `writeEntity` as the member emitter (zero re-implemented geometry; writer stays
  494 < 500 lines, N.7.1). 10 new jest tests (`dxf-roundtrip-block.test.ts`) — INSERT codes, scale-
  factor scaling rule, dedup, section order, zero-regression, full re-import idempotence. jscpd clean.
  `'group'`/`'array'` export remains OUT of scope (still `default:break`).
- **2026-07-12** — **🐛 Arc-disappearance fix (render).** A block with mixed members rendered its
  straight LINEs but its ARCs vanished. Root cause: container expansion tags EVERY member with the
  container id (for click→container), but `DxfRenderer.render`'s per-entity line-layer skip was
  id-only (`batchedIds`/`webglOwnedIds`) — a batched LINE sibling put the shared id in the set, so
  the ARC members were skipped. Fixed with a TYPE-gated SSoT predicate (`canvas-v2/webgl-lines/
  line-layer-draw-suppression.ts`, consumed at both skip sites); only line/plain-polyline members can
  be suppressed. Also repairs the same latent bug for mixed-content GROUP (ADR-575) / ARRAY (ADR-353).
- **2026-07-12** — **BLOCK selection affordance DONE (§7, mirror ADR-575 §8).** A selected/hovered
  block now shows a dashed bbox + «Μπλοκ «name» · N» pill, whole-block hover highlight, ONE whole-block
  gizmo (per-member grips suppressed), and a status-bar readout. Extracted `computeContainerBounds`
  (shared group/block bounds core) + `getContainerGizmoGrips` (shared gizmo geometry) + `ContainerGizmoLayer`
  (shared gizmo canvas painter) so the block siblings are thin wrappers — jscpd clean, ZERO twin clone
  (N.18). New: `block-selection-bounds.ts`, `block-gizmo-grips.ts`, `BlockSelectionOverlaySubscriber.tsx`,
  `BlockGizmoLayer.tsx`, `StatusBarBlockSelectionLeaf.tsx`, `BlockGripKind`, `blockSelection.*` i18n (el+en),
  2 new jest suites. Generalized: group bounds/gizmo/overlay, `commitGroupGizmoRotation`, `drawGroupGhost`,
  grip-registry (`blockEntities`), 4 coverage golden tests (+`block` domain member). Blocks have NO
  enter-block (edited via Explode). Canvas/micro-leaf touches → ADR-040 §changelog (CHECK 6B/6D).
  7 regression tests. DxfRenderer touch → ADR-040 §changelog (CHECK 6B/6D).
- **2026-07-12** — **M3 anonymous-block gate DONE.** Report: «real-drawing blocks import as loose
  entities». SSoT audit + jest repro on real files showed named blocks were ALREADY preserved (994KB:
  15/15; 42MB Κάτοψη ισογείου: 98/98) — the bug was ONLY anonymous: the gate `!name.startsWith('*')`
  flattened `*U#` (AutoCAD anonymous / dynamic blocks = furniture/symbols) alongside the `*X#`/`*D#`
  decorations (repro: `μπλοκ+γραμμοσκιαση.dxf` INSERT `*U2` @ layer `EPIPLA_ON_OFF` → 0 blocks).
  New SSoT `utils/dxf-anonymous-block.ts::shouldPreserveBlockName` (preserve-by-default, `{*X,*D}`
  flatten denylist) consumed by the scene-builder gate; `isAnonymousBlockName` drives export BLOCK
  flag `70=1`. Result: `*U2` → 1 block (was 0), named blocks unchanged (98, zero regression). 8 new
  jest tests (`dxf-anonymous-block.test.ts`) + 1 anonymous round-trip test in `dxf-roundtrip-block`.
  jscpd clean. `dxf-scene-builder.ts` is NOT a micro-leaf file (no ADR-040 touch). Out of scope
  (future): human dynamic-block name behind `*U#`; `*A#` → `ArrayEntity`.
