# ADR-619: «Σκάλα από περιοχή» (Stair-from-Region) — free-polygon capture → shape-driven stair type

## Status
🟢 **IMPLEMENTED (v2 WALKLINE) — 2026-07-10** — Ribbon tool `stair-from-region` (tool id `'stair-from-region'`). User draws a **closed orthogonal polygon = the stairwell BOUNDARY** (corridor / λούκι) on the DXF floor plan, and the program auto-builds a BIM `StairEntity` fitted along the corridor. The classifier now **traces the walkline** (γραμμή ανάβασης = corridor medial axis: straight centrelines offset w/2 + radiused winder arcs at turns), checks whether the stair fits (compressing the going if needed), picks the base end deterministically, and maps everything onto a single variant `'sketch'` `StairParams` (see v2 changelog). **Supersedes** the original bbox-bucket shape classifier (straight/L/U/spiral) — that design (below) is kept for history only.

> **v1 (superseded) — RECOGNITION+DESIGN 2026-07-10**: the polygon **shape** decided the stair **type** (rectangle→straight, L→quarter-turn/winder, U→switchback, circle→spiral, else straight fallback). Replaced by v2 before shipping the geometry brain.

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

> ⚠️ **SUPERSEDED by v2 (2026-07-10, see changelog).** The bbox-bucket classifier
> below (rectangle→straight, L→l-shape/winder, U→u-shape, circle→spiral) is
> **replaced** by the WALKLINE algorithm: the polygon is now the stairwell
> **boundary** (corridor/λούκι), not a shape to bucket. There is a **single**
> output kind — variant `'sketch'` fed the traced walkline — regardless of how
> many turns the corridor has. The table is kept for historical context only.

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
- **2026-07-10** — IMPLEMENTATION (integration/wiring phase). Feature end-to-end wired. Actual classifier buckets (code = SSoT, supersede the design-phase bucket names in the mapping table above): `'straight' | 'lWithWinders' | 'switchback' | 'spiral'` (`stair-region-classifier.ts` → `StairRegionClassification`). New/changed files:
  - **New** `hooks/drawing/use-stair-region-sketch.ts` — sketch sub-hook mirroring `use-column-polygon-sketch.ts`; `usePolygonSketchChain({onCommit,getSceneUnits,getSceneEntities})`; `onCommit` = `classifyStairRegion` → `buildStairParamsFromRegion` → `buildStairEntity` → `onStairCreated`. Exposes `activate/deactivate/onCanvasClick/isActive/phase` (standalone tool, driven by `useToolLifecycle`).
  - **New** `bim/geometry/stairs/stair-region-preview-store.ts` — live rubber-band preview store, mirror of `column-polygon-preview-store.ts`.
  - **New** `bim/stairs/add-stair-to-scene.ts` — shared append+broadcast SSoT extracted from `useSpecialTools.onStairCreated` (floorId/buildingId stamp + `setLevelScene` + `emitBimEntityCreated`). Now used by BOTH the line-based `'stair'` tool and `'stair-from-region'` — avoids the N.18 sibling-clone that inlining the mutation body would have created.
  - **Changed** `hooks/tools/useSpecialTools.ts` — instantiate `useStairRegionSketch` + `useToolLifecycle(activeTool==='stair-from-region', …)`; refactored the existing `stairTool.onStairCreated` onto the new `addStairToScene` SSoT (shared `getStairFloorLink` + `stairFloorStamp`); expose `stairRegionTool`; removed now-unused `EventBus` import.
  - **Changed** `hooks/canvas/canvas-click-bim-dispatch.ts` — new PRIORITY 4.55 sibling branch routing `bimPoint` clicks to `stairRegionTool.onCanvasClick` (same ORTHO/POLAR-constrained point as slab/column-from-polygon).
  - **Changed** `hooks/canvas/canvas-click-types.ts`, `hooks/canvas/useCanvasClickHandler.ts`, `components/dxf-layout/CanvasSection.tsx` — thread `stairRegionTool` param through (mirror the `stairTool` plumbing).
  - **Changed** `hooks/drawing/drawing-preview-tool-points.ts` + `hooks/drawing/drawing-preview-generator.ts` — `stair-from-region` reuses the `column-from-polygon` rubber-band path (`stairRegionPreviewStore` vertices → `generateSlabPreview`).
  - Known gap (unchanged): the CREATE remains a direct `setLevelScene` (no `CreateEntityCommand`), mirroring the plain `'stair'` tool — `addStairToScene` keeps both entry points on the SAME pre-existing path so a future command-history migration flips both at once.
- **2026-07-10** — **v2 — WALKLINE ALGORITHM (supersedes the bbox-bucket classifier).** The polygon is now interpreted as the **stairwell BOUNDARY** (corridor / λούκι), not a shape to bucket into straight/L/U/spiral. The classifier traces the **walkline** (γραμμή ανάβασης = corridor medial axis) and the params builder fits a real stair onto it. The Shape→StairType mapping table above is **superseded** (kept for history). Steps:
  - **STEP 1 — Walkline trace** (`stair-region-walkline.ts`, new): (a) pair the **antiparallel wall edges** of each straight corridor segment (constant perpendicular distance = width; caps/short perpendicular edges ignored); a **min-width filter** (w = min pair distance, keep pairs ≈ w) rejects caps/notches that would otherwise pair with far outer walls. (b) each pair → **centreline** = offset w/2 from a wall, clipped to the walls' projection **overlap**. (c) at each **turn** (concave/reflex polygon vertex) → **winder arc** centred on the reflex vertex, radius = w/2, tangent to both adjacent centrelines (tangent point = perpendicular foot from the reflex vertex), joining them into a **continuous** open path (straights + quarter/partial arcs, no gaps). (d) result = ordered `WalklineSegment[]` (`{type:'line'}` / `{type:'arc', center, radius, startAngle, deltaAngle}`) + total arc-length L.
  - **STEP 2 — Width**: w = min measured pair distance; offset = w/2. `width < 1200 mm` → warning code `below-min-width` (below central-stairwell minimum) but proceeds with the measured width.
  - **STEP 3 — Fit check** (`computeWalklineStairFit`, `stair-params-from-region.ts`): H = floor height (floor link `height×1000`, else default **3000 mm**); r = default riser (seed). `N_risers = round(H/r)`, `r_actual = H/N_risers`, `N_goings = N_risers − 1`, `required = N_goings × going_default`. `required ≤ L` → `going_effective = going_default` (fits). `required > L` → **COMPRESS**: `going_effective = L / N_goings` + warning code `going-compressed` (Giorgio's choice — πυκνότερο πάτημα so all steps fit). Never throws.
  - **STEP 4 — Auto base**: the walkline has 2 free endpoints; **base = endpoint closest to the polygon's FIRST drawn vertex** (deterministic); stair ascends toward the other endpoint (user can flip later via the existing stair direction control).
  - **STEP 5 — Map to `StairParams`**: variant **`'sketch'`** (`StairVariantSketch.walklinePath`, the walkline-driven run — `computeSketch` → `computeWalklineStair`, ADR-611). `stepCount = N_goings` ⇒ `walklinePath.length = N_goings+1 = N_risers` (exactly what the sketch variant asserts); the walkline is **arc-sampled** at equal arc-lengths over the stair's occupied length (`N_goings × going_effective ≤ L`) from the base. Overrides `rise = r_actual`, `tread = going_effective`, `width = w`, `basePoint`/`direction` from STEP 4, `totalRise = r_actual × N_risers`, `totalRun = going_effective × N_goings`. Everything else (handrails/nosing/codeProfile/…) delegated to `buildDefaultStairParams` seed. Floor-link is used **only** to source H — it is NOT retained on the final params, otherwise `reconcileLinkedStair` would recompute `stepCount` and break the `walklinePath.length === stepCount+1` invariant. Downstream `computeStairGeometry`/`buildStairEntity` unchanged.
  - **Degenerate** (<3 vertices / zero area / no parallel pair) → minimal straight fallback walkline along the bbox long axis + warning code (`degenerate-region` / `no-corridor-pair`). Never throws.
  - **API** (entry-point names kept so `use-stair-region-sketch.ts` is untouched): `classifyStairRegion(vertices, sceneUnits) → StairRegionClassification { walkline, length, width, basePoint, topPoint, direction, footprint, warnings }`; `buildStairParamsFromRegion(classification, sceneUnits, floorLink) → StairParams` (variant `'sketch'`). Warnings are **structured codes** (not user-facing strings) → no i18n needed in the geometry module; the UI translates later.
  - **Files**: **new** `bim/geometry/stairs/stair-region-walkline.ts` (pure tracer + sampler); **rewritten** `stair-region-classifier.ts` (normalise + trace + fallback, brain replaced, entry name kept), `stair-params-from-region.ts` (fit check + sketch builder), `__tests__/stair-region-classifier.test.ts` (16 tests: straight / Γ 1-arc / Π 2-arc / narrow-warning / compressed-warning / degenerate-fallback / base-from-first-vertex + sketch-geometry-no-throw integration). SSoT reuse: `geometry-vector-utils` (dot/unit/perp-via-`perp`/pointOnCircle/vectorAngle), `polygon-utils` (area/bbox), `buildDefaultStairParams` seed, `computeStairGeometry` sketch path. jscpd-clean; no tsc (N.17).
- **2026-07-10** — **CORRIDOR-SELECTION FIX (microscopic + mislocated stair).** BUG: a hand-drawn stairwell boundary (which almost always carries a small notch/jog in the outline) produced a **microscopic** stair (going compressed to ~12 mm) placed **off the corridor** (on the notch, outside the intended path). Root cause in `stair-region-walkline.ts` `findCorridorSegments`: the corridor pair was chosen by the **smallest** pair width (`wMin`). A tiny notch forms an antiparallel pair of very small width → `wMin` locked onto it and rejected the real (wider) corridor → the walkline was ~notch-length (e.g. 200 mm) sitting on the notch. `computeWalklineStairFit` then compressed `N_goings × going` into that 200 mm → ~12 mm treads. **Numeric trace** (corridor 1200×6000 at world (50000,30000) with a 200 mm right-wall notch): before → `length=200, width=200, tread=12.5, base=(51000,30500)` (on the notch); after → `length=5400, width=1200, tread=280, base=(50600,30600)` (down the corridor centreline, walkline y 30600→35080, fully inside the polygon). FIX: select the corridor by keeping only pairs whose **centreline midpoint lies INSIDE the polygon** (rejects BOTH notches — a wall bite is a concave region *outside* the ring — AND the Π/U mouth span where the outer walls pair along a long centreline that crosses *outside* through the opening), then take `wRef = width of the LONGEST inside pair` and keep pairs ≈ `wRef` (greedy by descending length). Plain rectangle still → straight walkline down the long axis; L/U corridors still assemble with winder arcs. Reuses `pointInPolygon` (SSoT `bim/geometry/shared/polygon-utils.ts`) — no new point-in-polygon impl. Hypothesis-C (units) confirmed **latent only**: the scene builder always stamps `units:'mm'` (ADR-462 canonical-mm) so `getSceneUnits()`==`'mm'` at runtime; a mm-coords/‘m’-units mismatch would still shrink `occupiedLength` ~1000× but does not occur for imported DXF. Files: **changed** `bim/geometry/stairs/stair-region-walkline.ts` (`findCorridorSegments` selection + `centerlineLength`/`centerlineInside` helpers + `pointInPolygon` import; `traceCorridorWalkline` passes the lifted ring); **new** `__tests__/stair-region-nonzero-origin.test.ts` (notch-corridor-at-nonzero-origin: every walklinePath point inside polygon bbox + span ≈ `nGoings×tread` + tread not microscopic + geometry inside bbox; plain large rectangle → non-fallback straight long-axis walkline). All 173 stair-geometry tests green; jscpd-clean; no tsc (N.17).
- **2026-07-10** — **WIDTH-CLAMP FIX (bug #1 — stair width decoupled from corridor).** BUG: a wide corridor (measured 2.45 m) produced a **2.45 m-wide** stair, because STEP 5 mapped `width = classification.width` (the traced corridor width) straight onto the stair. Revit/ArchiCAD treat stair width as a **type parameter**, not a drawing-derived value — the corridor *constrains*, it does not *define*, the width. FIX (`stair-params-from-region.ts`, `buildStairParamsFromRegion`): `width = seed.width` **always** — i.e. the SSoT type default from `buildDefaultStairParams` (`DEFAULT_WIDTH_MM = 1200 mm`, «Κεντρικό Κλιμακοστάσιο», scene-scaled). Fully **decoupled** from `classification.width`; the stair centres on the walkline (offset w/2 tracer unchanged). A wider corridor → still 1.20 m stair; a narrower corridor → still 1.20 m stair + the pre-existing `below-min-width` warning (the type param never shrinks). No hardcoded literal introduced — reuses the existing width SSoT (`DEFAULT_WIDTH_MM` lives once in `stair-completion.ts`; the classifier's separate `MIN_CENTRAL_STAIRWELL_WIDTH_MM = 1200` remains the *warning threshold*, not the width source). The STEP-5 doc-comment/mapping-table `width = w` note is superseded by `width = type default`. Files: **changed** `bim/geometry/stairs/stair-params-from-region.ts` (one-line width source + doc), `__tests__/stair-region-classifier.test.ts` (+3 tests: 2.45 m corridor → 1.20 m stair `< corridor`; 0.9 m corridor → still 1.20 m + `below-min-width`; `'m'` scene units → 1.2 scene units). Out of scope (future bugs, Giorgio one-at-a-time): straight-vs-turns recognition, warning→toast wiring, latent mm/m scale gap. All 176 stair-geometry tests green; jscpd-clean; no tsc (N.17).
- **2026-07-10** — **MULTI-FLIGHT FILL + LANDINGS (bug #2 — stair crammed into 1 flight).** BUG: for a multi-flight corridor (e.g. a 4-flight spiral, walkline L≈15 m) the stair rendered as **one straight branch** and never reached the corridor top. **Traced the full pipeline** (confirmed the walkline tracer is CORRECT — `spiral-4flight` → `line/arc×3/line`, 4 flights): the defect was **downstream** in STEP 5. The old builder sampled the walkline over `occupiedLength = nGoings × going` (≈4.48 m) INCLUDING the arcs, so with a corridor longer than the stair's run all treads crammed into the first ≈4.48 m (base=(5400,2000)→(2862,4200), never reaching topPoint=(6000,600)). Root cause: risers are fixed by floor height (H/riser ≈ 17 → 16 goings × 280 = 4480 mm), and a longer drawn corridor left the tail unused. FIX (Revit-style, Giorgio's choice — *fill with landings*, *serial from base*): treads sit ONLY on the walkline's `line` segments (flights); each `arc` (turn) becomes a **flat landing** (constant z); the stair fills **serially from the base** and stops once all risers are placed (excess corridor unused — reached the top floor). Key enabler: `buildWalklineTreads` already reads `z = walkline[i].z` per point, so **mixed-z** walklines (rising treads + flat landings) render for free — the only thing forcing uniform rise was `enforceLinearRise`. New model:
  - **New** `bim/geometry/stairs/stair-region-fill.ts` — `flightLength()` (Σ of `line` lengths only), `distributeTreads()` (largest-remainder, exact per-flight counts for the compressed case), `buildSerialFillWalklinePath(segments, going, rise, nGoings, baseZ)` → `Point3D[]` with explicit per-point z. Two regimes: (a) **flights ≥ needed** → fixed `going` (280), serial from base, per-flight leftover → flat landing, stops at `nGoings` (long corridor ⇒ big top landing, going stays 280 — the user REJECTED spreading going across the whole length); (b) **compressed** (flights can't hold `nGoings` at 280) → exact per-flight tread distribution (`going_i = Li/ni`) so **every riser is placed and the stair reaches the floor** (fixes a boundary-waste under-fill where serial-fixed dropped a tread at each flight join).
  - **Changed** `stair-params-from-region.ts` — fit now runs against `flightLength(walkline)` (lines only, not total L incl. arcs) so compression triggers only when the *flights* are too short; `width = seed.width` (bug #1) unchanged; `walklinePath = buildSerialFillWalklinePath(...)`; `stepCount = walklinePath.length − 1` (treads + landing pairs, keeps the `walklinePath.length === stepCount+1` sketch invariant); removed the old `buildWalklinePath`/`sampleWalklineByLength` cram sampler.
  - **Changed** `bim/types/stair-types.ts` — `StairVariantSketch.preserveZ?: boolean` (opt-in: path already carries correct per-point z).
  - **Changed** `stair-geometry-sketch.ts` `computeSketch` — when `variant.preserveZ`, use the path z as-is (skip `enforceLinearRise`); classic single-riser sketch unchanged when absent (backward-compatible — existing sketch/elliptical stairs untouched).
  - **Tests** `__tests__/stair-region-classifier.test.ts` (+4): U-switchback @ 5 m floor → stair total-turning > π/2 (traverses both turns, not straight) + geometry no-throw; arcs → flat landings (mixed z: rising + flat steps); ALL risers placed → top z = rise·nGoings (reaches floor); long straight corridor (20 m) → `tread` stays 280 & stair spans < 6 m (excess = top landing, NOT spread). All 180 stair-geometry tests green; jscpd-clean; no tsc (N.17).
  - Out of scope / notes: `stepCount` now counts landing pairs too (a downstream "N steps" schedule reading `stepCount` would over-count — the region stair is a self-contained sketch variant, floor-link NOT retained so `reconcileLinkedStair` won't recompute); arcs render as curved-flat landings following the winder path (not squared landings) — consistent with the walkline model.
- **2026-07-10** — PREVIEW-GATING FIX. The integration phase mirrored `column-from-polygon`'s preview branch, but that path was **dead**: `useUnifiedDrawing.updatePreview` early-returns for any tool without an `isX` flag, and the `currentTool` ternary left BIM polygon tools at `'select'`, so `generatePreviewEntity`'s `if (tool === 'stair-from-region')` branch was unreachable (and a latent TS2367 — `'stair-from-region'` is not a `DrawingTool` member). Fix: `updatePreview` now sets `isStairRegion` and maps `currentTool → 'slab'` (the canonical polygon-footprint preview DrawingTool, identical reuse as roof/floor-finish/hatch) + adds `isStairRegion` to the early-return and `sceneUnitsForPreview` gates. The dedicated `'stair-from-region'` branch in `drawing-preview-generator.ts` was removed (subsumed byte-for-byte by the `tool === 'slab'` branch). Files: `hooks/drawing/useUnifiedDrawing.tsx`, `hooks/drawing/drawing-preview-generator.ts`. NOTE: `column-from-polygon` has the **identical** pre-existing dead-preview + latent-TS2367 issue (its branch stays untouched — out of scope for ADR-619); same one-line `currentTool → 'slab'` mapping would fix it.
