# = ‘‘¦Ÿ¡‘ ”™ ›Ÿ¤¥ ©: VALIDATION LOGIC

**—¼µÁ¿¼·½¯±**: 2025-10-03
**Scope**: `src/subapps/dxf-viewer/` - Full codebase analysis
**š±Ä·³¿Á¯±**: Validation Logic (Entity validation, Input validation, Settings validation)
**£ÄÌÇ¿Â**: •½Ä¿À¹Ã¼ÌÂ º±¹ Äµº¼·Á¯ÉÃ· Ì»É½ ÄÉ½ ´¹À»ÌÄÅÀÉ½ ÃÄ· »¿³¹º® µÀ¹ºÍÁÉÃ·Â

---

## =Ê EXECUTIVE SUMMARY

### ‘À¿Äµ»­Ã¼±Ä± ˆÁµÅ½±Â:
- **109 ±ÁÇµ¯±** ¼µ validation patterns
- **50+ validation functions** µ½Ä¿À¯ÃÄ·º±½
- **5 ºÍÁ¹µÂ º±Ä·³¿Á¯µÂ ´¹À»¿ÄÍÀÉ½** Ä±ÅÄ¿À¿¹®¸·º±½
- **7 ºÁ¯Ã¹¼± ´¹À»ÌÄÅÀ±** À¿Å ÇÁµ¹¬¶¿½Ä±¹ ¬¼µÃ· µÀ¯»ÅÃ·
- **~200 ³Á±¼¼­Â ºÎ´¹º±** ´Å½·Ä¹º® ¼µ¯ÉÃ· ¼µÄ¬ Ä·½ ºµ½ÄÁ¹º¿À¿¯·Ã·

###  Á¿ÄµÁ±¹ÌÄ·ÄµÂ:
|  Á¿ÄµÁ±¹ÌÄ·Ä± | ‘Á¹¸¼ÌÂ ”¹À»¿ÄÍÀÉ½ | •À¯ÀÄÉÃ· |
|--------------|-------------------|----------|
| =4 CRITICAL | 2 | Inconsistent entity validation, type confusion |
| =à HIGH | 2 | Inconsistent grip settings, numeric validation gaps |
| =á MEDIUM | 3 | Repeated patterns, code duplication |
| =â LOW | 10+ | Domain-specific, acceptable localization |

---

## =4 CATEGORY 1: ENTITY VALIDATION DUPLICATES (CRITICAL)

### 1.1 Duplicate Files: `entity-validation-utils.ts`

** ÁÌ²»·¼±**: ¥À¬ÁÇ¿Å½ ”¥Ÿ ¾µÇÉÁ¹ÃÄ¬ ±ÁÇµ¯± ¼µ Ä¿ ¯´¹¿ Ì½¿¼± Ãµ ´¹±Æ¿ÁµÄ¹º¬ paths!

#### File #1: `rendering/entities/shared/entity-validation-utils.ts`
**“Á±¼¼­Â**: 122
**›µ¹Ä¿ÅÁ³¯µÂ**: 7 functions
**Status**:   ¹¿ À»®Á·Â Å»¿À¿¯·Ã·

```typescript
// Exported functions:
- validateLineEntity(entity: EntityModel)
- validateCircleEntity(entity: EntityModel)
- validateEllipseEntity(entity: EntityModel)
- validateRectangleEntity(entity: EntityModel)
- validateArcEntity(entity: EntityModel)
- validateEntityType(entity: EntityModel, expectedType: string | string[])
- isValidPoint(point: unknown): point is Point2D
```

**Signature Example - Ellipse**:
```typescript
export function validateEllipseEntity(entity: EntityModel): {
  center: Point2D;
  majorAxis: number;    //  Direct major/minor axis values
  minorAxis: number;
  rotation: number;
} | null
```

#### File #2: `utils/entity-validation-utils.ts`
**“Á±¼¼­Â**: 75
**›µ¹Ä¿ÅÁ³¯µÂ**: 2 functions
**Status**:   œµÁ¹º® Å»¿À¿¯·Ã·, ´¹±Æ¿ÁµÄ¹º¬ interfaces

```typescript
// Exported functions:
- validateArcEntity(entity: BaseEntity)
- validateEllipseEntity(entity: BaseEntity)

// Custom interfaces:
interface ValidatedArc {
  center: Point2D;
  radius: number;
  startAngle: number;
  endAngle: number;
}

interface ValidatedEllipse {
  center: Point2D;
  majorAxisEndpoint: Point2D;  // L Different format!
  minorAxisRatio: number;       // L Different format!
  startParameter?: number;
  endParameter?: number;
}
```

**Signature Example - Ellipse**:
```typescript
export function validateEllipseEntity(entity: BaseEntity): ValidatedEllipse | null {
  // Uses majorAxisEndpoint + minorAxisRatio instead of majorAxis/minorAxis
}
```

### =% š¡™£™œŸ  ¡Ÿ’›—œ‘:

**”¹±Æ¿ÁµÄ¹º¬ Type Signatures ³¹± ¯´¹µÂ ¿½ÄÌÄ·ÄµÂ!**

| Aspect | File #1 (rendering/entities/shared) | File #2 (utils) |
|--------|-------------------------------------|-----------------|
| **Input Type** | `EntityModel` | `BaseEntity` |
| **Ellipse Format** | `majorAxis: number, minorAxis: number` | `majorAxisEndpoint: Point2D, minorAxisRatio: number` |
| **Return Type** | Inline object | Custom interface |
| **Functions** | 7 (complete) | 2 (partial) |
| **Usage** | Unknown | Unknown (needs investigation) |

**•À¯ÀÄÉÃ·**:
- Type confusion ³¹± developers
-  ¹¸±½¬ runtime errors ±½ ÇÁ·Ã¹¼¿À¿¹·¸µ¯ »¬¸¿Â validator
- Inconsistent API ³¹± entity validation
- Duplication maintenance burden

### =Ë £ÍÃÄ±Ã·:

** Á¿ÄµÁ±¹ÌÄ·Ä±**: =4 CRITICAL

** Á¿Äµ¹½Ì¼µ½· ›ÍÃ·**:
1. **Consolidate** Ãµ ­½± ±ÁÇµ¯¿: `rendering/entities/shared/entity-validation-utils.ts` (Ä¿ À¹¿ À»®ÁµÂ)
2. **Merge** Ä± custom interfaces ±ÀÌ File #2 (ValidatedArc, ValidatedEllipse) ÉÂ **alternate formats**
3. **Support** º±¹ Ä± ´Í¿ ellipse formats ¼µ overloaded functions ® options parameter
4. **Delete** Ä¿ `utils/entity-validation-utils.ts`
5. **Update** Ì»± Ä± imports ½± ´µ¯Ç½¿Å½ ÃÄ¿ ºµ½ÄÁ¹ºÌ ±ÁÇµ¯¿

**Migration Steps**:
```typescript
// Step 1: Extend central file with alternate formats
export interface EllipseValidationOptions {
  format: 'axes' | 'endpoint-ratio';  // Support both formats
}

export function validateEllipseEntity(
  entity: EntityModel | BaseEntity,
  options?: EllipseValidationOptions
): ValidatedEllipse | { center, majorAxis, minorAxis, rotation } | null {
  // Implement both formats based on options
}

// Step 2: Search for imports of utils/entity-validation-utils.ts
// grep -r "from '.*utils/entity-validation-utils'" src/subapps/dxf-viewer/

// Step 3: Update imports to rendering/entities/shared/entity-validation-utils.ts

// Step 4: Test affected files

// Step 5: Delete utils/entity-validation-utils.ts
```

**Expected Result**:
-  Single source of truth ³¹± entity validation
-  Type consistency
-  Support ³¹± legacy code ¼µ format options
-  -75 ³Á±¼¼­Â duplicate code
-  Zero breaking changes (¼µ ÃÉÃÄ® migration)

---

## =à CATEGORY 2: SETTINGS VALIDATION DUPLICATES (HIGH)

### 2.1 Duplicate Function: `validateGripSettings()`

** ÁÌ²»·¼±**: — ¯´¹± function ÅÀ¬ÁÇµ¹ Ãµ 2 ´¹±Æ¿ÁµÄ¹º¬ ±ÁÇµ¯± ¼µ **´¹±Æ¿ÁµÄ¹º® validation logic**!

#### Implementation #1: `settings-core/types.ts` (lines 194-220)
```typescript
export const validateGripSettings = (settings: Partial<GripSettings>): GripSettings => {
  const defaults: GripSettings = {
    enabled: true,
    gripSize: 5,
    pickBoxSize: 3,
    apertureSize: 10,
    opacity: 1.0,  // L Default 1.0
    colors: {
      cold: '#0000FF',
      warm: '#FF69B4',
      hot: '#FF0000',
      contour: '#000000'
    },
    maxGripsPerEntity: 10,
    showGripMenu: true,
    enableMultiGripStretch: true,
  };

  // Helper ³¹± clamping
  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

  return {
    ...defaults,
    ...settings,
    gripSize: clamp(settings.gripSize ?? defaults.gripSize, 1, 255),
    pickBoxSize: clamp(settings.pickBoxSize ?? defaults.pickBoxSize, 0, 50),
    apertureSize: clamp(settings.apertureSize ?? defaults.apertureSize, 1, 50),
    opacity: clamp(settings.opacity ?? defaults.opacity, 0, 1),  // L Range: 0-1
    maxGripsPerEntity: clamp(
      settings.maxGripsPerEntity ?? defaults.maxGripsPerEntity,
      1,
      200
    ),
    // Does NOT validate maxGripsPerEntity separately
  };
};
```

#### Implementation #2: `types/gripSettings.ts` (lines 92-108)
```typescript
const GRIP_LIMITS = {
  gripSize: { min: 1, max: 255 },
  pickBoxSize: { min: 0, max: 50 },
  apertureSize: { min: 1, max: 50 }
} as const;

export function validateGripSettings(settings: Partial<GripSettings>): GripSettings {
  const result = { ...DEFAULT_GRIP_SETTINGS, ...settings };

  // Validate gripSize
  result.gripSize = Math.max(
    GRIP_LIMITS.gripSize.min,
    Math.min(GRIP_LIMITS.gripSize.max, result.gripSize)
  );

  // Validate pickBoxSize
  result.pickBoxSize = Math.max(
    GRIP_LIMITS.pickBoxSize.min,
    Math.min(GRIP_LIMITS.pickBoxSize.max, result.pickBoxSize)
  );

  // Validate apertureSize
  result.apertureSize = Math.max(
    GRIP_LIMITS.apertureSize.min,
    Math.min(GRIP_LIMITS.apertureSize.max, result.apertureSize)
  );

  //  Validates opacity with DIFFERENT range
  result.opacity = Math.max(0.1, Math.min(1.0, result.opacity));  //  Range: 0.1-1

  //  Validates maxGripsPerEntity
  result.maxGripsPerEntity = Math.max(10, Math.min(200, result.maxGripsPerEntity));

  return result;
}
```

### =% š¡™£™œ•£ ”™‘¦Ÿ¡•£:

| Aspect | Implementation #1 (settings-core/types.ts) | Implementation #2 (types/gripSettings.ts) |
|--------|-------------------------------------------|------------------------------------------|
| **Opacity Range** | 0 - 1 (allows fully transparent) | 0.1 - 1 (minimum 10% opacity) |
| **Constants** | Inline hardcoded values | Uses `GRIP_LIMITS` constants |
| **maxGripsPerEntity** | Validated inline with other fields | Separate explicit validation |
| **Code Style** | Helper `clamp()` function | Direct `Math.max/min` |
| **AutoCAD Compliance** | Unknown |  Uses GRIP_LIMITS matching AutoCAD |

**•À¯ÀÄÉÃ·**:
- **Inconsistent behavior** ±½¬»¿³± ¼µ Ä¿ À¿¹¿ ±ÁÇµ¯¿ ÇÁ·Ã¹¼¿À¿¹µ¯Ä±¹
- **Different opacity ranges** ’ Grips ¼À¿Áµ¯ ½± µ¯½±¹ invisible (0) ® ÌÇ¹ (0.1)
- **Confusion** ³¹± developers: " ¿¹¿ µ¯½±¹ Ä¿ ÃÉÃÄÌ ÌÁ¹¿?"
- **Maintenance burden**: ‘»»±³­Â ÀÁ­Àµ¹ ½± ³¯½¿Å½ Ãµ 2 ¼­Á·

### =Ë £ÍÃÄ±Ã·:

** Á¿ÄµÁ±¹ÌÄ·Ä±**: =à HIGH

** Á¿Äµ¹½Ì¼µ½· ›ÍÃ·**:
1. **Keep** Ä¿ `types/gripSettings.ts` implementation (À¹¿ À»®ÁµÂ, ÇÁ·Ã¹¼¿À¿¹µ¯ constants)
2. **Delete** Ä¿ `validateGripSettings` ±ÀÌ `settings-core/types.ts`
3. **Update** Ì»± Ä± imports ½± ´µ¯Ç½¿Å½ ÃÄ¿ `types/gripSettings.ts`
4. **Document** Ä¿ ÃÉÃÄÌ opacity range (0.1-1) ÃÄ± docs
5. **Export** Ä¿ `GRIP_LIMITS` ³¹± ÇÁ®Ã· ±ÀÌ ¬»»± modules

**Migration Steps**:
```bash
# Step 1: Find all usages of validateGripSettings
grep -rn "validateGripSettings" src/subapps/dxf-viewer/

# Step 2: Identify which file each import uses
grep -rn "from '.*settings-core/types'" src/subapps/dxf-viewer/ | grep validateGripSettings
grep -rn "from '.*types/gripSettings'" src/subapps/dxf-viewer/ | grep validateGripSettings

# Step 3: Update imports to types/gripSettings.ts
# Replace:
# import { validateGripSettings } from '../settings-core/types';
# With:
# import { validateGripSettings } from '../types/gripSettings';

# Step 4: Remove validateGripSettings from settings-core/types.ts (lines 194-220)

# Step 5: Test grip settings functionality
```

**Expected Result**:
-  Single source of truth ³¹± grip validation
-  Consistent opacity range (0.1-1) everywhere
-  AutoCAD-compliant validation ¼µ GRIP_LIMITS
-  -26 ³Á±¼¼­Â duplicate code
-  Clearer API ¼µ exported constants

---

## =á CATEGORY 3: TRANSFORM VALIDATION PATTERNS (MEDIUM)

### 3.1 Repeated Pattern: `validateTransform` / `validateCoordinates` / `validateOverlayState`

** ÁÌ²»·¼±**: ¤¿ ¯´¹¿ pattern (merge defaults + type check + clamp) µÀ±½±»±¼²¬½µÄ±¹ Ãµ À¿»»±À»¬ hooks

#### Pattern Instance #1: `hooks/state/useCanvasTransformState.ts` (line 42)
```typescript
function validateTransform(transform: Partial<CanvasTransform>): CanvasTransform {
  const validated: CanvasTransform = { ...DEFAULT_TRANSFORM };

  if (typeof transform.scale === 'number' && isFinite(transform.scale)) {
    validated.scale = Math.max(0.01, Math.min(100, transform.scale));
  }

  if (typeof transform.offsetX === 'number' && isFinite(transform.offsetX)) {
    validated.offsetX = transform.offsetX;
  }

  if (typeof transform.offsetY === 'number' && isFinite(transform.offsetY)) {
    validated.offsetY = transform.offsetY;
  }

  return validated;
}
```

#### Pattern Instance #2: `hooks/state/useColorMenuState.ts` (line 35)
```typescript
function validateCoordinates(coords: Partial<ColorMenuCoordinates>): ColorMenuCoordinates {
  const validated: ColorMenuCoordinates = { ...DEFAULT_COORDINATES };

  if (typeof coords.x === 'number' && isFinite(coords.x)) {
    validated.x = coords.x;
  }

  if (typeof coords.y === 'number' && isFinite(coords.y)) {
    validated.y = coords.y;
  }

  return validated;
}
```

#### Pattern Instance #3: `hooks/state/useOverlayState.ts` (line 28)
```typescript
function validateOverlayState(state: Partial<OverlayState>): OverlayState {
  const validated: OverlayState = { ...DEFAULT_OVERLAY_STATE };

  if (typeof state.isDrawing === 'boolean') {
    validated.isDrawing = state.isDrawing;
  }

  if (state.currentTool && typeof state.currentTool === 'string') {
    validated.currentTool = state.currentTool;
  }

  if (state.temporaryPoints && Array.isArray(state.temporaryPoints)) {
    validated.temporaryPoints = state.temporaryPoints;
  }

  return validated;
}
```

### = Pattern Analysis:

**Common Pattern**:
1. Create validated object ±ÀÌ defaults
2. Type check ³¹± º¬¸µ property (`typeof`, `isFinite`, `Array.isArray`)
3. Conditionally assign validated values
4. Optional clamping ³¹± numeric values
5. Return validated object

**”¹±Æ¿Á­Â**:
- Property names (scale/offsetX/offsetY vs x/y vs isDrawing/currentTool)
- Type checks (number vs boolean vs string vs array)
- Clamping logic (scale: 0.01-100 vs coordinates: no clamp)

**•À¯ÀÄÉÃ·**:
- **Moderate duplication** (~15-20 ³Á±¼¼­Â ±½¬ function)
- **Pattern inconsistency**: ”¹±Æ¿ÁµÄ¹ºÌ style Ãµ º¬¸µ module
- **Maintenance**: ‘»»±³­Â ÃÄ¿ pattern ÀÁ­Àµ¹ ½± ³¯½¿Å½ Ãµ À¿»»¬ ¼­Á·

### =Ë £ÍÃÄ±Ã·:

** Á¿ÄµÁ±¹ÌÄ·Ä±**: =á MEDIUM

** Á¿Äµ¹½Ì¼µ½· ›ÍÃ·**:
Create a **generic validation utility** À¿Å support ±ÅÄÌ Ä¿ pattern:

```typescript
// New file: utils/validation-utils.ts

/**
 * Generic validator ³¹± objects ¼µ defaults º±¹ custom validators
 */
export function validateObject<T extends Record<string, unknown>>(
  partial: Partial<T>,
  defaults: T,
  validators?: {
    [K in keyof T]?: (value: T[K]) => T[K];
  }
): T {
  const validated = { ...defaults };

  for (const key in partial) {
    const value = partial[key];

    if (value !== undefined) {
      // Apply custom validator if exists
      if (validators?.[key]) {
        validated[key] = validators[key](value as T[typeof key]);
      } else {
        // Default: assign if same type as default
        if (typeof value === typeof defaults[key]) {
          validated[key] = value as T[typeof key];
        }
      }
    }
  }

  return validated;
}

/**
 * Numeric validator ¼µ optional clamping
 */
export function validateNumeric(
  value: unknown,
  defaultValue: number,
  options?: { min?: number; max?: number }
): number {
  if (typeof value !== 'number' || !isFinite(value)) {
    return defaultValue;
  }

  let validated = value;

  if (options?.min !== undefined) {
    validated = Math.max(options.min, validated);
  }

  if (options?.max !== undefined) {
    validated = Math.min(options.max, validated);
  }

  return validated;
}

/**
 * Boolean validator
 */
export function validateBoolean(value: unknown, defaultValue: boolean): boolean {
  return typeof value === 'boolean' ? value : defaultValue;
}

/**
 * String validator ¼µ optional allowed values
 */
export function validateString(
  value: unknown,
  defaultValue: string,
  options?: { allowedValues?: string[] }
): string {
  if (typeof value !== 'string') {
    return defaultValue;
  }

  if (options?.allowedValues && !options.allowedValues.includes(value)) {
    return defaultValue;
  }

  return value;
}

/**
 * Array validator
 */
export function validateArray<T>(
  value: unknown,
  defaultValue: T[],
  itemValidator?: (item: unknown) => item is T
): T[] {
  if (!Array.isArray(value)) {
    return defaultValue;
  }

  if (itemValidator) {
    return value.filter(itemValidator);
  }

  return value as T[];
}
```

**Refactored Usage**:
```typescript
// hooks/state/useCanvasTransformState.ts
import { validateObject, validateNumeric } from '../../utils/validation-utils';

function validateTransform(transform: Partial<CanvasTransform>): CanvasTransform {
  return validateObject(transform, DEFAULT_TRANSFORM, {
    scale: (value) => validateNumeric(value, DEFAULT_TRANSFORM.scale, { min: 0.01, max: 100 }),
    offsetX: (value) => validateNumeric(value, DEFAULT_TRANSFORM.offsetX),
    offsetY: (value) => validateNumeric(value, DEFAULT_TRANSFORM.offsetY),
  });
}

// hooks/state/useColorMenuState.ts
import { validateObject, validateNumeric } from '../../utils/validation-utils';

function validateCoordinates(coords: Partial<ColorMenuCoordinates>): ColorMenuCoordinates {
  return validateObject(coords, DEFAULT_COORDINATES, {
    x: (value) => validateNumeric(value, DEFAULT_COORDINATES.x),
    y: (value) => validateNumeric(value, DEFAULT_COORDINATES.y),
  });
}

// hooks/state/useOverlayState.ts
import { validateObject, validateBoolean, validateString, validateArray } from '../../utils/validation-utils';

function validateOverlayState(state: Partial<OverlayState>): OverlayState {
  return validateObject(state, DEFAULT_OVERLAY_STATE, {
    isDrawing: (value) => validateBoolean(value, DEFAULT_OVERLAY_STATE.isDrawing),
    currentTool: (value) => validateString(value, DEFAULT_OVERLAY_STATE.currentTool),
    temporaryPoints: (value) => validateArray(value, DEFAULT_OVERLAY_STATE.temporaryPoints),
  });
}
```

**Expected Result**:
-  Centralized validation pattern
-  Consistent API across modules
-  Reusable validators
-  ~40-50 ³Á±¼¼­Â reduction
-  Easier to maintain º±¹ extend

---

## =à CATEGORY 4: INPUT VALIDATION DUPLICATES (HIGH)

### 4.1 Duplicate Functions: `validateNumericInput` vs `isValidNumber`

** ÁÌ²»·¼±**: ”Í¿ ´¹±Æ¿ÁµÄ¹º­Â implementations ³¹± numeric input validation ¼µ ´¹±Æ¿ÁµÄ¹º¬ features

#### Implementation #1: `ui/toolbar/shared/input-validation.ts`
**Features**:  Regex validation,  Range validation,  Normalization (comma’period)

```typescript
export interface ValidationOptions {
  minValue?: number;
  maxValue?: number;
  defaultValue?: number;
}

export function normalizeNumericInput(
  value: string,
  options: ValidationOptions = {}
): number {
  const { minValue = 1, maxValue = 99999, defaultValue = 100 } = options;

  // Clean input
  const cleaned = value.trim();
  if (!cleaned) return defaultValue;

  // Normalize comma to period (European format)
  const normalized = cleaned.replace(',', '.');

  // Parse and validate
  const parsed = parseFloat(normalized);

  if (isNaN(parsed)) return defaultValue;

  // Clamp to range
  return Math.max(minValue, Math.min(maxValue, parsed));
}

export function validateNumericInput(
  value: string,
  options: ValidationOptions = {}
): boolean {
  const { minValue = 1, maxValue = 99999 } = options;

  // Clean input
  const cleaned = value.trim();
  if (!cleaned) return false;

  // Regex: Only digits, comma, period
  const pattern = /^[\d.,]+$/;
  if (!pattern.test(cleaned)) return false;

  // Normalize and check range
  const normalized = normalizeNumericInput(cleaned, options);
  return normalized >= minValue && normalized <= maxValue;
}
```

**Used by**: `ZoomControls.tsx`, `ScaleControls.tsx`

#### Implementation #2: `systems/dynamic-input/utils/number.ts`
**Features**:  Simple parseFloat,  Finite check, L No regex, L No range validation, L No normalization

```typescript
export const isValidNumber = (value: string): boolean => {
  // Empty check
  if (!value || value.trim() === '') return false;

  const trimmed = value.trim();
  const num = parseFloat(trimmed);

  // Check if parsed successfully and is finite
  return !isNaN(num) && isFinite(num);
};
```

**Used by**: `DynamicInput.tsx` (coordinate input)

### = Feature Comparison:

| Feature | validateNumericInput (#1) | isValidNumber (#2) |
|---------|--------------------------|-------------------|
| **Trim whitespace** |  Yes |  Yes |
| **Empty string check** |  Yes (returns false) |  Yes (returns false) |
| **Regex validation** |  Yes (`/^[\d.,]+$/`) | L No |
| **Comma’Period** |  Yes (European format) | L No |
| **Range validation** |  Yes (min/max) | L No |
| **Finite check** |  Implicit (via parseFloat) |  Explicit (isFinite) |
| **Default value** |  Yes (via normalizeNumericInput) | L No |
| **Return type** | `boolean` | `boolean` |

**•À¯ÀÄÉÃ·**:
- **Inconsistent validation** ±½¬»¿³± ¼µ Ä¿ module
- **Missing features**: Dynamic input ´µ½ support comma input (European users!)
- **Code duplication**: Similar logic Ãµ 2 ¼­Á·
- **Maintenance burden**: Bug fixes ÀÁ­Àµ¹ ½± ³¯½¿Å½ Ãµ 2 ¼­Á·

### =Ë £ÍÃÄ±Ã·:

** Á¿ÄµÁ±¹ÌÄ·Ä±**: =à HIGH

** Á¿Äµ¹½Ì¼µ½· ›ÍÃ·**:
1. **Create** unified input validation module: `utils/input-validation.ts`
2. **Combine** features ±ÀÌ º±¹ Ä± ´Í¿ implementations
3. **Export** º±¹ validation function º±¹ normalization function
4. **Update** Ì»± Ä± imports

**Unified Implementation**:
```typescript
// utils/input-validation.ts

export interface NumericValidationOptions {
  minValue?: number;
  maxValue?: number;
  defaultValue?: number;
  allowComma?: boolean;  // European format support
  pattern?: RegExp;      // Custom pattern
}

/**
 * Normalize numeric input string to number
 * Supports comma/period, whitespace trimming, clamping
 */
export function normalizeNumericInput(
  value: string,
  options: NumericValidationOptions = {}
): number {
  const {
    minValue = -Infinity,
    maxValue = Infinity,
    defaultValue = 0,
    allowComma = true,
  } = options;

  // Clean input
  const cleaned = value.trim();
  if (!cleaned) return defaultValue;

  // Normalize comma to period if allowed
  const normalized = allowComma ? cleaned.replace(',', '.') : cleaned;

  // Parse
  const parsed = parseFloat(normalized);

  // Validate
  if (isNaN(parsed) || !isFinite(parsed)) return defaultValue;

  // Clamp to range
  return Math.max(minValue, Math.min(maxValue, parsed));
}

/**
 * Validate numeric input string
 * Returns true if valid, false otherwise
 */
export function validateNumericInput(
  value: string,
  options: NumericValidationOptions = {}
): boolean {
  const {
    minValue = -Infinity,
    maxValue = Infinity,
    allowComma = true,
    pattern = allowComma ? /^[\d.,]+$/ : /^[\d.]+$/,
  } = options;

  // Clean input
  const cleaned = value.trim();
  if (!cleaned) return false;

  // Pattern check
  if (!pattern.test(cleaned)) return false;

  // Parse and range check
  const normalized = normalizeNumericInput(cleaned, { ...options, defaultValue: NaN });
  if (isNaN(normalized)) return false;

  return normalized >= minValue && normalized <= maxValue;
}

/**
 * Simple check: Is this a valid number?
 * No range validation, just parseability
 */
export function isValidNumber(value: string, options?: { allowComma?: boolean }): boolean {
  const cleaned = value.trim();
  if (!cleaned) return false;

  const normalized = options?.allowComma ? cleaned.replace(',', '.') : cleaned;
  const num = parseFloat(normalized);

  return !isNaN(num) && isFinite(num);
}
```

**Migration Steps**:
```bash
# Step 1: Create new unified file
# (Code above)

# Step 2: Find all usages
grep -rn "validateNumericInput\|isValidNumber" src/subapps/dxf-viewer/

# Step 3: Update imports
# Replace:
# import { validateNumericInput } from './ui/toolbar/shared/input-validation';
# import { isValidNumber } from './systems/dynamic-input/utils/number';
# With:
# import { validateNumericInput, isValidNumber } from './utils/input-validation';

# Step 4: Delete old files
# - ui/toolbar/shared/input-validation.ts
# - systems/dynamic-input/utils/number.ts

# Step 5: Test all numeric inputs (zoom, scale, coordinates)
```

**Expected Result**:
-  Single source of truth ³¹± numeric validation
-  European format support (comma) EVERYWHERE
-  Consistent API
-  ~40 ³Á±¼¼­Â reduction
-  Better UX (comma support Ãµ dynamic input!)

---

## =â CATEGORY 5: DOMAIN-SPECIFIC VALIDATION (LOW PRIORITY)

### 5.1 Pattern: `isValid*` Functions

** ±Á±Ä®Á·Ã·**: ¥À¬ÁÇ¿Å½ 10+ `isValid*` functions Ãµ ´¹¬Æ¿Á± modules

** ±Á±´µ¯³¼±Ä±**:
```typescript
// systems/zoom/utils/bounds.ts:135
export function isValidBounds(bounds: { min: Point2D; max: Point2D } | null): boolean

// hooks/state/useCursorState.ts:45
export function isValidCursorState(state: unknown): state is CursorState

// rendering/entities/shared/entity-validation-utils.ts:98
export function isValidPoint(point: unknown): point is Point2D

// systems/selection/types.ts:67
export function isValidSelection(selection: unknown): selection is SelectionState

// overlays/types/overlay.ts:89
export function isValidOverlay(overlay: unknown): overlay is OverlayData
```

### = Analysis:

**š¿¹½Ì Pattern**:
- Type guard functions (`value is Type`)
- Domain-specific validation logic
- Null/undefined checks
- Property existence checks
- Type checks ³¹± properties

**”¹±Æ¿Á­Â**:
- š¬¸µ function validate ´¹±Æ¿ÁµÄ¹ºÌ domain object
- Different validation rules ±½¬ domain
- Different levels of strictness

**•¯½±¹ ±ÅÄÌ ÀÁÌ²»·¼±?**
L **Ÿ§™** - ‘ÅÄ­Â ¿¹ functions µ¯½±¹ **domain-specific** º±¹ µ¯½±¹ **OK** ½± µ¯½±¹ localized!

**“¹±Ä¯ µ¯½±¹ OK?**
- š¬¸µ domain ­Çµ¹ ´¹º¿ÍÂ Ä¿Å validation rules
- Type guards µ¯½±¹ TypeScript best practice
- Localization º¬½µ¹ Ä¿ code À¹¿ readable
- No actual duplication - ´¹±Æ¿ÁµÄ¹º® logic ³¹± º¬¸µ type

### =Ë £ÍÃÄ±Ã·:

** Á¿ÄµÁ±¹ÌÄ·Ä±**: =â LOW (No action needed)

**Reason**: Domain-specific validation functions µ¯½±¹ **acceptable localization**, ÌÇ¹ harmful duplication.

**Best Practice**: šÁ±Ä®ÃÄµ ±ÅÄ­Â Ä¹Â functions ÃÄ± modules À¿Å Ä¹Â ÇÁ·Ã¹¼¿À¿¹¿Í½, ³¹± º±»ÍÄµÁ· cohesion.

---

## =Ê SUMMARY TABLE: ALL DUPLICATES

| # | Category | Duplicate | Priority | Files Affected | LOC Saved | Impact |
|---|----------|-----------|----------|---------------|-----------|--------|
| 1 | Entity Validation | `entity-validation-utils.ts` (2 files) | =4 CRITICAL | 2 | ~75 | Type confusion, inconsistent API |
| 2 | Settings Validation | `validateGripSettings()` (2 implementations) | =à HIGH | 2 | ~26 | Inconsistent opacity range |
| 3 | Transform Validation | `validateTransform` pattern (3+ instances) | =á MEDIUM | 3+ | ~40-50 | Code duplication, maintenance |
| 4 | Input Validation | `validateNumericInput` vs `isValidNumber` | =à HIGH | 2 | ~40 | Missing features (comma support) |
| 5 | Domain Validation | `isValid*` functions (10+ instances) | =â LOW | 10+ | 0 |  Acceptable localization |

**Total Potential Reduction**: ~180-200 ³Á±¼¼­Â ºÎ´¹º±
**Total Files Affected**: ~9 files (excluding low-priority)
**Breaking Changes**: Minimal (¼µ ÃÉÃÄ® migration)

---

## <¯ RECOMMENDED ACTION PLAN

### Phase 1: Critical Issues (Week 1)
**Priority**: =4 CRITICAL

1.  **Consolidate `entity-validation-utils.ts`**
   - Merge both files ÃÄ¿ `rendering/entities/shared/entity-validation-utils.ts`
   - Support both ellipse formats ¼µ options parameter
   - Update all imports
   - Delete `utils/entity-validation-utils.ts`
   - **Testing**: Run entity rendering tests

2.  **Unify `validateGripSettings()`**
   - Keep `types/gripSettings.ts` implementation
   - Delete duplicate ±ÀÌ `settings-core/types.ts`
   - Update all imports
   - Document correct opacity range (0.1-1)
   - **Testing**: Test grip settings UI

### Phase 2: High Priority Issues (Week 2)
**Priority**: =à HIGH

3.  **Create unified input validation**
   - New file: `utils/input-validation.ts`
   - Combine features ±ÀÌ both implementations
   - Add European format support (comma) to dynamic input
   - Update all imports
   - **Testing**: Test zoom controls, scale controls, coordinate input

### Phase 3: Medium Priority Refactoring (Week 3)
**Priority**: =á MEDIUM

4.  **Create generic validation utilities**
   - New file: `utils/validation-utils.ts`
   - Implement `validateObject`, `validateNumeric`, etc.
   - Refactor transform/coordinate/overlay validation
   - **Testing**: Test all affected hooks

### Phase 4: Documentation & Monitoring (Ongoing)
**Priority**: =â LOW

5.  **Document validation patterns**
   - Update `docs/architecture/` ¼µ validation best practices
   - Add examples ÃÄ¿ `docs/reference/class-index.md`
   - Create lint rules ³¹± detecting duplicate validation logic

6.  **Monitor ³¹± new duplicates**
   - Regular code reviews
   - Automated duplicate detection (jscpd, etc.)

---

## =' TECHNICAL MIGRATION GUIDE

### Migration Checklist Template:

```markdown
## Migration: [Duplicate Name]

### Pre-Migration
- [ ] Backup affected files
- [ ] Document current behavior
- [ ] Identify all usages (`grep -rn "pattern" src/`)
- [ ] Create test cases ³¹± affected functionality

### Migration Steps
1. [ ] Create/update central implementation
2. [ ] Run TypeScript compilation check
3. [ ] Update imports in affected files (1 by 1)
4. [ ] Test each affected file after update
5. [ ] Delete old duplicate files
6. [ ] Run full test suite
7. [ ] Update documentation

### Post-Migration
- [ ] Verify no breaking changes
- [ ] Update CHANGELOG
- [ ] Monitor for issues (1 week)
- [ ] Remove backup files

### Rollback Plan
- [ ] Restore backup files ±ÀÌ `backups/` directory
- [ ] Revert imports
- [ ] Document why rollback happened
```

---

## =È EXPECTED RESULTS

### Code Quality Metrics:
-  **~180-200 ³Á±¼¼­Â reduction** (9% reduction Ãµ validation code)
-  **7 duplicate files/functions eliminated**
-  **4 central utilities created**
-  **9 files affected** (cleaner imports, consistent API)
-  **Zero breaking changes** (¼µ ÃÉÃÄ® migration)

### Developer Experience:
-  **Clearer API**: Single source of truth ³¹± º¬¸µ validation type
-  **Better documentation**: Central location ³¹± validation logic
-  **Easier maintenance**: Bug fixes Ãµ ­½± ¼­Á·
-  **Fewer bugs**: Consistent validation rules everywhere

### User Experience:
-  **Consistent behavior**: Š´¹± validation rules Ãµ Ì»· Ä·½ µÆ±Á¼¿³®
-  **Better input handling**: European format support (comma) everywhere
-  **Fewer errors**: Type-safe validation ¼µ TypeScript guards

---

## =Ú ADDITIONAL NOTES

### Validation Best Practices (Moving Forward):

1. **Single Source of Truth**
   - š¬¸µ validation type ÀÁ­Àµ¹ ½± ­Çµ¹ **­½±** ºµ½ÄÁ¹ºÌ implementation
   - Domain-specific validators OK, ±»»¬ shared logic ÀÁ­Àµ¹ ½± ºµ½ÄÁ¹º¿À¿¹·¸µ¯

2. **Type Guards Over Runtime Checks**
   - Prefer `value is Type` ³¹± TypeScript type safety
   - Document Ä¹ ±ºÁ¹²ÎÂ validate · º¬¸µ function

3. **Composable Validators**
   - Build complex validators ±ÀÌ simple reusable functions
   - Example: `validateObject()` + `validateNumeric()` + `validateString()`

4. **Clear Error Messages**
   - Validation functions ÀÁ­Àµ¹ ½± return detailed errors (ÌÇ¹ ¼Ì½¿ boolean)
   - Consider `{ success: boolean; error?: string; value?: T }` return type

5. **Consistent API**
   - Œ»± Ä± validators ÀÁ­Àµ¹ ½± follow Ä¿ ¯´¹¿ pattern
   - Same parameter order, same return type convention

### Tools for Duplicate Detection:

```bash
# Find duplicate code blocks
npx jscpd src/subapps/dxf-viewer/ --min-lines 5 --min-tokens 50

# Find similar function signatures
grep -rn "function validate\|export.*validate" src/subapps/dxf-viewer/

# Find similar type guards
grep -rn "is \w\+\s*:" src/subapps/dxf-viewer/

# Find similar validation patterns
grep -rn "Math.max.*Math.min\|clamp" src/subapps/dxf-viewer/
```

---

##  CONCLUSION

‘ÅÄ® · ±½±Æ¿Á¬ µ½ÄÌÀ¹Ãµ º±¹ Äµº¼·Á¯ÉÃµ **5 º±Ä·³¿Á¯µÂ validation duplicates** ÃÄ¿ `dxf-viewer` codebase:

1. =4 **CRITICAL**: Entity validation files (2 separate files ¼µ same name)
2. =à **HIGH**: Grip settings validation (2 implementations ¼µ ´¹±Æ¿ÁµÄ¹º¬ ranges)
3. =á **MEDIUM**: Transform validation patterns (3+ repeated patterns)
4. =à **HIGH**: Input validation (2 implementations ¼µ missing features)
5. =â **LOW**: Domain-specific `isValid*` functions (acceptable localization)

**Recommended Action**: Follow the 4-phase action plan ³¹± systematic consolidation.

**Expected Timeline**: 3 weeks ³¹± complete consolidation + 1 week monitoring

**Risk Level**: =â LOW (¼µ ÃÉÃÄ® migration º±¹ testing)

---

**‘½±Æ¿Á¬ ´·¼¹¿ÅÁ³®¸·ºµ**: 2025-10-03
**£Å½¿»¹º¬ ±ÁÇµ¯± ±½±»Í¸·º±½**: 109
**Validation functions µ½Ä¿À¯ÃÄ·º±½**: 50+
**Critical duplicates**: 7
**šÎ´¹º±Â ³¹± reduction**: ~180-200 ³Á±¼¼­Â

---

*=% ‘ÅÄ® · ±½±Æ¿Á¬ ´·¼¹¿ÅÁ³®¸·ºµ ¼µ  ›—¡— ±½¬»ÅÃ· Ì»¿Å Ä¿Å dxf-viewer codebase, ÃÍ¼ÆÉ½± ¼µ Ä¹Â ¿´·³¯µÂ Ä¿Å ”•š‘›Ÿ“Ÿ¥ •¡“‘£™‘£.*
