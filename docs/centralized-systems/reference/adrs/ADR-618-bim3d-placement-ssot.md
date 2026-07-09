# ADR-618: BIM-3D placement SSoT — ghost factory + interaction primitive + temp-dim overlay base

## Status
✅ **ACTIVE — 2026-07-10** — De-duplication of `src/subapps/dxf-viewer/bim-3d/placement/` into three coherent SSoT families. The 7 point-placement **ghosts**, the 4 placement **interaction hooks** (the ADR-605 factory + the bespoke column / wall / mep-segment stragglers it never absorbed), and the 2 temporary **dimension overlays** each hand-rolled the same scene/interaction plumbing. Collapsed onto one generic **ghost factory**, a two-layer **interaction primitive + snap-marker controller**, and a Template-Method **temp-dim overlay base** — every class/hook keeps its **identical public API**.

**Related:**
- **ADR-605** — the `createBim3DPointPlacementHook` factory (this ADR's cluster #1 sibling). ADR-605 de-duplicated the 7 *simple* point hooks but left column/wall/mep-segment hand-written because the factory could not express their richer feedback; ADR-618 extracts the shared interaction skeleton so all four (factory + 3 rich hooks) share it.
- **ADR-537** — `PlacementGhostOverlay` (material / scene / post-FX registration / disposal SSoT). The new ghost factory delegates all plumbing to it, owning only the build→geometry→entity→mesh chain.
- **ADR-550 Φ-Ghost** — `placement-ghost-3d-contracts.ts`, the type-keyed ghost registry. Unchanged: it still `new`s each ghost class; the 7 migrated classes remain real `class … extends createPlacementGhostClass({…}) {}` subclasses so `new` + concrete typing via `satisfies` are preserved.
- **ADR-403 / 406 / 408 / 543 / 544** — the column / fixture / MEP / wall placement behaviours the migrated hooks preserve byte-for-byte (OSNAP glyph, ambient COL-traces, wall HUD, connector-Z mate).
- **ADR-040** — event-time store reads (no `useSyncExternalStore`) preserved through the interaction primitive.
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28 / N.18) — gated the sibling-clone iteration to **zero** across all staged src files.
- **ADR-605 / 606 / 607 / 609 / 610 / 611 / 613 / 614 / 616 / 617** — the same multi-day jscpd sweep; ADR-618 extends it into `bim-3d/placement`.

---

## Context

A real SSoT audit (full reads of the factory + all 7 ghosts + the 3 straggler hooks + both temp overlays + the `placement-ghost-3d-contracts` registry, plus a fresh jscpd pass listing **30 intra-dir clone pairs / 521 cloned lines / 37 files**) grouped the clones into three coherent shapes:

1. **Point-placement ghosts** (~178 cloned lines, 7 files) — `Column` / `ElectricalPanel` / `MepFixture` / `MepBoiler` / `MepRadiator` / `MepWaterHeater` / `MepManifold` `PlacementGhost`. Each carried a byte-identical scene-management body (ctor → `PlacementGhostOverlay`, `update` → build-on-cursor + id-stable rebuild + `setObject`, `setVisible`, `dispose`, `buildGhostEntity` skeleton), differing ONLY in the entity tint + layer id, the `*ToolBridgeStore`, and the three SSoT calls `buildDefault*Params` → `compute*Geometry` → `build*Entity` → `*ToMesh`. Column adds a `THREE.Mesh` guard + `kind`; manifold recolours per-frame.
2. **Placement interaction hooks** (~302 cloned lines) — the ADR-605 factory and the 3 rich hooks (column/wall/mep-segment) all repeated the SAME `useEffect` interaction skeleton: `canvasEl`+`managerRef` gate, `AbortController`-scoped canvas listeners, the orbit-drag click guard, the ref-counted placement cursor, the "armed only while tool active AND 3D" FSM (`toolStateStore` + `useViewMode3DStore` subscriptions), and the setup/teardown/dispose lifecycle. The factory and mep-segment additionally shared the whole snap-marker feedback flow (work-plane raycast → OSNAP → hide-on-miss → show marker → commit); they differ only in the ghost-update arity, the marker elevation, and the commit payload (point vs point+z).
3. **Temp dimension overlays** (~63 cloned lines, 2 files) — `TempOpeningDimOverlay` ↔ `TempWallMoveDimOverlay`. Byte-identical `syncSide` / `scaleText` / `disposeSide` / `hide` / `dispose` / ctor + the constant block + the transient `BimDimension3D` envelope; only the domain `update` (which references to resolve) + `buildDim` + plan→world differ.

---

## Decision

Big-player layering (Revit / Maxon C4D / Figma expose a low-level interaction/scene primitive + per-domain strategy bases + thin leaves), applied per family. All public class/hook names, constructor signatures, exported types, and extra public members are preserved; the ghost registry and every external consumer (`useColumnTool`, `useWallTool`, `use-bim3d-placement-and-pick-hooks`, the edit-interaction handlers) are untouched.

### 1. `create-placement-ghost.ts` — point-placement ghost factory (cluster A)
- **`createPlacementGhostClass<TEntity, TParams, THandle>(config)`** returns a class owning the whole lifecycle (overlay ctor, `update` build-on-cursor + id-stable rebuild + optional `resolveColor` recolour + `setObject`, `setVisible`, `dispose`, `buildGhostEntity`). Config supplies `color`/`opacity`/`layerId`/`bridgeStore` + the callbacks `buildParams` / `computeGeometry` / `buildEntity` (raw `{ok,entity}` result, unwrapped by the base) / `toMesh` / optional `resolveColor`.
- **Thin leaves:** each of the 7 ghost files is now `export class XxxPlacementGhost extends createPlacementGhostClass<…>({…}) {}` — a declarative config referencing the entity's own SSoT builders. Column's config guards the `Group|Mesh` union + passes `kind`; manifold's supplies `resolveColor`.

### 2. Interaction primitive + snap-marker controller (cluster B)
- **`use-placement-interaction-effect.ts` → `usePlacementInteractionEffect(config)`** (Layer 1) — owns the shared `useEffect` skeleton (cursor element, AbortController listeners, orbit-drag guard via `ORBIT_DRAG_PX`, cursor acquire/release, arm-FSM, setup/teardown/dispose). Config: `managerRef` + `canvasEl` + `tools` + `createController(ctx)` returning a `PlacementInteractionController` (`onMove` / `hideFeedback` / `onCommit` / `dispose`). Used by all 4 placements.
- **`resolve-work-plane-hit.ts` → `resolveWorkPlaneHit(manager, canvasEl, x, y, offsetMm)`** — the shared `resolveActiveFloorElevationMm` → `raycastFloorPoint` → `worldToPlanMm` → `resolvePlacementSnap` chain, returning `{ planMm, markerMm, snap, floorElev, planeElev }`. The mep-segment caller layers its connector-Z mate (Φ-B1) on the returned `snap`.
- **`snap-marker-placement-controller.ts` → `createSnapMarkerPlacementController(ctx, strategy)`** (Layer 2) — owns the snap-marker + the whole onMove/onCommit/hideFeedback/dispose skeleton for a work-plane placement; the strategy supplies `offsetMm` / `showGhost` (returns marker elevation) / `hideGhost` / `commit` / `disposeGhost`. Shared by the factory and mep-segment.
- **`create-bim3d-point-placement-hook.ts`** (ADR-605 factory) refactored to build a snap-marker strategy on Layer 2. **The 7 simple hooks are unchanged** (they call the factory).
- **Thin rich hooks:** `use-bim3d-column-placement` / `use-bim3d-wall-placement` (build their own controllers on Layer 1 — bespoke overlay-store / ambient-tracking + HUD feedback), `use-bim3d-mep-segment-placement` (builds a snap-marker strategy on Layer 2 + connector-Z). The wall hook's leftover TEMP-DIAGNOSTIC `console.log` block (marked "remove after Giorgio confirms") was removed.

### 3. `temp-dim-3d-overlay-base.ts` — temp-dim overlay base (cluster C)
- **`TempDim3DOverlayBase`** (abstract) owns `scene` / `group` / the two side handles / `disposed` / `tmpWorld`, the ctor (`scene.add` + group name), `hide` / `dispose`, the private `syncSide` / `scaleText` / `disposeSide`, and the `buildBaseDim(id, endpointA, endpointB, distMm)` envelope helper + `setSides` (show/refresh the two witness sides).
- **Thin subclasses:** `TempOpeningDimOverlay` / `TempWallMoveDimOverlay` supply only their domain `update(...)` (resolve references → build ≤2 dims via `buildBaseDim` → `setSides`) + their plan→world (`axisWorld` / `planWorld`).

---

## Consequences

**Positive**
- **−30 jscpd clones** full-scan (3494 → 3464); **zero** new sibling clones (`jscpd:diff` clean on all 19 staged src files — verified iteratively down from a residual factory↔mep-segment pair via the `resolveWorkPlaneHit` extraction + the Layer-2 `createSnapMarkerPlacementController`).
- One ghost factory + a two-layer interaction primitive now back every placement in the subapp; the temp-dim base is the reusable spine for future listening-dimension overlays.
- New parity test `create-placement-ghost.test.ts` (7 cases, fake config) locks the generic ghost contract (build-on-update, id-stable rebuild, build-null → hide, per-frame recolour, disposed no-op). All pre-existing placement suites green (**130/130**) + rendering-contract coverage + bim-3d viewport hooks green (**68/68**).

**Negative / risk**
- The 7 ghost classes now `extend` a factory-returned anonymous class expression. This compiles cleanly under the app's `noEmit` type-check (Next.js) and preserves `new` + `instanceof` + the registry's `satisfies` concrete typing; it would only matter for `.d.ts` declaration emit, which these files do not participate in.
- The mep-segment connector-Z (`resolveConnectorZ`) is now computed once per event in the strategy's `showGhost`/`commit` (was once in the old inline `resolveWorkPlaneMm`) — same call count per frame, no behavioural change.
- `use-bim3d-wall-placement.test.ts` had a **pre-existing** failure on HEAD (its `coordinate-transforms` mock omitted `cameraSceneUnitsPerPixel`, which the HEAD wall hook already called at line 126) — the 3 commit tests were red before this ADR. Fixed by completing the mock (one line); the hook logic is byte-identical to HEAD.

**Baseline note (shared tree):** `.jscpd-baseline.json` was **NOT** relocked in this change — the working tree carries another agent's uncommitted Tekton work, so the absolute count conflates. CHECK 3.28 passes as-is (3464 ≤ baseline 3494); Giorgio re-runs `npm run jscpd:baseline` after committing to lock the true post-commit floor.

---

## Changelog
- **2026-07-10** — Initial. Added `create-placement-ghost.ts` (`createPlacementGhostClass`), `use-placement-interaction-effect.ts` (`usePlacementInteractionEffect` + `ORBIT_DRAG_PX`), `resolve-work-plane-hit.ts` (`resolveWorkPlaneHit`), `snap-marker-placement-controller.ts` (`createSnapMarkerPlacementController`), `temp-dim-3d-overlay-base.ts` (`TempDim3DOverlayBase`); migrated 7 point-placement ghosts + 2 temp-dim overlays to thin subclasses; refactored the ADR-605 factory + column/wall/mep-segment hooks onto the interaction primitive (removed the wall TEMP-DIAGNOSTIC block); added `create-placement-ghost.test.ts`; completed the pre-existing wall-test mock. jscpd 3494 → 3464.
