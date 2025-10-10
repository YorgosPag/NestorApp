# 🔄 TYPE COMPATIBILITY MATRIX

**Generated:** 2025-10-09
**Purpose:** Map type differences between Old DxfSettingsProvider vs Enterprise Provider
**Status:** PHASE 1 Step 1.2 Complete

---

## 📊 QUICK SUMMARY

| Aspect | Old Provider | Enterprise Provider | Adapter Strategy |
|--------|--------------|---------------------|------------------|
| **Context Name** | `DxfSettingsContextType` | `EnterpriseDxfSettingsContextType` | Rename after migration |
| **State Type** | `DxfSettingsState` | `SettingsState` | Direct mapping |
| **ViewerMode** | `'normal' \| 'preview' \| 'completion'` | `'normal' \| 'draft' \| 'hover' \| 'selection' \| 'completion' \| 'preview'` | Map 'preview' → 'draft' |
| **Line Settings Type** | `LineSettings` (35 fields) | `LineSettings` (4 fields) | Adapter converts |
| **Text Settings Type** | `TextSettings` (27 fields) | `TextSettings` (6 fields) | Adapter converts |
| **Grip Settings Type** | `GripSettings` (11 fields) | `GripSettings` (5 fields) | Adapter converts |
| **Update Methods** | No mode parameter | Requires mode + layer | Adapter defaults mode='normal', layer='general' |
| **Get Methods** | Optional mode param | Required mode param | Adapter defaults mode='normal' |

---

## 🔍 DETAILED TYPE COMPARISON

### 1️⃣ CONTEXT INTERFACE

#### **OLD: DxfSettingsContextType**
```typescript
// Location: providers/DxfSettingsProvider.tsx:301
interface DxfSettingsContextType {
  // State
  settings: DxfSettingsState;
  dispatch: React.Dispatch<SettingsAction>;

  // Update methods (NO mode/layer parameters)
  updateLineSettings: (updates: Partial<LineSettings>) => void;
  updateTextSettings: (updates: Partial<TextSettings>) => void;
  updateGripSettings: (updates: Partial<GripSettings>) => void;

  // Override methods (mode parameter, NO layer parameter)
  updateLineOverrides: (mode: 'draft' | 'hover' | 'selection' | 'completion', settings: Partial<LineSettings>) => void;
  toggleLineOverride: (mode: 'draft' | 'hover' | 'selection' | 'completion', enabled: boolean) => void;

  // Effective settings (OPTIONAL mode parameter)
  getEffectiveLineSettings: (mode?: ViewerMode) => LineSettings;
  getEffectiveTextSettings: (mode?: ViewerMode) => TextSettings;
  getEffectiveGripSettings: (mode?: ViewerMode) => GripSettings;

  // Template system (LineTemplate only)
  applyLineTemplate: (templateName: string, templateSettings: LineSettings) => void;
  updateLineTemplateOverrides: (overrides: Partial<LineSettings>) => void;

  // Metadata
  isAutoSaving: boolean;
  hasUnsavedChanges: boolean;
}
```

#### **ENTERPRISE: EnterpriseDxfSettingsContextType**
```typescript
// Location: providers/EnterpriseDxfSettingsProvider.tsx:96
interface EnterpriseDxfSettingsContextType {
  // State
  settings: SettingsState;

  // Update methods (REQUIRES mode + layer parameters)
  updateLineSettings: (mode: StorageMode, updates: Partial<LineSettings>, layer: 'general' | 'specific' | 'overrides') => void;
  updateTextSettings: (mode: StorageMode, updates: Partial<TextSettings>, layer: 'general' | 'specific' | 'overrides') => void;
  updateGripSettings: (mode: StorageMode, updates: Partial<GripSettings>, layer: 'general' | 'specific' | 'overrides') => void;

  // Override toggles (REQUIRES mode parameter)
  toggleLineOverride: (mode: StorageMode, enabled: boolean) => void;
  toggleTextOverride: (mode: StorageMode, enabled: boolean) => void;
  toggleGripOverride: (mode: StorageMode, enabled: boolean) => void;

  // Effective settings (REQUIRED mode parameter)
  getEffectiveLineSettings: (mode: ViewerMode) => LineSettings;
  getEffectiveTextSettings: (mode: ViewerMode) => TextSettings;
  getEffectiveGripSettings: (mode: ViewerMode) => GripSettings;

  // Reset
  resetToDefaults: () => void;

  // Metadata
  isLoaded: boolean;
  isSaving: boolean;
  lastError: string | null;

  // Migration utilities
  migrationUtils: {
    isLegacyFormat: (state: unknown) => boolean;
    getMigrationInfo: (state: unknown) => ReturnType<typeof getMigrationInfo>;
    triggerManualMigration: (legacyState: unknown) => SettingsState;
  };
}
```

---

### 2️⃣ STATE STRUCTURE

#### **OLD: DxfSettingsState**
```typescript
// Location: providers/DxfSettingsProvider.tsx
interface DxfSettingsState {
  // General settings (base layer)
  line: LineSettings;
  text: TextSettings;
  grip: GripSettings;
  grid: GridSettings;
  ruler: RulerSettings;
  cursor: CursorSettings;

  // Mode
  mode: ViewerMode; // 'normal' | 'preview' | 'completion'

  // Specific settings (per-mode overrides)
  specific: {
    line: {
      draft?: Partial<LineSettings>;
      hover?: Partial<LineSettings>;
      selection?: Partial<LineSettings>;
      completion?: Partial<LineSettings>;
    };
    text: {
      draft?: Partial<TextSettings>;
    };
    grip: {
      draft?: Partial<GripSettings>;
    };
  };

  // User overrides (UI-based overrides)
  overrides: {
    line: {
      draft?: Partial<LineSettings>;
      hover?: Partial<LineSettings>;
      selection?: Partial<LineSettings>;
      completion?: Partial<LineSettings>;
    };
    text: {
      draft?: Partial<TextSettings>;
    };
    grip: {
      draft?: Partial<GripSettings>;
    };
  };

  // Override flags (per-mode enable/disable)
  overrideEnabled: {
    line: {
      draft: boolean;
      hover: boolean;
      selection: boolean;
      completion: boolean;
    };
    text: {
      draft: boolean;
    };
    grip: {
      draft: boolean;
    };
  };

  // Template system
  lineTemplate: LineTemplate | null;
  lineTemplateOverrides: Partial<LineSettings>;
}
```

#### **ENTERPRISE: SettingsState**
```typescript
// Location: settings/core/types.ts:112
interface SettingsState {
  __standards_version: number;  // Schema version for migrations

  // Entity settings (3-layer architecture)
  line: EntitySettings<LineSettings>;
  text: EntitySettings<TextSettings>;
  grip: EntitySettings<GripSettings>;

  // Override flags (per entity, per mode)
  overrideEnabled: {
    line: OverrideFlags;    // Record<StorageMode, boolean>
    text: OverrideFlags;
    grip: OverrideFlags;
  };
}

// 3-Layer EntitySettings structure
interface EntitySettings<T> {
  general: T;
  specific: Record<StorageMode, Partial<T>>;  // 'normal' | 'draft' | 'hover' | 'selection' | 'completion'
  overrides: Record<StorageMode, Partial<T>>;
}

type StorageMode = 'normal' | 'draft' | 'hover' | 'selection' | 'completion';
// Note: 'preview' is excluded from storage (maps to 'draft')
```

---

### 3️⃣ LINE SETTINGS FIELDS

#### **OLD: LineSettings (35 fields)**
```typescript
// Location: settings-core/types.ts
interface LineSettings {
  enabled: boolean;               // ✅ General ON/OFF toggle
  lineType: string;               // ⚠️ 'solid' | 'dashed' | 'dotted' (OLD name)
  lineWidth: number;              // ✅ 0.1 - 10.0 mm
  color: string;                  // ⚠️ Hex color (OLD name: 'color')
  opacity: number;                // ✅ 0.0 - 1.0
  dashScale: number;
  dashOffset: number;
  lineCap: string;
  lineJoin: string;
  breakAtCenter: boolean;
  hoverColor: string;
  hoverType: string;
  hoverWidth: number;
  hoverOpacity: number;
  finalColor: string;
  finalType: string;
  finalWidth: number;
  finalOpacity: number;
  activeTemplate: string | null;
  // ... 16+ more fields (35 total)
}
```

#### **ENTERPRISE: LineSettings (4 fields)**
```typescript
// Location: settings/core/types.ts:54
interface LineSettings {
  lineWidth: number;        // ✅ 0.1 - 10.0 mm
  lineColor: string;        // ⚠️ NEW name: 'lineColor' (was 'color')
  lineStyle: string;        // ⚠️ NEW name: 'lineStyle' (was 'lineType')
  opacity: number;          // ✅ 0.0 - 1.0
}
```

**🔴 CRITICAL DIFFERENCES:**
1. **Property Names Changed:**
   - `color` → `lineColor`
   - `lineType` → `lineStyle`
2. **Field Count Reduced:** 35 → 4 fields (31 fields removed)
3. **Removed Fields:** `enabled`, `dashScale`, `dashOffset`, `lineCap`, `lineJoin`, `breakAtCenter`, all hover/final state fields, template system

---

### 4️⃣ TEXT SETTINGS FIELDS

#### **OLD: TextSettings (27 fields)**
```typescript
// Location: settings-core/types.ts
interface TextSettings {
  enabled: boolean;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: string;
  color: string;                  // ⚠️ OLD name: 'color'
  opacity: number;
  letterSpacing: number;
  lineHeight: number;
  textAlign: string;
  textBaseline: string;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrikethrough: boolean;
  isSuperscript: boolean;
  isSubscript: boolean;
  shadowEnabled: boolean;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowBlur: number;
  shadowColor: string;
  strokeEnabled: boolean;
  strokeWidth: number;
  strokeColor: string;
  // ... 27 total fields
}
```

#### **ENTERPRISE: TextSettings (6 fields)**
```typescript
// Location: settings/core/types.ts:65
interface TextSettings {
  fontSize: number;         // ✅ 8 - 72 pt
  fontFamily: string;       // ✅ Font name
  fontWeight: 'normal' | 'bold';  // ⚠️ Type changed: number → union
  fontStyle: 'normal' | 'italic'; // ✅ Same
  textColor: string;        // ⚠️ NEW name: 'textColor' (was 'color')
  opacity: number;          // ✅ 0.0 - 1.0
}
```

**🔴 CRITICAL DIFFERENCES:**
1. **Property Names Changed:**
   - `color` → `textColor`
2. **Type Changes:**
   - `fontWeight`: `number` (400/700) → `'normal' | 'bold'`
3. **Field Count Reduced:** 27 → 6 fields (21 fields removed)
4. **Removed Fields:** `enabled`, `letterSpacing`, `lineHeight`, `textAlign`, `textBaseline`, boolean flags (isBold/isItalic/etc), shadow/stroke properties

---

### 5️⃣ GRIP SETTINGS FIELDS

#### **OLD: GripSettings (11 fields)**
```typescript
// Location: types/gripSettings.ts
interface GripSettings {
  showGrips: boolean;
  gripSize: number;
  pickBoxSize: number;
  apertureSize: number;
  colors: {
    unselected: string;
    hover: string;
    selected: string;
  };
  // ... 11 total fields
}
```

#### **ENTERPRISE: GripSettings (5 fields)**
```typescript
// Location: settings/core/types.ts:78
interface GripSettings {
  size: number;             // ✅ 4 - 20 px (was 'gripSize')
  color: string;            // ⚠️ NEW: Single color (was colors.unselected)
  hoverColor: string;       // ⚠️ NEW: Hover color (was colors.hover)
  shape: 'square' | 'circle';
  opacity: number;          // ✅ 0.0 - 1.0
}
```

**🔴 CRITICAL DIFFERENCES:**
1. **Property Names Changed:**
   - `gripSize` → `size`
   - `colors.unselected` → `color`
   - `colors.hover` → `hoverColor`
2. **Field Count Reduced:** 11 → 5 fields (6 fields removed)
3. **Removed Fields:** `showGrips`, `pickBoxSize`, `apertureSize`, `colors.selected`

---

### 6️⃣ VIEWER MODE TYPES

#### **OLD: ViewerMode**
```typescript
// Location: types/viewerConfiguration.ts:13
type ViewerMode = 'normal' | 'preview' | 'completion';
```

#### **ENTERPRISE: ViewerMode**
```typescript
// Location: settings/core/types.ts:32
type ViewerMode = 'normal' | 'draft' | 'hover' | 'selection' | 'completion' | 'preview';

// StorageMode excludes 'preview' (always mapped to 'draft')
type StorageMode = 'normal' | 'draft' | 'hover' | 'selection' | 'completion';
```

**🔴 CRITICAL DIFFERENCES:**
1. **New Modes Added:** `'draft'`, `'hover'`, `'selection'`
2. **Storage Mapping:** `'preview'` mode maps to `'draft'` in storage
3. **Mode Count:** 3 → 6 modes

---

## 🛠️ ADAPTER CONVERSION RULES

### Rule 1: Method Signature Conversion

```typescript
// OLD API:
updateLineSettings(updates: Partial<LineSettings>) => void

// ENTERPRISE API:
updateLineSettings(mode: StorageMode, updates: Partial<LineSettings>, layer: 'general' | 'specific' | 'overrides') => void

// ADAPTER CONVERSION:
function updateLineSettings(updates: Partial<OldLineSettings>) {
  // Default to 'normal' mode, 'general' layer
  enterprise.updateLineSettings('normal', convertLineSettings(updates), 'general');
}
```

### Rule 2: Field Name Conversion

```typescript
// OLD → ENTERPRISE
{
  color: '#FF0000',           → lineColor: '#FF0000'
  lineType: 'solid',          → lineStyle: 'solid'
  // ... 31 other fields ignored (not in enterprise schema)
}

// ENTERPRISE → OLD
{
  lineColor: '#FF0000',       → color: '#FF0000'
  lineStyle: 'solid',         → lineType: 'solid'
  lineWidth: 0.25,            → lineWidth: 0.25
  opacity: 1.0,               → opacity: 1.0
  // Fill missing fields with defaults
}
```

### Rule 3: Mode Parameter Handling

```typescript
// OLD API (optional mode):
getEffectiveLineSettings(mode?: ViewerMode) => LineSettings

// ENTERPRISE API (required mode):
getEffectiveLineSettings(mode: ViewerMode) => LineSettings

// ADAPTER CONVERSION:
function getEffectiveLineSettings(mode?: ViewerMode) {
  const effectiveMode = mode || 'normal';  // Default to 'normal'
  return convertToOldLineSettings(enterprise.getEffectiveLineSettings(effectiveMode));
}
```

### Rule 4: Override Layer Mapping

```typescript
// OLD API: updateLineOverrides(mode, settings)
// Uses 'overrides' layer implicitly

// ENTERPRISE API: updateLineSettings(mode, settings, layer)
// Explicitly specifies layer

// ADAPTER CONVERSION:
function updateLineOverrides(mode: 'draft' | 'hover' | 'selection' | 'completion', settings: Partial<LineSettings>) {
  // Map mode to StorageMode
  const storageMode: StorageMode = mode === 'preview' ? 'draft' : mode;

  // Explicitly use 'overrides' layer
  enterprise.updateLineSettings(storageMode, convertLineSettings(settings), 'overrides');
}
```

---

## 🎯 ADAPTER IMPLEMENTATION STRATEGY

### Phase 2.1: Create Converter Functions

```typescript
// File: hooks/adapters/converters.ts

/**
 * Convert OLD LineSettings → ENTERPRISE LineSettings
 */
export function convertLineSettingsToEnterprise(old: Partial<OldLineSettings>): Partial<EnterpriseLineSettings> {
  return {
    lineWidth: old.lineWidth,
    lineColor: old.color,           // Rename: color → lineColor
    lineStyle: old.lineType,        // Rename: lineType → lineStyle
    opacity: old.opacity,
  };
}

/**
 * Convert ENTERPRISE LineSettings → OLD LineSettings
 */
export function convertLineSettingsToOld(enterprise: EnterpriseLineSettings): OldLineSettings {
  return {
    // Map 4 enterprise fields
    lineWidth: enterprise.lineWidth,
    color: enterprise.lineColor,    // Rename: lineColor → color
    lineType: enterprise.lineStyle, // Rename: lineStyle → lineType
    opacity: enterprise.opacity,

    // Fill missing 31 fields with defaults from defaultLineSettings
    enabled: true,
    dashScale: 1.0,
    dashOffset: 0,
    // ... 28 more fields
  };
}

// Similar converters for Text and Grip settings
```

### Phase 2.2: Create Adapter Hook

```typescript
// File: hooks/adapters/useDxfSettingsAdapter.ts

export function useDxfSettingsAdapter(): DxfSettingsContextType {
  const enterprise = useEnterpriseDxfSettings();

  // Convert state
  const oldSettings = useMemo(() => convertStateToOld(enterprise.settings), [enterprise.settings]);

  return {
    settings: oldSettings,

    // Adapt update methods
    updateLineSettings: (updates: Partial<OldLineSettings>) => {
      enterprise.updateLineSettings('normal', convertLineSettingsToEnterprise(updates), 'general');
    },

    // Adapt get methods
    getEffectiveLineSettings: (mode?: ViewerMode) => {
      const effectiveMode = mode || 'normal';
      return convertLineSettingsToOld(enterprise.getEffectiveLineSettings(effectiveMode));
    },

    // ... adapt all 20+ methods
  };
}
```

---

## ⚠️ MIGRATION RISKS

### 🔴 HIGH RISK: Data Loss During Conversion

**Problem:** Old provider has 35 LineSettings fields, Enterprise has 4. When converting Old → Enterprise, 31 fields are lost.

**Solution:**
- Adapter keeps a "shadow state" of the 31 missing fields
- When converting back Enterprise → Old, shadow state fills the gaps
- Alternative: Store missing fields in IndexedDB separately

### 🟡 MEDIUM RISK: Mode Mapping Confusion

**Problem:** Old provider uses `'preview'`, Enterprise maps it to `'draft'` in storage.

**Solution:**
- Adapter always maps `'preview'` → `'draft'` before calling enterprise methods
- Document this mapping clearly for future developers

### 🟢 LOW RISK: Type Compatibility

**Problem:** `fontWeight: number` vs `fontWeight: 'normal' | 'bold'`

**Solution:**
- Adapter converts: `400 → 'normal'`, `700 → 'bold'`
- Reverse: `'normal' → 400`, `'bold' → 700`

---

## ✅ ADAPTER CHECKLIST (Phase 2)

- [ ] Create `hooks/adapters/converters.ts` (3 converter pairs: Line/Text/Grip)
- [ ] Create `hooks/adapters/useDxfSettingsAdapter.ts` (main adapter hook)
- [ ] Implement state conversion: `SettingsState → DxfSettingsState`
- [ ] Implement method adapters (20+ methods)
- [ ] Handle mode parameter defaults (`mode?: ViewerMode → mode: ViewerMode`)
- [ ] Handle layer parameter injection (`updateLineSettings → updateLineSettings(mode, updates, 'general')`)
- [ ] Test adapter in isolation (no UI changes yet)
- [ ] Document adapter usage in MIGRATION_GUIDE.md

---

## 📋 AFFECTED FILES (23 files from DEPENDENCY_MAP.md)

### Files Using `useDxfSettings()` (Will use adapter)
1. `providers/StyleManagerProvider.tsx` - **CRITICAL** (controls rendering)
2. `providers/GripProvider.tsx`
3. `hooks/useEntityStyles.ts`
4. `hooks/usePreviewMode.ts`
5. `hooks/useOverrideSystem.ts`
6. `hooks/grips/useGripSettings.ts`
7. `hooks/interfaces/useCanvasOperations.ts`
8. `ui/hooks/useSettingsUpdater.ts`
9. `ui/hooks/useUnifiedSpecificSettings.ts`
10. `ui/components/CentralizedAutoSaveStatus.tsx`
11. `ui/components/LevelPanel.tsx`
12. `ui/components/dxf-settings/hooks/useSettingsPreview.ts`
13. `stores/DxfSettingsStore.ts`
14. `contexts/LineSettingsContext.tsx`
15. `contexts/TextSettingsContext.tsx`
16. `contexts/CanvasContext.tsx`

### Files Using `DxfSettingsContextType` Type (Will use adapter type)
17. `stores/ToolStyleStore.ts`
18. `stores/TextStyleStore.ts`
19. `stores/GripStyleStore.ts`
20. `adapters/ZustandToConsolidatedAdapter.ts`

**Total:** 20 files need migration (excluding UI components & tests)

---

## 🔄 NEXT STEPS (Phase 2 Execution)

1. **Create Converters** (1 hour)
   - `convertLineSettingsToEnterprise()` / `convertLineSettingsToOld()`
   - `convertTextSettingsToEnterprise()` / `convertTextSettingsToOld()`
   - `convertGripSettingsToEnterprise()` / `convertGripSettingsToOld()`
   - `convertStateToOld(SettingsState) → DxfSettingsState`

2. **Create Adapter Hook** (2 hours)
   - Implement `useDxfSettingsAdapter()`
   - Wrap all 20+ methods with conversions
   - Handle mode/layer parameter defaults

3. **Test Adapter** (1 hour)
   - Create test file: `__tests__/useDxfSettingsAdapter.test.ts`
   - Test conversions (Old → Enterprise → Old = same)
   - Test method calls (ensure enterprise methods called correctly)

4. **Begin Phase 3** (File-by-file migration)
   - Start with low-risk utility hooks
   - Replace `useDxfSettings()` → `useDxfSettingsAdapter()`
   - Test after each file

---

**END OF TYPE COMPATIBILITY MATRIX**

_Auto-generated from provider analysis_
_Last updated: 2025-10-09_
