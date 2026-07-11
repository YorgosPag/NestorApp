# ADR-624: WYSIWYG placement-ghost SSoT — generic build→paint primitive + single-point bridge-store factory

## Status
✅ **ACTIVE — 2026-07-10** — De-duplication of the 2D **WYSIWYG placement-ghost** hook family in `src/subapps/dxf-viewer/hooks/tools/` (the `use*GhostPreview` hooks, ADR-408/406/363/574). After ADR-398 §4 lifted the RAF/clear/viewport/cursor scaffolding into `useCanvasGhostPreview`, and ADR-574 made every ghost paint the FULL entity through the real renderer (`renderWysiwygPlacementGhost`), all nine hooks shared the identical `draw` skeleton. Collapsed onto one generic primitive + one single-point factory — every hook keeps its **identical public API**.

**Related:**
- **ADR-398 §4** — `useCanvasGhostPreview` harness: owns the cursor-gate + RAF lifecycle + DPR-clear + canonical viewport/transform + snapped-cursor. Unchanged; the new primitive sits directly on top of it.
- **ADR-574** — WYSIWYG ghost SSoT audit: each ghost builds the full synthetic entity with the SAME commit builders (`buildDefaultXParams` + `buildXEntity`) and paints it via `renderWysiwygPlacementGhost` → `preview ≡ commit by identity`. This ADR extracts the shared `build → paint` skeleton those hooks all repeated.
- **ADR-408/406/363** — the electrical-panel / MEP (boiler/manifold/radiator/water-heater/fixture/segment) / opening / slab-opening placement tools whose ghost hooks are migrated.
- **ADR-609** — `create-ribbon-mep-auto-bridge.ts` (a different MEP factory, untouched).
- **ADR-623** — cluster #14 explicitly deferred the `ui/ribbon/hooks` MEP tool-bridge-store setup + symbol/library placement to follow-up clusters; this ADR (cluster #15) instead targets the self-contained `hooks/tools` ghost-preview family the #14 residual notes flagged as adjacent.
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28 / N.18) — gated the sibling-clone iteration; the skeleton clones are folded to zero (jscpd:diff clean on all 10 touched files, no `SKIP_JSCPD_DIFF` needed).
- **ADR-605…623** — the same multi-day jscpd sweep; ADR-624 is cluster #15.

---

## Context

A real SSoT audit (fresh jscpd pass grouping `hooks/tools` at **888 cloned lines / 71 intra-dir pairs**, plus full reads of the harness + representative hooks `electrical-panel`/`boiler`/`opening`/`segment`/`slab-opening`) found the classic sibling-clone pattern. Nine `use*GhostPreview` hooks all paint through `renderWysiwygPlacementGhost` with the identical `draw` skeleton:

```
draw = ({ ctx, effectiveCursor, viewport, transform }) => {
  if (!effectiveCursor) return;
  const entity = build…(effectiveCursor);   // ← the ONLY real variance
  if (!entity) return;
  renderWysiwygPlacementGhost(ctx, entity, transform, viewport);
}
```

Two sub-shapes:
1. **Single-point from a tool-bridge store** (6 hooks: `electrical-panel`, MEP `boiler`/`manifold`/`radiator`/`water-heater`/`fixture`) — byte-twins: read `overrides` + `sceneUnits` from the entity's `*-tool-bridge-store`, run `buildDefaultXParams` + `buildXEntity`, paint. The only per-file variance is `{ bridgeStore, buildDefaultParams, buildEntity }`.
2. **Variants with bespoke build** (`opening` — host-wall + `kind`; `segment` — 2-click rubber-band reading `startPoint` from the bridge; `slab-opening` — dual-branch: placement + an out-of-slab 🔴 status schematic + an edge-midpoint hover indicator). Same outer skeleton, different build/paint step.

---

## Decision

Big-player layering (Revit/Maxon-C4D/Figma expose a shared placement-preview primitive; each tool supplies only its build closure), applied to the ghost-preview family. All `use*GhostPreview` hook names, prop shapes and exported types (`GhostSegmentSpec`, `UseXxxGhostPreviewProps`) are preserved; the leaf `canvas-layer-stack-*-ghost.tsx` micro-leaves (ADR-040) are untouched.

### `use-wysiwyg-placement-ghost.ts` — two SSoT levels

**Level 1 — `useWysiwygPlacementGhost<TBuild = Entity>(config)`** — the generic `build → paint (+ overlay)` skeleton over the `useCanvasGhostPreview` harness (`useImmediateSnap: true` always). Config: `{ isActive, transform, getCanvas, getViewportElement, buildGhostEntity(frame), paintGhost?, drawOverlay?, drawDeps? }`.
- `buildGhostEntity(frame) → TBuild | null` — the per-hook build closure (null skips the paint).
- `paintGhost?(frame, build)` — default = `renderWysiwygPlacementGhost`; overridden by `slab-opening` for the out-of-slab status schematic (its `TBuild = { entity, isOutsideSlab }`).
- `drawOverlay?(frame)` — a bespoke overlay drawn every active frame, independent of the built payload (`slab-opening`'s edge-midpoint `+` indicator).
- `drawDeps` — mirrors each hook's legacy `useCallback` deps (caller-controlled, exactly as before).

Used directly by the three variants (`opening`, `segment`, `slab-opening`).

**Level 2 — `createBridgeStorePlacementGhostHook({ bridgeStore, buildDefaultParams, buildEntity })`** — a factory for the single-point sub-family. Reads `overrides` + `getSceneUnits()` from the bridge store at draw time, runs the commit builders, returns a ready hook typed `(props: BridgeStorePlacementGhostProps) => void`. Each of the six hooks becomes a **3-line binding**.

Generics: `THandle extends BridgeStorePlacementGhostHandle<TOverrides>`, `TOverrides`, `TParams`, `TEntity`; `bridgeStore` typed as the direct `{ get(): THandle | null }` (not `Pick<…>`) for reliable inference. `buildEntity` returns the shared `{ ok: true; entity } | { ok: false; hardErrors? }` result — a superset of every builder's real result.

---

## Consequences

- **9 ghost hooks + 1 new SSoT module.** The 6 single-point hooks drop from ~67–71 lines each to ~27 (thin factory bindings); the 3 variants keep their bespoke build but shed the shared skeleton. `hooks/tools` clones drop and the full-scan ratchet falls **3364 → 3339 working-tree** (`3339/3494` vs the committed baseline; **−155 cumulative** with #12–#14).
- **jscpd:diff clean** on all 10 touched files — the skeleton twins are fully folded; **no `SKIP_JSCPD_DIFF` needed** (unlike #14). This also removes one adjacent driver of the #14 residual.
- **Identical public API** — verified by a new suite (`__tests__/use-wysiwyg-placement-ghost.test.tsx`, 27 tests): primitive build/paint/overlay/paint-override contract, factory build-from-store + skip-on-no-cursor + skip-on-failed-build + gate, and a module-load smoke over all 9 bindings. The existing `useCanvasGhostPreview` harness suite still passes.
- **No `any`/`as any`** (only the pre-existing `entity as unknown as Entity` narrowing the concrete entity to the render union, and minimal test casts); every file < 500 lines; no runtime behaviour change (pure hook-extraction with preserved memo/deps semantics).

---

## Changelog
- **2026-07-12** — **Floorplan-symbol binding + shared-canvas flicker fix.** (1) Added `useFloorplanSymbolGhostPreview` (7th factory binding) + micro-leaf `FloorplanSymbolGhostPreviewMount`, wired through `PreviewCanvasMounts`/`CanvasLayerStack`/`CanvasSection` (ADR-415). (2) **Flicker root cause:** every `use*GhostPreview` paints on the SHARED `PreviewCanvas` (`previewCanvasRef`), which is ALSO driven by the generic drawing-hover (`processDrawingHover`). For single-click placement tools `getLatestPreviewEntity()` is always null → the handler's `else { previewCanvasRef.clear() }` fired on every mousemove and wiped the ghost the placement mount had just drawn (race) → the ghost flickered. **Fix:** new SSoT predicate `toolOwnsPlacementGhost(tool)` (tool-definitions.ts, derived from `TOOL_CREATES_ENTITY` → covers all mep-fixture/segment aliases) gates that clear off while a placement ghost owns the canvas (mirrors the pre-existing `auto-dim-cutline` skip). The ghost's own harness clears+redraws each frame, so nothing goes stale. Fixes the whole point-placement family (mep-fixture/panel/manifold/radiator/boiler/water-heater/segment/floorplan-symbol), not just symbols.
- **2026-07-10** — Initial: added `use-wysiwyg-placement-ghost.ts` (`useWysiwygPlacementGhost` primitive + `createBridgeStorePlacementGhostHook` factory), migrated the 6 single-point MEP/electrical-panel ghost hooks to thin factory bindings and the 3 variants (`opening`/`segment`/`slab-opening`) onto the primitive, added the 27-test suite. Cluster #15 of the ADR-584 jscpd sweep.
