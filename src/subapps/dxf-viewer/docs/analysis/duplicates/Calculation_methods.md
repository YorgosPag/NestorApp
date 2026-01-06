# = ‘‘›¥£— ”™ ›Ÿ¤¥ © CALCULATION METHODS - DXF VIEWER

**—¼µÁ¿¼·½¯± ‘½¬»ÅÃ·Â:** 2025-10-03
**‘½±»ÅÄ®Â:** Claude (Anthropic AI)
** µ´¯¿ ‘½¬»ÅÃ·Â:** `src/subapps/dxf-viewer/` - Œ»± Ä± Calculation Methods
**£Å½¿»¹º¬ ‘ÁÇµ¯± •»­³Ç¸·º±½:** 52 files ¼µ geometry/math calculations

---

## =Ê •š¤•›•£¤™š— £¥Ÿ¨—

### ’±Ã¹º¬ •ÅÁ®¼±Ä±

| š±Ä·³¿Á¯± | ”¹À»ÌÄÅÀµÂ “Á±¼¼­Â | ‘ÁÇµ¯± |  Á¿ÄµÁ±¹ÌÄ·Ä± |
|-----------|-------------------|---------|--------------|
| **Bounds Calculations** | **~119** =¨ | 4 | =4 HIGH |
| **Inline Distance (Math.sqrt)** | **~300** =¨ | 46 | =4 HIGH |
| **Angle Calculations** | **~150** | 11 | =á MEDIUM |
| **Midpoint Calculations** | **~30** | 8 | =á MEDIUM |
| **Intersections** | **0**  | - | - |
| **Point-to-Line Distance** | **0**  | - | - |
| **Vector Math** | **~20** | 4 | =â LOW |

**£¥Ÿ›Ÿ ”™ ›Ÿ¤¥ ©:** ~619 ³Á±¼¼­Â
**POTENTIAL REDUCTION:** ~60% (370 ³Á±¼¼­Â)

---

## 1ã DISTANCE CALCULATIONS -  ¿»»±À»¬ ”¹À»ÌÄÅÀ± =4

###  šµ½ÄÁ¹º¿À¿¹·¼­½· œ­¸¿´¿Â

**`calculateDistance(p1, p2)`** - `rendering/entities/shared/geometry-rendering-utils.ts:35-39`

```typescript
export function calculateDistance(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}
```

### =4 ”¹À»ÌÄÅÀ± À¿Å ’Á­¸·º±½

#### 1.1 Duplicate Distance Functions

**”™ ›Ÿ¤¥ Ÿ #1:** `distance()` ÃÄ¿ `systems/constraints/utils.ts:140-144`
```typescript
export const DistanceUtils = {
  distance(p: Point2D, q: Point2D): number {
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
};
```

**Š´¹¿Â ºÎ´¹º±Â** ¼µ `calculateDistance`!

**”™ ›Ÿ¤¥ Ÿ #2:** `distance()` ÃÄ¿ `utils/geometry/GeometryUtils.ts:53`
```typescript
export function distance(p: Point2D, q: Point2D): number {
  return Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);
}
```

**Š´¹¿Â ºÎ´¹º±Â** ¼µ ´¹±Æ¿ÁµÄ¹ºÌ syntax!

**”™ ›Ÿ¤¥ Ÿ #3:** `distanceSq()` ÃÄ¿ `snapping/shared/GeometricCalculations.ts:39-43`
```typescript
export function distanceSq(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return dx * dx + dy * dy;  // §ÉÁ¯Â Math.sqrt
}
```

**Performance optimization** - µÀ¹ÃÄÁ­Æµ¹ ÄµÄÁ¬³É½¿ ³¹± comparisons.

** ¡Ÿ¤‘£—:** šÁ¬Ä·Ã· Ä¿Å `distanceSq` ³¹± performance, ±»»¬ ¼µ ÃÇÌ»¹¿ ÌÄ¹ µ¯½±¹ optimization.

#### 1.2 Inline Distance Calculations (œ•“‘›Ÿ  ¡Ÿ’›—œ‘!)

**119 µ¼Æ±½¯Ãµ¹Â** `Math.sqrt(dx*dx + dy*dy)` Ãµ **46 ±ÁÇµ¯±**!

**Top Offenders:**

| ‘ÁÇµ¯¿ | •¼Æ±½¯Ãµ¹Â | “Á±¼¼­Â šÎ´¹º± |
|--------|-----------|---------------|
| `utils/geometry/SegmentChaining.ts` | 12 | ~36 |
| `rendering/entities/BaseEntityRenderer.ts` | 7 | ~21 |
| `snapping/engines/NearestSnapEngine.ts` | 8 | ~24 |
| `snapping/engines/PerpendicularSnapEngine.ts` | 6 | ~18 |
| `rendering/entities/PolylineRenderer.ts` | 5 | ~15 |
| `systems/dynamic-input/hooks/*.ts` | 10 | ~30 |
| **†»»± ±ÁÇµ¯± (40)** | 71 | ~156 |

**£¥Ÿ›Ÿ INLINE:** ~300 ³Á±¼¼­Â ´¹±ÃÀ±Á¼­½¿Å ºÎ´¹º±!

** ¡Ÿ¤‘£—:**
```typescript
// L BEFORE (46 ±ÁÇµ¯±):
const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);

//  AFTER:
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
const dist = calculateDistance(p1, p2);
```

**SAVINGS:** ~300 ³Á±¼¼­Â

#### 1.3 Distance ¼µ Tolerance Check

**`nearPoint(p, q)`** - `utils/geometry/GeometryUtils.ts:45-48`
```typescript
export function nearPoint(p: Point2D, q: Point2D): boolean {
  const dist = Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);
  return dist <= GEOMETRY_CONSTANTS.GAP_TOLERANCE;
}
```

** ¡Ÿ¤‘£—:** Refactor ÉÂ:
```typescript
export function isWithinDistance(
  p1: Point2D,
  p2: Point2D,
  tolerance: number
): boolean {
  return calculateDistance(p1, p2) <= tolerance;
}

// Usage:
const isNear = isWithinDistance(p, q, GEOMETRY_CONSTANTS.GAP_TOLERANCE);
```

---

## 2ã ANGLE CALCULATIONS - £·¼±½Ä¹º® ”¹±ÃÀ¿Á¬ =á

###  šµ½ÄÁ¹º¿À¿¹·¼­½µÂ œ­¸¿´¿¹

1. **`calculateAngle(from, to)`** - `geometry-rendering-utils.ts:54-56`
2. **`calculateAngleData(...)`** - `utils/angle-calculation.ts:19-70`
3. **`AngleUtils.angleBetweenPoints`** - `systems/constraints/utils.ts:74-78`

### =4 ”¹À»ÌÄÅÀ± À¿Å ’Á­¸·º±½

#### 2.1 Inline Math.atan2 Calculations

**22 µ¼Æ±½¯Ãµ¹Â** `Math.atan2(dy, dx)` Ãµ **11 ±ÁÇµ¯±**!

| ‘ÁÇµ¯¿ | •¼Æ±½¯Ãµ¹Â | Context |
|--------|-----------|---------|
| `BaseEntityRenderer.ts` | 5 | Arc rendering, angle measurements |
| `AngleMeasurementRenderer.ts` | 4 | Angle display, bisector calculation |
| `utils/angle-calculation.ts` | 3 | Angle utilities |
| `systems/constraints/utils.ts` | 2 | Constraint angles |
| `rendering/entities/LineRenderer.ts` | 2 | Line direction |
| **†»»± (6 ±ÁÇµ¯±)** | 6 | Various angle needs |

**Ÿ“šŸ£:** ~150 ³Á±¼¼­Â

** ¡Ÿ¤‘£—:**
```typescript
// L BEFORE (11 ±ÁÇµ¯±):
const angle = Math.atan2(end.y - start.y, end.x - start.x);

//  AFTER:
import { calculateAngle } from '../../utils/geometry/AngleUtils';
const angle = calculateAngle(start, end);
```

#### 2.2 Duplicate Angle Functions

**”™ ›Ÿ¤¥ Ÿ #1:** `angleBetweenPoints()`

**‘ÁÇµ¯¿ 1:** `geometry-utils.ts:78-92` (15 ³Á±¼¼­Â)
```typescript
export function angleBetweenPoints(
  vertex: Point2D,
  p1: Point2D,
  p2: Point2D
): number {
  const angle1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
  const angle2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
  let diff = angle2 - angle1;
  // ... normalization logic
  return diff;
}
```

**‘ÁÇµ¯¿ 2:** `systems/dynamic-input/hooks/useDynamicInputMultiPoint.ts` (inline)

**Ÿ“šŸ£:** ~30 ³Á±¼¼­Â

**”™ ›Ÿ¤¥ Ÿ #2:** `angleFromHorizontal()`

**`geometry-utils.ts:97-103`**
```typescript
export function angleFromHorizontal(start: Point2D, end: Point2D): number {
  let angle = Math.atan2(end.y - start.y, end.x - start.x);
  if (angle < 0) angle += 2 * Math.PI;
  return angle;
}
```

 ±ÁÌ¼¿¹¿ ¼µ `calculateAngle` ±»»¬ ¼µ normalization 0-2À.

** ¡Ÿ¤‘£—:** Refactor ÉÂ:
```typescript
export function calculateAngle(
  from: Point2D,
  to: Point2D,
  options?: { normalize?: 'none' | '0-2pi' | '-pi-pi' }
): number {
  let angle = Math.atan2(to.y - from.y, to.x - from.x);

  if (options?.normalize === '0-2pi' && angle < 0) {
    angle += 2 * Math.PI;
  }

  return angle;
}
```

#### 2.3 Angle Utilities À¿Å  Á­Àµ¹ ½± šµ½ÄÁ¹º¿À¿¹·¸¿Í½

**`calculateAngleBisector()`** - `utils/angle-calculation.ts:76-87`
- ¥À¿»¿³¯¶µ¹ bisector angle ³¹± arc labeling
- **12 ³Á±¼¼­Â**
- ** ÁÌÄ±Ã·:** šÁ¬Ä·Ã· ±»»¬ ¼µÄ±º¯½·Ã· Ãµ `AngleUtils.ts`

**`normalizeAngle()`** - ”¹±ÃÀ±Á¼­½¿ Ãµ 5 ±ÁÇµ¯±
- **~25 ³Á±¼¼­Â** duplicate logic
- ** ÁÌÄ±Ã·:** Centralized `normalizeAngle(angle, mode)` utility

---

## 3ã INTERSECTION CALCULATIONS - •¾±¹ÁµÄ¹º® š±Ä¬ÃÄ±Ã·! 

###  šµ½ÄÁ¹º¿À¿¹·¼­½µÂ œ­¸¿´¿¹

**`snapping/shared/GeometricCalculations.ts`**

1. **`getLineIntersection(p1, p2, p3, p4)`** (³Á. 271-291)
2. **`getLineCircleIntersections(...)`** (³Á. 293-327)
3. **`getCircleIntersections(...)`** (³Á. 329-358)

###  š‘›‘ •‘ - œ—”• ”™ ›Ÿ¤¥ ‘!

Œ»± Ä± snap engines º±¹ hit testing ÇÁ·Ã¹¼¿À¿¹¿Í½ Ä¹Â ºµ½ÄÁ¹º­Â ¼µ¸Ì´¿ÅÂ:
-  IntersectionSnapEngine
-  ExtensionSnapEngine
-  TangentSnapEngine

** ‘¡‘”•™“œ‘ £©£¤—£ š•¤¡™šŸ Ÿ™—£—£!** <Æ

---

## 4ã VECTOR MATH - š±»® š±Ä¬ÃÄ±Ã· ¼µ œ¹ºÁ­Â ’µ»Ä¹ÎÃµ¹Â =â

###  šµ½ÄÁ¹º¿À¿¹·¼­½µÂ œ­¸¿´¿¹

1. **`getPerpendicularDirection(from, to)`** - `geometry-rendering-utils.ts:76-93`
2. **`rotatePoint(point, center, angle)`** - `geometry-rendering-utils.ts:61-71`

### =4 œ¹ºÁ¬ ”¹À»ÌÄÅÀ±

**Inline perpendicular calculations:**
- `LineRenderer.ts`: 4 inline (³¹± markers)
- `line-utils.ts`: 2 inline
- **Ÿ“šŸ£:** ~20 ³Á±¼¼­Â

** ¡Ÿ¤‘£—:** §Á®Ã· `getPerpendicularDirection` À±½Ä¿Í

---

## 5ã MIDPOINT/CENTER CALCULATIONS - œ­ÄÁ¹± ”¹±ÃÀ¿Á¬ =á

###  šµ½ÄÁ¹º¿À¿¹·¼­½· œ­¸¿´¿Â

**`calculateMidpoint(p1, p2)`** - `geometry-rendering-utils.ts:44-49`

```typescript
export function calculateMidpoint(p1: Point2D, p2: Point2D): Point2D {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}
```

### =4 ”¹À»ÌÄÅÀ± À¿Å ’Á­¸·º±½

#### 5.1 Inline Midpoint Calculations

**8 ±ÁÇµ¯±** ¼µ inline midpoint:

```typescript
const midpoint = {
  x: (p1.x + p2.x) / 2,
  y: (p1.y + p2.y) / 2
};
```

| ‘ÁÇµ¯¿ | •¼Æ±½¯Ãµ¹Â |
|--------|-----------|
| `line-utils.ts` (createEdgeGrips) | 3 |
| `GeometricCalculations.ts` (getEntityMidpoint) | 2 |
| `BaseEntityRenderer.ts` | 2 |
| `useDynamicInputMultiPoint.ts` | 1 |
| **†»»±** | 4 |

**Ÿ“šŸ£:** ~30 ³Á±¼¼­Â

** ¡Ÿ¤‘£—:** ‘½Ä¹º±Ä¬ÃÄ±Ã· ¼µ `calculateMidpoint`

#### 5.2 Entity Center Calculations

**`getEntityCenter(entity)`** - `GeometricCalculations.ts:191-226`
- **35 ³Á±¼¼­Â** ¼µ entity-specific center logic
-  ±ÁÌ¼¿¹¿: `getEntityBounds` + center ±ÀÌ bounds
- ** ÁÌÄ±Ã·:** Refactor ³¹± reuse

#### 5.3 Bounds Center Duplicates

**”™ ›Ÿ¤¥ Ÿ:**

**‘ÁÇµ¯¿ 1:** `getBoundsCenter()` - `systems/zoom/utils/bounds.ts:232-237`
```typescript
export function getBoundsCenter(bounds: Bounds): Point2D {
  return {
    x: bounds.minX + (bounds.maxX - bounds.minX) / 2,
    y: bounds.minY + (bounds.maxY - bounds.minY) / 2,
  };
}
```

**‘ÁÇµ¯¿ 2:** `boundsCenter()` - `core/spatial/SpatialUtils.ts:100-105`
```typescript
export function boundsCenter(bounds: SpatialBounds): Point2D {
  return {
    x: bounds.minX + (bounds.maxX - bounds.minX) / 2,
    y: bounds.minY + (bounds.maxY - bounds.minY) / 2,
  };
}
```

**™”™Ÿ£ š©”™š‘£!**

**Ÿ“šŸ£:** 12 ³Á±¼¼­Â

---

## 6ã BOUNDS CALCULATIONS - š¡™£™œŸ  ¡Ÿ’›—œ‘! =¨

###   4 ‘¡§•™‘ ¼µ Overlapping Bounds Utilities!

| ‘ÁÇµ¯¿ | “Á±¼¼­Â | šÍÁ¹µÂ œ­¸¿´¿¹ |
|--------|---------|---------------|
| `systems/zoom/utils/bounds.ts` | 262 | createBounds, getBoundsDimensions, expandBounds |
| `rendering/hitTesting/Bounds.ts` | 339 | BoundsCalculator, BoundsOperations |
| `core/spatial/SpatialUtils.ts` | 207 | boundsFromPoints, boundsIntersect |
| `utils/SmartBoundsManager.ts` | 351 | calculateSceneBounds, getEntityBounds |

**£¥Ÿ›Ÿ:** 1,159 ³Á±¼¼­Â (¼µ overlaps)

### =4 ”¹À»ÌÄÅÀµÂ œ­¸¿´¿¹

| œ­¸¿´¿Â | ‘ÁÇµ¯¿ 1 | ‘ÁÇµ¯¿ 2 | Œ³º¿Â |
|---------|----------|----------|-------|
| **boundsFromPoints** | SpatialUtils.ts:19-37 | bounds.ts:15-25 | 20 ³Á. |
| **boundsCenter** | SpatialUtils.ts:100-105 | bounds.ts:232-237 | 6 ³Á. |
| **boundsIntersect** | SpatialUtils.ts:42-49 | Bounds.ts:227-232 | 8 ³Á. |
| **expandBounds** | SpatialUtils.ts:88-95 | bounds.ts:165-179 | 15 ³Á. |
| **calculateEntityBounds** | Bounds.ts:28-55 | SmartBoundsManager:126-196 | 70 ³Á. |

**£¥Ÿ›™šŸ£ Ÿ“šŸ£ ”™ ›Ÿ¤¥ ©:** ~119 ³Á±¼¼­Â!

### <¯  ÁÌÄ±Ã· •½¿À¿¯·Ã·Â

**•Ÿ ‘¡§•™Ÿ:** `utils/geometry/BoundsUtils.ts` (Centralized)

```typescript
// ============================================
// SECTION 1: Creation from Points/Vertices
// ============================================
export function boundsFromPoints(points: Point2D[]): Bounds;
export function boundsFromVertices(vertices: Point2D[]): Bounds;

// ============================================
// SECTION 2: Entity Bounds
// ============================================
export function calculateEntityBounds(entity: Entity): Bounds;
export function getLineBounds(start: Point2D, end: Point2D): Bounds;
export function getCircleBounds(center: Point2D, radius: number): Bounds;
export function getRectangleBounds(topLeft: Point2D, width: number, height: number): Bounds;

// ============================================
// SECTION 3: Bounds Operations
// ============================================
export function boundsIntersect(a: Bounds, b: Bounds): boolean;
export function boundsContains(bounds: Bounds, point: Point2D): boolean;
export function boundsContainsBounds(outer: Bounds, inner: Bounds): boolean;
export function expandBounds(bounds: Bounds, padding: number): Bounds;
export function boundsUnion(a: Bounds, b: Bounds): Bounds;
export function boundsCenter(bounds: Bounds): Point2D;
export function boundsDimensions(bounds: Bounds): { width: number; height: number };

// ============================================
// SECTION 4: Validation
// ============================================
export function isValidBounds(bounds: Bounds): boolean;
export function sanitizeBounds(bounds: Bounds): Bounds;
```

**Migration Plan:**

1. Create `utils/geometry/BoundsUtils.ts`
2. Move methods ±ÀÌ 4 ±ÁÇµ¯± ’ BoundsUtils
3. Update imports Ãµ **52 ±ÁÇµ¯±** À¿Å ÇÁ·Ã¹¼¿À¿¹¿Í½ bounds
4. Delete duplicate methods
5. Keep specialized classes (BoundsCalculator) ±½ ÇÁµ¹¬¶¿½Ä±¹

**SAVINGS:** ~119 ³Á±¼¼­Â duplicates + ~200 ³Á±¼¼­Â consolidation = **~320 ³Á±¼¼­Â total savings**

---

## 7ã POINT-TO-LINE DISTANCE - •¾±¹ÁµÄ¹º® š±Ä¬ÃÄ±Ã·! 

###  šµ½ÄÁ¹º¿À¿¹·¼­½· œ­¸¿´¿Â

**`pointToLineDistance(point, lineStart, lineEnd)`** - `geometry-utils.ts:18-23`

###  š‘›‘ •‘ - œ—”• ”™ ›Ÿ¤¥ ‘!

Œ»± Ä± ±ÁÇµ¯± ÇÁ·Ã¹¼¿À¿¹¿Í½ Ä· centralized ¼­¸¿´¿:
-  Snap engines (5 files)
-  Hit testing (HitTester.ts)
-  Selection utils
-  Entity renderers

** ‘¡‘”•™“œ‘ ¤•›•™‘£ š•¤¡™šŸ Ÿ™—£—£!** <Æ

---

## 8ã NEAREST POINT ON LINE - •¾±¹ÁµÄ¹º® š±Ä¬ÃÄ±Ã·! 

###  šµ½ÄÁ¹º¿À¿¹·¼­½· œ­¸¿´¿Â

**`getNearestPointOnLine(point, lineStart, lineEnd, clamp)`** - `geometry-utils.ts:38-71`

###  §Á®Ã·

-  NearestSnapEngine
-  PerpendicularSnapEngine
-  ParallelSnapEngine
-  ExtensionSnapEngine

**Ÿ›‘ £©£¤‘!**

---

## =Ê £¥Ÿ›™š— ‘‘›¥£—

### “µ½¹º® •¹ºÌ½±

| š±Ä·³¿Á¯± | ”¹À»ÌÄÅÀ± | ‘ÁÇµ¯± |  ¿Ã¿ÃÄÌ |  Á¿ÄµÁ±¹ÌÄ·Ä± |
|-----------|-----------|---------|---------|--------------|
| Bounds Calculations | ~119 | 4 | 19% | =4 HIGH |
| Inline Distance | ~300 | 46 | 48% | =4 HIGH |
| Angle Calculations | ~150 | 11 | 24% | =á MEDIUM |
| Midpoint/Center | ~30 | 8 | 5% | =á MEDIUM |
| Vector Math | ~20 | 4 | 3% | =â LOW |
| Intersections | **0** | - | 0% |  PERFECT |
| Point-to-Line | **0** | - | 0% |  PERFECT |
| Nearest Point | **0** | - | 0% |  PERFECT |

**£¥Ÿ›Ÿ:** ~619 ³Á±¼¼­Â ´¹À»ÌÄÅÀ±

### š±Ä±½¿¼® ”¹À»¿ÄÍÀÉ½

```
Total: 619 lines (100%)

   Inline Distance (HIGH): 300 lines (48.5%)
   Angle Calculations (MEDIUM): 150 lines (24.2%)
   Bounds Calculations (HIGH): 119 lines (19.2%)
   Midpoint/Center (MEDIUM): 30 lines (4.8%)
   Vector Math (LOW): 20 lines (3.2%)
```

### <¯ Potential Savings

| Action | Lines Saved | Priority | Time |
|--------|-------------|----------|------|
| Bounds Unification | ~320 | =4 HIGH | 3-4h |
| Inline Distance Cleanup | ~300 | =4 HIGH | 2-3h |
| Angle Utilities | ~150 | =á MEDIUM | 1-2h |
| Midpoint Cleanup | ~30 | =á MEDIUM | 30m |
| Vector Math | ~20 | =â LOW | 15m |

**TOTAL POTENTIAL SAVINGS:** ~820 ³Á±¼¼­Â ’ ~450 ³Á±¼¼­Â (55% reduction)

---

## <Æ ’‘˜œŸ›Ÿ“—£— š•¤¡™šŸ Ÿ™—£—£

### £Å½¿»¹º® ’±¸¼¿»¿³¯±: 6.8/10 PPPP

### ‘½¬ š±Ä·³¿Á¯±:

#### >G 10/10 - Intersections (PERFECT!)
-   »®Á·Â ºµ½ÄÁ¹º¿À¿¯·Ã· ÃÄ¿ GeometricCalculations
-  Consistent ÇÁ®Ã· ±ÀÌ Ì»± Ä± snap engines

#### >G 10/10 - Point-to-Line Distance (PERFECT!)
-  Single source of truth
-  Universal usage

#### >G 10/10 - Nearest Point on Line (PERFECT!)
-  Centralized implementation
-  Consistent usage

#### >I 7/10 - Vector Math (GOOD)
-  Core methods centralized
- L œ¹ºÁ¬ inline calculations (20 lines)

#### >I 6/10 - Angle Calculations (FAIR)
-  Basic methods centralized
- L 22 inline Math.atan2 (150 lines)

#### >I 6/10 - Midpoint/Center (FAIR)
-  Core method exists
- L Inline calculations (30 lines)

#### =¨ 4/10 - Distance Calculations (NEEDS WORK)
-  Core method exists
- L 119 inline Math.sqrt (300 lines)

#### =¨ 3/10 - Bounds Calculations (CRITICAL!)
- L 4 ±ÁÇµ¯± ¼µ overlapping functionality
- L 119 lines duplicates

---

## <¯  ¡Ÿ¤•™Ÿœ•— £¤¡‘¤—“™š—

### =4 PHASE 1: Bounds Unification (HIGH PRIORITY)

**£ÄÌÇ¿Â:** •½¿À¿¯·Ã· 4 bounds ±ÁÇµ¯É½ Ãµ •‘ centralized module.

**•½­Á³µ¹µÂ:**

1. **Create:** `utils/geometry/BoundsUtils.ts` (NEW FILE)
   ```typescript
   // Consolidate methods ±ÀÌ:
   // - systems/zoom/utils/bounds.ts
   // - rendering/hitTesting/Bounds.ts
   // - core/spatial/SpatialUtils.ts
   // - utils/SmartBoundsManager.ts
   ```

2. **Move methods:**
   - Point/Vertices ’ Bounds
   - Entity ’ Bounds
   - Bounds Operations
   - Validation

3. **Update imports** Ãµ 52 ±ÁÇµ¯±

4. **Delete duplicates**

**SAVINGS:** ~320 ³Á±¼¼­Â
**TIME:** 3-4 hours

### =4 PHASE 2: Inline Distance Cleanup (HIGH PRIORITY)

**£ÄÌÇ¿Â:** ‘½Ä¹º±Ä¬ÃÄ±Ã· 119 inline `Math.sqrt` ¼µ `calculateDistance`.

**•½­Á³µ¹µÂ:**

1. **Search pattern:** `Math\.sqrt.*\(.*\-.*\).*\*`
2. **Replace ¼µ:**
   ```typescript
   import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
   const dist = calculateDistance(p1, p2);
   ```

3. **Focus on:**
   - SegmentChaining.ts (12 instances)
   - BaseEntityRenderer.ts (7 instances)
   - Snap engines (30+ instances)
   - Dynamic input hooks (10 instances)

**SAVINGS:** ~300 ³Á±¼¼­Â
**TIME:** 2-3 hours

### =á PHASE 3: Angle Utilities (MEDIUM PRIORITY)

**£ÄÌÇ¿Â:** šµ½ÄÁ¹º¿À¿¯·Ã· Ì»É½ ÄÉ½ angle calculations.

**•½­Á³µ¹µÂ:**

1. **Create:** `utils/geometry/AngleUtils.ts` (NEW FILE)
   ```typescript
   export function calculateAngle(from: Point2D, to: Point2D, options?): number;
   export function angleBetweenPoints(vertex: Point2D, p1: Point2D, p2: Point2D): number;
   export function normalizeAngle(angle: number, mode: 'none' | '0-2pi' | '-pi-pi'): number;
   export function calculateAngleBisector(startAngle: number, endAngle: number): number;
   ```

2. **Consolidate ±ÀÌ:**
   - `utils/angle-calculation.ts`
   - `geometry-utils.ts`
   - `geometry-rendering-utils.ts`
   - `systems/constraints/utils.ts`

3. **Replace 22 inline `Math.atan2`**

**SAVINGS:** ~150 ³Á±¼¼­Â
**TIME:** 1-2 hours

### =á PHASE 4: Midpoint Cleanup (MEDIUM PRIORITY)

**£ÄÌÇ¿Â:** §Á®Ã· `calculateMidpoint` À±½Ä¿Í.

**•½­Á³µ¹µÂ:**

1. **Search pattern:** `\{.*x:.*\(.*\.x.*\+.*\.x.*\).*\/.*2`
2. **Replace ¼µ:** `calculateMidpoint(p1, p2)`

**SAVINGS:** ~30 ³Á±¼¼­Â
**TIME:** 30 minutes

### =â PHASE 5: Vector Math Cleanup (LOW PRIORITY)

**£ÄÌÇ¿Â:** Eliminate inline perpendicular calculations.

**SAVINGS:** ~20 ³Á±¼¼­Â
**TIME:** 15 minutes

---

## =È ‘‘œ•Ÿœ•‘ ‘ Ÿ¤•›•£œ‘¤‘

### œµÄ¬ Ä·½  »®Á· šµ½ÄÁ¹º¿À¿¯·Ã·

**¤Á­Ç¿ÅÃ± š±Ä¬ÃÄ±Ã·:**
- Calculation code: ~1,500 ³Á±¼¼­Â (¼µ duplicates)
- ”¹À»ÌÄÅÀ±: ~619 ³Á±¼¼­Â (41%)
- Centralized: ~881 ³Á±¼¼­Â (59%)

**œµÄ¬ Ä·½ Migration:**
- Calculation code: ~900 ³Á±¼¼­Â (consolidated)
- ”¹À»ÌÄÅÀ±: ~50 ³Á±¼¼­Â (5%)
- Centralized: ~850 ³Á±¼¼­Â (95%)

**œ•™©£—:** 40% (600 ³Á±¼¼­Â)

### ’µ»Ä¹ÎÃµ¹Â  ¿¹ÌÄ·Ä±Â

1.  **Single Source of Truth** ³¹± º¬¸µ calculation
2.  **Easier Testing** - Test ¼Ì½¿ centralized methods
3.  **Consistency** Ãµ Ì»¿ Ä¿ codebase
4.  **Performance** - Shared optimizations
5.  **Maintainability** - Bug fixes Ãµ •‘ Ã·¼µ¯¿

### Quality Score Improvement

**Before:** 6.8/10
**After:** 9.2/10 (+2.4 points)

---

## =€ ¤•›™š— £¥£¤‘£—

**“¹ÎÁ³¿, · º±Ä¬ÃÄ±Ã· ÄÉ½ calculation methods µ¯½±¹ œ™š¤—:**

###  •À¹ÄÅÇ¯µÂ (Gold Standard):
- **Intersections:** 10/10 - ¤­»µ¹± ºµ½ÄÁ¹º¿À¿¯·Ã·!
- **Point-to-Line:** 10/10 - Single source of truth!
- **Nearest Point:** 10/10 - Consistent usage!

### L šÁ¯Ã¹¼± šµ½¬:
1. **Bounds Calculations:** 4 ±ÁÇµ¯± ¼µ duplicates (119 lines)
2. **Inline Distance:** 119 µ¼Æ±½¯Ãµ¹Â Math.sqrt (300 lines)
3. **Angle Calculations:** 22 inline Math.atan2 (150 lines)

### <¯  Á¿Äµ¹½Ì¼µ½· ”Á¬Ã·

**†¼µÃ· (HIGH PRIORITY):**
1.  Bounds Unification (3-4h) ’ -320 lines
2.  Inline Distance Cleanup (2-3h) ’ -300 lines

**£Í½Ä¿¼± (MEDIUM PRIORITY):**
3.  Angle Utilities (1-2h) ’ -150 lines
4.  Midpoint Cleanup (30m) ’ -30 lines

**‘À¿Ä­»µÃ¼±:** ~800 ³Á±¼¼­Â reduction, Quality: 6.8/10 ’ 9.2/10

**˜­»µ¹Â ½± ¾µº¹½®Ã¿Å¼µ ¼µ Ä¿ Bounds Unification;** =€

---

**¤•›Ÿ£ ‘‘¦Ÿ¡‘£**
