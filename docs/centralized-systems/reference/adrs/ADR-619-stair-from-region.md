# ADR-619: «Σκάλα από περιοχή» (Stair-from-Region) — free-polygon capture → shape-driven stair type

## Status
🔵 **RECOGNITION+DESIGN — 2026-07-10** — New ribbon tool `stair-from-region` (tool id `'stair-from-region'`). User clicks the button, draws a free closed polygon around the stairwell on the DXF floor plan, and the program auto-builds a BIM `StairEntity` fitted to that polygon. The polygon **shape** decides the stair **type**: rectangle → straight, L → quarter-turn/winder, U → switchback, circle → spiral, anything else → straight fallback. This ADR documents the recognition + architecture design; implementation lands in a follow-up phase.

**Related:**
- **ADR-358** — the stair tool foundation (`StairParams`/`StairEntity`/`StairGeometryService` contract, Phase 1-9). Stair-from-region is a new **entry point** into the same pipeline — it does not touch the contract.
- **ADR-611** — `stair-geometry-generators.ts` + `stair-geometry-runs.ts` (flight/assembler generators, 12 `variant.kind` thunks). Stair-from-region reuses `computeStairGeometry` unchanged.
- **ADR-363** — «Κολώνα/Τοιχίο από σχεδιασμένο πολύγωνο» (`usePolygonSketchChain` + `buildColumnFromSketchedPolygon` + `classifyPerimeter`). Stair-from-region is the same free-polygon-capture pattern applied to a new entity family — the vertex-chain FSM and the shape-classification idea are reused verbatim, not re-invented.
- **ADR-419** — region/perimeter tool-id SSoT (`isColumnRegionTool` / `isWallRegionTool` / `isBimRegionOrPerimeterTool`). Stair-from-region adds a sibling minimal predicate rather than growing an unrelated one.
- **ADR-040** — canvas click routing stays inside the existing ordered if-chain (`canvas-click-bim-dispatch.ts`); no new high-frequency store subscription is introduced.
- **ADR-584 / N.18** — jscpd clone guard applies to the new `stair-region-classifier.ts` / `buildStairParamsFromRegion` / sketch sub-hook; must reuse `usePolygonSketchChain` + `buildDefaultStairParams` + `buildStairEntity`, never re-implement vertex-chain or entity-assembly logic.

---

## Context / Problem

Today a stair is placed by the plain `'stair'` tool: two clicks (`basePoint` → `direction`), then `buildDefaultStairParams` + `buildStairEntity` produce a **straight** flight only. Getting an L-shape, U-shape (switchback), or spiral stair requires either manual variant editing after placement or a separate contextual-tab flow — there is no single click-driven gesture that lets the user simply **trace the stairwell opening** on the DXF floor plan and get a fitted stair back.

Big-player CAD/BIM tools (Revit's "Create Stair by Sketch → Boundary", ArchiCAD's stair tool auto-fit-to-polygon) support exactly this: draw the well outline once, let the tool infer flight count/turn/direction from the outline shape. Nestor already has the free-polygon-capture primitive (`usePolygonSketchChain`, built for columns/slabs/walls-from-region, ADR-363) and the full stair parametric pipeline (ADR-358/611) — the missing piece is a **shape classifier + params bridge** connecting the two, plus a ribbon entry point.

---

## Decision

Add a new tool `stair-from-region` that composes **existing SSoT only**:

1. **Ribbon entry** — `structuralTab.stairFromRegion` toolBtn in the `structural-circulation` panel, next to the existing `stair` button. Same icon (`'stair'`), new command key `ribbon.commands.bim.stairFromRegion`.
2. **Free polygon capture** — a new thin sketch sub-hook (mirrors `use-column-polygon-sketch.ts`) wires `usePolygonSketchChain` for click-by-click vertex capture + Enter/auto-close commit, with a dedicated `stair-region-preview-store` (mirrors `column-polygon-preview-store.ts`) for the live rubber-band outline.
3. **Shape → type classification** — new `stair-region-classifier.ts` inspects the closed polygon (vertex count, aspect ratio, angle turns, circularity) and returns a `StairVariantParams['kind']` + the derived geometric parameters (run direction, width, centreline) the builder needs. Bucket rules in the mapping table below.
4. **Params bridge** — new `buildStairParamsFromRegion(vertices, classification, overrides, sceneUnits, floorLink)` composes the classifier output on top of `buildDefaultStairParams` (same defaults: rise/tread/width/stepCount/codeProfile), only overriding `basePoint`, `direction`, `width` and `variant` from the region geometry.
5. **Entity build** — `buildStairEntity(params, levelId)` — **unchanged**, same call as the plain stair tool. Geometry always goes through `computeStairGeometry` (ADR-358/611) — the classifier never computes treads/risers itself.
6. **Scene mutation** — mirrors `useSpecialTools.ts`'s `onStairCreated`: `updatedScene = {...scene, entities: [...scene.entities, enriched]}` → `levelManager.setLevelScene(levelId, updatedScene)` → `EventBus.emit('drawing:entity-created', { entity, tool: 'stair-from-region' })`.
7. **Click routing** — a sibling branch in `canvas-click-bim-dispatch.ts`'s ordered if-chain: `if (activeTool === 'stair-from-region' && stairRegionTool?.isActive) { stairRegionTool.onCanvasClick(bimPoint); return true; }`, placed next to the existing `'stair'` branch.

---

## Architecture — flow

```
Ribbon click                     structuralTab.stairFromRegion toolBtn
      │                          (structural-circulation panel, icon 'stair')
      ▼
activeTool = 'stair-from-region'
      │
      ▼
Canvas clicks ──────────────────▶ canvas-click-bim-dispatch.ts
      │                           (sibling branch next to 'stair')
      ▼
usePolygonSketchChain             free multi-click vertex FSM
      │  (same engine as column/slab/wall-from-region, ADR-363)
      │  live preview → stair-region-preview-store
      ▼
onCommit(vertices) ───────────────▶ stair-region-classifier.ts
                                    shape → StairVariantParams['kind']
                                    + derived basePoint/direction/width
      │
      ▼
buildStairParamsFromRegion(...) ──▶ wraps buildDefaultStairParams
                                    (rise/tread/stepCount/codeProfile defaults
                                     unchanged; basePoint/direction/width/variant
                                     from the region)
      │
      ▼
buildStairEntity(params, levelId) ─▶ computeStairGeometry (ADR-358/611, unchanged)
      │
      ▼
Scene mutation (mirrors useSpecialTools onStairCreated):
  updatedScene = {...scene, entities:[...,enriched]}
  levelManager.setLevelScene(levelId, updatedScene)
  EventBus.emit('drawing:entity-created', {entity, tool:'stair-from-region'})
```

---

## SSoT reuse table

| Concern | SSoT (existing, reused verbatim) | New code (this ADR) |
|---|---|---|
| Free-polygon vertex capture (multi-click, snap, preview, Enter/auto-close) | `hooks/drawing/use-polygon-sketch-chain.ts` — `usePolygonSketchChain` | — (consumed as-is) |
| Sketch lifecycle sub-hook template | `hooks/drawing/use-column-polygon-sketch.ts` | `use-stair-region-sketch.ts` (mirrors the column template 1:1) |
| Live rubber-band preview store template | `bim/columns/column-polygon-preview-store.ts` | `bim/stairs/stair-region-preview-store.ts` |
| Default stair params (rise/tread/width/stepCount/codeProfile/handrails) | `hooks/drawing/stair-completion.ts` — `buildDefaultStairParams` | `buildStairParamsFromRegion` — thin wrapper, overrides only geometry-derived fields |
| Entity assembly + geometry computation | `stair-completion.ts` — `buildStairEntity` → `bim/geometry/stairs/StairGeometryService.ts` — `computeStairGeometry` | — (consumed as-is, zero duplicate math) |
| Shape classification precedent | `bim/columns/column-from-sketched-polygon.ts` (`classifyPerimeter`: rectangular / shear-wall / U-shape / composite) | `stair-region-classifier.ts` — new classifier, stair-specific buckets (see mapping table) |
| Ribbon button factory | `ui/ribbon/data/ribbon-large-button-helpers.ts` — `toolBtn(id,labelKey,icon,commandKey,shortcut?)` | New call in `structural-tab.ts`, reuses `'stair'` icon |
| Tool metadata | `ui/toolbar/types.ts` (`ToolType`), `systems/tools/tool-definitions.ts` (`TOOL_DEFINITIONS`) | New `'stair-from-region'` union member + entry (category `drawing`, `requiresCanvas: true`, `allowsContinuous: true`, `createsEntityType: 'stair'`) — mirrors the `'stair'` entry |
| Click routing | `hooks/canvas/canvas-click-bim-dispatch.ts` — ordered if-chain pattern | New sibling branch for `'stair-from-region'` |
| Region tool-id predicates (if hover/contextual gating needs one) | `systems/tools/region-tool-ids.ts` (ADR-419) | Optional minimal `isStairRegionTool` predicate, added only if a consumer needs it |
| Scene mutation + event emission | `hooks/tools/useSpecialTools.ts` — `onStairCreated` pattern | Mirrored for `stair-from-region`'s own `onStairFromRegionCreated` |

---

## Shape → StairType mapping

| Traced polygon shape | Classifier bucket | `StairVariantParams['kind']` | Notes |
|---|---|---|---|
| Rectangle (aspect any, 4 corners ≈ 90°) | `rectangular` | `'straight'` | Single flight along the long axis; `width` = short side, `totalRun` fitted to long side. |
| L-shape (6 vertices, one reflex/inner corner) | `l-turn` | `'l-shape'` (or `'winder'` when the turn radius is tight enough to require winder treads instead of a landing) | Landing-vs-winder choice: landing when the short leg ≥ 1 flight width, winder otherwise (mirrors ADR-611 `computeLShape`/`computeWinder` preconditions). |
| U-shape / switchback (8 vertices, two parallel turns) | `u-turn` | `'u-shape'` | Two flights + intermediate landing; centreline derived from the polygon's medial axis approximation. |
| Circle / near-circular closed curve (high vertex count, low aspect variance, curvature ≈ constant) | `circular` | `'spiral'` | Centre = polygon centroid; outer radius = polygon's bounding circle radius minus `walklineOffset`. |
| Anything else (irregular, self-intersecting-after-cleanup, degenerate) | `fallback` | `'straight'` | Best-effort: longest polygon edge becomes the run direction, bounding-box short side becomes `width`. Matches the existing `buildColumnFromSketchedPolygon` "return null on unusable input" safety net — stair-from-region logs + falls back to straight rather than rejecting the polygon outright, since a stair must always be produced from a stairwell trace. |

---

## Known gaps (recognition phase — not yet implemented)

- **Undo not yet wired.** Mirrors the current direct-mutation `'stair'` tool path (`levelManager.setLevelScene` called directly, no `CreateEntityCommand`) — this is a pre-existing gap in the plain stair tool, not a regression introduced here. Tracked for a future pass that moves both stair entry points onto the command-history pipeline (ADR-031).
- **Free-form arbitrary polygons are best-effort.** The classifier only recognises the four canonical buckets (rectangle/L/U/circle); anything else falls back to `'straight'` fitted to the bounding geometry. It does not attempt γ-shape, spiral-with-landing, or multi-turn switchback inference from irregular traces — those remain manual variant edits after placement, same as today.
- **Winder-vs-landing threshold** for the L-shape bucket needs a concrete numeric rule (flight-width comparison) validated against `computeLShape`/`computeWinder`'s actual preconditions before implementation — flagged here so the follow-up phase does not guess it silently.
- **i18n keys** (`ribbon.commands.bim.stairFromRegion`, `structuralTab.stairFromRegion`) must be added to both `el` and `en` locale JSONs in the implementation phase (N.11) — not yet added by this recognition-only ADR.

---

## Changelog
- **2026-07-10** — Initial (RECOGNITION+DESIGN). Documents the `stair-from-region` tool: free-polygon capture via `usePolygonSketchChain` (ADR-363 pattern) → new `stair-region-classifier.ts` (shape → `StairVariantParams['kind']`) → new `buildStairParamsFromRegion` (thin wrapper over `buildDefaultStairParams`) → unchanged `buildStairEntity`/`computeStairGeometry` (ADR-358/611) → scene mutation mirroring `useSpecialTools.onStairCreated`. Shape→type mapping: rectangle→straight, L→l-shape/winder, U→u-shape, circle→spiral, fallback→straight. No implementation files touched yet.
