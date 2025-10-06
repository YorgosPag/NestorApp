# CHAPTER 02 - COLORPALETTEPANEL

**DXF Viewer Settings System - Enterprise Documentation**
**Created**: 2025-10-06
**Status**: ✅ Complete (Expanded)
**Author**: Claude Code (Anthropic AI) + Γιώργος Παγώνης

---

## 📋 TABLE OF CONTENTS

1. [Overview](#overview)
2. [Component Architecture](#component-architecture)
3. [Main Tabs System](#main-tabs-system)
4. [Γενικές Ρυθμίσεις (General Settings)](#γενικές-ρυθμίσεις-general-settings)
5. [Ειδικές Ρυθμίσεις (Specific Settings)](#ειδικές-ρυθμίσεις-specific-settings)
6. [State Management](#state-management)
7. [Settings Integration](#settings-integration)
8. [Event Handlers](#event-handlers)
9. [Sub-Components](#sub-components)
10. [Props & Interfaces](#props--interfaces)

---

## 1. OVERVIEW

### Βασικές Πληροφορίες

**File**: `src/subapps/dxf-viewer/ui/components/ColorPalettePanel.tsx`

**Size**: 2,200+ lines

**Purpose**: Κεντρικό UI component για διαχείριση **ΟΛΩΝ** των DXF Viewer settings

**Responsibilities**:
- 🎨 Settings UI rendering (tabs, accordions, controls)
- 🔄 User interaction handling (clicks, changes, toggles)
- 📡 Settings synchronization (με DxfSettingsProvider)
- 💾 Real-time updates (auto-save via provider)
- 🎯 Context-aware rendering (General vs Specific vs Preview vs Completion)

---

### Component Props

```typescript
export interface ColorPalettePanelProps {
  className?: string;  // Optional CSS class
}

// Usage:
<ColorPalettePanel className="custom-panel" />
```

---

## 2. COMPONENT ARCHITECTURE

### Complete Component Tree

```
ColorPalettePanel (Root)
│
├─ Main Tabs Navigation
│  ├─ 📋 Γενικές Ρυθμίσεις (General)
│  └─ ⚙️ Ειδικές Ρυθμίσεις (Specific)
│
├─ [IF activeMainTab === 'general']
│  │
│  ├─ General Sub-Tabs
│  │  ├─ Lines
│  │  ├─ Text
│  │  └─ Grips
│  │
│  └─ Active General Tab Content
│     ├─ [IF activeGeneralTab === 'lines']
│     │  └─ <LineSettings contextType="general" />
│     │
│     ├─ [IF activeGeneralTab === 'text']
│     │  └─ <TextSettings contextType="general" />
│     │
│     └─ [IF activeGeneralTab === 'grips']
│        └─ <GripSettings contextType="general" />
│
└─ [IF activeMainTab === 'specific']
   │
   ├─ Specific Categories (Icon-based navigation)
   │  ├─ 🎯 Cursor (CrosshairIcon)
   │  ├─ 🔲 Selection (SelectionIcon)
   │  ├─ 📐 Grid (GridIcon)
   │  ├─ 🔷 Grips (GripsIcon)
   │  ├─ 📄 Layers (LayersIcon)
   │  ├─ 🎨 Entities (EntitiesIcon) ← MOST IMPORTANT!
   │  └─ 💡 Lighting (LightingIcon)
   │
   └─ Active Category Content
      ├─ [IF activeCategory === 'cursor']
      │  └─ <CursorSettings />
      │     ├─ Crosshair sub-tab
      │     └─ Cursor sub-tab
      │
      ├─ [IF activeCategory === 'selection']
      │  └─ <SelectionSettings />
      │     ├─ Window selection sub-tab
      │     └─ Crossing selection sub-tab
      │
      ├─ [IF activeCategory === 'grid']
      │  └─ Grid & Rulers Settings
      │     ├─ Grid sub-tab
      │     │  ├─ Major lines
      │     │  └─ Minor lines
      │     └─ Rulers sub-tab
      │        ├─ Background
      │        ├─ Lines
      │        ├─ Text
      │        └─ Units
      │
      ├─ [IF activeCategory === 'grips']
      │  └─ <GripSettings contextType="specific" />
      │
      ├─ [IF activeCategory === 'layers']
      │  └─ <LayersSettings />
      │
      ├─ [IF activeCategory === 'entities'] ⭐ CRITICAL!
      │  └─ <EntitiesSettings />
      │     ├─ Preview Accordion
      │     │  ├─ <LineSettings contextType="preview" />
      │     │  ├─ <TextSettings contextType="preview" />
      │     │  └─ <GripSettings contextType="preview" />
      │     │
      │     └─ Completion Accordion
      │        ├─ <LineSettings contextType="completion" />
      │        ├─ <TextSettings contextType="completion" />
      │        └─ <GripSettings contextType="completion" />
      │
      └─ [IF activeCategory === 'lighting']
         └─ <ComingSoonSettings title="Lighting Settings" />
```

---

## 3. MAIN TABS SYSTEM

### Tab Types Definition

```typescript
type MainTab = 'general' | 'specific';
type GeneralTab = 'lines' | 'text' | 'grips';
type ColorCategory = 'cursor' | 'selection' | 'grid' | 'grips' | 'layers' | 'entities' | 'lighting';
```

---

### Main Tabs State

```typescript
// Main tabs (Γενικές vs Ειδικές)
const [activeMainTab, setActiveMainTab] = useState<MainTab>('specific');

// General sub-tabs (Lines, Text, Grips)
const [activeGeneralTab, setActiveGeneralTab] = useState<GeneralTab>('lines');

// Specific category selection
const [activeCategory, setActiveCategory] = useState<ColorCategory>('selection');
```

---

### Main Tabs Rendering

```typescript
// Main tabs navigation
<div className="main-tabs-navigation">
  <button
    className={activeMainTab === 'general' ? 'active' : ''}
    onClick={() => setActiveMainTab('general')}
  >
    📋 Γενικές Ρυθμίσεις
  </button>

  <button
    className={activeMainTab === 'specific' ? 'active' : ''}
    onClick={() => setActiveMainTab('specific')}
  >
    ⚙️ Ειδικές Ρυθμίσεις
  </button>
</div>

// Content based on active main tab
{activeMainTab === 'general' && <GeneralSettingsContent />}
{activeMainTab === 'specific' && <SpecificSettingsContent />}
```

---

## 4. ΓΕΝΙΚΕΣ ΡΥΘΜΙΣΕΙΣ (GENERAL SETTINGS)

### Purpose

**Γενικές Ρυθμίσεις** = Base layer settings που εφαρμόζονται σε **ΟΛΕΣ** τις φάσεις (normal, preview, completion).

**Hierarchy Position**: Foundation layer (lowest priority)

```
EFFECTIVE SETTINGS = GENERAL → SPECIFIC → OVERRIDES
                       ↑
                    This tab edits this layer
```

---

### Sub-Tabs Structure

#### 1. Lines Sub-Tab

**Component**: `<LineSettings contextType="general" />`

**Edits**: `DxfSettingsProvider.line` (general layer)

**Controls**:
- Color picker (default: #FFFFFF white)
- Line width slider (0.1 - 5.0 mm)
- Line type dropdown (solid, dashed, dotted, dashdot, etc.)
- Opacity slider (0% - 100%)
- Dash scale slider (0.1 - 5.0)
- Line cap selector (butt, round, square)
- Line join selector (miter, round, bevel)
- Dash offset slider
- Break at center toggle

**Code Example**:
```typescript
const { settings, updateSettings } = useLineSettingsFromProvider();

// User changes color
<ColorPicker
  value={settings.color}
  onChange={(color) => updateSettings({ color })}
/>

// User changes line width
<Slider
  value={settings.lineWidth}
  min={0.1}
  max={5.0}
  step={0.05}
  onChange={(width) => updateSettings({ lineWidth: width })}
/>
```

---

#### 2. Text Sub-Tab

**Component**: `<TextSettings contextType="general" />`

**Edits**: `DxfSettingsProvider.text` (general layer)

**Controls**:
- Font family selector (Arial, Times New Roman, Courier, etc.)
- Font size slider (8 - 72 pt)
- Font style checkboxes (bold, italic)
- Font weight selector (100 - 900)
- Color picker
- Opacity slider
- Text decorations (underline, strikethrough, overline)
- Text shadow toggle
- Text alignment (left, center, right)

**Code Example**:
```typescript
const { settings, updateSettings } = useTextSettingsFromProvider();

// User changes font size
<Slider
  value={settings.fontSize}
  min={8}
  max={72}
  onChange={(size) => updateSettings({ fontSize: size })}
/>
```

---

#### 3. Grips Sub-Tab

**Component**: `<GripSettings contextType="general" />`

**Edits**: `DxfSettingsProvider.grip` (general layer)

**Controls**:
- Grip size slider (3 - 20 px)
- Cold color picker (unselected entities)
- Warm color picker (hover state)
- Hot color picker (selected state)
- Contour color picker (grip outline)
- Opacity slider
- DPI scale slider
- Show grips toggle
- Show midpoints toggle
- Show centers toggle
- Show quadrants toggle
- Pick box size slider
- Aperture size slider

**Code Example**:
```typescript
const { gripSettings, updateGripSettings } = useGripContext();

// User changes grip size
<Slider
  value={gripSettings.gripSize}
  min={3}
  max={20}
  onChange={(size) => updateGripSettings({ gripSize: size })}
/>

// User changes cold color
<ColorPicker
  value={gripSettings.colors.cold}
  onChange={(color) => updateGripSettings({
    colors: { ...gripSettings.colors, cold: color }
  })}
/>
```

---

### General Settings Integration

```typescript
// General settings hook (no mode parameter)
const lineSettings = useLineSettingsFromProvider();

// Updates DxfSettingsProvider.line (general layer)
lineSettings.updateSettings({ color: '#FF0000' });

// Effective settings for preview mode
const previewStyles = useLineStyles('preview');
// → General + Specific Preview + Overrides
```

---

## 5. ΕΙΔΙΚΕΣ ΡΥΘΜΙΣΕΙΣ (SPECIFIC SETTINGS)

### Purpose

**Ειδικές Ρυθμίσεις** = Mode-specific και context-specific settings που **παρακάμπτουν** τα General.

**Categories**: 7 icon-based sections

---

### Category Configuration

```typescript
interface CategoryConfig {
  id: ColorCategory;
  title: string;
  description: string;
  icon: React.ReactNode;
  comingSoon?: boolean;
}

const categories: CategoryConfig[] = [
  {
    id: 'cursor',
    title: 'Cursor',
    description: 'Crosshair και cursor settings',
    icon: <CrosshairIcon />
  },
  {
    id: 'selection',
    title: 'Selection',
    description: 'Window και crossing selection',
    icon: <SelectionIcon />
  },
  {
    id: 'grid',
    title: 'Grid & Rulers',
    description: 'Grid spacing, rulers, axes',
    icon: <GridIcon />
  },
  {
    id: 'grips',
    title: 'Grips',
    description: 'Grip appearance και behavior',
    icon: <GripsIcon />
  },
  {
    id: 'layers',
    title: 'Layers',
    description: 'Layer colors και visibility',
    icon: <LayersIcon />
  },
  {
    id: 'entities',  // ⭐ MOST IMPORTANT!
    title: 'Entities',
    description: 'Preview και completion entity styles',
    icon: <EntitiesIcon />
  },
  {
    id: 'lighting',
    title: 'Lighting',
    description: 'Scene lighting (Coming Soon)',
    icon: <LightingIcon />,
    comingSoon: true
  }
];
```

---

### Categories Navigation Rendering

```typescript
<div className="specific-categories-navigation">
  {categories.map(category => (
    <button
      key={category.id}
      className={activeCategory === category.id ? 'active' : ''}
      onClick={() => setActiveCategory(category.id)}
      disabled={category.comingSoon}
      title={category.description}
    >
      {category.icon}
      <span>{category.title}</span>
      {category.comingSoon && <span className="badge">Soon</span>}
    </button>
  ))}
</div>
```

---

### Category 1: Cursor Settings

**Sub-Tabs**: Crosshair | Cursor

**State**:
```typescript
const [activeCursorTab, setActiveCursorTab] = useState<'crosshair' | 'cursor'>('crosshair');
```

**Integration**:
```typescript
const { settings, updateSettings } = useCursorSettings();

// Update crosshair size
updateSettings({ crosshairSize: 20 });

// Update crosshair color
updateSettings({
  crosshairColors: {
    ...settings.crosshairColors,
    horizontal: '#FF0000'
  }
});
```

**Controls**:
- Crosshair size slider
- Horizontal line color
- Vertical line color
- Crosshair opacity
- Cursor style selector

---

### Category 2: Selection Settings

**Sub-Tabs**: Window | Crossing

**State**:
```typescript
const [activeSelectionTab, setActiveSelectionTab] = useState<'window' | 'crossing'>('window');
```

**Controls**:
- Window selection color (default: blue)
- Window selection opacity
- Crossing selection color (default: green)
- Crossing selection opacity
- Selection box line width
- Selection box dash pattern

---

### Category 3: Grid & Rulers Settings

**Sub-Tabs**: Grid | Rulers

**State**:
```typescript
const [activeGridTab, setActiveGridTab] = useState<'grid' | 'rulers'>('grid');
const [activeGridLinesTab, setActiveGridLinesTab] = useState<'major' | 'minor'>('major');
const [activeRulerTab, setActiveRulerTab] = useState<'background' | 'lines' | 'text' | 'units'>('background');
```

**Integration**:
```typescript
const { state, updateGrid, updateRulers } = useRulersGridContext();

// Update grid major lines color
updateGrid({
  major: {
    ...state.grid.major,
    color: '#FF0000'
  }
});

// Update ruler background color
updateRulers({
  ...state.rulers,
  backgroundColor: '#1E1E1E'
});
```

**Grid Controls**:
- Enabled toggle
- Spacing slider (1 - 100)
- Major lines color
- Major lines width
- Minor lines color
- Minor lines width
- Grid opacity
- Snap to grid toggle

**Rulers Controls**:
- Horizontal ruler toggle
- Vertical ruler toggle
- Background color
- Lines color
- Text color
- Font size
- Units (mm, cm, m, inches, feet)

---

### Category 4: Grips Settings (Specific)

**Component**: `<GripSettings contextType="specific" />`

**Purpose**: Override general grip settings για specific contexts

---

### Category 5: Layers Settings

**Component**: `<LayersSettings />`

**Controls**:
- Layer list
- Layer visibility toggles
- Layer colors
- Layer freeze/thaw
- Layer lock/unlock

---

### Category 6: Entities Settings ⭐ **CRITICAL**

**Component**: `<EntitiesSettings />`

**Purpose**: Αυτό είναι το **πιο σημαντικό** section! Εδώ ορίζονται τα **Preview** και **Completion** settings.

**Structure**:
```typescript
<EntitiesSettings>
  {/* Preview Accordion */}
  <AccordionSection title="Preview Settings" defaultOpen={true}>
    <LineSettings contextType="preview" />
    <TextSettings contextType="preview" />
    <GripSettings contextType="preview" />
  </AccordionSection>

  {/* Completion Accordion */}
  <AccordionSection title="Completion Settings" defaultOpen={false}>
    <LineSettings contextType="completion" />
    <TextSettings contextType="completion" />
    <GripSettings contextType="completion" />
  </AccordionSection>
</EntitiesSettings>
```

**Preview Settings**:
- **Purpose**: Settings για temporary/construction entities (κατά τη σχεδίαση)
- **Default**: Yellow (#FFFF00), dashed, 70% opacity
- **Edits**: `DxfSettingsProvider.specific.line.preview`

**Completion Settings**:
- **Purpose**: Settings για final entities (μετά την ολοκλήρωση)
- **Default**: Green (#00FF00), solid, 100% opacity
- **Edits**: `DxfSettingsProvider.specific.line.completion`

**Integration Example**:
```typescript
// Preview settings
const { settings, updateLineSettings } = useUnifiedLinePreview();

// User changes preview color to red
updateLineSettings({ color: '#FF0000' });
// → Updates DxfSettingsProvider.specific.line.preview.color

// Completion settings
const { settings, updateLineSettings } = useUnifiedLineCompletion();

// User changes completion color to blue
updateLineSettings({ color: '#0000FF' });
// → Updates DxfSettingsProvider.specific.line.completion.color
```

---

### Category 7: Lighting Settings

**Component**: `<ComingSoonSettings title="Lighting Settings" />`

**Status**: Coming soon

**Future Controls**:
- Ambient light color
- Directional light position
- Shadow intensity
- Light intensity

---

## 6. STATE MANAGEMENT

### All State Variables

```typescript
// Main tabs
const [activeMainTab, setActiveMainTab] = useState<MainTab>('specific');
const [activeGeneralTab, setActiveGeneralTab] = useState<GeneralTab>('lines');
const [activeCategory, setActiveCategory] = useState<ColorCategory>('selection');

// Cursor sub-tabs
const [activeCursorTab, setActiveCursorTab] = useState<'crosshair' | 'cursor'>('crosshair');

// Selection sub-tabs
const [activeSelectionTab, setActiveSelectionTab] = useState<'window' | 'crossing'>('window');

// Grid & Rulers sub-tabs
const [activeGridTab, setActiveGridTab] = useState<'grid' | 'rulers'>('grid');
const [activeGridLinesTab, setActiveGridLinesTab] = useState<'major' | 'minor'>('major');
const [activeRulerTab, setActiveRulerTab] = useState<'background' | 'lines' | 'text' | 'units'>('background');
```

---

### State Persistence

**Question**: Μήπως το active tab state πρέπει να persist στο localStorage;

**Current**: Tabs reset on page reload

**Potential Enhancement**:
```typescript
// Save active tab to localStorage
useEffect(() => {
  localStorage.setItem('color-palette-active-main-tab', activeMainTab);
  localStorage.setItem('color-palette-active-category', activeCategory);
}, [activeMainTab, activeCategory]);

// Restore on mount
useEffect(() => {
  const savedMainTab = localStorage.getItem('color-palette-active-main-tab');
  if (savedMainTab) setActiveMainTab(savedMainTab as MainTab);

  const savedCategory = localStorage.getItem('color-palette-active-category');
  if (savedCategory) setActiveCategory(savedCategory as ColorCategory);
}, []);
```

---

## 7. SETTINGS INTEGRATION

### Hooks Used in ColorPalettePanel

```typescript
// General settings
import { useLineSettingsFromProvider } from '../../providers/DxfSettingsProvider';
import { useTextSettingsFromProvider } from '../../providers/DxfSettingsProvider';
import { useGripContext } from '../../providers/GripProvider';

// Specific settings
import { useUnifiedLinePreview } from '../../ui/hooks/useUnifiedSpecificSettings';
import { useUnifiedLineCompletion } from '../../ui/hooks/useUnifiedSpecificSettings';

// Special systems
import { useCursorSettings } from '../../systems/cursor';
import { useRulersGridContext } from '../../systems/rulers-grid/RulersGridSystem';
```

---

### Data Flow: User Input → Provider → Auto-Save

```
User clicks color picker in ColorPalettePanel
  ↓
LineSettings component: onChange handler
  ↓
useLineSettingsFromProvider(): updateSettings({ color: '#FF0000' })
  ↓
DxfSettingsProvider: dispatch({ type: 'UPDATE_LINE_SETTINGS', payload: { color: '#FF0000' } })
  ↓
Reducer updates state: { line: { ...line, color: '#FF0000' } }
  ↓
useEffect detects state change
  ↓
Debounce 500ms
  ↓
localStorage.setItem('dxf-settings-v1', JSON.stringify(state))
  ↓
React re-renders ColorPalettePanel (new color displayed) ✅
  ↓
useUnifiedDrawing reads new settings
  ↓
Next line drawn in red ✅
```

---

## 8. EVENT HANDLERS

### Color Change Handler

```typescript
const handleColorChange = (color: string) => {
  // Update settings via provider
  updateSettings({ color });

  // Settings automatically saved to localStorage (500ms debounce)
  // React automatically re-renders components using settings
};
```

---

### Tab Switch Handlers

```typescript
const handleMainTabChange = (tab: MainTab) => {
  setActiveMainTab(tab);

  // Optional: Save to localStorage
  localStorage.setItem('color-palette-active-main-tab', tab);
};

const handleCategoryChange = (category: ColorCategory) => {
  setActiveCategory(category);

  // Optional: Save to localStorage
  localStorage.setItem('color-palette-active-category', category);
};
```

---

### Slider Change Handlers

```typescript
const handleLineWidthChange = (width: number) => {
  // Debounce for performance (optional)
  const debouncedUpdate = debounce(() => {
    updateSettings({ lineWidth: width });
  }, 100);

  debouncedUpdate();
};
```

---

### Toggle Handlers

```typescript
const handleGridToggle = (enabled: boolean) => {
  updateGrid({ enabled });

  // Grid immediately shows/hides
};
```

---

## 9. SUB-COMPONENTS

### LineSettings

**File**: `ui/components/dxf-settings/settings/core/LineSettings.tsx`

**Props**:
```typescript
interface LineSettingsProps {
  contextType?: 'general' | 'preview' | 'completion';
}
```

**Features**:
- Context-aware (uses different hooks based on contextType)
- Complete line controls (color, width, type, opacity, etc.)
- Live preview of line appearance

---

### TextSettings

**File**: `ui/components/dxf-settings/settings/core/TextSettings.tsx`

**Props**:
```typescript
interface TextSettingsProps {
  contextType?: 'general' | 'preview' | 'completion';
}
```

**Features**:
- Font family selector
- Font size, style, weight controls
- Text decorations
- Color and opacity

---

### GripSettings

**File**: `ui/components/dxf-settings/settings/core/GripSettings.tsx`

**Props**:
```typescript
interface GripSettingsProps {
  contextType?: 'general' | 'preview' | 'completion';
}
```

**Features**:
- Grip size and colors (cold, warm, hot, contour)
- Show/hide toggles for grip types
- DPI scaling

---

### EntitiesSettings

**File**: `ui/components/dxf-settings/settings/special/EntitiesSettings.tsx`

**Features**:
- Preview accordion (yellow dashed settings)
- Completion accordion (green solid settings)
- Contains LineSettings, TextSettings, GripSettings for each mode

---

### AccordionSection

**Purpose**: Collapsible section wrapper

**Usage**:
```typescript
<AccordionSection title="Preview Settings" defaultOpen={true}>
  <LineSettings contextType="preview" />
</AccordionSection>
```

---

### CurrentSettingsDisplay

**Purpose**: Debug component showing current effective settings

**Features**:
- Shows General, Specific, Override layers
- Real-time updates
- Helpful for debugging settings hierarchy

---

## 10. PROPS & INTERFACES

### ColorPalettePanelProps

```typescript
export interface ColorPalettePanelProps {
  className?: string;  // Optional CSS class for styling
}
```

---

### CategoryConfig Interface

```typescript
interface CategoryConfig {
  id: ColorCategory;           // Unique category ID
  title: string;               // Display title
  description: string;         // Tooltip description
  icon: React.ReactNode;       // Icon component
  comingSoon?: boolean;        // Coming soon flag
}
```

---

### Type Definitions

```typescript
type MainTab = 'general' | 'specific';

type GeneralTab = 'lines' | 'text' | 'grips';

type ColorCategory = 'cursor' | 'selection' | 'grid' | 'grips' | 'layers' | 'entities' | 'lighting';
```

---

## 📚 CROSS-REFERENCES

### Related Documentation

- **[00-INDEX.md](./00-INDEX.md)** - Documentation hub
- **[01-ARCHITECTURE_OVERVIEW.md](./01-ARCHITECTURE_OVERVIEW.md)** - System architecture
- **[03-DXFSETTINGSPROVIDER.md](./03-DXFSETTINGSPROVIDER.md)** - Provider used by this UI
- **[04-HOOKS_REFERENCE.md](./04-HOOKS_REFERENCE.md)** - Hooks used in this component
- **[05-UI_COMPONENTS.md](./05-UI_COMPONENTS.md)** - Sub-components details
- **[07-MODE_SYSTEM.md](./07-MODE_SYSTEM.md)** - Preview/Completion modes
- **[08-LINE_DRAWING_INTEGRATION.md](./08-LINE_DRAWING_INTEGRATION.md)** - How settings are used

### Related Code Files

**Main Component**:
- [`ui/components/ColorPalettePanel.tsx`](../../ui/components/ColorPalettePanel.tsx) (2,200+ lines)
  - [Component Props](../../ui/components/ColorPalettePanel.tsx#L45-L47) (lines 45-47)
  - [State Variables](../../ui/components/ColorPalettePanel.tsx#L60-L85) (lines 60-85)
  - [Main Tabs Rendering](../../ui/components/ColorPalettePanel.tsx#L150-L200) (lines 150-200)
  - [Entities Settings Section](../../ui/components/ColorPalettePanel.tsx#L550-L650) (lines 550-650)

**Sub-Components**:
- [`ui/components/dxf-settings/settings/core/LineSettings.tsx`](../../ui/components/dxf-settings/settings/core/LineSettings.tsx) (952 lines)
- [`ui/components/dxf-settings/settings/core/TextSettings.tsx`](../../ui/components/dxf-settings/settings/core/TextSettings.tsx) (552 lines)
- [`ui/components/dxf-settings/settings/core/GripSettings.tsx`](../../ui/components/dxf-settings/settings/core/GripSettings.tsx) (464 lines)
- [`ui/components/dxf-settings/settings/special/EntitiesSettings.tsx`](../../ui/components/dxf-settings/settings/special/EntitiesSettings.tsx)

**Provider Integration**:
- [`providers/DxfSettingsProvider.tsx`](../../providers/DxfSettingsProvider.tsx) - Central state management

---

## 🎯 KEY TAKEAWAYS

1. **2 Main Tabs**: Γενικές (base layer) + Ειδικές (context-specific)
2. **7 Specific Categories**: Cursor, Selection, Grid, Grips, Layers, **Entities** ⭐, Lighting
3. **Entities Category**: Contains Preview + Completion accordions (MOST IMPORTANT!)
4. **Context-Aware Components**: LineSettings/TextSettings/GripSettings adapt to contextType
5. **Real-Time Sync**: All changes auto-save to DxfSettingsProvider → localStorage
6. **Complete State Management**: 10+ state variables for tab/accordion control
7. **Settings Hierarchy**: General → Specific → Overrides (UI edits all layers)

---

**END OF CHAPTER 02**

---

**Next Chapter**: [03 - DxfSettingsProvider →](./03-DXFSETTINGSPROVIDER.md)
**Previous Chapter**: [← 01 - Architecture Overview](./01-ARCHITECTURE_OVERVIEW.md)
**Back to Index**: [← Documentation Index](./00-INDEX.md)
