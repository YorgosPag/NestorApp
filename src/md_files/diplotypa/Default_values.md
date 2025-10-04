# = ëùë¶ü°ë îô†õü§•†©ù: DEFAULT VALUES

**óºµ¡øº∑ΩØ±**: 2025-10-03
**Scope**: `src/subapps/dxf-viewer/` - Full codebase analysis
**ö±ƒ∑≥ø¡Ø±**: Default Values (DEFAULT_*, defaultConfig, default settings)
**£ƒÃ«ø¬**: ïΩƒø¿π√ºÃ¬ ∫±π ƒµ∫º∑¡Ø…√∑ Ãª…Ω ƒ…Ω ¥π¿ªÃƒ≈¿…Ω default values

---

## =  EXECUTIVE SUMMARY

### ë¿øƒµª≠√º±ƒ± à¡µ≈Ω±¬:
- **50+ DEFAULT constants** µΩƒø¿Ø√ƒ∑∫±Ω
- **6 ∫±ƒ∑≥ø¡Øµ¬ ¥π¿ªøƒÕ¿…Ω** ƒ±≈ƒø¿øπÆ∏∑∫±Ω
- **5 ∫¡Ø√πº± ¥π¿ªÃƒ≈¿±** ¿ø≈ «¡µπ¨∂øΩƒ±π ¨ºµ√∑ µ¿Øª≈√∑
- **~150-200 ≥¡±ºº≠¬ ∫Œ¥π∫±** ¥≈Ω∑ƒπ∫Æ ºµØ…√∑ ºµƒ¨ ƒ∑Ω ∫µΩƒ¡π∫ø¿øØ∑√∑

### †¡øƒµ¡±πÃƒ∑ƒµ¬:
| †¡øƒµ¡±πÃƒ∑ƒ± | ë¡π∏ºÃ¬ îπ¿ªøƒÕ¿…Ω | ï¿Ø¿ƒ…√∑ |
|--------------|-------------------|----------|
| =4 CRITICAL | 3 | Inconsistent defaults, type conflicts, different values |
| =‡ HIGH | 2 | Duplicate RULER/GRID settings, confusion |
| =· MEDIUM | 1 | Minor differences in display settings |
| =‚ LOW | Multiple | Acceptable domain-specific defaults |

---

## =4 CATEGORY 1: LINE SETTINGS DUPLICATES (CRITICAL)

### 1.1 Duplicate: `DEFAULT_LINE_SETTINGS`

**†¡Ã≤ª∑º±**: §ø Ø¥πø constant ≈¿¨¡«µπ √µ 2 ¥π±∆ø¡µƒπ∫¨ ±¡«µØ± ºµ **îôë¶ü°ï§ôöï£ ƒπº≠¬**!

#### Implementation #1: `types/lineSettings.ts` (lines 18-38)
**Location**: `src/subapps/dxf-viewer/types/lineSettings.ts`
**Usage**: ConfigurationProvider, UI components

```typescript
export const DEFAULT_LINE_SETTINGS = {
  enabled: true,
  lineType: 'solid' as const,
  lineWidth: 2,                        // L 2 pixels
  color: '#ffffff',
  opacity: 1.0,
  dashScale: 1.0,
  dashOffset: 0,
  lineCap: 'butt' as const,
  lineJoin: 'miter' as const,
  breakAtCenter: false,
  hoverColor: '#ffff00',
  hoverType: 'solid' as const,
  hoverWidth: 3,                       // L 3 pixels
  hoverOpacity: 0.8,
  finalColor: '#00ff00',
  finalType: 'solid' as const,
  finalWidth: 2,                       // L 2 pixels
  finalOpacity: 1.0,
  activeTemplate: null
};
```

#### Implementation #2: `settings-core/defaults.ts` (lines 12-37)
**Location**: `src/subapps/dxf-viewer/settings-core/defaults.ts`
**Usage**: DxfSettings system, ISO standards compliance

```typescript
export const DEFAULT_LINE_SETTINGS: LineSettings = {
  enabled: true,
  lineType: 'solid',           // ISO 128: Continuous line as default
  lineWidth: 0.25,             //  ISO 128: Standard 0.25mm line weight
  color: '#FFFFFF',            // AutoCAD ACI 7: White for main lines
  opacity: 1.0,                // Full opacity standard
  dashScale: 1.0,              // Standard dash scale
  dashOffset: 0,               // No offset standard
  lineCap: 'butt',             // Standard cap style
  lineJoin: 'miter',           // Standard join style
  breakAtCenter: false,        // No break at center default

  // Hover state
  hoverColor: '#FFFF00',       // AutoCAD ACI 2: Yellow for hover
  hoverType: 'solid',          // Solid hover type
  hoverWidth: 0.35,            //  ISO 128: Next standard width
  hoverOpacity: 0.8,           // Reduced opacity for hover

  // Final state
  finalColor: '#00FF00',       // AutoCAD ACI 3: Green for final state
  finalType: 'solid',          // Solid final type
  finalWidth: 0.35,            //  ISO 128: Slightly thicker for final
  finalOpacity: 1.0,           // Full opacity for final

  activeTemplate: null
};
```

### =% ö°ô£ôúï£ îôë¶ü°ï£:

| Property | types/lineSettings.ts | settings-core/defaults.ts | Standard |
|----------|----------------------|--------------------------|----------|
| **lineWidth** | 2 pixels | 0.25mm (ISO 128) | ISO 128: 0.25mm |
| **hoverWidth** | 3 pixels | 0.35mm (ISO 128) | ISO 128: 0.35mm |
| **finalWidth** | 2 pixels | 0.35mm (ISO 128) | ISO 128: 0.35mm |
| **color** | '#ffffff' (lowercase) | '#FFFFFF' (uppercase) | - |
| **Documentation** | L No comments |  ISO/AutoCAD references | - |
| **Standards Compliance** | L Unknown |  ISO 128 + AutoCAD ACI |  |

**ï¿Ø¿ƒ…√∑**:
- **Inconsistent line widths** ±Ω¨ªø≥± ºµ ƒø ¿øπø module «¡∑√πºø¿øπµØƒ±π
- **Standards compliance**: àΩ± implementation follow ISO 128, ƒø ¨ªªø Ã«π
- **Confusion**: Developers ¥µΩ æ≠¡ø≈Ω ¿øπø µØΩ±π ƒø "√…√ƒÃ" default
- **Maintenance burden**: ëªª±≥≠¬ ¿¡≠¿µπ Ω± ≥ØΩø≈Ω √µ 2 º≠¡∑
- **Type inconsistency**: Lowercase vs uppercase hex colors

### =À £Õ√ƒ±√∑:

**†¡øƒµ¡±πÃƒ∑ƒ±**: =4 CRITICAL

**†¡øƒµπΩÃºµΩ∑ õÕ√∑**:
1. **Keep** ƒø `settings-core/defaults.ts` implementation (ISO 128 compliant, documented)
2. **Delete** ƒø `DEFAULT_LINE_SETTINGS` ±¿Ã `types/lineSettings.ts`
3. **Update** ƒø `types/lineSettings.ts` Ω± ∫¨Ωµπ **re-export** ±¿Ã settings-core:
   ```typescript
   // types/lineSettings.ts
   export { DEFAULT_LINE_SETTINGS } from '../settings-core/defaults';
   ```
4. **Verify** Ãª± ƒ± imports ªµπƒø≈¡≥øÕΩ (backward compatible)
5. **Document** ƒø ISO 128 standard √ƒ± docs

**Migration Steps**:
```bash
# Step 1: Find all usages
grep -rn "DEFAULT_LINE_SETTINGS" src/subapps/dxf-viewer/

# Step 2: Verify imports still work after re-export
# types/lineSettings.ts í re-export from settings-core/defaults.ts

# Step 3: Update types/lineSettings.ts
# Remove local definition, add re-export

# Step 4: Test all line rendering
# Verify line widths are ISO 128 compliant

# Step 5: Update documentation with ISO 128 references
```

**Expected Result**:
-  Single source of truth ≥π± line defaults
-  ISO 128 compliance √µ Ãª∑ ƒ∑Ω µ∆±¡ºø≥Æ
-  Consistent line widths (0.25mm, 0.35mm)
-  Better documentation ºµ standards references
-  -17 ≥¡±ºº≠¬ duplicate code
-  Zero breaking changes (re-export maintains backward compatibility)

---

## =4 CATEGORY 2: TEXT SETTINGS DUPLICATES (CRITICAL)

### 2.1 Duplicate: `DEFAULT_TEXT_SETTINGS`

**†¡Ã≤ª∑º±**: §ø Ø¥πø constant ≈¿¨¡«µπ √µ 2 ¥π±∆ø¡µƒπ∫¨ ±¡«µØ± ºµ **ïù§ïõ©£ îôë¶ü°ï§ôöë PROPERTIES**!

#### Implementation #1: `types/textSettings.ts` (lines 10-21)
**Location**: `src/subapps/dxf-viewer/types/textSettings.ts`
**Properties**: 10 properties, UI-focused

```typescript
export const DEFAULT_TEXT_SETTINGS = {
  enabled: true,
  fontFamily: 'Arial, sans-serif',     // L CSS format
  fontSize: 12,                        // L 12 pixels (screen)
  color: '#ffffff',                    // L Lowercase
  isBold: false,                       // L Boolean flags
  isItalic: false,
  isUnderline: false,
  isStrikethrough: false,
  isSuperscript: false,
  isSubscript: false
};
```

#### Implementation #2: `settings-core/defaults.ts` (lines 43-74)
**Location**: `src/subapps/dxf-viewer/settings-core/defaults.ts`
**Properties**: 24 properties, CAD-focused, ISO 3098 compliant

```typescript
export const DEFAULT_TEXT_SETTINGS: TextSettings = {
  enabled: true,
  fontFamily: 'Arial',                 //  Standard font name
  fontSize: 3.5,                       //  ISO 3098: 3.5mm standard height
  fontWeight: 400,                     //  Numeric weight (not boolean)
  fontStyle: 'normal',                 //  CSS standard
  color: '#FFFFFF',                    //  Uppercase
  opacity: 1.0,                        // Full opacity
  letterSpacing: 0,                    // Normal spacing
  lineHeight: 1.2,                     // Standard line height
  textAlign: 'left',                   // Standard alignment
  textBaseline: 'alphabetic',          // Standard baseline

  // Shadow
  shadowEnabled: false,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  shadowBlur: 0,
  shadowColor: '#000000',

  // Outline
  strokeEnabled: false,
  strokeWidth: 1,
  strokeColor: '#000000',

  // Background
  backgroundEnabled: false,
  backgroundColor: '#000000',
  backgroundPadding: 4,

  activeTemplate: null
};
```

### =% ö°ô£ôúï£ îôë¶ü°ï£:

| Aspect | types/textSettings.ts | settings-core/defaults.ts | Standard |
|--------|----------------------|--------------------------|----------|
| **Properties Count** | 10 | 24 | - |
| **fontSize** | 12 pixels (screen) | 3.5mm (ISO 3098) | ISO 3098: 3.5mm |
| **fontFamily** | 'Arial, sans-serif' | 'Arial' | - |
| **Font Style** | `isBold`, `isItalic` booleans | `fontWeight: 400`, `fontStyle: 'normal'` | CSS standard |
| **Advanced Features** | L Missing |  Shadow, Outline, Background | CAD standard |
| **Standards Compliance** | L Unknown |  ISO 3098 |  |
| **Documentation** | L No comments |  ISO references | - |

**ë√≈º≤±ƒÃƒ∑ƒ± Type Interface**:
- `types/textSettings.ts`: Uses `isBold`, `isItalic`, `isUnderline`, etc. (boolean flags)
- `settings-core/defaults.ts`: Uses `fontWeight`, `fontStyle` (CSS standard values)

**ï¿Ø¿ƒ…√∑**:
- **BREAKING CHANGE ALERT**: §± ¥Õø implementations ≠«ø≈Ω **¥π±∆ø¡µƒπ∫¨ interfaces**!
- **Type conflicts**: `isBold: boolean` vs `fontWeight: number`
- **Incompatible APIs**: Code ¿ø≈ expect `isBold` ∏± fail ºµ `fontWeight`
- **Different measurement units**: Pixels vs millimeters
- **Missing features**: Shadow, outline, background settings
- **Standards compliance**: ISO 3098 vs arbitrary pixel sizes

### =À £Õ√ƒ±√∑:

**†¡øƒµ¡±πÃƒ∑ƒ±**: =4 CRITICAL (ºµ ¿¡ø√ø«Æ - breaking changes!)

**†¡øƒµπΩÃºµΩ∑ õÕ√∑**:
1. **INVESTIGATE FIRST**: í¡µ¬ ¿øπø implementation «¡∑√πºø¿øπµØƒ±π ¿πø ¿øªÕ
2. **Preferred**: Keep `settings-core/defaults.ts` (ISO 3098, ¿πø ¿ªÆ¡µ¬)
3. **Migration Path**:
   - Create **adapter functions** ≥π± backward compatibility
   - Map `isBold` í `fontWeight: 700`, `isItalic` í `fontStyle: 'italic'`
   - Gradually migrate code ±¿Ã boolean flags √µ CSS properties
4. **Deprecation**: Mark `types/textSettings.ts` version as deprecated
5. **Update** all usages step-by-step (incremental migration)

**Adapter Pattern**:
```typescript
// types/textSettings.ts (migration helper)
import { DEFAULT_TEXT_SETTINGS as CORE_DEFAULTS } from '../settings-core/defaults';

/** @deprecated Use DEFAULT_TEXT_SETTINGS from settings-core/defaults.ts instead */
export const DEFAULT_TEXT_SETTINGS_LEGACY = {
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

// Adapter: Convert legacy boolean flags to CSS properties
export function legacyToModernTextSettings(legacy: typeof DEFAULT_TEXT_SETTINGS_LEGACY) {
  return {
    ...CORE_DEFAULTS,
    fontFamily: legacy.fontFamily.split(',')[0].trim(), // Extract first font
    fontWeight: legacy.isBold ? 700 : 400,
    fontStyle: legacy.isItalic ? 'italic' : 'normal',
    // Note: CSS doesn't support underline/strikethrough/super/subscript in canvas
    // These need to be handled separately in rendering
  };
}

// Modern export (preferred)
export { DEFAULT_TEXT_SETTINGS } from '../settings-core/defaults';
```

**Migration Steps**:
```bash
# Step 1: CRITICAL - Map all usages
grep -rn "DEFAULT_TEXT_SETTINGS" src/subapps/dxf-viewer/

# Step 2: Identify which code uses which properties
grep -rn "isBold\|isItalic" src/subapps/dxf-viewer/
grep -rn "fontWeight\|fontStyle" src/subapps/dxf-viewer/

# Step 3: Create adapter functions (backward compatibility)
# Add legacyToModernTextSettings() helper

# Step 4: Migrate code incrementally (one file at a time)
# Update imports + convert boolean flags to CSS properties

# Step 5: Test text rendering thoroughly
# Verify bold/italic still work correctly

# Step 6: Remove legacy implementation after full migration
```

**Expected Result**:
-  Single source of truth (after migration)
-  ISO 3098 compliance
-  CSS standard properties (fontWeight, fontStyle)
-  Advanced features (shadow, outline, background)
-  Better CAD compatibility
- † **Breaking changes** managed with adapters
- Ò **Timeline**: 2-3 weeks ≥π± ¿ªÆ¡∑ migration

---

## =4 CATEGORY 3: GRIP SETTINGS DUPLICATES (CRITICAL)

### 3.1 Duplicate: `DEFAULT_GRIP_SETTINGS`

**†¡Ã≤ª∑º±**: §ø Ø¥πø constant ≈¿¨¡«µπ √µ 2 ¥π±∆ø¡µƒπ∫¨ ±¡«µØ± ºµ **ºπ∫¡≠¬ ¥π±∆ø¡≠¬**

#### Implementation #1: `types/gripSettings.ts` (lines 67-83)
**Location**: `src/subapps/dxf-viewer/types/gripSettings.ts`
**Properties**: Complete, AutoCAD-compliant

```typescript
export const DEFAULT_GRIP_SETTINGS: GripSettings = {
  ...defaultGripSettings, // gripSize: 5, pickBoxSize: 3, apertureSize: 10, colors

  enabled: true,            //  Enable grip system by default
  showGrips: true,          //  ë†üöë§ë£§ë£ó: ïΩµ¡≥ø¿øØ∑√∑ grips
  multiGripEdit: true,      //  ë†üöë§ë£§ë£ó: ïΩµ¡≥ø¿øØ∑√∑ multi grips
  snapToGrips: true,        //  ë†üöë§ë£§ë£ó: ïΩµ¡≥ø¿øØ∑√∑ snap to grips
  showGripTips: false,
  dpiScale: 1.0,
  maxGripsPerEntity: 50,    //  Default maximum grips per entity

  // === Display Settings ===
  opacity: 1.0,             //  Full opacity by default
  showMidpoints: true,      //  Show midpoint grips
  showCenters: true,        //  Show center grips
  showQuadrants: true       //  Show quadrant grips
};
```

#### Implementation #2: `settings-core/defaults.ts` (lines 80-99)
**Location**: `src/subapps/dxf-viewer/settings-core/defaults.ts`
**Properties**: Subset, missing some properties

```typescript
export const DEFAULT_GRIP_SETTINGS: GripSettings = {
  enabled: true,
  gripSize: 5,                 // AutoCAD GRIPSIZE default: 5 DIP
  pickBoxSize: 3,              // AutoCAD PICKBOX default: 3 DIP
  apertureSize: 10,            // AutoCAD APERTURE default: 10 pixels
  opacity: 1.0,                // Full opacity
  colors: {
    cold: '#0000FF',           // AutoCAD: Blue (ACI 5) - unselected grips
    warm: '#FF69B4',           // AutoCAD: Hot Pink - hover grips
    hot: '#FF0000',            // AutoCAD: Red (ACI 1) - selected grips
    contour: '#000000'         // AutoCAD: Black contour
  },
  showAperture: true,          // Show aperture box
  multiGripEdit: true,         // Allow multiple grip editing
  snapToGrips: true,           // Snap to grips enabled
  showMidpoints: true,         // Show midpoint grips
  showCenters: true,           // Show center grips
  showQuadrants: true,         // Show quadrant grips
  maxGripsPerEntity: 50        // Maximum grips per entity
  // L MISSING: showGrips, showGripTips, dpiScale
};
```

### =% îôë¶ü°ï£:

| Property | types/gripSettings.ts | settings-core/defaults.ts | Status |
|----------|----------------------|--------------------------|--------|
| **showGrips** |  true | L Missing | Missing in settings-core |
| **showGripTips** |  false | L Missing | Missing in settings-core |
| **dpiScale** |  1.0 | L Missing | Missing in settings-core |
| **enabled** |  true |  true |  Same |
| **All others** |  Present |  Present |  Same |

**ï¿Ø¿ƒ…√∑**:
- **Minor differences**: õµØ¿ø≈Ω 3 properties ±¿Ã settings-core version
- **Incomplete interface**: `settings-core/defaults.ts` ¥µΩ implement full `GripSettings` interface
- **Potential runtime errors**: Code ¿ø≈ expect `showGrips` property ∏± fail
- **Maintenance**: Duplicate code ¿ø≈ ¿¡≠¿µπ Ω± sync-±¡µƒ±π

### =À £Õ√ƒ±√∑:

**†¡øƒµ¡±πÃƒ∑ƒ±**: =4 CRITICAL (±ªª¨ µÕ∫øª∑ µ¿Øª≈√∑)

**†¡øƒµπΩÃºµΩ∑ õÕ√∑**:
1. **Keep** ƒø `types/gripSettings.ts` implementation (complete, ¿πø updated)
2. **Delete** ƒø `DEFAULT_GRIP_SETTINGS` ±¿Ã `settings-core/defaults.ts`
3. **Update** ƒø `settings-core/defaults.ts` Ω± ∫¨Ωµπ **re-export**:
   ```typescript
   // settings-core/defaults.ts
   export { DEFAULT_GRIP_SETTINGS } from '../types/gripSettings';
   ```
4. **Verify** Ãª± ƒ± imports ªµπƒø≈¡≥øÕΩ

**Alternative** (if settings-core should be source of truth):
1. **Update** ƒø `settings-core/defaults.ts` Ω± include ƒ± missing properties
2. **Delete** ±¿Ã `types/gripSettings.ts` ∫±π ∫¨Ωµ re-export

**Migration Steps**:
```bash
# Step 1: Find all usages
grep -rn "DEFAULT_GRIP_SETTINGS" src/subapps/dxf-viewer/

# Step 2: Choose which file is source of truth
# Recommendation: types/gripSettings.ts (more complete)

# Step 3: Update settings-core/defaults.ts to re-export
# OR update settings-core to include missing properties

# Step 4: Test grip functionality
```

**Expected Result**:
-  Single source of truth
-  Complete GripSettings interface
-  No missing properties
-  -18 ≥¡±ºº≠¬ duplicate code
-  Zero breaking changes

---

## =‡ CATEGORY 4: RULER SETTINGS DUPLICATES (HIGH)

### 4.1 Duplicate: `DEFAULT_RULER_SETTINGS`

**†¡Ã≤ª∑º±**: §ø Ø¥πø constant ≈¿¨¡«µπ √µ 2 ¥π±∆ø¡µƒπ∫¨ ±¡«µØ± ºµ **îôë¶ü°ï§ôöë INTERFACES**!

#### Implementation #1: `systems/rulers-grid/config.ts` (lines 124-178)
**Location**: `src/subapps/dxf-viewer/systems/rulers-grid/config.ts`
**Type**: Complex nested structure (horizontal/vertical/units/snap)
**Properties**: 50+ properties

```typescript
export const DEFAULT_RULER_SETTINGS: RulerSettings = {
  horizontal: {
    enabled: false,  // =' FIX: Start disabled
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
    // ... similar structure ...
    enabled: false,
    width: 30,
    position: 'left',
    // ... all same properties as horizontal ...
  },
  units: 'mm',
  snap: {
    enabled: false,
    tolerance: 5
  }
};
```

#### Implementation #2: `rendering/ui/ruler/RulerTypes.ts` (lines 88-122)
**Location**: `src/subapps/dxf-viewer/rendering/ui/ruler/RulerTypes.ts`
**Type**: Flat structure (single ruler settings)
**Properties**: 20 properties

```typescript
export const DEFAULT_RULER_SETTINGS: RulerSettings = {
  enabled: true,               // L Different default (true vs false)
  visible: true,
  opacity: 1.0,
  color: '#333333',            // L Different color
  backgroundColor: '#f0f0f0',
  textColor: '#000000',        // L Different color
  fontSize: 12,                // L Different size
  height: 30,                  //  Same
  width: 30,                   //  Same

  // Ticks configuration
  showMajorTicks: true,
  showMinorTicks: true,
  majorTickColor: '#333333',
  minorTickColor: '#666666',
  majorTickLength: 10,
  minorTickLength: 5,
  tickInterval: 100,           // L New property (not in system config)

  // Labels configuration
  showLabels: true,
  showUnits: true,
  unit: 'mm',                  // L Singular (vs 'units' plural)
  unitsFontSize: 10,
  unitsColor: '#666666',
  labelPrecision: 0,           // L New property

  // Background
  showBackground: true,
  borderColor: '#cccccc',      // L New property
  borderWidth: 1,              // L New property

  zIndex: 200                  // L New property
};
```

### =% ö°ô£ôúï£ îôë¶ü°ï£:

| Aspect | systems/rulers-grid/config.ts | rendering/ui/ruler/RulerTypes.ts |
|--------|------------------------------|----------------------------------|
| **Interface Type** | Nested (horizontal/vertical) | Flat (single ruler) |
| **Enabled Default** | false | true |
| **Properties** | 50+ (comprehensive) | 20 (subset) |
| **color** | '#f0f0f0' | '#333333' |
| **textColor** | '#333333' | '#000000' |
| **fontSize** | 10 | 12 |
| **unit property** | `units` (plural) | `unit` (singular) |
| **Extra Props** | - | tickInterval, labelPrecision, borderColor, borderWidth, zIndex |
| **Purpose** | System-wide config | UI rendering |

**Type Incompatibility**:
- `systems/rulers-grid/config.ts`: `{ horizontal: {...}, vertical: {...}, units, snap }`
- `rendering/ui/ruler/RulerTypes.ts`: `{ color, fontSize, height, ... }` (flat)

**ï¿Ø¿ƒ…√∑**:
- **DIFFERENT TYPES**: §± ¥Õø implementations ≠«ø≈Ω **µΩƒµªŒ¬ ¥π±∆ø¡µƒπ∫¨ interfaces**!
- **Cannot be used interchangeably**: ïØΩ±π ≥π± ¥π±∆ø¡µƒπ∫¨ purposes
- **Confusion**: Developers ¥µΩ æ≠¡ø≈Ω ¿øπø Ω± «¡∑√πºø¿øπÆ√ø≈Ω
- **Inconsistent defaults**: enabled true vs false, ¥π±∆ø¡µƒπ∫¨ colors

### =À £Õ√ƒ±√∑:

**†¡øƒµ¡±πÃƒ∑ƒ±**: =‡ HIGH

**ëΩ¨ª≈√∑**:
ë≈ƒ¨ ƒ± ¥Õø `DEFAULT_RULER_SETTINGS` µØΩ±π ≥π± **¥π±∆ø¡µƒπ∫¨ purposes**:
1. **systems/rulers-grid/config.ts**: System-wide configuration (horizontal + vertical rulers together)
2. **rendering/ui/ruler/RulerTypes.ts**: Individual ruler rendering settings

**†¡øƒµπΩÃºµΩ∑ õÕ√∑**:
1. **RENAME** ≥π± clarity:
   - `systems/rulers-grid/config.ts`: Keep as `DEFAULT_RULER_SETTINGS` (system config)
   - `rendering/ui/ruler/RulerTypes.ts`: Rename to `DEFAULT_RULER_RENDER_SETTINGS` (render config)
2. **Document** ƒ∑ ¥π±∆ø¡¨ √ƒ± comments
3. **Cross-reference**: System config í render settings mapping

**Alternative** (if they should be unified):
1. Create **adapter function** Ω± convert system config √µ render settings:
   ```typescript
   export function systemConfigToRenderSettings(
     systemConfig: typeof DEFAULT_RULER_SETTINGS,
     orientation: 'horizontal' | 'vertical'
   ): RulerRenderSettings {
     const rulerConfig = orientation === 'horizontal'
       ? systemConfig.horizontal
       : systemConfig.vertical;

     return {
       enabled: rulerConfig.enabled,
       visible: rulerConfig.enabled,
       color: rulerConfig.color,
       backgroundColor: rulerConfig.backgroundColor,
       // ... map all properties ...
     };
   }
   ```

**Migration Steps**:
```typescript
// Step 1: Rename rendering/ui/ruler/RulerTypes.ts constant
export const DEFAULT_RULER_RENDER_SETTINGS: RulerSettings = {
  // ... existing properties ...
};

// Step 2: Update imports
// Find: import { DEFAULT_RULER_SETTINGS } from '../../rendering/ui/ruler/RulerTypes';
// Replace with: import { DEFAULT_RULER_RENDER_SETTINGS } from '../../rendering/ui/ruler/RulerTypes';

// Step 3: OR create adapter if unification is needed
```

**Expected Result**:
-  Clear naming distinction
-  No confusion about which to use
-  Both serve their purposes
-  Documentation clarifies difference
- † **Not a true duplicate** - different purposes, should coexist

---

## =‡ CATEGORY 5: GRID SETTINGS DUPLICATES (HIGH)

### 5.1 Duplicate: `DEFAULT_GRID_SETTINGS`

**†¡Ã≤ª∑º±**: §ø Ø¥πø constant ≈¿¨¡«µπ √µ 2 ¥π±∆ø¡µƒπ∫¨ ±¡«µØ± ºµ **îôë¶ü°ï§ôöë INTERFACES**

#### Implementation #1: `systems/rulers-grid/config.ts` (lines 180-213)
**Location**: `src/subapps/dxf-viewer/systems/rulers-grid/config.ts`
**Type**: Complex nested structure (visual/snap/behavior)
**Properties**: 30+ properties

```typescript
export const DEFAULT_GRID_SETTINGS: GridSettings = {
  visual: {
    enabled: true,
    step: 10,
    opacity: 0.6,
    color: '#4444ff',          // L Blue
    style: 'lines',            //  NEW: Grid style option
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

#### Implementation #2: `rendering/ui/grid/GridTypes.ts` (lines 63-83)
**Location**: `src/subapps/dxf-viewer/rendering/ui/grid/GridTypes.ts`
**Type**: Flat structure (single grid settings)
**Properties**: 15 properties

```typescript
export const DEFAULT_GRID_SETTINGS: GridSettings = {
  enabled: true,
  visible: true,
  opacity: 0.3,                // L Different (0.3 vs 0.6)
  color: '#808080',            // L Gray (vs blue)
  size: 10,                    //  Same as step
  style: 'lines',              //  Same
  lineWidth: 1,

  // Advanced features
  majorGridColor: '#606060',   // L Different colors
  minorGridColor: '#404040',   // L Different colors
  majorInterval: 5,            // L Different from subDivisions
  showMajorGrid: true,
  showMinorGrid: true,
  adaptiveOpacity: true,       // L New property
  minVisibleSize: 5,           // L New property

  zIndex: 100                  // L New property
};
```

### =% ö°ô£ôúï£ îôë¶ü°ï£:

| Aspect | systems/rulers-grid/config.ts | rendering/ui/grid/GridTypes.ts |
|--------|------------------------------|--------------------------------|
| **Interface Type** | Nested (visual/snap/behavior) | Flat (single grid) |
| **Properties** | 30+ (comprehensive) | 15 (subset) |
| **opacity** | 0.6 | 0.3 |
| **color** | '#4444ff' (blue) | '#808080' (gray) |
| **majorGridColor** | '#888888' | '#606060' |
| **minorGridColor** | '#bbbbbb' | '#404040' |
| **Extra Props (config)** | snap settings, behavior settings | - |
| **Extra Props (render)** | - | adaptiveOpacity, minVisibleSize, zIndex |
| **Purpose** | System-wide config | UI rendering |

**†±¡Ãºøπ± ö±ƒ¨√ƒ±√∑ ºµ RULER_SETTINGS**:
- Nested system config vs flat render settings
- Different purposes, different interfaces
- **NOT a true duplicate** - should coexist

### =À £Õ√ƒ±√∑:

**†¡øƒµ¡±πÃƒ∑ƒ±**: =‡ HIGH (similar to ruler settings)

**†¡øƒµπΩÃºµΩ∑ õÕ√∑**:
1. **RENAME** ≥π± clarity:
   - `systems/rulers-grid/config.ts`: Keep as `DEFAULT_GRID_SETTINGS` (system config)
   - `rendering/ui/grid/GridTypes.ts`: Rename to `DEFAULT_GRID_RENDER_SETTINGS` (render config)
2. **Document** ƒ∑ ¥π±∆ø¡¨
3. **Cross-reference**: System config í render settings mapping

**Expected Result**:
-  Clear naming distinction
-  Both serve their purposes
-  Documentation clarifies difference
- † **Not a true duplicate** - different purposes

---

## =· CATEGORY 6: ZOOM CONSTANTS DUPLICATES (MEDIUM)

### 6.1 Minor Duplicate: Zoom factors/limits in multiple places

**Observation**: Zoom constants defined √µ ¿øªª¨ º≠¡∑ ±ªª¨ ºµ consistent values

**Locations**:
- `systems/zoom/zoom-constants.ts`: `DEFAULT_ZOOM_CONFIG`, `ZOOM_FACTORS`, `ZOOM_LIMITS`
- `rendering/canvas/core/CanvasSettings.ts`: Inline defaults (devicePixelRatio, etc.)
- Various hooks: useZoom, useCanvasOperations

**Analysis**:
- **Not critical duplicates**: §± values µØΩ±π consistent
- **Centralized**: §± ¿µ¡π√√Ãƒµ¡± «¡∑√πºø¿øπøÕΩ ƒø `zoom-constants.ts`
- **OK to keep**: Domain-specific constants ≥π± performance

### =À £Õ√ƒ±√∑:

**†¡øƒµ¡±πÃƒ∑ƒ±**: =· MEDIUM (low priority - already centralized)

**Action**: Document ¿ø≈ µØΩ±π ƒø canonical source (`zoom-constants.ts`) ∫±π ensure Ãªøπ import ±¿Ã µ∫µØ

---

## =‚ CATEGORY 7: ACCEPTABLE DEFAULTS (LOW PRIORITY)

### 7.1 Domain-Specific Defaults

**Observation**: †øªª¨ `DEFAULT_*` constants √µ ¥π¨∆ø¡± modules

**Examples**:
```typescript
// systems/selection/config.ts
export const DEFAULT_SELECTION_STATE
export const DEFAULT_FILTER_STATE
export const DEFAULT_SELECTION_PREFERENCES

// systems/toolbars/config.ts
export const DEFAULT_TOOLBAR_STYLE
export const DEFAULT_TOOLBAR_BEHAVIOR
export const DEFAULT_TOOLBAR_LAYOUT

// systems/levels/config.ts
export const DEFAULT_LEVEL_CONFIG
export const DEFAULT_LEVEL_SETTINGS

// systems/entity-creation/config.ts
export const DEFAULT_ENTITY_CREATION_CONFIG
export const DEFAULT_DRAWING_CONSTRAINTS
export const DEFAULT_VALIDATION_RULES

// systems/constraints/config.ts
export const DEFAULT_ORTHO_SETTINGS
export const DEFAULT_POLAR_SETTINGS
export const DEFAULT_CONSTRAINTS_SETTINGS

// config/tolerance-config.ts
export const TOLERANCE_CONFIG
export const DEFAULT_TOLERANCE
```

**Analysis**:
- **Domain-specific**: ö¨∏µ constant µØΩ±π ≥π± specific domain/module
- **No duplication**: îµΩ ≈¿¨¡«ø≈Ω overlapping definitions
- **Well-organized**: Grouped by system/feature
- **OK to keep**: ë≈ƒÃ µØΩ±π good modular design

### =À £Õ√ƒ±√∑:

**†¡øƒµ¡±πÃƒ∑ƒ±**: =‚ LOW (No action needed)

**Reason**: Domain-specific defaults µØΩ±π **acceptable localization**, Ã«π harmful duplication.

**Best Practice**: ö¡±ƒÆ√ƒµ ±≈ƒ¨ ƒ± constants √ƒ± modules ¿ø≈ ƒ± «¡∑√πºø¿øπøÕΩ, ≥π± cohesion.

---

## =  SUMMARY TABLE: ALL DUPLICATES

| # | Duplicate | Files | Priority | LOC Saved | Impact | Breaking? |
|---|-----------|-------|----------|-----------|--------|-----------|
| 1 | `DEFAULT_LINE_SETTINGS` | 2 | =4 CRITICAL | ~17 | Inconsistent widths, ISO compliance | L No (re-export) |
| 2 | `DEFAULT_TEXT_SETTINGS` | 2 | =4 CRITICAL | ~14 | Different interfaces, type conflicts |  YES (needs adapter) |
| 3 | `DEFAULT_GRIP_SETTINGS` | 2 | =4 CRITICAL | ~18 | Missing properties | L No (re-export) |
| 4 | `DEFAULT_RULER_SETTINGS` | 2 | =‡ HIGH | 0 | Different interfaces, different purposes | † Rename (not true dup) |
| 5 | `DEFAULT_GRID_SETTINGS` | 2 | =‡ HIGH | 0 | Different interfaces, different purposes | † Rename (not true dup) |
| 6 | Zoom constants | Multiple | =· MEDIUM | 0 | Already centralized | L No |
| 7 | Domain-specific defaults | 20+ | =‚ LOW | 0 |  Acceptable localization | L No |

**Total Critical Issues**: 3 (LINE, TEXT, GRIP)
**Total Reduction**: ~50-60 ≥¡±ºº≠¬ ∫Œ¥π∫± (critical only)
**Breaking Changes**: 1 (TEXT settings - needs adapter)
**Renamings Needed**: 2 (RULER, GRID - ≥π± clarity)

---

## <Ø RECOMMENDED ACTION PLAN

### Phase 1: Critical Fixes (Week 1)
**Priority**: =4 CRITICAL

**Task 1.1: Fix DEFAULT_LINE_SETTINGS**
-  Keep `settings-core/defaults.ts` (ISO 128 compliant)
-  Update `types/lineSettings.ts` to re-export
-  Verify all imports work
-  Test line rendering ºµ ISO 128 widths
- **Risk**: =‚ LOW (backward compatible re-export)

**Task 1.2: Fix DEFAULT_GRIP_SETTINGS**
-  Keep `types/gripSettings.ts` (complete interface)
-  Update `settings-core/defaults.ts` to re-export
-  Verify all imports work
-  Test grip rendering
- **Risk**: =‚ LOW (backward compatible re-export)

**Task 1.3: Plan DEFAULT_TEXT_SETTINGS Migration**
- † **BREAKING CHANGE ALERT**: Needs careful planning
-  Create adapter functions (boolean flags í CSS properties)
-  Document migration path
-  Create deprecation warnings
- **DON'T rush**: This needs incremental migration
- **Risk**: =‡ MEDIUM (breaking changes)

### Phase 2: Text Settings Migration (Week 2-3)
**Priority**: =4 CRITICAL (but slow and careful)

**Task 2.1: Create Adapter Layer**
-  Implement `legacyToModernTextSettings()` adapter
-  Implement reverse adapter (if needed)
-  Add deprecation warnings
-  Update types to support both formats temporarily

**Task 2.2: Incremental Migration**
-  Migrate high-level components first (providers)
-  Test each component after migration
-  Gradually migrate down to low-level renderers
-  Keep adapter for backward compatibility

**Task 2.3: Final Cleanup**
-  Remove deprecated legacy format (after all code migrated)
-  Remove adapter functions
-  Update documentation

### Phase 3: Clarify RULER/GRID Settings (Week 3)
**Priority**: =‡ HIGH

**Task 3.1: Rename for Clarity**
-  Rename `rendering/ui/ruler/RulerTypes.ts`: `DEFAULT_RULER_RENDER_SETTINGS`
-  Rename `rendering/ui/grid/GridTypes.ts`: `DEFAULT_GRID_RENDER_SETTINGS`
-  Update all imports
-  Document difference between system config vs render settings

**Task 3.2: Create Adapter (Optional)**
-  Create `systemConfigToRenderSettings()` ≥π± rulers
-  Create `systemConfigToRenderSettings()` ≥π± grid
-  Use adapter √ƒø rendering layer

### Phase 4: Documentation & Monitoring (Ongoing)
**Priority**: =‚ LOW

**Task 4.1: Document Standards**
-  Document ISO 128 line standards
-  Document ISO 3098 text standards
-  Document AutoCAD grip standards
-  Create "Default Values Guide"

**Task 4.2: Prevent Future Duplicates**
-  Add lint rule Ω± detect duplicate `DEFAULT_*` constants
-  Code review checklist ≥π± new defaults
-  Centralized defaults registry (optional)

---

## =' TECHNICAL MIGRATION GUIDE

### Migration Template ≥π± DEFAULT Constants:

```markdown
## Migration: [Constant Name]

### Pre-Migration Checklist
- [ ] Backup affected files
- [ ] Document current behavior
- [ ] Find all usages (`grep -rn "CONSTANT_NAME" src/`)
- [ ] Identify which implementation is correct
- [ ] Check for type conflicts
- [ ] Create test cases

### Migration Steps
1. [ ] Choose source of truth (most complete, standards-compliant)
2. [ ] Update other file to re-export (if backward compatible)
   OR
2. [ ] Create adapter layer (if breaking changes)
3. [ ] Update imports in affected files
4. [ ] Run TypeScript compilation check
5. [ ] Test affected functionality
6. [ ] Update documentation

### Post-Migration
- [ ] Verify no breaking changes
- [ ] Update CHANGELOG
- [ ] Monitor for issues (1 week)
- [ ] Remove backup files

### Rollback Plan
- [ ] Restore backup files
- [ ] Revert imports
- [ ] Document issue
```

---

## =» EXPECTED RESULTS

### Code Quality Metrics:
-  **~50-60 ≥¡±ºº≠¬ reduction** (critical duplicates only)
-  **3 critical duplicates eliminated** (LINE, TEXT, GRIP)
-  **2 renamings** ≥π± clarity (RULER, GRID)
-  **ISO standards compliance** (ISO 128 lines, ISO 3098 text)
-  **AutoCAD compatibility** (grip settings)
- † **1 breaking change** (TEXT settings - managed ºµ adapters)

### Developer Experience:
-  **Clear single source** ≥π± ∫¨∏µ default value
-  **Standards documentation** (ISO 128, ISO 3098, AutoCAD)
-  **Better naming** (system config vs render settings)
-  **Easier maintenance**: ëªª±≥≠¬ √µ ≠Ω± º≠¡ø¬
-  **Less confusion**: ûµ∫¨∏±¡ø ¿øπø constant Ω± «¡∑√πºø¿øπÆ√µπ¬

### User Experience:
-  **Consistent behavior**: ä¥π± defaults √µ Ãª∑ ƒ∑Ω µ∆±¡ºø≥Æ
-  **CAD standards**: ISO-compliant line widths ∫±π text sizes
-  **AutoCAD compatibility**: Grip colors ∫±π sizes
-  **Professional output**: Standards-compliant drawings

---

## =⁄ APPENDIX: STANDARDS REFERENCES

### ISO 128 (Line Standards)
- **0.25mm**: Standard line weight ≥π± main lines
- **0.35mm**: Next standard weight ≥π± hover/final states
- **0.5mm**: Thick lines ≥π± outlines
- **Line types**: Continuous (solid), dashed, dash-dot, dash-dot-dot

### ISO 3098 (Text Standards)
- **3.5mm**: Standard text height ≥π± technical drawings
- **5.0mm**: Subtitle text height
- **7.0mm**: Title text height
- **Font**: Arial or similar sans-serif
- **Weight**: 400 (normal), 600 (semi-bold), 700 (bold)

### AutoCAD Grip Standards
- **GRIPSIZE**: 1-255 DIPs, default 5
- **PICKBOX**: 0-50 DIPs, default 3
- **APERTURE**: 1-50 pixels, default 10
- **Colors**:
  - Cold (unselected): Blue (#0000FF, ACI 5)
  - Warm (hover): Hot Pink (#FF69B4)
  - Hot (selected): Red (#FF0000, ACI 1)
  - Contour: Black (#000000)

---

## =· RISK ASSESSMENT

### Low Risk (Safe to proceed)
 `DEFAULT_LINE_SETTINGS` - Re-export, backward compatible
 `DEFAULT_GRIP_SETTINGS` - Re-export, backward compatible
 Zoom constants - Already centralized

### Medium Risk (Needs care)
† `DEFAULT_TEXT_SETTINGS` - Breaking changes, needs adapter
† RULER/GRID rename - Update imports, minimal breaking

### High Risk
L None identified

---

##  CONCLUSION

ë≈ƒÆ ∑ ±Ω±∆ø¡¨ µΩƒÃ¿π√µ ∫±π ƒµ∫º∑¡Ø…√µ **6 ∫±ƒ∑≥ø¡Øµ¬ default value duplicates** √ƒø `dxf-viewer` codebase:

1. =4 **CRITICAL**: DEFAULT_LINE_SETTINGS (2 files, ¥π±∆ø¡µƒπ∫¨ values - ISO compliance issue)
2. =4 **CRITICAL**: DEFAULT_TEXT_SETTINGS (2 files, ¥π±∆ø¡µƒπ∫¨ interfaces - breaking change)
3. =4 **CRITICAL**: DEFAULT_GRIP_SETTINGS (2 files, missing properties)
4. =‡ **HIGH**: DEFAULT_RULER_SETTINGS (2 files, ¥π±∆ø¡µƒπ∫¨ purposes - rename needed)
5. =‡ **HIGH**: DEFAULT_GRID_SETTINGS (2 files, ¥π±∆ø¡µƒπ∫¨ purposes - rename needed)
6. =‚ **LOW**: Domain-specific defaults (acceptable localization)

**Recommended Action**: Follow the 4-phase action plan ≥π± systematic consolidation

**Expected Timeline**: 3 weeks (1 week critical fixes + 2 weeks text migration)

**Risk Level**: =· MEDIUM (due to TEXT settings breaking changes - managed ºµ adapters)

**Key Takeaway**: §± ¿µ¡π√√Ãƒµ¡± duplicates µØΩ±π µÕ∫øª± Ω± fix-±¡ø≈Ω ºµ re-exports. úÃΩø ƒø TEXT settings «¡µπ¨∂µƒ±π careful migration due to interface changes.

---

**ëΩ±∆ø¡¨ ¥∑ºπø≈¡≥Æ∏∑∫µ**: 2025-10-03
**£≈Ωøªπ∫¨ DEFAULT constants**: 50+
**Critical duplicates**: 3
**Breaking changes**: 1 (TEXT settings)
**LOC reduction**: ~50-60 ≥¡±ºº≠¬

---

*=% ë≈ƒÆ ∑ ±Ω±∆ø¡¨ ¥∑ºπø≈¡≥Æ∏∑∫µ ºµ †õó°ó ±Ω¨ª≈√∑ Ãªø≈ ƒø≈ dxf-viewer codebase, √Õº∆…Ω± ºµ ƒπ¬ ø¥∑≥Øµ¬ ƒø≈ îïöëõüìü• ï°ìë£ôë£.*
