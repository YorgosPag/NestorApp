================================================================================
🎯 SNAP RENDERING FIX - Micro Steps (Ελέγχεις εσύ κάθε βήμα)
================================================================================

## 📋 WORKFLOW:
1. Claude κάνει ΕΝΑ micro-change
2. Γιώργος κάνει compile + test
3. Αν OK → Γιώργος παίρνει backup
4. Μετά → Επόμενο micro-step

---

## 🔍 STEP 0: Investigation (ΤΩΡΑ - Πριν αλλάξουμε κώδικα)

**Goal:** Βρες ΠΟΥ και ΠΩΣ καλείται το snap detection

**Tasks:**
```
□ Task 0.1: Βρες που καλείται findSnapPoint
□ Task 0.2: Βρες που περνάει το snapEnabled flag
□ Task 0.3: Δες αν υπάρχει ήδη snap event system
□ Task 0.4: Check existing snap context/hooks
```

**Outcome:** Καταλαβαίνουμε ΤΙ υπάρχει, ΤΙ λείπει

---

## 🔨 STEP 1: Add Snap Detection Hook (Micro-change 1)

**File:** systems/cursor/useCentralizedMouseHandlers.ts

**Change:** ΜΟΝΟ import + hook setup (NO logic yet)

```typescript
// ✅ ADD: Import snap manager
import { useSnapManager } from '../../snapping/hooks/useSnapManager';

// Inside useCentralizedMouseHandlers function:
const { findSnapPoint } = useSnapManager(canvasRef, {
  scene,
  onSnapPoint: () => {}
});

// TODO: Use findSnapPoint in next step
```

**Test:** Γιώργος κάνει compile - should work (no runtime changes)

---

## 🔨 STEP 2: Add Snap Results State (Micro-change 2)

**File:** systems/cursor/useCentralizedMouseHandlers.ts

**Change:** ΜΟΝΟ state (NO snap detection logic)

```typescript
import { useState } from 'react';

// Inside hook:
const [snapResults, setSnapResults] = useState<any[]>([]);

// Return snapResults
return {
  ...existingReturns,
  snapResults  // ✅ NEW: Expose (empty for now)
};
```

**Test:** Γιώργος compile + check console - snapResults exists but []

---

## 🔨 STEP 3: Call Snap Detection (Micro-change 3)

**File:** systems/cursor/useCentralizedMouseHandlers.ts

**Change:** ΜΟΝΟ snap detection call in handleMouseMove

```typescript
const handleMouseMove = useCallback((e: MouseEvent, canvas: HTMLCanvasElement) => {
  // ... existing code για screenPos ...

  // ✅ NEW: Call snap detection (if enabled)
  if (snapEnabled && findSnapPoint) {
    try {
      const snap = findSnapPoint(screenPos.x, screenPos.y);

      if (snap && snap.found && snap.snappedPoint) {
        setSnapResults([{
          point: snap.snappedPoint,
          type: snap.type || 'default',
          entityId: snap.entityId,
          distance: snap.distance || 0
        }]);
      } else {
        setSnapResults([]);
      }
    } catch (err) {
      console.warn('Snap detection error:', err);
      setSnapResults([]);
    }
  } else {
    setSnapResults([]);
  }

  // ... rest of existing code ...
}, [snapEnabled, findSnapPoint, /* other deps */]);
```

**Test:** Γιώργος check console - snapResults should have data when hovering

---

## 🔨 STEP 4: Pass to CanvasSection (Micro-change 4)

**File:** components/dxf-layout/CanvasSection.tsx

**Change:** Get snapResults from mouseHandlers

```typescript
// Get snap results from mouse handlers
const mouseHandlers = useCentralizedMouseHandlers({
  scene: null,
  transform,
  viewport,
  // ... other props
});

// ✅ NEW: Destructure snapResults
const { snapResults } = mouseHandlers;

// Later... (NEXT STEP - don't do yet!)
// Will pass to LayerCanvas
```

**Test:** Γιώργος compile + check - no errors

---

## 🔨 STEP 5: Create renderOptions (Micro-change 5)

**File:** components/dxf-layout/CanvasSection.tsx

**Change:** Create renderOptions object

```typescript
// ✅ NEW: Build render options with snap results
const layerRenderOptions = {
  showCrosshair: true,
  showCursor: true,
  showSnapIndicators: true,
  showGrid: true,
  showRulers: true,
  showSelectionBox: true,
  crosshairPosition: cursor.position,
  cursorPosition: cursor.position,
  snapResults: snapResults,  // ✅ REAL DATA!
  selectionBox: null
};
```

**Test:** Γιώργος compile - should work

---

## 🔨 STEP 6: Pass to LayerCanvas (Micro-change 6 - FINAL!)

**File:** components/dxf-layout/CanvasSection.tsx

**Change:** Pass renderOptions prop

```typescript
<LayerCanvas
  ref={overlayCanvasRef}
  layers={colorLayers}
  transform={transform}
  activeTool={activeTool}
  // ... existing props ...
  renderOptions={layerRenderOptions}  // ✅ NEW: Pass render options!
  // ... rest of props ...
/>
```

**Test:** Γιώργος check visual - snap indicators should appear!

---

## ✅ VERIFICATION CHECKLIST

**After each step, Γιώργος checks:**
```
□ npm run build (or tsc) - NO ERRORS
□ npm run dev:fast - Server starts OK
□ Open localhost:3001/dxf/viewer - No console errors
□ (Final step) Hover over entity - Red square appears
```

**If ANY step fails:**
- Γιώργος says "STOP"
- Claude investigates
- Fix issue before next step

---

## 📊 PROGRESS TRACKER

**Current Step:** 0 (Investigation)

```
□ Step 0: Investigation (Claude does this NOW)
□ Step 1: Import + hook setup (micro-change 1)
□ Step 2: Add state (micro-change 2)
□ Step 3: Snap detection logic (micro-change 3)
□ Step 4: Get snapResults (micro-change 4)
□ Step 5: Create renderOptions (micro-change 5)
□ Step 6: Pass to LayerCanvas (micro-change 6)
```

**Estimated Time:** 30-60 λεπτά (6 micro-steps × 5-10 min each)

---

Last Updated: 2025-10-03
Status: Ready for Step 0 (Investigation)
