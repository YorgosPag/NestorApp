# ⚙️ Configuration Requirements

---

**📚 Part of:** [LINE_DRAWING_SYSTEM.md](../../LINE_DRAWING_SYSTEM.md)
**📂 Documentation Hub:** [README.md](README.md)
**🔗 Related Docs:** [architecture.md](architecture.md), [implementation.md](implementation.md), [settings.md](settings.md)

---

**Last Updated:** 2025-10-05
**Status:** ✅ WORKING (After 6 critical bug fixes)

---

## Required Props Chain

### DXFViewerLayout

```typescript
<DXFViewerLayout
  handleSceneChange={(scene) => {
    // Update scene state
    setCurrentScene(scene);
  }}
  currentScene={currentScene}
  // ... other props
/>
```

**File:** `src/subapps/dxf-viewer/app/DXFViewerLayout.tsx`

---

### NormalView

```typescript
<NormalView
  handleSceneChange={props.handleSceneChange} // Pass through
  currentScene={props.currentScene}           // Pass through
  // ... other props
/>
```

**File:** `src/subapps/dxf-viewer/views/NormalView.tsx`

---

### CanvasSection

```typescript
const drawingHandlers = useDrawingHandlers(
  activeTool,
  (entity) => {
    // Callback when entity created
    const updatedScene = {
      ...props.currentScene,
      entities: [...props.currentScene.entities, entity]
    };
    props.handleSceneChange(updatedScene);
  },
  setActiveTool,
  props.currentScene
);

<DxfCanvas
  scene={props.currentScene} // Must update when entity added!
  onCanvasClick={handleCanvasClick}
  // ... other props
/>

<LayerCanvas
  style={{
    pointerEvents: isDrawingTool ? 'none' : 'auto' // Critical!
  }}
  // ... other props
/>
```

**File:** `src/subapps/dxf-viewer/layout/CanvasSection.tsx`

---

## Required State Management

### Level Store Integration

```typescript
// useUnifiedDrawing must have access to:
const { currentLevelId } = useLevelStore();
const { getLevelScene, setLevelScene } = useLevelStore();

// When entity created:
const scene = getLevelScene(currentLevelId);
const updatedScene = { ...scene, entities: [...scene.entities, newEntity] };
setLevelScene(currentLevelId, updatedScene);
```

**File:** `src/subapps/dxf-viewer/hooks/drawing/useUnifiedDrawing.ts`

---

## Canvas Refs

```typescript
// DxfCanvas must expose getCanvas() method
const dxfCanvasRef = useRef<{ getCanvas: () => HTMLCanvasElement | null }>(null);

// Usage:
const canvasElement = dxfCanvasRef.current?.getCanvas();
```

**Why this is critical:**
- Direct ref access (`dxfCanvasRef.current`) returns the React component, NOT the canvas element
- Calling `.getBoundingClientRect()` on the component causes errors
- `getCanvas()` method returns the actual `<canvas>` element needed for coordinate calculations

**File:** `src/subapps/dxf-viewer/layout/CanvasSection.tsx` (line 597)

---
