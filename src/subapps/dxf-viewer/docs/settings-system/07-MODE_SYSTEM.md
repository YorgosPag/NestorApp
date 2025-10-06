# CHAPTER 07 - MODE SYSTEM

**DXF Viewer Settings System - Enterprise Documentation**
**Created**: 2025-10-06
**Status**: ✅ Complete
**Author**: Claude Code (Anthropic AI) + Γιώργος Παγώνης

---

## 📋 TABLE OF CONTENTS

1. [Overview](#overview)
2. [ViewerMode Types](#viewermode-types)
3. [Mode Lifecycle](#mode-lifecycle)
4. [Specific Settings Per Mode](#specific-settings-per-mode)
5. [User Overrides System](#user-overrides-system)
6. [Effective Settings Calculation](#effective-settings-calculation)
7. [Mode Switching Logic](#mode-switching-logic)
8. [Phase Manager Integration](#phase-manager-integration)

---

## 1. OVERVIEW

### Τι Είναι το Mode System;

Το Mode System επιτρέπει **διαφορετικές ρυθμίσεις** ανά φάση λειτουργίας του DXF Viewer:

```typescript
type ViewerMode = 'normal' | 'preview' | 'completion';
```

**Rationale**: Στο CAD software (AutoCAD, BricsCAD, etc.), οι **construction lines** (preview) έχουν διαφορετική εμφάνιση από τις **final lines** (completion):

| Mode | Purpose | Visual Style | Example |
|------|---------|--------------|---------|
| **normal** | Default view mode | Standard | White solid lines |
| **preview** | Construction/temporary | Dashed, semi-transparent | Yellow dashed 70% opacity |
| **completion** | Final entity | Solid, opaque | Green solid 100% opacity |

---

### Γιατί Χρειάζεται;

**Without Mode System** (Πριν):
```typescript
// ❌ Όλες οι γραμμές με το ίδιο style
const line = {
  color: '#FFFFFF',
  lineType: 'solid',
  opacity: 1.0
};

// Preview line: Λευκή συμπαγής (δεν ξεχωρίζει)
// Final line: Λευκή συμπαγής (ίδια)
// ❌ Δεν ξέρεις ποια είναι temporary και ποια final!
```

**With Mode System** (Τώρα):
```typescript
// ✅ Preview mode
const previewLine = useLineStyles('preview');
// → { color: '#FFFF00', lineType: 'dashed', opacity: 0.7 }

// ✅ Completion mode
const completionLine = useLineStyles('completion');
// → { color: '#00FF00', lineType: 'solid', opacity: 1.0 }

// ✅ Ξεκάθαρη διάκριση!
```

---

## 2. VIEWERMODE TYPES

### Mode Definitions

```typescript
export type ViewerMode = 'normal' | 'preview' | 'completion';
```

---

### Mode: 'normal'

**Purpose**: Default viewing mode (όχι drawing, όχι editing)

**When Active**:
- User is browsing existing entities
- No tools activated
- Pan/Zoom operations
- Entity selection/inspection

**Settings Behavior**:
- Uses **General settings** (Γενικές Ρυθμίσεις)
- No specific or override settings applied

**Example**:
```typescript
setMode('normal');

const lineStyles = useLineStyles('normal');
// → Returns: General line settings (white, solid, 1.0 opacity)
```

---

### Mode: 'preview'

**Purpose**: Construction/temporary entities (κατά τη σχεδίαση)

**When Active**:
- Line tool active, waiting for second point
- Polyline tool active, adding points
- Circle tool active, selecting radius
- Rectangle tool active, selecting second corner
- Any drawing tool showing temporary preview

**Settings Behavior**:
- Uses **General + Specific Preview settings**
- If override enabled, uses **General + Specific Preview + Override Preview**

**Default Settings**:
```typescript
{
  lineType: 'dashed',      // Dashed for temporary
  color: '#FFFF00',        // Yellow (AutoCAD ACI 2)
  opacity: 0.7,            // Semi-transparent
  lineWidth: 1,
  // ... other properties
}
```

**Example**:
```typescript
// User clicks Line tool
setMode('preview');

const lineStyles = useLineStyles('preview');
// → Returns: General + Specific Preview (yellow dashed 70% opacity)

// Apply to preview entity
previewEntity.color = lineStyles.settings.color; // '#FFFF00'
```

---

### Mode: 'completion'

**Purpose**: Final entities (μετά την ολοκλήρωση)

**When Active**:
- Line completed (second click)
- Polyline completed (Enter/double-click)
- Circle completed (radius click)
- Rectangle completed (second corner)
- Any drawing tool completing entity

**Settings Behavior**:
- Uses **General + Specific Completion settings**
- If override enabled, uses **General + Specific Completion + Override Completion**

**Default Settings**:
```typescript
{
  lineType: 'solid',       // Solid for final
  color: '#00FF00',        // Green (AutoCAD ACI 3)
  opacity: 1.0,            // Fully opaque
  lineWidth: 1,
  // ... other properties
}
```

**Example**:
```typescript
// User completes line (second click)
setMode('completion'); // (or stays in preview, but uses completion settings)

const lineStyles = useLineStyles('completion');
// → Returns: General + Specific Completion (green solid 100% opacity)

// Apply to final entity
finalEntity.color = lineStyles.settings.color; // '#00FF00'
```

---

## 3. MODE LIFECYCLE

### Complete Mode Flow (Line Drawing Example)

```
┌──────────────────────────────────────────────────────┐
│  STEP 1: User clicks Line tool                      │
│                                                      │
│  PhaseManager: setPhase('drawing')                  │
│  usePreviewMode: setMode('preview')                 │
│                                                      │
│  Current mode: 'preview' ✅                         │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│  STEP 2: User clicks first point on canvas          │
│                                                      │
│  useUnifiedDrawing: onDrawingPoint(point1)          │
│  tempPoints = [point1]                              │
│                                                      │
│  Mode: Still 'preview' ✅                           │
│  No preview entity yet (need 2 points for line)     │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│  STEP 3: User moves mouse (between clicks)          │
│                                                      │
│  DxfCanvas: handleMouseMove → onMouseMove           │
│  useUnifiedDrawing: updatePreview(mousePos)         │
│                                                      │
│  Create preview entity:                             │
│    previewLine = { start: point1, end: mousePos }   │
│                                                      │
│  Apply preview settings:                            │
│    lineStyles = useLineStyles('preview')            │
│    previewLine.color = '#FFFF00' (yellow)           │
│    previewLine.lineType = 'dashed'                  │
│    previewLine.opacity = 0.7                        │
│                                                      │
│  Mode: 'preview' ✅                                 │
│  Preview entity rendered (yellow dashed) ✅         │
└──────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────┐
│  STEP 4: User clicks second point                   │
│                                                      │
│  useUnifiedDrawing: onDrawingPoint(point2)          │
│  tempPoints = [point1, point2]                      │
│                                                      │
│  Entity completed! Create final entity:             │
│    finalLine = createEntityFromTool('line', points) │
│                                                      │
│  Apply completion settings:                         │
│    lineStyles = useLineStyles('completion')         │
│    finalLine.color = '#00FF00' (green)              │
│    finalLine.lineType = 'solid'                     │
│    finalLine.opacity = 1.0                          │
│                                                      │
│  Add to scene: setLevelScene(levelId, scene)        │
│                                                      │
│  Mode transition: 'preview' → 'normal'              │
│  PhaseManager: setPhase('normal')                   │
│  usePreviewMode: setMode('normal')                  │
│                                                      │
│  Final entity rendered (green solid) ✅             │
└──────────────────────────────────────────────────────┘
```

---

### Mode State Machine

```
         ┌──────────┐
         │  normal  │ ← Default state
         └──────────┘
              ↓
        [User clicks tool]
              ↓
         ┌──────────┐
         │ preview  │ ← Drawing in progress
         └──────────┘
              ↓
    [User completes entity]
              ↓
         ┌──────────┐
         │ normal   │ ← Back to default
         └──────────┘
```

**Note**: Mode can also stay in `preview` during completion, but completion settings are used for the final entity.

---

## 4. SPECIFIC SETTINGS PER MODE

### Structure

```typescript
interface SpecificSettings {
  line: {
    preview?: Partial<LineSettings>;      // Preview-specific overrides
    completion?: Partial<LineSettings>;   // Completion-specific overrides
  };
  text: {
    preview?: Partial<TextSettings>;
  };
  grip: {
    preview?: Partial<GripSettings>;
  };
}
```

---

### Default Specific Settings

**Line - Preview**:
```typescript
specific.line.preview = {
  lineType: 'dashed',      // ✅ ISO 128: Dashed for construction
  color: '#FFFF00',        // ✅ AutoCAD ACI 2: Yellow
  opacity: 0.7,            // ✅ Semi-transparent (70%)
  // Other properties inherited from General
};
```

**Line - Completion**:
```typescript
specific.line.completion = {
  lineType: 'solid',       // ✅ ISO 128: Solid for final
  color: '#00FF00',        // ✅ AutoCAD ACI 3: Green
  opacity: 1.0,            // ✅ Fully opaque (100%)
  // Other properties inherited from General
};
```

**Text - Preview**:
```typescript
specific.text.preview = {
  color: '#FFFF00',        // Yellow for preview text
  opacity: 0.7,
  // Other properties inherited from General
};
```

**Grip - Preview**:
```typescript
specific.grip.preview = {
  showGrips: true,         // Show grips in preview
  opacity: 0.8,
  // Other properties inherited from General
};
```

---

### How to Update Specific Settings

**Via UI (ColorPalettePanel)**:
```
ColorPalettePanel
  → DXF Settings Tab
    → Ειδικές Ρυθμίσεις (Specific)
      → Entities section
        → Preview accordion
          → Line color: Yellow → Change to Red
```

**Via Code**:
```typescript
const { updateSpecificLineSettings } = useDxfSettings();

// Update preview-specific color
updateSpecificLineSettings('preview', {
  color: '#FF0000' // Red
});

// Update completion-specific color
updateSpecificLineSettings('completion', {
  color: '#0000FF' // Blue
});
```

---

## 5. USER OVERRIDES SYSTEM

### What Are Overrides?

**Overrides** = User-defined settings που παρακάμπτουν τα Specific settings.

**Hierarchy**:
```
EFFECTIVE = GENERAL → SPECIFIC → OVERRIDES
              ↑          ↑          ↑
            Base    Mode-based   User preference
```

---

### Override Structure

```typescript
interface OverrideSettings {
  line: {
    preview?: Partial<LineSettings>;
    completion?: Partial<LineSettings>;
  };
  text: {
    preview?: Partial<TextSettings>;
  };
  grip: {
    preview?: Partial<GripSettings>;
  };
}

interface OverrideEnabledFlags {
  line: boolean;    // Are line overrides enabled?
  text: boolean;    // Are text overrides enabled?
  grip: boolean;    // Are grip overrides enabled?
}
```

---

### How Overrides Work

**Without Overrides** (Default):
```typescript
// User changes Specific Preview color to red
updateSpecificLineSettings('preview', { color: '#FF0000' });

// Effective preview settings
const lineStyles = useLineStyles('preview');
// → { color: '#FF0000', ... } (from Specific)
```

**With Overrides Enabled**:
```typescript
// Step 1: Enable line overrides
toggleLineOverride(true);

// Step 2: Set override color to blue
updateLineOverrides('preview', { color: '#0000FF' });

// Effective preview settings
const lineStyles = useLineStyles('preview');
// → { color: '#0000FF', ... } (from Override, not Specific!)
```

---

### Example: Override Flow

```
┌─────────────────────────────────────────────────────┐
│  Initial State (No Overrides)                       │
│                                                     │
│  General: { color: '#FFFFFF' }                     │
│  Specific Preview: { color: '#FFFF00' }            │
│  Overrides: { }                                     │
│  Override Enabled: false                           │
│                                                     │
│  Effective Preview: '#FFFF00' (from Specific) ✅   │
└─────────────────────────────────────────────────────┘
                        ↓
         [User enables line override]
                        ↓
┌─────────────────────────────────────────────────────┐
│  Override Enabled                                   │
│                                                     │
│  General: { color: '#FFFFFF' }                     │
│  Specific Preview: { color: '#FFFF00' }            │
│  Overrides: { }                                     │
│  Override Enabled: true ✅                         │
│                                                     │
│  Effective Preview: '#FFFF00' (still from Specific)│
│  (No override value set yet)                       │
└─────────────────────────────────────────────────────┘
                        ↓
    [User sets override color to red]
                        ↓
┌─────────────────────────────────────────────────────┐
│  Override Active                                    │
│                                                     │
│  General: { color: '#FFFFFF' }                     │
│  Specific Preview: { color: '#FFFF00' }            │
│  Overrides: { preview: { color: '#FF0000' } } ✅   │
│  Override Enabled: true ✅                         │
│                                                     │
│  Effective Preview: '#FF0000' (from Override!) ✅  │
│  (Override takes precedence)                       │
└─────────────────────────────────────────────────────┘
                        ↓
       [User disables line override]
                        ↓
┌─────────────────────────────────────────────────────┐
│  Override Disabled (Back to Specific)               │
│                                                     │
│  General: { color: '#FFFFFF' }                     │
│  Specific Preview: { color: '#FFFF00' }            │
│  Overrides: { preview: { color: '#FF0000' } }      │
│  Override Enabled: false ✅                        │
│                                                     │
│  Effective Preview: '#FFFF00' (from Specific) ✅   │
│  (Override value still saved, but not used)        │
└─────────────────────────────────────────────────────┘
```

---

### When to Use Overrides

**Use Case 1: Personal Preference**
```
Scenario: Γιώργος wants red preview lines, but team standard is yellow.

Solution:
1. Enable line override
2. Set override preview color to red
3. Now Γιώργος sees red previews
4. Team still uses yellow (from Specific)
5. Settings saved to Γιώργος's localStorage
```

**Use Case 2: Project-Specific Settings**
```
Scenario: Project A needs blue completion lines, Project B needs green.

Solution:
1. Enable line override
2. Switch to Project A → Set override completion color to blue
3. Switch to Project B → Set override completion color to green
4. Each project has its own localStorage
```

---

## 6. EFFECTIVE SETTINGS CALCULATION

### Algorithm

```typescript
function getEffectiveLineSettings(mode: ViewerMode): LineSettings {
  // Step 1: Start with General (base layer)
  let effective = { ...state.line };

  // Step 2: Merge Specific (mode-based layer)
  if (mode === 'preview' && state.specific.line.preview) {
    effective = { ...effective, ...state.specific.line.preview };
  } else if (mode === 'completion' && state.specific.line.completion) {
    effective = { ...effective, ...state.specific.line.completion };
  }

  // Step 3: Merge Overrides (top layer, if enabled)
  if (state.overrideEnabled.line) {
    if (mode === 'preview' && state.overrides.line.preview) {
      effective = { ...effective, ...state.overrides.line.preview };
    } else if (mode === 'completion' && state.overrides.line.completion) {
      effective = { ...effective, ...state.overrides.line.completion };
    }
  }

  return effective;
}
```

---

### Example Calculation

**State**:
```typescript
{
  line: {
    color: '#FFFFFF',       // General
    lineWidth: 0.25,
    opacity: 1.0,
    lineType: 'solid'
  },
  specific: {
    line: {
      preview: {
        color: '#FFFF00',   // Specific Preview
        lineType: 'dashed',
        opacity: 0.7
      }
    }
  },
  overrides: {
    line: {
      preview: {
        color: '#FF0000'    // Override Preview
      }
    }
  },
  overrideEnabled: {
    line: true              // Overrides ENABLED
  }
}
```

**Calculation for `getEffectiveLineSettings('preview')`**:

```typescript
// Step 1: General
effective = {
  color: '#FFFFFF',
  lineWidth: 0.25,
  opacity: 1.0,
  lineType: 'solid'
}

// Step 2: Merge Specific Preview
effective = {
  color: '#FFFF00',        // ← Overridden from Specific
  lineWidth: 0.25,         // From General
  opacity: 0.7,            // ← Overridden from Specific
  lineType: 'dashed'       // ← Overridden from Specific
}

// Step 3: Merge Override Preview (enabled = true)
effective = {
  color: '#FF0000',        // ← Overridden from Override! FINAL
  lineWidth: 0.25,         // From General
  opacity: 0.7,            // From Specific
  lineType: 'dashed'       // From Specific
}

// Result:
{
  color: '#FF0000',        // From Override ✅
  lineWidth: 0.25,         // From General ✅
  opacity: 0.7,            // From Specific ✅
  lineType: 'dashed'       // From Specific ✅
}
```

---

## 7. MODE SWITCHING LOGIC

### PhaseManager + usePreviewMode

**PhaseManager** manages drawing phases (normal, drawing, etc.)
**usePreviewMode** manages viewer modes (normal, preview, completion)

**Integration**:
```typescript
// Drawing tool activated
PhaseManager.setPhase('drawing');
usePreviewMode.setMode('preview');

// Drawing completed
PhaseManager.setPhase('normal');
usePreviewMode.setMode('normal');
```

---

### Mode Switching Examples

**Example 1: Line Tool Activation**:
```typescript
function Toolbar() {
  const { setMode } = usePreviewMode();
  const { setPhase } = usePhaseManager();

  const handleLineTool = () => {
    setPhase('drawing');  // PhaseManager: Enter drawing phase
    setMode('preview');   // usePreviewMode: Enter preview mode
  };

  return <button onClick={handleLineTool}>Line</button>;
}
```

**Example 2: Line Completion**:
```typescript
function useUnifiedDrawing() {
  const { setMode } = usePreviewMode();
  const { setPhase } = usePhaseManager();

  const onDrawingPoint = (point: Point2D) => {
    // ... add point to tempPoints

    if (tempPoints.length >= 2) {
      // Entity completed
      const finalEntity = createEntityFromTool('line', tempPoints);

      // Apply COMPLETION settings
      const lineStyles = useLineStyles('completion');
      finalEntity.color = lineStyles.settings.color;

      // Add to scene
      addToScene(finalEntity);

      // Exit modes
      setMode('normal');
      setPhase('normal');
    }
  };
}
```

---

### Mode Transition Events

```typescript
// Listen to mode changes
const { mode } = usePreviewMode();

useEffect(() => {
  console.log('Mode changed to:', mode);

  if (mode === 'preview') {
    // Entering preview mode
    // - Enable construction aids (grips, distance labels)
    // - Use dashed preview style
  } else if (mode === 'normal') {
    // Exiting preview mode
    // - Hide construction aids
    // - Clear preview entities
  }
}, [mode]);
```

---

## 8. PHASE MANAGER INTEGRATION

### PhaseManager Phases

```typescript
type Phase = 'normal' | 'drawing' | 'editing' | 'selecting';
```

**Relationship with ViewerMode**:
| Phase | Typical Mode | Notes |
|-------|--------------|-------|
| normal | normal | Default state |
| drawing | preview | Drawing in progress |
| editing | normal | Editing existing entity |
| selecting | normal | Selecting entities |

---

### Synchronization

**Pattern**: PhaseManager drives high-level state, usePreviewMode refines visual behavior.

```typescript
// Drawing lifecycle
PhaseManager.setPhase('drawing');  // High-level: We're drawing
usePreviewMode.setMode('preview'); // Visual: Use preview styles

// Completion
PhaseManager.setPhase('normal');   // High-level: Drawing done
usePreviewMode.setMode('normal');  // Visual: Use normal styles
```

---

## 📚 CROSS-REFERENCES

### Related Documentation

- **[00-INDEX.md](./00-INDEX.md)** - Documentation hub
- **[01-ARCHITECTURE_OVERVIEW.md](./01-ARCHITECTURE_OVERVIEW.md)** - Overall architecture
- **[03-DXFSETTINGSPROVIDER.md](./03-DXFSETTINGSPROVIDER.md)** - Provider implementation
- **[04-HOOKS_REFERENCE.md](./04-HOOKS_REFERENCE.md)** - useLineStyles(), usePreviewMode()
- **[06-SETTINGS_FLOW.md](./06-SETTINGS_FLOW.md)** - Complete settings flow
- **[08-LINE_DRAWING_INTEGRATION.md](./08-LINE_DRAWING_INTEGRATION.md)** - Mode system in action

### Related Code Files

- `providers/DxfSettingsProvider.tsx` - Mode state management
- `hooks/usePreviewMode.ts` - Mode hook
- `systems/phase-manager/PhaseManager.ts` - Phase management
- `hooks/drawing/useUnifiedDrawing.ts` - Mode usage example

---

## 🎯 KEY TAKEAWAYS

1. **3 Modes**: normal (default), preview (construction), completion (final)
2. **Settings Hierarchy**: General → Specific → Overrides
3. **Overrides**: User preferences που παρακάμπτουν Specific settings
4. **Mode Lifecycle**: normal → preview (drawing) → normal (completion)
5. **Effective Settings**: Always use `getEffectiveSettings(mode)` for correct values
6. **PhaseManager Integration**: Phases drive modes, modes refine visual behavior

---

**END OF CHAPTER 07**

---

**Next Chapter**: [08 - Line Drawing Integration →](./08-LINE_DRAWING_INTEGRATION.md)
**Previous Chapter**: [← 06 - Settings Flow](./06-SETTINGS_FLOW.md)
**Back to Index**: [← Documentation Index](./00-INDEX.md)
