# DXF VIEWER - SETTINGS ARCHITECTURE DOCUMENTATION

**Ημερομηνία**: 2025-10-06
**Status**: ✅ COMPLETE - Post-Merge Documentation
**Τελευταία Ενημέρωση**: ConfigurationProvider → DxfSettingsProvider Merge

---

## 📋 TABLE OF CONTENTS

1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [DxfSettingsPanel UI Structure](#colorpalettepanel-ui-structure)
4. [Settings Hierarchy](#settings-hierarchy)
5. [DxfSettingsProvider - Central State Management](#dxfsettingsprovider)
6. [Mode-Based Settings System](#mode-based-settings)
7. [Settings Flow - Complete Lifecycle](#settings-flow)
8. [Hooks Reference](#hooks-reference)
9. [UI Components Reference](#ui-components-reference)
10. [Common Use Cases](#common-use-cases)

---

## 🎯 OVERVIEW

Το DXF Viewer Settings System είναι ένα **unified, mode-based architecture** που διαχειρίζεται όλες τις ρυθμίσεις του viewer μέσω ενός κεντρικού provider.

### Βασικά Χαρακτηριστικά

- ✅ **Single Source of Truth**: DxfSettingsProvider
- ✅ **Mode-Based Architecture**: normal, preview, completion
- ✅ **Auto-Save**: LocalStorage persistence
- ✅ **Hierarchical Settings**: General → Specific → Overrides
- ✅ **Type-Safe**: Full TypeScript support
- ✅ **CAD Standards**: ISO, AutoCAD ACI compliance

---

## 🏗️ ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER INTERFACE LAYER                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │          DxfSettingsPanel (Main UI)                     │   │
│  │  ┌────────────────┬──────────────────────────────────┐   │   │
│  │  │  Main Tabs     │  - Γενικές Ρυθμίσεις (General)  │   │   │
│  │  │                │  - Ειδικές Ρυθμίσεις (Specific)  │   │   │
│  │  └────────────────┴──────────────────────────────────┘   │   │
│  │                                                           │   │
│  │  ┌──────────── ΓΕΝΙΚΕΣ ΡΥΘΜΙΣΕΙΣ ────────────┐          │   │
│  │  │  Sub-Tabs:                                 │          │   │
│  │  │  ├─ Lines   → LineSettings.tsx             │          │   │
│  │  │  ├─ Text    → TextSettings.tsx             │          │   │
│  │  │  └─ Grips   → GripSettings.tsx             │          │   │
│  │  └──────────────────────────────────────────┘            │   │
│  │                                                           │   │
│  │  ┌──────────── ΕΙΔΙΚΕΣ ΡΥΘΜΙΣΕΙΣ ────────────┐          │   │
│  │  │  Categories (Icon Buttons):                │          │   │
│  │  │  ├─ Cursor     → CursorSettings.tsx        │          │   │
│  │  │  ├─ Selection  → SelectionSettings.tsx     │          │   │
│  │  │  ├─ Grid       → Grid & Ruler Settings     │          │   │
│  │  │  ├─ Grips      → 🚧 Coming Soon            │          │   │
│  │  │  ├─ Layers     → LayersSettings.tsx        │          │   │
│  │  │  ├─ Entities   → EntitiesSettings.tsx      │          │   │
│  │  │  └─ Lighting   → 🚧 Coming Soon            │          │   │
│  │  └──────────────────────────────────────────┘            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   STATE MANAGEMENT LAYER                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         DxfSettingsProvider (UNIFIED PROVIDER)           │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  STATE STRUCTURE:                                  │  │   │
│  │  │  {                                                 │  │   │
│  │  │    // General Settings (Base Layer)               │  │   │
│  │  │    line: LineSettings,                            │  │   │
│  │  │    text: TextSettings,                            │  │   │
│  │  │    grip: GripSettings,                            │  │   │
│  │  │    grid: GridSettings,                            │  │   │
│  │  │    ruler: RulerSettings,                          │  │   │
│  │  │    cursor: CursorSettings,                        │  │   │
│  │  │                                                    │  │   │
│  │  │    // Mode-Based Settings (Post-Merge Addition)  │  │   │
│  │  │    mode: 'normal' | 'preview' | 'completion',    │  │   │
│  │  │    specific: {                                    │  │   │
│  │  │      line: {                                      │  │   │
│  │  │        preview: { color, opacity, lineType },    │  │   │
│  │  │        completion: { color, opacity, lineType }  │  │   │
│  │  │      },                                           │  │   │
│  │  │      text: { preview: {...} },                   │  │   │
│  │  │      grip: { preview: {...} }                    │  │   │
│  │  │    },                                             │  │   │
│  │  │                                                    │  │   │
│  │  │    // User Overrides (Advanced Feature)          │  │   │
│  │  │    overrides: {                                   │  │   │
│  │  │      line: { preview: {...}, completion: {...} } │  │   │
│  │  │    },                                             │  │   │
│  │  │    overrideEnabled: { line, text, grip }         │  │   │
│  │  │  }                                                │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │                                                        │   │
│  │  ┌─────────── AUTO-SAVE MECHANISM ──────────┐        │   │
│  │  │  LocalStorage Key: 'dxf-settings-v1'     │        │   │
│  │  │  Debounce: 500ms                         │        │   │
│  │  │  Migration Support: Yes                  │        │   │
│  │  └──────────────────────────────────────────┘        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     HOOKS LAYER                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Consumer Hooks:                                         │   │
│  │  ├─ useLineStyles(mode?)        → Effective line styles │   │
│  │  ├─ useTextStyles(mode?)        → Effective text styles │   │
│  │  ├─ useGripStyles(mode?)        → Effective grip styles │   │
│  │  ├─ useLineSettingsFromProvider → General line settings │   │
│  │  ├─ useTextSettingsFromProvider → General text settings │   │
│  │  └─ usePreviewMode()            → Mode management       │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Legacy Compatibility Hooks:                             │   │
│  │  ├─ useEntityStyles(type, mode) → Wrapper for above     │   │
│  │  ├─ useUnifiedLinePreview()     → useLineStyles('prev') │   │
│  │  └─ useUnifiedLineCompletion()  → useLineStyles('comp') │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Drawing Tools (useUnifiedDrawing.ts)                   │   │
│  │  ├─ startDrawing() → setMode('preview')                 │   │
│  │  ├─ updatePreview() → Uses linePreviewStyles            │   │
│  │  ├─ addPoint() → Uses lineCompletionStyles              │   │
│  │  └─ cancelDrawing() → setMode('normal')                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Rendering (DxfRenderer, LayerRenderer)                 │   │
│  │  └─ Applies effective settings based on current mode    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎨 COLORPALETTEPANEL UI STRUCTURE

### Main Tabs

```tsx
<DxfSettingsPanel>
  <MainTabs>
    ├─ Γενικές Ρυθμίσεις (General Settings)
    └─ Ειδικές Ρυθμίσεις (Specific Settings)
  </MainTabs>
</DxfSettingsPanel>
```

### Γενικές Ρυθμίσεις (General Settings)

Αυτές είναι οι **βασικές ρυθμίσεις** που εφαρμόζονται σε **ΟΛΕΣ** τις οντότητες του ίδιου τύπου.

```
Γενικές Ρυθμίσεις
├─ Lines   (LineSettings.tsx)
│  ├─ Line Type (solid, dashed, dotted, etc.)
│  ├─ Line Width (0.25 - 5.0 mm)
│  ├─ Color Picker
│  ├─ Opacity (0 - 100%)
│  ├─ Dash Scale
│  ├─ Line Cap (butt, round, square)
│  ├─ Line Join (miter, round, bevel)
│  └─ Templates (ISO, DIN, ANSI, AutoCAD)
│
├─ Text    (TextSettings.tsx)
│  ├─ Font Family
│  ├─ Font Size (1.8 - 5.0 mm)
│  ├─ Color Picker
│  ├─ Bold, Italic, Underline
│  └─ Superscript, Subscript
│
└─ Grips   (GripSettings.tsx)
   ├─ Show Grips (ON/OFF)
   ├─ Grip Size (3 - 15 DIP)
   ├─ Pick Box Size
   ├─ Aperture Size
   └─ Colors (Cold, Warm, Hot, Contour)
```

### Ειδικές Ρυθμίσεις (Specific Settings)

Αυτές είναι **ειδικές ρυθμίσεις** για συγκεκριμένες λειτουργίες του viewer.

```
Ειδικές Ρυθμίσεις (Icon Buttons)
├─ 🎯 Cursor (Crosshair & Cursor)
│  ├─ Crosshair Tab
│  │  ├─ Color Picker
│  │  ├─ Size (5 - 50 px)
│  │  ├─ Line Style (solid, dashed)
│  │  ├─ Opacity (0 - 100%)
│  │  └─ Enabled (ON/OFF)
│  └─ Cursor Tab
│     ├─ Shape (circle, square)
│     ├─ Size (5 - 30 px)
│     ├─ Color Picker
│     └─ Line Style
│
├─ ☑️ Selection (Window & Crossing)
│  ├─ Window Selection
│  │  ├─ Border Color
│  │  ├─ Fill Color
│  │  └─ Opacity
│  └─ Crossing Selection
│     ├─ Border Color
│     ├─ Fill Color
│     └─ Opacity
│
├─ 📐 Grid (Grid & Rulers)
│  ├─ Grid Tab
│  │  ├─ Major Lines (Color, Width, Opacity)
│  │  └─ Minor Lines (Color, Width, Opacity)
│  └─ Rulers Tab
│     ├─ Background (Color, Visibility)
│     ├─ Lines (Major/Minor Colors, Width)
│     ├─ Text (Color, Size, Visibility)
│     └─ Units (Visibility)
│
├─ 🔘 Grips (🚧 Coming Soon)
│
├─ 📚 Layers (Layer Colors)
│  └─ Per-layer color management
│
├─ 🎨 Entities (Entity-specific settings)
│  └─ Per-entity type customization
│
└─ 💡 Lighting (🚧 Coming Soon)
```

---

## ⚙️ SETTINGS HIERARCHY

Το σύστημα υποστηρίζει **3 επίπεδα** ρυθμίσεων:

### 1. General Settings (Base Layer)

**Που βρίσκονται**: DxfSettingsPanel → Γενικές Ρυθμίσεις
**Τι κάνουν**: Εφαρμόζονται σε **ΟΛΕΣ** τις οντότητες του ίδιου τύπου (π.χ. όλες οι γραμμές)

```typescript
// Example: General Line Settings
{
  lineType: 'solid',
  lineWidth: 0.25,
  color: '#FFFFFF',
  opacity: 1.0
}
```

### 2. Specific Settings (Per-Mode)

**Που βρίσκονται**: DxfSettingsProvider → `state.specific`
**Τι κάνουν**: Εφαρμόζονται μόνο σε **συγκεκριμένο mode** (preview ή completion)

```typescript
// Example: Preview-specific settings
state.specific.line.preview = {
  lineType: 'dashed',
  color: '#FFFF00',  // Yellow for preview
  opacity: 0.7
}

state.specific.line.completion = {
  lineType: 'solid',
  color: '#00FF00',  // Green for completion
  opacity: 1.0
}
```

### 3. User Overrides (Advanced)

**Που βρίσκονται**: DxfSettingsProvider → `state.overrides`
**Τι κάνουν**: Επιτρέπουν στον χρήστη να **παρακάμψει** τις specific settings

```typescript
// Example: User override for preview
state.overrides.line.preview = {
  color: '#FF0000'  // User wants red instead of yellow
}

state.overrideEnabled.line = true  // Enable the override
```

### Effective Settings Calculation

Η **τελική** ρύθμιση υπολογίζεται με τη σειρά:

```
Effective Settings = General → Specific → Overrides
```

```typescript
// Pseudocode
function getEffectiveLineSettings(mode: ViewerMode): LineSettings {
  let settings = state.line;  // Start with general

  // Apply specific if mode is preview/completion
  if (mode !== 'normal' && state.specific.line[mode]) {
    settings = { ...settings, ...state.specific.line[mode] };
  }

  // Apply user overrides if enabled
  if (state.overrideEnabled.line && state.overrides.line[mode]) {
    settings = { ...settings, ...state.overrides.line[mode] };
  }

  return settings;
}
```

---

## 🏢 DXFSETTINGSPROVIDER

Κεντρικός provider που διαχειρίζεται **ΟΛΕΣ** τις ρυθμίσεις.

### State Structure

```typescript
interface DxfSettingsState {
  // ===== GENERAL SETTINGS (Base Layer) =====
  line: LineSettings;
  text: TextSettings;
  grip: GripSettings;
  grid: GridSettings;
  ruler: RulerSettings;
  cursor: CursorSettings;

  // ===== MODE-BASED SETTINGS (Post-Merge Addition) =====
  mode: ViewerMode;  // 'normal' | 'preview' | 'completion'
  specific: SpecificSettings;
  overrides: OverrideSettings;
  overrideEnabled: OverrideEnabledFlags;

  // ===== META =====
  isLoaded: boolean;
  lastSaved: Date | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
}
```

### Methods

```typescript
interface DxfSettingsContextType {
  settings: DxfSettingsState;

  // General Settings Updates
  updateLineSettings: (updates: Partial<LineSettings>) => void;
  updateTextSettings: (updates: Partial<TextSettings>) => void;
  updateGripSettings: (updates: Partial<GripSettings>) => void;

  // Mode Management
  setMode: (mode: ViewerMode) => void;

  // Specific Settings Updates
  updateSpecificLineSettings: (mode, updates) => void;
  updateSpecificTextSettings: (mode, updates) => void;

  // Override Management
  updateLineOverrides: (mode, updates) => void;
  toggleLineOverride: (enabled: boolean) => void;

  // Effective Settings Getters
  getEffectiveLineSettings: (mode?) => LineSettings;
  getEffectiveTextSettings: (mode?) => TextSettings;
  getEffectiveGripSettings: (mode?) => GripSettings;

  // Reset Functions
  resetLineSettings: () => void;
  resetAllSettings: () => void;
}
```

### Auto-Save Feature

```typescript
// Automatic LocalStorage persistence
useEffect(() => {
  const timeoutId = setTimeout(() => {
    localStorage.setItem('dxf-settings-v1', JSON.stringify(state));
    dispatch({ type: 'MARK_SAVED' });
  }, 500);  // 500ms debounce

  return () => clearTimeout(timeoutId);
}, [state]);
```

---

## 🎭 MODE-BASED SETTINGS SYSTEM

### Viewer Modes

```typescript
type ViewerMode = 'normal' | 'preview' | 'completion';
```

| Mode | Description | Use Case |
|------|-------------|----------|
| **normal** | Default mode | Displaying existing entities, navigating |
| **preview** | Προσχεδίαση | While drawing (e.g., line preview before 2nd click) |
| **completion** | Ολοκλήρωση | After entity is completed (final state) |

### Mode Switching Lifecycle

```typescript
// Example: Line Drawing Tool
const { setMode } = usePreviewMode();

// 1. User clicks Line tool button
startDrawing('line');
setMode('preview');  // Enter preview mode

// 2. User clicks first point (updatePreview called)
// → Line preview renders with preview settings (yellow, dashed)

// 3. User clicks second point (addPoint called)
const newLine = createLine(point1, point2);
applySettings(newLine, lineCompletionStyles);  // Apply completion settings
setMode('normal');  // Return to normal mode
```

### Default Mode-Specific Settings

```typescript
// From DxfSettingsProvider initial state
specific: {
  line: {
    preview: {
      lineType: 'dashed',
      color: '#FFFF00',    // Yellow (CAD standard)
      opacity: 0.7
    },
    completion: {
      lineType: 'solid',
      color: '#00FF00',    // Green (CAD standard)
      opacity: 1.0
    }
  },
  text: {
    preview: {
      color: '#FFFF00',    // Yellow
      opacity: 0.8
    }
  },
  grip: {
    preview: {
      colors: {
        cold: '#0000FF',   // Blue
        warm: '#FF69B4',   // Hot Pink
        hot: '#FF0000'     // Red
      },
      gripSize: 8
    }
  }
}
```

---

## 🔄 SETTINGS FLOW - COMPLETE LIFECYCLE

### Scenario 1: User Changes General Line Color

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User Opens DxfSettingsPanel                            │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Clicks "Γενικές Ρυθμίσεις" → "Lines" Tab               │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Changes Color Picker from #FFFFFF to #FF0000           │
│    → LineSettings.tsx calls updateSettings()               │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. DxfSettingsProvider receives UPDATE_LINE_SETTINGS       │
│    → state.line.color = '#FF0000'                          │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Auto-Save triggers after 500ms                          │
│    → localStorage.setItem('dxf-settings-v1', state)        │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. All components using useLineSettingsFromProvider()      │
│    receive updated settings and re-render                  │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Next line drawn will use red color (#FF0000)           │
└─────────────────────────────────────────────────────────────┘
```

### Scenario 2: Drawing a Line with Preview

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User clicks Line Tool button                            │
│    → startDrawing('line')                                   │
│    → setMode('preview')                                     │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. useLineStyles('preview') is called                      │
│    → Returns { color: '#FFFF00', lineType: 'dashed' }     │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. User clicks first point on canvas                       │
│    → updatePreview(point1) called                          │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Preview line rendered:                                  │
│    - From point1 to cursor position                        │
│    - Yellow color (#FFFF00)                                │
│    - Dashed line type                                      │
│    - 70% opacity                                            │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. User clicks second point                                │
│    → addPoint(point2) called                               │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Line is completed:                                      │
│    → useLineStyles('completion') applied                   │
│    → Color: #00FF00 (green), Type: solid, Opacity: 100%   │
│    → setMode('normal')                                      │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Line entity added to scene with completion settings    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🪝 HOOKS REFERENCE

### Consumer Hooks (Primary)

#### `useLineStyles(mode?: ViewerMode)`

Επιστρέφει effective line settings για το συγκεκριμένο mode.

```typescript
const { settings, isOverridden, update, reset } = useLineStyles('preview');

settings.color       // '#FFFF00' (from specific.line.preview)
settings.lineType    // 'dashed'
isOverridden         // false (unless user enabled override)
update({ color: '#FF0000' })  // Updates specific.line.preview.color
reset()              // Resets to defaults
```

#### `useTextStyles(mode?: ViewerMode)`

```typescript
const { settings, update } = useTextStyles('preview');
settings.fontSize    // From effective text settings
```

#### `useGripStyles(mode?: ViewerMode)`

```typescript
const { settings, update } = useGripStyles();
settings.gripSize    // From effective grip settings
```

#### `usePreviewMode()`

Διαχειρίζεται το current viewer mode.

```typescript
const { mode, setMode, isPreview, isCompletion, isNormal } = usePreviewMode();

mode                 // 'normal' | 'preview' | 'completion'
setMode('preview')   // Switch to preview mode
isPreview            // true if mode === 'preview'
```

### Provider Hooks

#### `useLineSettingsFromProvider()`

Επιστρέφει **ΜΟΝΟ** general line settings (χωρίς mode-based logic).

```typescript
const { settings, updateSettings, resetToDefaults } = useLineSettingsFromProvider();

settings.color       // General line color (affects ALL lines)
updateSettings({ color: '#FF0000' })  // Updates general.line.color
```

#### `useTextSettingsFromProvider()`

```typescript
const { settings, updateSettings } = useTextSettingsFromProvider();
```

### Legacy Compatibility Hooks

#### `useEntityStyles(type, mode?, overrides?)`

**DEPRECATED**: Wrapper around new hooks.

```typescript
// ❌ Old way (still works but deprecated)
const styles = useEntityStyles('line', 'preview');

// ✅ New way (recommended)
const { settings } = useLineStyles('preview');
```

#### `useUnifiedLinePreview()`

**LEGACY**: Wrapper around `useLineStyles('preview')`.

```typescript
// ❌ Old way
const { settings } = useUnifiedLinePreview();

// ✅ New way
const { settings } = useLineStyles('preview');
```

---

## 🎛️ UI COMPONENTS REFERENCE

### LineSettings.tsx

**Location**: `ui/components/dxf-settings/settings/core/LineSettings.tsx`

**Props**:
```typescript
interface LineSettingsProps {
  contextType?: 'preview' | 'completion';
}
```

**Usage**:
```tsx
// General settings (Γενικές Ρυθμίσεις tab)
<LineSettings />

// Preview-specific settings
<LineSettings contextType="preview" />

// Completion-specific settings
<LineSettings contextType="completion" />
```

**Features**:
- Color Picker
- Line Type Selector (solid, dashed, dotted, etc.)
- Line Width Slider (0.25 - 5.0 mm)
- Opacity Slider (0 - 100%)
- Dash Scale Slider
- Line Cap (butt, round, square)
- Line Join (miter, round, bevel)
- Templates (ISO, DIN, ANSI, AutoCAD)

### TextSettings.tsx

**Location**: `ui/components/dxf-settings/settings/core/TextSettings.tsx`

**Features**:
- Font Family Selector
- Font Size Slider (1.8 - 5.0 mm)
- Color Picker
- Bold, Italic, Underline toggles
- Superscript, Subscript toggles

### GripSettings.tsx

**Location**: `ui/components/dxf-settings/settings/core/GripSettings.tsx`

**Features**:
- Show Grips toggle
- Grip Size Slider (3 - 15 DIP)
- Pick Box Size
- Aperture Size
- Colors (Cold, Warm, Hot, Contour)

### CursorSettings.tsx

**Location**: `ui/components/dxf-settings/settings/special/CursorSettings.tsx`

**Features**:
- Crosshair/Cursor tabs
- Shape Selector (circle, square)
- Size Slider
- Color Picker
- Line Style (solid, dashed)
- Opacity Slider

---

## 💡 COMMON USE CASES

### Use Case 1: Change General Line Color

```typescript
import { useLineSettingsFromProvider } from 'providers/DxfSettingsProvider';

function MyComponent() {
  const { updateSettings } = useLineSettingsFromProvider();

  const handleColorChange = (newColor: string) => {
    updateSettings({ color: newColor });
    // All future lines will use this color
  };
}
```

### Use Case 2: Get Preview Line Settings for Drawing

```typescript
import { useLineStyles } from 'providers/DxfSettingsProvider';

function useUnifiedDrawing() {
  const linePreviewStyles = useLineStyles('preview');
  const lineCompletionStyles = useLineStyles('completion');

  const updatePreview = (point: Point2D) => {
    const previewLine = createLine(point1, point);
    applySettings(previewLine, linePreviewStyles.settings);
    // Line renders with preview settings (yellow, dashed)
  };

  const completeLine = () => {
    const finalLine = createLine(point1, point2);
    applySettings(finalLine, lineCompletionStyles.settings);
    // Line completes with completion settings (green, solid)
  };
}
```

### Use Case 3: Override Preview Color Temporarily

```typescript
import { useDxfSettings } from 'providers/DxfSettingsProvider';

function TemporaryOverride() {
  const dxfSettings = useDxfSettings();

  // Enable override
  dxfSettings.toggleLineOverride(true);

  // Set custom preview color
  dxfSettings.updateLineOverrides('preview', {
    color: '#FF00FF'  // Magenta instead of yellow
  });

  // ... do drawing ...

  // Disable override when done
  dxfSettings.toggleLineOverride(false);
}
```

### Use Case 4: Switch Mode for Drawing

```typescript
import { usePreviewMode } from 'hooks/usePreviewMode';

function DrawingTool() {
  const { setMode } = usePreviewMode();

  const startDrawing = () => {
    setMode('preview');  // Enter preview mode
  };

  const finishDrawing = () => {
    // ... create entity ...
    setMode('normal');  // Return to normal mode
  };

  const cancelDrawing = () => {
    setMode('normal');  // Return to normal mode
  };
}
```

---

## 🔍 DEBUGGING TIPS

### View Current Settings

```typescript
import { useDxfSettings } from 'providers/DxfSettingsProvider';

const dxfSettings = useDxfSettings();
console.log('Current settings:', dxfSettings.settings);
console.log('Current mode:', dxfSettings.settings.mode);
console.log('Preview line color:', dxfSettings.settings.specific.line.preview.color);
```

### Check Effective Settings

```typescript
const effectiveSettings = dxfSettings.getEffectiveLineSettings('preview');
console.log('Effective preview settings:', effectiveSettings);
// This shows final settings after applying general → specific → overrides
```

### LocalStorage Inspection

```javascript
// In browser console
const settings = JSON.parse(localStorage.getItem('dxf-settings-v1'));
console.log('Saved settings:', settings);
```

---

## 📚 RELATED DOCUMENTATION

- [DXF_LOADING_FLOW.md](./DXF_LOADING_FLOW.md) - File loading architecture
- [LINE_DRAWING_SYSTEM.md](./LINE_DRAWING_SYSTEM.md) - Drawing tools documentation
- [centralized_systems.md](./docs/CENTRALIZED_SYSTEMS.md) - Centralization rules

---

## ✅ MIGRATION NOTES

### Post-Merge Changes (2025-10-06)

**ConfigurationProvider MERGED into DxfSettingsProvider**:

- ❌ **DELETED**: `ConfigurationProvider.tsx` (219 lines)
- ✅ **MERGED**: Mode-based architecture into DxfSettingsProvider
- ✅ **UPDATED**: All hooks now use DxfSettingsProvider
- ✅ **MAINTAINED**: Backward compatibility via wrapper hooks

**Breaking Changes**: None (full backward compatibility maintained)

**Recommended Updates**:
- Replace `useEntityStyles()` → `useLineStyles()`, `useTextStyles()`, etc.
- Replace `useUnifiedLinePreview()` → `useLineStyles('preview')`
- Replace `useUnifiedLineCompletion()` → `useLineStyles('completion')`

---

## 🐛 KNOWN ISSUES & FIXES (2025-10-06)

### Issue #5: Text Settings Preview Not Updating

**Problem**: When changing fontSize/color/bold/italic in Text Settings tab, the "125.50" text in central preview did NOT update.

**Root Cause**:
- File: `SubTabRenderer.tsx` line 98
- `coloredTextSettings` was memoized with `React.useMemo()`
- Dependencies: `[getColoredSettings, textSettings]`
- **Problem**: `textSettings` object reference stays same when deep properties change
- Result: `useMemo` doesn't re-run → preview doesn't update

**Solution Applied** (2025-10-06):
```typescript
// ❌ BEFORE (line 98):
const coloredTextSettings = React.useMemo(() =>
  getColoredSettings(textSettings),
  [getColoredSettings, textSettings]
);

// ✅ AFTER (line 100):
// Direct call - no memoization
const coloredTextSettings = getColoredSettings(textSettings);
```

**Files Changed**:
- `src/subapps/dxf-viewer/ui/components/shared/SubTabRenderer.tsx` (line 100)

**Impact**: Text preview now updates immediately when changing any text setting! ✅

---

### Issue #6: MULTI/SNAP Text Too Small + Hardcoded

**Problem**:
1. "MULTI" and "SNAP" texts in preview had `fontSize="6"` and `fontSize="8"` - too small to read
2. Hardcoded values instead of using general text settings

**Root Cause**:
- File: `LinePreview.tsx` lines 319, 333, 347
- Used hardcoded `fontSize="6"`, `fontSize="8"`
- Did NOT use `textSettings.fontSize`, `textSettings.fontFamily`, etc.

**Solution Applied** (2025-10-06):
```typescript
// ❌ BEFORE:
<text fontSize="6" fill={gripSettings.colors.hot} fontFamily="monospace">
  MULTI
</text>

// ✅ AFTER:
<text
  fontSize={textSettings.fontSize}
  fill={gripSettings.colors.hot}
  fontFamily={textSettings.fontFamily}
  fontWeight={textSettings.isBold ? 'bold' : 'normal'}
  fontStyle={textSettings.isItalic ? 'italic' : 'normal'}
>
  MULTI
</text>
```

**Files Changed**:
- `src/subapps/dxf-viewer/ui/components/dxf-settings/settings/shared/LinePreview.tsx` (lines 319, 333, 347)

**Impact**:
- MULTI/SNAP texts now use general text settings
- Size is readable and consistent with other text ✅
- Follows enterprise architecture (no hardcoded values) ✅

---

### Issue #7: ⚠️ CRITICAL - TextSettings Using Wrong Hook (Preview Settings Instead of Global)

**Problem**:
When changing fontSize/color/bold in "Γενικές Ρυθμίσεις → Κείμενο", the changes were NOT reflected in preview. The preview fontSize was stuck at 2.5.

**Root Cause**:
- File: `TextSettings.tsx` line 193
- Component used `useUnifiedTextPreview()` hook
- **PROBLEM**: This hook updates **Preview-specific settings** (`localStorage: dxf-text-preview-settings`)
- **EXPECTED**: Should update **Global General Text Settings** (`localStorage: dxf-text-general-settings`)
- Result: Changes saved to WRONG localStorage key → preview never updated!

**Deep Cause Analysis**:
```typescript
// ❌ WRONG HOOK (line 193):
const { settings: { textSettings }, updateTextSettings } = useUnifiedTextPreview();

// This calls:
updateTextSettings: consolidated.updateSpecificSettings  // Updates 'dxf-text-preview-settings' ❌

// Preview reads from:
const globalTextSettings = useTextSettingsFromProvider();  // Reads 'dxf-text-general-settings' ✅

// → Preview reads from DIFFERENT localStorage key than TextSettings writes to! ❌
```

**Solution Applied** (2025-10-06):
```typescript
// ❌ BEFORE:
import { useUnifiedTextPreview } from '../../../../hooks/useUnifiedSpecificSettings';
const { settings: { textSettings }, updateTextSettings } = useUnifiedTextPreview();

// ✅ AFTER:
import { useTextSettingsFromProvider } from '../../../../../providers/DxfSettingsProvider';
const { settings: textSettings, updateSettings: updateTextSettings } = useTextSettingsFromProvider();
```

**Files Changed**:
- `src/subapps/dxf-viewer/ui/components/dxf-settings/settings/core/TextSettings.tsx` (lines 46, 195)

**Why This Was Critical**:
- **localStorage Mismatch**: TextSettings wrote to `dxf-text-preview-settings` but preview read from `dxf-text-general-settings`
- **Silent Failure**: No errors, no warnings - changes just "disappeared"
- **User Confusion**: Settings UI showed changes but preview didn't update
- **Architecture Violation**: "Γενικές Ρυθμίσεις" component using "Preview-specific" hook

**Impact**:
- ✅ Text settings now update preview immediately
- ✅ Global General Settings write to correct localStorage key
- ✅ Architecture consistency: Global settings components use global hooks
- ✅ fontSize changes from A↑/A↓ buttons now work perfectly!

**Testing Done**:
1. ✅ Open "Γενικές Ρυθμίσεις → Κείμενο"
2. ✅ Change fontSize (A↑ button 5 times)
3. ✅ Preview "125.50" text updates immediately
4. ✅ localStorage `dxf-text-general-settings` updated correctly
5. ✅ Build passes with no errors

**Lessons Learned**:
- Always verify hook usage matches component context (Global vs Specific vs Preview)
- Check localStorage keys when debugging "settings not saving" issues
- Document hook purposes clearly to prevent misuse

---

### Related Issues (Previously Fixed)

**Issue #3**: Template Overrides Not Showing in Preview
- **Fixed**: `useLineSettingsFromProvider` now returns `effectiveLineSettings` (merged template + overrides)
- **File**: `DxfSettingsProvider.tsx` lines 1643-1699

**Issue #4**: "Εμφάνιση γραμμής" Checkbox Not Hiding Lines
- **Fixed**: Added `state.templateOverrides.line` to useEffect dependencies
- **File**: `DxfSettingsProvider.tsx` line 1577

---

**Last Updated**: 2025-10-06 (17:15 - Issue #7 CRITICAL FIX)
**Status**: ✅ COMPLETE & VERIFIED
**Maintainer**: Claude Code (Anthropic AI) + Γιώργος Pagonis
