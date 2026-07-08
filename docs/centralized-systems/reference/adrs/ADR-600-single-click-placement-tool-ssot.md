# ADR-600: Single-click Placement Tool factory SSoT (`createSingleClickPlacementTool`)

## Status
✅ **ACTIVE — 2026-07-08** — De-duplication of the 8 Revit-family "click-to-place" tool hooks under `src/subapps/dxf-viewer/hooks/drawing/` (`useMepRadiator` · `useMepWaterHeater` · `useMepManifold` · `useMepBoiler` · `useMepFixture` · `useElectricalPanel` · `useFurniture` · `useFloorplanSymbol` Tool). Each was a ~150–255-line component repeating one identical finite-state machine — `idle → awaitingPosition → committed → awaitingPosition` (continuous) — differing only in its entity builders/geometry, status keys, the optional 3D event, and each tool's bespoke extra state (`assetId`/`shape`), bridge-store publish, and extra getters (`getGhostSymbol`). Collapsed onto **one generic factory** `createSingleClickPlacementTool(config)` + 8 thin per-entity config call-sites that keep their exact public API.

**Related:**
- **ADR-585 / 586 / 588 / 590 / 591 / 592 / 593 / 594 / 595 / 599** — same 2026-07-08 de-duplication sweep, same archetype (**shared primitive + per-instance binding**), different buckets. ADR-600 is the drawing-tool placement-FSM bucket (TIER B / B4). Pairs with ADR-594 (the MEP entities' persistence factory).
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28) — the token-based detector that gates re-introduction (this ADR's chosen guard).
- **ADR-040** (micro-leaf) — the hook owns React state; `getGhostFootprint`/`getGhostSymbol` are pure projections (no high-frequency store subscription).
- **ADR-406 / 408 / 410 / 415 / 431** — the individual tools' behaviours, reproduced 1:1.

---

## Context

A real SSoT audit (grep for `awaitingPosition`/`commitFromState`/`getGhostFootprint` + full reads of all 8 hooks) confirmed no shared owner existed — the `bim/placement/placement-ghost-assembly.ts` helper is about ghost *rendering*, not the tool FSM. Each hook copy-pasted:

- `state = { phase, [extra…], overrides, error }` + `INITIAL_STATE`, 3 refs (`stateRef`/`getSceneUnitsRef`/`onCreatedRef`);
- `activate` / `deactivate` / `reset` / `setParamOverrides`;
- `commitFromState` = `buildDefault{X}Params → build{X}Entity → ok ? onCreated + re-arm : setState(error)`;
- `onCanvasClick` phase-guard; the `bim:place-*-3d` EventBus bridge → same `onCanvasClick`;
- `getStatusText`; `getGhostFootprint` (pure); `isActive` / `isAwaitingPosition`.

Big-player practice for a family of near-identical controllers (TanStack Query's `QueryObserver` options, Radix's headless primitives) is **a small required core + a single typed escape hatch**, not a copy-pasted controller per entity.

---

## Decision

### New factory `hooks/drawing/create-single-click-placement-tool.ts`
`createSingleClickPlacementTool<TEntity, TParams, TOverrides, TExtra, TApi, TUnits>(config)` returns a `useXTool`-shaped hook. The factory owns the invariant FSM; `config` injects the variance:

| Field | Role |
|---|---|
| `defaultSceneUnits` · `buildParams` · `buildEntity` · `computeFootprint` | the per-entity builders + geometry (footprint = `compute{X}Geometry(params).footprint.vertices`) |
| `getStatusText(state)` | pure status-key dispatch (simple for most; the fixture's 11-branch per-kind map) |
| `resolveCommitOverrides?(state)` | merges extra state into overrides for BOTH commit + ghost (default `s.overrides`) |
| `place3dEvent?` | the `bim:place-*-3d` key, or omitted ⇒ no 3D bridge (floorplan symbol) |
| `initialExtra?` + `useExtension?(ctx)` | the per-tool extra state (`assetId`/`shape`) initial value + the **single escape hatch**: a hook that owns the extra setters, the bespoke bridge-store publish effect, and any extra getter (boiler `getGhostSymbol`) — its returned `TApi` is spread into the result |

Extra state stays **inside** the tool state object (`CorePlacementState<TOverrides> & TExtra`), and every reset path is `{ ...prev, phase, error }` (preserve extra + overrides) / `INITIAL_STATE` (full reset), so the public `.state` shape is byte-identical to the originals.

### 8 migrations
Each `useXTool.ts` becomes a thin config + a wrapper mapping the named option (`onMepBoilerCreated` → `onCreated`). **Public API byte-identical** — every named export (`useMepBoilerTool`, `MepBoilerToolState`, …) and the `getGhostSymbol` consumed by `CanvasSection` are preserved. The result contract is expressed as `UseXToolResult = CorePlacementResult<XToolState, XOverrides>` (`& XExtraApi` where present) — the factory core type IS the contract, so the 10-method interface is **not** re-declared (which also removes the would-be jscpd twin).

### One behaviour-neutral generalisation vs the originals
The 3D-bridge effect is a single `useEffect` that no-ops when `place3dEvent` is absent (floorplan) instead of a per-hook conditional — same observable result.

---

## Exclusions (No God-shell)

None. All 8 fit the core + escape hatch: the floorplan symbol (no 3D bridge) omits `place3dEvent`; the fixture (2 extra state fields + an 11-branch status) uses `initialExtra` + a config `getStatusText`; the boiler (extra `getGhostSymbol`) uses `useExtension`. Nothing is woven into the FSM the way the persistence factory's wall/opening/mep-segment were (ADR-594), so no member is God-shelled.

---

## Guard decision

**No `.ssot-registry.json` module / CHECK 3.7·3.18 forbidden-pattern** — consistent with every sibling of this sweep. A regex on the FSM shape (`phase: 'idle' | 'awaitingPosition'`, `commitFromState`) would false-positive on any legitimately-bespoke tool hook. Re-introduction of the scaffold clone is caught by **jscpd CHECK 3.28 (ADR-584)** — the token-based, name-independent detector — plus code review.

---

## Consequences

- **8 files → 1 factory + 8 thin call-sites.** Each hook dropped from ~150–255 lines to ~90–155 (config + extension + wrapper), and the FSM scaffold — the actual duplicated token mass — exists exactly once.
- **A new placement tool is a config object**, not a copy-pasted FSM. The factory guarantees the continuous-chain re-arm, the phase guard, the pure ghost projection, and the 3D-bridge wiring by construction.
- **Verification: 11 jest GREEN / 3 suites** — `create-single-click-placement-tool.test.tsx` (6 FSM behaviours incl. error path, `resolveCommitOverrides` merge, `place3dEvent` routing) + `single-click-placement-tools-smoke.test.ts` (all 8 export their hook) + the pre-existing `useMepBoilerTool.test.tsx` (4, ghost-symbol WYSIWYG — unchanged). Plus **498 GREEN / 48 suites** across the drawing + ribbon-MEP regression. **jscpd CHECK 3.28 (diff) — no new clones across the 9 changed files.** No `tsc` (N.17).

---

## Changelog
- **2026-07-08** — Created. TIER B / B4 of the 2026-07-08 duplicate-audit sweep. NEW `create-single-click-placement-tool.ts` + 2 test suites; 8 `use*Tool.ts` migrated. 11 jest GREEN (+498 regression), jscpd-clean. Uncommitted (Giorgio commits). ADR minted at 600 after 596/597/598/599 were taken by concurrent shared-tree agents.
