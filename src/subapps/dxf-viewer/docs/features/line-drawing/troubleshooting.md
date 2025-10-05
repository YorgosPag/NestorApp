# 🔧 Troubleshooting Guide

---

**📚 Part of:** [LINE_DRAWING_SYSTEM.md](../../LINE_DRAWING_SYSTEM.md)
**📂 Documentation Hub:** [README.md](README.md)
**🔗 Related Docs:** [dual-canvas.md](dual-canvas.md), [implementation.md](implementation.md), [testing.md](testing.md)

---

**Last Updated:** 2025-10-05
**Status:** ✅ WORKING (After 6 critical bug fixes)

---

## Problem: Drawing tools don't work (no response to clicks)

### Checklist:

1. ✅ **Check LayerCanvas pointerEvents**
   - **File:** `src/subapps/dxf-viewer/layout/CanvasSection.tsx` line 871
   - **Should be:** `pointerEvents: isDrawingTool ? 'none' : 'auto'`

2. ✅ **Check selection blocking**
   - **File:** `src/subapps/dxf-viewer/hooks/mouse/useCentralizedMouseHandlers.ts` line 182
   - **Should skip:** `startSelection()` for drawing tools

3. ✅ **Check onCanvasClick passed to DxfCanvas**
   - **File:** `src/subapps/dxf-viewer/layout/CanvasSection.tsx` line ~800
   - **Should have:** `onCanvasClick={handleCanvasClick}`

4. ✅ **Check handleCanvasClick uses drawingHandlersRef.current**
   - **File:** `src/subapps/dxf-viewer/layout/CanvasSection.tsx` line 608
   - **Should be:** `drawingHandlersRef.current.onDrawingPoint()`

---

## Problem: Entity created but doesn't render

### Checklist:

1. ✅ **Check onEntityCreated callback passed to useUnifiedDrawing**
   - **File:** `src/subapps/dxf-viewer/hooks/drawing/useDrawingHandlers.ts` line 40
   - **Should be:** `useUnifiedDrawing(onEntityCreated)`

2. ✅ **Check callback called after setLevelScene**
   - **File:** `src/subapps/dxf-viewer/hooks/drawing/useUnifiedDrawing.ts` lines 357-360
   - **Should call:** `onEntityCreated(newEntity)`

3. ✅ **Check props.handleSceneChange called**
   - **File:** `src/subapps/dxf-viewer/layout/CanvasSection.tsx` in drawingHandlers callback
   - **Should update:** Parent scene

4. ✅ **Check DxfCanvas receives updated scene prop**
   - **File:** `src/subapps/dxf-viewer/layout/CanvasSection.tsx` line ~800
   - **Should be:** `scene={props.currentScene}`

---

## Problem: Coordinates are NaN

### Checklist:

1. ✅ **Check canvas element access**
   - **File:** `src/subapps/dxf-viewer/layout/CanvasSection.tsx` line 597
   - **Should be:** `dxfCanvasRef.current?.getCanvas()`
   - **NOT:** `dxfCanvasRef.current`

2. ✅ **Check screenToWorld parameters**
   - `canvasWidth`/`canvasHeight` must be valid numbers
   - `transform` must have valid values

---

## Problem: Infinite loop / Browser freeze

### Checklist:

1. ✅ **Check useEffect dependencies**
   - **File:** `src/subapps/dxf-viewer/layout/CanvasSection.tsx` line 268
   - **Should use:** `drawingHandlersRef` pattern
   - **NOT have:** `drawingHandlers` in deps

---

## Problem: Selection box appears instead of drawing

### Checklist:

1. ✅ **Check isDrawingTool condition**
   - **File:** `src/subapps/dxf-viewer/hooks/mouse/useCentralizedMouseHandlers.ts` line 182
   - **Should exclude:** Drawing tools from selection

---
