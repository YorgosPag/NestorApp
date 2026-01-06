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