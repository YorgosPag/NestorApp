# 🚨 COORDINATE SYSTEM ARCHITECTURAL ISSUE

**Date:** 2025-10-01
**Severity:** HIGH - Affects zoom behavior when DXF is loaded
**Status:** IDENTIFIED - Fix in progress

---

## 🔍 PROBLEM SUMMARY

**User Report:**
- When canvas is **EMPTY** → Zoom (+/-, wheel) works PERFECTLY ✅
- When canvas has **DXF loaded** → Zoom behavior is WRONG ❌
  - Zoom center does NOT stay under crosshair
  - Drawing disappears or moves unexpectedly

**Root Cause:**
SEMANTIC CONFUSION in `ViewTransform.offsetX/offsetY` - mixing screen-space and world-space offsets!

---

## 🧩 CURRENT ARCHITECTURE ANALYSIS

### ViewTransform Structure

**From CALIBRATION_SYNC.md (lines 106-109):**
```typescript
interface ViewTransform {
  scale: number;
  offsetX: number;    // Screen X offset (pixels) ← DOCUMENTATION
  offsetY: number;    // Screen Y offset (pixels) ← DOCUMENTATION
}
```

**Documentation says:** `offsetX/offsetY` are **SCREEN OFFSETS** (pixels)

---

### CoordinateTransforms Formulas

**From CoordinateTransforms.ts (lines 29-44):**
```typescript
static worldToScreen(worldPoint: Point2D, transform: ViewTransform, viewport: Viewport): Point2D {
  const { left, top } = COORDINATE_LAYOUT.MARGINS; // left=80, top=30
  return {
    x: left + (worldPoint.x + transform.offsetX) * transform.scale,
    y: (viewport.height - top) - (worldPoint.y + transform.offsetY) * transform.scale
  };
}
```

**Formula says:** `offsetX/offsetY` are **WORLD OFFSETS** (DXF units), NOT screen!

**Proof:**
- If `offsetX` was screen pixels, we'd do: `left + worldPoint.x * scale + offsetX`
- But we do: `left + (worldPoint.x + offsetX) * scale`
- This means `offsetX` is ADDED TO world coordinates BEFORE scaling!

---

### FitToViewService Implementation

**From FitToViewService.ts (lines 125-146):**
```typescript
if (alignToOrigin) {
  // 🎯 ENTERPRISE FIT-TO-VIEW: Position world (0,0) at bottom-left corner
  // CRITICAL: offsetX/offsetY are WORLD SPACE offsets, not screen coordinates!
  offsetX = 0;
  offsetY = 0;

  console.log('World (0,0) will appear at bottom-left ruler intersection');
}
```

**Code says:** `offsetX/offsetY` are **WORLD OFFSETS**

---

## 🔥 THE CONTRADICTION

| Source | Interpretation | Evidence |
|--------|---------------|----------|
| **CALIBRATION_SYNC.md** | Screen offsets (pixels) | Documentation comment |
| **CoordinateTransforms.ts** | World offsets (DXF units) | Mathematical formula |
| **FitToViewService.ts** | World offsets (DXF units) | Implementation logic |
| **Zoom formulas** | MIXED (confusion!) | Uses both interpretations |

**Result:** Zoom works when empty (no DXF), breaks when DXF loads!

---

## 🎯 WHY IT WORKS WHEN EMPTY

When canvas is empty:
1. No DXF scene → No bounds → No fit-to-view
2. Initial transform: `{ scale: 1, offsetX: 0, offsetY: 0 }`
3. Zoom formula: Uses screen coordinates directly
4. No rulers visible → margins = 0 (effectively)
5. Everything is consistent!

---

## 🎯 WHY IT BREAKS WITH DXF

When DXF loads:
1. Auto fit-to-view runs with `alignToOrigin=true`
2. Sets `offsetX=0, offsetY=0` (thinking they are WORLD offsets)
3. Rulers appear → margins = {left: 80, top: 30}
4. Mouse coordinates are canvas-relative (0-based from canvas edge)
5. Zoom formula expects screen coordinates WITH margins
6. **MISMATCH!** → Zoom center calculation is WRONG!

---

## 📐 COORDINATE SPACES INVOLVED

### 1. Canvas-Relative Coordinates
- Origin: Top-left corner of canvas element
- Range: [0, canvas.width] x [0, canvas.height]
- Source: `e.clientX - rect.left`, `e.clientY - rect.top`
- Used in: Mouse event handlers

### 2. Viewport Coordinates (with margins)
- Origin: Top-left corner of viewport (including ruler space)
- Range: [0, viewport.width] x [0, viewport.height]
- Margins: left=80px (vertical ruler), top=30px (horizontal ruler)
- Used in: CoordinateTransforms formulas

### 3. Screen Coordinates (drawing area)
- Origin: Top-left of drawing area (after rulers)
- Range: [80, viewport.width] x [30, viewport.height-30]
- Used in: Rendering operations

### 4. World Coordinates (DXF space)
- Origin: Bottom-left (CAD standard, Y-axis up)
- Range: Unbounded (DXF drawing units)
- Used in: Entity geometry, DXF data

---

## 🔧 ZOOM FORMULA ANALYSIS

**From calculations.ts (lines 16-28):**
```typescript
export function calculateZoomTransform(
  currentTransform: ViewTransform,
  newScale: number,
  center: Point2D
): ViewTransform {
  const scaleFactor = newScale / currentTransform.scale;

  return {
    scale: newScale,
    offsetX: center.x - (center.x - currentTransform.offsetX) * scaleFactor,
    offsetY: center.y - (center.y - currentTransform.offsetY) * scaleFactor
  };
}
```

**What does this formula mean?**

If `offsetX/offsetY` are **SCREEN offsets**:
- `center` = screen coordinates
- Formula: "Keep screen point `center` fixed during zoom"
- Math: `newOffsetX = center.x - (center.x - oldOffsetX) * scaleFactor`
- **This is CORRECT for screen offsets!**

If `offsetX/offsetY` are **WORLD offsets**:
- This formula is **WRONG**!
- Mixing screen coordinates (`center`) with world offsets (`offsetX`)
- Should convert center to world first, then calculate

---

## 🚨 THE ARCHITECTURAL PROBLEM

**The zoom formula ASSUMES screen offsets, BUT:**
- CoordinateTransforms uses them as WORLD offsets
- FitToViewService sets them as WORLD offsets
- Documentation claims they are SCREEN offsets

**This creates an INCONSISTENT system where:**
- Zoom works with one semantic (screen)
- Coordinate transforms work with another (world)
- When both are active (DXF loaded + zooming) → CONFLICT!

---

## ✅ THE SOLUTION

### Option A: Make offsetX/offsetY SCREEN offsets (Recommended)

**Changes needed:**
1. Fix `CoordinateTransforms.worldToScreen`:
   ```typescript
   x: left + worldPoint.x * scale + offsetX  // offsetX is screen pixels
   ```

2. Fix `CoordinateTransforms.screenToWorld`:
   ```typescript
   x: (screenPoint.x - left - offsetX) / scale  // offsetX is screen pixels
   ```

3. Fix `FitToViewService` to calculate screen offsets:
   ```typescript
   if (alignToOrigin) {
     // Position world (0,0) at screen (left, height-bottom)
     offsetX = left;  // 80px (ruler width)
     offsetY = viewport.height - bottom;  // Screen Y of world (0,0)
   }
   ```

**Pros:**
- Consistent with documentation
- Zoom formula works as-is
- Clear semantic separation

**Cons:**
- Need to update FitToViewService logic
- Need to update CoordinateTransforms formulas

---

### Option B: Make offsetX/offsetY WORLD offsets

**Changes needed:**
1. Fix zoom formula to convert center to world first
2. Update documentation
3. Keep CoordinateTransforms as-is

**Pros:**
- Less code changes
- CoordinateTransforms stays same

**Cons:**
- Zoom formula becomes more complex
- Counter-intuitive (offsets usually screen-space in graphics)
- Documentation needs update

---

## 🎯 RECOMMENDED APPROACH: Option A

**Why:**
1. Screen offsets are industry standard in graphics programming
2. Zoom formula is simpler and more intuitive
3. Aligns with documentation
4. Clearer semantic separation of concerns

**Implementation Plan:**
1. Fix CoordinateTransforms formulas (worldToScreen, screenToWorld)
2. Fix FitToViewService to calculate screen offsets
3. Test with empty canvas (should still work)
4. Test with DXF loaded (should now work)
5. Update any other code that depends on offset semantics

---

## 📝 FILES THAT NEED CHANGES

### Priority 1 (Core)
1. `rendering/core/CoordinateTransforms.ts` - Fix formulas
2. `services/FitToViewService.ts` - Fix offset calculations
3. `systems/zoom/utils/calculations.ts` - Verify zoom formula

### Priority 2 (Verify)
4. `systems/zoom/ZoomManager.ts` - Verify assumptions
5. `components/dxf-layout/CanvasSection.tsx` - Verify auto-fit
6. `CALIBRATION_SYNC.md` - Update if needed

### Priority 3 (Test)
7. Manual testing with empty canvas
8. Manual testing with DXF loaded
9. Test zoom (+/-, wheel) in both cases
10. Test fit-to-view (Shift+1)

---

## 🔍 ADDITIONAL FINDINGS

### Mouse Coordinate Flow

**When canvas is EMPTY:**
1. LayerCanvas receives mouse event
2. `useCentralizedMouseHandlers.handleMouseMove`
3. `screenPos = { x: e.clientX - rect.left, y: e.clientY - rect.top }`
4. Passed to zoom system
5. Zoom formula uses screenPos directly
6. **Works!** (no DXF, no fit-to-view, offsets = 0)

**When DXF is LOADED:**
1. Both LayerCanvas AND DxfCanvas active
2. LayerCanvas on top (z-index: 10) receives events
3. Same mouse handler
4. Same screenPos calculation
5. **BUT:** Now offsets ≠ 0 (from fit-to-view)
6. **Conflict:** Zoom formula expects screen offsets, has world offsets
7. **Result:** Wrong zoom behavior!

---

## 🎨 VISUAL EXPLANATION

### Empty Canvas (Working)
```
┌─────────────────────────────────────┐
│ Canvas (no rulers)                  │
│                                     │
│  Mouse (100, 100) ←─ Canvas relative
│  ↓                                  │
│  screenPos = (100, 100)             │
│  ↓                                  │
│  Zoom formula:                      │
│    offsetX = 100 - (100 - 0) * f    │
│    = 100 - 100f                     │
│  ↓                                  │
│  ✅ Center stays at (100, 100)      │
│                                     │
└─────────────────────────────────────┘
```

### DXF Loaded (Broken)
```
┌─────────────────────────────────────┐
│ Ruler (80px) │ Canvas               │
│─────────────┼─────────────────────  │
│   Ruler     │                       │
│   (30px)    │  Mouse (150, 120)     │
├─────────────┤  ↓ Canvas relative    │
│             │  screenPos = (150,120)│
│  Drawing    │  ↓ BUT!               │
│  Area       │  offsetX = 0 (world!) │
│             │  ↓                     │
│             │  Zoom formula:        │
│             │    offsetX = 150 -    │
│             │      (150 - 0) * f    │
│             │    = 150(1-f)         │
│             │  ↓                    │
│             │  ❌ WRONG! Should be  │
│             │     accounting for    │
│             │     ruler offset (80) │
└─────────────┴───────────────────────┘
```

---

## 🚀 NEXT STEPS

1. ✅ Create this analysis document
2. ⏳ Implement Option A fixes
3. ⏳ Test thoroughly
4. ⏳ Update documentation if needed
5. ⏳ Add regression tests

---

## 📚 REFERENCES

- `CALIBRATION_SYNC.md` - Coordinate system documentation
- `CoordinateTransforms.ts` - Transform formulas
- `FitToViewService.ts` - Fit-to-view logic
- `calculations.ts` - Zoom calculations
- `useCentralizedMouseHandlers.ts` - Mouse event handling

---

**End of Analysis**
