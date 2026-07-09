# ADR-605: BIM 3D point-placement hook factory SSoT (`createBim3DPointPlacementHook`)

## Status
✅ **ACTIVE — 2026-07-09** — De-duplication of the 7 `use-bim3d-*-placement.ts` point-placement hooks under `src/subapps/dxf-viewer/bim-3d/placement/` (`useBim3DElectricalPanelPlacement` · `useBim3DFurniturePlacement` · `useBim3DMepBoilerPlacement` · `useBim3DMepFixturePlacement` · `useBim3DMepManifoldPlacement` · `useBim3DMepRadiatorPlacement` · `useBim3DMepWaterHeaterPlacement`). Each was a ~170-line hook repeating one identical `useEffect` body — AbortController-gated `pointermove`/`pointerleave`/`pointerdown`/`click` listeners on the renderer canvas, work-plane raycast + OSNAP + ghost update, orbit-drag guard, `bim:place-*-3d` EventBus emit on click, and tool/view-mode arm/disarm — differing ΜΟΝΟ σε 5 παραμέτρους. Collapsed onto **one generic factory** `createBim3DPointPlacementHook(config)` + 7 thin per-entity config call-sites that keep their exact public API.

**Related:**
- **ADR-600** — the sibling 2D bucket: the `createSingleClickPlacementTool` FSM factory for the same entities' 2D drawing tools. ADR-605 is its 3D-viewport twin (the hook that projects a 3D click and re-uses ADR-600's 2D commit path via the `bim:place-*-3d` bridge).
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28) — the token-based detector that gates re-introduction (this ADR's chosen guard).
- **ADR-040** (micro-leaf) — the hook reads high-frequency stores at event time (`toolStateStore.get()`, `useBim3DEntitiesStore.getState()`), never via `useSyncExternalStore`.
- **ADR-406 / 408 / 410** — the individual tools' behaviours, reproduced 1:1.
- **ADR-363/404/408** — `createToolBridgeStore`, whose handles supply the `getSceneUnits()` + `overrides.mountingElevationMm` the factory reads.

---

## Context

A real SSoT audit (grep for `raycastFloorPoint`/`resolvePlacementSnap`/`bim:place-` + full diffs of all 7 hooks against `use-bim3d-electrical-panel-placement.ts`) confirmed no shared owner existed — the sibling `placement-snap.ts` / `raycast-floor-point.ts` / `world-to-scene-point.ts` helpers are the *primitives* the body calls, not the arm/disarm + listener lifecycle itself. Each hook copy-pasted the whole `useEffect`:

- ghost + `PlacementSnapMarker` construction, `abort`/`downPos` locals, `cursorEl` resolution;
- `unitsNow()` / `mountingElevationMmNow()` (bridge-store reads);
- `resolveWorkPlaneMm` (raycast → plan mm → OSNAP);
- `onMove` / `onLeave` / `onDown` / `onClick` (orbit-drag guard + `EventBus.emit('bim:place-*-3d', …)`);
- `setup` / `teardown` (balanced `acquire`/`releasePlacementCursor`);
- `apply` (arm iff `activeTool ∈ tools` AND `selectIs3D`) + the two store subscriptions + cleanup.

The **only** variance across the 7: the ghost kind, the arming tool id(s), the tool-bridge store, the default mounting elevation, and the `bim:place-*-3d` event key. Big-player practice for a family of near-identical controllers is **a small required config + a single factory**, not a copy-pasted hook per entity.

The `mep-fixture` and `mep-manifold` hooks arm on a *pair* of tools (`mep-floor-drain` shares the fixture FSM/bridge, ADR-408 Φ14; `mep-drainage-collector` shares the manifold's), so the arm predicate is generalised to `tools.includes(activeTool)` — the single-tool case is just a one-element array.

---

## Decision

### New factory `bim-3d/placement/create-bim3d-point-placement-hook.ts`
`createBim3DPointPlacementHook(config)` returns a `(params: { managerRef, canvasEl }) => void` hook. The factory owns the invariant `useEffect` lifecycle; `config` injects the variance:

| Field | Role |
|---|---|
| `ghostKind` | key into `PLACEMENT_GHOST_3D_FACTORIES` (the 3D ghost mesh) |
| `tools` | `readonly ToolType[]` — placement arms iff `activeTool` ∈ this set AND viewport is 3D |
| `bridgeStore` | the tool's `createToolBridgeStore` cell; the factory reads `getSceneUnits()` + `overrides.mountingElevationMm` structurally (`PointPlacementBridgeStore`) |
| `defaultMountingElevationMm` | fallback when the bridge handle is absent |
| `placeEvent` | the `bim:place-*-3d` key (`Bim3DPlacePointEvent` union) that re-uses the 2D commit path |

The 7 call-sites are now ~24-line thin bindings: import the factory + bridge store + default const, and `export const useBim3D…Placement = createBim3DPointPlacementHook({…})`. Public API (named hook, `{ managerRef, canvasEl }` param) is unchanged, so `use-bim3d-placement-and-pick-hooks.ts` and the existing `use-bim3d-mep-fixture-placement.test.ts` (5 tests, still green) are untouched.

### Consequences
- **−763 jscpd clones** in the full `src/` scan (4465 → 3702, CHECK 3.28) from this single cluster.
- Any future point-placed BIM entity is a config object, not a copied hook — one place to fix a lifecycle/OSNAP bug for all.
- The `SceneUnits` type is the canonical `utils/scene-units` union (`'mm'|'cm'|'m'|'in'|'ft'`), imported not re-declared.

---

## Changelog
- **2026-07-09** — Created. Extracted `createBim3DPointPlacementHook`; migrated all 7 point-placement hooks to thin config bindings. Fixture test green; jscpd −763.
