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
| 2026-02-16 | ADR-183 PROPOSED — Initial analysis and architecture design |
