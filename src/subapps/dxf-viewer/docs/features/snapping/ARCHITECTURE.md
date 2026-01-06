# Snap Engine Architecture V2

## Επισκόπηση

Η νέα αρχιτεκτονική του Snap Engine χωρίζει τις ευθύνες σε μικρότερα, πιο εστιασμένα modules για καλύτερη συντηρησιμότητα και επεκτασιμότητα.

## Δομή Αρχείων

```
snapping/
├── engines/                    # Ξεχωριστό engine για κάθε snap type
│   ├── EndpointSnapEngine.ts
│   ├── MidpointSnapEngine.ts
│   ├── IntersectionSnapEngine.ts
│   └── [Future engines...]
├── orchestrator/               # Συντονιστής όλων των engines
│   └── SnapOrchestrator.ts
├── shared/                     # Κοινές utilities
│   ├── BaseSnapEngine.ts       # Base class για engines
│   ├── GeometricCalculations.ts # Γεωμετρικοί υπολογισμοί
│   └── SpatialIndex.ts         # Spatial indexing
├── ProSnapEngineV2.ts          # Νέα κύρια κλάση
├── pro-snap-engine.ts          # Legacy engine
└── index.ts                    # Exports
```

## Αρχές Σχεδιασμού

### 1. Single Responsibility Principle
- Κάθε engine είναι υπεύθυνο μόνο για έναν τύπο snap
- Κοινή λογική εξάγεται σε shared utilities

### 2. Open/Closed Principle
- Νέα snap types μπορούν να προστεθούν χωρίς αλλαγή υπάρχοντος κώδικα
- Απλώς δημιουργείτε νέο engine και το καταχωρείτε στον orchestrator

### 3. Dependency Inversion
- Engines εξαρτώνται από abstractions (BaseSnapEngine)
- Orchestrator συντονίζει χωρίς να γνωρίζει λεπτομέρειες υλοποίησης

## Κύριες Κλάσεις

### BaseSnapEngine
```typescript
abstract class BaseSnapEngine {
  abstract findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult;
  abstract initialize(entities: Entity[]): void;
  abstract dispose(): void;
}
```

### SnapOrchestrator
- Διαχειρίζεται όλα τα engines
- Εκτελεί τα engines κατά σειρά προτεραιότητας
- Συγκεντρώνει και ταξινομεί αποτελέσματα

### GeometricCalculations
- Στατικές μέθοδοι για γεωμετρικούς υπολογισμούς
- Αποφυγή code duplication μεταξύ engines

### SpatialIndex
- Grid-based indexing για γρήγορες αναζητήσεις
- Βελτιστοποιημένο για CAD-style drawings

## Migration Guide

### Από ProSnapEngine σε ProSnapEngineV2

```typescript
// Παλιός κώδικας
const snapEngine = new ProSnapEngine(settings);
snapEngine.initialize(entities, viewport);

// Νέος κώδικας  
const snapEngine = new ProSnapEngineV2(settings);
snapEngine.initialize(entities, viewport);

// Το API παραμένει το ίδιο!
const result = snapEngine.findSnapPoint(cursorPoint);
```

### Προσθήκη Νέου Snap Type

1. Δημιουργήστε νέο engine:
```typescript
class MyCustomSnapEngine extends BaseSnapEngine {
  constructor() {
    super(ExtendedSnapType.MY_CUSTOM);
  }
  
  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    // Implementation
  }
}
```

2. Καταχωρήστε στον orchestrator:
```typescript
this.engines.set(ExtendedSnapType.MY_CUSTOM, new MyCustomSnapEngine());
```

## Performance Benefits

### Πριν (Monolithic)
- Όλοι οι υπολογισμοί σε μία κλάση
- Δύσκολο να βελτιστοποιηθεί συγκεκριμένο snap type
- Mixed concerns

### Μετά (Modular)
- Κάθε engine βελτιστοποιημένο για το δικό του snap type
- Conditional loading - μόνο enabled engines τρέχουν
- Shared spatial indices
- Parallel execution potential (future)

## Testing Strategy

### Unit Testing
```typescript
describe('EndpointSnapEngine', () => {
  let engine: EndpointSnapEngine;
  let mockContext: SnapEngineContext;

  beforeEach(() => {
    engine = new EndpointSnapEngine();
    mockContext = createMockContext();
  });

  it('should find nearby endpoints', () => {
    // Test isolated functionality
  });
});
```

### Integration Testing
```typescript
describe('SnapOrchestrator', () => {
  it('should coordinate multiple engines', () => {
    // Test engine coordination
  });
});
```

## Future Enhancements

1. **Lazy Loading**: Load engines on demand
2. **Worker Threads**: Parallel execution of heavy calculations
3. **Caching**: Smart caching of intersection results
4. **Plugin System**: Dynamic engine registration
5. **Metrics**: Detailed performance monitoring per engine

## Backwards Compatibility

- Το παλιό `ProSnapEngine` παραμένει διαθέσιμο
- Το νέο `ProSnapEngineV2` έχει το ίδιο public API
- Σταδιακή migration χωρίς breaking changes

## Configuration Presets

```typescript
// Γρήγορη ρύθμιση για διαφορετικά workflows
snapEngine.setArchitecturalPreset();
snapEngine.setEngineeringPreset(); 
snapEngine.setSimplePreset();
```

## Monitoring & Debugging

```typescript
const stats = snapEngine.getStats();
console.log(stats);
// {
//   version: '2.0.0',
//   architecture: 'modular',
//   orchestrator: {
//     enabledEngines: ['endpoint', 'midpoint', 'intersection'],
//     engineStats: { ... }
//   }
// }
```

---

## Snap Indicator Rendering (Visual Feedback)

### Επισκόπηση

Το snap indicator rendering υλοποιείται στο **`SnapIndicatorOverlay.tsx`** και ακολουθεί τα industry standards του AutoCAD/MicroStation.

**Αρχείο:** `src/subapps/dxf-viewer/canvas-v2/overlays/SnapIndicatorOverlay.tsx`

### Πώς Λειτουργεί

```
┌─────────────────────────────────────────────────────────────────┐
│                    SNAP RENDERING PIPELINE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Mouse Move Event                                             │
│         ↓                                                        │
│  2. useCentralizedMouseHandlers.ts                               │
│         │  └─ Μετατροπή screen → world coordinates               │
│         ↓                                                        │
│  3. SnapOrchestrator.findSnapPoint()                             │
│         │  └─ Ψάχνει σε όλα τα enabled engines                   │
│         │  └─ Επιστρέφει: { point, type, distance }              │
│         ↓                                                        │
│  4. SnapIndicatorOverlay (React Component)                       │
│         │  └─ Λαμβάνει: snapResult = { point, type }             │
│         │  └─ Μετατροπή world → screen position                  │
│         ↓                                                        │
│  5. SnapShape Component                                          │
│         └─ Renders το κατάλληλο SVG shape βάσει type             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Snap Type Symbols (AutoCAD/MicroStation Standards)

| Type | Symbol | SVG Shape | Περιγραφή |
|------|--------|-----------|-----------|
| **endpoint** | ■ | `<rect>` | Πράσινο τετράγωνο στα άκρα γραμμών |
| **midpoint** | △ | `<polygon>` | Τρίγωνο στη μέση γραμμών |
| **center** | ○ | `<circle>` | Κύκλος στο κέντρο κύκλων/τόξων |
| **intersection** | ✕ | `<line>` x2 | X shape σε τομές γραμμών |
| **perpendicular** | ⊥ | `<polyline>` | Ορθή γωνία |
| **parallel** | ║ | `<line>` x2 | Δύο παράλληλες γραμμές |
| **tangent** | ◯─ | `<circle>` + `<line>` | Κύκλος με εφαπτομένη |
| **quadrant** | ◇ | `<polygon>` | Ρόμβος στα τεταρτημόρια |
| **nearest** | + | `<line>` x2 | Σταυρός |
| **grid** | • | `<circle>` filled | Γεμάτη κουκκίδα |

### Κώδικας Rendering (SnapShape Component)

```typescript
// src/subapps/dxf-viewer/canvas-v2/overlays/SnapIndicatorOverlay.tsx

const SNAP_INDICATOR_SIZE = 12; // pixels - CAD standard size

function SnapShape({ type, color }: { type: string; color: string }) {
  switch (type.toLowerCase()) {
    // ■ ENDPOINT: Square - AutoCAD/MicroStation standard
    case 'endpoint':
      return (
        <svg width={size} height={size}>
          <rect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={size - strokeWidth}
            height={size - strokeWidth}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
          />
        </svg>
      );

    // △ MIDPOINT: Triangle - AutoCAD/MicroStation standard
    case 'midpoint':
      return (
        <svg width={size} height={size}>
          <polygon
            points={`${half},${strokeWidth} ${size - strokeWidth},${size - strokeWidth} ${strokeWidth},${size - strokeWidth}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
          />
        </svg>
      );

    // ... άλλα shapes
  }
}
```

### Coordinate Transform για Snap Positioning

**ΚΡΙΣΙΜΟ:** Η θέση του snap indicator υπολογίζεται με βάση το **COORDINATE_LAYOUT** από το `CoordinateTransforms.ts`:

```typescript
// src/subapps/dxf-viewer/rendering/core/CoordinateTransforms.ts

export const COORDINATE_LAYOUT = {
  RULER_LEFT_WIDTH: 30,   // ✅ Πλάτος αριστερού ruler (pixels)
  RULER_TOP_HEIGHT: 30,   // ✅ Ύψος πάνω ruler (pixels)
  MARGINS: {
    left: 30,   // Space for vertical ruler
    top: 30,    // Space for horizontal ruler
    right: 0,
    bottom: 30
  }
} as const;

// World → Screen μετατροπή:
// screenX = MARGINS.left + worldX * scale + offsetX
// screenY = (height - MARGINS.top) - worldY * scale - offsetY
```

### Snap Indicator Positioning

```typescript
// SnapIndicatorOverlay.tsx - Τοποθέτηση indicator

<div
  style={{
    left: point.x - SNAP_INDICATOR_HALF,  // Κεντράρισμα οριζόντια
    top: point.y - SNAP_INDICATOR_HALF,   // Κεντράρισμα κατακόρυφα
    filter: `drop-shadow(0 0 2px ${snapColor})` // Glow effect
  }}
>
  <SnapShape type={type} color={snapColor} />
</div>
```

### Styling & Colors

Τα χρώματα προέρχονται από τα **centralized design tokens**:

```typescript
// src/styles/design-tokens/canvas.ts
import { canvasUI } from '@/styles/design-tokens/canvas';

const snapColor = canvasUI.overlay.colors.snap.border; // Πράσινο (#00FF00)
```

### Troubleshooting: Snap Indicator Offset

**Πρόβλημα (2026-01-06):** Το snap indicator εμφανιζόταν ~50px αριστερά από το πραγματικό endpoint.

**Αιτία:** Το `COORDINATE_LAYOUT.MARGINS.left` ήταν hardcoded σε **80px** αλλά οι rulers είναι **30px**.

**Λύση:** Ενημέρωση του `CoordinateTransforms.ts`:
```typescript
// ΠΡΙΝ (λάθος):
RULER_LEFT_WIDTH: 80,
MARGINS: { left: 80, ... }

// ΜΕΤΑ (σωστό):
RULER_LEFT_WIDTH: 30,
MARGINS: { left: 30, ... }
```

### Troubleshooting: Snap Click Mismatch

**Πρόβλημα (2026-01-06):** Το snap indicator εμφανιζόταν σωστά στο endpoint, αλλά όταν ο χρήστης έκανε κλικ, η νέα γραμμή ξεκινούσε σε διαφορετική θέση (τα δύο άκρα δεν ταυτίζονταν).

**Αιτία:** Στο `useCentralizedMouseHandlers.ts`, το `findSnapPoint` δεχόταν **SCREEN coordinates** (`cursor.position`) αλλά χρειαζόταν **WORLD coordinates**!

```
❌ ΛΑΘΟΣ ΡΟΗ:
cursor.position (SCREEN) → findSnapPoint (θέλει WORLD) → ΛΑΘΟΣ ΑΠΟΤΕΛΕΣΜΑ
```

**Λύση:** Σωστή μετατροπή coordinate systems:

```typescript
// ✅ ΣΩΣΤΗ ΡΟΗ:
// 1. Screen → World για snap detection
// 2. Snap engine επιστρέφει World coords
// 3. World → Screen για onCanvasClick

if (snapEnabled && findSnapPoint) {
  // 1. Convert screen → world for snap detection
  const worldPos = CoordinateTransforms.screenToWorld(cursor.position, transform, viewport);

  // 2. Find snap point (in world coordinates)
  const snapResult = findSnapPoint(worldPos.x, worldPos.y);

  // 3. If snap found, convert snapped world point back to screen
  if (snapResult && snapResult.found && snapResult.snappedPoint) {
    clickPoint = CoordinateTransforms.worldToScreen(snapResult.snappedPoint, transform, viewport);
  }
}
```

**Κρίσιμη Λεπτομέρεια:**
- `cursor.position` = **SCREEN** coordinates (canvas-relative pixels)
- `findSnapPoint()` = αναμένει **WORLD** coordinates
- `onCanvasClick()` = αναμένει **SCREEN** coordinates (κάνει screenToWorld internally)

**Αρχείο:** `src/subapps/dxf-viewer/systems/cursor/useCentralizedMouseHandlers.ts` (γραμμές 361-383)

### Snap Indicator Positioning (UPDATED 2026-01-06)

> ⚠️ **ΚΡΙΣΙΜΗ ΤΕΚΜΗΡΙΩΣΗ:** Για λεπτομερή περιγραφή της λειτουργίας του snap indicator,
> διάβασε το **SNAP_INDICATOR_LINE.md** που περιέχει CRITICAL WARNING section.

**Τρέχουσα Λειτουργική Αρχιτεκτονική:**

```
✅ ΛΕΙΤΟΥΡΓΙΚΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗ (ΜΗΝ ΑΛΛΑΞΕΙΣ):
┌──────────────────────────────────────────────────────────────────┐
│ Mouse Move → screenToWorld → findSnapPoint(worldPos) →          │
│ snap.snappedPoint (WORLD) → Store in Context                    │
│                                                                  │
│ CanvasSection:                                                   │
│   currentSnapResult.snappedPoint → wrapped as {point, type}     │
│                                                                  │
│ SnapIndicatorOverlay:                                            │
│   point.x, point.y → ΑΠΕΥΘΕΙΑΣ ως CSS left/top pixels           │
│   ❌ ΧΩΡΙΣ worldToScreen() μετατροπή!                            │
└──────────────────────────────────────────────────────────────────┘
```

**ΠΡΟΣΟΧΗ:** Η προηγούμενη τεκμηρίωση σε αυτό το σημείο ήταν ΛΑΝΘΑΣΜΕΝΗ.
Ανέφερε ότι το overlay χρησιμοποιεί `worldToScreen()` αλλά αυτό είναι ΛΑΘΟΣ.
Δες **SNAP_INDICATOR_LINE.md** για την σωστή περιγραφή.

**Αρχεία που συμμετέχουν:**

1. **`useCentralizedMouseHandlers.ts`** (γρ. 238, 253):
   - Καλεί `findSnapPoint(worldPos.x, worldPos.y)`
   - Αποθηκεύει `setCurrentSnapResult(snap)`

2. **`CanvasSection.tsx`** (γρ. 917-921):
   - Περνάει `{point: currentSnapResult.snappedPoint, type: ...}` στο overlay

3. **`SnapIndicatorOverlay.tsx`** (γρ. 217-218):
   - Χρησιμοποιεί `point.x` και `point.y` **ΑΠΕΥΘΕΙΑΣ** ως CSS pixels
   - **ΔΕΝ** κάνει worldToScreen() μετατροπή

**Επιβεβαιωμένη Λειτουργικότητα:**
- ✅ Endpoint snap: Ένδειξη ταυτίζεται με άκρο γραμμής
- ✅ Midpoint snap: Ένδειξη ταυτίζεται με μέσο γραμμής
- ✅ Drawing: Νέα γραμμή ξεκινά ακριβώς στο snapped point
- ✅ Click accuracy: Τα άκρα δύο γραμμών ταυτίζονται τέλεια

### Z-Index Hierarchy

```typescript
import { portalComponents } from '@/styles/design-tokens';

// Το snap indicator έχει υψηλό z-index για να είναι πάντα ορατό
style={{ zIndex: portalComponents.overlay.snap.zIndex() }}
```

### Integration Points

| Component | Ρόλος |
|-----------|-------|
| `useCentralizedMouseHandlers.ts` | Καλεί το snap engine σε κάθε mouse move |
| `SnapOrchestrator.ts` | Συντονίζει τα snap engines |
| `EndpointSnapEngine.ts` | Βρίσκει endpoints γραμμών |
| `MidpointSnapEngine.ts` | Βρίσκει midpoints γραμμών |
| `SnapIndicatorOverlay.tsx` | Renders το visual indicator |
| `CoordinateTransforms.ts` | Μετατρέπει world ↔ screen coords |

### Performance Considerations

- Το snap indicator είναι **React component** με minimal re-renders
- Χρησιμοποιεί **CSS transform** για smooth positioning
- **Drop shadow filter** για visibility χωρίς extra DOM elements
- **Pointer-events: none** για να μην εμποδίζει το mouse interaction