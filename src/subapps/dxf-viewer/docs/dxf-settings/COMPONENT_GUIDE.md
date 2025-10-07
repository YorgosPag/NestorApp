# 📘 DXF SETTINGS PANEL - COMPONENT GUIDE

---

**📋 Document Type:** Component Reference Guide
**🎯 Scope:** All components in DxfSettingsPanel module
**👤 Architect:** Γιώργος Παγωνής
**🤖 Developer:** Claude (Anthropic AI)
**📅 Created:** 2025-10-07
**📅 Last Updated:** 2025-10-07
**📊 Status:** DRAFT - Pre-Refactoring

---

## 📖 TABLE OF CONTENTS

1. [Overview](#overview)
2. [Component Catalog](#component-catalog)
3. [Core Components](#core-components)
4. [Panel Components](#panel-components)
5. [Tab Components](#tab-components)
6. [Category Components](#category-components)
7. [Settings Components](#settings-components)
8. [Shared Components](#shared-components)
9. [Hook Components](#hook-components)
10. [Testing Guidelines](#testing-guidelines)

---

## 🎯 OVERVIEW

This guide provides detailed reference for **every component** in the DxfSettingsPanel module.

### Component Types

| Type | Count | Purpose | Examples |
|------|-------|---------|----------|
| **Root** | 1 | Main entry point | `DxfSettingsPanel` |
| **Panels** | 2 | Routing containers | `GeneralSettingsPanel`, `SpecificSettingsPanel` |
| **Tabs** | 3 | General settings UI | `LinesTab`, `TextTab`, `GripsTab` |
| **Categories** | 7 | Specific settings UI | `CursorCategory`, `GridCategory`, etc. |
| **Settings** | 7 | Reusable settings UI | `LineSettings`, `TextSettings`, etc. |
| **Shared** | 6 | Utility components | `TabNavigation`, `LinePreview`, etc. |
| **Hooks** | 3 | Custom React hooks | `useTabNavigation`, etc. |

**Total:** 29 components

---

## 📚 COMPONENT CATALOG

### Quick Reference Table

| Component | Type | Size | Complexity | Test Priority |
|-----------|------|------|------------|---------------|
| `DxfSettingsPanel` | Root | 150 lines | 🟢 Low | ⭐⭐⭐ High |
| `GeneralSettingsPanel` | Panel | 120 lines | 🟢 Low | ⭐⭐⭐ High |
| `SpecificSettingsPanel` | Panel | 150 lines | 🟡 Medium | ⭐⭐⭐ High |
| `LinesTab` | Tab | 200 lines | 🟡 Medium | ⭐⭐ Medium |
| `TextTab` | Tab | 200 lines | 🟡 Medium | ⭐⭐ Medium |
| `GripsTab` | Tab | 200 lines | 🟡 Medium | ⭐⭐ Medium |
| `CursorCategory` | Category | 300 lines | 🟡 Medium | ⭐⭐ Medium |
| `SelectionCategory` | Category | 300 lines | 🟡 Medium | ⭐⭐ Medium |
| `GridCategory` | Category | 400 lines | 🔴 High | ⭐⭐⭐ High |
| `GripsCategory` | Category | 100 lines | 🟢 Low | ⭐ Low |
| `LayersCategory` | Category | 200 lines | 🟡 Medium | ⭐⭐ Medium |
| `EntitiesCategory` | Category | 600 lines | 🔴 High | ⭐⭐⭐ High |
| `LightingCategory` | Category | 100 lines | 🟢 Low | ⭐ Low |
| `LineSettings` | Settings | 300 lines | 🟡 Medium | ⭐⭐ Medium |
| `TextSettings` | Settings | 300 lines | 🟡 Medium | ⭐⭐ Medium |
| `GripSettings` | Settings | 300 lines | 🟡 Medium | ⭐⭐ Medium |
| `TabNavigation` | Shared | 80 lines | 🟢 Low | ⭐⭐⭐ High |
| `CategoryButton` | Shared | 50 lines | 🟢 Low | ⭐⭐ Medium |
| `useTabNavigation` | Hook | 50 lines | 🟢 Low | ⭐⭐⭐ High |

---

## 🏛️ CORE COMPONENTS

### 1. DxfSettingsPanel (Root Component)

**File:** `dxf-settings/DxfSettingsPanel.tsx`

**Responsibility:** Main entry point for settings panel. Handles top-level tab routing (General vs Specific).

#### API

```typescript
export interface DxfSettingsPanelProps {
  className?: string;
  defaultTab?: 'general' | 'specific';
}

export const DxfSettingsPanel: React.FC<DxfSettingsPanelProps>;
```

#### State

```typescript
const { activeTab, setActiveTab } = useTabNavigation('specific');
// activeTab: 'general' | 'specific'
```

#### Renders

- `TabNavigation` (2 buttons: Γενικές, Ειδικές)
- `GeneralSettingsPanel` (when activeTab === 'general')
- `SpecificSettingsPanel` (when activeTab === 'specific')

#### Example Usage

```typescript
// In usePanelContentRenderer.tsx
case 'colors':
  return <DxfSettingsPanel defaultTab="specific" />;
```

#### Testing

```typescript
describe('DxfSettingsPanel', () => {
  it('renders with default tab "specific"', () => {
    render(<DxfSettingsPanel />);
    expect(screen.getByText('Ειδικές Ρυθμίσεις')).toHaveClass('bg-blue-600');
  });

  it('switches to general tab on button click', () => {
    render(<DxfSettingsPanel />);
    fireEvent.click(screen.getByText('Γενικές Ρυθμίσεις'));
    expect(screen.getByTestId('general-settings-panel')).toBeInTheDocument();
  });

  it('preserves active tab state across re-renders', () => {
    const { rerender } = render(<DxfSettingsPanel />);
    fireEvent.click(screen.getByText('Γενικές Ρυθμίσεις'));
    rerender(<DxfSettingsPanel />);
    expect(screen.getByTestId('general-settings-panel')).toBeInTheDocument();
  });
});
```

---

## 📦 PANEL COMPONENTS

### 2. GeneralSettingsPanel

**File:** `dxf-settings/panels/GeneralSettingsPanel.tsx`

**Responsibility:** Sub-tab routing for General Settings (Lines, Text, Grips).

#### API

```typescript
export interface GeneralSettingsPanelProps {
  defaultTab?: 'lines' | 'text' | 'grips';
  className?: string;
}

export const GeneralSettingsPanel: React.FC<GeneralSettingsPanelProps>;
```

#### State

```typescript
const { activeTab, setActiveTab } = useTabNavigation('lines');
// activeTab: 'lines' | 'text' | 'grips'
```

#### Renders

- `TabNavigation` (3 buttons: Γραμμές, Κείμενο, Grips)
- `LazyLinesTab` (lazy loaded)
- `LazyTextTab` (lazy loaded)
- `LazyGripsTab` (lazy loaded)

#### Lazy Loading

```typescript
const LazyLinesTab = lazy(() => import('../tabs/general/LinesTab'));
const LazyTextTab = lazy(() => import('../tabs/general/TextTab'));
const LazyGripsTab = lazy(() => import('../tabs/general/GripsTab'));
```

#### Example Usage

```typescript
// In DxfSettingsPanel.tsx
{activeMainTab === 'general' && <GeneralSettingsPanel />}
```

#### Testing

```typescript
describe('GeneralSettingsPanel', () => {
  it('renders 3 sub-tabs', () => {
    render(<GeneralSettingsPanel />);
    expect(screen.getByText('Γραμμές')).toBeInTheDocument();
    expect(screen.getByText('Κείμενο')).toBeInTheDocument();
    expect(screen.getByText('Grips')).toBeInTheDocument();
  });

  it('lazy loads LinesTab on mount', async () => {
    render(<GeneralSettingsPanel defaultTab="lines" />);
    await waitFor(() => {
      expect(screen.getByTestId('lines-tab')).toBeInTheDocument();
    });
  });

  it('switches tabs and loads components lazily', async () => {
    render(<GeneralSettingsPanel defaultTab="lines" />);
    fireEvent.click(screen.getByText('Κείμενο'));
    await waitFor(() => {
      expect(screen.getByTestId('text-tab')).toBeInTheDocument();
    });
  });
});
```

---

### 3. SpecificSettingsPanel

**File:** `dxf-settings/panels/SpecificSettingsPanel.tsx`

**Responsibility:** Category routing for Specific Settings (7 categories).

#### API

```typescript
export type CategoryId =
  | 'cursor'
  | 'selection'
  | 'grid'
  | 'grips'
  | 'layers'
  | 'entities'
  | 'lighting';

export interface SpecificSettingsPanelProps {
  defaultCategory?: CategoryId;
  className?: string;
}

export const SpecificSettingsPanel: React.FC<SpecificSettingsPanelProps>;
```

#### State

```typescript
const { activeCategory, setActiveCategory } = useCategoryNavigation('selection');
// activeCategory: CategoryId
```

#### Renders

- Category icons navigation (7 buttons)
- Lazy loaded category components

#### Category Configuration

```typescript
const categories = [
  { id: 'cursor', title: 'Crosshair & Cursor', icon: <CrosshairIcon />, comingSoon: false },
  { id: 'selection', title: 'Selection Boxes', icon: <SelectionIcon />, comingSoon: false },
  { id: 'grid', title: 'Grid & Rulers', icon: <GridIcon />, comingSoon: false },
  { id: 'grips', title: 'Grips & Handles', icon: <GripsIcon />, comingSoon: true },
  { id: 'layers', title: 'Layer Colors', icon: <LayersIcon />, comingSoon: false },
  { id: 'entities', title: 'Entities', icon: <EntitiesIcon />, comingSoon: false },
  { id: 'lighting', title: 'Lighting & Effects', icon: <LightingIcon />, comingSoon: true }
];
```

#### Example Usage

```typescript
// In DxfSettingsPanel.tsx
{activeMainTab === 'specific' && <SpecificSettingsPanel />}
```

#### Testing

```typescript
describe('SpecificSettingsPanel', () => {
  it('renders 7 category buttons', () => {
    render(<SpecificSettingsPanel />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(7);
  });

  it('marks "Coming Soon" categories as disabled', () => {
    render(<SpecificSettingsPanel />);
    const gripsButton = screen.getByTitle(/Grips & Handles/i);
    expect(gripsButton).toBeDisabled();
  });

  it('switches categories correctly', async () => {
    render(<SpecificSettingsPanel defaultCategory="selection" />);
    fireEvent.click(screen.getByTitle(/Grid & Rulers/i));
    await waitFor(() => {
      expect(screen.getByTestId('grid-category')).toBeInTheDocument();
    });
  });
});
```

---

## 📑 TAB COMPONENTS

### 4. LinesTab

**File:** `dxf-settings/tabs/general/LinesTab.tsx`

**Responsibility:** UI for General Settings → Lines tab.

#### API

```typescript
export interface LinesTabProps {
  className?: string;
}

export const LinesTab: React.FC<LinesTabProps>;
```

#### Hooks Used

```typescript
const lineSettings = useLineSettingsFromProvider();
const linePreviewHook = useUnifiedLinePreview();
const effectiveLineSettings = linePreviewHook.getEffectiveLineSettings();
```

#### Renders

```typescript
<div className="p-4 space-y-4">
  {/* Preview Section */}
  <LinePreview
    lineSettings={effectiveLineSettings}
    textSettings={effectiveTextSettings}
    gripSettings={effectiveGripSettings}
  />

  {/* Current Settings Display */}
  <CurrentSettingsDisplay
    activeTab="lines"
    lineSettings={lineSettings.settings}
    textSettings={textSettings.settings}
    gripSettings={gripSettings.settings}
  />

  {/* Line Settings */}
  <LineSettings />
</div>
```

#### Data Flow

```
User changes line color
     ↓
LineSettings onChange
     ↓
useLineSettingsFromProvider().update()
     ↓
DxfSettingsProvider updates
     ↓
LinePreview re-renders (new color)
```

#### Testing

```typescript
describe('LinesTab', () => {
  it('renders preview, display, and settings', () => {
    render(<LinesTab />);
    expect(screen.getByTestId('line-preview')).toBeInTheDocument();
    expect(screen.getByTestId('current-settings-display')).toBeInTheDocument();
    expect(screen.getByTestId('line-settings')).toBeInTheDocument();
  });

  it('updates preview when settings change', async () => {
    render(<LinesTab />);
    const colorInput = screen.getByLabelText(/line color/i);
    fireEvent.change(colorInput, { target: { value: '#FF0000' } });

    await waitFor(() => {
      const preview = screen.getByTestId('line-preview');
      expect(preview).toHaveStyle({ stroke: '#FF0000' });
    });
  });

  it('persists settings to provider', async () => {
    const { rerender } = render(<LinesTab />);
    const widthInput = screen.getByLabelText(/line width/i);
    fireEvent.change(widthInput, { target: { value: '2' } });

    rerender(<LinesTab />);
    expect(widthInput).toHaveValue(2);
  });
});
```

---

### 5. TextTab

**File:** `dxf-settings/tabs/general/TextTab.tsx`

**Responsibility:** UI for General Settings → Text tab.

#### API

```typescript
export interface TextTabProps {
  className?: string;
}

export const TextTab: React.FC<TextTabProps>;
```

**Similar structure to LinesTab** - see LinesTab for details.

#### Hooks Used

```typescript
const textSettings = useTextSettingsFromProvider();
const textPreviewHook = useUnifiedTextPreview();
```

---

### 6. GripsTab

**File:** `dxf-settings/tabs/general/GripsTab.tsx`

**Responsibility:** UI for General Settings → Grips tab.

#### API

```typescript
export interface GripsTabProps {
  className?: string;
}

export const GripsTab: React.FC<GripsTabProps>;
```

**Similar structure to LinesTab** - see LinesTab for details.

#### Hooks Used

```typescript
const gripSettings = useGripSettingsFromProvider();
const gripPreviewHook = useUnifiedGripPreview();
```

---

## 🗂️ CATEGORY COMPONENTS

### 7. CursorCategory

**File:** `dxf-settings/categories/CursorCategory.tsx`

**Responsibility:** Cursor & Crosshair settings UI.

#### API

```typescript
export interface CursorCategoryProps {
  className?: string;
}

export const CursorCategory: React.FC<CursorCategoryProps>;
```

#### State

```typescript
const [activeSubTab, setActiveSubTab] = useState<'crosshair' | 'cursor'>('crosshair');
```

#### Hooks Used

```typescript
const { settings, updateSettings } = useCursorSettings();
```

#### Sub-tabs

1. **Crosshair:** Crosshair appearance settings
2. **Cursor:** Cursor appearance settings

#### Testing

```typescript
describe('CursorCategory', () => {
  it('renders 2 sub-tabs', () => {
    render(<CursorCategory />);
    expect(screen.getByText(/Crosshair/i)).toBeInTheDocument();
    expect(screen.getByText(/Cursor/i)).toBeInTheDocument();
  });

  it('switches between sub-tabs', () => {
    render(<CursorCategory />);
    fireEvent.click(screen.getByText(/Cursor/i));
    expect(screen.getByTestId('cursor-settings')).toBeInTheDocument();
  });
});
```

---

### 8. GridCategory

**File:** `dxf-settings/categories/GridCategory.tsx`

**Responsibility:** Grid & Rulers settings UI (most complex category).

#### API

```typescript
export interface GridCategoryProps {
  className?: string;
}

export const GridCategory: React.FC<GridCategoryProps>;
```

#### State

```typescript
const [activeSubTab, setActiveSubTab] = useState<'grid' | 'rulers'>('grid');
const [activeGridLinesTab, setActiveGridLinesTab] = useState<'major' | 'minor'>('major');
const [activeRulerTab, setActiveRulerTab] = useState<'background' | 'lines' | 'text' | 'units'>('background');
```

#### Hooks Used

```typescript
const { gridSettings, rulerSettings, updateGridSettings, updateRulerSettings } = useRulersGridContext();
```

#### Sub-tabs Hierarchy

```
Grid
├── Major Lines
└── Minor Lines

Rulers
├── Background
├── Lines
├── Text
└── Units
```

**Total:** 6 sub-tabs (most complex!)

#### Testing

```typescript
describe('GridCategory', () => {
  it('renders grid and rulers tabs', () => {
    render(<GridCategory />);
    expect(screen.getByText(/Grid/i)).toBeInTheDocument();
    expect(screen.getByText(/Rulers/i)).toBeInTheDocument();
  });

  it('switches to rulers and shows 4 sub-tabs', () => {
    render(<GridCategory />);
    fireEvent.click(screen.getByText(/Rulers/i));

    expect(screen.getByText(/Background/i)).toBeInTheDocument();
    expect(screen.getByText(/Lines/i)).toBeInTheDocument();
    expect(screen.getByText(/Text/i)).toBeInTheDocument();
    expect(screen.getByText(/Units/i)).toBeInTheDocument();
  });

  it('updates grid major lines settings', async () => {
    render(<GridCategory />);
    const colorInput = screen.getByLabelText(/major lines color/i);
    fireEvent.change(colorInput, { target: { value: '#00FF00' } });

    await waitFor(() => {
      expect(screen.getByTestId('grid-preview')).toHaveStyle({ stroke: '#00FF00' });
    });
  });
});
```

---

### 9. EntitiesCategory

**File:** `dxf-settings/categories/EntitiesCategory.tsx`

**Responsibility:** Entities settings UI (most complex component - 600 lines).

#### API

```typescript
export interface EntitiesCategoryProps {
  className?: string;
}

export const EntitiesCategory: React.FC<EntitiesCategory Props>;
```

#### State

```typescript
const [selectedTool, setSelectedTool] = useState<string | null>(null);
const [activeSpecificTab, setActiveSpecificTab] = useState<'drawing' | 'measurements'>('drawing');
const [activeLineTab, setActiveLineTab] = useState<'draft' | 'completion' | 'hover' | 'selection' | null>(null);
```

#### Tool Categories

1. **Drawing Tools (5):**
   - Line, Rectangle, Circle, Polyline, Polygon

2. **Measurement Tools (3):**
   - Distance, Area, Angle

#### Line Tool - 4 Phases

When user clicks "Line" tool:

```
Draft (Προσχεδίαση)
├── Lines settings
├── Text settings
└── Grips settings

Completion (Ολοκλήρωση)
├── Lines settings
├── Text settings
└── Grips settings

Hover
└── Lines settings

Selection (Επιλογή)
└── Lines settings
```

**Total:** 4 phases × (1-3 sub-tabs each) = 10 sub-tabs

#### Hooks Used

```typescript
const { settings: draftSettings, updateSettings: updateDraftSettings } = useUnifiedLineDraft();
const { settings: completionSettings } = useUnifiedLineCompletion();
const { settings: hoverSettings } = useUnifiedLineHover();
const { settings: selectionSettings } = useUnifiedLineSelection();
```

#### Testing

```typescript
describe('EntitiesCategory', () => {
  it('renders drawing and measurements tabs', () => {
    render(<EntitiesCategory />);
    expect(screen.getByText(/Σχεδίαση/i)).toBeInTheDocument();
    expect(screen.getByText(/Μετρήσεις/i)).toBeInTheDocument();
  });

  it('shows 5 drawing tool icons', () => {
    render(<EntitiesCategory />);
    const icons = screen.getAllByTestId(/tool-icon/i);
    expect(icons).toHaveLength(5);
  });

  it('expands line tool settings on click', () => {
    render(<EntitiesCategory />);
    fireEvent.click(screen.getByTitle(/Γραμμή/i));
    expect(screen.getByText(/Προσχεδίαση/i)).toBeInTheDocument();
    expect(screen.getByText(/Ολοκλήρωση/i)).toBeInTheDocument();
  });

  it('shows 3 sub-tabs in Draft phase', () => {
    render(<EntitiesCategory />);
    fireEvent.click(screen.getByTitle(/Γραμμή/i));
    fireEvent.click(screen.getByText(/Προσχεδίαση/i));

    expect(screen.getByText(/Γραμμές/i)).toBeInTheDocument();
    expect(screen.getByText(/Κείμενο/i)).toBeInTheDocument();
    expect(screen.getByText(/Grips/i)).toBeInTheDocument();
  });
});
```

---

## ⚙️ SETTINGS COMPONENTS

### 10. LineSettings

**File:** `dxf-settings/settings/core/LineSettings.tsx`

**Responsibility:** Reusable line properties UI (ISO 128 standards).

#### API

```typescript
export interface LineSettingsProps {
  settings?: LineSettings;
  onUpdate?: (settings: Partial<LineSettings>) => void;
  showOverrideToggle?: boolean;
  overrideSettings?: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    description?: string;
  };
}

export const LineSettings: React.FC<LineSettingsProps>;
```

#### Settings Schema

```typescript
interface LineSettings {
  lineType: 'solid' | 'dashed' | 'dotted' | 'dashdot';
  lineWidth: number; // 0.1 - 10 mm (ISO 128)
  color: string; // Hex color
  opacity: number; // 0-100%
  dashScale: number; // 0.1 - 10
  dashOffset: number; // 0 - 100
  lineCap: 'butt' | 'round' | 'square';
  lineJoin: 'miter' | 'round' | 'bevel';
  breakAtCenter: boolean;
  activeTemplate: string | null;
}
```

#### Validation Rules

```typescript
const validation = {
  lineWidth: { min: 0.1, max: 10, step: 0.05 },
  opacity: { min: 0, max: 100, step: 1 },
  dashScale: { min: 0.1, max: 10, step: 0.1 },
  dashOffset: { min: 0, max: 100, step: 1 }
};
```

#### Testing

```typescript
describe('LineSettings', () => {
  it('renders all line property controls', () => {
    render(<LineSettings />);
    expect(screen.getByLabelText(/Line Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Line Width/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Color/i)).toBeInTheDocument();
  });

  it('enforces ISO 128 min/max limits', () => {
    render(<LineSettings />);
    const widthInput = screen.getByLabelText(/Line Width/i);

    fireEvent.change(widthInput, { target: { value: '0.05' } }); // Below min
    expect(widthInput).toHaveValue(0.1); // Clamped to min

    fireEvent.change(widthInput, { target: { value: '15' } }); // Above max
    expect(widthInput).toHaveValue(10); // Clamped to max
  });

  it('calls onUpdate when settings change', () => {
    const onUpdate = jest.fn();
    render(<LineSettings onUpdate={onUpdate} />);

    const colorPicker = screen.getByLabelText(/Color/i);
    fireEvent.change(colorPicker, { target: { value: '#FF0000' } });

    expect(onUpdate).toHaveBeenCalledWith({ color: '#FF0000' });
  });
});
```

---

## 🔗 SHARED COMPONENTS

### 11. TabNavigation (Generic Tab Component)

**File:** `dxf-settings/shared/TabNavigation.tsx`

**Responsibility:** Reusable tab navigation UI.

#### API

```typescript
export interface TabConfig {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface TabNavigationProps {
  tabs: TabConfig[];
  activeTab: string | null;
  onTabClick: (tabId: string) => void;
  className?: string;
  variant?: 'default' | 'pills' | 'underline';
}

export const TabNavigation: React.FC<TabNavigationProps>;
```

#### Example Usage

```typescript
// In GeneralSettingsPanel
const tabs = [
  { id: 'lines', label: 'Γραμμές' },
  { id: 'text', label: 'Κείμενο' },
  { id: 'grips', label: 'Grips' }
];

<TabNavigation
  tabs={tabs}
  activeTab={activeTab}
  onTabClick={setActiveTab}
  variant="pills"
/>
```

#### Variants

```typescript
// 'default' - Standard buttons with borders
// 'pills' - Rounded pill-shaped buttons
// 'underline' - Tabs with bottom border highlight
```

#### Testing

```typescript
describe('TabNavigation', () => {
  it('renders all tabs', () => {
    const tabs = [
      { id: '1', label: 'Tab 1' },
      { id: '2', label: 'Tab 2' }
    ];
    render(<TabNavigation tabs={tabs} activeTab="1" onTabClick={jest.fn()} />);
    expect(screen.getByText('Tab 1')).toBeInTheDocument();
    expect(screen.getByText('Tab 2')).toBeInTheDocument();
  });

  it('highlights active tab', () => {
    const tabs = [{ id: '1', label: 'Tab 1' }, { id: '2', label: 'Tab 2' }];
    render(<TabNavigation tabs={tabs} activeTab="1" onTabClick={jest.fn()} />);
    expect(screen.getByText('Tab 1')).toHaveClass('bg-blue-600');
  });

  it('calls onTabClick with correct ID', () => {
    const onTabClick = jest.fn();
    const tabs = [{ id: '1', label: 'Tab 1' }];
    render(<TabNavigation tabs={tabs} activeTab="1" onTabClick={onTabClick} />);
    fireEvent.click(screen.getByText('Tab 1'));
    expect(onTabClick).toHaveBeenCalledWith('1');
  });

  it('disables tabs when disabled prop is true', () => {
    const tabs = [{ id: '1', label: 'Tab 1', disabled: true }];
    render(<TabNavigation tabs={tabs} activeTab="1" onTabClick={jest.fn()} />);
    expect(screen.getByText('Tab 1')).toBeDisabled();
  });
});
```

---

## 🪝 HOOK COMPONENTS

### 12. useTabNavigation

**File:** `dxf-settings/hooks/useTabNavigation.ts`

**Responsibility:** Generic tab state management.

#### API

```typescript
export type TabId = string;

export interface UseTabNavigationReturn {
  activeTab: TabId | null;
  setActiveTab: (tabId: TabId) => void;
  isTabActive: (tabId: TabId) => boolean;
  resetTab: () => void;
}

export function useTabNavigation(
  defaultTab: TabId | null = null
): UseTabNavigationReturn;
```

#### Implementation

```typescript
export function useTabNavigation(defaultTab: TabId | null = null): UseTabNavigationReturn {
  const [activeTab, setActiveTab] = useState<TabId | null>(defaultTab);

  const isTabActive = useCallback(
    (tabId: TabId) => activeTab === tabId,
    [activeTab]
  );

  const resetTab = useCallback(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  return {
    activeTab,
    setActiveTab,
    isTabActive,
    resetTab
  };
}
```

#### Example Usage

```typescript
// In GeneralSettingsPanel
const { activeTab, setActiveTab, isTabActive } = useTabNavigation('lines');

// Later:
<button onClick={() => setActiveTab('text')}>
  Text
</button>
{isTabActive('text') && <TextTab />}
```

#### Testing

```typescript
describe('useTabNavigation', () => {
  it('initializes with default tab', () => {
    const { result } = renderHook(() => useTabNavigation('lines'));
    expect(result.current.activeTab).toBe('lines');
  });

  it('updates active tab', () => {
    const { result } = renderHook(() => useTabNavigation('lines'));
    act(() => {
      result.current.setActiveTab('text');
    });
    expect(result.current.activeTab).toBe('text');
  });

  it('isTabActive returns correct boolean', () => {
    const { result } = renderHook(() => useTabNavigation('lines'));
    expect(result.current.isTabActive('lines')).toBe(true);
    expect(result.current.isTabActive('text')).toBe(false);
  });

  it('resetTab returns to default', () => {
    const { result } = renderHook(() => useTabNavigation('lines'));
    act(() => {
      result.current.setActiveTab('text');
      result.current.resetTab();
    });
    expect(result.current.activeTab).toBe('lines');
  });
});
```

---

## 🧪 TESTING GUIDELINES

### Test Coverage Targets

| Component Type | Target Coverage | Priority |
|----------------|-----------------|----------|
| **Root** (DxfSettingsPanel) | 90%+ | ⭐⭐⭐ Critical |
| **Panels** | 85%+ | ⭐⭐⭐ Critical |
| **Tabs** | 80%+ | ⭐⭐ High |
| **Categories** | 75%+ | ⭐⭐ High |
| **Settings** | 70%+ | ⭐ Medium |
| **Shared** | 90%+ | ⭐⭐⭐ Critical |
| **Hooks** | 95%+ | ⭐⭐⭐ Critical |

### Test Types

#### 1. Unit Tests

**Test each component in isolation.**

```typescript
// LinesTab.test.tsx
describe('LinesTab', () => {
  it('renders without crashing', () => { /* ... */ });
  it('displays preview component', () => { /* ... */ });
  it('updates settings on user input', () => { /* ... */ });
});
```

#### 2. Integration Tests

**Test component interactions.**

```typescript
// GeneralSettingsPanel.integration.test.tsx
describe('GeneralSettingsPanel Integration', () => {
  it('switches tabs and loads content', async () => {
    render(<GeneralSettingsPanel />);

    // Start on Lines tab
    expect(screen.getByTestId('lines-tab')).toBeInTheDocument();

    // Switch to Text tab
    fireEvent.click(screen.getByText('Κείμενο'));
    await waitFor(() => {
      expect(screen.getByTestId('text-tab')).toBeInTheDocument();
    });
  });

  it('persists settings across tab switches', async () => {
    render(<GeneralSettingsPanel />);

    // Change line color in Lines tab
    const colorInput = screen.getByLabelText(/Line Color/i);
    fireEvent.change(colorInput, { target: { value: '#FF0000' } });

    // Switch to Text tab and back
    fireEvent.click(screen.getByText('Κείμενο'));
    fireEvent.click(screen.getByText('Γραμμές'));

    // Color should persist
    await waitFor(() => {
      expect(colorInput).toHaveValue('#FF0000');
    });
  });
});
```

#### 3. Visual Regression Tests

**Ensure UI matches design.**

```typescript
// LinesTab.visual.test.ts (Playwright)
test('LinesTab matches snapshot', async ({ page }) => {
  await page.goto('/dxf/viewer');
  await page.click('text=Ρυθμίσεις DXF');
  await page.click('text=Γενικές Ρυθμίσεις');
  await page.click('text=Γραμμές');

  const screenshot = await page.screenshot();
  expect(screenshot).toMatchSnapshot('lines-tab.png', {
    maxDiffPixelRatio: 0.01 // 1% tolerance
  });
});
```

#### 4. Accessibility Tests

**Ensure WCAG 2.1 AA compliance.**

```typescript
// LinesTab.a11y.test.tsx
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('LinesTab Accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<LinesTab />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('supports keyboard navigation', () => {
    render(<LinesTab />);
    const firstInput = screen.getAllByRole('spinbutton')[0];
    firstInput.focus();
    expect(firstInput).toHaveFocus();
  });
});
```

---

## 📚 REFERENCES

### Internal Documentation
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md) - State strategy
- [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) - Testing approach
- [DECISION_LOG.md](./DECISION_LOG.md) - Design decisions

### Component Examples
- AutoCAD Ribbon Panels (Autodesk)
- SolidWorks FeatureManager (Dassault)
- Figma Properties Panel
- VS Code Settings UI

---

## 📝 CHANGELOG

| Date | Author | Changes |
|------|--------|---------|
| 2025-10-07 | Claude | Initial draft - All 29 components documented |

---

**END OF COMPONENT GUIDE**
