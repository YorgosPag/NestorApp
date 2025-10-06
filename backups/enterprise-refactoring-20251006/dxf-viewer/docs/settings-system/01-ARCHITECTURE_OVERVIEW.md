# CHAPTER 01 - ARCHITECTURE OVERVIEW

**DXF Viewer Settings System - Enterprise Documentation**
**Created**: 2025-10-06
**Status**: ✅ Complete
**Author**: Claude Code (Anthropic AI) + Γιώργος Παγώνης

---

## 📋 TABLE OF CONTENTS

1. [System Overview](#system-overview)
2. [Core Principles](#core-principles)
3. [Provider Hierarchy](#provider-hierarchy)
4. [Data Flow Patterns](#data-flow-patterns)
5. [Integration Points](#integration-points)
6. [Key Components](#key-components)
7. [Architecture Diagrams](#architecture-diagrams)
8. [Design Decisions](#design-decisions)

---

## 1. SYSTEM OVERVIEW

### Τι Είναι το Settings System;

Το DXF Viewer Settings System είναι ένα **enterprise-grade** σύστημα διαχείρισης ρυθμίσεων που:

1. **Centralized**: Μία πηγή αλήθειας για όλες τις ρυθμίσεις (DxfSettingsProvider)
2. **Mode-Based**: Διαφορετικές ρυθμίσεις ανά mode (normal/preview/completion)
3. **Hierarchical**: Γενικές → Ειδικές → Overrides (3 επίπεδα)
4. **Persistent**: Auto-save στο localStorage με 500ms debounce
5. **Type-Safe**: Πλήρης TypeScript typing με validation
6. **Reactive**: Αυτόματη re-render όταν αλλάζουν οι ρυθμίσεις

---

### Γιατί Χρειάζεται;

**Πρόβλημα Πριν**:
```
❌ Διάσπαρτες ρυθμίσεις σε πολλά αρχεία
❌ Hardcoded values (color: '#FFFFFF')
❌ Δύο providers χωρίς συγχρονισμό
❌ Όχι persistence
❌ Όχι mode-based settings
```

**Λύση Τώρα**:
```
✅ Κεντρικό DxfSettingsProvider
✅ Dynamic settings από UI
✅ Ενοποιημένο provider system
✅ Auto-save στο localStorage
✅ Mode-based settings (preview/completion/normal)
```

---

## 2. CORE PRINCIPLES

### Principle 1: Single Source of Truth

**Rule**: Όλες οι ρυθμίσεις διαχειρίζονται από ΕΝΑ provider (DxfSettingsProvider).

```typescript
// ❌ WRONG: Multiple providers
<ConfigurationProvider>
  <DxfSettingsProvider>
    {/* Duplicate state, no sync */}
  </DxfSettingsProvider>
</ConfigurationProvider>

// ✅ CORRECT: Single provider
<DxfSettingsProvider>
  {/* Single source of truth */}
</DxfSettingsProvider>
```

**Implementation**: Commit 7e1b683 - Deleted ConfigurationProvider, merged into DxfSettingsProvider

---

### Principle 2: Settings Hierarchy

**Rule**: Ρυθμίσεις εφαρμόζονται με σειρά προτεραιότητας.

```
EFFECTIVE SETTINGS = GENERAL → SPECIFIC → OVERRIDES
                       ↑          ↑          ↑
                     Base    Mode-based  User overrides
```

**Example**:
```typescript
// Step 1: Start with General settings
color: '#FFFFFF' (white)

// Step 2: Merge Specific Preview settings
color: '#FFFF00' (yellow) ← Overrides general

// Step 3: Merge User Overrides (if enabled)
color: '#FF0000' (red) ← Final override

// Result: Effective color = '#FF0000'
```

---

### Principle 3: Mode-Based Configuration

**Rule**: Διαφορετικές ρυθμίσεις ανά viewer mode.

```typescript
type ViewerMode = 'normal' | 'preview' | 'completion';

// Preview mode: Dashed, yellow, 70% opacity
useLineStyles('preview');

// Completion mode: Solid, green, 100% opacity
useLineStyles('completion');

// Normal mode: Uses general settings
useLineStyles('normal');
```

---

### Principle 4: Auto-Save & Persistence

**Rule**: Κάθε αλλαγή στις ρυθμίσεις αποθηκεύεται αυτόματα.

```typescript
// User changes color in ColorPalettePanel
updateLineSettings({ color: '#FF0000' });
  ↓
// Auto-save trigger (500ms debounce)
debounce(() => {
  localStorage.setItem('dxf-settings-v1', JSON.stringify(state));
}, 500);
  ↓
// Settings persist across page reloads ✅
```

---

### Principle 5: Centralization (CLAUDE.md Rule #12)

**Rule**: ΜΗΔΕΝ ΔΙΠΛΟΤΥΠΑ - Όλα τα shared functions κεντρικοποιημένα.

```typescript
// ❌ WRONG: Duplicate code
extendedLine.color = linePreviewStyles.settings.color;
extendedLine.lineweight = linePreviewStyles.settings.lineWidth;
// ... repeated 4 times for 4 entity types

// ✅ CORRECT: Centralized helper
const applyPreviewSettings = (entity) => { /* ... */ };
applyPreviewSettings(extendedLine);
applyPreviewSettings(extendedPolyline);
applyPreviewSettings(extendedCircle);
applyPreviewSettings(extendedRectangle);
```

**Result**: 61% code reduction (36 → 18 lines)

---

## 3. PROVIDER HIERARCHY

### Complete Provider Tree

```
App.tsx
 └─ DxfViewerApp.tsx
     └─ NotificationProvider
         └─ StorageErrorBoundary
             └─ DxfViewerErrorBoundary
                 └─ StyleManagerProvider         ← Style management
                     └─ DxfSettingsProvider      ← ⭐ CENTRAL SETTINGS
                         └─ GripProvider         ← Grip-specific settings
                             └─ CanvasContext    ← Canvas state
                                 └─ PhaseManager ← Drawing phases
                                     └─ (App components)
```

---

### Provider Responsibilities

| Provider | Responsibility | Settings Scope |
|----------|---------------|----------------|
| **DxfSettingsProvider** | Central settings storage, auto-save, mode-based config | All entities (line, text, grip) |
| **StyleManagerProvider** | Style computation, effective settings calculation | Entity rendering styles |
| **GripProvider** | Grip-specific settings, DPI scaling | Grip appearance |
| **CanvasContext** | Canvas state (transform, active tool, hover) | Canvas behavior |
| **PhaseManager** | Drawing phases (normal, drawing, preview) | Phase transitions |

---

### Settings Data Flow

```
ColorPalettePanel (UI)
  ↓ updateLineSettings({ color: '#FF0000' })
DxfSettingsProvider
  ↓ Auto-save (500ms debounce)
localStorage ('dxf-settings-v1')
  ↓
DxfSettingsProvider (re-reads on mount)
  ↓ useLineStyles('preview')
useUnifiedDrawing
  ↓ applyPreviewSettings(entity)
Preview Entity Rendered ✅
```

---

## 4. DATA FLOW PATTERNS

### Pattern 1: User Input → Settings Update

```
User clicks color picker in ColorPalettePanel
  ↓
ColorPalettePanel.tsx: onChange handler
  ↓
LineSettings.tsx: useUnifiedLinePreview().updateLineSettings({ color: '#FF0000' })
  ↓
DxfSettingsProvider.tsx: updateSpecificSettings('line', 'preview', { color: '#FF0000' })
  ↓
setState({ ...state, specific: { ...state.specific, line: { ...state.specific.line, preview: { ...preview, color: '#FF0000' } } } })
  ↓
Auto-save trigger (500ms debounce)
  ↓
localStorage.setItem('dxf-settings-v1', JSON.stringify(state))
  ↓
React re-renders all components using settings ✅
```

---

### Pattern 2: Settings Read → Entity Rendering

```
useUnifiedDrawing initializes
  ↓
useLineStyles('preview') hook
  ↓
useDxfSettings() context
  ↓
DxfSettingsProvider: getEffectiveLineSettings('preview')
  ↓
Merge: general + specific.preview + overrides.preview
  ↓
Return: { settings: { color, lineWidth, ... }, updateSettings, resetToDefaults }
  ↓
applyPreviewSettings(entity) uses settings.color
  ↓
Entity rendered with correct color ✅
```

---

### Pattern 3: Mode Switch → Settings Update

```
User clicks Line tool
  ↓
PhaseManager: setPhase('drawing')
  ↓
usePreviewMode: setMode('preview')
  ↓
useLineStyles('preview') re-reads settings
  ↓
Preview entity uses preview-specific settings ✅

User completes line (second click)
  ↓
PhaseManager: setPhase('normal')
  ↓
usePreviewMode: setMode('normal')
  ↓
useLineStyles('completion') reads completion settings
  ↓
Completed entity uses completion-specific settings ✅
```

---

## 5. INTEGRATION POINTS

### Integration 1: ColorPalettePanel → DxfSettingsProvider

**File**: `ui/components/ColorPalettePanel.tsx`

**Integration Hooks**:
```typescript
// For Preview settings
const { settings, updateSettings } = useUnifiedLinePreview();

// For Completion settings
const { settings, updateSettings } = useUnifiedLineCompletion();

// For General settings
const { settings, updateSettings } = useLineSettingsFromProvider();
```

**Data Path**:
```
ColorPalettePanel
  → LineSettings component
    → useUnifiedLinePreview() / useUnifiedLineCompletion()
      → useDxfSettings()
        → DxfSettingsProvider context
```

---

### Integration 2: DxfSettingsProvider → useUnifiedDrawing

**File**: `hooks/drawing/useUnifiedDrawing.ts`

**Integration Hooks**:
```typescript
const linePreviewStyles = useLineStyles('preview');
const lineCompletionStyles = useLineStyles('completion');
```

**Data Path**:
```
useUnifiedDrawing
  → useLineStyles('preview')
    → useDxfSettings()
      → DxfSettingsProvider context
        → getEffectiveLineSettings('preview')
```

---

### Integration 3: DxfSettingsProvider → Rendering System

**File**: `rendering/entities/BaseEntityRenderer.ts`

**Integration Hooks**:
```typescript
// Text rendering
const textStyles = getTextPreviewStyleWithOverride();

// Grip rendering
const gripSettings = useGripContext();
```

**Data Path**:
```
BaseEntityRenderer
  → getTextPreviewStyleWithOverride()
    → useDxfSettings()
      → DxfSettingsProvider context
        → getEffectiveTextSettings('preview')
```

---

## 6. KEY COMPONENTS

### Component 1: DxfSettingsProvider

**Location**: `providers/DxfSettingsProvider.tsx` (1,659 lines)

**Responsibilities**:
- Central settings storage
- Auto-save to localStorage
- Mode-based settings management
- Effective settings calculation (general → specific → overrides)
- Settings validation
- Migration system

**Key Methods**:
```typescript
interface DxfSettingsContextType {
  // Line settings
  line: LineSettings;
  updateLineSettings: (updates: Partial<LineSettings>) => void;
  getEffectiveLineSettings: (mode: ViewerMode) => LineSettings;

  // Text settings
  text: TextSettings;
  updateTextSettings: (updates: Partial<TextSettings>) => void;
  getEffectiveTextSettings: (mode: ViewerMode) => TextSettings;

  // Grip settings
  grip: GripSettings;
  updateGripSettings: (updates: Partial<GripSettings>) => void;
  getEffectiveGripSettings: (mode: ViewerMode) => GripSettings;

  // Specific settings (mode-based)
  specific: {
    line: { preview: Partial<LineSettings>, completion: Partial<LineSettings> },
    text: { preview: Partial<TextSettings>, completion: Partial<TextSettings> },
    grip: { preview: Partial<GripSettings>, completion: Partial<GripSettings> }
  };
  updateSpecificSettings: (entity: 'line' | 'text' | 'grip', mode: 'preview' | 'completion', updates: Partial<any>) => void;

  // Overrides
  overrides: { /* ... */ };
  updateOverrides: (entity, mode, updates) => void;

  // Reset
  resetToDefaults: () => void;
}
```

---

### Component 2: ColorPalettePanel

**Location**: `ui/components/ColorPalettePanel.tsx` (2,200+ lines)

**Responsibilities**:
- Settings UI rendering
- User interaction handling
- Tabs management (Γενικές / Ειδικές)
- Sub-tabs management (Lines / Text / Grips)
- Accordion management (Preview / Completion)

**Structure**:
```
ColorPalettePanel
├─ Main Tabs
│  ├─ Γενικές Ρυθμίσεις (General Settings)
│  │  ├─ Lines sub-tab
│  │  ├─ Text sub-tab
│  │  └─ Grips sub-tab
│  │
│  └─ Ειδικές Ρυθμίσεις (Specific Settings)
│     ├─ Cursor settings
│     ├─ Selection settings
│     ├─ Grid settings
│     ├─ Grips settings
│     ├─ Layers settings
│     ├─ Entities settings
│     │  ├─ Preview accordion
│     │  └─ Completion accordion
│     └─ Lighting settings
│
└─ Shared Components
   ├─ LineSettings
   ├─ TextSettings
   ├─ GripSettings
   ├─ AccordionSection
   └─ SharedColorPicker
```

---

### Component 3: useLineStyles Hook

**Location**: `providers/DxfSettingsProvider.tsx` (Lines 970-984)

**Purpose**: Read line settings for a specific mode

**Signature**:
```typescript
function useLineStyles(mode?: ViewerMode): {
  settings: LineSettings;
  updateSettings: (updates: Partial<LineSettings>) => void;
  resetToDefaults: () => void;
}
```

**Usage**:
```typescript
// Preview phase
const linePreviewStyles = useLineStyles('preview');
entity.color = linePreviewStyles.settings.color;

// Completion phase
const lineCompletionStyles = useLineStyles('completion');
entity.color = lineCompletionStyles.settings.color;
```

---

### Component 4: applyPreviewSettings Helper

**Location**: `hooks/drawing/useUnifiedDrawing.ts` (Lines 135-145)

**Purpose**: Centralized preview settings application

**Implementation**:
```typescript
const applyPreviewSettings = useCallback((entity: any) => {
  entity.color = linePreviewStyles.settings.color;
  entity.lineweight = linePreviewStyles.settings.lineWidth;
  entity.opacity = linePreviewStyles.settings.opacity;
  entity.lineType = linePreviewStyles.settings.lineType;
  entity.dashScale = linePreviewStyles.settings.dashScale;
  entity.lineCap = linePreviewStyles.settings.lineCap;
  entity.lineJoin = linePreviewStyles.settings.lineJoin;
  entity.dashOffset = linePreviewStyles.settings.dashOffset;
  entity.breakAtCenter = linePreviewStyles.settings.breakAtCenter;
}, [linePreviewStyles]);
```

**Benefits**:
- 61% code reduction (36 → 18 lines)
- Single source of truth for preview settings
- Follows CLAUDE.md Rule #12 (Centralization)

---

## 7. ARCHITECTURE DIAGRAMS

### Diagram 1: Settings Hierarchy

```
┌─────────────────────────────────────────────────┐
│         ΓΕΝΙΚΕΣ ΡΥΘΜΙΣΕΙΣ (GENERAL)             │
│  Base layer - Εφαρμόζεται σε όλα by default     │
│                                                  │
│  color: '#FFFFFF' (white)                       │
│  lineWidth: 1                                   │
│  opacity: 1.0                                   │
│  lineType: 'solid'                              │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│      ΕΙΔΙΚΕΣ ΡΥΘΜΙΣΕΙΣ (SPECIFIC - Preview)     │
│  Mode-based layer - Overrides general           │
│                                                  │
│  color: '#FFFF00' (yellow) ← Overrides general  │
│  lineType: 'dashed' ← Overrides general         │
│  opacity: 0.7 ← Overrides general               │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│        OVERRIDES (User-specific)                │
│  Top layer - Final overrides                    │
│                                                  │
│  color: '#FF0000' (red) ← Final override        │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│          EFFECTIVE SETTINGS                     │
│  Calculated: General → Specific → Overrides     │
│                                                  │
│  color: '#FF0000' (red) ✅                      │
│  lineWidth: 1 (from general) ✅                 │
│  lineType: 'dashed' (from specific) ✅          │
│  opacity: 0.7 (from specific) ✅                │
└─────────────────────────────────────────────────┘
```

---

### Diagram 2: Provider Data Flow

```
┌──────────────────────┐
│  ColorPalettePanel   │ ← User interacts
│  (Settings UI)       │
└──────────┬───────────┘
           │ updateLineSettings({ color: '#FF0000' })
           ↓
┌──────────────────────┐
│ DxfSettingsProvider  │ ← Central storage
│ (Context Provider)   │
└──────────┬───────────┘
           │ setState({ ... })
           ↓
┌──────────────────────┐
│   Auto-Save System   │ ← Persistence
│ (500ms debounce)     │
└──────────┬───────────┘
           │ localStorage.setItem(...)
           ↓
┌──────────────────────┐
│    localStorage      │ ← Persisted state
│ ('dxf-settings-v1')  │
└──────────┬───────────┘
           │ On page reload
           ↓
┌──────────────────────┐
│ DxfSettingsProvider  │ ← Restore state
│ (useEffect mount)    │
└──────────┬───────────┘
           │ useState(restored)
           ↓
┌──────────────────────┐
│  useLineStyles()     │ ← Read settings
│ (Custom hook)        │
└──────────┬───────────┘
           │ getEffectiveLineSettings('preview')
           ↓
┌──────────────────────┐
│  useUnifiedDrawing   │ ← Apply settings
│ (Drawing logic)      │
└──────────┬───────────┘
           │ applyPreviewSettings(entity)
           ↓
┌──────────────────────┐
│   Preview Entity     │ ← Rendered
│ (color: '#FF0000')   │
└──────────────────────┘
```

---

### Diagram 3: Mode-Based Settings Flow

```
┌─────────────────────────────────────────────────────────┐
│                  USER DRAWS A LINE                      │
└─────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Click 1: First Point Added                 │
│                                                          │
│  PhaseManager: setPhase('drawing')                      │
│  usePreviewMode: setMode('preview')                     │
│                                                          │
│  useLineStyles('preview') → Returns:                    │
│    {                                                     │
│      settings: {                                        │
│        color: '#FFFF00' (yellow),                       │
│        lineType: 'dashed',                              │
│        opacity: 0.7                                     │
│      }                                                   │
│    }                                                     │
│                                                          │
│  applyPreviewSettings(previewEntity)                    │
│  → Preview line rendered (yellow, dashed) ✅            │
└─────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Click 2: Second Point Added                │
│                                                          │
│  Entity completed: createEntityFromTool('line', [p1, p2])│
│                                                          │
│  useLineStyles('completion') → Returns:                 │
│    {                                                     │
│      settings: {                                        │
│        color: '#00FF00' (green),                        │
│        lineType: 'solid',                               │
│        opacity: 1.0                                     │
│      }                                                   │
│    }                                                     │
│                                                          │
│  Direct assignment:                                     │
│    newEntity.color = lineCompletionStyles.settings.color│
│    newEntity.lineType = lineCompletionStyles.settings...│
│                                                          │
│  PhaseManager: setPhase('normal')                       │
│  usePreviewMode: setMode('normal')                      │
│                                                          │
│  → Completed line rendered (green, solid) ✅            │
└─────────────────────────────────────────────────────────┘
```

---

### Diagram 4: Component Integration Map

```
┌─────────────────────────────────────────────────────────────┐
│                      DxfViewerApp.tsx                       │
│  (Root component)                                           │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ↓                           ↓
┌───────────────────────────┐   ┌───────────────────────────┐
│   ColorPalettePanel.tsx   │   │   DxfCanvas.tsx           │
│   (Settings UI)           │   │   (Main canvas)           │
│                           │   │                           │
│  - Γενικές Ρυθμίσεις      │   │  - handleMouseDown        │
│  - Ειδικές Ρυθμίσεις      │   │  - onCanvasClick          │
│  - Sub-tabs (Lines/Text)  │   │                           │
└───────────┬───────────────┘   └───────────┬───────────────┘
            │                               │
            │ useUnifiedLinePreview()       │ useDrawingHandlers()
            │ useUnifiedLineCompletion()    │
            │                               │
            ↓                               ↓
┌─────────────────────────────────────────────────────────────┐
│              DxfSettingsProvider.tsx                        │
│              (Central Settings Context)                     │
│                                                             │
│  State:                                                     │
│    - line: { general, specific: { preview, completion } }  │
│    - text: { general, specific: { preview, completion } }  │
│    - grip: { general, specific: { preview, completion } }  │
│    - overrides: { ... }                                    │
│                                                             │
│  Methods:                                                  │
│    - getEffectiveLineSettings(mode)                        │
│    - getEffectiveTextSettings(mode)                        │
│    - getEffectiveGripSettings(mode)                        │
│    - updateSpecificSettings(entity, mode, updates)         │
│    - Auto-save (500ms debounce)                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ useLineStyles('preview')
                              │ useLineStyles('completion')
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              useUnifiedDrawing.ts                           │
│              (Drawing Logic)                                │
│                                                             │
│  Hooks:                                                     │
│    - linePreviewStyles = useLineStyles('preview')          │
│    - lineCompletionStyles = useLineStyles('completion')    │
│                                                             │
│  Helpers:                                                  │
│    - applyPreviewSettings(entity)                          │
│      → Uses linePreviewStyles.settings                     │
│                                                             │
│  Entity Creation:                                          │
│    - Preview: applyPreviewSettings(previewEntity)          │
│    - Completion: Direct assignment from                    │
│                   lineCompletionStyles.settings            │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. DESIGN DECISIONS

### Decision 1: Merge ConfigurationProvider into DxfSettingsProvider

**Problem**: Δύο providers διαχειρίζονταν settings χωρίς συγχρονισμό
- ConfigurationProvider: Mode-based settings, NO persistence
- DxfSettingsProvider: Persistence, NO mode system

**Decision**: Merge ConfigurationProvider → DxfSettingsProvider

**Rationale**:
1. Single source of truth (CLAUDE.md Rule #12)
2. Eliminates synchronization issues
3. Combines best of both: mode-based + persistence
4. Reduces provider hierarchy depth

**Implementation**: Commit 7e1b683 (2025-10-06)
- Deleted ConfigurationProvider.tsx (219 lines)
- Extended DxfSettingsProvider with mode-based settings (+602 lines)
- Updated all consumers (useEntityStyles, useUnifiedDrawing, GripProvider)

---

### Decision 2: Centralize Preview Settings Application

**Problem**: Duplicate code for preview settings (36 lines across 4 entity types)

**Decision**: Create `applyPreviewSettings()` helper function

**Rationale**:
1. DRY principle (Don't Repeat Yourself)
2. Single point of change for preview settings
3. 61% code reduction (36 → 18 lines)
4. Follows CLAUDE.md Rule #12 (Centralization)

**Implementation**: `useUnifiedDrawing.ts` lines 135-145

---

### Decision 3: Mode-Based Settings Architecture

**Problem**: Preview και Completion entities χρειάζονται διαφορετικές εμφανίσεις

**Decision**: Implement mode-based settings system

**Rationale**:
1. CAD standard behavior (AutoCAD, ISO 128)
2. Clear visual distinction (preview = construction, completion = final)
3. User-configurable per mode
4. Flexible override system

**Implementation**: `ViewerMode` type ('normal' | 'preview' | 'completion')

---

### Decision 4: Auto-Save with Debounce

**Problem**: Κάθε αλλαγή στις ρυθμίσεις θα έκανε localStorage write

**Decision**: 500ms debounce για auto-save

**Rationale**:
1. Reduce localStorage writes (performance)
2. Batch multiple rapid changes
3. Avoid unnecessary re-renders
4. Standard UX pattern (auto-save delay)

**Implementation**: `auto-save.ts` με 500ms debounce

---

### Decision 5: Settings Validation

**Problem**: Invalid settings θα μπορούσαν να σπάσουν το rendering

**Decision**: Validate settings on every update

**Rationale**:
1. Type safety beyond TypeScript
2. Runtime validation for user input
3. Fallback to defaults on invalid values
4. Prevent rendering errors

**Implementation**: `validateGripSettings()`, `validateLineSettings()`, etc.

---

## 📚 CROSS-REFERENCES

### Related Documentation

- **[00-INDEX.md](./00-INDEX.md)** - Documentation navigation hub
- **[02-COLORPALETTEPANEL.md](./02-COLORPALETTEPANEL.md)** - UI structure details
- **[03-DXFSETTINGSPROVIDER.md](./03-DXFSETTINGSPROVIDER.md)** - Provider implementation
- **[04-HOOKS_REFERENCE.md](./04-HOOKS_REFERENCE.md)** - Hooks API reference
- **[07-MODE_SYSTEM.md](./07-MODE_SYSTEM.md)** - Mode-based settings explained
- **[08-LINE_DRAWING_INTEGRATION.md](./08-LINE_DRAWING_INTEGRATION.md)** - Line drawing integration
- **[../SETTINGS_ARCHITECTURE.md](../SETTINGS_ARCHITECTURE.md)** - Original architecture doc (10,000+ words)

### Related Code Files

- `providers/DxfSettingsProvider.tsx` - Central provider (1,659 lines)
- `ui/components/ColorPalettePanel.tsx` - Settings UI (2,200+ lines)
- `hooks/drawing/useUnifiedDrawing.ts` - Drawing logic with settings integration
- `hooks/useEntityStyles.ts` - Legacy compatibility wrapper
- `hooks/usePreviewMode.ts` - Mode management

---

## 🎯 KEY TAKEAWAYS

1. **Single Source of Truth**: DxfSettingsProvider διαχειρίζεται ΟΛΑ τα settings
2. **Hierarchical Settings**: General → Specific → Overrides (3 layers)
3. **Mode-Based**: Διαφορετικές ρυθμίσεις για preview/completion/normal
4. **Auto-Save**: Persistence με 500ms debounce
5. **Centralized Helpers**: `applyPreviewSettings()` για code reuse
6. **Type-Safe**: Validation + TypeScript typing
7. **Reactive**: Auto re-render on settings change

---

**END OF CHAPTER 01**

---

**Next Chapter**: [02 - ColorPalettePanel →](./02-COLORPALETTEPANEL.md)
**Back to Index**: [← Documentation Index](./00-INDEX.md)
