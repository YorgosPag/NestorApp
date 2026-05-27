# ADR-378 — Snap System Master Architecture & SSoT

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟡 **DRAFT** 2026-05-27 — Master ADR γράφτηκε, Phases 1-6 cleanup pending |
| **Date** | 2026-05-27 |
| **Category** | DXF Viewer — Snapping (Master) |
| **Location** | `docs/centralized-systems/reference/adrs/ADR-378-snap-system-master-architecture.md` |
| **Author** | Claude Opus 4.7 + Γιώργος Παγώνης |
| **Supersedes (consolidates)** | Phantom ADR-149 (referenced by ADR-371 but never written) |
| **Companions (sub-decisions)** | ADR-087 (config constants), ADR-095 (tolerance), ADR-137 (icon geometry), ADR-153 (tooltip offset), ADR-371 (BIM corners), ADR-362 (dimension snap), ADR-363 (column center), ADR-189 (construction guides), ADR-344 (text snap), ADR-040 (lifecycle owner), ADR-357 (override modes) |
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
│  │  Text (1 — pending Phase 3):                             │ │
│  │    TextSnapEngine (ADR-344 Phase 6.C completion)         │ │
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
| `TextSnapProvider` (Phase 6.B) | `text-engine/interaction/TextSnapProvider.ts` | **Wrap in `TextSnapEngine`** + register | 3 |
| Geo-canvas `SnapEngine` (6-mode parallel) | `geo-canvas/floor-plan-system/snapping/engine/SnapEngine.ts` | **Replace with adapter to `getGlobalSnapEngine()`** | 4 |

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

### Phase 3 — TextSnapEngine (Sonnet, ~2h)

#### 3.1 Create `TextSnapEngine.ts`
- File: `src/subapps/dxf-viewer/snapping/engines/TextSnapEngine.ts`
- Pattern: extend `BaseSnapEngine`, mirror `ColumnCenterSnapEngine` skeleton
- Wraps existing `getTextSnapPoints()` from `TextSnapProvider.ts`

#### 3.2 Type system
- `extended-types.ts` — add `TEXT = 'text'` enum, add to `enabledTypes`, `priority` (position 2), `perModePxTolerance`
- `tolerance-config.ts` — add `TEXT: 2` in `SNAP_ENGINE_PRIORITIES`

#### 3.3 Registry registration
- `SnapEngineRegistry.ts` — `this.engines.set(ExtendedSnapType.TEXT, new TextSnapEngine())`

#### 3.4 Refactor text-layout-engine
- `text-engine/layout/text-layout-engine.ts` — remove manual `getTextSnapPoints()` + `toSnapCandidates()` feed (text entities now flow naturally)

#### 3.5 i18n + visual indicator
- `el/dxf-viewer-shell.json` — `snapModes.labels.text` (8 sub-keys)
- `en/dxf-viewer-shell.json` — mirror
- `SnapIndicatorOverlay.tsx` — `case 'text':` rect symbol ▣

#### 3.6 Tests
- New: `engines/__tests__/TextSnapEngine.test.ts` (10 cases)
- Update: `text-engine/interaction/__tests__/TextSnapProvider.test.ts`

### Phase 4 — Geo-canvas unification (Opus, ~3h)

#### 4.1 Migrate hooks
- `geo-canvas/floor-plan-system/snapping/hooks/useSnapEngine.ts` — replace local `new SnapEngine()` → `getGlobalSnapEngine()`
- `useSnapPoints.ts` — replace local extraction → use new adapter

#### 4.2 Create adapter
- New: `geo-canvas/floor-plan-system/snapping/adapter/parser-result-to-entities.ts`
- Function: `parserResultToEntities(result: ParserResult): Entity[]`
- Maps `ParserResult.lines/polylines/circles` → DXF `Entity[]`

#### 4.3 Delete legacy geo-canvas snap
- Delete `geo-canvas/floor-plan-system/snapping/engine/SnapEngine.ts`
- Delete `engine/endpoint-detector.ts`
- Delete `engine/snap-distance.ts`
- (Possibly) `types/snap-types.ts`, `config/snap-defaults.ts`

#### 4.4 Verify
- `GeoCanvasContent.tsx` — confirm public surface unchanged
- **User-visible win**: property floorplan tab gains 25 modes (BIM corners, dimensions, guides) vs previous 6

### Phase 5 — Doc cleanup (Sonnet, ~15min)

#### 5.1 Fix ADR-371 phantom reference
- Edit `docs/centralized-systems/reference/adrs/ADR-370-bim-corner-snap-system.md`
- Replace `ADR-149 (Snap Engine Priorities)` → `ADR-378 (Snap System Master Architecture)`

#### 5.2 ADR index
- Edit `docs/centralized-systems/reference/adr-index.md` — add ADR-378 entry in Active list

### Phase 6 — SSoT registry + trackers (Sonnet, ~30min)

#### 6.1 `.ssot-registry.json`
- Update `snap-engine` module entry:
  - Add forbidden: `new\\s+SnapEngine\\s*\\(`, `class\\s+AISnappingEngine`
  - Reference ADR-378 in description
- Refresh: `npm run ssot:baseline`

#### 6.2 ΑΝΑΦΟΡΑ_2
- Add «Snap System Centralization — ADR-378» section, mark ✅ after commit

#### 6.3 pending-ratchet-work.md
- Add changelog entry
- Fold `inferred-alignment-service` pending into ADR-378 §11 future work

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
