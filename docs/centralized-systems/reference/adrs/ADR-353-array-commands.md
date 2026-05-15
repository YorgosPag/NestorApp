# ADR-353: Array Commands — Rectangular, Path, Polar

**Status:** ✅ APPROVED — all 24 questions resolved, ready for Phase A implementation
**Date:** 2026-05-15
**Domain:** DXF Viewer — Modify Tools
**Shortcut:** `AR` (split button: ARR=rect, ARP=path, ARO=polar — TBD)
**Ribbon:** Home → Modify → Πίνακας (split: Ορθογώνιος / Κατά Διαδρομή / Πολικός)
**Related ADRs:** ADR-031 (Command Pattern), ADR-040 (Canvas Perf), ADR-049 (Move Tool), ADR-055 (Tool State), ADR-188 (Rotation), ADR-189 (Guide Polar Array), ADR-345 (Ribbon), ADR-348 (Scale Command), ADR-349 (Stretch), ADR-350 (Trim)

---

## Context

DXF Viewer ribbon (ADR-345) ships a "Πίνακας" (Array) split-button in Home → Modify with 3 variants — **Ορθογώνιος** (Rectangular), **Κατά Διαδρομή** (Path), **Πολικός** (Polar). All three currently `comingSoon: true` in `home-tab-modify.ts:228-262`. SVG icons already defined (`ARRAY_RECT_PATH`, `ARRAY_PATH_PATH`, `ARRAY_POLAR_PATH`). i18n keys already present in `el/dxf-viewer-shell.json:421-425` and `en/`. Tool registration in `TOOL_DEFINITIONS` and command implementation are pending.

Array is one of the foundational modify operations of every professional CAD product (parallel to Move, Copy, Rotate, Scale, Mirror — all already implemented in this codebase as separate Commands). This ADR is the architectural contract for implementing the 3 variants in a Google-level, SSOT-respecting way.

---

## Industry Research (2026-05-15)

Cross-vendor study (8 vendors): **Autodesk AutoCAD**, **Bricsys BricsCAD**, **Robert McNeel Rhino**, **Autodesk Revit**, **Graphisoft ArchiCAD**, **Trimble SketchUp**, **Vectorworks**, **DraftSight**. Plus open-source references: QCAD/LibreCAD, ODA Drawings SDK.

### Convergence Table — Feature Support

| Feature | AutoCAD | BricsCAD | Rhino | Revit | ArchiCAD | SketchUp | Vectorworks | DraftSight |
|---------|---------|----------|-------|-------|----------|----------|-------------|------------|
| Rectangular array | ✅ | ✅ | ✅ (ArrayLinear) | ✅ (Linear) | ✅ (Matrix) | via Move+`xN` | ✅ | ✅ |
| Polar array | ✅ | ✅ | ✅ | ✅ (Radial) | ✅ (Rotate) | via Rotate+`xN` | ✅ (Circular) | ✅ |
| Path array | ✅ | ✅ | ✅ (ArrayCrv) | ❌ | ❌ | ❌ (plugins) | ✅ (DupAlongPath) | ❌ base |
| Associative (parametric) | ✅ | ✅ | ❌ | ✅ (Group) | ❌ | ❌ | ❌ | ❌ base / ✅ Enterprise |
| Live preview | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ dialog | ✅ |
| Pre-selection | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multi-functional grips | ✅ | ✅ | ❌ | ✅ (limited) | ❌ | ❌ | ❌ | ❌ base |

### Industry-Standard Defaults

| Param | AutoCAD | Rhino | Note |
|-------|---------|-------|------|
| Rect rows × cols | **3 × 4** | (X,Y,Z prompted) | de-facto industry default |
| Rect spacing | bbox size × 1 (or 150 du) | user-specified | varies |
| Polar item count | **6** | 6 | universal |
| Polar fill angle | **360°** | 360° | universal |
| Polar rotate items | **Yes** | Yes | universal |
| Path method | **Divide** | Number | divide = equal spacing, count-driven |
| Path align items | **Yes** | Yes | universal — items follow path tangent |

### Core Mathematics (formalized)

**Rectangular** — pure translation per cell:
```
item(r, c).transform = Translate(basePoint + c·colSpacing·colDir + r·rowSpacing·rowDir)
```
Default `colDir = (1,0)`, `rowDir = (0,1)`. Optional `arrayAngle` rotates both basis vectors.

**Polar** — translation + optional rotation per item:
```
angleStep = (fillAngle == 2π) ? fillAngle/N : fillAngle/(N-1)
θ_i       = startAngle + i·angleStep
pos_i     = center + radius·(cos θ_i, sin θ_i)
transform = rotateItems
              ? Translate(center)·Rotate(θ_i - startAngle)·Translate(-center)
              : Translate(pos_i - basePoint)
```
**Critical**: when `fillAngle == 360°` divide by `N` (no duplicate at start=end). Partial arc: divide by `N-1` (endpoints inclusive). AutoCAD-confirmed convention.

**Path** — arc-length parametrization + optional tangent alignment:
```
totalLength   = arcLength(path)
divisor       = isClosed ? N : N - 1               // for Divide method
targetS_i     = i · (totalLength / divisor)        // Divide
              | i · spacing                        // Measure
{pos, tangent} = pointAtArcLength(path, targetS_i)
transform     = align ? Translate(pos)·Rotate(atan2(tangent.y, tangent.x))
                      : Translate(pos)
```
Measure mode beyond path end → silently omit out-of-range items (AutoCAD convention).

### Data Model — Associative vs Exploded

| Approach | Pros | Cons |
|----------|------|------|
| **Associative** (AutoCAD/BricsCAD/Revit pattern) — store params + source refs; compute items lazily at render | Parametric editing post-creation; small store footprint; instance-style reuse; matches industry standard | More complex command/store/render integration; requires new Entity type `ARRAY` |
| **Exploded** (Rhino/SketchUp/ArchiCAD pattern) — `execute()` creates N independent Entity copies | Simple: reuse existing Move/clone path; works with existing render pipeline as-is | Loses parametricity; bulky store; user must redo the array to change count |

**Decision: Associative** (see Decision section + Q1 in clarifications table).

---

## SSOT Integration — Existing Centralized Systems to Reuse

| Concern | SSOT module | File |
|---------|-------------|------|
| Command pattern (Undo/Redo) | `ICommand` (ADR-031) | `core/commands/interfaces.ts` |
| Command history | `getGlobalCommandHistory()` | `core/commands/CommandHistory.ts` |
| Compound transactions | `CompoundCommand` | `core/commands/CompoundCommand.ts` |
| Deep clone for undo snapshots (ADR-101/212) | `deepClone<T>` | `src/lib/clone-utils.ts` |
| Entity ID generation | `generateEntityId()` | `systems/entity-creation/utils` |
| Rotation math (deg) | `rotatePoint`, `rotateEntity` | `utils/rotation-math.ts` |
| Vector math (rad) | `geometry-vector-utils.ts` | `rendering/entities/shared/` |
| Arc geometry | `geometry-arc-utils.ts` | `rendering/entities/shared/` |
| Polyline length | `calculatePolylineLength` | `rendering/entities/shared/geometry-polyline-utils.ts` |
| Entity type guards (ADR-104) | `isLineEntity`, `isCircleEntity`, … | `types/entities.ts:369-425` |
| Tool registration (ADR-055) | `TOOL_DEFINITIONS` | `systems/tools/ToolStateManager.ts` |
| Selection state (ADR-030) | `UniversalSelectionState` | `systems/selection/` |
| Ribbon → action wiring (ADR-345) | `RibbonCommandContext` | `ui/ribbon/context/` |
| Existing polar pattern (guides) | `guide-polar-array` | `systems/guides/` — **study as reference, do not couple** |
| Ghost preview | `EntityPreviewTransform`, `applyEntityPreview` | `rendering/ghost/` |

**No new SSOT required** for math: all primitives already exist. New SSOT needed only for **arc-length parametrization** (currently absent) — proposed file: `systems/array/path-arc-length-sampler.ts`.

---

## Proposed Architecture (consolidated — see Decision section below for final form)

### Tool registration
Add to `ToolStateManager.ts` `TOOL_DEFINITIONS`:
- `array-rect` — modal: pre-selection → params → confirm
- `array-path` — modal: pre-selection → path pick → params → confirm
- `array-polar` — modal: pre-selection → center pick → params → confirm

Add to `ui/toolbar/types.ts` `ToolType`: `'array-rect' | 'array-path' | 'array-polar'`.

### Command classes (under `core/commands/entity-commands/`)
- `RectangularArrayCommand implements ICommand`
- `PathArrayCommand implements ICommand`
- `PolarArrayCommand implements ICommand`

Each stores: source entity snapshots (`deepClone`), parameter set, list of generated item IDs. `execute()` produces N entities via `sceneManager.addEntity()`. `undo()` removes them by ID. `redo()` re-executes with same params.

### Geometry computation modules (new SSOT)
- `systems/array/rect-transform.ts` — `computeRectTransforms(params): Transform2D[]`
- `systems/array/polar-transform.ts` — `computePolarTransforms(params): Transform2D[]`
- `systems/array/path-arc-length-sampler.ts` — `arcLengthTable(entity)`, `pointAtArcLength(table, s)`
- `systems/array/path-transform.ts` — `computePathTransforms(params, sampler): Transform2D[]`

### Entity transform applicator (reuses existing dispatcher pattern)
Pattern lifted from `scale-entity-transform.ts` / `rotation-math.ts`:
- `systems/array/array-entity-transform.ts` — `applyTransformToEntity(entity, transform): Entity` — dispatcher per entity type, returns cloned + transformed entity.

### Ribbon wiring
Remove `comingSoon: true` from 3 variants in `home-tab-modify.ts`. Add command keys to `useRibbonCommands` → `toolStateStore.selectTool('array-rect' | 'array-path' | 'array-polar')`.

### Preview
Use existing `EntityPreviewTransform` ghost render during parameter input (live preview pattern from Scale/Move).

---

## Open Questions (driving clarifications with Giorgio)

| # | Question | Status | Answer |
|---|----------|--------|--------|
| **Q1** | Associative or Exploded data model? | ✅ ANSWERED | **Associative** (ζωντανές) — params stored, items computed lazily, parametric editing post-creation. AutoCAD/Revit pattern. |
| **Q2** | Implement all 3 types in one phase or sequential (Rect first, then Polar, then Path)? | ✅ ANSWERED | **Sequential: Rect → Polar → Path.** Each phase ships independently, tested in isolation. Rectangular (easiest) first; Path (arc-length sampler, hardest) last. |
| **Q3** | UX flow: dialog modal vs side panel vs contextual ribbon during command? | ✅ ANSWERED | **Contextual Ribbon Tab** (AutoCAD 2013+ style). New temporary tab `Δημιουργία Πίνακα` (Array Creation) opens when command activates. Reuses pattern from ADR-344/345 (text editor contextual tab). Live preview on canvas during edits. Close button = confirm + exit. |
| **Q4** | Pre-selection allowed (AutoCAD style) or command-first only? | ✅ ANSWERED | **Both flows.** If user has pre-selected entities → use them immediately. If selection empty → prompt "Επίλεξε αντικείμενα". AutoCAD/Rhino/Revit industry standard. |
| **Q5** | Default values: confirm 3×4 rect / 6 polar / 360° / divide+align path? | ✅ ANSWERED | **All industry defaults accepted.** Rect: 3×4, spacing = bbox × 1.5 (auto, non-overlapping), angle 0°. Polar: 6 items, 360° full circle, rotate items = Yes. Path: Divide method, 6 items, align = Yes. |
| **Q6** | Multi-functional grips for post-creation editing (count, spacing)? | ✅ ANSWERED | **Both — grips AND contextual ribbon re-open on selection.** Premium AutoCAD-grade editing UX. Grips: corner triangle (count ±), middle handle (spacing), center square (move). Ribbon re-opens with current params for numeric editing. Live preview during grip drag and ribbon edits. |
| **Q7** | Negative spacing/angle support? | ✅ ANSWERED | **Yes — negative values allowed.** AutoCAD/BricsCAD standard. Negative spacing inverts direction; negative angle = clockwise. Zero remains invalid (validation rule). |
| **Q8** | Maximum item count safeguard (e.g. 1000)? Performance threshold for OffscreenCanvas? | ✅ ANSWERED | **Hard limit 5000 items total.** Warning prompt at 1000 ("Performance may degrade. Continue?"). Above 5000 → blocked with error message. OffscreenCanvas optimization kicks in automatically at 500+ items. |
| **Q9** | Multi-row variants of polar/path (advanced AutoCAD feature)? | ✅ ANSWERED | **Single row only.** Phases A/B/C ship single-row variants. Multi-row deferred to optional future phase D if real need emerges. Covers 90% of architectural use cases. |
| **Q10** | Path entities accepted: only LINE+POLYLINE+LWPOLYLINE+ARC+CIRCLE, or also SPLINE+ELLIPSE? | ✅ ANSWERED | **All 7 types** — LINE, POLYLINE, LWPOLYLINE, ARC, CIRCLE, ELLIPSE, SPLINE. Full AutoCAD coverage. SPLINE requires numerical arc-length reparametrization (binary search) — implemented in `path-arc-length-sampler.ts`. |
| **Q11** | Behaviour when source = multiple selected entities (compound source)? | ✅ ANSWERED | **Grouped (compound source).** Multiple selected entities treated as one logical source group. Relative positions preserved in each item. Single array, N copies of the entire group. AutoCAD/Revit standard. |
| **Q12** | Base point: user-pickable or auto = bounding-box center? | ✅ ANSWERED | **Auto default + optional override.** Default = bbox center. Ribbon exposes "Change base point" button → interactive pick (snap-aware). AutoCAD/Rhino pattern. |
| **Q13** | Source entity visibility/state after array creation (visible / hidden / becomes item 0)? | ✅ ANSWERED | **AutoCAD-style hidden source.** Source entities removed from scene and stored inside the ArrayEntity (`ArrayEntity.hiddenSources: Entity[]`). User sees only N rendered items. Editing requires special "Edit Array Source" mode (ARRAYEDIT pattern). |
| **Q14** | Source entity deletion: cascade delete array / warn / refuse delete? | ✅ ANSWERED | **Reframed under Q13=A (hidden source).** Source cannot be deleted standalone (hidden). Delete array = removes everything atomically. **Plus: Explode Array command added in Phase A** (AutoCAD pattern). Explode = breaks array into N independent entity copies, drops parametricity. Ribbon button + right-click menu entry. New `ExplodeArrayCommand : ICommand`. |
| **Q15** | Polar radius: auto-derived from source-to-center distance, or explicit user-editable param? | ✅ ANSWERED | **Auto + editable.** Initial value = distance(sourceBasePoint, polarCenter). Exposed in ribbon as numeric input + drag grip. Live preview on edit. AutoCAD/Revit pattern. PolarParams gains explicit `radius: number` field. |
| **Q16** | Path direction: auto from entity definition start, or user picks "near which end"? | ✅ ANSWERED | **Auto + reverse button.** Default direction follows path entity's internal vertex order. Ribbon "🔄 Reverse Direction" button toggles `PathParams.reversed: boolean`. Same toggle controls CCW vs CW on closed paths. Live preview on toggle. |
| **Q17** | Selection granularity: clicking an item selects the whole array, or that specific item? | ✅ ANSWERED | **Whole array (AutoCAD/Revit standard).** Click on any item selects the entire ArrayEntity. Cannot select individual items. To modify an individual item, user must Explode (Q14) first. Properties panel exposes array params, not per-item state. |
| **Q18** | Snap engine: other tools can snap to item endpoints/midpoints, or only to the source/array entity? | ✅ ANSWERED | **Full snap on all items.** Endpoints, midpoints, centers, intersections — all snap types active on every item. Snap engine queries item geometry per frame. **Performance:** viewport-culled — only items in visible canvas contribute snap candidates. Spatial index per array for fast hit-test. |
| **Q19** | Allowed source entity types: any (incl. TEXT/DIMENSION/BLOCK/ARRAY), or restricted set? | ✅ ANSWERED | **All entity types except nested arrays.** Allowed: geometry (LINE/POLYLINE/ARC/CIRCLE/ELLIPSE/SPLINE/RECTANGLE), TEXT/MTEXT, HATCH, INSERT/BLOCK, DIMENSION (if feasible — else Phase D), LEADER. **Forbidden:** ArrayEntity as source (no nested arrays — prevents recursion). Validation in `array-validation.ts`. |
| **Q20** | DXF file LOAD from external CAD with associative array: read as flat INSERTs (lose parametricity) or attempt XDATA-based reconstruction? | ✅ ANSWERED | **Flat load (V1).** External AutoCAD associative arrays read as N independent INSERT entities. No XDATA reconstruction. Parametric reconstruction deferred to optional Phase E. **Export remains as decided**: our ArrayEntity → exploded INSERT block refs in DXF (any reader compatible). |
| **Q21** | Edit Array Source mode: how to enter/exit? Double-click? Ribbon button? Both? Visual indicator? | ✅ ANSWERED | **Both entry paths.** Double-click on array OR ribbon "Edit Source" button → enter mode. Hidden source renders with dashed orange/yellow outline; items render at 50% opacity. Live item update during edits. Exit: ESC, click outside source bbox, or ribbon "End Edit" button. |
| **Q22** | Layer / color / lineweight inheritance: items inherit from source, or array entity owns its own layer/color? | ✅ ANSWERED | **Items inherit from source entity.** Array entity has no own layer/color. Edit Source mode → change source layer/color → all items reflect. Simple, predictable, single-source-of-truth for visual properties. |
| **Q23** | Path entity deletion while array exists: cascade delete array? Block deletion with prompt? Detach (lose path-based positioning)? | ✅ ANSWERED | **Warning prompt with options.** Modal dialog: "Delete both" / "Explode array (keep items)" / "Cancel". AutoCAD pattern. Implementation: `PathDeletionGuardService` checks for path references before allowing path entity deletion; intercepts and shows dialog. |
| **Q24** | Edit Source mode scope: edit-only (modify existing source entities) or full edit (add/delete entities too)? | ✅ ANSWERED | **Full edit.** Within Edit Source mode: modify, ADD new entities, DELETE existing entities. All changes apply to hidden source group → propagate to all items. Empty-source guard: warn user before deleting last source entity ("Source becomes empty. Delete array?"). AutoCAD/Revit pattern. |

### Architectural implications of Q1 = Associative + Q13 = Hidden source

- **New SceneEntity type** `'array'` added to `EntityType` union in `types/entities.ts`.
- **ArrayEntity** stores: `arrayKind` (`rect`/`path`/`polar`), `hiddenSources: Entity[]` (full entity copies, owned by the array — NOT scene references), `params: RectParams | PathParams | PolarParams`, `pathEntityId?: string` (path only — path entity remains visible in scene).
- **Source entities are extracted from scene on array creation** — moved into `ArrayEntity.hiddenSources` (deep-cloned). User no longer sees the original source standalone — only the N rendered items appear in the scene.
- **Edit Array Source mode** (AutoCAD ARRAYEDIT pattern): user double-clicks array → enters edit mode → hidden sources temporarily render as editable entities (with visual indicator: dashed outline, distinct color) → user edits via existing entity commands → exits edit mode → all N items reflect the edits.
- **Item rendering**: the renderer detects `ArrayEntity` and produces N transformed render passes from `computeXxxTransforms(params) + applyTransformToEntity(source, T_i)`. Items are **not** stored in the scene — only computed at render-time.
- **Source-change propagation**: when any source entity is mutated (move/edit vertex/etc.), the renderer reads fresh source state → all items reflect the change automatically (no manual sync).
- **Edit UX**: selecting the array selects the parameter set. Property panel exposes count/spacing/angle live editing. Confirmed grip support is Q6.
- **Undo/redo**: `CreateArrayCommand` adds the ArrayEntity; `UpdateArrayParamsCommand` patches params; `DeleteArrayCommand` removes it. Source-entity edits use their existing commands and are independent — undoing a source edit propagates to all items automatically.
- **Export to DXF**: explode to INSERT block references at write-time (block definition contains source entities; each item = block ref with item-specific transform). Compatible with AutoCAD/BricsCAD readers.

---

## Decision

Implement **three associative Array commands** — Rectangular, Polar, Path — in **3 sequential phases**, each shippable independently. All variants reuse the same `ArrayEntity` data model + render pipeline + edit UX skeleton. Live parametric editing via grips and contextual ribbon tab.

### Architectural Pillars

1. **Data model — Associative + Hidden Source**
   - New `EntityType` value `'array'`, new `ArrayEntity` discriminated union (kind: `'rect' | 'polar' | 'path'`).
   - Stores: `id`, `arrayKind`, `hiddenSources: Entity[]` (owned full clones, not scene refs), `params`, `pathEntityId?` (path only — path stays in scene), `basePointOverride?: Point2D`.
   - **On creation**: source entities deep-cloned into `hiddenSources`, then removed from scene. User sees only N rendered items.
   - **Items are NOT stored** — computed lazily at render time from `params + applyTransformToEntity(hiddenSources[k], T_i)`.
   - **Edit Array Source mode** (double-click or ribbon button) — temporarily exposes `hiddenSources` for editing via standard entity commands; auto-syncs all items on exit.

2. **UX — Contextual Ribbon Tab** (AutoCAD 2013+ pattern)
   - Reuses ADR-344/345 contextual tab infrastructure (already wired for text editor).
   - Tab `Δημιουργία Πίνακα` opens on command activate, closes on confirm/cancel.
   - Re-opens with current params when user selects an existing array entity.
   - Live canvas preview during widget edits.

3. **Selection flows — Both** (pre-selection + command-prompted)
   - Activation reads current `UniversalSelectionState`. If non-empty → use as source. If empty → enter selection mode (existing snap-aware selection cursor).
   - Multiple selected entities → **compound source** (relative positions preserved per item).

4. **Industry-standard defaults**
   - Rect: 3 rows × 4 cols; spacing = `sourceBbox × 1.5` (computed auto); angle 0°.
   - Polar: 6 items; fillAngle 360°; rotateItems true.
   - Path: method Divide; 6 items; align true.

5. **Numerical safety limits**
   - Hard limit 5000 items total (rows × cols × path-count). Blocks creation with i18n error.
   - Warning prompt at 1000 items: "Performance may degrade. Continue?".
   - OffscreenCanvas pre-render of source bitmap activated automatically when item count ≥ 500.
   - Validation: `count ≥ 1`, `spacing ≠ 0`, `fillAngle ≠ 0`. Negative values allowed (invert direction).

6. **Base point — Auto + override**
   - Default = bbox center of source group (computed by new util `computeSourceGroupBbox()` in `systems/array/array-bbox.ts`).
   - Ribbon exposes "Change base point" button → activates interactive pick with full snap engine support.
   - Override persisted in `ArrayEntity.basePointOverride`.

7. **Post-creation editing — Grips + Ribbon**
   - Grips (multi-functional, ADR-048 unified grip rendering pattern):
     - Rect: corner triangle = count ±, edge midpoint = spacing, center square = move.
     - Polar: outer triangle = item count, radial triangle = radius, center square = center move.
     - Path: triangle on path = item count, square = base offset.
   - Ribbon re-opens contextual tab with current params on array selection.
   - Both edit paths route through `UpdateArrayParamsCommand` → undoable.

8. **Path entity types — All 7**
   - LINE, POLYLINE, LWPOLYLINE, ARC, CIRCLE (analytical arc-length).
   - ELLIPSE, SPLINE (numerical arc-length via binary-search reparametrization).
   - New SSOT: `systems/array/path-arc-length-sampler.ts` with per-entity-type strategy dispatcher.

9. **DXF export**
   - On serialize: explode ArrayEntity into block reference (INSERT) entities. Block definition contains source entities; each item = INSERT with its computed transform.
   - Maintains compatibility with all DXF readers (associative array round-trip = nice-to-have, deferred).

---

## Phases (Sequential)

### Phase A — Rectangular Array (smallest scope, ships first)

**Files (new):**
- `systems/array/types.ts` — `ArrayEntity` (with `hiddenSources: Entity[]`, `arrayKind`, `params`, `pathEntityId?`, `basePointOverride?`), `RectParams`, `PolarParams`, `PathParams`, `ItemTransform` types.
- `systems/array/rect-transform.ts` — `computeRectTransforms(params, source): ItemTransform[]`.
- `systems/array/array-bbox.ts` — `computeSourceGroupBbox(entities): { center, size }`, `defaultRectSpacing(bbox)`.
- `systems/array/array-entity-transform.ts` — per-EntityType dispatcher: `applyTransformToEntity(entity, transform): Entity`. Reuses primitives from `geometry-vector-utils.ts`, `rotation-math.ts`. Covers all source types per Q19 (geometry, TEXT/MTEXT, HATCH, INSERT, DIMENSION best-effort, LEADER) — except ArrayEntity (forbidden source).
- `systems/array/array-validation.ts` — `validateArrayParams()` (count, spacing, max 5000 limit, 1000 warning, nested-array forbidden, source-type allowlist).
- `systems/array/array-source-extraction.ts` — extracts selected entities from scene into `hiddenSources` on array creation. Deep-clones via `deepClone`. Removes originals from scene. (Q13 hidden-source pattern.)
- `systems/array/array-snap-provider.ts` — exposes per-item snap candidates to snap engine. Viewport culling. Spatial index per array. (Q18.)
- `systems/array/path-deletion-guard.ts` — intercepts delete attempts on entities referenced as `pathEntityId` by any array. Shows modal "delete both / explode / cancel". (Q23.)
- `systems/array/array-edit-source-mode.ts` — controller for Edit Source mode: enter/exit, render-state toggle (dashed source + 50% items), entity add/delete/modify routing into `hiddenSources`. (Q21+Q24.)
- `core/commands/entity-commands/CreateArrayCommand.ts` — `ICommand` impl. `execute()`: extracts source entities from scene → adds ArrayEntity with `hiddenSources` populated.
- `core/commands/entity-commands/UpdateArrayParamsCommand.ts` — `ICommand` impl with merging window (for grip drag).
- `core/commands/entity-commands/DeleteArrayCommand.ts` — `ICommand` impl. Removes ArrayEntity atomically (hidden sources + items all go).
- `core/commands/entity-commands/ExplodeArrayCommand.ts` — `ICommand` impl. `execute()`: computes all item transforms → applies via `applyTransformToEntity` to each hidden source clone → adds N independent entities to scene → removes ArrayEntity. `undo()`: reverse. (Q14.)
- `core/commands/entity-commands/EditArraySourceCommand.ts` — compound command wrapping a session of entity edits inside `hiddenSources`. Or alternative: individual entity commands re-routed to operate on `hiddenSources` while edit mode is active.
- `ui/ribbon/data/contextual-array-tab.ts` — contextual tab schema (`array-rect` variant first). Includes widgets: rows, cols, rowSpacing, colSpacing, angle, "Change base point", "Edit source", "Explode", "Close" buttons.
- `ui/ribbon/components/RibbonArrayWidgets.tsx` — count/spacing numeric inputs + base-point button + edit-source button + explode button.
- `ui/ribbon/hooks/useRibbonArrayBridge.ts` — bridge to array store (live preview).
- `systems/array/array-grip-handlers.ts` — grip drag → `UpdateArrayParamsCommand`.
- `rendering/entities/array/array-renderer.ts` — render dispatcher (reads ArrayEntity, computes items, paints each). Items inherit source layer/color (Q22). Edit Source mode: dashed source outline + 50% opacity items.
- `rendering/entities/array/array-item-cache.ts` — OffscreenCanvas source bitmap cache activated when itemCount ≥ 500. Invalidation on `hiddenSources` hash change.
- `stores/ArrayStore.ts` — Zustand store for ephemeral state: in-progress array creation, current edit-source-mode array ID.
- `ui/dialogs/PathDeletionWarningDialog.tsx` — modal for Q23 prompt.
- `ui/dialogs/EmptySourceWarningDialog.tsx` — modal for Q24 empty-source guard.

**Files (modify):**
- `types/entities.ts` — add `'array'` to `EntityType`, add `ArrayEntity` to union, add `isArrayEntity` type guard.
- `systems/tools/ToolStateManager.ts` — register `array-rect` in `TOOL_DEFINITIONS`.
- `ui/toolbar/types.ts` — extend `ToolType` with `'array-rect'`.
- `ui/ribbon/data/home-tab-modify.ts` — remove `comingSoon: true` from `array.rectangular`.
- `i18n/locales/{el,en}/dxf-viewer-shell.json` — new keys for ribbon widgets, errors, warnings, prompts, edit-source mode labels, dialog texts.
- `rendering/scene/scene-renderer.ts` — dispatch ArrayEntity → array-renderer. Hide entities referenced as `hiddenSources` (they live only inside arrays).
- `systems/selection/click-handler.ts` (or equivalent) — array item hit → select whole ArrayEntity (Q17). Double-click on array → enter edit source mode (Q21).
- `systems/snap/snap-coordinator.ts` (or equivalent) — register `ArraySnapProvider` to feed item snap candidates.
- `core/commands/entity-commands/DeleteEntityCommand.ts` (or equivalent) — invoke `PathDeletionGuardService` on entities referenced as `pathEntityId` (Q23).
- `.ssot-registry.json` — register new module `array-system` (Tier 3) with forbidden patterns: direct items materialization, inline transform math outside canonical files, ArrayEntity as nested source.

**Tests (new):**
- `systems/array/__tests__/rect-transform.test.ts` — math, edge cases (count=1, negative spacing).
- `systems/array/__tests__/array-bbox.test.ts` — auto-spacing, multi-source bbox union.
- `systems/array/__tests__/array-validation.test.ts` — limit enforcement (5000 hard, 1000 warn), nested-array forbidden, source-type allowlist.
- `systems/array/__tests__/array-source-extraction.test.ts` — entity extraction from scene + restoration on undo.
- `systems/array/__tests__/array-snap-provider.test.ts` — item snap candidate generation, viewport culling.
- `systems/array/__tests__/array-edit-source-mode.test.ts` — enter/exit mode, add/delete/modify entities, empty-source guard.
- `core/commands/entity-commands/__tests__/CreateArrayCommand.test.ts` — execute/undo/redo, source extraction round-trip.
- `core/commands/entity-commands/__tests__/UpdateArrayParamsCommand.test.ts` — merging window.
- `core/commands/entity-commands/__tests__/ExplodeArrayCommand.test.ts` — N items materialized, ArrayEntity removed, undo restores all.
- `core/commands/entity-commands/__tests__/DeleteArrayCommand.test.ts` — atomic deletion.
- `__tests__/path-deletion-guard.test.ts` — prompt flow, "delete both" / "explode" / "cancel" outcomes.

**Acceptance:**
- Pre-selection + command-first flows both work.
- 3×4 default appears on first activation, auto-spacing = bbox × 1.5.
- Live preview updates within 16ms of widget change.
- Source entities extracted from scene on creation (hidden inside array).
- Click on any item → whole array selected.
- Double-click → enter Edit Source mode; ESC/click-outside/ribbon-button exits.
- Edit Source mode: add new entities, delete entities, modify entities — all reflected in N items live.
- Empty-source warning fires if last source entity deleted.
- Grips: count, spacing, move all functional.
- Re-open ribbon on array selection: params restored.
- Explode Array: produces N independent entities, ArrayEntity removed, undoable.
- Snap from other tools (LINE etc.) hits item endpoints/midpoints/centers correctly.
- Items use source layer/color/lineweight; no separate array layer.
- Undo/redo: create (with source extraction), param-edit (merged), delete, explode, edit-source operations.
- Limit enforcement: warning at 1000, block at 5000, nested-array refused.

---

### Phase B — Polar Array (reuses Phase A infrastructure)

**Files (new):**
- `systems/array/polar-transform.ts` — `computePolarTransforms(params, source): ItemTransform[]`. Handles 360° vs partial divisor, rotateItems toggle.

**Files (modify):**
- `systems/array/types.ts` — add `PolarParams` (already declared in Phase A types but unused).
- `systems/tools/ToolStateManager.ts` — register `array-polar`.
- `ui/toolbar/types.ts` — extend with `'array-polar'`.
- `ui/ribbon/data/contextual-array-tab.ts` — add polar variant widgets (count, fill angle, rotate items, center picker button).
- `ui/ribbon/components/RibbonArrayWidgets.tsx` — polar widget variants.
- `systems/array/array-grip-handlers.ts` — polar grip handlers (radial, angular).
- `rendering/entities/array/array-renderer.ts` — polar branch.
- `home-tab-modify.ts` — remove `comingSoon: true` from `array.polar`.
- `i18n/locales/*` — polar-specific keys.

**Tests (new):**
- `polar-transform.test.ts` — 360° divisor, partial-arc divisor, rotateItems off, negative fillAngle.

**Acceptance:**
- Center-point pick interactive (snap-aware).
- Default 6 items / 360° / rotate=Yes.
- 360° = no duplicate at start=end.
- Partial fillAngle inclusive of endpoints (`/(N-1)` divisor).
- Negative fillAngle = clockwise.
- rotateItems toggle visibly works on canvas.

---

### Phase C — Path Array (largest scope — net-new arc-length SSOT)

**Files (new):**
- `systems/array/path-arc-length-sampler.ts` — **net-new SSOT module**. Exports:
  - `buildArcLengthTable(entity: Entity): ArcLengthTable` — per-EntityType strategy (analytical for line/polyline/arc/circle; numerical with binary-search for ellipse/spline).
  - `pointAtArcLength(table, s): { point, tangent }`.
  - `totalArcLength(table): number`.
  - `isClosedPath(entity): boolean`.
- `systems/array/path-transform.ts` — `computePathTransforms(params, sampler, source): ItemTransform[]`. Handles Divide vs Measure, alignItems, closed-path divisor adjustment.
- `systems/array/path-sampler-strategies/` — sub-modules per EntityType:
  - `line-sampler.ts`, `polyline-sampler.ts`, `arc-sampler.ts`, `circle-sampler.ts`, `ellipse-sampler.ts`, `spline-sampler.ts`.

**Files (modify):**
- `systems/array/types.ts` — finalize `PathParams` (method, count|spacing, alignItems, pathEntityId).
- `systems/tools/ToolStateManager.ts` — register `array-path` with path-pick sub-state.
- `ui/toolbar/types.ts` — extend with `'array-path'`.
- `ui/ribbon/data/contextual-array-tab.ts` — path variant widgets (method toggle, count/spacing, align toggle, pick-path button).
- `systems/array/array-grip-handlers.ts` — path grip handlers (along-path drag).
- `rendering/entities/array/array-renderer.ts` — path branch.
- `home-tab-modify.ts` — remove `comingSoon: true` from `array.path`.
- `i18n/locales/*` — path-specific keys.

**Tests (new):**
- `path-arc-length-sampler.test.ts` — analytical accuracy for line/poly/arc/circle; numerical accuracy ≤ 1e-6 for ellipse/spline; closed-path detection.
- `path-transform.test.ts` — divide vs measure, alignItems on/off, closed-path divisor (`/N` not `/(N-1)`), out-of-range measure clamp.
- Per-entity strategy tests under `path-sampler-strategies/__tests__/`.

**Acceptance:**
- All 7 path entity types accepted as path.
- SPLINE: items distributed at equal arc-length intervals (±1e-6).
- Closed path (circle/closed polyline) Divide: no duplicate at start=end.
- Measure beyond path end: silent omit (AutoCAD behavior).
- alignItems true: each item tangent-rotated; false: orientation preserved.

---

### Phase D (Optional — Deferred)

- Multi-row variants of Polar and Path.
- Advanced features (Z direction, levels for 3D).
- Triggered only on confirmed user demand.

---

## Google-Level Architecture Checklist (N.7.2)

| # | Question | Answer |
|---|----------|--------|
| 1 | Proactive or reactive? | **Proactive** — array state created at command activation, parameters validated before render |
| 2 | Race condition possible? | **No** — synchronous validation → command execute → store update → render in single React commit. Grip drag uses merging command window (ADR-031 pattern). |
| 3 | Idempotent? | **Yes** — `CreateArrayCommand.execute()` checks if ArrayEntity already exists by ID; re-execution = no-op. `UpdateArrayParamsCommand` merge window prevents duplicate history entries. |
| 4 | Belt-and-suspenders? | **Yes** — primary path: ribbon widgets → store → renderer. Safety net: validation layer (`array-validation.ts`) refuses invalid params before reaching store. Hard limit 5000 prevents browser crash even if validation bypassed. |
| 5 | Single Source of Truth? | **Yes** — `ArrayEntity.params` is sole authority. Items computed from params, never persisted. Geometry math centralized in `systems/array/*-transform.ts`. Arc-length math centralized in `path-arc-length-sampler.ts`. Entity transform dispatcher in `array-entity-transform.ts` — no inline math elsewhere. |
| 6 | Fire-and-forget or await? | **Await** for all user-triggered transitions (create, param-update). Render loop fire-and-forget (16ms throttle on preview updates is non-blocking). |
| 7 | Who owns the lifecycle? | **Explicit**: `CreateArrayCommand` owns creation, `UpdateArrayParamsCommand` owns mutation, `DeleteArrayCommand` owns deletion. Ribbon widgets dispatch commands; never bypass the command bus. Source-entity edits route through existing entity commands — array auto-syncs at render. |

✅ **Google-level: YES — Associative model with SSOT-centralized math, command-pattern integration, hard safety limits, AutoCAD-grade UX.**

---

## SSoT Registry Module — Proposed

To be added to `.ssot-registry.json` in Phase A:

```json
{
  "name": "array-system",
  "tier": 3,
  "description": "ADR-353 Array Commands — single source for array math, entity transform, parametric items. No inline transform/sampling math outside this module.",
  "canonicalFiles": [
    "src/subapps/dxf-viewer/systems/array/rect-transform.ts",
    "src/subapps/dxf-viewer/systems/array/polar-transform.ts",
    "src/subapps/dxf-viewer/systems/array/path-transform.ts",
    "src/subapps/dxf-viewer/systems/array/path-arc-length-sampler.ts",
    "src/subapps/dxf-viewer/systems/array/array-entity-transform.ts",
    "src/subapps/dxf-viewer/systems/array/array-bbox.ts",
    "src/subapps/dxf-viewer/systems/array/array-validation.ts",
    "src/subapps/dxf-viewer/systems/array/array-source-extraction.ts",
    "src/subapps/dxf-viewer/systems/array/array-snap-provider.ts",
    "src/subapps/dxf-viewer/systems/array/path-deletion-guard.ts",
    "src/subapps/dxf-viewer/systems/array/array-edit-source-mode.ts"
  ],
  "forbiddenPatterns": [
    "// inline duplicate of rect/polar/path transform math outside canonicalFiles",
    "// items materialized into scene store (must be computed lazily)",
    "// ArrayEntity used as source for another ArrayEntity (nested arrays forbidden V1)",
    "// hiddenSources accessed/mutated outside Edit Source mode controller"
  ],
  "allowlist": []
}
```

---

## Implementation Sessions

This ADR will be implemented across **9 self-contained sessions** spanning the 3 phases. Each session ends with a working commit (in attesa Giorgio's order to commit per N.(-1)) and a handoff note for the next session. Between sessions, `/clear` is expected to keep cache warm and context clean.

### Session Status Matrix

| Phase | Session | Title | Status | Files | Est. duration | Date completed |
|-------|---------|-------|--------|-------|---------------|----------------|
| **A** | A1 | Foundation (types + math + dispatcher + validation + source extraction) | ✅ done | 7 new, 1 modify | ~45 min | 2026-05-15 |
| **A** | A2 | Commands (Create/Update/Delete/Explode + ArrayStore) | ✅ done | 5 new | ~30 min | 2026-05-15 |
| **A** | A3 | Rendering + Snap + Selection integration | ✅ done | 3 new, 2 modify | ~45 min | 2026-05-15 |
| **A** | A4 | Ribbon + Tool + Edit Source mode + Dialogs (Phase A SHIPS) | ✅ done | 11 new, 6 modify | ~75 min | 2026-05-15 |
| **B** | B1 | Polar math + command + tool registration | ✅ done | 2 new, 5 modify | ~30 min | 2026-05-15 |
| **B** | B2 | Polar ribbon + center picker + grips (Phase B SHIPS) | ⏳ pending | ~8 new/modify | ~45 min | — |
| **C** | C1 | Arc-length sampler analytical (LINE/POLY/ARC/CIRCLE) | ⏳ pending | ~6 new | ~45 min | — |
| **C** | C2 | Arc-length numerical (ELLIPSE/SPLINE) + path-transform | ⏳ pending | ~5 new/modify | ~60 min | — |
| **C** | C3 | Path ribbon + path picker + reverse button (Phase C SHIPS — feature complete) | ⏳ pending | ~7 new/modify | ~45 min | — |

**Total estimate: ~7 hours of focused implementation distributed across 9 sessions.**

---

### Per-session scope, deliverables, acceptance

#### Session A1 — Foundation

**Scope:** Pure logic, no UI. Lay down the type system and math.

**Files to create:**
1. `src/subapps/dxf-viewer/systems/array/types.ts` — `ArrayEntity`, `ArrayKind`, `RectParams`, `PolarParams`, `PathParams`, `ItemTransform`, `ArrayValidationResult` types.
2. `src/subapps/dxf-viewer/systems/array/rect-transform.ts` — `computeRectTransforms(params, sourceBbox): ItemTransform[]`.
3. `src/subapps/dxf-viewer/systems/array/array-bbox.ts` — `computeSourceGroupBbox(entities): SourceBbox`, `defaultRectSpacing(bbox)`.
4. `src/subapps/dxf-viewer/systems/array/array-entity-transform.ts` — per-EntityType dispatcher `applyTransformToEntity(entity, transform): Entity`.
5. `src/subapps/dxf-viewer/systems/array/array-validation.ts` — `validateArrayParams(params, sourceTypes): ArrayValidationResult` (count limits, nested-array refusal, source-type allowlist).
6. `src/subapps/dxf-viewer/systems/array/array-source-extraction.ts` — `extractSourcesFromScene(entities, sceneManager): Entity[]` (deep-clone + remove from scene); `restoreSourcesToScene` (for undo).

**Files to modify:**
- `src/subapps/dxf-viewer/types/entities.ts` — extend `EntityType` with `'array'`, add `ArrayEntity` to union, add `isArrayEntity` type guard.

**Tests:**
- `__tests__/rect-transform.test.ts` — math edge cases: count=1, negative spacing, angle rotation.
- `__tests__/array-bbox.test.ts` — multi-source bbox union.
- `__tests__/array-validation.test.ts` — 5000 hard limit, 1000 warn, nested forbidden, source-type allowlist.
- `__tests__/array-entity-transform.test.ts` — round-trip transform for each supported source type.

**Acceptance:**
- ✅ All types compile with strict TS.
- ✅ `computeRectTransforms({rows:3, cols:4, ...})` returns exactly 12 `ItemTransform` objects.
- ✅ `applyTransformToEntity` correctly transforms LINE/CIRCLE/POLYLINE/TEXT.
- ✅ `validateArrayParams` blocks 5001 items, warns 1001 items, refuses ArrayEntity source.
- ✅ Source extraction round-trip: extract → restore identical entities.
- ✅ All new tests pass; no regressions in existing tests.

**Handoff to A2:** Foundation types stable. A2 can `import type` freely. No UI/render/store yet.

---

#### Session A2 — Commands

**Scope:** All ICommand classes + Zustand store.

**Files to create:**
1. `src/subapps/dxf-viewer/core/commands/entity-commands/CreateArrayCommand.ts` — extracts sources, creates `ArrayEntity`. Undoable.
2. `src/subapps/dxf-viewer/core/commands/entity-commands/UpdateArrayParamsCommand.ts` — patches `params`, supports merging window per ADR-031.
3. `src/subapps/dxf-viewer/core/commands/entity-commands/DeleteArrayCommand.ts` — atomic removal (hidden sources + array entity).
4. `src/subapps/dxf-viewer/core/commands/entity-commands/ExplodeArrayCommand.ts` — materializes N items as independent entities, removes ArrayEntity, undoable.
5. `src/subapps/dxf-viewer/stores/ArrayStore.ts` — Zustand: in-progress creation state, current `editSourceArrayId`.

**Tests:**
- `__tests__/CreateArrayCommand.test.ts` — execute extracts sources; undo restores them; redo re-extracts.
- `__tests__/UpdateArrayParamsCommand.test.ts` — merging window collapses successive drag updates.
- `__tests__/DeleteArrayCommand.test.ts` — atomic removal; undo restores everything.
- `__tests__/ExplodeArrayCommand.test.ts` — N entities materialized with correct transforms; undo restores array.

**Acceptance:**
- ✅ Create + Undo + Redo + Delete + Explode chain works in isolation.
- ✅ Merging window collapses ≤500ms updates into single history entry.
- ✅ All tests pass.

**Handoff to A3:** Commands callable. A3 will integrate with renderer + scene.

---

#### Session A3 — Rendering + Snap + Selection

**Scope:** Make the array visible and interactive on canvas.

**Files to create:**
1. `src/subapps/dxf-viewer/rendering/entities/array/array-renderer.ts` — reads ArrayEntity, computes items, renders each via existing entity renderers. Edit Source mode visual variant (dashed source + 50% opacity items).
2. `src/subapps/dxf-viewer/rendering/entities/array/array-item-cache.ts` — OffscreenCanvas source bitmap cache, activated when itemCount ≥ 500. Hash key on `hiddenSources`.
3. `src/subapps/dxf-viewer/systems/array/array-snap-provider.ts` — exposes per-item snap candidates with viewport culling.

**Files to modify:**
- `src/subapps/dxf-viewer/rendering/scene/scene-renderer.ts` — dispatch ArrayEntity → array-renderer.
- `src/subapps/dxf-viewer/systems/snap/<coordinator>.ts` — register ArraySnapProvider.
- `src/subapps/dxf-viewer/systems/selection/<click-handler>.ts` — hit on item geometry → select whole ArrayEntity (Q17). Double-click → enter edit source mode (handled by A4 controller).

**Tests:**
- `__tests__/array-snap-provider.test.ts` — item snap point generation; viewport culling.
- Visual regression: render fixture array, snapshot comparison.

**Acceptance:**
- ✅ Programmatically created ArrayEntity renders N items correctly on canvas.
- ✅ Items use source layer/color/lineweight.
- ✅ Snap from LINE tool hits item endpoints/midpoints/centers.
- ✅ Click on any item selects whole array; ArrayEntity highlight shown.
- ✅ OffscreenCanvas cache hit confirmed at 500+ items (perf trace).

**Handoff to A4:** Array visible + interactive. A4 adds creation UX via ribbon.

---

#### Session A4 — Ribbon + Tool + Edit Source + Dialogs (PHASE A SHIPS)

**Scope:** Full user-facing UX. End of session = user can create + edit + explode + delete rectangular arrays.

**Files to create:**
1. `src/subapps/dxf-viewer/ui/ribbon/data/contextual-array-tab.ts` — rect variant tab schema (rows, cols, spacing, angle, base-point, edit-source, explode, close).
2. `src/subapps/dxf-viewer/ui/ribbon/components/RibbonArrayWidgets.tsx` — numeric inputs + buttons.
3. `src/subapps/dxf-viewer/ui/ribbon/hooks/useRibbonArrayBridge.ts` — bridge ribbon ↔ ArrayStore, live preview.
4. `src/subapps/dxf-viewer/systems/array/array-grip-handlers.ts` — rect grip drag → `UpdateArrayParamsCommand`.
5. `src/subapps/dxf-viewer/systems/array/array-edit-source-mode.ts` — controller for enter/exit, render-state toggle, entity add/delete/modify routing.
6. `src/subapps/dxf-viewer/systems/array/path-deletion-guard.ts` — intercepts delete on `pathEntityId` references (no path arrays yet but infrastructure ready).
7. `src/subapps/dxf-viewer/ui/dialogs/PathDeletionWarningDialog.tsx` — Q23 modal.
8. `src/subapps/dxf-viewer/ui/dialogs/EmptySourceWarningDialog.tsx` — Q24 modal.

**Files to modify:**
- `src/subapps/dxf-viewer/systems/tools/ToolStateManager.ts` — register `array-rect` with pre-selection + selection-prompt sub-states.
- `src/subapps/dxf-viewer/ui/toolbar/types.ts` — extend `ToolType` with `'array-rect'`.
- `src/subapps/dxf-viewer/ui/ribbon/data/home-tab-modify.ts` — remove `comingSoon: true` from `array.rectangular` (line ~245).
- `src/i18n/locales/{el,en}/dxf-viewer-shell.json` — new keys for ribbon labels, dialog texts, prompts, warnings.
- `.ssot-registry.json` — register `array-system` Tier 3 module.
- Existing entity DeleteEntityCommand — invoke `PathDeletionGuardService` (no-op for now without path arrays, infrastructure-ready).

**Tests:**
- `__tests__/array-edit-source-mode.test.ts` — enter/exit, add/delete/modify entities within edit mode, empty-source warning trigger.
- E2E: full create flow via ribbon (pre-select + activate + 3×4 default + adjust + close).
- E2E: edit source flow (double-click → modify → exit → items reflect).
- E2E: explode flow.

**Acceptance:**
- ✅ Click `Ribbon → Home → Modify → Ορθογώνιος Πίνακας` opens contextual tab.
- ✅ 3×4 default appears; live preview on widget change.
- ✅ Grip drag: count and spacing adjustments work.
- ✅ Double-click on array → Edit Source mode; add/delete/modify entities; ESC/outside-click/ribbon-button exits.
- ✅ Empty-source warning fires correctly.
- ✅ Explode produces N independent entities; undo restores.
- ✅ All snap types active on items from other tools.
- ✅ i18n keys present in el + en, no hardcoded strings.
- ✅ SSoT ratchet passes; no new violations.
- ✅ Full TS strict; no `any`.
- ✅ Pre-commit hook passes.

**Handoff to B1:** Phase A complete. Rectangular Array shippable. Same UX infrastructure (ribbon tab, edit mode, dialogs, grips) will be reused by Polar in B2.

---

#### Session B1 — Polar math + command + tool

**Scope:** Polar-specific math + minimal command wiring. No UI yet.

**Files to create:**
1. `src/subapps/dxf-viewer/systems/array/polar-transform.ts` — `computePolarTransforms(params, sourceBbox): ItemTransform[]`. Handles 360° vs partial divisor, rotateItems toggle, negative fillAngle (CW), radius derivation/override.

**Files to modify:**
- `systems/array/types.ts` — finalize `PolarParams` (count, fillAngle, startAngle, rotateItems, radius, center, basePointOverride?).
- `systems/array/array-validation.ts` — polar-specific validation (count ≥ 1, fillAngle ≠ 0).
- `systems/tools/ToolStateManager.ts` — register `array-polar` (selection + center-pick + params sub-states).
- `ui/toolbar/types.ts` — extend with `'array-polar'`.

**Tests:**
- `__tests__/polar-transform.test.ts` — 360° divisor (N), partial divisor (N-1), rotateItems on/off, negative fillAngle CW, radius override.

**Acceptance:**
- ✅ Polar math correct for: 6/360° (no duplicate), 5/180° (endpoints inclusive), 4/-90° (CW), rotateItems off (constant orientation).
- ✅ Radius override produces correct positions.
- ✅ Tool registered; no UI yet.

**Handoff to B2:** Math ready. B2 adds UI.

---

#### Session B2 — Polar ribbon + center picker + grips (PHASE B SHIPS)

**Scope:** Full polar UX.

**Files to modify:**
- `ui/ribbon/data/contextual-array-tab.ts` — add polar variant widgets (count, fill angle, rotate-items toggle, radius input, center picker button, reverse direction for fill direction).
- `ui/ribbon/components/RibbonArrayWidgets.tsx` — polar widget variants.
- `systems/array/array-grip-handlers.ts` — polar grips (radial drag, angular drag, center move).
- `rendering/entities/array/array-renderer.ts` — polar branch.
- `ui/ribbon/data/home-tab-modify.ts` — remove `comingSoon: true` from `array.polar`.
- `i18n/locales/{el,en}/dxf-viewer-shell.json` — polar-specific keys.

**Files to create:**
- `systems/array/polar-center-pick-controller.ts` — interactive center-point pick with snap.

**Tests:**
- E2E: polar create flow (pre-select + click center + 6 items 360° default + adjust).
- E2E: polar edit (radius drag, count drag).

**Acceptance:**
- ✅ Click Polar button → contextual tab opens → ribbon prompts "click center".
- ✅ Center picker snap-aware.
- ✅ Default 6 items / 360° / rotate=Yes / radius auto.
- ✅ Grips: radial, angular, center-move all functional.
- ✅ Pre-commit hook passes.

**Handoff to C1:** Phase B complete. Polar shippable.

---

#### Session C1 — Arc-length sampler analytical

**Scope:** Arc-length core + analytical strategies (5 entity types).

**Files to create:**
1. `src/subapps/dxf-viewer/systems/array/path-arc-length-sampler.ts` — public API: `buildArcLengthTable(entity)`, `pointAtArcLength(table, s)`, `totalArcLength(table)`, `isClosedPath(entity)`. Strategy dispatcher.
2. `src/subapps/dxf-viewer/systems/array/path-sampler-strategies/line-sampler.ts` — analytical.
3. `.../polyline-sampler.ts` — segment iteration (reuses `calculatePolylineLength`).
4. `.../lwpolyline-sampler.ts` — same with LWPOLYLINE bulge handling.
5. `.../arc-sampler.ts` — analytical (arc length = R × Δθ).
6. `.../circle-sampler.ts` — closed-path detection + arc-length formula.

**Tests:**
- Per-strategy tests under `__tests__/path-sampler-strategies/`. Exact analytical accuracy.
- Closed-path detection: circle = closed, line = open, polyline closed flag.

**Acceptance:**
- ✅ `totalArcLength` matches analytical for each type within 1e-10.
- ✅ `pointAtArcLength(table, totalLength / 2)` returns midpoint geometrically.
- ✅ Tangent direction correct (perpendicular to radius for circle, etc.).

**Handoff to C2:** Analytical sampler complete. C2 adds numerical + uses sampler to compute path transforms.

---

#### Session C2 — Arc-length numerical + path-transform

**Scope:** ELLIPSE + SPLINE numerical strategies + path transform composition.

**Files to create:**
1. `src/subapps/dxf-viewer/systems/array/path-sampler-strategies/ellipse-sampler.ts` — numerical: sample densely, build (t, s) table, binary search.
2. `.../spline-sampler.ts` — numerical: De Boor evaluation + arc-length table + binary search.
3. `src/subapps/dxf-viewer/systems/array/path-transform.ts` — `computePathTransforms(params, sampler, sourceBbox): ItemTransform[]`. Handles Divide vs Measure, alignItems, reversed direction, closed-path divisor adjustment.

**Files to modify:**
- `systems/array/types.ts` — finalize `PathParams` (method: 'divide' | 'measure', count, spacing?, alignItems, pathEntityId, reversed).
- `systems/array/array-validation.ts` — path-specific validation.
- `systems/tools/ToolStateManager.ts` — register `array-path` (selection + path-pick + params).
- `ui/toolbar/types.ts` — extend with `'array-path'`.

**Tests:**
- `__tests__/path-sampler-strategies/ellipse-sampler.test.ts` — ±1e-6 accuracy vs known ellipse arc length.
- `__tests__/path-sampler-strategies/spline-sampler.test.ts` — ±1e-6 accuracy vs reference NURBS.
- `__tests__/path-transform.test.ts` — Divide/Measure, alignItems, reversed, closed-path divisor (/N vs /N-1), out-of-range Measure clamp.

**Acceptance:**
- ✅ Ellipse + SPLINE sampler ±1e-6 accuracy.
- ✅ Path transform produces correct positions + tangents for all 7 entity types.
- ✅ Closed-path Divide uses /N (no duplicate at start=end).
- ✅ Measure beyond path silently omits.
- ✅ Reversed flag inverts traversal order.
- ✅ Tool registered.

**Handoff to C3:** Math ready. C3 adds UI.

---

#### Session C3 — Path ribbon + path picker + reverse (PHASE C SHIPS — FEATURE COMPLETE)

**Scope:** Final path UX. End of session = complete Array system shipped.

**Files to modify:**
- `ui/ribbon/data/contextual-array-tab.ts` — path variant widgets (method toggle, count or spacing, align toggle, reverse direction button, pick-path button).
- `ui/ribbon/components/RibbonArrayWidgets.tsx` — path widget variants.
- `systems/array/array-grip-handlers.ts` — path grips (along-path count drag).
- `rendering/entities/array/array-renderer.ts` — path branch.
- `ui/ribbon/data/home-tab-modify.ts` — remove `comingSoon: true` from `array.path`.
- `i18n/locales/{el,en}/dxf-viewer-shell.json` — path-specific keys.
- `path-deletion-guard.ts` — wire up actively (real path arrays now exist).

**Files to create:**
- `systems/array/path-pick-controller.ts` — interactive path-entity pick (filters to 7 allowed types, highlights candidates on hover).

**Tests:**
- E2E: path create flow (pre-select + click path entity + 6 items + adjust).
- E2E: reverse direction toggle.
- E2E: path deletion warning + each option (delete both / explode / cancel).

**Acceptance:**
- ✅ Click Path button → contextual tab → prompts "click path".
- ✅ Path picker only accepts 7 allowed types (snap highlight).
- ✅ Default 6 items / Divide / align=Yes.
- ✅ Reverse button toggles direction; live preview updates.
- ✅ Path entity deletion warning fires with 3 options; each works.
- ✅ SPLINE path: items at equal arc-length intervals visible on canvas.
- ✅ Pre-commit hook passes.
- ✅ **Array system feature complete.**

**Handoff to maintenance:** Array system shipped. Phase D (multi-row, advanced) remains optional per CLAUDE.md.

---

### Handoff Note Template

At the end of every session, append to ADR-353 Changelog:

```
| YYYY-MM-DD | Session XN COMPLETE — [one line summary]. Files: [list]. Tests: [X new, Y passing]. Decisions: [any deviation from plan + reason]. Next session (XN+1): [pre-requisites checked / ready to start]. Gotchas: [anything tricky encountered]. |
```

### Status Update Rule

After each session, update the Status Matrix row (column "Status" → ✅ done, "Date completed" → actual date). When the last session of a phase completes, add a separate changelog entry "Phase X COMPLETE — feature shippable."

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-15 | ADR created. Industry research (8 vendors) consolidated. Open questions Q1–Q12 listed. Awaiting Giorgio clarifications. |
| 2026-05-15 | **Q1 ANSWERED — Associative** (ζωντανές). Architectural implications section added: new `ArrayEntity` type, lazy item computation, auto-sync from source edits, DXF export as block reference. |
| 2026-05-15 | **Q2 ANSWERED — Sequential phasing.** Phase A: Rectangular. Phase B: Polar. Phase C: Path. Each phase = standalone shippable + tested. Rect first (simplest), Path last (arc-length sampler is net-new SSOT). |
| 2026-05-15 | **Q3 ANSWERED — Contextual Ribbon Tab.** AutoCAD 2013+ pattern. Temporary tab opens on command activate. Reuses ADR-344/345 contextual tab infrastructure (already used by text editor). Live canvas preview while editing widgets. |
| 2026-05-15 | **Q4 ANSWERED — Both selection flows.** Pre-selection used if present; otherwise command prompts for selection. AutoCAD/Rhino/Revit standard. |
| 2026-05-15 | **Q5 ANSWERED — Industry defaults.** Rect 3×4, auto-spacing bbox×1.5, angle 0°. Polar 6 items, 360°, rotate Yes. Path Divide, 6 items, align Yes. |
| 2026-05-15 | **Q6 ANSWERED — Both grips + ribbon for editing.** Full AutoCAD-grade post-creation UX. Multi-functional grips + contextual ribbon re-opens on array selection. |
| 2026-05-15 | **Q7 ANSWERED — Negative values allowed.** AutoCAD/BricsCAD standard. Zero remains invalid. |
| 2026-05-15 | **Q8 ANSWERED — Hard limit 5000, warning at 1000.** Auto OffscreenCanvas optimization at 500+. Prevents browser crash on accidental input. |
| 2026-05-15 | **Q9 ANSWERED — Single row only.** Multi-row variants deferred to optional Phase D. |
| 2026-05-15 | **Q10 ANSWERED — All 7 path entity types** including SPLINE + ELLIPSE. Full AutoCAD coverage. SPLINE handled via numerical arc-length reparametrization in `path-arc-length-sampler.ts`. |
| 2026-05-15 | **Q11 ANSWERED — Compound source grouping.** Multiple selected entities treated as one source unit. Relative positions preserved in each item. |
| 2026-05-15 | **Q12 ANSWERED — Base point auto + override.** Default = bbox center of source group. Ribbon "Change base point" button for interactive snap-aware pick. |
| 2026-05-15 | **ADR APPROVED Round 1.** All Q1–Q12 resolved. Decision, Phases A/B/C/D, Google-level checklist, SSoT registry module written. |
| 2026-05-15 | **Re-review: 8 critical gaps identified (Q13–Q20).** Status reverted to DRAFT. Second clarification round opened. |
| 2026-05-15 | **Q13 ANSWERED — Hidden source (AutoCAD style).** ArrayEntity owns `hiddenSources: Entity[]` (deep-cloned, removed from scene on creation). N items rendered from hidden sources. Edit Array Source mode (ARRAYEDIT pattern) for in-place source editing. |
| 2026-05-15 | **Q14 ANSWERED — Explode Array command in Phase A.** New `ExplodeArrayCommand` — breaks array into N independent entities. Ribbon button + right-click menu. Standard array delete operates on the whole atomically. |
| 2026-05-15 | **Q15 ANSWERED — Polar radius: auto + editable.** Initial = distance(sourceBasePoint, polarCenter). PolarParams.radius numeric input in ribbon + drag grip. |
| 2026-05-15 | **Q16 ANSWERED — Path direction: auto + reverse button.** Default follows path entity vertex order. `PathParams.reversed` toggle in ribbon. Same control for CW/CCW on closed paths. |
| 2026-05-15 | **Q17 ANSWERED — Whole-array selection.** Clicking any item selects the entire ArrayEntity. Per-item edit requires Explode (Q14). |
| 2026-05-15 | **Q18 ANSWERED — Full snap on all items.** All snap types active. Viewport culling for performance. Snap engine extension required (new module: `systems/array/array-snap-provider.ts`). |
| 2026-05-15 | **Q19 ANSWERED — All entity types except nested arrays.** Geometry, text, hatch, block, dimension, leader all allowed. ArrayEntity forbidden as source. DIMENSION may defer to Phase D if complex. |
| 2026-05-15 | **Q20 ANSWERED — Flat load V1.** External DXF associative arrays read as N independent INSERT entities. No XDATA reconstruction. Parametric reconstruction deferred to optional Phase E. |
| 2026-05-15 | **Third pass — 3 additional gaps identified (Q21–Q23):** edit source UX, properties inheritance, path-deletion-while-array-exists. |
| 2026-05-15 | **Q21 ANSWERED — Edit source mode: double-click + ribbon button.** Dashed orange source outline; items at 50% opacity; live updates. Exit via ESC, click outside, or ribbon button. |
| 2026-05-15 | **Q22 ANSWERED — Items inherit from source.** No separate array layer/color. Edit Source changes propagate to all items. |
| 2026-05-15 | **Q23 ANSWERED — Path deletion: warning + options.** Modal "delete both / explode / cancel". New `PathDeletionGuardService`. |
| 2026-05-15 | **Fourth pass — 1 final gap identified (Q24):** Edit Source mode scope (edit-only vs full edit with add/delete). |
| 2026-05-15 | **Q24 ANSWERED — Full edit in Edit Source mode.** Modify + add + delete entities within hidden source group. Empty-source guard dialog. Items auto-update on all changes. |
| 2026-05-15 | **ADR FINALIZED — all 24 questions resolved.** Phase A files list expanded with: source extraction, snap provider, path deletion guard, edit source mode, item bitmap cache, modal dialogs. Status: APPROVED, ready for Phase A implementation. |
| 2026-05-15 | **Implementation Sessions plan added.** 9 sessions (A1-A4, B1-B2, C1-C3) with per-session scope, files, tests, acceptance criteria, handoff template, status matrix. Each session ends in a committable + tested state. `/clear` between sessions. Total estimate ~7h focused work. |
| 2026-05-15 | **Session A1 COMPLETE** — Foundation types + math. Files: `systems/array/types.ts`, `rect-transform.ts`, `array-bbox.ts`, `array-entity-transform.ts`, `array-validation.ts`, `array-source-extraction.ts` (6 new); `types/entities.ts` (1 modified: added `'array'` to EntityType, ArrayEntity interface, isArrayEntity guard, re-export ArrayKind/ArrayParams). Tests: 52 new, 52 passing. Decisions: ArrayEntity defined in entities.ts (not systems/array/types.ts) to avoid circular import (Entity↔ArrayEntity via hiddenSources). WARN_LIMIT=1000 boundary is 'warn' not 'ok' (5000 items = warn). Next session (A2): import `ArrayEntity` from `types/entities`, `ArrayParams` from `systems/array/types`. Foundation stable. Gotchas: circular import Entity↔types.ts resolved by hosting ArrayEntity in entities.ts. |
| 2026-05-15 | **Session A2 COMPLETE** — Commands + ArrayStore. Files: `CreateArrayCommand.ts`, `UpdateArrayParamsCommand.ts`, `DeleteArrayCommand.ts`, `ExplodeArrayCommand.ts` (4 new in `core/commands/entity-commands/`); `systems/array/ArrayStore.ts` (1 new). Tests: 46 new, 46 passing (4 suites under `core/commands/entity-commands/__tests__/`). Decisions: (1) ArrayStore uses module-level pub/sub (not Zustand) — consistent with all other tool stores in codebase (ExtendToolStore, ScaleToolStore pattern). (2) ExplodeArrayCommand throws clear error for 'polar'/'path' kinds — those array types cannot be created in Phase A so branch is unreachable in practice. (3) deepClone imported from `utils/clone-utils` (not `lib/clone-utils`) — consistent with entity-commands pattern. Next session (A3): commands callable. Integrate with renderer + scene (array-renderer.ts, scene-renderer.ts dispatch, click-handler selection, snap-coordinator). Gotchas: none — all types aligned with A1 foundation. |
| 2026-05-15 | **Session A3 COMPLETE** — Rendering + Snap + Selection. Files: `systems/array/array-expander.ts` (new — pure expansion fn, no canvas); `useDxfSceneConversion.ts` (modified — 1→N array handling in entity loop, separate WeakMap array cache); `snapping/hooks/useGlobalSnapSceneSync.ts` (modified — expands ArrayEntities before snap engine init). Tests: 8 new in `systems/array/__tests__/array-expander.test.ts`. Decisions: (1) `array-expander.ts` placed in `systems/array/` (not `rendering/entities/array/`) — it is a pure expansion function shared by rendering AND snap, not a canvas draw renderer. ADR path was aspirational. (2) Rendered items carry parent `arrayId` as their `id` — hit-test returns `arrayId` on click, `handleDxfEntitySelect(arrayId)` selects the ArrayEntity directly, no extra resolver needed (ADR-353 Q17). (3) Separate `WeakMap<object, DxfEntityUnion[]>` array cache in useDxfSceneConversion — stable ArrayEntity ref reuses expansion result. (4) `useDxfSceneConversion.ts` NOT listed as ADR-040 critical file — modification safe. `useGlobalSnapSceneSync.ts` in snap/ path — ADR-353 staged in same commit covers CHECK 6D. Gotchas: none. Next session (A4): Ribbon + Tool + Edit Source mode. |
| 2026-05-15 | **Phase A COMPLETE — Rectangular Array feature shippable.** User flow: pre-select source entities → ribbon Home → Modify → Πίνακας → Ορθογώνιος (or AR shortcut) → ArrayEntity created with 3×4 + bbox×1.5 defaults → contextual Array tab auto-opens (selection trigger 'array-selected') → adjust rows/cols/spacing/angle live via comboboxes → Edit Source / Explode / Close from the Actions panel. Snap engine sees all items via array-expander.ts (A3). Polar (Phase B) and Path (Phase C) deferred. |
| 2026-05-15 | **Session B1 COMPLETE — Polar math + tool registration.** Files (new, 2): `systems/array/polar-transform.ts` (`computePolarTransforms` — 360° divisor N / partial divisor N-1 / rotateItems / negative fillAngle CW / radius explicit or auto-derived from distance(sourceBbox.center, center)); `systems/array/__tests__/polar-transform.test.ts` (12 tests, all passing). Files (modified, 5): `systems/array/array-expander.ts` (dispatch refactored to switch — `rect` → computeRectTransforms, `polar` → computePolarTransforms, `path` → empty Phase C placeholder); `systems/array/__tests__/array-expander.test.ts` (updated polar test case from `toHaveLength(0)` to real 6-item expansion + added `arrayId` propagation test); `core/commands/entity-commands/ExplodeArrayCommand.ts` (added polar branch via computePolarTransforms, fixed missing pivot arg in applyTransformToEntity — pre-existing bug silent on rect because rotateDeg=0 always, but critical for polar); `systems/tools/ToolStateManager.ts` (registered `array-polar`, `requiresCanvas: true` — B2 needs center-pick interactivo); `ui/toolbar/types.ts` (+`'array-polar'` to ToolType union). Tests: 74 passing (6 suites in systems/array). Decisions: (1) `isFullCircle = Math.abs(fillAngle) === 360` — handles both +360 and -360 as full-circle (no duplicate). (2) `divisor = isFullCircle ? count : Math.max(count - 1, 1)` — clamps denominator to 1 when count=1 to avoid division by zero on partial arc. (3) `rotateDeg = rotateItems ? i * angleStep : 0` — rotation around `pos_i` (via applyTransformToEntity pivot contract = bbox.center + translate). (4) Pivot bug in ExplodeArrayCommand fixed: `applyTransformToEntity(source, transform, bbox.center)` — bbox computed once outside inner loops and reused. Next session (B2): Polar ribbon (contextual tab variant) + interactive center picker + grip drag handlers radial/angular. Gotchas: rotateItems=true items rotate around their own center (pos_i), NOT around the polar center — this matches AutoCAD behavior and is enforced by the applyTransformToEntity pivot contract. |
| 2026-05-15 | **Session A4 COMPLETE — Phase A SHIPS.** Ribbon + Tool + Edit-source controller + dialogs wired end-to-end. Files (new, 11): `hooks/tools/useArrayTool.ts` (single-shot activation from pre-selection → CreateArrayCommand + select new ArrayEntity); `systems/array/array-grip-handlers.ts` (pure math — origin/col-count/row-count/col-spacing/row-spacing grip projections); `systems/array/array-edit-source-mode.ts` (enter/exit controller, empty-source guard returns `{ok:false, reason:'empty'}`); `systems/array/path-deletion-guard.ts` (Phase-A no-op stub, infra ready for Phase C); `ui/dialogs/PathDeletionWarningDialog.tsx` + `EmptySourceWarningDialog.tsx` (portal modals, mounted later); `ui/ribbon/data/contextual-array-tab.ts` + trigger `ARRAY_CONTEXTUAL_TRIGGER='array-selected'` (3 panels: Geometry/Spacing/Actions, comboboxes with auto-inject free-typed values); `ui/ribbon/hooks/useRibbonArrayBridge.ts` (subscribes to ArrayStore.inProgressParams via useSyncExternalStore, writes via UpdateArrayParamsCommand.isDragging=true for undo-merge); `ui/ribbon/hooks/useArrayRibbonActions.ts` (intercepts array-explode / array-edit-source / array-close-tab actions); `ui/ribbon/hooks/bridge/array-command-keys.ts` (registry of `array.params.*` keys). Files (modified, 6): `ui/toolbar/types.ts` (+`'array-rect'` to `ToolType`); `systems/tools/ToolStateManager.ts` (register array-rect editing category, requiresCanvas=false); `ui/ribbon/data/home-tab-modify.ts` (rectangular comingSoon → false, both modify panel + edit panel); `config/keyboard-shortcuts.ts` (`arrayRect: AR`); `hooks/tools/useModifyTools.ts` (mount useArrayTool, accept setSelectedEntityIds prop); `components/dxf-layout/CanvasSection.tsx` (pass setSelectedEntityIds to useModifyTools); `app/DxfViewerContent.tsx` (extend `activeContextualTrigger` for `entity.type==='array'`, add CONTEXTUAL_ARRAY_TAB to ribbonContextualTabs, wire useRibbonArrayBridge + useArrayRibbonActions + new useRibbonCommands `arrayBridge` arg); `ui/ribbon/hooks/useRibbonCommands.ts` (compose text+array bridges via `isArrayRibbonKey` prefix routing). i18n: el+en `dxf-viewer-shell` (ribbon.tabs.arrayEditor, ribbon.panels.array{Geometry,Spacing,Actions}, ribbon.commands.arrayEditor.* + root `array.{pathDeletion,emptySource,validation}.*`) + `tool-hints` (arrayTool.needsSelection, arrayTool.nestedForbidden). Decisions: (1) Single-shot activation pattern (pre-select → activate → array auto-created → switch back to select) instead of stateful tool — keeps useArrayTool ~150 LOC and aligns with AutoCAD ARRAYRECT command-line behavior. (2) Numeric inputs implemented as reusable RibbonCombobox (no new widget components needed) — free-typed values auto-inject as first option via existing `valueInOptions` logic in `RibbonCombobox.tsx`. (3) `ArrayStore.inProgressParams` reused as the bridge override so the just-typed value is visible to leaf comboboxes before the next scene mutation propagates (cleared on primary-selection change). (4) Action interception (`array-explode/edit-source/close-tab`) lives in a tiny `useArrayRibbonActions` hook that wraps `wrappedHandleAction` rather than extending `useDxfViewerCallbacks` — keeps callbacks module unchanged. (5) Phase-A `path-deletion-guard` and `EmptySourceWarningDialog` shipped as stubs (no path arrays exist, empty-source case unreachable until Edit Source UX matures) — full wire-up deferred. (6) `.ssot-registry.json` `array-system` Tier-3 entry deferred to follow-up commit (no concrete forbidden-pattern boundaries earned yet — adding aggressive ratchet today would block legitimate Phase B/C work). Next session (B1): Polar math + tool registration. Gotchas: `universalSelection` does not expose `setSelected` — useModifyTools now wraps the parent's `setSelectedEntityIds` together with `universalSelection.clearByType('dxf-entity') + select(id, 'dxf-entity')` to mirror the rotation-tool selection pattern (canvas-click-handler.ts:302-303). |
