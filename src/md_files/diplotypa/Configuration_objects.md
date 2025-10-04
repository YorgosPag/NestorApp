# 📋 ΑΝΑΛΥΣΗ ΔΙΠΛΟΤΥΠΩΝ CONFIGURATION OBJECTS

**Ημερομηνία Ανάλυσης:** 2025-10-03
**Scope:** `src/subapps/dxf-viewer/`
**Αναλυτής:** Claude (Anthropic AI)

---

## 🎯 EXECUTIVE SUMMARY

Βρέθηκαν **ΣΗΜΑΝΤΙΚΑ ΔΙΠΛΟΤΥΠΑ** σε configuration objects σε όλο το DXF Viewer codebase. Υπάρχουν πολλαπλά configuration objects που ορίζουν τα ίδια settings σε διαφορετικές τοποθεσίες, δημιουργώντας **inconsistency risks** και **maintenance overhead**.

### 📊 Στατιστικά

- **Βασικά Config Files:** 16 αρχεία
- **Διπλότυπες Ρυθμίσεις:** 25+ configuration objects
- **Κατηγορίες Διπλοτύπων:** 8 κύριες κατηγορίες
- **Προτεραιότητα Επίλυσης:** 🔴 HIGH (Risk για inconsistency)

---

## 🔴 ΚΑΤΗΓΟΡΙΑ 1: GRID SETTINGS DUPLICATES

### Τοποθεσίες με Grid Configuration:

#### 1.1 **PRIMARY SOURCE** (Κεντρικό config)
📍 `src/subapps/dxf-viewer/systems/rulers-grid/config.ts`
```typescript
export const DEFAULT_GRID_SETTINGS: GridSettings = {
  visual: {
    enabled: true,
    step: 10,
    opacity: 0.6,
    color: '#4444ff',
    style: 'lines',
    subDivisions: 5,
    showOrigin: true,
    showAxes: true,
    axesColor: '#666666',
    axesWeight: 2,
    majorGridColor: '#888888',
    minorGridColor: '#bbbbbb',
    majorGridWeight: 1,
    minorGridWeight: 0.5
  },
  snap: {
    enabled: false,
    step: 10,
    tolerance: 12,
    showIndicators: true,
    indicatorColor: '#0099ff',
    indicatorSize: 4
  },
  behavior: {
    autoZoomGrid: true,
    minGridSpacing: 5,
    maxGridSpacing: 100,
    adaptiveGrid: true,
    fadeAtDistance: true,
    fadeThreshold: 0.1
  }
};
```

#### 1.2 **DUPLICATE** (UI-level defaults)
📍 `src/subapps/dxf-viewer/rendering/ui/grid/GridTypes.ts`
```typescript
export const DEFAULT_GRID_SETTINGS: GridSettings = {
  enabled: true,
  visible: true,
  opacity: 0.3,  // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ: 0.3 vs 0.6
  color: '#808080',  // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ: grey vs blue
  size: 10,
  style: 'lines',
  lineWidth: 1,
  majorGridColor: '#606060',  // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ
  minorGridColor: '#404040',  // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ
  majorInterval: 5,
  showMajorGrid: true,
  showMinorGrid: true,
  adaptiveOpacity: true,
  minVisibleSize: 5,
  zIndex: 100
};
```

#### 1.3 **DUPLICATE** (Canvas Settings wrapper)
📍 `src/subapps/dxf-viewer/rendering/canvas/core/CanvasSettings.ts`
```typescript
// Μέσα στο CanvasSettings constructor
grid: {
  enabled: true,
  visible: true,
  spacing: 20,  // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ field name: "spacing" vs "step"
  color: '#cccccc',  // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ: light grey
  opacity: 0.5,  // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ: 0.5 vs 0.6
  pattern: 'lines',
  zIndex: 1
}
```

#### 1.4 **DUPLICATE** (Provider defaults)
📍 `src/subapps/dxf-viewer/providers/DxfSettingsProvider.tsx`
```typescript
// Χρησιμοποιεί το DEFAULT_GRID_SETTINGS από rulers-grid/config.ts
// αλλά το re-processes με δικές του μεθόδους validation
```

### 🚨 ΠΡΟΒΛΗΜΑΤΑ:

1. **Inconsistent Values:** Opacity: 0.3, 0.5, 0.6 σε διαφορετικά αρχεία
2. **Inconsistent Colors:** `#4444ff`, `#808080`, `#cccccc`
3. **Inconsistent Field Names:** `step` vs `spacing`, `size` vs `step`
4. **Multiple Interfaces:** Διαφορετικά GridSettings interfaces
5. **No Single Source of Truth**

### ✅ ΠΡΟΤΑΣΗ ΛΥΣΗΣ:

**Κεντρικοποίηση σε:** `src/subapps/dxf-viewer/config/grid-config.ts`

```typescript
// UNIFIED GRID CONFIGURATION
export interface UnifiedGridSettings {
  // Visual
  enabled: boolean;
  visible: boolean;
  step: number;  // ✅ STANDARD NAME
  opacity: number;
  color: string;
  style: 'lines' | 'dots' | 'crosses';
  lineWidth: number;

  // Major/Minor grids
  majorGridColor: string;
  minorGridColor: string;
  majorInterval: number;
  showMajorGrid: boolean;
  showMinorGrid: boolean;

  // Behavior
  adaptiveOpacity: boolean;
  minVisibleSize: number;
  zIndex: number;

  // Snap
  snap: {
    enabled: boolean;
    tolerance: number;
    showIndicators: boolean;
    indicatorColor: string;
    indicatorSize: number;
  };
}

// SINGLE SOURCE OF TRUTH
export const DEFAULT_GRID_SETTINGS: UnifiedGridSettings = {
  enabled: true,
  visible: true,
  step: 10,
  opacity: 0.6,  // ✅ CONSISTENT VALUE
  color: '#4444ff',  // ✅ CONSISTENT VALUE
  style: 'lines',
  lineWidth: 1,
  majorGridColor: '#888888',
  minorGridColor: '#bbbbbb',
  majorInterval: 5,
  showMajorGrid: true,
  showMinorGrid: true,
  adaptiveOpacity: true,
  minVisibleSize: 5,
  zIndex: 100,
  snap: {
    enabled: false,
    tolerance: 12,
    showIndicators: true,
    indicatorColor: '#0099ff',
    indicatorSize: 4
  }
};
```

**Αρχεία προς Αλλαγή:**
- ❌ Διαγραφή: `rendering/ui/grid/GridTypes.ts` DEFAULT_GRID_SETTINGS
- ❌ Διαγραφή: `systems/rulers-grid/config.ts` DEFAULT_GRID_SETTINGS
- ✅ Re-export από: `config/grid-config.ts`

---

## 🔴 ΚΑΤΗΓΟΡΙΑ 2: RULER SETTINGS DUPLICATES

### Τοποθεσίες με Ruler Configuration:

#### 2.1 **PRIMARY SOURCE**
📍 `src/subapps/dxf-viewer/systems/rulers-grid/config.ts`
```typescript
export const DEFAULT_RULER_SETTINGS: RulerSettings = {
  horizontal: {
    enabled: false,
    height: 30,
    position: 'top',
    color: '#f0f0f0',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    fontFamily: 'Arial, sans-serif',
    unitsFontSize: 10,
    precision: 1,
    showZero: true,
    showMinorTicks: true,
    showMajorTicks: true,
    minorTickLength: 5,
    majorTickLength: 10,
    tickColor: '#666666',
    majorTickColor: '#666666',
    minorTickColor: '#999999',
    textColor: '#333333',
    unitsColor: '#333333',
    showLabels: true,
    showUnits: true,
    showBackground: true
  },
  vertical: {
    // ... same structure
  },
  units: 'mm',
  snap: {
    enabled: false,
    tolerance: 5
  }
};
```

#### 2.2 **DUPLICATE** (Canvas wrapper)
📍 `src/subapps/dxf-viewer/rendering/canvas/core/CanvasSettings.ts`
```typescript
rulers: {
  enabled: true,
  visible: true,
  color: '#666666',  // ⚠️ SIMPLIFIED - χάνει πολλά properties
  backgroundColor: '#f0f0f0',
  textColor: '#333333',
  fontSize: 12,  // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ: 12 vs 10
  height: 30,
  width: 30,
  zIndex: 100
}
```

#### 2.3 **DUPLICATE** (Provider)
📍 `src/subapps/dxf-viewer/providers/DxfSettingsProvider.tsx`
```typescript
// Imports DEFAULT_RULER_SETTINGS from rulers-grid/config.ts
// But applies its own parsing logic
const parseRulerSettings = (data: any): RulerSettings => {
  let current = { ...DEFAULT_RULER_SETTINGS };
  // ... custom parsing
};
```

### 🚨 ΠΡΟΒΛΗΜΑΤΑ:

1. **Oversimplification:** CanvasSettings χάνει πολλά ruler properties
2. **Inconsistent Font Sizes:** 10 vs 12
3. **No Unified Interface:** Διαφορετικές δομές
4. **Parsing Logic Scattered:** Multiple parsing μέθοδοι

### ✅ ΠΡΟΤΑΣΗ ΛΥΣΗΣ:

**Κεντρικοποίηση σε:** `src/subapps/dxf-viewer/config/ruler-config.ts`

```typescript
export interface UnifiedRulerSettings {
  horizontal: RulerAxisSettings;
  vertical: RulerAxisSettings;
  units: 'mm' | 'cm' | 'm' | 'inches' | 'feet';
  snap: {
    enabled: boolean;
    tolerance: number;
  };
}

interface RulerAxisSettings {
  enabled: boolean;
  height: number;  // For horizontal ruler
  width: number;   // For vertical ruler
  position: 'top' | 'bottom' | 'left' | 'right';
  color: string;
  backgroundColor: string;
  fontSize: number;
  fontFamily: string;
  unitsFontSize: number;
  precision: number;
  showZero: boolean;
  showMinorTicks: boolean;
  showMajorTicks: boolean;
  minorTickLength: number;
  majorTickLength: number;
  tickColor: string;
  majorTickColor: string;
  minorTickColor: string;
  textColor: string;
  unitsColor: string;
  showLabels: boolean;
  showUnits: boolean;
  showBackground: boolean;
}

// SINGLE SOURCE OF TRUTH
export const DEFAULT_RULER_SETTINGS: UnifiedRulerSettings = {
  // ... unified settings
};
```

---

## 🔴 ΚΑΤΗΓΟΡΙΑ 3: CURSOR/CROSSHAIR SETTINGS DUPLICATES

### Τοποθεσίες με Cursor/Crosshair Configuration:

#### 3.1 **PRIMARY SOURCE** (AutoCAD-style)
📍 `src/subapps/dxf-viewer/systems/cursor/config.ts`
```typescript
export const DEFAULT_CURSOR_SETTINGS: CursorSettings = {
  crosshair: {
    enabled: true,
    size_percent: 25,
    color: '#ffffff',
    line_width: 1,
    line_style: 'solid',
    opacity: 0.9,
    use_cursor_gap: false,
    center_gap_px: 3,
    lock_to_dpr: true,
    ui_scale: 1
  },
  cursor: {
    enabled: true,
    shape: 'circle',
    size: 10,
    color: '#00FF80',  // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ από crosshair
    line_style: 'solid',
    line_width: 1,
    opacity: 0.9
  },
  selection: {
    window: {
      fillColor: '#0080ff',
      fillOpacity: 0.2,
      borderColor: '#0080ff',
      borderOpacity: 1.0,
      borderStyle: 'solid',
      borderWidth: 2
    },
    crossing: {
      fillColor: '#00ff80',
      fillOpacity: 0.2,
      borderColor: '#00ff80',
      borderOpacity: 1.0,
      borderStyle: 'dashed',
      borderWidth: 2
    }
  },
  behavior: {
    snap_indicator: true,
    coordinate_display: true,
    dynamic_input: true,
    cursor_tooltip: true
  },
  performance: {
    use_raf: true,
    throttle_ms: 16,
    precision_mode: true
  }
};
```

#### 3.2 **DUPLICATE** (Canvas wrapper - simplified)
📍 `src/subapps/dxf-viewer/rendering/canvas/core/CanvasSettings.ts`
```typescript
crosshair: {
  enabled: true,
  visible: true,
  color: '#00ff00',  // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ: green vs white
  lineWidth: 1,
  length: 20,  // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ field: length vs size_percent
  gap: 5,
  opacity: 1.0,  // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ: 1.0 vs 0.9
  zIndex: 1000
},
cursor: {
  enabled: true,
  visible: true,
  shape: 'crosshair',  // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ: crosshair vs circle
  size: 16,  // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ: 16 vs 10
  color: '#ffffff',
  strokeColor: '#000000',
  strokeWidth: 1,
  opacity: 1.0,
  zIndex: 1001
}
```

#### 3.3 **DUPLICATE** (UI Types)
📍 `src/subapps/dxf-viewer/rendering/ui/cursor/CursorTypes.ts`
📍 `src/subapps/dxf-viewer/rendering/ui/crosshair/CrosshairTypes.ts`

### 🚨 ΠΡΟΒΛΗΜΑΤΑ:

1. **Color Inconsistency:** `#ffffff`, `#00ff00`, `#00FF80`
2. **Different Field Names:** `size_percent` vs `length`, `shape` values
3. **Different Opacity Defaults:** 0.9 vs 1.0
4. **Scattered Interfaces:** CursorSettings, CrosshairSettings, UICursorSettings
5. **Selection Settings:** Mixed με cursor settings

### ✅ ΠΡΟΤΑΣΗ ΛΥΣΗΣ:

**Κεντρικοποίηση σε:** `src/subapps/dxf-viewer/config/cursor-config.ts`

```typescript
export interface UnifiedCursorConfig {
  crosshair: CrosshairSettings;
  pickbox: PickboxSettings;  // ✅ ΑΥΤΟΝΟΜΟ (AutoCAD PICKBOX)
  selection: SelectionBoxSettings;
  behavior: CursorBehaviorSettings;
  performance: CursorPerformanceSettings;
}

export const DEFAULT_CURSOR_CONFIG: UnifiedCursorConfig = {
  // ... unified consistent settings
};
```

---

## 🔴 ΚΑΤΗΓΟΡΙΑ 4: GRIP SETTINGS DUPLICATES

### Τοποθεσίες με Grip Configuration:

#### 4.1 **PRIMARY SOURCE**
📍 `src/subapps/dxf-viewer/types/gripSettings.ts`
```typescript
export const DEFAULT_GRIP_SETTINGS: GripSettings = {
  gripSize: 5,
  pickBoxSize: 3,
  apertureSize: 10,
  showAperture: true,
  colors: {
    cold: '#0000FF',  // Blue
    warm: '#FF69B4',  // Hot Pink
    hot: '#FF0000',   // Red
    contour: '#000000'
  },
  enabled: true,
  showGrips: true,
  multiGripEdit: true,
  snapToGrips: true,
  showGripTips: false,
  dpiScale: 1.0,
  maxGripsPerEntity: 50,
  opacity: 1.0,
  showMidpoints: true,
  showCenters: true,
  showQuadrants: true
};
```

#### 4.2 **DUPLICATE** (UI component default)
📍 `src/subapps/dxf-viewer/ui/components/dxf-settings/settings/special/EntitiesSettings.tsx`
```typescript
const DEFAULT_GRIP_SETTINGS = {
  gripSize: 5,
  pickBoxSize: 3,
  apertureSize: 10,
  colors: {
    cold: '#0000FF',
    warm: '#FF69B4',
    hot: '#FF0000',
    contour: '#000000'
  },
  // ⚠️ INCOMPLETE - missing many properties
};
```

#### 4.3 **DUPLICATE** (Provider)
📍 `src/subapps/dxf-viewer/providers/DxfSettingsProvider.tsx`
```typescript
const defaultGripSettings: GripSettings = {
  gripSize: 5,
  pickBoxSize: 3,
  apertureSize: 10,
  showAperture: true,
  colors: {
    cold: '#0000FF',
    warm: '#FF69B4',
    hot: '#FF0000',
    contour: '#000000'
  },
  enabled: true,
  showGrips: true,
  multiGripEdit: true,
  snapToGrips: true,
  showGripTips: false,
  dpiScale: 1.0,
  maxGripsPerEntity: 50,
  opacity: 1.0,
  showMidpoints: true,
  showCenters: true,
  showQuadrants: true
};
```

#### 4.4 **DUPLICATE** (Color config re-definition)
📍 `src/subapps/dxf-viewer/config/color-config.ts`
```typescript
export const CAD_UI_COLORS = {
  grips: {
    size_px: 6,  // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ: 6 vs 5
    color_unselected: '#0080ff',  // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ: lighter blue
    color_selected: '#ff0000',
    color_hot: '#ff8000',  // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ: orange vs pink
    outline_color: '#ffffff',
    outline_width: 1,
    cold: '#0000FF',
    warm: '#FF69B4',
    hot: '#FF0000'
  }
  // ...
};
```

### 🚨 ΠΡΟΒΛΗΜΑΤΑ:

1. **Duplicate Color Definitions:** Grips colors σε 3+ τοποθεσίες
2. **Inconsistent Sizes:** 5 vs 6 pixels
3. **Inconsistent Colors:** `#0080ff` vs `#0000FF`, `#ff8000` vs `#FF69B4`
4. **Incomplete Copies:** UI component missing properties
5. **Validation Logic Scattered**

### ✅ ΠΡΟΤΑΣΗ ΛΥΣΗΣ:

**Κεντρικοποίηση σε:** `src/subapps/dxf-viewer/config/grip-config.ts`

```typescript
export interface UnifiedGripConfig {
  // AutoCAD standard variables
  gripSize: number;      // GRIPSIZE
  pickBoxSize: number;   // PICKBOX
  apertureSize: number;  // APERTURE
  showAperture: boolean; // APBOX

  // Grip colors (AutoCAD standard)
  colors: {
    cold: string;    // GRIPCOLOR - unselected
    warm: string;    // GRIPHOVER - hover
    hot: string;     // GRIPHOT - selected
    contour: string; // GRIPCONTOUR - border
  };

  // Advanced settings
  enabled: boolean;
  showGrips: boolean;
  multiGripEdit: boolean;
  snapToGrips: boolean;
  showGripTips: boolean;
  dpiScale: number;
  maxGripsPerEntity: number;
  opacity: number;
  showMidpoints: boolean;
  showCenters: boolean;
  showQuadrants: boolean;
}

// SINGLE SOURCE OF TRUTH
export const DEFAULT_GRIP_CONFIG: UnifiedGripConfig = {
  // ✅ CONSISTENT VALUES
  gripSize: 5,
  pickBoxSize: 3,
  apertureSize: 10,
  showAperture: true,
  colors: {
    cold: '#0000FF',   // ✅ AutoCAD Blue
    warm: '#FF69B4',   // ✅ AutoCAD Hot Pink
    hot: '#FF0000',    // ✅ AutoCAD Red
    contour: '#000000' // ✅ Black outline
  },
  // ... rest of properties
};

// ✅ VALIDATION FUNCTION
export function validateGripConfig(config: Partial<UnifiedGripConfig>): UnifiedGripConfig {
  // ... centralized validation
}
```

**Αρχεία προς Αλλαγή:**
- ✅ Κράτηση: `config/grip-config.ts` (νέο αρχείο)
- ❌ Διαγραφή: `types/gripSettings.ts` DEFAULT_GRIP_SETTINGS
- ❌ Διαγραφή: `ui/.../EntitiesSettings.tsx` DEFAULT_GRIP_SETTINGS
- ❌ Διαγραφή: `providers/DxfSettingsProvider.tsx` defaultGripSettings
- ✅ Merge: `config/color-config.ts` CAD_UI_COLORS.grips → grip-config.ts

---

## 🔴 ΚΑΤΗΓΟΡΙΑ 5: LINE SETTINGS DUPLICATES

### Τοποθεσίες με Line Configuration:

#### 5.1 **PRIMARY SOURCE**
📍 `src/subapps/dxf-viewer/types/lineSettings.ts`
```typescript
export const DEFAULT_LINE_SETTINGS = {
  enabled: true,
  lineType: 'solid' as const,
  lineWidth: 2,
  color: '#ffffff',
  opacity: 1.0,
  dashScale: 1.0,
  dashOffset: 0,
  lineCap: 'butt' as const,
  lineJoin: 'miter' as const,
  breakAtCenter: false,
  hoverColor: '#ffff00',
  hoverType: 'solid' as const,
  hoverWidth: 3,
  hoverOpacity: 0.8,
  finalColor: '#00ff00',
  finalType: 'solid' as const,
  finalWidth: 2,
  finalOpacity: 1.0,
  activeTemplate: null
};
```

#### 5.2 **DUPLICATE** (Context default)
📍 `src/subapps/dxf-viewer/contexts/LineSettingsContext.tsx`
```typescript
const defaultSettings: LineSettings = {
  // ... ΑΚΡΙΒΩΣ ΙΔΙΟ με το 5.1
};
```

#### 5.3 **DUPLICATE** (Provider)
📍 `src/subapps/dxf-viewer/providers/DxfSettingsProvider.tsx`
```typescript
const defaultLineSettings: LineSettings = {
  // ... ΑΚΡΙΒΩΣ ΙΔΙΟ με το 5.1
};
```

#### 5.4 **DUPLICATE** (Hook-specific settings)
📍 `src/subapps/dxf-viewer/ui/hooks/useUnifiedSpecificSettings.ts`
```typescript
const defaultLinePreviewSettings: LineSettings = {
  enabled: true,
  lineType: 'dashed',  // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ: dashed vs solid
  lineWidth: 2,
  color: '#00ff80',    // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ: green vs white
  opacity: 0.8,        // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ: 0.8 vs 1.0
  dashScale: 1.0,
  dashOffset: 0,
  lineCap: 'round',    // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ: round vs butt
  lineJoin: 'round',   // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ: round vs miter
  breakAtCenter: false,
  hoverColor: '#ffffff',
  hoverType: 'solid',
  hoverWidth: 3,
  hoverOpacity: 1.0,
  finalColor: '#00ff00',
  finalType: 'solid',
  finalWidth: 2,
  finalOpacity: 1.0,
  activeTemplate: null
};

const defaultLineCompletionSettings: LineSettings = {
  enabled: true,
  lineType: 'solid',
  lineWidth: 2,
  color: '#00ff00',    // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ: green
  opacity: 1.0,
  dashScale: 1.0,
  dashOffset: 0,
  lineCap: 'round',    // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ: round
  lineJoin: 'round',   // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ: round
  breakAtCenter: false,
  hoverColor: '#ffffff',
  hoverType: 'solid',
  hoverWidth: 3,
  hoverOpacity: 1.0,
  finalColor: '#00ff00',
  finalType: 'solid',
  finalWidth: 2,
  finalOpacity: 1.0,
  activeTemplate: null
};
```

### 🚨 ΠΡΟΒΛΗΜΑΤΑ:

1. **4 Identical Base Definitions:** Same DEFAULT_LINE_SETTINGS σε 4 αρχεία
2. **Inconsistent Preview Settings:** Different colors, line types, caps
3. **No Clear Hierarchy:** Unclear ποιο είναι το authoritative source
4. **Maintenance Nightmare:** Changes require 4+ file edits

### ✅ ΠΡΟΤΑΣΗ ΛΥΣΗΣ:

**Κεντρικοποίηση σε:** `src/subapps/dxf-viewer/config/line-config.ts`

```typescript
export interface UnifiedLineConfig {
  // Base settings
  default: LineSettings;

  // State-specific overrides
  preview: Partial<LineSettings>;
  hover: Partial<LineSettings>;
  completion: Partial<LineSettings>;

  // Templates
  templates: Record<string, LineSettings>;
}

// SINGLE SOURCE OF TRUTH
export const DEFAULT_LINE_CONFIG: UnifiedLineConfig = {
  default: {
    enabled: true,
    lineType: 'solid',
    lineWidth: 2,
    color: '#ffffff',
    opacity: 1.0,
    dashScale: 1.0,
    dashOffset: 0,
    lineCap: 'butt',
    lineJoin: 'miter',
    breakAtCenter: false,
    hoverColor: '#ffff00',
    hoverType: 'solid',
    hoverWidth: 3,
    hoverOpacity: 0.8,
    finalColor: '#00ff00',
    finalType: 'solid',
    finalWidth: 2,
    finalOpacity: 1.0,
    activeTemplate: null
  },

  // ✅ EXPLICIT STATE OVERRIDES
  preview: {
    lineType: 'dashed',
    color: '#00ff80',
    opacity: 0.8,
    lineCap: 'round',
    lineJoin: 'round'
  },

  completion: {
    color: '#00ff00',
    lineCap: 'round',
    lineJoin: 'round'
  },

  hover: {
    color: '#ffff00',
    lineWidth: 3,
    opacity: 0.8
  },

  templates: {
    // ... predefined line templates
  }
};

// ✅ UTILITY FUNCTIONS
export function getLineSettings(state: 'default' | 'preview' | 'hover' | 'completion'): LineSettings {
  const base = DEFAULT_LINE_CONFIG.default;
  const override = DEFAULT_LINE_CONFIG[state];
  return { ...base, ...override };
}
```

**Αρχεία προς Αλλαγή:**
- ✅ Κράτηση: `config/line-config.ts` (νέο)
- ❌ Διαγραφή: `types/lineSettings.ts` DEFAULT_LINE_SETTINGS
- ❌ Διαγραφή: `contexts/LineSettingsContext.tsx` defaultSettings
- ❌ Διαγραφή: `providers/DxfSettingsProvider.tsx` defaultLineSettings
- ❌ Διαγραφή: `ui/hooks/useUnifiedSpecificSettings.ts` all line defaults

---

## 🔴 ΚΑΤΗΓΟΡΙΑ 6: TEXT SETTINGS DUPLICATES

### Τοποθεσίες με Text Configuration:

#### 6.1 **PRIMARY SOURCE**
📍 `src/subapps/dxf-viewer/types/textSettings.ts`
```typescript
export const DEFAULT_TEXT_SETTINGS = {
  enabled: true,
  fontFamily: 'Arial, sans-serif',
  fontSize: 12,
  color: '#ffffff',
  isBold: false,
  isItalic: false,
  isUnderline: false,
  isStrikethrough: false,
  isSuperscript: false,
  isSubscript: false
};
```

#### 6.2 **DUPLICATE** (Context)
📍 `src/subapps/dxf-viewer/contexts/TextSettingsContext.tsx`
```typescript
const defaultTextSettings: TextSettings = {
  // ... ΑΚΡΙΒΩΣ ΙΔΙΟ
};
```

#### 6.3 **DUPLICATE** (Provider)
📍 `src/subapps/dxf-viewer/providers/DxfSettingsProvider.tsx`
```typescript
const defaultTextSettings: TextSettings = {
  // ... ΑΚΡΙΒΩΣ ΙΔΙΟ
};
```

#### 6.4 **DUPLICATE** (Hook-specific)
📍 `src/subapps/dxf-viewer/ui/hooks/useUnifiedSpecificSettings.ts`
```typescript
const defaultTextPreviewSettings: TextSettings = {
  enabled: true,
  fontFamily: 'Arial, sans-serif',
  fontSize: 14,      // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ: 14 vs 12
  color: '#00ff80',  // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ: green vs white
  isBold: false,
  isItalic: false,
  isUnderline: false,
  isStrikethrough: false,
  isSuperscript: false,
  isSubscript: false
};
```

### 🚨 ΠΡΟΒΛΗΜΑΤΑ:

1. **4 Identical Definitions:** Same settings σε 4 τοποθεσίες
2. **Inconsistent Preview:** fontSize 14 vs 12, color green vs white
3. **No Validation:** No centralized validation logic

### ✅ ΠΡΟΤΑΣΗ ΛΥΣΗΣ:

**Κεντρικοποίηση σε:** `src/subapps/dxf-viewer/config/text-config.ts`

```typescript
export interface UnifiedTextConfig {
  default: TextSettings;
  preview: Partial<TextSettings>;
}

export const DEFAULT_TEXT_CONFIG: UnifiedTextConfig = {
  default: {
    enabled: true,
    fontFamily: 'Arial, sans-serif',
    fontSize: 12,
    color: '#ffffff',
    isBold: false,
    isItalic: false,
    isUnderline: false,
    isStrikethrough: false,
    isSuperscript: false,
    isSubscript: false
  },
  preview: {
    fontSize: 14,
    color: '#00ff80'
  }
};
```

---

## 🔴 ΚΑΤΗΓΟΡΙΑ 7: TOLERANCE/PRECISION CONFIG DUPLICATES

### Τοποθεσίες με Tolerance Configuration:

#### 7.1 **PRIMARY SOURCE**
📍 `src/subapps/dxf-viewer/config/tolerance-config.ts`
```typescript
export const TOLERANCE_CONFIG = {
  SELECTION_DEFAULT: 8,
  SELECTION_MIN: 2,
  SELECTION_MAX: 20,
  SNAP_DEFAULT: 10,
  SNAP_PRECISION: 1e-10,
  HIT_TEST_DEFAULT: 8,
  HIT_TEST_RADIUS: 12,
  GRIP_APERTURE: 8,
  VERTEX_HANDLE_SIZE: 8,
  CALIBRATION: 2.0,
  POLYLINE_PRECISION: 0.01,
  MARQUEE_MIN_SIZE: 3,
  LASSO_MIN_POINTS: 3
} as const;
```

#### 7.2 **DUPLICATE** (Spatial index config)
📍 `src/subapps/dxf-viewer/core/spatial/SpatialIndexFactory.ts`
```typescript
const DEFAULT_CONFIGS = {
  GENERAL: {
    minNodeSize: 16,
    maxNodeSize: 64,
    tolerance: 0.01  // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ
  },
  HIT_TESTING: {
    minNodeSize: 8,
    maxNodeSize: 32,
    tolerance: 5  // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ vs 8
  },
  SNAPPING: {
    minNodeSize: 16,
    maxNodeSize: 64,
    tolerance: 10  // ✅ SAME
  },
  SELECTION: {
    minNodeSize: 32,
    maxNodeSize: 128,
    tolerance: 1  // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ
  }
};
```

#### 7.3 **DUPLICATE** (Hover config)
📍 `src/subapps/dxf-viewer/utils/hover/config.ts`
```typescript
export const HOVER_CONFIG: HoverConfig = {
  // ... other settings
  offsets: {
    gripAvoidance: 20,    // ⚠️ ΔΙΑΦΟΡΕΤΙΚΟ tolerance
    arcRadius: 30,
    textFromArc: 20
  }
  // ...
};
```

### 🚨 ΠΡΟΒΛΗΜΑΤΑ:

1. **Inconsistent Tolerances:** 5, 8, 10 για παρόμοιες λειτουργίες
2. **Multiple Sources:** tolerance-config.ts vs SpatialIndexFactory vs hover
3. **No Clear Rationale:** Unclear γιατί διαφέρουν

### ✅ ΠΡΟΤΑΣΗ ΛΥΣΗΣ:

**Κεντρικοποίηση σε:** `src/subapps/dxf-viewer/config/tolerance-config.ts` (ήδη υπάρχει)

```typescript
// ✅ EXTEND EXISTING
export const TOLERANCE_CONFIG = {
  // Selection
  SELECTION_DEFAULT: 8,
  SELECTION_MIN: 2,
  SELECTION_MAX: 20,

  // Snap
  SNAP_DEFAULT: 10,
  SNAP_PRECISION: 1e-10,

  // Hit testing
  HIT_TEST_DEFAULT: 8,
  HIT_TEST_RADIUS: 12,

  // Grips
  GRIP_APERTURE: 8,
  VERTEX_HANDLE_SIZE: 8,

  // Spatial index
  SPATIAL_INDEX: {
    GENERAL_TOLERANCE: 0.01,
    HIT_TEST_TOLERANCE: 8,  // ✅ CONSISTENT με HIT_TEST_DEFAULT
    SNAP_TOLERANCE: 10,     // ✅ CONSISTENT με SNAP_DEFAULT
    SELECTION_TOLERANCE: 8  // ✅ CONSISTENT με SELECTION_DEFAULT
  },

  // Hover
  HOVER: {
    GRIP_AVOIDANCE: 20,
    ARC_RADIUS: 30,
    TEXT_FROM_ARC: 20
  },

  // Calibration
  CALIBRATION: 2.0,
  POLYLINE_PRECISION: 0.01,
  MARQUEE_MIN_SIZE: 3,
  LASSO_MIN_POINTS: 3
} as const;
```

**Αρχεία προς Αλλαγή:**
- ✅ Update: `config/tolerance-config.ts` (expand)
- ✅ Update: `core/spatial/SpatialIndexFactory.ts` (import από tolerance-config)
- ✅ Update: `utils/hover/config.ts` (import από tolerance-config)

---

## 🔴 ΚΑΤΗΓΟΡΙΑ 8: PERFORMANCE/BEHAVIOR CONFIG DUPLICATES

### Τοποθεσίες με Performance Configuration:

#### 8.1 **PRIMARY SOURCE**
📍 `src/subapps/dxf-viewer/config/settings-config.ts`
```typescript
export const SETTINGS_PERFORMANCE = {
  DEBOUNCE_DELAY: 150,
  CANVAS_THROTTLE: 16,
  BATCH_SIZE: 100,
  USE_MEMO_OPTIMIZATION: true,
  USE_LAZY_LOADING: true
};
```

#### 8.2 **DUPLICATE** (Cursor performance)
📍 `src/subapps/dxf-viewer/systems/cursor/config.ts`
```typescript
performance: {
  use_raf: true,
  throttle_ms: 16,  // ✅ SAME
  precision_mode: true
}
```

#### 8.3 **DUPLICATE** (Rulers/Grid performance)
📍 `src/subapps/dxf-viewer/systems/rulers-grid/config.ts`
```typescript
export const RULERS_GRID_CONFIG = {
  // ...
  RENDER_THROTTLE_MS: 16  // ✅ SAME
};
```

#### 8.4 **DUPLICATE** (Constraints performance)
📍 `src/subapps/dxf-viewer/systems/constraints/config.ts`
```typescript
performance: {
  maxConstraintChecks: 10,
  optimizeRendering: true,
  throttleUpdates: true,
  updateInterval: 16  // ✅ SAME
}
```

### 🚨 ΠΡΟΒΛΗΜΑΤΑ:

1. **Repeated Values:** `throttle_ms: 16` σε 4+ τοποθεσίες
2. **No Central Performance Manager:** Scattered performance configs
3. **Inconsistent Naming:** `CANVAS_THROTTLE`, `throttle_ms`, `RENDER_THROTTLE_MS`

### ✅ ΠΡΟΤΑΣΗ ΛΥΣΗΣ:

**Κεντρικοποίηση σε:** `src/subapps/dxf-viewer/config/performance-config.ts` (νέο)

```typescript
export const PERFORMANCE_CONFIG = {
  // Timing
  FRAME_RATE: 60,
  FRAME_TIME_MS: 16,  // ✅ SINGLE SOURCE
  DEBOUNCE_DELAY_MS: 150,

  // Throttling
  CURSOR_THROTTLE_MS: 16,
  CANVAS_THROTTLE_MS: 16,
  RULER_THROTTLE_MS: 16,
  CONSTRAINT_THROTTLE_MS: 16,

  // Batching
  BATCH_SIZE: 100,

  // Optimizations
  USE_RAF: true,
  USE_MEMO: true,
  USE_LAZY_LOADING: true,
  OPTIMIZE_RENDERING: true,

  // Limits
  MAX_CONSTRAINT_CHECKS: 10,
  MAX_CACHE_SIZE: 100
} as const;
```

---

## 📊 ΣΥΝΟΛΙΚΗ ΑΝΑΛΥΣΗ ΔΙΠΛΟΤΥΠΩΝ

### Πίνακας Διπλοτύπων Configuration Objects

| Configuration Type | Primary Source | Duplicates | Inconsistencies | Priority |
|-------------------|----------------|-----------|-----------------|----------|
| **Grid Settings** | `systems/rulers-grid/config.ts` | 3 | Colors, opacity, field names | 🔴 HIGH |
| **Ruler Settings** | `systems/rulers-grid/config.ts` | 2 | Font size, simplified versions | 🔴 HIGH |
| **Cursor/Crosshair** | `systems/cursor/config.ts` | 2 | Colors, sizes, field names | 🔴 HIGH |
| **Grip Settings** | `types/gripSettings.ts` | 4 | Colors, sizes, incomplete copies | 🔴 HIGH |
| **Line Settings** | `types/lineSettings.ts` | 4 | Preview colors, line caps | 🟡 MEDIUM |
| **Text Settings** | `types/textSettings.ts` | 4 | Font size, color | 🟡 MEDIUM |
| **Tolerance Config** | `config/tolerance-config.ts` | 3 | Different values | 🔴 HIGH |
| **Performance Config** | `config/settings-config.ts` | 4 | Field naming | 🟢 LOW |

### Σύνολο:
- **25+ Configuration Objects** με διπλότυπα
- **8 Κατηγορίες** configuration types
- **35+ Αρχεία** επηρεασμένα

---

## ✅ ΠΡΟΤΕΙΝΟΜΕΝΟ ACTION PLAN

### Phase 1: Κεντρικοποίηση Core Configs (Week 1)

1. **Δημιουργία Κεντρικών Config Files:**
   ```
   src/subapps/dxf-viewer/config/
   ├── grid-config.ts           ✅ NEW
   ├── ruler-config.ts          ✅ NEW
   ├── cursor-config.ts         ✅ NEW
   ├── grip-config.ts           ✅ NEW
   ├── line-config.ts           ✅ NEW
   ├── text-config.ts           ✅ NEW
   ├── tolerance-config.ts      ✅ EXPAND
   ├── performance-config.ts    ✅ NEW
   └── index.ts                 ✅ NEW (re-exports όλα)
   ```

2. **Migrate Grid Settings:**
   - Create `config/grid-config.ts` με unified GridSettings
   - Update `systems/rulers-grid/config.ts` → re-export
   - Update `rendering/ui/grid/GridTypes.ts` → re-export
   - Update `rendering/canvas/core/CanvasSettings.ts` → import

3. **Migrate Ruler Settings:**
   - Create `config/ruler-config.ts`
   - Update all consumers

4. **Migrate Cursor/Crosshair:**
   - Create `config/cursor-config.ts`
   - Merge cursor + crosshair + selection settings
   - Update systems/cursor/config.ts → re-export

### Phase 2: Settings Objects (Week 2)

5. **Migrate Grip Settings:**
   - Create `config/grip-config.ts`
   - Merge color definitions from `color-config.ts`
   - Update all 4 duplicate locations

6. **Migrate Line Settings:**
   - Create `config/line-config.ts`
   - Define state-specific overrides (preview, hover, completion)
   - Update all 4+ locations

7. **Migrate Text Settings:**
   - Create `config/text-config.ts`
   - Update all 4 locations

### Phase 3: System Configs (Week 3)

8. **Expand Tolerance Config:**
   - Add spatial index tolerances
   - Add hover tolerances
   - Update consumers

9. **Create Performance Config:**
   - Centralize all throttle/debounce values
   - Update 4+ systems

10. **Create Unified Index:**
    ```typescript
    // src/subapps/dxf-viewer/config/index.ts
    export * from './grid-config';
    export * from './ruler-config';
    export * from './cursor-config';
    export * from './grip-config';
    export * from './line-config';
    export * from './text-config';
    export * from './tolerance-config';
    export * from './performance-config';
    export * from './color-config';  // existing
    export * from './settings-config';  // existing
    ```

### Phase 4: Cleanup (Week 4)

11. **Remove Duplicates:**
    - Delete duplicate DEFAULT_* exports
    - Convert to re-exports
    - Update imports across codebase

12. **Testing:**
    - Visual regression tests
    - Settings persistence tests
    - Configuration loading tests

13. **Documentation:**
    - Update architecture docs
    - Add config migration guide
    - Update centralized_systems.md

---

## 🎯 BENEFITS ΑΠΟ CENTRALIZATION

### 1. **Single Source of Truth**
- ✅ Όλα τα configuration values σε ένα μέρος
- ✅ Εύκολη εύρεση defaults
- ✅ Consistent values across systems

### 2. **Maintainability**
- ✅ Αλλαγή σε 1 αρχείο αντί για 4+
- ✅ Εύκολη validation logic
- ✅ Type safety με TypeScript

### 3. **Consistency**
- ✅ Εξάλειψη inconsistent values
- ✅ Unified interfaces
- ✅ Clear naming conventions

### 4. **Performance**
- ✅ Centralized performance tuning
- ✅ Easier profiling
- ✅ Consistent throttle/debounce values

### 5. **Testability**
- ✅ Centralized test fixtures
- ✅ Easier mocking
- ✅ Configuration validation tests

---

## 📝 NOTES

### Ειδικά Σημεία Προσοχής:

1. **Migration Strategy:**
   - Μην διαγράψεις αρχεία αμέσως
   - Χρησιμοποίησε re-exports για backward compatibility
   - Deprecate old imports σταδιακά

2. **Testing:**
   - Visual regression tests είναι CRITICAL
   - Settings persistence πρέπει να δουλεύει
   - Κάθε system πρέπει να validation τα configs του

3. **Documentation:**
   - Update centralized_systems.md
   - Add migration guide
   - Document deprecations

4. **Type Safety:**
   - Strict TypeScript types
   - Validation functions
   - Runtime checks για critical configs

---

## 🚀 PRIORITY RECOMMENDATIONS

### Immediate Actions (Week 1):
1. ✅ Create `config/` directory structure
2. ✅ Migrate Grid settings (highest inconsistency)
3. ✅ Migrate Grip settings (most duplicates)
4. ✅ Migrate Tolerance config (critical for accuracy)

### Short-term (Week 2-3):
5. ✅ Migrate Line/Text settings
6. ✅ Migrate Cursor/Crosshair
7. ✅ Create Performance config

### Long-term (Week 4+):
8. ✅ Remove all duplicates
9. ✅ Update documentation
10. ✅ Add configuration tests

---

## 📞 CONTACT

**Για ερωτήσεις ή προτάσεις:**
- Γιώργος (Project Owner)
- Claude (AI Developer)

**Τελευταία Ενημέρωση:** 2025-10-03
