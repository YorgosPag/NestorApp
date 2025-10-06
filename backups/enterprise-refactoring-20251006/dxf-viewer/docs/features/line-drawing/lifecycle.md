# Line Drawing System - Entity Drawing Lifecycle

---

**📚 Part of:** [LINE_DRAWING_SYSTEM.md](../../LINE_DRAWING_SYSTEM.md)
**📂 Documentation Hub:** [README.md](README.md)
**🔗 Related Docs:** [architecture.md](architecture.md), [implementation.md](implementation.md), [testing.md](testing.md)

---

**Last Updated:** 2025-10-05
**Focus:** Preview & Completion phases (Enterprise CAD Standard)

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
| **[lifecycle.md](lifecycle.md)** | **← YOU ARE HERE** |
| [implementation.md](implementation.md) | Code changes needed |
| [testing.md](testing.md) | Test scenarios & verification |

---

## 🎯 THE THREE-PHASE DRAWING SYSTEM

**Enterprise Standard:** Professional CAD applications implement multi-phase rendering for real-time visual feedback.

**Phases:**
1. **Preview Phase** (Προσχεδίαση) - Dynamic drawing (1st click → 2nd click)
2. **Completion Phase** (Ολοκλήρωση) - Final entity (after 2nd click)
3. **Hover Phase** (Interaction) - *Separate system, not covered here*

---

## 📐 PHASE 1: PREVIEW PHASE

### Definition

**Preview Phase:** Interactive period from **first click** until **final click** where the entity is being actively drawn.

**Duration:**
- Start: First mouse click (first point placed)
- End: Final click completing entity (e.g., 2nd click for line)

**Purpose:** Real-time visual feedback showing:
- Entity being created
- Current dimensions/measurements
- Snap points and constraints
- Construction geometry (grips, guides, distance labels)

### Visual Components

#### 1. Dynamic Entity Geometry

**Example - Line:**
```
1. Click "Line" button → Tool activated
2. First click at point A → Preview starts
3. Move mouse → Dynamic line from A to cursor
4. Second click at point B → Preview ends
```

**Rendering:**
- Entity follows cursor (60 FPS update)
- Geometry updates on mouse move
- Uses **Preview Settings** from ColorPalettePanel

#### 2. Construction Grips

**Behavior:**
```
First Click:
├─ Grip #1: Fixed at click point (brown dot)
└─ Grip #2: Follows cursor (brown dot)
```

**Code Reference:** `useUnifiedDrawing.ts:474-478`
```typescript
(previewEntity as any).previewGripPoints = [
  { position: worldPoints[0], type: 'start' },
  { position: snappedPoint, type: 'cursor' }
];
```

**Visual:** 4-6px brown/orange circles (#CD853F - AutoCAD standard)

#### 3. Dynamic Distance Labels

**Example:**
```
Point A ●━━━━━━━━━━━ 156.23 ━━━━━━━━━━━● Cursor
         ↑                           ↑
      Grip #1                     Grip #2
```

**Behavior:**
- Position: Line midpoint (breaks line visually)
- Content: Distance in current units
- Update: Every mouse move (real-time)

#### 4. Snap Indicators

**Visual Feedback:**
- Snap marker: Geometric symbol (square, triangle, X)
- Snap tooltip: "Endpoint", "Midpoint", "Intersection"
- Magnetic effect: Cursor snaps to detected point

### Settings Source

**Priority:**
1. **Ειδικές Ρυθμίσεις → Preview** (if set)
2. **Γενικές Ρυθμίσεις** (fallback)

**Example Settings:**
```typescript
{
  color: '#00FF00',           // Green preview
  lineWidth: 1.5,             // Thicker for visibility
  opacity: 0.7,               // Semi-transparent
  lineType: 'dashed',         // Dashed preview
  breakAtCenter: true         // For distance label
}
```

### Lifecycle

```
┌─────────────────────────────────────────────┐
│ PREVIEW PHASE LIFECYCLE                     │
├─────────────────────────────────────────────┤
│                                              │
│ 1. Tool Activation                           │
│    └─ Click "Line" button                    │
│    └─ useUnifiedDrawing.startDrawing('line') │
│    └─ setMode('preview')                     │
│                                              │
│ 2. First Click (Preview Starts)             │
│    └─ Click at point A                       │
│    └─ Grip #1 at point A                    │
│    └─ state.tempPoints = [A]                │
│                                              │
│ 3. Mouse Movement (60 FPS)                  │
│    └─ updatePreview(cursorPos)               │
│    └─ Grip #2 follows cursor                │
│    └─ Line: A → cursor                      │
│    └─ Distance label updates                │
│    └─ Snap detection                        │
│    └─ Re-render with Preview Settings       │
│                                              │
│ 4. Second Click (Preview Ends)              │
│    └─ Click at point B                       │
│    └─ addPoint(B) called                    │
│    └─ isComplete('line', [A,B]) → true      │
│    └─ Preview Phase ends                    │
│    └─ Completion Phase begins               │
│                                              │
└─────────────────────────────────────────────┘
```

---

## ✅ PHASE 2: COMPLETION PHASE

### Definition

**Completion Phase:** State **after** entity has been fully drawn and added to scene.

**Duration:**
- Start: Final click completing entity
- End: Permanent (until deleted/modified)

**Purpose:** Render final, persistent entity with intended appearance.

### Visual Components

#### 1. Final Entity Geometry

**Rendering:**
- Static (no cursor following)
- No construction geometry
- No distance labels
- Uses **Completion Settings** from UI

**Example:**
```
Before Completion (Preview):
  ● ━━━━━━ 156.23 ━━━━━━ ●  (Dashed, green, 70% opacity)
  ↑                       ↑
Grip #1               Grip #2

After Completion:
  ━━━━━━━━━━━━━━━━━━━━━━  (Solid, white, 100% opacity)
  (No grips, no label)
```

#### 2. Entity Persistence

**Storage:**
```typescript
const updatedScene = {
  ...scene,
  entities: [...scene.entities, completedEntity]
};
setLevelScene(currentLevelId, updatedScene);
```

**Lifecycle:** Entity remains until deleted/modified/scene cleared.

#### 3. Selectable/Editable State

**After Completion:**
- Selection (click to select) ✅
- Hover highlighting ✅
- Grip editing ✅
- Property editing ✅

### Settings Source

**Priority:**
1. **Ειδικές Ρυθμίσεις → Completion** (if set)
2. **Γενικές Ρυθμίσεις** (fallback)

**Example Settings:**
```typescript
{
  color: '#FFFFFF',           // White final line
  lineWidth: 1.0,             // Standard thickness
  opacity: 1.0,               // Fully opaque
  lineType: 'solid',          // Solid line
  breakAtCenter: false        // No label in final
}
```

### Lifecycle

```
┌─────────────────────────────────────────────┐
│ COMPLETION PHASE LIFECYCLE                   │
├─────────────────────────────────────────────┤
│                                              │
│ 1. Entity Finalization                       │
│    └─ Final click (point B)                  │
│    └─ createEntityFromTool('line', [A,B])    │
│    └─ Apply Completion Settings              │
│    └─ Remove preview flags                   │
│                                              │
│ 2. Scene Integration                         │
│    └─ Add to scene.entities[]               │
│    └─ Save to level state                   │
│    └─ setMode('normal')                     │
│                                              │
│ 3. Persistence                               │
│    └─ Store in Firestore                    │
│    └─ Save to localStorage                  │
│    └─ Visible until deleted                 │
│                                              │
│ 4. Post-Completion Capabilities             │
│    └─ Selectable (click to select)          │
│    └─ Editable (show grips)                 │
│    └─ Inspectable (properties panel)        │
│    └─ Deletable (delete key)                │
│                                              │
└─────────────────────────────────────────────┘
```

---

## 🔄 PHASE TRANSITION: PREVIEW → COMPLETION

### The Critical Moment (16.67ms @ 60 FPS)

**7-Step Process:**

```typescript
// Step 1: Detect completion
if (isComplete(state.currentTool, newTempPoints)) {

  // Step 2: Create entity with COMPLETION settings
  const newEntity = createEntityFromTool(tool, points);

  // Step 3: Apply Completion Settings
  const completionStyles = useEntityStyles('line', 'completion');
  newEntity.color = completionStyles.settings.color;
  newEntity.lineweight = completionStyles.settings.lineWidth;
  // ...

  // Step 4: Remove preview flags
  delete (newEntity as any).preview;
  delete (newEntity as any).showEdgeDistances;
  delete (newEntity as any).showPreviewGrips;

  // Step 5: Add to scene
  const updatedScene = { ...scene, entities: [...scene.entities, newEntity] };
  setLevelScene(currentLevelId, updatedScene);

  // Step 6: Exit preview mode
  setMode('normal');

  // Step 7: Reset state
  setState(prev => ({ ...prev, tempPoints: [], previewEntity: null }));
}
```

**User Perception:** Instantaneous transition (no flicker).

---

## 📊 SETTINGS MATRIX: PREVIEW vs COMPLETION

| Setting | Preview | Completion | Reason |
|---------|---------|------------|--------|
| **color** | `#00FF00` (Green) | `#FFFFFF` (White) | Visual distinction |
| **lineWidth** | `1.5` | `1.0` | Preview thicker |
| **opacity** | `0.7` (70%) | `1.0` (100%) | Preview semi-transparent |
| **lineType** | `'dashed'` | `'solid'` | Preview dashed |
| **breakAtCenter** | `true` | `false` | Preview has label |
| **showPreviewGrips** | `true` | `false` | Grips only during drawing |
| **showEdgeDistances** | `true` | `false` | Distance only during drawing |

### Settings Inheritance Flow

```
User Opens ColorPalettePanel
  └─ DXF Settings tab
      ├─ Γενικές Ρυθμίσεις (General)
      └─ Ειδικές Ρυθμίσεις (Specific)
          ├─ Preview Mode
          └─ Completion Mode

Settings Application:
┌─────────────────────────────────────────┐
│ For Preview Entity:                      │
│   1. Check: Ειδικές → Preview exists?    │
│      ├─ YES: Use Ειδικές → Preview       │
│      └─ NO:  Use Γενικές                 │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ For Completed Entity:                    │
│   1. Check: Ειδικές → Completion exists? │
│      ├─ YES: Use Ειδικές → Completion    │
│      └─ NO:  Use Γενικές                 │
└─────────────────────────────────────────┘
```

---

## 🎨 VISUAL COMPARISON

### Preview Phase (While Drawing):
```
┌─────────────────────────────────────────┐
│                                          │
│   ●────────── 156.23 mm ──────────●    │
│   ↑    (dashed, green, 70% opacity) ↑   │
│ Grip #1                         Grip #2 │
│ (brown)                  (brown, cursor)│
│                                          │
│ Properties:                              │
│ - color: '#00FF00' (green)              │
│ - lineType: 'dashed'                     │
│ - opacity: 0.7                           │
│ - breakAtCenter: true                   │
│ - showPreviewGrips: true                │
│ - showEdgeDistances: true               │
└─────────────────────────────────────────┘
```

### Completion Phase (After Click):
```
┌─────────────────────────────────────────┐
│                                          │
│   ──────────────────────────────────    │
│        (solid, white, 100% opacity)      │
│                                          │
│   (No grips, no distance label)         │
│                                          │
│ Properties:                              │
│ - color: '#FFFFFF' (white)              │
│ - lineType: 'solid'                      │
│ - opacity: 1.0                           │
│ - breakAtCenter: false                  │
│ - showPreviewGrips: false (removed)     │
│ - showEdgeDistances: false (removed)    │
└─────────────────────────────────────────┘
```

---

## 🔗 NEXT STEPS

**Implement the System:**
- **[implementation.md](implementation.md)** - Exact code changes needed
- **[testing.md](testing.md)** - How to verify it works

**Previous:**
- **[← root-cause.md](root-cause.md)** - Why settings weren't applied

---

**Last Updated:** 2025-10-05
**Part of:** Line Drawing System Documentation
**Next:** [Implementation Guide →](implementation.md)
