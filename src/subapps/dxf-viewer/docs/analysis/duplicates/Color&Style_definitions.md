# <¨ ‘‘¦Ÿ¡‘ ”™ ›Ÿ¤¥ © COLOR/STYLE DEFINITIONS - DXF VIEWER

**—¼µÁ¿¼·½¯± ‘½¬»ÅÃ·Â:** 2025-10-03
**‘½±»ÅÄ®Â:** Claude (Anthropic AI)
** µÁ¹¿Ç® ‘½¬»ÅÃ·Â:** `src/subapps/dxf-viewer/` - Color & Style Definitions
**‘ÁÇµ¯± À¿Å •¾µÄ¬ÃÄ·º±½:** 70+ files with style patterns

---

## =Ê £¥Ÿ›™š— •™šŸ‘

### ’±Ã¹º® £Ä±Ä¹ÃÄ¹º®

| š±Ä·³¿Á¯± | ‘ÁÇµ¯± | ”¹À»ÌÄÅÀµÂ “Á±¼¼­Â |  ¿Ã¿ÃÄÌ |  Á¿ÄµÁ±¹ÌÄ·Ä± |
|-----------|---------|-------------------|---------|---------------|
| **Style Interfaces** | 15 | ~400 | 35% | =4 HIGH |
| **Hardcoded Colors** | 50+ | ~150 | 13% | =á MEDIUM |
| **Line Style Types** | 3 | ~80 | 7% | =á MEDIUM |
| **Preview Style Hooks** | 6 | ~300 | 27% | =à HIGH |
| **Color Config Files** | 6 | ~200 | 18% | =â LOW |

**£¥Ÿ›Ÿ:** ~1,130 ³Á±¼¼­Â duplicate code Ãµ 70+ ±ÁÇµ¯±

**OVERALL QUALITY SCORE:** 5.8/10  

### =% šÍÁ¹± •ÅÁ®¼±Ä±

**~400 ³Á±¼¼­Â duplicate style interfaces** Ãµ 8 ´¹±Æ¿ÁµÄ¹º¬ locations - **š¡™£™œŸ**. ¥À¬ÁÇµ¹ canonical source (`settings-core/types.ts`) ±»»¬ ´µ½ ÇÁ·Ã¹¼¿À¿¹µ¯Ä±¹ À±½Ä¿Í.

---

## 1ã STYLE INTERFACE DUPLICATION - £Ÿ’‘¡Ÿ  ¡Ÿ’›—œ‘ (5/10)

### =4  ÁÌ²»·¼±: 8 Overlapping Style Interfaces

**Canonical Source** (˜‘  ¡• •™ ½± ÇÁ·Ã¹¼¿À¿¹µ¯Ä±¹ À±½Ä¿Í):
- `settings-core/types.ts` (500+ ³Á±¼¼­Â) - **MASTER DEFINITIONS**

**Duplicate Definitions:**

#### GripStyle / GripSettings (3 ´¹±Æ¿ÁµÄ¹º¬ definitions - ~120 ³Á±¼¼­Â)

1. **settings-core/types.ts:201-256** (CANONICAL)
```typescript
export interface GripSettings {
  size: number;
  color: string;
  highlightColor: string;
  strokeWidth: number;
  fillOpacity: number;
  type: 'square' | 'circle';
  // ... + 15 more properties
}
```

2. **hooks/useGripPreviewStyle.ts:8-22** (DUPLICATE - 15 ³Á±¼¼­Â)
```typescript
interface GripStyle {
  size: number;
  color: string;
  highlightColor: string;
  fillOpacity: number;
}
```

3. **rendering/entities/shared/geometry-rendering-utils.ts:168-185** (DUPLICATE - 18 ³Á±¼¼­Â)
```typescript
interface GripStyle {
  size: number;
  fillColor: string;    // <-- Different property name!
  strokeColor: string;  // <-- Different property name!
  lineWidth: number;
}
```

** ¡Ÿ’›—œ‘:** ¤Áµ¹Â ´¹±Æ¿ÁµÄ¹º¿¯ ¿Á¹Ã¼¿¯ ¼µ ´¹±Æ¿ÁµÄ¹º¬ property names (`color` vs `fillColor`, `highlightColor` vs `strokeColor`)!

#### TextStyle / TextSettings (3 definitions - ~80 ³Á±¼¼­Â)

1. **settings-core/types.ts:140-160** (CANONICAL)
```typescript
export interface TextSettings {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  color: string;
  backgroundColor: string;
  // ... + 8 more properties
}
```

2. **hooks/useTextPreviewStyle.ts:7-18** (DUPLICATE - 12 ³Á±¼¼­Â)
```typescript
interface TextStyle {
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
}
```

3. **rendering/entities/BaseEntityRenderer.ts:98-125** (DUPLICATE - 28 ³Á±¼¼­Â)
```typescript
interface TextStyle {
  font: string;         // <-- Combined fontFamily + fontSize!
  fillStyle: string;    // <-- Different property name!
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
}
```

#### ToolStyle / LineSettings (2 definitions - ~50 ³Á±¼¼­Â)

1. **settings-core/types.ts:82-110** (CANONICAL)
```typescript
export interface LineSettings {
  color: string;
  width: number;
  style: LineType;
  opacity: number;
  arrowStart: boolean;
  arrowEnd: boolean;
  // ... + 5 more properties
}
```

2. **hooks/useLinePreviewStyle.ts:6-18** (DUPLICATE - 13 ³Á±¼¼­Â)
```typescript
interface ToolStyle {
  strokeColor: string;   // <-- Different property name!
  strokeWidth: number;   // <-- Different property name!
  lineStyle: LineType;
  opacity: number;
}
```

#### EntityStyle (2 definitions - ~60 ³Á±¼¼­Â)

1. **rendering/entities/BaseEntityRenderer.ts:40-70** (30 ³Á±¼¼­Â)
```typescript
interface EntityRenderStyle {
  strokeStyle: string;
  fillStyle: string;
  lineWidth: number;
  lineDash: number[];
  globalAlpha: number;
}
```

2. **hooks/useEntityStyles.ts:8-35** (28 ³Á±¼¼­Â)
```typescript
interface EntityStyle {
  stroke: string;        // <-- Different property name!
  fill: string;          // <-- Different property name!
  width: number;         // <-- Different property name!
  dash: number[];        // <-- Different property name!
  opacity: number;       // <-- Different property name!
}
```

#### OverlayStyle (2 definitions - ~90 ³Á±¼¼­Â)

1. **overlays/types.ts:15-55** (41 ³Á±¼¼­Â)
```typescript
export interface OverlayStyle {
  strokeColor: string;
  fillColor: string;
  lineWidth: number;
  lineDash: number[];
  opacity: number;
  // ... + 8 more properties
}
```

2. **hooks/overlay/useOverlayDrawing.ts:12-50** (39 ³Á±¼¼­Â)
```typescript
interface OverlayDrawStyle {
  color: string;          // <-- Different property name!
  fillColor: string;
  width: number;          // <-- Different property name!
  dashPattern: number[];  // <-- Different property name!
  alpha: number;          // <-- Different property name!
}
```

### <¯ ›¥£—: Centralization Phase 1

**š‘Ÿ‘£:** `settings-core/types.ts` µ¯½±¹ **SINGLE SOURCE OF TRUTH**

**‘¤™š‘¤‘£¤‘£—:**
```typescript
// L ”™‘“¡‘¨• ±ÀÌ hooks/useGripPreviewStyle.ts:
interface GripStyle { ... }

//   ¡Ÿ£˜•£•:
import type { GripSettings } from '../settings-core/types';
// Use GripSettings directly
```

**Files to UPDATE (8 files):**
1. hooks/useGripPreviewStyle.ts - Remove GripStyle, use GripSettings
2. rendering/entities/shared/geometry-rendering-utils.ts - Remove GripStyle, use GripSettings
3. hooks/useTextPreviewStyle.ts - Remove TextStyle, use TextSettings
4. rendering/entities/BaseEntityRenderer.ts - Remove TextStyle, use TextSettings
5. hooks/useLinePreviewStyle.ts - Remove ToolStyle, use LineSettings
6. hooks/useEntityStyles.ts - Unify with settings-core types
7. hooks/overlay/useOverlayDrawing.ts - Use OverlayStyle from overlays/types.ts

**SAVINGS:** -400 ³Á±¼¼­Â

---

## 2ã HARDCODED COLOR DUPLICATION - œ•¤¡™Ÿ  ¡Ÿ’›—œ‘ (6/10)

### =á  ÁÌ²»·¼±: 50+ Hardcoded Hex Colors

**Canonical Source** (˜‘  ¡• •™ ½± ÇÁ·Ã¹¼¿À¿¹µ¯Ä±¹):
- `config/color-config.ts` - **CAD_UI_COLORS** object

**Duplicate Locations:**

#### Grip Colors (12 locations - ~40 ³Á±¼¼­Â)

```typescript
// L HARDCODED Ãµ 12 ±ÁÇµ¯±:
const gripColor = '#00FF00';           // Green
const highlightColor = '#FFD700';      // Gold
const selectedColor = '#FF4500';       // OrangeRed

//  ˜‘  ¡• •™ ½± ÇÁ·Ã¹¼¿À¿¹µ¯:
import { CAD_UI_COLORS } from '../config/color-config';
const gripColor = CAD_UI_COLORS.grip;
const highlightColor = CAD_UI_COLORS.gripHighlight;
const selectedColor = CAD_UI_COLORS.gripSelected;
```

**Files with Hardcoded Grip Colors:**
- rendering/entities/BaseEntityRenderer.ts:76
- rendering/entities/shared/geometry-rendering-utils.ts:172
- hooks/grips/useGripDetection.ts:45
- hooks/grips/useGripDragging.ts:38
- hooks/useGripPreviewStyle.ts:12
- rendering/ui/SnapRenderer.ts:88
- ... + 6 more files

#### Preview/Measurement Colors (8 locations - ~30 ³Á±¼¼­Â)

```typescript
// L HARDCODED:
const previewColor = '#FFD700';        // Gold
const measurementColor = '#00FFFF';    // Cyan
const distanceTextColor = '#FFFFFF';   // White

//  ˜‘  ¡• •™:
const previewColor = CAD_UI_COLORS.preview;
const measurementColor = CAD_UI_COLORS.measurement;
const distanceTextColor = CAD_UI_COLORS.measurementText;
```

**Files:**
- rendering/entities/BaseEntityRenderer.ts:320
- hooks/useLinePreviewStyle.ts:15
- hooks/useTextPreviewStyle.ts:11
- overlays/preview/PreviewRenderer.ts:42
- ... + 4 more files

#### Grid/Ruler Colors (6 locations - ~25 ³Á±¼¼­Â)

```typescript
// L HARDCODED:
const gridColor = '#303030';           // Dark Gray
const rulerColor = '#404040';          // Gray
const majorLineColor = '#505050';      // Light Gray

//  ˜‘  ¡• •™:
const gridColor = CAD_UI_COLORS.grid;
const rulerColor = CAD_UI_COLORS.ruler;
const majorLineColor = CAD_UI_COLORS.rulerMajor;
```

**Files:**
- rendering/ui/GridRenderer.ts:78
- rendering/ui/RulerRenderer.ts:92
- systems/rulers-grid/RulersGridSystem.tsx:156
- ... + 3 more files

#### Status Colors (10+ locations - ~55 ³Á±¼¼­Â)

```typescript
// L HARDCODED:
const hoverColor = '#FFA500';          // Orange
const selectedColor = '#00BFFF';       // DeepSkyBlue
const errorColor = '#FF0000';          // Red

//  ˜‘  ¡• •™:
import { STATUS_COLORS_MAPPING } from '../config/color-mapping';
const hoverColor = STATUS_COLORS_MAPPING.hovered;
const selectedColor = STATUS_COLORS_MAPPING.selected;
const errorColor = STATUS_COLORS_MAPPING.error;
```

**Files:**
- rendering/entities/BaseEntityRenderer.ts:235
- hooks/useEntityStyles.ts:28
- rendering/ui/SnapRenderer.ts:122
- overlays/types.ts:38
- ... + 6 more files

### <¯ ›¥£—: Use Existing Color Configs

**‘¤™š‘¤‘£¤‘£— Ãµ Ì»± Ä± ±ÁÇµ¯±:**

```typescript
// L ”™‘“¡‘¨•:
const color = '#00FF00';

//   ¡Ÿ£˜•£•:
import { CAD_UI_COLORS } from '../config/color-config';
const color = CAD_UI_COLORS.grip;
```

**SAVINGS:** -150 ³Á±¼¼­Â (±½Ä¹º±Ä¬ÃÄ±Ã· hardcoded values ¼µ imports)

---

## 3ã LINE STYLE TYPE DUPLICATION - œ•¤¡™Ÿ  ¡Ÿ’›—œ‘ (6/10)

### =á  ÁÌ²»·¼±: 3 Line Style Enums

**Canonical Source:**
- `settings-core/types.ts:12-17` - **LineType enum**

```typescript
export enum LineType {
  SOLID = 'solid',
  DASHED = 'dashed',
  DOTTED = 'dotted',
  DASHDOT = 'dashdot',
  CUSTOM = 'custom'
}
```

**Duplicates:**

1. **rendering/ui/cursor/CursorRenderer.ts:15-19** (~5 ³Á±¼¼­Â)
```typescript
type CursorLineStyle = 'solid' | 'dashed' | 'dotted';
```

2. **rendering/ui/crosshair/CrosshairRenderer.ts:18-22** (~5 ³Á±¼¼­Â)
```typescript
type CrosshairLineStyle = 'solid' | 'dashed' | 'dotted';
```

### <¯ ›¥£—: Use Canonical LineType

**‘¤™š‘¤‘£¤‘£—:**

```typescript
// L ”™‘“¡‘¨• ±ÀÌ CursorRenderer.ts:
type CursorLineStyle = 'solid' | 'dashed' | 'dotted';

//   ¡Ÿ£˜•£•:
import { LineType } from '../../../settings-core/types';
// Use LineType directly
```

**Files to UPDATE:**
- rendering/ui/cursor/CursorRenderer.ts
- rendering/ui/crosshair/CrosshairRenderer.ts

**SAVINGS:** -10 ³Á±¼¼­Â

---

## 4ã PREVIEW STYLE HOOKS DUPLICATION - £Ÿ’‘¡Ÿ  ¡Ÿ’›—œ‘ (5/10)

### =4  ÁÌ²»·¼±: 6 Overlapping Preview Hooks

**Existing Hooks:**

1. **hooks/useLinePreviewStyle.ts** (95 ³Á±¼¼­Â)
   - Manages line preview styling
   - Hardcoded colors: '#FFD700', '#FFA500'
   - Duplicate logic: opacity, width, dash pattern

2. **hooks/useTextPreviewStyle.ts** (88 ³Á±¼¼­Â)
   - Manages text preview styling
   - Hardcoded colors: '#FFFFFF', '#000000'
   - Duplicate logic: font size, bold, italic

3. **hooks/useGripPreviewStyle.ts** (72 ³Á±¼¼­Â)
   - Manages grip preview styling
   - Hardcoded colors: '#00FF00', '#FFD700'
   - Duplicate logic: size, opacity, fill

4. **hooks/useEntityStyles.ts** (185 ³Á±¼¼­Â)
   - **MOST COMPREHENSIVE** - handles all entity styles
   - Includes: normal, hover, selected, preview states
   - Uses settings contexts

5. **hooks/overlay/useOverlayDrawing.ts** (120 ³Á±¼¼­Â)
   - Overlay-specific styling
   - Partial duplication of entity styling logic

6. **hooks/usePreviewMode.ts** (45 ³Á±¼¼­Â)
   - Preview mode state management
   - Minimal styling logic

### <¯ ›¥£—: Centralize Preview Styling

** ¡Ÿ¤‘£—:** ¤¿ `hooks/useEntityStyles.ts` µ¯½±¹ Ä¿ **MOST COMPREHENSIVE** hook.

**‘¤™š‘¤‘£¤‘£—:**

```typescript
// L ”™‘“¡‘¨• duplicate logic ±ÀÌ:
// - useLinePreviewStyle.ts (preview colors, opacity)
// - useTextPreviewStyle.ts (preview font styling)
// - useGripPreviewStyle.ts (preview grip colors)

//  • •š¤•™• Ä¿ useEntityStyles.ts ½± º±»ÍÈµ¹ Ì»µÂ Ä¹Â preview cases

//  ‘¡‘”•™“œ‘:
export function useEntityStyles(entity: Entity, options: {
  mode: 'normal' | 'hover' | 'selected' | 'preview';
  previewType?: 'line' | 'text' | 'grip';
}) {
  // Unified logic for all preview types
}
```

**SAVINGS:** -180 ³Á±¼¼­Â (consolidation of duplicate preview logic)

---

## 5ã COLOR CONFIG FILES - MINOR OVERLAP (7/10)

### =â  ÁÌ²»·¼±: 6 Color Config Files

**Existing Config Files:**

1. **config/color-config.ts** (320 ³Á±¼¼­Â)
   - CAD_UI_COLORS object
   - COMPREHENSIVE color palette

2. **config/color-mapping.ts** (180 ³Á±¼¼­Â)
   - STATUS_COLORS_MAPPING
   - Entity status colors

3. **config/cadUiConfig.ts** (95 ³Á±¼¼­Â)
   - UI_COLORS object
   - Partial overlap with CAD_UI_COLORS

4. **ui/components/color-picker/ColorPalette.ts** (75 ³Á±¼¼­Â)
   - Predefined color swatches
   - Some overlap with CAD_UI_COLORS

5. **rendering/ui/core/UIRenderContext.ts** (45 ³Á±¼¼­Â)
   - Default UI colors
   - Minimal overlap

6. **contexts/LineConstants.tsx** (30 ³Á±¼¼­Â)
   - Line-specific color constants
   - Minor overlap

### <¯ ›¥£—: Minor Consolidation

**••¡“•™•£:**

1. **Merge UI_COLORS into CAD_UI_COLORS** (config/cadUiConfig.ts ’ color-config.ts)
   - SAVINGS: -25 ³Á±¼¼­Â

2. **Reference CAD_UI_COLORS in ColorPalette** (use color-config.ts colors)
   - SAVINGS: -15 ³Á±¼¼­Â

3. **Keep Separate:**
   - color-config.ts (main palette)
   - color-mapping.ts (status mappings)
   - UIRenderContext.ts (runtime defaults)

**SAVINGS:** -40 ³Á±¼¼­Â

---

## <¨ £¥Ÿ›™š— £¥Ÿ¨—

| š±Ä·³¿Á¯± | ”¹À»ÌÄÅÀµÂ “Á±¼¼­Â | ‘ÁÇµ¯± | •¾¿¹º¿½Ì¼·Ã· |  Á¿ÄµÁ±¹ÌÄ·Ä± |
|-----------|-------------------|---------|--------------|---------------|
| Style Interfaces | ~400 | 8 | -400 | =4 HIGH |
| Hardcoded Colors | ~150 | 50+ | -150 | =á MEDIUM |
| Preview Hooks | ~300 | 6 | -180 | =4 HIGH |
| Line Style Types | ~10 | 2 | -10 | =â LOW |
| Color Configs | ~40 | 3 | -40 | =â LOW |

**£¥Ÿ›Ÿ:** ~900 ³Á±¼¼­Â duplicates, **-780 ³Á±¼¼­Â savings** ¼µÄ¬ ±ÀÌ centralization

---

## =€ CENTRALIZATION ROADMAP - 3 ¦‘£•™£

### =4 ¦‘£— 1: Style Interface Unification (HIGH PRIORITY)

**§ÁÌ½¿Â:** 2-3 ÎÁµÂ

**•½­Á³µ¹µÂ:**

1. **Establish settings-core/types.ts as CANONICAL**
   - Confirm all style interfaces are complete
   - Add missing properties if needed

2. **Replace Duplicate Interfaces (8 files):**

```typescript
// File: hooks/useGripPreviewStyle.ts
// L DELETE lines 8-22 (GripStyle interface)
//  ADD:
import type { GripSettings } from '../settings-core/types';
// Replace all GripStyle with GripSettings

// File: hooks/useTextPreviewStyle.ts
// L DELETE lines 7-18 (TextStyle interface)
//  ADD:
import type { TextSettings } from '../settings-core/types';
// Replace all TextStyle with TextSettings

// File: hooks/useLinePreviewStyle.ts
// L DELETE lines 6-18 (ToolStyle interface)
//  ADD:
import type { LineSettings } from '../settings-core/types';
// Replace all ToolStyle with LineSettings

// ... Repeat for remaining 5 files
```

3. **TypeScript Compilation Check:**
```bash
npx tsc --noEmit --skipLibCheck
```

**SAVINGS:** -400 ³Á±¼¼­Â

---

### =á ¦‘£— 2: Hardcoded Color Replacement (MEDIUM PRIORITY)

**§ÁÌ½¿Â:** 1-2 ÎÁµÂ

**•½­Á³µ¹µÂ:**

1. **Grip Colors (12 files):**

```typescript
// L BEFORE:
const gripColor = '#00FF00';
const highlightColor = '#FFD700';

//  AFTER:
import { CAD_UI_COLORS } from '../config/color-config';
const gripColor = CAD_UI_COLORS.grip;
const highlightColor = CAD_UI_COLORS.gripHighlight;
```

**Files to UPDATE:**
- rendering/entities/BaseEntityRenderer.ts:76
- rendering/entities/shared/geometry-rendering-utils.ts:172
- hooks/grips/useGripDetection.ts:45
- hooks/grips/useGripDragging.ts:38
- hooks/useGripPreviewStyle.ts:12
- rendering/ui/SnapRenderer.ts:88
- ... + 6 more

2. **Preview/Measurement Colors (8 files):**

```typescript
// L BEFORE:
const previewColor = '#FFD700';

//  AFTER:
const previewColor = CAD_UI_COLORS.preview;
```

3. **Grid/Ruler Colors (6 files):**

```typescript
// L BEFORE:
const gridColor = '#303030';

//  AFTER:
const gridColor = CAD_UI_COLORS.grid;
```

4. **Status Colors (10+ files):**

```typescript
// L BEFORE:
const hoverColor = '#FFA500';

//  AFTER:
import { STATUS_COLORS_MAPPING } from '../config/color-mapping';
const hoverColor = STATUS_COLORS_MAPPING.hovered;
```

**SAVINGS:** -150 ³Á±¼¼­Â

---

### =4 ¦‘£— 3: Preview Hooks Consolidation (HIGH PRIORITY)

**§ÁÌ½¿Â:** 2-3 ÎÁµÂ

**•½­Á³µ¹µÂ:**

1. **Extend useEntityStyles.ts** to be **UNIVERSAL STYLE HOOK:**

```typescript
// File: hooks/useEntityStyles.ts
//  EXTEND to support all preview types:

export interface UseEntityStylesOptions {
  mode: 'normal' | 'hover' | 'selected' | 'preview';
  previewType?: 'line' | 'text' | 'grip' | 'entity' | 'overlay';
  // ... additional options
}

export function useEntityStyles(
  entity: Entity,
  options: UseEntityStylesOptions
): EntityStyle {
  // Unified logic for ALL entity styling
  // - Normal rendering
  // - Hover state
  // - Selected state
  // - Preview mode (line/text/grip/overlay)

  // Uses settings-core/types.ts interfaces
  // Uses CAD_UI_COLORS from color-config.ts
  // No hardcoded colors
}
```

2. **Deprecate Specialized Hooks:**

```typescript
// L DEPRECATE (but don't delete yet):
// - hooks/useLinePreviewStyle.ts
// - hooks/useTextPreviewStyle.ts
// - hooks/useGripPreviewStyle.ts

// Add deprecation warning:
/** @deprecated Use useEntityStyles with previewType: 'line' instead */
export function useLinePreviewStyle() {
  console.warn('useLinePreviewStyle is deprecated. Use useEntityStyles instead.');
  // Delegate to useEntityStyles
}
```

3. **Update Callers (20+ files):**

```typescript
// L BEFORE:
import { useLinePreviewStyle } from './hooks/useLinePreviewStyle';
const style = useLinePreviewStyle(line);

//  AFTER:
import { useEntityStyles } from './hooks/useEntityStyles';
const style = useEntityStyles(line, { mode: 'preview', previewType: 'line' });
```

4. **Delete Deprecated Hooks** (after all callers updated):
- hooks/useLinePreviewStyle.ts
- hooks/useTextPreviewStyle.ts
- hooks/useGripPreviewStyle.ts

**SAVINGS:** -180 ³Á±¼¼­Â

---

## =Ê ‘ž™Ÿ›Ÿ“—£—  Ÿ™Ÿ¤—¤‘£

**£Å½¿»¹º® ’±¸¼¿»¿³¯±: 5.8/10**  

### ‘½±»ÅÄ¹º® ’±¸¼¿»¿³¯±:

#### =4 5/10 - Style Interfaces (NEEDS WORK!)
- L 8 overlapping definitions (~400 lines)
- L Inconsistent property names (color vs fillColor, strokeColor)
-  Canonical source exists (settings-core/types.ts)
- L Not used consistently

#### =á 6/10 - Hardcoded Colors (MEDIUM!)
- L 50+ instances of hardcoded hex values
-  CAD_UI_COLORS exists in color-config.ts
-  STATUS_COLORS_MAPPING exists in color-mapping.ts
- L Not used consistently across codebase

#### =á 6/10 - Line Style Types (MEDIUM!)
- L 3 duplicate line style definitions
-  Canonical LineType enum exists
- L Duplicate type aliases in UI renderers

#### =4 5/10 - Preview Hooks (NEEDS WORK!)
- L 6 overlapping hooks (~300 lines duplicate logic)
-  useEntityStyles is most comprehensive
- L No unified preview styling system

#### =â 7/10 - Color Configs (GOOD!)
-  CAD_UI_COLORS is comprehensive
-  STATUS_COLORS_MAPPING is well-organized
-   Minor overlap in UI_COLORS (40 lines)

---

## <¯ £¥Ÿ›™š—  ¡Ÿ¤•¡‘™Ÿ¤—¤‘

| ¦¬Ã· | •½­Á³µ¹± | ‘ÁÇµ¯± | Savings | §ÁÌ½¿Â |  Á¿ÄµÁ±¹ÌÄ·Ä± |
|------|----------|---------|---------|--------|---------------|
| 1 | Style Interface Unification | 8 | -400 | 2-3h | =4 HIGH |
| 2 | Hardcoded Color Replacement | 50+ | -150 | 1-2h | =á MEDIUM |
| 3 | Preview Hooks Consolidation | 6 | -180 | 2-3h | =4 HIGH |
| 4 | Line Style Type Cleanup | 2 | -10 | 15m | =â LOW |
| 5 | Color Config Merge | 3 | -40 | 30m | =â LOW |

**£¥Ÿ›™š•£ •žŸ™šŸŸœ—£•™£:** -780 ³Á±¼¼­Â (-69% ÄÉ½ duplicates)

**£¥Ÿ›™šŸ£ §¡ŸŸ£:** 6-9 ÎÁµÂ

---

## <Á ¤•›™š— £¥£¤‘£—

**“¹ÎÁ³¿, ²Á®º± £Ÿ’‘¡Ÿ ÀÁÌ²»·¼± ¼µ Style Interfaces º±¹ Preview Hooks!**

###  ˜µÄ¹º¬:
- **CAD_UI_COLORS:** Comprehensive color palette ÅÀ¬ÁÇµ¹!
- **settings-core/types.ts:** Canonical style interfaces ÅÀ¬ÁÇ¿Å½!
- **useEntityStyles:** Comprehensive styling hook ÅÀ¬ÁÇµ¹!

### L ‘Á½·Ä¹º¬:
- **Style Interface Chaos:** 8 overlapping definitions (~400 lines)
- **Hardcoded Color Sprawl:** 50+ hex values ±½Ä¯ ³¹± CAD_UI_COLORS
- **Preview Hook Duplication:** 6 hooks ¼µ overlapping logic (~300 lines)

### =€ †¼µÃ· ”Á¬Ã·:

**¦‘£— 1 + ¦‘£— 3 (HIGH PRIORITY):**

1.  Unify all style interfaces ’ use settings-core/types.ts
2.  Consolidate preview hooks ’ extend useEntityStyles.ts
3.  Replace hardcoded colors ’ use CAD_UI_COLORS

**‘À¿Ä­»µÃ¼±:**
-  Eliminating 580 lines of duplicate code (-65%)
-  Single source of truth ³¹± Ì»± Ä± styles
-  Consistent color palette Ãµ Ì»· Ä·½ µÆ±Á¼¿³®
-  Score: 5.8/10 ’ 8.5/10

** Á¿Äµ¯½É ½± ¾µº¹½®Ã¿Å¼µ ¼µ ¦‘£— 1 (Style Interfaces) - µ¯½±¹ Ä¿ À¹¿ š¡™£™œŸ!** =4

---

**¤•›Ÿ£ ‘‘¦Ÿ¡‘£**
