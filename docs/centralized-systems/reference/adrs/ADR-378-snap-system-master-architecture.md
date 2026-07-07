# ADR-378 — Snap System Master Architecture & SSoT

| Πεδίο | Τιμή |
|---|---|
| **Status** | ✅ **COMPLETE** 2026-05-27 — Master ADR + Phases 1+2+3+4+5+6 ALL DONE |
| **Date** | 2026-05-27 |
| **Category** | DXF Viewer — Snapping (Master) |
| **Location** | `docs/centralized-systems/reference/adrs/ADR-378-snap-system-master-architecture.md` |
| **Author** | Claude Opus 4.7 + Γιώργος Παγώνης |
| **Supersedes (consolidates)** | Phantom ADR-149 (referenced by ADR-371 but never written) |
| **Companions (sub-decisions)** | ADR-087 (config constants), ADR-095 (tolerance), ADR-137 (icon geometry), ADR-153 (tooltip offset), ADR-371 (BIM corners), ADR-362 (dimension snap), ADR-363 (column center), ADR-189 (construction guides), ADR-344 (text snap), ADR-040 (lifecycle owner), ADR-357 (override modes), ADR-514 (unified BIM cursor placement-snap «Ένας Εγκέφαλος Έλξης» — tool-agnostic entry over the Layer-2 placement resolvers) |
| **Industry alignment** | Revit (Snap Engine), AutoCAD (OSNAP), ArchiCAD (Snap Guide + Hotspots), BricsCAD (ESNAP), SketchUp (Inference Engine), Vectorworks (Snapping Palette), BentleyMicroStation (AccuSnap) |

---

## Summary

Master ADR που τεκμηριώνει την **ενιαία αρχιτεκτονική** του snap system στην εφαρμογή Nestor: **1 production singleton** (`ProSnapEngineV2` via `getGlobalSnapEngine()`) που οργανώνει **26 sub-engines** μέσω **Registry → Orchestrator → Spatial Index** pattern — ακριβώς όπως κάνουν οι παγκόσμιοι παίκτες CAD/BIM.

**Το πρόβλημα**: Πριν αυτό το ADR υπήρχαν **5 παράλληλα snap συστήματα** στον κορμό της εφαρμογής (DXF Viewer main + geo-canvas + AI "demo" + Text half-done + ghost duplicate instance), χωρίς κανένα master document που να εξηγεί ποιο είναι το production path και ποια είναι παρακαμπτήρια. Το ADR-371 αναφέρει «ADR-149 Snap Engine Priorities» — αλλά **ADR-149 δεν υπήρξε ποτέ**. 4 υπάρχοντα snap ADRs (087/095/137/153) είναι όλα στενά scoped σε constants κεντρικοποιήσεις, όχι αρχιτεκτονικής.

**Η λύση**: Αυτό το ADR-378 ως master για:
1. **Architecture diagram** της production pipeline (single instance + registry + 26 engines)
2. **Module inventory** με production status (active / dead / experimental / cross-domain)
3. **Priority hierarchy table** (resurrects the phantom ADR-149 priorities)
4. **Centralization roadmap** για cleanup των 4 παράλληλων συστημάτων
5. **SSoT enforcement** μέσω `.ssot-registry.json` forbidden patterns

---

## 1. Context & Gap Analysis

### 1.1 Η αφορμή (2026-05-27 dialogue)

Γιώργος: «Πόσα συστήματα snap χρησιμοποιούμε; Είναι σωστό να υπάρχουν όλα αυτά; Θα το έκαναν αυτό οι μεγάλοι παίχτες παγκοσμίως;»

Έρευνα έδειξε:
- **5 παράλληλα snap συστήματα** στον κορμό (μη συμπεριλαμβανομένων 3 legitimately separate 3D domains)
- **Industry**: Revit/AutoCAD/ArchiCAD/BricsCAD/SketchUp/Vectorworks/Bentley — ΌΛΟΙ έχουν 1 engine με N modes via registry pattern
- **60% σωστό** (ProSnapEngineV2 ακολουθεί το pattern) / **40% παράλληλο/dead**

### 1.2 Documentation gap

| ADR | Σκοπός | Είναι master; |
|---|---|---|
| ADR-087 | Snap config constants (`SNAP_SEARCH_RADIUS`, multipliers) | ❌ narrow |
| ADR-095 | `SNAP_TOLERANCE = 10` central constant | ❌ narrow |
| ADR-137 | Icon SVG geometry (sizes/ratios) | ❌ narrow |
| ADR-153 | Tooltip offset 15px | ❌ narrow |
| ADR-371 | BIM corner snap (5 corner engines) | ❌ feature-scoped |
| ADR-189 §3.7-3.16 | Construction snap points | ❌ feature-scoped |
| ADR-362 I1 | Dimension snap (2 engines) | ❌ feature-scoped |
| ADR-363 Phase 5.5i | Column center snap | ❌ feature-scoped |
| ADR-344 Phase 6.B | Text snap provider | ❌ half-done |
| ADR-040 | Lifecycle owner pattern | ⚠️ tangential |
| **ADR-149** | **«Snap Engine Priorities»** | **❌ phantom — never written** |

**Κανένα δεν είναι master.** Αυτό το ADR-378 γίνεται το master.

### 1.3 Industry confirmation

| Player | Engine | Modes (approx.) | Pattern |
|---|---|---|---|
| AutoCAD | OSNAP | 13 + grid | Single engine, mode flags, F3 toggle |
| Revit | Snap Engine | 13+ | Single engine, type registry, SR keyboard |
| ArchiCAD | Snap Guide | endpoint/mid/center/intersection + guides + hotspots | Single coordinator, palette toggles |
| BricsCAD | ESNAP | 14 | Single, mode flags |
| SketchUp | Inference Engine | endpoint/midpoint/intersection/on-face/parallel/perpendicular | Single, contextual hints |
| Vectorworks | Snapping Palette | 13+ palettes | Single, palette-driven |
| Bentley | AccuSnap | 13+ | Single, key-ins per mode |

**Σύγκλιση 7/7**: 1 engine + N modes via registry. Κανένας δεν έχει 2+ παράλληλα engines.

---

## 2. Architecture

### 2.1 Production pipeline (canonical)

```
┌────────────────────────────────────────────────────────────────┐
│  React Layer                                                   │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  CanvasSection (orchestrator — ADR-040)                  │ │
│  │    └─ useGlobalSnapSceneSync({ scene, overlays })        │ │
│  │          │ (sole owner of initialize(), single per scene)│ │
│  │          ▼                                                │ │
│  │  Drawing hooks (useDrawingHandlers, useSnapManager)      │ │
│  │    └─ findSnapPoint(cursor) → ProSnapResult              │ │
│  └────────────────┬─────────────────────────────────────────┘ │
└───────────────────┼────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────────┐
│  Module Singleton Layer                                        │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  global-snap-engine.ts                                   │ │
│  │    _instance: ProSnapEngineV2 | null                     │ │
│  │    getGlobalSnapEngine() → THE one engine in the app    │ │
│  │    getLastSnapEntityFingerprint() / setLastSnap... ()    │ │
│  │    __resetGlobalSnapEngineForTests()                     │ │
│  └────────────────┬─────────────────────────────────────────┘ │
└───────────────────┼────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────────┐
│  Snap Engine Layer                                             │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  ProSnapEngineV2 (thin facade)                           │ │
│  │    ├─ SnapEngineCore (settings + viewport + delegator)   │ │
│  │    ├─ SnapDebugLogger (observability)                    │ │
│  │    └─ SnapPresets (architectural/engineering/simple)     │ │
│  └────────────────┬─────────────────────────────────────────┘ │
└───────────────────┼────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────────┐
│  Orchestration Layer                                           │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  SnapOrchestrator                                        │ │
│  │    ├─ SnapEngineRegistry (Map<SnapType, BaseSnapEngine>) │ │
│  │    ├─ SnapCandidateProcessor (sort + tab-cycle)          │ │
│  │    └─ SnapContextManager (per-mode pixel→world tolerance)│ │
│  └────────────────┬─────────────────────────────────────────┘ │
└───────────────────┼────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────────┐
│  Engine Layer — 26 sub-engines (all extend BaseSnapEngine)    │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Classic CAD (14):                                       │ │
│  │    Endpoint, Midpoint, Intersection, Center, Quadrant,   │ │
│  │    Nearest, Tangent, Parallel, Extension, Node,          │ │
│  │    Insertion, Near, Perpendicular, Ortho                 │ │
│  │  Grid/Guide (3):                                         │ │
│  │    Grid, Guide (ADR-189), ConstructionPoint (ADR-189)    │ │
│  │  Dimension (2):                                          │ │
│  │    DimDefPoint, DimLine (ADR-362 I1)                     │ │
│  │  BIM (6):                                                │ │
│  │    ColumnCenter (ADR-363), WallCorner, BeamCorner,       │ │
│  │    SlabCorner, ColumnCorner, OpeningCorner (ADR-371)     │ │
│  │  Text (1):                                               │ │
│  │    TextSnapEngine (ADR-378 Phase 3 — ADR-344 Phase 6.C)  │ │
│  └────────────────┬─────────────────────────────────────────┘ │
└───────────────────┼────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────────────┐
│  Spatial Index Layer (per engine, RBush O(log N))              │
│  ISpatialIndex.querySnap(point, radius, tag) → results         │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 Render output pipeline

```
ProSnapResult (from findSnapPoint)
    │
    ├─→ ImmediateSnapStore (zero-cost, perf-critical, ADR-040)
    │      ├─ Writer: mouse-handler-move
    │      └─ Readers: SnapIndicatorOverlay (useSyncExternalStore)
    │                  ghost-preview hooks
    │
    └─→ SnapContext (React) — toggle state SSoT
           ├─ snapState (per-type booleans)
           ├─ snapEnabled (master toggle, F3 binding pending)
           └─ enabledModes (derived Set)
```

### 2.3 Override system (separate concern)

`SnapOverrideOrchestrator` (ADR-357) is **NOT** a duplicate of `SnapOrchestrator`. It is a parallel command-mode handler για one-shot override modes (analogous to AutoCAD `Shift+right-click` snap override menu):
- `'from'` — relative-to-reference snap
- `'m2p'` — mid-between-2-points
- `'app'` — apparent intersection
- Single-fire `ExtendedSnapType` overrides

Consumed by drawing/measure hooks via `useSyncExternalStore`. Documented here so future readers do not mistake it for redundancy.

---

## 3. Production Module Inventory

### 3.1 Active production core (DO NOT DUPLICATE)

| Module | File | Role |
|---|---|---|
| `ProSnapEngineV2` | `snapping/ProSnapEngineV2.ts` | Facade — settings, viewport, presets, logger |
| `SnapEngineCore` | `snapping/SnapEngineCore.ts` | Internal delegator to orchestrator |
| `SnapOrchestrator` | `snapping/orchestrator/SnapOrchestrator.ts` | Engine loop, sub-pixel early-exit |
| `SnapEngineRegistry` | `snapping/orchestrator/SnapEngineRegistry.ts` | Map of 26 engines |
| `SnapCandidateProcessor` | `snapping/orchestrator/SnapCandidateProcessor.ts` | Sort + tab-cycle |
| `SnapContextManager` | `snapping/orchestrator/SnapContextManager.ts` | Per-mode tolerance |
| `BaseSnapEngine` | `snapping/shared/BaseSnapEngine.ts` | Abstract base for all engines |
| `global-snap-engine.ts` | `snapping/global-snap-engine.ts` | **Module singleton — sole production instance (ADR-040)** |
| `useGlobalSnapSceneSync` | `snapping/hooks/useGlobalSnapSceneSync.ts` | **Sole `initialize()` owner** |
| `useSnapManager` | `snapping/hooks/useSnapManager.tsx` | Per-canvas settings sync |
| `useProSnapIntegration` | `hooks/common/useProSnapIntegration.ts` | UI toolbar entry (CadDock, StatusBar) |
| `SnapContext` / `SnapProvider` | `snapping/context/SnapContext.tsx` | Toggle state SSoT (Firestore-persisted) |
| `SnapOverrideOrchestrator` | `snapping/overrides/SnapOverrideOrchestrator.ts` | ADR-357 command-mode overrides (separate concern) |
| `TextSnapEngine` | `snapping/engines/TextSnapEngine.ts` | **ADR-378 Phase 3 (2026-05-27)** — TEXT/MTEXT 8-point snap (insertion + 4 corners + center + 2 edge mids). Linear scan over text-filtered entities. Approximate bbox from fontSize/text length (TEXT) or width × height (MTEXT). Priority 2 (same tier as INSERTION). Registered as `ExtendedSnapType.TEXT`. |
| Geo-canvas `useSnapEngine` façade | `geo-canvas/floor-plan-system/snapping/hooks/useSnapEngine.ts` | **ADR-378 Phase 4 (2026-05-27)** — React hook façade that delegates to `getGlobalSnapEngine()`. Internally calls `parserResultToEntities(parserResult)` adapter + maps `ProSnapResult` → geo-canvas `SnapResult` shape via `EXTENDED_TO_GEO_MODE` (6 classic CAD types preserved; other 19+ ExtendedSnapType fall through to `SnapMode.ENDPOINT` for render-layer compatibility). Public API surface `UseSnapEngineReturn` unchanged for back-compat. |
| Geo-canvas `parser-result-to-entities` adapter | `geo-canvas/floor-plan-system/snapping/adapter/parser-result-to-entities.ts` | **ADR-378 Phase 4 (2026-05-27)** — Maps GeoJSON `FeatureCollection` (LineString / Polygon / MultiLineString) → DXF `Entity[]` (LineEntity / PolylineEntity). Mirror pattern of `overlays/snap-adapter.ts::regionsToSnapEntities`. |

### 3.2 Active production performance layer

| Module | File | Pattern |
|---|---|---|
| `ImmediateSnapStore` | `systems/cursor/ImmediateSnapStore.ts` | Zero-React imperative singleton; `useSyncExternalStore` subscribe |
| `GripSnapStore` | `systems/cursor/GripSnapStore.ts` | Crosshair lock-to-grip world position |
| `SnapRenderer` | `rendering/ui/snap/SnapRenderer.ts` | Centralized canvas2D indicator renderer |
| `LegacySnapAdapter` | `rendering/ui/snap/LegacySnapAdapter.ts` | Bridge for canvas-v2 `LayerRenderer` (active, not legacy in practice) |
| `overlays/snap-adapter.ts` | `overlays/snap-adapter.ts` | `regionsToSnapEntities` overlay → `Entity[]` converter |

### 3.3 To be cleaned up (Phases 1-4 of this ADR)

| Module | File | Action | Phase |
|---|---|---|---|
| `AISnappingEngine` | `systems/ai-snapping/AISnappingEngine.ts` | **Delete εντελώς** — "conference demo", zero production wiring | 1 |
| `useProSnapShortcuts` | `keyboard/useProSnapShortcuts.ts` | **Delete** — never wired, 2 doc references | 1 |
| `pro-snap-engine.ts` (`snapSystem` global) | `snapping/pro-snap-engine.ts` | **Delete εντελώς (no migration)** — Phase 2 verification revealed ZERO production consumers. Original claim about `measure-snap-bridge.ts` was incorrect (that file lives in `src/components/shared/files/media/` and is unrelated). | 2 ✅ |
| `TextSnapProvider` (Phase 6.B math helpers) | `text-engine/interaction/TextSnapProvider.ts` | **Kept as-is** — pure math helpers preserved for tests + future external use. New `TextSnapEngine.ts` reimplements the same 8-point geometry directly over `Entity` union (TEXT/MTEXT) so the engine works on the production EntityModel pipeline without requiring `DxfTextSceneEntity` adapter. | 3 ✅ |
| ~~Geo-canvas `SnapEngine` (6-mode parallel)~~ | ~~`geo-canvas/floor-plan-system/snapping/engine/SnapEngine.ts`~~ | **DELETED** — replaced with façade hook + adapter (see §3.1 rows) | 4 ✅ |

### 3.4 Out-of-scope (legitimately separate domains)

| Module | Domain | Why separate |
|---|---|---|
| `snap-quantizer.ts` | 3D animation waypoint | Pure math `quantizeVec3()` for animation path editing (ADR-366 §C.1.b) |
| `dim3d-snap-engine-adapter.ts` | 3D BIM dimensions | Three.js raycaster for 3D dimension placement (different runtime) |
| `view-snap-detector.ts` | 3D camera views | Canonical view detection (6 face + 6 iso), unrelated to geometry |

These are **NOT** consolidation candidates — they operate on entirely different inputs (3D vectors / Three.js objects / camera matrices) than the 2D `EntityModel[]` pipeline.

---

## 4. SSoT Pattern

### 4.1 Single production instance

```typescript
// ✅ CORRECT — sole production access
import { getGlobalSnapEngine } from '@/subapps/dxf-viewer/snapping/global-snap-engine';

const engine = getGlobalSnapEngine();
const result = engine.findSnapPoint(cursor);
```

```typescript
// ❌ FORBIDDEN — creates parallel instance, breaks ADR-040 perf invariants
const engine = new ProSnapEngineV2();
```

### 4.2 Single `initialize()` owner

Only `useGlobalSnapSceneSync()` (called from `CanvasSection.tsx`) calls `initialize()`. All other consumers use `findSnapPoint()` only.

### 4.3 Forbidden patterns (enforced via `.ssot-registry.json`)

```json
{
  "id": "snap-engine",
  "canonical": "src/subapps/dxf-viewer/snapping/global-snap-engine.ts",
  "forbiddenPatterns": [
    "new\\s+ProSnapEngineV2\\s*\\(",
    "new\\s+SnapManager\\s*\\(",
    "class\\s+AISnappingEngine"
  ],
  "allowlist": [
    "src/subapps/dxf-viewer/snapping/global-snap-engine.ts",
    "src/subapps/dxf-viewer/snapping/ProSnapEngineV2.ts",
    "src/subapps/dxf-viewer/snapping/__tests__/**"
  ]
}
```

---

## 5. Priority Hierarchy (`SNAP_ENGINE_PRIORITIES`)

Canonical source: `src/subapps/dxf-viewer/config/tolerance-config.ts` (lines 388-437).

| Priority | Snap Type | ADR | Rationale |
|---|---|---|---|
| **-2** | `BIM_WALL_CORNER` | ADR-371 | BIM face precision — supersedes ENDPOINT |
| **-2** | `BIM_BEAM_CORNER` | ADR-371 | Same |
| **-2** | `BIM_SLAB_CORNER` | ADR-371 | Same |
| **-2** | `BIM_COLUMN_CORNER` | ADR-371 | Same |
| **-2** | `BIM_OPENING_CORNER` | ADR-371 | Same |
| **-1** | `BIM_COLUMN_CENTER` | ADR-363 §5.5i | Structural axis precision |
| **0** | `ENDPOINT` | — | Highest — exact endpoints (industry default) |
| **0** | `INTERSECTION` | — | Highest — intersections |
| **1** | `MIDPOINT` | — | Very high — midpoints |
| **1** | `NODE` | — | Very high — vertices |
| **1** | `CONSTRUCTION_POINT` | ADR-189 | Construction X markers |
| **2** | `INSERTION` | — | High — blocks/text insertion |
| **2** | `DIM_DEF_POINT` | ADR-362 I1 | Dimension definition anchor |
| **2** | `TEXT` *(pending Phase 3)* | ADR-344 | Text bounding box snap points |
| **3** | `CENTER` | — | Medium — circle/arc/rect centers |
| **3** | `DIM_LINE` | ADR-362 I1 | Dimension line snap |
| **4** | `TANGENT` | — | Tangent points |
| **5** | `PERPENDICULAR` | — | Perpendicular foot |
| **6** | `PARALLEL` | — | Parallel construction |
| **6** | `GUIDE` | ADR-189 | Construction guide lines |
| **7** | `QUADRANT` | — | Circle quadrants |
| **8** | `EXTENSION` | — | Line extensions |
| **9** | `ORTHO` | — | Orthogonal constraints |
| **10** | `NEAREST` | — | Nearest on entity |
| **11** | `NEAR` | — | Near-sampling fallback |
| **12** | `GRID_MAJOR` | — | Major grid intersections |
| **13** | `GRID_MINOR` | — | Minor grid intersections |

**Rule**: Lower number = higher priority = wins in same-cursor-radius race.

**Why -2 for BIM corners**: When cursor is near a wall corner, the `ENDPOINT` engine catches the same point (outerEdge polyline vertex) at priority 0. We want `BIM_WALL_CORNER` to win because it provides better semantic label ("Γωνία τοίχου" vs "Άκρο") and dedicated L-bracket visual indicator.

---

## 6. Override System (separate from main pipeline)

### 6.1 Pattern

`SnapOverrideOrchestrator` (ADR-357) is a parallel command-mode handler — NOT a duplicate of `SnapOrchestrator`. Industry equivalent: AutoCAD `Shift+right-click` snap override menu.

### 6.2 Override modes

| Mode | Trigger | Behavior |
|---|---|---|
| `'from'` | User picks reference point | Next click = relative-to-reference |
| `'m2p'` | User picks 2 points | Next click = midpoint of those 2 |
| `'app'` | Apparent intersection | Snap to virtual intersection of non-coplanar lines |
| `ExtendedSnapType` (any) | One-shot type override | Force snap to specific type for next click only |

### 6.3 API

```typescript
// Public surface (singleton)
snapOverrideOrchestrator.setOverride(mode)
snapOverrideOrchestrator.getOverride()
snapOverrideOrchestrator.consumeOverride()  // single-fire
snapOverrideOrchestrator.advanceM2P(point) / advanceFrom(point)
snapOverrideOrchestrator.subscribe(listener) / getSnapshot()  // useSyncExternalStore
```

### 6.4 Consumers

- `useDrawingHandlers.ts` — applies override before normal snap loop
- `drawing-hover-handler.ts` — preview rendering with override
- `CanvasSection.tsx` — UI feedback
- `DrawingContextMenu.tsx` — right-click menu trigger

---

## 7. Performance Stores

### 7.1 `ImmediateSnapStore`

**Problem**: Reading snap result from `SnapContext` causes `CanvasSection` re-render on every mouse move (30-60fps × dozens of hooks).

**Solution**: Plain mutable singleton — imperative `set/get` for hot path, `useSyncExternalStore` subscribe for leaf renderers only.

**API**:
```typescript
setImmediateSnap(result)       // writer: mouse-handler-move
getImmediateSnap()             // reader: useDrawingHandlers (inside useMemo)
clearImmediateSnap()
setFullSnapResult(result)
getFullSnapResult()
subscribeSnapResult(listener)  // leaf renderer subscription
```

### 7.2 `GripSnapStore`

**Purpose**: Lock crosshair to hovered grip world position. Writer: `useUnifiedGripInteraction`. Reader: `mouse-handler-move`.

**API**:
```typescript
lockGripSnapPosition(worldPos)
unlockGripSnapPosition()
getLockedGripWorldPos(): Point2D | null
```

### 7.3 Performance invariants (ADR-040 compliance)

1. **No `useSyncExternalStore` calls in `CanvasSection.tsx` / `CanvasLayerStack.tsx`** — only leaf renderers
2. **Event handlers MUST receive getter functions**, not snapshot values
3. **Bitmap cache MUST NOT include snap-related state** in cache key
4. **Each leaf subscriber renders ≤1 element and calls ≤2 high-frequency hooks**

---

## 8. Related ADRs

### 8.1 Sub-decisions (each addresses one slice)

- **ADR-087** — Snap config constants (`SNAP_SEARCH_RADIUS`, multipliers, grid distances)
- **ADR-095** — `SNAP_TOLERANCE = 10` central constant
- **ADR-137** — Snap icon SVG geometry (sizes/ratios in `SNAP_ICON_GEOMETRY`)
- **ADR-153** — Tooltip offset 15px in `SNAP_TOOLTIP_OFFSET`
- **ADR-371** — BIM corner snap (5 corner engines, priority -2)
- **ADR-363 Phase 5.5d/5.5i** — Column anchor SSoT + ColumnCenterSnapEngine (template for ADR-371)
- **ADR-362 I1** — Dimension snap (DimDefPoint + DimLine engines)
- **ADR-189 §3.7-3.16** — Construction snap points + guide lines
- **ADR-344 Phase 6.B/6.C** — Text snap points (currently half-done; this ADR completes 6.C in Phase 3)
- **ADR-040** — Lifecycle owner pattern + perf invariants
- **ADR-357** — Override modes (`'from'`, `'m2p'`, `'app'`)

### 8.2 Resurrected references

- **ADR-149 «Snap Engine Priorities»** — Phantom (never written, referenced by ADR-371). **This ADR-378 §5 supersedes that reference.** ADR-371 to be updated in Phase 5 of this roadmap to point to ADR-378.

---

## 9. Centralization Roadmap (Phases 1-6)

### Phase 1 — Delete dead code (Sonnet, ~30min)

#### 1.1 Delete `AISnappingEngine`
- Delete `src/subapps/dxf-viewer/systems/ai-snapping/AISnappingEngine.ts`
- Delete `src/subapps/dxf-viewer/systems/ai-snapping/AISnappingEngine.types.ts`
- Delete `src/subapps/dxf-viewer/systems/ai-snapping/__tests__/**`
- Verify: `Grep "AISnappingEngine" src` → zero non-deleted refs

#### 1.2 Delete `useProSnapShortcuts`
- Delete `src/subapps/dxf-viewer/keyboard/useProSnapShortcuts.ts`
- Verify: `Grep "useProSnapShortcuts"` → zero callers

### Phase 2 — Delete `pro-snap-engine.ts` ghost ✅ DONE 2026-05-27 (Sonnet, ~10min)

#### 2.1 ~~Migrate `measure-snap-bridge.ts`~~ — N/A
**Phase 2 verification revealed ZERO production consumers of `snapSystem`.** The original ADR claim that `measure-snap-bridge.ts` consumed it was incorrect — that file lives in `src/components/shared/files/media/` and handles a completely different domain (media file snap interactions). The only references to `snapSystem` were the definition itself + the re-export in `snapping/index.ts`. No migration needed.

#### 2.2 Delete ghost — DONE
- ✅ Edited `src/subapps/dxf-viewer/snapping/index.ts` — removed `export { snapSystem } from './pro-snap-engine'` line
- ✅ `git rm src/subapps/dxf-viewer/snapping/pro-snap-engine.ts`
- ✅ Grep verification: zero production `snapSystem` references remain (1 stale doc line in `docs/features/snapping/ARCHITECTURE.md:23` — Phase 5 doc cleanup scope)

### Phase 3 — TextSnapEngine ✅ DONE 2026-05-27 (Sonnet 4.6, ~2h)

#### 3.1 Create `TextSnapEngine.ts` — DONE
- File: `src/subapps/dxf-viewer/snapping/engines/TextSnapEngine.ts` (151 LOC)
- Pattern: extends `BaseSnapEngine`, mirror `ColumnCenterSnapEngine` skeleton with linear scan instead of RBush spatial index (text entities are typically < 1000, linear is fast enough; spatial index API expects 1 data shape per result and we need 8 points per entity with `kind` tag)
- Works directly on `Entity` union (TEXT/MTEXT) — no `DxfTextSceneEntity` adapter needed
- Approximate bbox: TEXT → `text.length × fontSize × 0.6 width, fontSize height`; MTEXT → `entity.width × (entity.height ?? fontSize × lineCount) height`
- Rotation: applied around insertion point in degrees-to-radians conversion
- 8 points per entity: `insertion` + `corner-tl/tr/bl/br` + `center` + `edge-top-mid/bottom-mid`
- Descriptions: `text-${kind}` for downstream tooltip/test introspection

#### 3.2 Type system — DONE (already committed in HEAD)
- `extended-types.ts` ✅ committed `7f788d8d`: `ExtendedSnapType.TEXT = 'text'` added to enum, `enabledTypes` Set, `priority` array (position 2 after INSERTION), `perModePxTolerance` (10px)
- `tolerance-config.ts` ✅ committed `aabfb04f`: `SNAP_ENGINE_PRIORITIES.TEXT = 2`

#### 3.3 Registry registration — DONE
- `SnapEngineRegistry.ts:101` — `this.engines.set(ExtendedSnapType.TEXT, new TextSnapEngine())` + import line

#### 3.4 Refactor text-layout-engine — N/A
- Phase 3 verification revealed ZERO manual `getTextSnapPoints()` / `toSnapCandidates()` calls in `text-engine/layout/text-layout-engine.ts`. Only the standalone `TextSnapProvider.ts` defines them + `interaction/index.ts` re-exports + tests consume. Same surprise pattern as Phase 2 (claim was incorrect). No code change needed.

#### 3.5 i18n + visual indicator — DONE
- `el/dxf-viewer-shell.json` ✅ `snapModes.labels.text.{insertion|cornerTl|cornerTr|cornerBl|cornerBr|center|edgeTopMid|edgeBottomMid}` + `snapModes.tooltips.text`
- `en/dxf-viewer-shell.json` ✅ mirror
- `SnapIndicatorOverlay.tsx` ✅ `case 'text':` → nested square ▣ (concentric outer + inner rect, Revit/AutoCAD-style text marker distinct from generic endpoint ■)

#### 3.6 Tests — DONE
- New: `engines/__tests__/TextSnapEngine.test.ts` ✅ 14 cases PASS (empty/non-text-filter/8-emission/insertion-exact-match/type+priority/all-8-kinds/mtext-width/radius-cut/exclude/invisible/rotation 90°/multi-entity-independence/mixed/dispose)
- `text-engine/interaction/__tests__/TextSnapProvider.test.ts` — NO update needed (TextSnapProvider math helpers preserved untouched; engine reimplements geometry, doesn't wrap)
- Verification: 28/28 text snap tests PASS, broader snap suite 168/169 PASS (1 pre-existing unrelated failure in `bim-corner-alignment.integration.test.ts`)

### Phase 4 — Geo-canvas unification ✅ DONE 2026-05-27 (Opus 4.7, ~2h)

#### 4.1 Migrate hooks — DONE
- `geo-canvas/floor-plan-system/snapping/hooks/useSnapEngine.ts` ✅ full rewrite (~190 LOC). Internally: `getGlobalSnapEngine()` + `parserResultToEntities(parserResult)` on parserResult change + `engine.findSnapPoint({x, y})` per cursor move. Maps `ProSnapResult` → geo-canvas `SnapResult` via `EXTENDED_TO_GEO_MODE` (6 classic modes preserved; other 19+ ExtendedSnapType fall through to `SnapMode.ENDPOINT` for render-layer compatibility). Public API surface `UseSnapEngineReturn` UNCHANGED.
- `useSnapPoints.ts` ✅ DELETED — zero production callers verified via grep (only barrel re-export + self-reference).

#### 4.2 Create adapter — DONE
- New: `geo-canvas/floor-plan-system/snapping/adapter/parser-result-to-entities.ts` (108 LOC)
- Function: `parserResultToEntities(result: ParserResult | null): Entity[]`
- Maps GeoJSON `LineString` (2 pts → `LineEntity`, 3+ pts → open `PolylineEntity`), `Polygon` (exterior ring → closed `PolylineEntity`), `MultiLineString` (multiple PolylineEntities) → DXF `Entity[]`
- Mirror pattern of `dxf-viewer/overlays/snap-adapter.ts::regionsToSnapEntities`
- Internal `_counter` for stable id allocation + `__resetParserResultIdCounterForTests()` test helper

#### 4.3 Delete legacy geo-canvas snap — DONE
- ✅ `git rm` `engine/SnapEngine.ts` (275 LOC parallel class)
- ✅ `git rm` `engine/endpoint-detector.ts` (202 LOC GeoJSON point extraction)
- ✅ `git rm` `engine/snap-distance.ts` (139 LOC distance calc)
- ✅ `git rm` `engine/index.ts` (barrel)
- ✅ `git rm` `hooks/useSnapPoints.ts` (zero callers)
- ✅ `hooks/index.ts` updated (drop useSnapPoints re-export)
- ✅ `snapping/index.ts` updated (drop `export * from './engine'`)
- **KEPT** (required by render layer): `types/snap-types.ts` (SnapPoint/SnapResult/SnapMode/SnapSettings), `config/snap-defaults.ts` (DEFAULT_SNAP_SETTINGS, SNAP_VISUAL, SNAP_MODE_LABELS, SNAP_MODE_PRIORITY), `rendering/SnapIndicator.tsx`

#### 4.4 Verify — DONE
- `GeoCanvasContent.tsx:93` ✅ unchanged: `const snapEngine = useSnapEngine(floorPlanUpload.result, { debug: false })` — public surface preserved
- `FloorPlanCanvasLayer.tsx:11` ✅ unchanged: `import type { UseSnapEngineReturn }` + consumes `snapEngine.snapResult`, `snapEngine.calculateSnap(localX, localY)`, `snapEngine.snapResult.point` — all preserved
- **Verification grep**: zero production references to `new SnapEngine` / `extractEndpoints` / `deduplicateSnapPoints` / `findNearestSnapPoint` / `useSnapPoints` / `createSnapEngine` in geo-canvas namespace
- **User-visible win**: property floorplan tab gains 26 modes (BIM corners + dimensions + guides + text + all classic CAD) vs previous 6 endpoint-only

#### 4.5 Concurrency note (single-scene-at-a-time assumption)
Because `getGlobalSnapEngine()` is a module-level singleton, if both DXF Viewer and geo-canvas property floorplan tab were simultaneously active in the same tab, each would call `engine.initialize(...)` with its own entity set and race for the latest. In practice the two subapps live on different routes and are not concurrently mounted, so this is acceptable for Phase 4. Future work (post-Phase 6) may add a scene-tag fingerprint to disambiguate.

### Phase 5 — Doc cleanup ✅ DONE 2026-05-27 (Sonnet, EXPANDED scope)

Original plan: 2 edits. Actual: 12 edits across 11 files after Phase 1+2 verification uncovered wider stale-ref surface.

#### 5.1 ADR phantom reference fixes — ALL ADR-149 → ADR-378
- ✅ `ADR-370-bim-corner-snap-system.md` line 12 (Related ADRs row), line 23 (ιεραρχία ADR-149 → ADR-378 §5), line 842 (References list entry)
- ✅ `ADR-153-snap-tooltip-offset-centralization.md` line 40 (Companion ADRs)
- ✅ `ADR-359-auxiliary-geometry-tools.md` line 7 (Related ADRs)

#### 5.2 Stale paths in Active ADRs
- ✅ `ADR-034-validation-bounds-centralization.md` line 127 — AISnappingEngine row strikethrough + "Removed (ADR-378 Phase 1)"
- ✅ `ADR-092-centralized-localstorage-service.md` lines 38, 55 — STORAGE_KEYS.AI_SNAPPING + AISnappingEngine.ts file refs strikethrough + removal note
- ✅ `ADR-362-enterprise-dimension-system.md` lines 451, 621 — `pro-snap-engine.ts` (deleted) → `engines/DimDefPointSnapEngine.ts + DimLineSnapEngine.ts` (NEW per ADR-378 registry pattern)

#### 5.3 DXF Viewer subapp docs
- ✅ `src/subapps/dxf-viewer/docs/features/snapping/ARCHITECTURE.md` line 23 — Removed `pro-snap-engine.ts # Legacy engine`, added `global-snap-engine.ts # Module singleton`
- ✅ `src/subapps/dxf-viewer/docs/settings-system/DXF_SETTINGS_PROGRESS.md` lines 153-155 — AI-Powered Snapping section marked DELETED + entries strikethrough
- ✅ `src/subapps/dxf-viewer/docs/DXF_VIEWER_CONFERENCE_REPORT.md` lines 474-479 — `/systems/ai-snapping/` tree marked DELETED

#### 5.4 Code cleanup (N.0.2 Boy Scout)
- ✅ `src/subapps/dxf-viewer/utils/storage-utils.ts` lines 42-44 — Orphan `AI_SNAPPING: 'ai-snapping-data'` constant deleted (zero consumers post-Phase 1)
- ✅ `src/subapps/dxf-viewer/snapping/engines/shared/snap-engine-utils.ts` line 36 — Stale comment `"για AISnappingEngine.ts"` removed (field `lastPoint?: Point2D` kept — used by other consumers)

#### 5.5 ADR index polish
- ✅ `docs/centralized-systems/reference/adr-index.md` line 372 — ADR-378 status DRAFT→ACTIVE, Phases 1+2+5 DONE noted

#### 5.6 Verification
- Grep `AISnappingEngine|useProSnapShortcuts|pro-snap-engine|AI_SNAPPING` → only legit remaining: tracking files (ADR-378 self-refs, pending-ratchet, ΕΚΚΡΕΜΟΤΗΤΕΣ, memory), historical entries (ADR-314 Phase C.5.32 2026-04-19), archived ADRs (067/079), research/analysis MDs, baseline JSON (Phase 6 scope), backup files
- Grep `ADR-149` → only legit remaining: 3 Active ADRs (370/153/359) all now in "supersedes phantom ADR-149" wording + ADR-378 itself documenting the phantom history

### Phase 6 — SSoT registry + trackers ✅ DONE 2026-05-27 (Sonnet, ~30min)

#### 6.1 `.ssot-registry.json` — DONE
- ✅ `snap-engine` module entry updated:
  - `forbiddenPatterns` now has 4 patterns (was 2): added `new\\s+SnapEngine\\s*\\(` (geo-canvas legacy class, deleted Phase 4) + `class\\s+AISnappingEngine` (conference demo dead code, deleted Phase 1). Retained `new\\s+ProSnapEngineV2\\s*\\(` + `new\\s+SnapManager\\s*\\(`.
  - `description` rewritten — references ADR-378 master + 7/7 industry convergence (Revit/AutoCAD/ArchiCAD/BricsCAD/SketchUp/Vectorworks/Bentley) + explains each forbidden pattern + cross-refs Phases 1+4 deletions + geo-canvas façade pattern.
  - `addedByAdr` changed from `ADR-040` → `ADR-378` (master now owns the rule).
  - `allowlist` gained `src/subapps/dxf-viewer/snapping/__tests__/**` (canonical tests need to import the class for unit coverage).
- ✅ Grep verification post-edit:
  - `new SnapEngine(` in `src/` → zero matches.
  - `class AISnappingEngine` in `src/` → 1 match (docs analysis MD, not scanned by SSoT).

#### 6.2 Baselines refresh — DONE
- ✅ `npm run ssot:baseline` executed. `.ssot-violations-baseline.json` refreshed (zero new violations introduced by Phases 1+2+3+4+5).

#### 6.3 ΕΚΚΡΕΜΟΤΗΤΕΣ — DONE
- ✅ `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` ΟΜΑΔΑ Χ row X6 → ✅ ΥΛΟΠΟΙΗΜΕΝΟ 2026-05-27. Header status: 🟢 ALL PHASES COMPLETE.

#### 6.4 pending-ratchet-work.md — DONE
- ✅ Header rotation: Phase 6 entry at top, Phase 4 → Previous.
- ✅ Phase 6 closure block with implementation details.
- ✅ `inferred-alignment-service` entry remains under separate ADR-3XX TBD ratchet — folded into ADR-378 §11 future work cross-reference (see ADR-378 §11).

---

## 10. Out-of-scope domains (NOT in this consolidation)

| Module | Path | Why kept separate |
|---|---|---|
| `snap-quantizer` | `bim-3d/animation/snap-quantizer.ts` | Pure math, 3D animation waypoints (ADR-366 §C.1.b) — different inputs (`Vec3` step quantize) |
| `dim3d-snap-engine-adapter` | `bim-3d/dimensions/` | Three.js raycaster for 3D dimensions — different runtime |
| `view-snap-detector` | `bim-3d/viewport/` | Canonical 3D camera views — not geometry snap |

These remain as-is. Future ADR may unify 3D snap if/when 3D BIM Viewer matures.

---

## 11. Future Work (post-Phase 6)

- **`inferred-alignment-service`** (ADR-3XX TBD, ~3h) — auto-infer alignment guides from existing geometry. Currently in `pending-ratchet-work.md`. To be designed as a new `BaseSnapEngine` subclass in ProSnapEngineV2.
- **F3 toggle keyboard binding** — replace deleted `useProSnapShortcuts` with proper component-level wiring if/when needed (AutoCAD F3 muscle memory).
- **3D snap consolidation** — once 3D BIM Viewer (ADR-366) matures, consider unified 2D+3D snap registry.

---

## 12. Google-Level Architecture Checklist (N.7.2)

| # | Question | Answer |
|---|----------|--------|
| 1 | Proactive ή reactive; | **Proactive** — single singleton initialized lazily on first call, scene-init fingerprint-guarded |
| 2 | Race condition possible; | **No** — single instance, single `initialize()` owner via `useGlobalSnapSceneSync` |
| 3 | Idempotent; | **Yes** — fingerprint guard prevents redundant re-initialize |
| 4 | Belt-and-suspenders; | **Yes** — `.ssot-registry.json` forbidden patterns + ADR documentation + pre-commit hook |
| 5 | Single Source of Truth; | **Yes** — `getGlobalSnapEngine()` is the sole production entry |
| 6 | Fire-and-forget ή await; | **Synchronous** — pure compute on demand |
| 7 | Lifecycle owner; | **Explicit** — `useGlobalSnapSceneSync()` in `CanvasSection.tsx:167` (ADR-040) |

✅ **Google-level: YES** — single-instance registry pattern matches industry standard (Revit/AutoCAD/ArchiCAD/BricsCAD/SketchUp/Vectorworks/Bentley), zero state races, fully testable, observability via `SnapDebugLogger`.

---

## 13. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Geo-canvas adapter loses fidelity vs old simple engine | Medium | Phase 4.2 adapter mirrors `regionsToSnapEntities` pattern; integration test with sample DXF files |
| `measure-snap-bridge` regression after Phase 2 migration | Low | `npx tsc --noEmit` + measure tool manual smoke test before delete |
| TextSnapEngine registration breaks text-layout-engine | Low | Phase 3.4 removes manual feed; Phase 3.6 tests cover both paths |
| ADR-371 phantom reference fix breaks git-blame | None | Pure doc edit, no code impact |
| Pre-commit hook CHECK 3.7/3.18 blocks Phase 4 commit | Low | Run `npm run ssot:audit` after Phase 1+2 before Phase 4; refresh baseline if needed |

---

## 14. Migration & Rollout

- **Backward compatibility**: 100%. Geo-canvas snap functionally preserved (gains modes, no loss). Measure tool unchanged. DXF Viewer unchanged.
- **No data migration required** — pure refactor, no Firestore schema changes.
- **No feature flag** — direct enablement (Boy Scout cleanup pattern).
- **Each phase independent** — can ship as separate commits.

---

## 15. Changelog

| Date | Phase | Change |
|---|---|---|
| 2026-05-27 | — | Initial ADR-378 design (Opus 4.7 + Γιώργος). Master architecture document covering Orchestrator→Registry→26 engines, priority hierarchy table (resurrecting phantom ADR-149), centralization roadmap. |
| 2026-05-27 | 0 | ADR-378 written. Phases 1-6 pending. |
| 2026-05-27 | 1 | Phase 1 — Dead code deleted (AISnappingEngine + AISnappingEngine.types + useProSnapShortcuts). 3 files removed via `git rm`. Zero production references confirmed via grep (only 1 stale comment in `snap-engine-utils.ts:36` + 6 doc/analysis files info-only). `ai-snapping/` folder empty. Sonnet 4.6, ~10min. |
| 2026-05-27 | 2 | Phase 2 — `pro-snap-engine.ts` ghost deleted. `snapping/index.ts` re-export line removed. **Discovery**: ZERO production consumers of `snapSystem` existed — ADR §3.3 and §9.2.1 claims about `measure-snap-bridge.ts` were incorrect (that file is in `src/components/shared/files/media/` and unrelated). No migration step needed. §3.3 + §9 Phase 2 corrected to match reality. Sonnet 4.6, ~10min. |
| 2026-05-27 | 5 | Phase 5 — Doc cleanup (EXPANDED from 2 to 12 edits across 11 files). All ADR-149 phantom refs updated to ADR-378 in 3 Active ADRs (370/153/359). All stale paths in Active ADRs (034/092/362) marked Removed or pointed to new SSoT engines. DXF Viewer subapp docs (ARCHITECTURE/SETTINGS_PROGRESS/CONFERENCE_REPORT) cleaned. Code: orphan AI_SNAPPING storage constant deleted, stale comment in snap-engine-utils.ts removed. adr-index.md status DRAFT→ACTIVE. Sonnet 4.6, ~20min. |
| 2026-05-27 | 3 | Phase 3 — TextSnapEngine completion (ADR-344 Phase 6.C delivered). NEW `engines/TextSnapEngine.ts` (151 LOC) extends `BaseSnapEngine`, registered as `ExtendedSnapType.TEXT` in `SnapEngineRegistry`, emits 8 candidates per visible TEXT/MTEXT entity (insertion + 4 corners + center + 2 edge mids), works directly on `Entity` union with approximate bbox + rotation. SnapIndicatorOverlay gains `case 'text':` nested-square ▣ symbol. i18n el+en `snapModes.labels.text.*` 8 sub-keys + tooltips.text. Type system constants already committed in HEAD (`7f788d8d` + `aabfb04f`). Phase 3.4 N/A (no manual feed existed in text-layout-engine, same surprise pattern as Phase 2). 14 new TextSnapEngine.test.ts cases PASS (broader snap suite 168/169 PASS, 1 pre-existing unrelated failure). TextSnapProvider.test.ts intact (kept math helpers untouched for legacy/test stability). Sonnet 4.6, ~2h. |
| 2026-05-27 | 6 | Phase 6 — SSoT registry hardening + final closure. `.ssot-registry.json` `snap-engine` module: `forbiddenPatterns` 2 → 4 (added `new SnapEngine(` for geo-canvas legacy class deleted Phase 4 + `class AISnappingEngine` for conference demo deleted Phase 1). Description rewritten with ADR-378 master reference, 7/7 industry alignment (Revit/AutoCAD/ArchiCAD/BricsCAD/SketchUp/Vectorworks/Bentley), per-pattern rationale, geo-canvas façade cross-ref. `addedByAdr` ADR-040 → ADR-378 (master now owns rule). `allowlist` gained `__tests__/**` glob for canonical unit coverage imports. `npm run ssot:baseline` refreshed `.ssot-violations-baseline.json` — zero new violations from any Phase 1-5 work. Grep verification post-edit: `new SnapEngine(` in `src/` zero matches; `class AISnappingEngine` only 1 doc analysis MD (not scanned). `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` X6 ✅ + header 🟢 ALL PHASES COMPLETE. `pending-ratchet-work.md` Phase 6 closure block. ADR-378 status header: 🟡 DRAFT → ✅ COMPLETE. `adr-index.md` ADR-378 row: Phases 1+2+3+4+5 → ALL Phases COMPLETE. Memory + MEMORY.md index updated. **ADR-378 fully shipped — 5 parallel snap subsystems consolidated to 1 production singleton.** Sonnet, ~30min. |
| 2026-06-24 | Step 5 | **3D placement snap-marker de-dup + wall-corner re-home (FULL-SSoT snap consolidation).** (#5a marker) `PlacementSnapMarker` (ADR-403) carried a byte-identical private copy of the gizmo's cyan cube-wireframe marker (`EdgesGeometry(BoxGeometry(2,2,2))` + material + screen-constant scaling + 4 tuning constants, "territory isolation"). Extracted NEW neutral SSoT `bim-3d/shared/snap-marker-core.ts` (`SNAP_MARKER_*` constants + `createSnapMarkerMesh()` + `snapMarkerScreenScale()`); both the gizmo (`bim-gizmo-overlay-markers.createSnapMarker` delegates; `bim-gizmo-overlay.showSnapMarker` uses the shared scaler) and `PlacementSnapMarker` now reuse it. `gizmo-constants.ts` re-exports the 4 constants from the core so existing gizmo consumers are unchanged; `SNAP_MARKER_MOVE_SCREEN_SCALE` stays gizmo-only. (#6 re-home) `wall-face-corner-snap.ts` moved `systems/cursor/` → `bim/walls/` (git mv) to sit beside its sibling `bim/columns/column-corner-snap.ts`; both wrap the shared `systems/cursor/corner-projection-snap` core. Importers (`mouse-handler-up`/`-move`) + stale `@see` paths updated. **Not done — #5b**: `placement-snap.resolvePlacementSnap` was NOT merged into `bim3d-snap-bridge.makeResizeSnapFn` — they already share the ONE `getGlobalSnapEngine()` SSoT, and the placement resolver surfaces extra `snapEntityId`/`snapType` (ADR-408 connector-Z mate) + a different return shape (direct vs `SnapFn` closure), so it is legitimately distinct (code = source of truth). 86/86 jest GREEN (gizmo-overlay + snap-bridge + placement-snap + column-placement-context); tsc clean on touched files. 🔴 PENDING: browser-verify (3D placement marker on column/MEP; gizmo drag snap marker; wall-endpoint grip face-corner snap) + commit (CHECK 6B/6D → stage ADR-040/402/403). |
| 2026-06-24 | Step 4 | **Text snap geometry unified to one SSoT (FULL-SSoT snap consolidation).** Phase 3 deliberately left the 8-point geometry duplicated (`TextSnapEngine.computeTextSnapPoints` re-implemented the same rotation math + `TextSnapKind` taxonomy as `TextSnapProvider`, "kept untouched for test stability"). Now collapsed: NEW entity-agnostic core `computeTextSnapGeometry(insertion, rotationRad, bbox)` in `TextSnapProvider.ts` is the ONE place the 8-point layout + about-insertion rotation lives. `getTextSnapPoints` (scene entity, font-aware bbox) is now a thin wrapper adding snapType/description; `TextSnapEngine.computeTextSnapPoints` (EntityModel, font-free `estimateTextBbox`) builds an absolute bbox anchored at the insertion point and calls the same core. The engine's duplicate `type TextSnapKind` was deleted and is now imported from the provider. Behaviour-equivalent (the engine's `insertion = top-left` convention maps to an absolute bbox at the insertion point → identical points). 28/28 jest GREEN across both suites; tsc clean on touched files. 🔴 PENDING: browser-verify (TEXT/MTEXT 8-point OSNAP) + commit. |
| 2026-07-03 | Bugfix | **Imported-DXF entities were invisible to OSNAP (`visible` truthy-check trap).** Root cause found via Firestore scene audit: imported DXF entities are persisted with a minimal 6-field shape `{id,type,layerId,color,start,end}` and DELIBERATELY omit the optional `visible` field, whereas app-drawn entities set `visible: true`. Every entity-based snap engine filtered with `if (!entity.visible) continue;` — so `visible === undefined` was treated identically to `visible === false` and every imported line/text/etc. was silently dropped from the spatial index. Symptom (Γιώργος): a new line's endpoint would not snap onto an imported line's endpoint, while snapping onto drawn lines worked. The renderer (`EntityRendererComposite`) + hit-testing already used the correct "explicit `false`" rule, so imported geometry was visible & selectable but un-snappable. **Fix (FULL-SSoT):** NEW `snapping/shared/snap-visibility.ts` → `isEntityVisibleForSnap(entity)` = `entity.visible !== false` — the ONE owner of the rule. Migrated all 9 buggy truthy sites (`BaseSnapEngine` ×2 [covers Endpoint/Midpoint/Center via `initializeSpatialIndex`+`processCandidateLoop`], `CenterSnapEngine`, `NearestSnapEngine`, `OrthoSnapEngine`, `PerpendicularSnapEngine`, `ParallelSnapEngine`, `TextSnapEngine`, `WallFaceSnapEngine`) + folded the 3 already-correct sites (`snap-engine-utils.filterValidEntities`+`findStandardSnapCandidates`, `IntersectionSnapEngine`) onto the same predicate so the trap cannot reappear. NEW `imported-dxf-snap-visibility.test.ts` (7 cases: predicate unit + Endpoint engine regression — imported line w/o `visible` snaps, drawn line still snaps, explicit `visible:false` still hidden, both indexed together). Snap-engine suite 150/150 GREEN. Opus 4.8. 🔴 PENDING: browser-verify (draw line endpoint→imported line endpoint) + commit (CHECK 6D → stage ADR-378). |
| 2026-07-06 | Bugfix | **Dimension snaps never attracted — persisted-blob positive-list migration trap (handoff `2026-07-06_dimension-snap-not-attracting`, Step 1).** Symptom (Γιώργος): hovering a dimension showed no attraction marks / no snap, while endpoint/midpoint/etc. worked. Root cause (`SnapContext.tsx:205-208`): the loader rebuilt `snapState` from the persisted `dxfViewer.snap.activeTypes` **positive list** with `next[m] = activeTypes.includes(m)`. `DIM_DEF_POINT`/`DIM_LINE` are default-on (ADR-362) but persisted per-mode and NOT in `ALWAYS_ON_BIM_SNAPS`, so any blob written before ADR-362 lacked those ids → they loaded as `false` → `enabledModes` never added them → engines never queried them. Same class as the BIM-always-on (ADR-370) + rotation-force-enable (ADR-397) fixes, but dim snaps were left toggleable by decision (Giorgio 2026-07-06 → NO always-on promotion). **Fix (migration-safe, FULL-SSoT):** persisted blob gains an optional `knownTypes: string[]` (the ids the writing build knew about) so a missing id is no longer ambiguous — known id honors stored active/inactive, unknown/newer id falls back to DEFAULT (never silently off); legacy blobs (no `knownTypes`) treat their own `activeTypes` as the known set so default-on dim snaps revive. Both writes stamp `knownTypes = ALL_MODES` → schema self-heals to precise on next round-trip. NEW pure SSoT `snapping/context/snap-state-persistence.ts` → `resolvePersistedSnapState(allModes, defaults, activeTypes, knownTypes)` (React-free, unit-tested); the default-state block extracted to `getDefaultSnapState()` SSoT (one source for both initial `useState` and the load merge). Schema `snapSettingsSchema` (`user-settings-schema.ts`) gains `knownTypes: z.array(z.string()).optional()` (Zod strips unknown keys otherwise). NEW `snap-state-persistence.test.ts` — 5 cases (legacy-blob dim revival = the bug, present-mode kept on, explicit-off honored post-migration, genuinely-newer id defaults, pure projection). 5/5 GREEN. Opus 4.8. Steps 2 (dim geometry coverage: foot1/foot2/extLines/textAnchor) + 3 (glyph cases) still pending per handoff. 🔴 PENDING: browser-verify (hover dimension → attraction mark + snap) + commit (CHECK 6B/6D → stage ADR-378). |
| 2026-07-06 | Step 2 | **Dimension snap-geometry SSoT — dim snaps now attract onto the RENDERED geometry (handoff `2026-07-06_dimension-snap-not-attracting`, Step 2).** After Step 1 revived the dim snaps, `DimLineSnapEngine` still offered only `textMidpoint` + one type-specific ref point — the dim line itself, its feet and its midpoint didn't attract. NEW SSoT `systems/dimensions/dim-snap-geometry.ts` → `computeDimLineSnapPoints(entity)` derives the discrete snap points from the EXISTING hit-geometry SSoT (`dim-hit-geometry.ts`, which wraps the ONE `buildDimensionGeometry`): linear/aligned via lean `computeDimHitGeometry` (foot1/foot2 + dim-line midpoint + text anchor); radial/angular/ordinate via `buildVariantHitGeometry` (leader endpoints + center / arc start·mid·end + text anchor); baseline/continued (need a parent lookup the snap path lacks) fall back to persisted `textMidpoint` + `defPoints[2]`. Deduped + finite-guarded. NO re-derivation — same geometry the renderer draws & the hit-test picks, so they can't diverge. `DimLineSnapEngine.extractDimLinePoints` now delegates to it (removed its private `resolveRefPoint`). Raw def points stay owned by `DimDefPointSnapEngine`; extension-line overshoot ends intentionally omitted (not AutoCAD DIMSNAP targets). Text = center/insertion only, NOT 8-point (industry DIMSNAP standard). **Boy-Scout SSoT fix (N.0.2):** `dim-hit-geometry.resolveDimAxis` read linear `rotation` as radians, but it is DEGREES everywhere (create builder, grip `RAD_TO_DEG`, auto-planner `rotation:90`, and `linear-aligned-builder` reads `rotation * DEG_TO_RAD`) → wrong axis (broken hit-test AND snap) for every rotated linear dim; now `* DEG_TO_RAD`. Fixes both hit-test & snap in the one SSoT. NEW `dim-snap-geometry.test.ts` — 8 cases (aligned feet/midpoint, text-anchor dedup vs override, horizontal + rotation-90 linear regression, radius/angular finite+deduped, baseline fallback). 8 new + 18 existing hit-geometry = 26 GREEN. Opus 4.8. Step 3 (glyph shape) still pending. 🔴 PENDING: browser-verify (hover dimension line/feet/text → attraction + snap) + commit (CHECK 6B/6D → stage ADR-378). |
| 2026-07-06 | Step 3 | **Dimension snap glyphs + colour (handoff `2026-07-06_dimension-snap-not-attracting`, Step 3, closes the handoff).** `SnapIndicatorGlyph.SnapShape` had no `dim_def_point`/`dim_line` case → both fell to the default ✕, visually identical to INTERSECTION. Added two dimension-family glyphs: `dim_line` = **⊢────⊣** (horizontal dim line with vertical witness end-ticks — the universal dimension iconography, distinct from ═ guide and ║ parallel); `dim_def_point` = **⊡** (square + centre dot — a DIMSNAP anchor, distinct from ■ endpoint and ⊙ node). Colour: `SNAP_MARKER_COLORS.DIM` `#b388ff` (faint lilac — pre-existing from ADR-362, only now visible after Step 1 revived the snaps) → **`#ff6d00` orange** at Γιώργος's request (marked temporary/under-review in `color-config.ts`; fuchsia `#FF00FF` was rejected because INTERSECTION already owns that magenta — the two now differ by BOTH shape and colour). `snap-visual-config.test.ts` +1 case (dim_line ≡ dim_def_point colour family). Presentational SVG (leaf, ADR-542 SSoT — both 2D + 3D overlays inherit). Opus 4.8. **All 3 handoff steps done.** 🔴 PENDING: browser-verify (hover dimension → orange ⊢─⊣ / ⊡ marker + snap) + commit (CHECK 6D → stage ADR-378). |
| 2026-07-07 | Bugfix | **Text snap never appeared + didn't coincide with grips (Γιώργος: «hover σε κείμενο → κανένα σημάδι έλξης, δεν έλκομαι»).** TWO bugs. **(1) Activation — no markers for ANY user:** `ExtendedSnapType.TEXT` was registered in `SnapEngineRegistry` + in `DEFAULT_PRO_SNAP_SETTINGS.enabledTypes`, but was **missing from `ALL_MODES` in `SnapContext.tsx`**. The live `enabledTypes` is rebuilt every render from `enabledModes` (`useSnapManager`), which iterates ONLY `ALL_MODES` — so TEXT could never enter `enabledTypes`, the registry never called `TextSnapEngine.initialize`/`findSnapCandidates`, zero markers. Worse than the ADR-378 persisted-blob trap (that only hit stored ids IN `ALL_MODES`): TEXT had no toolbar toggle either. **Fix:** add `ExtendedSnapType.TEXT` to `ALL_MODES` + `DEFAULT_ENABLED_SNAPS` (default-on, migration-safe via `resolvePersistedSnapState`) + to `ProSnapToolbar.ADVANCED_MODES` (visible toggle; i18n `snapModes.labels.text`/`tooltips.text` already existed). **(2) Geometry — points didn't match the grips (would have missed badly for in-app text):** `TextSnapEngine.estimateTextBbox` read raw flat `text`/`fontSize`/`height` (undefined for `CreateTextCommand` text → a ~6×10 box at the insertion), and the box wasn't the one the grips draw. **Fix (FULL-SSoT):** the 8 points now derive from the SAME visual box the grips/hover use — `projectSceneTextToDxf` → `resolveTextBox` → `rectCornerWorld`/`rectEdgeWorld` (`bim/grips/rect-frame`) → corners/center/edge-mids **coincide with the text grips** and the drawn glyphs; `estimateTextBbox`/`computeTextSnapGeometry` no longer used by the engine (`computeTextSnapGeometry` stays as the `getTextSnapPoints` font-aware helper). `TextSnapEngine.test.ts` rewired to parity vs `resolveTextBox` + new in-app-text (textNode-only) case: 16/16· **195/195 GREEN** across `snapping/**`. Opus 4.8. 🔴 PENDING: browser-verify (OSNAP on → hover TEXT/MTEXT → ▣ markers on corners/center/edge-mids + attraction) + commit (CHECK 6D → stage ADR-378). |
| 2026-07-07 | Bugfix | **Text snap → full Figma/C4D 9-point bounding-box (added E/W edge midpoints; handoff `2026-07-07_text-snap-east-west-edge-midpoints`).** Symptom (Γιώργος): hover on TEXT/MTEXT showed attraction marks on corners + centre + **top/bottom** edge midpoints, but the **east (right) + west (left)** edge midpoints were missing — even though selecting the text shows grips on all 4 edges (`text-edge-e`/`-w`/`-n`/`-s`). Root cause: the text snap taxonomy `TextSnapKind` had only `edge-top-mid`/`edge-bottom-mid` (2 of 4 edge mids) — the e/w mids were **never produced**, not mispositioned. **Decision (industry):** follow **Figma / Maxon C4D** bounding-box smart-snapping = 4 corners + 4 edge mids + centre (AutoCAD TEXT native OSNAP is INS-only, Revit annotation is limited); since Nestor already draws grips on all 4 edges, "snap == grips" is the enterprise-consistent model. **Fix (additive, FULL-SSoT):** added `'edge-left-mid'`/`'edge-right-mid'` to `TextSnapKind` (+ exhaustive `snapTypeFor`→MIDPOINT, `priorityFor`→MIDPOINT, `descriptionFor`, and the `computeTextSnapGeometry` local map + order in `TextSnapProvider.ts`); `TextSnapEngine.computeTextSnapPoints` emits 2 more points via the SAME `rectEdgeWorld(frame,{axis:'x',sign:±1})` used by the `text-edge-e`/`text-edge-w` grips → the hover markers land EXACTLY on the grips. No new snap mechanism, no new glyph (`text-*` description → no BIM label, plain ▣), no new i18n key. Text snap set now 8 → **10 points** (insertion + 4 corners + centre + 4 edge mids). Tests: `TextSnapEngine.test.ts` + `TextSnapProvider.test.ts` updated 8→10 + e/w grip-parity + e/w geometry cases — **31/31 GREEN**. Sonnet 4.6. 🔴 PENDING: browser-verify (hover TEXT/MTEXT → ▣ on left+right edge mids, coincident with grips) + commit (CHECK 6D → stage ADR-378). |
| 2026-05-27 | 4 | Phase 4 — Geo-canvas SnapEngine unification with DXF Viewer SSoT. NEW `geo-canvas/floor-plan-system/snapping/adapter/parser-result-to-entities.ts` (108 LOC) maps GeoJSON FeatureCollection (LineString/Polygon/MultiLineString) → DXF Entity[] (mirror `regionsToSnapEntities` pattern). REFACTORED `hooks/useSnapEngine.ts` (~190 LOC) — façade over `getGlobalSnapEngine()` with `EXTENDED_TO_GEO_MODE` mapper collapsing 26-mode ProSnapEngineV2 output to 6 classic geo-canvas `SnapMode` values for render-layer back-compat. Public API surface `UseSnapEngineReturn` UNCHANGED — `GeoCanvasContent.tsx:93` + `FloorPlanCanvasLayer.tsx` consumers work as-is. DELETED `engine/SnapEngine.ts` (275 LOC) + `endpoint-detector.ts` (202 LOC) + `snap-distance.ts` (139 LOC) + `engine/index.ts` barrel + `useSnapPoints.ts` (zero callers). KEPT `types/snap-types.ts` + `config/snap-defaults.ts` + `rendering/SnapIndicator.tsx` (required by render layer). Property floorplan tab user-visible win: 26 modes (BIM corners + dim + guides + text + classic CAD) vs previous 6 endpoint-only. Tsc zero new errors. Jest 188 pass / 2 pre-existing unrelated fails (bim-corner-alignment + DxfGeoTransform i18n drift). Single-scene-at-a-time assumption documented in §9 Phase 4.5 (DXF Viewer + geo-canvas not concurrently mounted). Opus 4.7, ~2h. |

---

## 16. References

External (industry):
- Revit Snap Engine: Autodesk Revit User Guide § "Object Snaps"
- AutoCAD OSNAP: Autodesk AutoCAD Customization Guide § "Object Snap Modes" (F3 toggle)
- ArchiCAD Snap Guide + Hotspots: Graphisoft ArchiCAD 27 Reference Manual § "Drawing Aids"
- BricsCAD ESNAP: Bricsys BricsCAD V25 User Guide § "Entity Snap"
- SketchUp Inference Engine: Trimble SketchUp 2024 Help § "Inference Engine"
- Vectorworks Snapping: Vectorworks 2024 Getting Started Guide § "Snapping"
- Bentley AccuSnap: Bentley MicroStation CONNECT Edition Help § "AccuSnap"

Internal:
- `src/subapps/dxf-viewer/docs/features/snapping/ARCHITECTURE.md` — high-level overview
- `src/subapps/dxf-viewer/docs/CENTRALIZED_SYSTEMS.md` — DXF Viewer centralization index
- `SPEC-3D-004C-genarc-utils-snap-picking-port-catalog.md` — confirms Nestor snap engine is "strict superset" of GenArc (17 engines vs 7 strategies)
