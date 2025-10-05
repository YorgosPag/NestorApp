# Line Drawing System - Implementation Guide

**Part of:** [Line Drawing System Documentation](README.md)
**Last Updated:** 2025-10-05
**Focus:** Exact code changes to connect settings

---

## 📚 Navigation

| Document | Purpose |
|----------|---------|
| [← README](README.md) | Documentation index & quick start |
| [architecture.md](architecture.md) | Core architecture & dual canvas |
| [coordinates-events.md](coordinates-events.md) | Coordinate systems & mouse events |
| [rendering-dependencies.md](rendering-dependencies.md) | Rendering pipeline & file dependencies |
| [status-report.md](status-report.md) | Current implementation status |
| [root-cause.md](root-cause.md) | Why settings were never applied |
| [lifecycle.md](lifecycle.md) | Preview/Completion phases |
| **[implementation.md](implementation.md)** | **← YOU ARE HERE** |
| [testing.md](testing.md) | Test scenarios & verification |

---

## 🎯 IMPLEMENTATION SUMMARY

**File to Modify:** `src/subapps/dxf-viewer/hooks/drawing/useUnifiedDrawing.ts`

**Changes Required:**
- ✅ 1 import statement
- ✅ 2 hook declarations
- ✅ 9 property assignments (preview)
- ✅ 9 property assignments (completion)
- ✅ 2 dependency array updates

**Total:** ~18 lines in 1 file
**Estimated Time:** 15 minutes
**Risk:** Low (additive changes only)

---

## 📝 CHANGE 1: Import Settings Hook

**Location:** Line ~10 (after existing imports)

**Add:**
```typescript
import { useEntityStyles } from '../useEntityStyles';
```

**Full Context:**
```typescript
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { DrawingToolType, Point2D, AnySceneEntity } from '../../types';
import { calculateDistance } from '../../utils/calculations';
import { useEntityStyles } from '../useEntityStyles'; // ✅ ADD THIS LINE
```

---

## 📝 CHANGE 2: Get Settings for Both Phases

**Location:** Line ~31 (inside useUnifiedDrawing function, after state declaration)

**Add:**
```typescript
// Get entity styles for preview and completion phases
const linePreviewStyles = useEntityStyles('line', 'preview');
const lineCompletionStyles = useEntityStyles('line', 'completion');
```

**Full Context:**
```typescript
export function useUnifiedDrawing(onEntityCreated?: (entity: any) => void) {
  const { currentLevelId, getLevelScene, setLevelScene } = useLevels();
  const { setMode } = useDrawingMode();

  // ✅ ADD THESE LINES:
  // Get entity styles for preview and completion phases
  const linePreviewStyles = useEntityStyles('line', 'preview');
  const lineCompletionStyles = useEntityStyles('line', 'completion');

  const [state, setState] = useState<DrawingState>({
    mode: 'idle',
    isDrawing: false,
    currentTool: null,
    tempPoints: [],
    previewEntity: null
  });

  // ... rest of function
```

**Why TWO hooks?** Preview and completion use different settings (dashed vs solid, etc.).

---

## 📝 CHANGE 3: Apply Preview Settings

**Location:** Line ~377 (inside updatePreview callback)

**Current Code:**
```typescript
if (previewEntity && (state.currentTool === 'line' || ...)) {
  (previewEntity as any).preview = true;
  (previewEntity as any).showEdgeDistances = true;
  (previewEntity as any).showPreviewGrips = true;
  // ... grips creation
}
```

**Modified Code:**
```typescript
if (previewEntity && (state.currentTool === 'line' || ...)) {
  // Mark as preview
  (previewEntity as any).preview = true;
  (previewEntity as any).showEdgeDistances = true;
  (previewEntity as any).showPreviewGrips = true;

  // ✅ ADD: Apply preview settings
  (previewEntity as any).color = linePreviewStyles.settings.color;
  (previewEntity as any).lineweight = linePreviewStyles.settings.lineWidth;
  (previewEntity as any).opacity = linePreviewStyles.settings.opacity;
  (previewEntity as any).lineType = linePreviewStyles.settings.lineType;
  (previewEntity as any).dashScale = linePreviewStyles.settings.dashScale;
  (previewEntity as any).lineCap = linePreviewStyles.settings.lineCap;
  (previewEntity as any).lineJoin = linePreviewStyles.settings.lineJoin;
  (previewEntity as any).dashOffset = linePreviewStyles.settings.dashOffset;
  (previewEntity as any).breakAtCenter = linePreviewStyles.settings.breakAtCenter;

  // ... grips creation (existing code)
}
```

---

## 📝 CHANGE 4: Apply Completion Settings

**Location:** Line ~270 (inside addPoint callback)

**Current Code:**
```typescript
if (isComplete(state.currentTool, newTempPoints)) {
  const newEntity = createEntityFromTool(state.currentTool, newTempPoints);

  if (newEntity && currentLevelId) {
    const scene = getLevelScene(currentLevelId);
    if (scene) {
      const updatedScene = { ...scene, entities: [...scene.entities, newEntity] };
      setLevelScene(currentLevelId, updatedScene);
    }
  }

  setMode('normal');
  setState(prev => ({ ...prev, tempPoints: [], previewEntity: null }));
}
```

**Modified Code:**
```typescript
if (isComplete(state.currentTool, newTempPoints)) {
  const newEntity = createEntityFromTool(state.currentTool, newTempPoints);

  if (newEntity && currentLevelId) {
    // ✅ ADD: Apply completion settings (NOT preview settings!)
    (newEntity as any).color = lineCompletionStyles.settings.color;
    (newEntity as any).lineweight = lineCompletionStyles.settings.lineWidth;
    (newEntity as any).opacity = lineCompletionStyles.settings.opacity;
    (newEntity as any).lineType = lineCompletionStyles.settings.lineType;
    (newEntity as any).dashScale = lineCompletionStyles.settings.dashScale;
    (newEntity as any).lineCap = lineCompletionStyles.settings.lineCap;
    (newEntity as any).lineJoin = lineCompletionStyles.settings.lineJoin;
    (newEntity as any).dashOffset = lineCompletionStyles.settings.dashOffset;
    (newEntity as any).breakAtCenter = lineCompletionStyles.settings.breakAtCenter;

    const scene = getLevelScene(currentLevelId);
    if (scene) {
      const updatedScene = { ...scene, entities: [...scene.entities, newEntity] };
      setLevelScene(currentLevelId, updatedScene);
    }
  }

  setMode('normal');
  setState(prev => ({ ...prev, tempPoints: [], previewEntity: null }));
}
```

**CRITICAL:** Use `lineCompletionStyles` (NOT `linePreviewStyles`) for final entity!

---

## 📝 CHANGE 5: Update Dependency Arrays

**Location 1:** Line ~235 (createEntityFromTool useCallback)
**Location 2:** Line ~338 (addPoint useCallback)
**Location 3:** Line ~416 (updatePreview useCallback)

**Add to dependency arrays:**
```typescript
}, [
  // ... existing dependencies
  linePreviewStyles.settings,      // ✅ ADD
  lineCompletionStyles.settings    // ✅ ADD
]);
```

**Example - updatePreview callback:**
```typescript
const updatePreview = useCallback((worldPoint: Point2D, snappedPoint: Point2D) => {
  // ... function body
}, [
  state,
  createEntityFromTool,
  linePreviewStyles.settings,      // ✅ ADD THIS
  lineCompletionStyles.settings    // ✅ ADD THIS
]);
```

**Why This Matters:** If user changes settings in ColorPalettePanel, preview/completion appearance updates immediately!

---

## ✅ VERIFICATION CHECKLIST

### Before Implementation

- [ ] Read [status-report.md](status-report.md) - Understand current state
- [ ] Read [root-cause.md](root-cause.md) - Understand why this is needed
- [ ] Read [lifecycle.md](lifecycle.md) - Understand preview/completion phases
- [ ] Backup `useUnifiedDrawing.ts` file

### During Implementation

- [ ] Change 1: Import `useEntityStyles` ✅
- [ ] Change 2: Declare `linePreviewStyles` and `lineCompletionStyles` ✅
- [ ] Change 3: Apply preview settings in `updatePreview()` ✅
- [ ] Change 4: Apply completion settings in `addPoint()` ✅
- [ ] Change 5: Update dependency arrays (3 locations) ✅

### After Implementation

- [ ] TypeScript compilation: `npx tsc --noEmit --skipLibCheck`
- [ ] No type errors ✅
- [ ] Run [testing.md](testing.md) test scenarios
- [ ] All 5 test scenarios pass ✅

---

## 🎯 EXPECTED BEHAVIOR AFTER CHANGES

### Test Scenario

**Setup:**
1. Open ColorPalettePanel → DXF Settings → Ειδικές
2. Set Preview: Green (#00FF00), Dashed, 70% opacity
3. Set Completion: White (#FFFFFF), Solid, 100% opacity

**Drawing a Line:**

**Step 1:** Click "Line" button
- Expected: Tool activated ✅

**Step 2:** First click on canvas
- Expected:
  - Green dashed line follows cursor ✅
  - 70% transparent ✅
  - 2 grips visible (start + cursor) ✅
  - Distance label in middle ✅

**Step 3:** Second click on canvas
- Expected:
  - Line changes to white, solid, 100% opacity ✅
  - Grips disappear ✅
  - Distance label disappears ✅
  - Line persists in scene ✅

**Step 4:** Refresh browser (F5)
- Expected:
  - Line still visible ✅
  - Line still white, solid, 100% opacity ✅

---

## ⚠️ COMMON PITFALLS

### Pitfall 1: Using Wrong Settings for Completion

```typescript
// ❌ WRONG: Using preview settings for final entity
(completedEntity as any).color = linePreviewStyles.settings.color; // BUG!

// ✅ CORRECT: Using completion settings for final entity
(completedEntity as any).color = lineCompletionStyles.settings.color;
```

**Why:** Preview uses dashed/semi-transparent. Final entity would look wrong!

---

### Pitfall 2: Forgetting Dependency Arrays

```typescript
// ❌ WRONG: Missing settings in dependencies
const updatePreview = useCallback(() => {
  entity.color = linePreviewStyles.settings.color;
}, []); // BUG! Settings changes won't trigger update

// ✅ CORRECT: Include settings in dependencies
const updatePreview = useCallback(() => {
  entity.color = linePreviewStyles.settings.color;
}, [linePreviewStyles.settings]);
```

**Why:** User changes settings → preview doesn't update!

---

### Pitfall 3: Applying Settings to Wrong Entity Type

```typescript
// ❌ WRONG: Applying line settings to circle
const circleEntity = createEntityFromTool('circle', points);
(circleEntity as any).color = linePreviewStyles.settings.color; // BUG!

// ✅ CORRECT: Use circle settings for circle
const circlePreviewStyles = useEntityStyles('circle', 'preview');
(circleEntity as any).color = circlePreviewStyles.settings.color;
```

**Why:** Different entity types have different settings!

---

## 🔗 NEXT STEPS

**After Implementation:**
- **[testing.md](testing.md)** - Run all 5 test scenarios to verify

**If Issues:**
- Check console for errors
- Verify TypeScript compilation passes
- Compare your code with this guide

**Previous:**
- **[← lifecycle.md](lifecycle.md)** - Preview/Completion phases explained

---

**Last Updated:** 2025-10-05
**Part of:** Line Drawing System Documentation
**Next:** [Testing & Verification →](testing.md)
