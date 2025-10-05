# 🎛️ Settings & Flags

---

**📚 Part of:** [LINE_DRAWING_SYSTEM.md](../../LINE_DRAWING_SYSTEM.md)
**📂 Documentation Hub:** [README.md](README.md)
**🔗 Related Docs:** [configuration.md](configuration.md), [implementation.md](implementation.md), [lifecycle.md](lifecycle.md)

---

**Last Updated:** 2025-10-05
**Status:** ✅ WORKING (After 6 critical bug fixes)

---

## Debug Flags

### useDrawingHandlers.ts

```typescript
const DEBUG_DRAWING_HANDLERS = true; // Enable debug logs
```

**File:** `src/subapps/dxf-viewer/hooks/drawing/useDrawingHandlers.ts`

**What it logs:**
- Drawing handler creation
- Entity creation callbacks
- Tool activation/deactivation

---

### useUnifiedDrawing.ts

```typescript
const DEBUG_DRAWING = true; // Enable debug logs
```

**File:** `src/subapps/dxf-viewer/hooks/drawing/useUnifiedDrawing.ts`

**What it logs:**
- Point additions
- Entity completion
- Level scene updates
- Drawing state changes

---

## Tool Detection

```typescript
// Drawing tools that need special handling:
const isDrawingTool =
  activeTool === 'line' ||
  activeTool === 'polyline' ||
  activeTool === 'polygon' ||
  activeTool === 'circle' ||
  activeTool === 'rectangle' ||
  activeTool === 'arc';
```

**Used in:**
- `src/subapps/dxf-viewer/layout/CanvasSection.tsx` (lines 268, 871)
- `src/subapps/dxf-viewer/hooks/mouse/useCentralizedMouseHandlers.ts` (line 182)

**Purpose:**
- Controls LayerCanvas `pointerEvents` (line 871)
- Prevents selection box when drawing (line 182)
- Manages drawing handler lifecycle (line 268)

---

## Entity Completion Rules

```typescript
// From useUnifiedDrawing.ts
function isComplete(tool: DrawingToolType, points: Point2D[]): boolean {
  switch (tool) {
    case 'line':
      return points.length === 2; // Need 2 points
    case 'circle':
      return points.length === 2; // Center + radius point
    case 'rectangle':
      return points.length === 2; // Opposite corners
    case 'arc':
      return points.length === 3; // Start, middle, end
    case 'polyline':
    case 'polygon':
      return false; // Finished by double-click
    default:
      return false;
  }
}
```

**File:** `src/subapps/dxf-viewer/hooks/drawing/useUnifiedDrawing.ts`

**How it works:**
- Called after each point added
- Returns `true` when entity has enough points
- Triggers entity creation when `true`
- Polyline/Polygon never auto-complete (need explicit finish action like double-click)

---
