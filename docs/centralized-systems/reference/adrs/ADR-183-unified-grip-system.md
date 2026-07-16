# ADR-183: Unified Grip System — Ενοποίηση DXF + Overlay Grip Interaction

**Status**: IMPLEMENTED
**Date**: 2026-02-16
**Author**: Claude Opus 4.6 + Georgios Pagonis
**Supersedes**: Partial ADR-048 (rendering only), ADR-031 (multi-grip selection)
**Related**: ADR-075, ADR-106, ADR-151, ADR-154

---

## 1. Context — Υφιστάμενη Κατάσταση

### 1.1 Δύο ξεχωριστά Grip Systems

Υπάρχουν **2 πλήρως ανεξάρτητα grip systems** που κάνουν ουσιαστικά το ίδιο πράγμα:

| Πτυχή | DXF Entity Grips | Overlay (Color Layer) Grips |
|-------|-------------------|----------------------------|
| **State hook** | `useDxfGripInteraction` (847 γρ.) | `useGripSystem` (~200 γρ.) |
| **Hover detection** | `findGripNear()` inside hook | `useLayerCanvasMouseMove` (~250 γρ.) |
| **Drag state machine** | Internal `phase` state (idle→hovering→warm→dragging) | Distributed across `useCanvasMouse` (~600 γρ.) |
| **Drag commit** | `commitGripDelta()` → `MoveVertexCommand` | `handleContainerMouseUp` → `MoveMultipleOverlayVerticesCommand` |
| **Rendering** | `GripPhaseRenderer` → `UnifiedGripRenderer` | `LayerRenderer.drawPolygonGrips()` |
| **Hit testing** | `calculateDistance(worldPos, grip.position) <= tolerance` | `squaredDistance(worldPos, vertex) < toleranceSq` |
| **Canvas** | DxfCanvas (z-10) | LayerCanvas (z-0) |
| **Coordinate system** | Y-inverted (DXF standard) | Normal Y-up |
| **Entity storage** | `SceneModel.entities[]` (typed entities) | `Overlay.polygon: [number, number][]` |

### 1.2 Αρχεία ανά σύστημα

**DXF Grip System (5 αρχεία, ~1,800 γρ.)**:
```
hooks/useDxfGripInteraction.ts        (847 γρ.) — State machine + handlers
rendering/grips/UnifiedGripRenderer.ts (251 γρ.) — Rendering facade
rendering/grips/GripColorManager.ts    (122 γρ.) — Color priority
rendering/grips/GripSizeCalculator.ts  (102 γρ.) — Size calculation
rendering/grips/GripInteractionDetector.ts (119 γρ.) — Temperature detection
rendering/grips/GripShapeRenderer.ts   (151 γρ.) — Shape rendering
rendering/grips/constants.ts           (95 γρ.)  — Centralized constants
systems/phase-manager/renderers/GripPhaseRenderer.ts — Phase-specific rendering
```

**Overlay Grip System (4 αρχεία, ~1,200 γρ.)**:
```
hooks/grips/useGripSystem.ts             (~200 γρ.) — State container
hooks/canvas/useLayerCanvasMouseMove.ts  (~250 γρ.) — Hover detection
hooks/canvas/useCanvasMouse.ts           (~600 γρ.) — Drag initiation + commit
hooks/layers/useOverlayLayers.ts         (~150 γρ.) — State → rendering bridge
canvas-v2/layer-canvas/LayerRenderer.ts  (grip section ~170 γρ.) — Grip rendering
```

### 1.3 Προβλήματα

#### P1: Code Duplication (~70% overlap σε λογική)
- **Hit testing**: Ίδιος αλγόριθμος (distance < tolerance), 2 implementations
- **State machine**: Ίδιο pattern (idle→hover→drag→commit), 2 implementations
- **Color/size**: Ήδη ενοποιήθηκαν (σήμερα 2026-02-16) αλλά εξακολουθούν να γίνονται consume ξεχωριστά
- **Drag preview**: Ίδιο pattern (immutable originalPos + delta), 2 implementations

#### P2: Z-Index Mouse Event Blocking
- DxfCanvas (z-10) παγιδεύει ΟΛΑ τα mouse events
- LayerCanvas (z-0) δεν λαμβάνει ποτέ native events
- **Workaround (2026-02-16)**: Bridge call `handleLayerCanvasMouseMove()` μέσα στο `handleDxfMouseMove`
- Αυτό είναι **patch, όχι enterprise λύση**

#### P3: Inconsistent Behavior
- **DXF grips**: 1 second warm delay (hover timer)
- **Overlay grips**: Instant warm (no timer)
- **DXF grips**: Drag-release model (press anywhere on grip)
- **Overlay grips**: Click-to-select, then drag

#### P4: Maintenance Burden
- Bug fix σε ένα σύστημα πρέπει manually να εφαρμοστεί και στο άλλο
- Νέα features (π.χ. snap-to-grid during drag) πρέπει να υλοποιηθούν 2 φορές

### 1.4 Τι ΔΕΝ είναι πρόβλημα

- **2 Canvas layers**: Σωστό (industry-standard Figma/AutoCAD pattern)
- **2 Renderers**: Σωστό (κάθε canvas χρειάζεται δικό renderer)
- **2 Coordinate systems**: Σωστό (adapter pattern, DXF=Y-inverted)
- **2 Storage formats**: Σωστό (SceneEntity vs Overlay polygon)

---

## 2. Decision — Τι ενοποιούμε

### 2.1 Scope: Interaction Layer ΜΟΝΟ

Ενοποιούμε τα **interaction concerns** (hover, selection, drag state machine).
ΔΕΝ ενοποιούμε rendering ή storage.

```
ΠΡΙΝ:
┌─────────────────────────────────────────────────┐
│ DXF Grip System                                  │
│ useDxfGripInteraction (state+hover+drag+commit)  │
│ GripPhaseRenderer (rendering)                    │
│ UnifiedGripRenderer (shape/color/size)           │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│ Overlay Grip System                              │
│ useGripSystem (state)                            │
│ useLayerCanvasMouseMove (hover)                  │
│ useCanvasMouse (drag+commit)                     │
│ LayerRenderer (rendering)                        │
└─────────────────────────────────────────────────┘

ΜΕΤΑ:
┌─────────────────────────────────────────────────┐
│ Unified Grip Interaction (NEW)                   │
│ useUnifiedGripInteraction (state+hover+drag)     │
│ ├── Grip Registry (all grips from all sources)   │
│ ├── Hit Testing (one pipeline)                   │
│ ├── State Machine (idle→hover→warm→drag→commit)  │
│ └── Commit Router (DXF vs Overlay adapters)      │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────┐  ┌────────────────────────────┐
│ DXF Rendering (unchanged)       │  │ Overlay Rendering (unchanged)│
│ GripPhaseRenderer               │  │ LayerRenderer               │
│ UnifiedGripRenderer             │  │ (draws grips from state)    │
│ (draws grips from state)        │  │                              │
└─────────────────────────────────┘  └────────────────────────────┘
```

### 2.2 Unified GripInfo — Κοινός τύπος

```typescript
/** Ενοποιημένο grip identity — works for both DXF entities and overlays */
interface UnifiedGripInfo {
  // ── Identity ──
  id: string;                              // Unique: `dxf_${entityId}_${gripIndex}` or `overlay_${overlayId}_v${index}`
  source: 'dxf' | 'overlay';              // Provenance

  // ── Positioning ──
  position: Point2D;                       // World coordinates (Y-up)
  gripIndex: number;                       // Index within parent entity

  // ── Classification ──
  type: 'vertex' | 'edge' | 'center';     // Grip type
  shape: 'square' | 'diamond' | 'circle'; // Visual shape

  // ── Behavior ──
  movesEntity: boolean;                    // true = translate whole entity
  edgeVertexIndices?: [number, number];    // For edge-stretch

  // ── Source reference ──
  entityId?: string;                       // DXF entity ID
  overlayId?: string;                      // Overlay ID
}
```

### 2.3 Unified State Machine

```
         ┌───────────┐
         │   IDLE     │  No grip near cursor
         └─────┬─────┘
               │ cursor enters grip tolerance (8px / scale)
               ▼
         ┌───────────┐
         │  HOVERING  │  Blue grip, cold → detecting
         └─────┬─────┘
               │ mouseDown on grip (OR 1s timer for warm visual)
               ▼
         ┌───────────┐
         │  DRAGGING  │  Red grip, entity follows cursor
         │            │  Live preview via dragPreview
         └──┬──┬──┬──┘
            │  │  │
    mouseUp │  │  │ Escape / right-click
            ▼  │  ▼
        COMMIT │ CANCEL
            │  │  │
            └──┴──┘
               │
               ▼
         ┌───────────┐
         │   IDLE     │  Reset all state
         └───────────┘
```

**Σημαντική αλλαγή**: Ενοποίηση behavior — overlay grips αποκτούν ίδια behavior με DXF grips:
- Mousedown → instant drag start (αντί click-to-select → drag)
- Ο warm timer (1s) γίνεται visual-only (δεν εμποδίζει drag)

---

## 3. Architecture — Λεπτομερής Σχεδιασμός

### 3.1 Grip Registry — Μητρώο Grips

```typescript
interface GripRegistryEntry {
  grips: UnifiedGripInfo[];
  source: 'dxf' | 'overlay';
}

/** Συλλέγει grips από ΟΛΕΣ τις πηγές */
function useGripRegistry(params: {
  // DXF source
  dxfScene: SceneModel | null;
  selectedEntityIds: string[];
  // Overlay source
  selectedOverlays: Overlay[];
  overlayVertices: Map<string, [number, number][]>;
}): UnifiedGripInfo[] {
  return useMemo(() => {
    const grips: UnifiedGripInfo[] = [];

    // 1. DXF entity grips (reuse existing computeDxfEntityGrips logic)
    for (const entityId of selectedEntityIds) {
      const entity = findEntity(dxfScene, entityId);
      if (entity) {
        grips.push(...computeDxfEntityGrips(entity));  // Existing function
      }
    }

    // 2. Overlay grips (vertex + edge midpoints)
    for (const overlay of selectedOverlays) {
      const vertices = overlayVertices.get(overlay.id) ?? overlay.polygon;
      grips.push(...computeOverlayGrips(overlay.id, vertices));  // New function
    }

    return grips;
  }, [dxfScene, selectedEntityIds, selectedOverlays, overlayVertices]);
}
```

### 3.2 Unified Hit Testing

```typescript
/** Single hit-test pipeline for ALL grip types */
function findNearestGrip(
  worldPos: Point2D,
  allGrips: UnifiedGripInfo[],
  tolerancePx: number,
  scale: number
): UnifiedGripInfo | null {
  const toleranceWorld = tolerancePx / scale;
  const toleranceSq = toleranceWorld * toleranceWorld;

  // Vertex grips have PRIORITY over edge grips (Autodesk pattern)
  let nearestVertex: UnifiedGripInfo | null = null;
  let nearestEdge: UnifiedGripInfo | null = null;
  let minVertexDistSq = Infinity;
  let minEdgeDistSq = Infinity;

  for (const grip of allGrips) {
    const dx = worldPos.x - grip.position.x;
    const dy = worldPos.y - grip.position.y;
    const distSq = dx * dx + dy * dy;

    if (distSq > toleranceSq) continue;

    if (grip.type === 'edge') {
      if (distSq < minEdgeDistSq) {
        minEdgeDistSq = distSq;
        nearestEdge = grip;
      }
    } else {
      if (distSq < minVertexDistSq) {
        minVertexDistSq = distSq;
        nearestVertex = grip;
      }
    }
  }

  return nearestVertex ?? nearestEdge;  // Vertex priority
}
```

### 3.3 Commit Router

```typescript
interface GripCommitAdapter {
  commitDelta(grip: UnifiedGripInfo, delta: Point2D): void;
}

/** DXF Adapter — delegates to existing MoveVertexCommand */
class DxfGripCommitAdapter implements GripCommitAdapter {
  commitDelta(grip: UnifiedGripInfo, delta: Point2D): void {
    if (grip.edgeVertexIndices) {
      // Edge-stretch: atomic update of both vertices
      this.edgeStretchAtomic(grip, delta);
    } else if (grip.movesEntity) {
      // Entity move: translate entire entity
      this.moveEntities([grip.entityId!], delta);
    } else {
      // Vertex move: update single vertex
      this.executeCommand(new MoveVertexCommand(...));
    }
  }
}

/** Overlay Adapter — delegates to existing overlay commands */
class OverlayGripCommitAdapter implements GripCommitAdapter {
  commitDelta(grip: UnifiedGripInfo, delta: Point2D): void {
    if (grip.type === 'edge') {
      // Edge midpoint insertion
      this.overlayStore.addVertex(grip.overlayId!, ...);
    } else {
      // Vertex move
      this.executeCommand(new MoveMultipleOverlayVerticesCommand(...));
    }
  }
}
```

### 3.4 Rendering Bridge

Τα 2 renderers (GripPhaseRenderer + LayerRenderer) δεν αλλάζουν.
Απλά καταναλώνουν ενοποιημένο state:

```typescript
// Ενοποιημένο state interface
interface UnifiedGripState {
  hoveredGrip: UnifiedGripInfo | null;     // WARM visual
  activeGrip: UnifiedGripInfo | null;      // HOT visual
  isDragging: boolean;
  dragDelta: Point2D | null;               // For live preview
}

// DxfCanvas consumes:
const dxfGripState = {
  hoveredGrip: state.hoveredGrip?.source === 'dxf' ? state.hoveredGrip : null,
  activeGrip: state.activeGrip?.source === 'dxf' ? state.activeGrip : null,
};

// LayerCanvas consumes:
const overlayGripState = {
  hoveredVertexInfo: state.hoveredGrip?.source === 'overlay' && state.hoveredGrip.type === 'vertex'
    ? { overlayId: state.hoveredGrip.overlayId!, vertexIndex: state.hoveredGrip.gripIndex }
    : null,
  hoveredEdgeInfo: state.hoveredGrip?.source === 'overlay' && state.hoveredGrip.type === 'edge'
    ? { overlayId: state.hoveredGrip.overlayId!, edgeIndex: state.hoveredGrip.gripIndex }
    : null,
};
```

---

## 4. Files — Αλλαγές ανά αρχείο

### 4.1 ΝΕΑ αρχεία

| Αρχείο | Γραμμές | Περιγραφή |
|--------|---------|-----------|
| `hooks/grips/useUnifiedGripInteraction.ts` | ~400 | Ενοποιημένο state machine + handlers |
| `hooks/grips/grip-registry.ts` | ~120 | Grip collection από DXF + overlay |
| `hooks/grips/grip-hit-testing.ts` | ~60 | Unified hit-test (vertex priority) |
| `hooks/grips/grip-commit-adapters.ts` | ~150 | DXF + Overlay commit logic |
| `hooks/grips/unified-grip-types.ts` | ~80 | UnifiedGripInfo + state types |

### 4.2 ΤΡΟΠΟΠΟΙΗΜΕΝΑ αρχεία

| Αρχείο | Αλλαγή |
|--------|--------|
| `components/dxf-layout/CanvasSection.tsx` | Replace 2 grip hooks → 1 `useUnifiedGripInteraction` |
| `components/dxf-layout/CanvasLayerStack.tsx` | Remove bridge hack, consume unified state |
| `hooks/layers/useOverlayLayers.ts` | Consume unified state αντί useGripSystem |

### 4.3 DEPRECATED (keep, mark as legacy)

| Αρχείο | Κατάσταση |
|--------|-----------|
| `hooks/useDxfGripInteraction.ts` | `@deprecated` — logic moves to unified hook |
| `hooks/grips/useGripSystem.ts` | `@deprecated` — state moves to unified hook |
| `hooks/canvas/useLayerCanvasMouseMove.ts` (grip section) | Hover logic moves to unified hook |
| `hooks/canvas/useCanvasMouse.ts` (grip drag section) | Drag logic moves to unified hook |

---

## 5. Implementation Plan — Phased

### Phase A: Unified Types + Registry (~0.5 μέρα)
1. Create `unified-grip-types.ts` — UnifiedGripInfo, UnifiedGripState
2. Create `grip-registry.ts` — collects grips from both sources
3. Create `grip-hit-testing.ts` — single findNearestGrip function
4. **Verify**: `npx tsc --noEmit` — 0 errors (no consumers yet)

### Phase B: Unified State Machine (~1 μέρα)
1. Create `useUnifiedGripInteraction.ts` — state machine (idle→hover→drag→commit)
2. Create `grip-commit-adapters.ts` — DXF + Overlay commit logic
3. Wire into CanvasSection.tsx (replace both old hooks)
4. Wire into CanvasLayerStack.tsx (remove bridge hack)
5. Update useOverlayLayers.ts (consume unified state)
6. **Verify**: `npx tsc --noEmit` — 0 errors
7. **Test**: All grip operations work (DXF + overlay)

### Phase C: Cleanup (~0.5 μέρα)
1. Mark deprecated hooks with `@deprecated`
2. Remove dead imports
3. Remove bridge hack from CanvasLayerStack
4. Update ADR-048, ADR-031 references
5. **Verify**: `npx tsc --noEmit` — 0 errors

---

## 6. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Overlay coordinate system (Y-up) vs DXF (Y-inverted) | HIGH | GripRegistry normalizes to world coords (Y-up); DXF renderer applies Y-invert on rendering |
| Multi-grip selection (overlay-specific feature) | MEDIUM | Keep in unified hook; DXF grips ignore multi-select for now |
| Warm timer (DXF has 1s delay, overlay instant) | LOW | Use unified behavior: visual warm after 200ms, drag allowed immediately |
| Edge midpoint insertion (overlay-only) | MEDIUM | Commit adapter handles; unified hook just passes delta |
| Body drag / Shift+drag (overlay-only) | LOW | Keep as separate mode in unified hook, triggered by modifier key |

---

## 7. Success Criteria

- [ ] 1 hook αντί 2 για grip interaction
- [ ] 1 hit-test pipeline αντί 2
- [ ] 1 state machine αντί 2
- [ ] Overlay grips: ίδια behavior με DXF grips (instant drag)
- [ ] DXF grips: unchanged behavior
- [ ] Bridge hack (handleLayerCanvasMouseMove in handleDxfMouseMove) αφαιρείται
- [ ] 0 TypeScript errors
- [ ] All manual tests pass

---

## 8. Changelog

| Ημερομηνία | Αλλαγή |
|-----------|--------|
| 2026-07-17 | **§overlay-grip-types SSoT — το `canvas-mouse-types.ts` σταμάτησε να ξανα-δηλώνει τους overlay grip types· τους re-export-άρει από τον canonical SSoT.** (ADR-584 clone dedup, **UNCOMMITTED**.) **Μετρημένο: 1 clone / 65 γρ. / 118 tokens → 0**· `canvas-mouse-types.ts` 187 → 157 γρ. **Τι ήταν διπλό**: **έξι** interfaces (`VertexHoverInfo`, `EdgeHoverInfo`, `SelectedGrip`, `DraggingVertexState`, `DraggingEdgeMidpointState`, `DraggingOverlayBodyState`) δηλωμένα **δομικά ταυτόσημα** και στα δύο αρχεία. **Ο SSoT υπήρχε ήδη**: το `hooks/grips/unified-grip-types.ts` **αυτο-ανακηρύσσεται** canonical στο header του («Canonical SSoT for all grip types. Overlay hover/drag/select types live here inline») — απλώς το `canvas-mouse-types.ts` **δεν τον υιοθέτησε ποτέ**. Άρα: αναδοχή, **ΟΧΙ** νέο module (N.0.2). **Fix**: `export type { … } from '../grips/unified-grip-types'` — ίδιο μοτίβο με το `grip-kinds.ts` («call-sites keep working»). **Public API αμετάβλητο** → **1 αρχείο**· από τους **27** καταναλωτές των τύπων (**3** εισάγουν μέσω `canvas-mouse-types`) **κανένας δεν αγγίχτηκε**. `DraggingGuideState` (μόνο canvas, ADR-189 B5) + `GripHoverThrottle` (μόνο grips) **έμειναν στη θέση τους** — δεν είναι δίδυμα. **Κύκλος**: κανένας — το `unified-grip-types` → `rendering/types` + `grip-kinds` + `grip-computation`, **ποτέ** προς `hooks/canvas` (grep-verified)· type-only ούτως ή άλλως → μηδέν runtime coupling. **🔴 ΟΡΙΟ ΕΠΑΛΗΘΕΥΣΗΣ — διαβάσου προσεκτικά**: η αλλαγή είναι **type-only** και το `src/subapps/dxf-viewer/**` είναι **excluded** από το root `tsconfig.json` (γρ. 39) **ΚΑΙ** το jest τρέχει με **`@swc/jest`** που **σβήνει** τους τύπους χωρίς typecheck → **ούτε τα 465 πράσινα tests ούτε το pre-commit hook αποδεικνύουν type-ορθότητα εδώ**. Το μόνο πραγματικό δίχτυ είναι το **CHECK 3.29 στο CI** (ADR-663). Υποκατάστατο: grep ότι **κάθε** τοπικά χρησιμοποιούμενο όνομα είναι imported — **έπιασε πραγματικό λάθος** (το `export type {…}` **δεν** φέρνει ονόματα σε τοπικό scope· τα `VertexHoverInfo`/`EdgeHoverInfo` χρησιμοποιούνται τοπικά στις γρ. 82/84 και έλειπαν από το `import type`). **Tests**: 465/466 GREEN σε `hooks/canvas` + `hooks/grips` + `snapping`. ⚠️ **1 pre-existing FAIL** (`dxf-scene-entity-toDxf-coverage`, ADR-587 Φ5) — **ΔΕΝ είναι δικό μου**: πέφτει **ταυτόσημα στο HEAD χωρίς την αλλαγή μου** (επαληθεύτηκε με revert+rerun) και δεν αναφέρει καθόλου τα αρχεία μου· ρεύμα άλλου agent στο κοινό tree. Ομοίως το `grip-computation-coverage` (ADR-587 Φ7). `jscpd:diff` καθαρό. tsc SKIP (N.17). |
| 2026-02-16 | ADR-183 PROPOSED — Initial analysis and architecture design |
| 2026-05-09 | **Bugfix**: vertex teleport to (0,0) on grip click. Root cause: `handleMouseUp` called twice in same tick — once from canvas `onMouseUp` (`mouse-handler-up.ts` with correct worldPos from event) and once from container `onMouseUp` (`useCanvasContainerHandlers.ts` with stale `mouseWorldRef.current ?? {0,0}`). React `setState` is async, so the second invocation saw the same closure values and committed again with the wrong worldPos, producing `delta = -gripPosition` → vertex moved to ~(0,0). Fix: synchronous `mouseUpInProgressRef` mutex inside `useUnifiedGripInteraction.handleMouseUp` — second concurrent call bails immediately. Also: removed duplicate commit path in `handleVertexDragEnd` (cleanup-only now), added movement-threshold guard + missing-vertex skip in `commitOverlayVertexDrag` (no more `?? 0` fallback). |
| 2026-05-09 | **Bugfix**: overlay grip drag also drew a new polygon. Root cause: `dxfProjection.handleGripMouseUp` only returned `true` when `activeGrip.source === 'dxf'`. For overlay grips it returned `false`, so the canvas mouse-up handler fell through to `onCanvasClick` and the active drawing tool (layering/polygon) registered a stray click. Fix: `handleGripMouseUp` and `handleGripMouseMove` now return `true` for ANY active drag (phase=dragging OR vertex/edge/body dragging state), regardless of source. Drag state is captured into a local before `handleMouseUp` resets it. |
| 2026-05-09 | **Bugfix**: vertex flickered to original position on grip release. Root cause: overlay store had no optimistic update — `updateVertex` / `update` only fired the API PATCH; the rendered polygon came entirely from the Firestore subscription, so the UI flashed back to the snapshot value during the (slow) write→snapshot round-trip. Fix: `OverlayStoreProvider` now keeps a `pendingPolygons` map. `update()` writes the override immediately when `patch.polygon` is present, then awaits the API; the override is dropped by a reconcile effect once the next snapshot reflects the same polygon, or rolled back if the API rejects. Covers single vertex drag, multi-vertex drag, and overlay body drag (all flow through `update()`). |
| 2026-05-09 | **Bugfix**: grip stayed red after release; the next drag's grip never turned red ("every other drag" pattern). Two distinct causes. **(a)** `selectedGrips` was never cleared on commit and the layer renderer maps `isSelected → hot` (red) — so the dragged grip kept the hot color after release. Fix: `setSelectedGrips([])` at the end of every overlay drag branch in `handleMouseUp` (vertex / edge / body). **(b)** `handleMouseDown` was invoked twice in the same tick — once by the canvas (correct worldPos from the event) and once by the bubbled container (stale `mouseWorldRef.current`). The container's call typically resolved no `nearGrip` and ran `setSelectedGrips([])`, clobbering the canvas's correct selection on every other click (the clear branch only fires when `selectedGrips.length > 0`). Fix: synchronous `mouseDownInProgressRef` mutex released via microtask, mirroring the `mouseUpInProgressRef` pattern. |
| 2026-05-11 | **Grip Settings Wiring — Fase A**: `GripColorManager.ts` — rimossi colori override test (#FF0000/#FF00FF); colori leggono Priority 3 (settings store). `constants.ts` — `DEFAULT_GRIP_COLORS.COLD` → `#5F9ED1` (blu AutoCAD standard ACI 5); `EDGE_GRIP_COLOR` → `UI_COLORS.SUCCESS_BRIGHT` (verde). `GripStyleStore.ts` — default cold → `UI_COLORS.BLUE_DEFAULT`. `GripProvider.tsx` — tutte e 3 le chiamate `gripStyleStore.set()` ora sincronizzano anche: `showAperture`, `multiGripEdit`, `snapToGrips`, `showGripTips`, `dpiScale`, `showMidpoints`, `showCenters`, `showQuadrants`, `maxGripsPerEntity`. `layer-canvas-hooks.ts` — `useEffect` che fa subscribe a `gripStyleStore` e marca `isDirtyRef = true` su ogni cambio. |
| 2026-05-11 | **Grip Settings Wiring — Fase B**: `grip-registry.ts` — aggiunto `useGripStyle()`; filtra grip per `showMidpoints` (esclude edge/midpoint), `showCenters` (esclude center), `maxGripsPerEntity` (limite per entità); stesso filtro applicato agli overlay grips. `useUnifiedGripInteraction.ts` — `lockGripSnapPosition` gated su `gripStyleStore.get().snapToGrips`. |
| 2026-05-11 | **Grip Settings Wiring — Fase C**: `useUnifiedGripInteraction.ts` — Shift+click multi-selezione gated su `gripStyleStore.get().multiGripEdit`; quando il flag è `false` lo shift viene ignorato e la selezione rimane singola. `CrosshairOverlay.tsx` — aggiunto rendering aperture box (AutoCAD APBOX): quadrato non riempito centrato sul cursore, dimensione `apertureSize` (CSS px), colore uguale al crosshair, visibile quando `showAperture && apertureSize > 0`; deps `useCallback` aggiornate con `showAperture` + `apertureSize`. |
| 2026-05-19 | **Phase C completed — deprecated hooks deleted.** Removed `hooks/useDxfGripInteraction.ts` (451 lines, zero function call-sites) + `hooks/grips/useGripSystem.ts` (387 lines, zero function call-sites). Both were `@deprecated` since 2026-02-16; only types and `computeDxfEntityGrips` were still consumed. Migration: (1) overlay grip types (`VertexHoverInfo`, `EdgeHoverInfo`, `SelectedGrip`, `DraggingVertexState`, `DraggingEdgeMidpointState`, `DraggingOverlayBodyState`, `GripHoverThrottle`) inlined in `hooks/grips/unified-grip-types.ts` — now canonical SSoT for grip types; (2) DXF state-machine type re-exports (`DxfGripDragPreview`, `DxfGripInteractionState`, `GripIdentifier`) sourced from `hooks/grip-computation.ts` instead of from the deleted hook file; (3) `computeDxfEntityGrips` consumer (`hooks/grips/grip-registry.ts`) repointed to `hooks/grip-computation.ts` (already the canonical pure-fn module); (4) 5 canvas hooks + `grips/index.ts` + `canvas-layer-stack-types.ts` updated to import from `unified-grip-types.ts` / `grip-computation.ts`. **Known Boy Scout follow-up**: `hooks/canvas/canvas-mouse-types.ts:19-89` still defines its own copies of the same 7 overlay grip types — should re-export from `unified-grip-types.ts` instead (added to `.claude-rules/pending-ratchet-work.md`). |
