# ADR-626: Closed-area drawing-tool SSoT — `usePolygonAreaTool` over the canonical vertex-chain FSM

## Status
✅ **ACTIVE — 2026-07-10** — De-duplication of the N-click **closed-area** drawing tools in `src/subapps/dxf-viewer/hooks/drawing/` (Floor-Finish / Roof / Underfloor-heating — all «by boundary» footprint tools). Each re-implemented the full polygon vertex-chain state machine inline (their headers literally read «clone of useRoofTool / useSlabTool») instead of adopting the canonical `usePolygonSketchChain` (ADR-363) that slab / column / stair already consume. Collapsed onto one shared domain-wrapper hook that delegates the FSM to the existing primitive — every tool keeps its **identical public API**, and the two tools that lacked it gain **face-snap parity**.

**Related:**
- **ADR-363** — `usePolygonSketchChain`, the canonical vertex-chain FSM (idle → awaitingFirstVertex → awaitingNextVertex loop → auto-close/Enter commit) with the ADR-363 ownership boundary: the primitive owns `phase + vertices` + vertex face-snap; the consumer owns `kind/overrides/error` + its live-preview store. Unchanged; the new wrapper sits directly on top of it.
- **ADR-514 Φ6** — polygon vertex face-snap (`resolvePolygonVertexSnap` + `polygonVertexLockStore` + `sceneSnapTargetsStore`), owned by the FSM primitive. Roof/Slab already had it; Floor-Finish/Underfloor did not — a consistency defect, not a design choice.
- **ADR-417 / ADR-419 / ADR-408** — the Roof / Floor-Finish / Underfloor-heating tools migrated.
- **ADR-625** — cluster #16 (edit/transform preview SSoT); ADR-626 is cluster #17 of the same jscpd sweep, moving from `hooks/tools` into the sibling `hooks/drawing`.
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28 / N.18) — gated the iteration; jscpd:diff clean on all 5 touched files, no `SKIP_JSCPD_DIFF`.

---

## Context

A real SSoT audit (fresh jscpd pass grouping `hooks/drawing` at **791 cloned lines / 53 intra-dir pairs**, plus full reads of both members of every twin AND the existing `usePolygonSketchChain`) found the dominant duplication is a hub of clones around `useFloorFinishTool` ⇄ `useRoofTool` ⇄ `useMepUnderfloorTool` (~126 L + ~74 L between the hub and each sibling). All three inline the SAME state machine + Enter-to-commit listener + lifecycle + live-preview effect the ADR-363 primitive already owns:

```
idle → awaitingFirstVertex → awaitingNextVertex (loop) → auto-close/Enter → commit → awaitingFirstVertex
```

The classification is unambiguous:
- **Already SSoT-correct** (consume `usePolygonSketchChain`): `useSlabTool`, `use-column-polygon-sketch`, `use-stair-region-sketch`.
- **Inliners of the same FSM** (the duplication): `useRoofTool` (with face-snap), `useFloorFinishTool` + `useMepUnderfloorTool` (WITHOUT face-snap).

Big-player practice — Revit *Floor/Roof by boundary* Sketch Mode (and *Pick Walls*), Cinema 4D spline, Figma pen — snaps boundary sketch vertices to existing geometry uniformly. So the missing face-snap on Floor-Finish/Underfloor is a defect; adopting the shared engine both removes the duplication and closes the parity gap.

---

## Decision

Reuse the existing SSoT rather than invent a new one. Add ONE shared domain-wrapper hook and migrate the three inliners to it; wire the two missing `getSceneEntities` sources in the orchestrator for face-snap parity.

### `use-polygon-area-tool.ts` — `usePolygonAreaTool<TOverrides, TEntity>(config)`

Sits on top of `usePolygonSketchChain` and adds ONLY the domain scaffolding the FSM primitive intentionally does not own:
- `overrides` + `error` domain state (with `setParamOverrides` merge);
- the single-writer live-preview store effect (footprint rubber-band), mirroring `phase`/`vertices`;
- `getStatusText` from `{ first, next }` i18n keys;
- build + validate + commit via `commitEntity(vertices, overrides, sceneUnits, levelId)` (the binding folds each tool's `buildDefaultXParams` + `buildXEntity` into one closure); an `ok:false` result surfaces the hard error and keeps the FSM in `awaitingNextVertex` for a fix.

Lifecycle mapping preserves the original exactly: `activate`/`reset` keep overrides + clear error; `deactivate` resets overrides + clears error; each click clears the stale error. The result object is byte-shape-identical to the old `Use*ToolResult` (`state {phase,vertices,overrides,error}` + activate/deactivate/reset/onCanvasClick/finishPolygon/setParamOverrides/getStatusText/isActive/isAwaitingFirstVertex/isAwaitingNextVertex).

### Bindings + orchestrator
- `useRoofTool` / `useFloorFinishTool` / `useMepUnderfloorTool` → ~65-line thin bindings (preview store + commit closure + status keys + forwarded options). Exported hook names, `Use*ToolOptions`, `*_AUTO_CLOSE_TOLERANCE_DEFAULT`, and `*ToolState`/`Use*ToolResult` type aliases preserved.
- `useSpecialTools-area-tools.ts` — Floor-Finish/Underfloor gain `getSceneEntities` (parity). While touched, the per-tool `getSceneUnits` / `getSceneEntities` / `getAutoCloseTolerance` closures (repeated 7× / 5× / 4× across slab/roof/floor-finish/underfloor/thermal-space/space-separator/wall-covering) were hoisted once (`getSceneUnits`, `getSceneEntities`, `makeAutoCloseTolerance(defaultMm)`), Boy-Scout N.18.

---

## Consequences

- **3 tools re-based onto 1 new shared hook + orchestrator hoist.** Roof/Floor-Finish/Underfloor drop 295/262/253 → ~65 lines each; the whole inline FSM (state machine + Enter listener + lifecycle + snap) now lives once. `hooks/drawing` clones drop and the full-scan ratchet falls **3299 → 3281 working-tree** (`3281/3494` vs the committed baseline; **−213 cumulative** with #12–#16).
- **Face-snap parity** — Floor-Finish & Underfloor now flush boundary vertices to wall/column faces, matching Roof/Slab (Revit-grade). The only intended behaviour change; preview ≡ commit by construction (same resolver + lock store).
- **jscpd:diff clean** on all 5 touched files — no `SKIP_JSCPD_DIFF`.
- **Identical public API** — verified by a new suite (`__tests__/use-polygon-area-tool.test.tsx`, 13 tests): idle/activate/accumulate, commit → onCreated + continuous-draw, validator-reject → error + stay, overrides merge → forwarded to `commitEntity`, deactivate reset, + a 3-binding module-load smoke. The existing `usePolygonSketchChain` suite (7 tests) still passes unchanged.
- **Not touched:** the other `hooks/drawing` twins (mep-boiler/radiator completion, useCircleTTT/useLineParallel, column/wall region-clicks, segment tools) — different FSMs / follow-up clusters.

### Changelog
- **2026-07-10** — Cluster #17 implemented. New `use-polygon-area-tool.ts`; `useRoofTool`/`useFloorFinishTool`/`useMepUnderfloorTool` → thin bindings; `getSceneEntities` wired + resolver hoist in `useSpecialTools-area-tools.ts`. Face-snap parity for Floor-Finish/Underfloor. Full-scan 3299 → 3281 (working-tree; baseline relock pending Giorgio). 20 jest pass (13 new + 7 existing). jscpd:diff clean, no SKIP.
