# ENTITY CREATION ENTERPRISE ARCHITECTURE

> **Ημερομηνία**: 2026-01-25
> **Έκδοση**: 1.0.0
> **Κατάσταση**: ΣΧΕΔΙΑΣΜΟΣ
> **Συντάκτης**: Claude Code (Anthropic AI)

---

## ΠΕΡΙΕΧΟΜΕΝΑ

1. [Εκτελεστική Περίληψη](#1-εκτελεστική-περίληψη)
2. [Ευρήματα Έρευνας](#2-ευρήματα-έρευνας)
3. [Enterprise Patterns](#3-enterprise-patterns)
4. [Target Architecture](#4-target-architecture)
5. [Φάσεις Υλοποίησης](#5-φάσεις-υλοποίησης)
6. [Migration Guide](#6-migration-guide)
7. [API Reference](#7-api-reference)
8. [Παραρτήματα](#8-παραρτήματα)

---

## 1. ΕΚΤΕΛΕΣΤΙΚΗ ΠΕΡΙΛΗΨΗ

### 1.1 Στόχος
Μετασχηματισμός του Entity Creation System από ad-hoc implementation σε **enterprise-grade architecture** που θα υιοθετούσαν οι Autodesk, Bentley, Dassault, Adobe.

### 1.2 Κύρια Οφέλη
| Όφελος | Περιγραφή |
|--------|-----------|
| **Undo/Redo** | Πλήρης υποστήριξη Ctrl+Z/Ctrl+Y μέσω Command Pattern |
| **Extensibility** | Νέοι τύποι entities χωρίς αλλαγές στον core κώδικα |
| **Testability** | Κάθε component isolated και testable |
| **Maintainability** | Single Responsibility - κάθε module κάνει ένα πράγμα |
| **Predictability** | Formal State Machine - ξεκάθαρες μεταβάσεις |

### 1.3 Χρονοδιάγραμμα
| Φάση | Περιγραφή | Εκτίμηση |
|------|-----------|----------|
| Phase 1 | Consolidation (διπλότυπα) | 2-3 ώρες |
| Phase 2 | Command Pattern | 4-6 ώρες |
| Phase 3 | State Machine | 3-4 ώρες |
| Phase 4 | Entity Registry | 2-3 ώρες |
| **ΣΥΝΟΛΟ** | | **11-16 ώρες** |

---

## 2. ΕΥΡΗΜΑΤΑ ΕΡΕΥΝΑΣ

### 2.1 Τρέχουσα Κατάσταση - Τι Υπάρχει

#### 2.1.1 Drawing Systems
| Σύστημα | Αρχείο | Περιγραφή | Status |
|---------|--------|-----------|--------|
| useDrawingHandlers | `hooks/drawing/useDrawingHandlers.ts` | Mouse event handling + snap | ✅ ACTIVE |
| useUnifiedDrawing | `hooks/drawing/useUnifiedDrawing.tsx` | Entity creation + state | ✅ ACTIVE |
| ~~useEntityCreation (legacy)~~ | ~~`hooks/drawing/useEntityCreation.ts`~~ | ~~Παλιά version~~ | 🗑️ **DELETED (2026-01-25)** |
| useEntityCreation (facade) | `systems/entity-creation/useEntityCreation.ts` | Re-exports useUnifiedDrawing | ✅ ACTIVE |
| DrawingOrchestrator | `systems/drawing-orchestrator/` | Orchestration (σπάνια χρήση) | ⚠️ UNDERUSED |
| EntityCreationSystem | `systems/entity-creation/EntityCreationSystem.tsx` | React Context | ✅ ACTIVE |

#### 2.1.2 Υποστηριζόμενοι Τύποι Entities
| Entity Type | Factory | Renderer | Grips | Status |
|-------------|---------|----------|-------|--------|
| Line | ✅ | LineRenderer | 2 (start, end) | ✅ |
| Polyline | ✅ | PolylineRenderer | N (vertices) | ✅ |
| Polygon | ✅ | PolylineRenderer (closed) | N (vertices) | ✅ |
| Rectangle | ✅ | RectangleRenderer | 4 (corners) | ✅ |
| Circle | ✅ | CircleRenderer | 2 (center, edge) | ✅ |
| Circle (Diameter) | ✅ | CircleRenderer | 2 | ✅ |
| Circle (2P Diameter) | ✅ | CircleRenderer | 2 | ✅ |
| Arc | ✅ | ArcRenderer | 3 | ✅ |
| Ellipse | ✅ | EllipseRenderer | Multiple | ✅ |
| Text | ✅ | TextRenderer | 1 | ✅ |
| Point | ✅ | PointRenderer | 1 | ✅ |

#### 2.1.3 Geometry Utilities (Κεντρικοποιημένα)
| Function | Location | Purpose |
|----------|----------|---------|
| calculateDistance() | geometry-rendering-utils.ts | Απόσταση 2 σημείων |
| calculateAngle() | geometry-rendering-utils.ts | Γωνία σε radians |
| pointToLineDistance() | geometry-utils.ts | Απόσταση σημείου από ευθεία |
| getNearestPointOnLine() | geometry-utils.ts | Κοντινότερο σημείο σε ευθεία |
| isPointInPolygon() | GeometryUtils.ts | Point-in-polygon test |

### 2.2 Εντοπισμένα Προβλήματα

#### 2.2.1 Διπλότυπα (CRITICAL)
```
✅ RESOLVED - ΔΙΠΛΟΤΥΠΟ #1: useEntityCreation (2026-01-25)
├── hooks/drawing/useEntityCreation.ts        ← 🗑️ DELETED (νεκρός κώδικας)
└── systems/entity-creation/useEntityCreation.ts  ← ✅ FACADE (re-exports useUnifiedDrawing)
    → ΛΥΣΗ: Enterprise Facade Pattern - Single Source of Truth

✅ RESOLVED - ΔΙΠΛΟΤΥΠΟ #2: createEntityFromTool() (2026-01-25)
├── useUnifiedDrawing.tsx (inline function)   ← ✅ SINGLE SOURCE OF TRUTH
└── systems/entity-creation/utils.ts          ← 🗑️ DELETED (createEntityFromPoints, createPreviewEntity, validateEntityPoints, κλπ)
    → ΛΥΣΗ: Cleaned 250+ lines of dead code. Only generateEntityId() retained.

ΔΙΠΛΟΤΥΠΟ #3: Preview Styling
├── LineRenderer.applyPreviewStyle()
├── CircleRenderer.applyPreviewStyle()
├── PolylineRenderer.applyPreviewStyle()
└── ... (κάθε renderer ξεχωριστά)
    → ΠΡΟΒΛΗΜΑ: Scattered styling, inconsistency risk.
    → STATUS: ⏳ PENDING (Lower priority - each renderer has specific needs)
```

#### 2.2.2 Αρχιτεκτονικά Κενά
| Gap | Impact | Enterprise Solution |
|-----|--------|---------------------|
| Χωρίς Undo/Redo | 🔴 HIGH | Command Pattern |
| Boolean flags για state | 🟠 MEDIUM | Formal State Machine |
| Switch statements για entity creation | 🟠 MEDIUM | Abstract Factory + Registry |
| Direct function calls | 🟡 LOW | Event-Driven Architecture |
| Hardcoded entity types | 🟠 MEDIUM | Plugin Architecture |

### 2.3 Entity Lifecycle (Τρέχον)
```
USER CLICK
    ↓
useDrawingHandlers.onDrawingPoint()
    ↓
applySnap(point)
    ↓
useUnifiedDrawing.addPoint()
    ↓
tempPoints.push(point)
    ↓
if (isComplete) → createEntityFromTool()
else → updatePreview()
    ↓
setState({ previewEntity })
    ↓
Rendering
    ↓
finishEntity() → Levels → Firestore
```

**ΠΡΟΒΛΗΜΑ**: Δεν υπάρχει Undo capability. Μόλις το entity αποθηκευτεί, χάθηκε.

---

## 3. ENTERPRISE PATTERNS

### 3.1 Command Pattern (Undo/Redo)

#### 3.1.1 Περιγραφή
Το Command Pattern encapsulates κάθε action ως object με `execute()`, `undo()`, `redo()` methods. Αυτό επιτρέπει:
- Undo/Redo stack
- Action logging
- Batch operations
- Macro recording

#### 3.1.2 Reference Implementation (Autodesk Style)
```typescript
// === INTERFACES ===
interface ICommand {
  readonly id: string;
  readonly name: string;
  readonly timestamp: number;
  execute(): void;
  undo(): void;
  redo(): void;
  canMergeWith?(other: ICommand): boolean;
  mergeWith?(other: ICommand): ICommand;
}

interface ICommandHistory {
  execute(command: ICommand): void;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  clear(): void;
  getUndoStack(): readonly ICommand[];
  getRedoStack(): readonly ICommand[];
}

// === IMPLEMENTATION ===
class CreateEntityCommand implements ICommand {
  readonly id = crypto.randomUUID();
  readonly name = 'CreateEntity';
  readonly timestamp = Date.now();

  private entity: Entity | null = null;

  constructor(
    private readonly entityType: EntityType,
    private readonly points: Point2D[],
    private readonly scene: SceneManager
  ) {}

  execute(): void {
    this.entity = EntityFactory.create(this.entityType, this.points);
    this.scene.addEntity(this.entity);
  }

  undo(): void {
    if (this.entity) {
      this.scene.removeEntity(this.entity.id);
    }
  }

  redo(): void {
    if (this.entity) {
      this.scene.addEntity(this.entity);
    }
  }
}

class MoveVertexCommand implements ICommand {
  readonly id = crypto.randomUUID();
  readonly name = 'MoveVertex';
  readonly timestamp = Date.now();

  constructor(
    private readonly entityId: string,
    private readonly vertexIndex: number,
    private readonly oldPosition: Point2D,
    private readonly newPosition: Point2D,
    private readonly scene: SceneManager
  ) {}

  execute(): void {
    this.scene.updateVertex(this.entityId, this.vertexIndex, this.newPosition);
  }

  undo(): void {
    this.scene.updateVertex(this.entityId, this.vertexIndex, this.oldPosition);
  }

  redo(): void {
    this.execute();
  }

  // Merge consecutive moves of same vertex
  canMergeWith(other: ICommand): boolean {
    return other instanceof MoveVertexCommand &&
           other.entityId === this.entityId &&
           other.vertexIndex === this.vertexIndex &&
           (other.timestamp - this.timestamp) < 500; // 500ms threshold
  }

  mergeWith(other: ICommand): ICommand {
    const otherMove = other as MoveVertexCommand;
    return new MoveVertexCommand(
      this.entityId,
      this.vertexIndex,
      this.oldPosition,      // Keep original old position
      otherMove.newPosition, // Use latest new position
      this.scene
    );
  }
}

// === COMMAND HISTORY ===
class CommandHistory implements ICommandHistory {
  private undoStack: ICommand[] = [];
  private redoStack: ICommand[] = [];
  private maxSize = 100;

  execute(command: ICommand): void {
    // Check for merge with last command
    const lastCommand = this.undoStack[this.undoStack.length - 1];
    if (lastCommand?.canMergeWith?.(command)) {
      this.undoStack.pop();
      const merged = lastCommand.mergeWith!(command);
      merged.execute();
      this.undoStack.push(merged);
    } else {
      command.execute();
      this.undoStack.push(command);
    }

    // Clear redo stack on new action
    this.redoStack = [];

    // Trim if over max size
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
  }

  undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) return false;

    command.undo();
    this.redoStack.push(command);
    return true;
  }

  redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) return false;

    command.redo();
    this.undoStack.push(command);
    return true;
  }

  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }
  clear(): void { this.undoStack = []; this.redoStack = []; }
  getUndoStack(): readonly ICommand[] { return this.undoStack; }
  getRedoStack(): readonly ICommand[] { return this.redoStack; }
}
```

### 3.2 State Machine (Drawing States)

#### 3.2.1 Περιγραφή
Formal State Machine αντί για boolean flags. Ξεκάθαρες μεταβάσεις, predictable behavior.

#### 3.2.2 State Diagram
```
                    ┌─────────────┐
                    │    IDLE     │
                    └──────┬──────┘
                           │ SELECT_TOOL
                           ▼
                    ┌─────────────┐
              ┌─────│  TOOL_READY │◄────────────────┐
              │     └──────┬──────┘                 │
              │            │ CLICK (first point)    │
              │            ▼                        │
              │     ┌─────────────┐                 │
              │     │  DRAWING    │◄────┐          │
              │     └──────┬──────┘     │          │
              │            │            │          │
              │     ┌──────┴──────┐     │          │
              │     │             │     │          │
              │     ▼             ▼     │          │
              │  CLICK         MOVE     │          │
              │  (add point)   (preview)│          │
              │     │             │     │          │
              │     └──────┬──────┘     │          │
              │            │            │          │
              │            ▼            │          │
              │     ┌─────────────┐     │          │
              │     │  PREVIEWING │─────┘          │
              │     └──────┬──────┘                │
              │            │ COMPLETE              │
     CANCEL   │            │ (min points reached)  │
     (ESC)    │            ▼                       │
              │     ┌─────────────┐                │
              └────►│  COMPLETING │                │
                    └──────┬──────┘                │
                           │ ENTITY_CREATED        │
                           ▼                       │
                    ┌─────────────┐                │
                    │  FINISHED   │────────────────┘
                    └─────────────┘    (auto-reset or continue)
```

#### 3.2.3 Reference Implementation
```typescript
// === STATE TYPES ===
type DrawingState =
  | 'idle'
  | 'tool_ready'
  | 'drawing'
  | 'previewing'
  | 'completing'
  | 'finished';

type DrawingEvent =
  | { type: 'SELECT_TOOL'; tool: DrawingTool }
  | { type: 'CLICK'; point: Point2D }
  | { type: 'MOVE'; point: Point2D }
  | { type: 'COMPLETE' }
  | { type: 'CANCEL' }
  | { type: 'RESET' };

interface DrawingContext {
  tool: DrawingTool | null;
  points: Point2D[];
  previewEntity: Entity | null;
  snapPoint: Point2D | null;
}

// === STATE MACHINE ===
class DrawingStateMachine {
  private state: DrawingState = 'idle';
  private context: DrawingContext = {
    tool: null,
    points: [],
    previewEntity: null,
    snapPoint: null,
  };

  private listeners: Set<(state: DrawingState, context: DrawingContext) => void> = new Set();

  getState(): DrawingState { return this.state; }
  getContext(): DrawingContext { return { ...this.context }; }

  subscribe(listener: (state: DrawingState, context: DrawingContext) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(l => l(this.state, this.context));
  }

  private transition(newState: DrawingState, contextUpdate?: Partial<DrawingContext>): void {
    console.log(`[FSM] ${this.state} → ${newState}`, contextUpdate);
    this.state = newState;
    if (contextUpdate) {
      this.context = { ...this.context, ...contextUpdate };
    }
    this.notify();
  }

  dispatch(event: DrawingEvent): void {
    switch (this.state) {
      case 'idle':
        if (event.type === 'SELECT_TOOL') {
          this.transition('tool_ready', { tool: event.tool, points: [] });
        }
        break;

      case 'tool_ready':
        if (event.type === 'CLICK') {
          this.transition('drawing', {
            points: [event.point]
          });
        } else if (event.type === 'CANCEL') {
          this.transition('idle', { tool: null });
        }
        break;

      case 'drawing':
        if (event.type === 'CLICK') {
          const newPoints = [...this.context.points, event.point];
          const minPoints = this.getMinPoints(this.context.tool!);

          if (newPoints.length >= minPoints) {
            this.transition('previewing', { points: newPoints });
          } else {
            this.transition('drawing', { points: newPoints });
          }
        } else if (event.type === 'MOVE') {
          // Update preview
          this.context.snapPoint = event.point;
          this.notify();
        } else if (event.type === 'CANCEL') {
          this.transition('tool_ready', { points: [] });
        }
        break;

      case 'previewing':
        if (event.type === 'CLICK') {
          // Add more points if tool allows
          const newPoints = [...this.context.points, event.point];
          this.transition('previewing', { points: newPoints });
        } else if (event.type === 'COMPLETE') {
          this.transition('completing');
        } else if (event.type === 'MOVE') {
          this.context.snapPoint = event.point;
          this.notify();
        } else if (event.type === 'CANCEL') {
          this.transition('tool_ready', { points: [] });
        }
        break;

      case 'completing':
        // Entity creation happens here (via Command)
        this.transition('finished');
        break;

      case 'finished':
        if (event.type === 'RESET') {
          this.transition('tool_ready', { points: [] });
        }
        break;
    }
  }

  private getMinPoints(tool: DrawingTool): number {
    const minPointsMap: Record<DrawingTool, number> = {
      'line': 2,
      'circle': 2,
      'rectangle': 2,
      'polyline': 2,
      'polygon': 3,
      'arc': 3,
      // ... more tools
    };
    return minPointsMap[tool] ?? 2;
  }
}
```

### 3.3 Entity Registry (Plugin Architecture)

#### 3.3.1 Περιγραφή
Registry pattern για entity types. Νέοι τύποι μπορούν να προστεθούν χωρίς αλλαγές στον core κώδικα.

#### 3.3.2 Reference Implementation
```typescript
// === INTERFACES ===
interface IEntityFactory {
  readonly type: EntityType;
  readonly minPoints: number;
  readonly maxPoints: number | null; // null = unlimited
  readonly displayName: string;
  readonly icon: string;

  create(points: Point2D[], options?: EntityOptions): Entity;
  createPreview(points: Point2D[], cursorPoint: Point2D): Entity | null;
  validate(points: Point2D[]): ValidationResult;
  getGripPositions(entity: Entity): GripPosition[];
}

interface IEntityRegistry {
  register(factory: IEntityFactory): void;
  unregister(type: EntityType): void;
  get(type: EntityType): IEntityFactory | undefined;
  getAll(): IEntityFactory[];
  has(type: EntityType): boolean;
  create(type: EntityType, points: Point2D[], options?: EntityOptions): Entity;
}

// === IMPLEMENTATION ===
class EntityRegistry implements IEntityRegistry {
  private factories = new Map<EntityType, IEntityFactory>();

  register(factory: IEntityFactory): void {
    if (this.factories.has(factory.type)) {
      console.warn(`[EntityRegistry] Overwriting factory for ${factory.type}`);
    }
    this.factories.set(factory.type, factory);
    console.log(`[EntityRegistry] Registered: ${factory.type}`);
  }

  unregister(type: EntityType): void {
    this.factories.delete(type);
  }

  get(type: EntityType): IEntityFactory | undefined {
    return this.factories.get(type);
  }

  getAll(): IEntityFactory[] {
    return Array.from(this.factories.values());
  }

  has(type: EntityType): boolean {
    return this.factories.has(type);
  }

  create(type: EntityType, points: Point2D[], options?: EntityOptions): Entity {
    const factory = this.factories.get(type);
    if (!factory) {
      throw new Error(`[EntityRegistry] No factory registered for type: ${type}`);
    }

    const validation = factory.validate(points);
    if (!validation.valid) {
      throw new Error(`[EntityRegistry] Invalid points: ${validation.error}`);
    }

    return factory.create(points, options);
  }
}

// === FACTORY IMPLEMENTATIONS ===
class LineFactory implements IEntityFactory {
  readonly type = 'line' as EntityType;
  readonly minPoints = 2;
  readonly maxPoints = 2;
  readonly displayName = 'Line';
  readonly icon = 'line-icon';

  create(points: Point2D[], options?: EntityOptions): LineEntity {
    return {
      id: generateEntityId(),
      type: 'line',
      start: points[0],
      end: points[1],
      layer: options?.layer ?? '0',
      color: options?.color ?? '#ffffff',
      lineweight: options?.lineweight ?? 1,
      visible: true,
    };
  }

  createPreview(points: Point2D[], cursorPoint: Point2D): LineEntity | null {
    if (points.length < 1) return null;
    return this.create([points[0], cursorPoint], { color: '#00ff00' });
  }

  validate(points: Point2D[]): ValidationResult {
    if (points.length !== 2) {
      return { valid: false, error: 'Line requires exactly 2 points' };
    }
    if (pointsEqual(points[0], points[1])) {
      return { valid: false, error: 'Line start and end cannot be the same' };
    }
    return { valid: true };
  }

  getGripPositions(entity: LineEntity): GripPosition[] {
    return [
      { type: 'start', position: entity.start },
      { type: 'end', position: entity.end },
      { type: 'midpoint', position: midpoint(entity.start, entity.end) },
    ];
  }
}

class CircleFactory implements IEntityFactory {
  readonly type = 'circle' as EntityType;
  readonly minPoints = 2;
  readonly maxPoints = 2;
  readonly displayName = 'Circle';
  readonly icon = 'circle-icon';

  create(points: Point2D[], options?: EntityOptions): CircleEntity {
    const center = points[0];
    const edgePoint = points[1];
    const radius = calculateDistance(center, edgePoint);

    return {
      id: generateEntityId(),
      type: 'circle',
      center,
      radius,
      layer: options?.layer ?? '0',
      color: options?.color ?? '#ffffff',
      lineweight: options?.lineweight ?? 1,
      visible: true,
    };
  }

  createPreview(points: Point2D[], cursorPoint: Point2D): CircleEntity | null {
    if (points.length < 1) return null;
    return this.create([points[0], cursorPoint], { color: '#00ff00' });
  }

  validate(points: Point2D[]): ValidationResult {
    if (points.length !== 2) {
      return { valid: false, error: 'Circle requires center and edge point' };
    }
    if (pointsEqual(points[0], points[1])) {
      return { valid: false, error: 'Circle radius cannot be zero' };
    }
    return { valid: true };
  }

  getGripPositions(entity: CircleEntity): GripPosition[] {
    return [
      { type: 'center', position: entity.center },
      { type: 'quadrant', position: { x: entity.center.x + entity.radius, y: entity.center.y } },
      { type: 'quadrant', position: { x: entity.center.x - entity.radius, y: entity.center.y } },
      { type: 'quadrant', position: { x: entity.center.x, y: entity.center.y + entity.radius } },
      { type: 'quadrant', position: { x: entity.center.x, y: entity.center.y - entity.radius } },
    ];
  }
}

// === PLUGIN EXAMPLE ===
// Ένα plugin μπορεί να προσθέσει νέο entity type:
class StarFactory implements IEntityFactory {
  readonly type = 'star' as EntityType;
  readonly minPoints = 2;
  readonly maxPoints = 2;
  readonly displayName = 'Star';
  readonly icon = 'star-icon';

  create(points: Point2D[], options?: EntityOptions): Entity {
    // Create star from center and outer point
    // ...
  }
  // ...
}

// Register plugin entity type:
entityRegistry.register(new StarFactory());
```

### 3.4 Event-Driven Architecture

#### 3.4.1 Περιγραφή
Decoupled communication μέσω events αντί για direct function calls.

#### 3.4.2 Reference Implementation
```typescript
// === EVENT TYPES ===
type EntityEvent =
  | { type: 'entity:creating'; entityType: EntityType; points: Point2D[] }
  | { type: 'entity:created'; entity: Entity }
  | { type: 'entity:deleted'; entityId: string }
  | { type: 'entity:modified'; entityId: string; changes: Partial<Entity> }
  | { type: 'vertex:moved'; entityId: string; vertexIndex: number; position: Point2D }
  | { type: 'vertex:added'; entityId: string; insertIndex: number; position: Point2D }
  | { type: 'vertex:removed'; entityId: string; vertexIndex: number };

type DrawingEvent =
  | { type: 'drawing:started'; tool: DrawingTool }
  | { type: 'drawing:point_added'; point: Point2D }
  | { type: 'drawing:preview_updated'; previewEntity: Entity | null }
  | { type: 'drawing:completed'; entity: Entity }
  | { type: 'drawing:cancelled' };

// === EVENT BUS ===
class EntityEventBus {
  private handlers = new Map<string, Set<(event: EntityEvent | DrawingEvent) => void>>();

  on<T extends EntityEvent | DrawingEvent>(
    eventType: T['type'],
    handler: (event: T) => void
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler as (event: EntityEvent | DrawingEvent) => void);

    // Return unsubscribe function
    return () => this.handlers.get(eventType)?.delete(handler as (event: EntityEvent | DrawingEvent) => void);
  }

  emit<T extends EntityEvent | DrawingEvent>(event: T): void {
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error(`[EventBus] Error in handler for ${event.type}:`, error);
        }
      });
    }
  }
}

// === USAGE ===
const eventBus = new EntityEventBus();

// Subscribe to events
eventBus.on('entity:created', (event) => {
  console.log('Entity created:', event.entity.id);
  // Update UI, persist to Firestore, etc.
});

eventBus.on('vertex:moved', (event) => {
  console.log(`Vertex ${event.vertexIndex} moved to`, event.position);
  // Create Command for undo/redo
});

// Emit events
eventBus.emit({ type: 'entity:created', entity: newEntity });
```

---

## 4. TARGET ARCHITECTURE

### 4.1 Architectural Overview
```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │  DxfCanvas   │  │ LayerCanvas  │  │   Toolbar    │                   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                   │
│         │                 │                 │                           │
│         └─────────────────┴─────────────────┘                           │
│                           │                                             │
├───────────────────────────┼─────────────────────────────────────────────┤
│                    EVENT BUS LAYER                                       │
│  ┌────────────────────────┼────────────────────────────────────────┐    │
│  │              EntityEventBus (pub/sub)                           │    │
│  └────────────────────────┼────────────────────────────────────────┘    │
│                           │                                             │
├───────────────────────────┼─────────────────────────────────────────────┤
│                    APPLICATION LAYER                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │   Drawing    │  │   Command    │  │    Entity    │                   │
│  │ StateMachine │  │   History    │  │   Registry   │                   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                   │
│         │                 │                 │                           │
│         └─────────────────┴─────────────────┘                           │
│                           │                                             │
├───────────────────────────┼─────────────────────────────────────────────┤
│                     DOMAIN LAYER                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │   Commands   │  │   Entities   │  │   Geometry   │                   │
│  │  (Create,    │  │  (Line,      │  │   Utils      │                   │
│  │   Move,...)  │  │   Circle..)  │  │              │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                  INFRASTRUCTURE LAYER                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │  Firestore   │  │   Levels     │  │    Snap      │                   │
│  │  Persistence │  │   System     │  │   Engine     │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Directory Structure (Target)
```
src/subapps/dxf-viewer/
├── core/                           # 🆕 NEW - Core Enterprise Systems
│   ├── commands/                   # Command Pattern implementation
│   │   ├── interfaces.ts           # ICommand, ICommandHistory
│   │   ├── CommandHistory.ts       # Undo/Redo stack
│   │   ├── entity-commands/
│   │   │   ├── CreateEntityCommand.ts
│   │   │   ├── DeleteEntityCommand.ts
│   │   │   ├── MoveEntityCommand.ts
│   │   │   └── index.ts
│   │   ├── vertex-commands/
│   │   │   ├── MoveVertexCommand.ts
│   │   │   ├── AddVertexCommand.ts
│   │   │   ├── RemoveVertexCommand.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   │
│   ├── state-machine/              # Drawing State Machine
│   │   ├── interfaces.ts           # State, Event, Context types
│   │   ├── DrawingStateMachine.ts  # FSM implementation
│   │   ├── useDrawingMachine.ts    # React hook wrapper
│   │   └── index.ts
│   │
│   ├── entity-registry/            # Entity Factory Registry
│   │   ├── interfaces.ts           # IEntityFactory, IEntityRegistry
│   │   ├── EntityRegistry.ts       # Registry implementation
│   │   ├── factories/              # Built-in factories
│   │   │   ├── LineFactory.ts
│   │   │   ├── CircleFactory.ts
│   │   │   ├── PolylineFactory.ts
│   │   │   ├── RectangleFactory.ts
│   │   │   ├── ArcFactory.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   │
│   └── events/                     # Event-Driven Architecture
│       ├── interfaces.ts           # Event types
│       ├── EntityEventBus.ts       # Event bus implementation
│       └── index.ts
│
├── systems/                        # Existing systems (refactored)
│   ├── entity-creation/            # REFACTORED - uses core/
│   ├── grip-interaction/           # Already good
│   └── ...
│
├── hooks/                          # React hooks
│   ├── drawing/                    # REFACTORED - uses core/
│   │   ├── useDrawingSystem.ts     # 🆕 NEW - replaces useUnifiedDrawing
│   │   └── useCommandHistory.ts    # 🆕 NEW - Undo/Redo hook
│   └── ...
│
└── docs/
    └── ENTITY_CREATION_ENTERPRISE_ARCHITECTURE.md  # This file
```

---

## 5. ΦΑΣΕΙΣ ΥΛΟΠΟΙΗΣΗΣ

### Phase 1: Consolidation (ΠΡΟΑΠΑΙΤΟΥΜΕΝΟ)
**Στόχος**: Εξάλειψη διπλοτύπων, καθαρή βάση για enterprise patterns

| Task | Περιγραφή | Εκτίμηση |
|------|-----------|----------|
| 1.1 | Merge `useEntityCreation` (hooks/ + systems/) → single source | 45min |
| 1.2 | Extract `createEntityFromTool()` → `systems/entity-creation/factories.ts` | 30min |
| 1.3 | Create `PreviewStyleManager` για centralized preview styling | 45min |
| 1.4 | Remove legacy/dead code | 30min |

**Deliverables**:
- Single `useEntityCreation` hook
- Centralized entity factory
- Centralized preview styling
- Clean codebase

---

### Phase 2: Command Pattern (UNDO/REDO) - 🏢 FEATURE-COMPLETE
**Στόχος**: Πλήρης υποστήριξη Ctrl+Z / Ctrl+Y με Enterprise Features

| Task | Περιγραφή | Status |
|------|-----------|--------|
| 2.1 | Create `core/commands/interfaces.ts` | ✅ DONE (300+ lines) |
| 2.2 | Implement `CommandHistory.ts` | ✅ DONE |
| 2.3 | Create `CreateEntityCommand.ts` | ✅ DONE |
| 2.4 | Create `DeleteEntityCommand.ts` | ✅ DONE |
| 2.5 | Create `MoveVertexCommand.ts` | ✅ DONE (with merge) |
| 2.6 | Create `AddVertexCommand.ts` | ✅ DONE |
| 2.7 | Create `RemoveVertexCommand.ts` | ✅ DONE |
| 2.8 | Create `useCommandHistory.ts` React hook | ✅ DONE |
| 2.9 | Integrate with keyboard shortcuts (Ctrl+Z/Y) | ✅ DONE |
| 2.10 | **🏢 ENTERPRISE: CompoundCommand.ts** | ✅ DONE (batch/transaction) |
| 2.11 | **🏢 ENTERPRISE: AuditTrail.ts** | ✅ DONE (SAP/Salesforce compliance) |
| 2.12 | **🏢 ENTERPRISE: CommandPersistence.ts** | ✅ DONE (IndexedDB/localStorage) |
| 2.13 | **🏢 ENTERPRISE: CommandRegistry.ts** | ✅ DONE (deserialization) |

**Enterprise Features Added (SAP/Salesforce/Autodesk-grade)**:
- ✅ **Serialization**: All commands serializable for session restore
- ✅ **Compound Commands**: Batch operations with atomic rollback
- ✅ **Audit Trail**: Full logging for compliance (export JSON/CSV)
- ✅ **Persistence**: IndexedDB (primary) + localStorage (fallback)
- ✅ **Command Registry**: Plugin architecture for custom commands
- ✅ **Transaction Support**: Auto-rollback on failure

**Created Files** (2026-01-25):
```
src/subapps/dxf-viewer/core/
├── index.ts
└── commands/
    ├── index.ts                      # Public API
    ├── interfaces.ts                 # 🏢 300+ lines - full enterprise types
    ├── CommandHistory.ts             # Undo/Redo stack
    ├── CompoundCommand.ts            # 🏢 Batch operations
    ├── AuditTrail.ts                 # 🏢 Compliance logging
    ├── CommandPersistence.ts         # 🏢 IndexedDB/localStorage
    ├── CommandRegistry.ts            # 🏢 Deserialization
    ├── useCommandHistory.ts          # React hook
    ├── entity-commands/
    │   ├── index.ts
    │   ├── CreateEntityCommand.ts
    │   └── DeleteEntityCommand.ts
    └── vertex-commands/
        ├── index.ts
        ├── MoveVertexCommand.ts      # With merge support
        ├── AddVertexCommand.ts
        └── RemoveVertexCommand.ts
```

**Deliverables**:
- ✅ Full Undo/Redo capability (Ctrl+Z/Ctrl+Y)
- ✅ All entity operations as Commands
- ✅ Keyboard shortcut integration
- ✅ Merge support for consecutive moves (500ms window)
- ✅ **🏢 Session restore via IndexedDB**
- ✅ **🏢 Audit trail for compliance**
- ✅ **🏢 Batch operations with rollback**

---

### Phase 3: State Machine (DRAWING STATES)
**Στόχος**: Formal FSM αντί για boolean flags

| Task | Περιγραφή | Εκτίμηση |
|------|-----------|----------|
| 3.1 | Create `core/state-machine/interfaces.ts` | 30min |
| 3.2 | Implement `DrawingStateMachine.ts` | 1.5h |
| 3.3 | Create `useDrawingMachine.ts` React hook | 30min |
| 3.4 | Migrate `useUnifiedDrawing` → use state machine | 1h |
| 3.5 | Update all drawing tools to use FSM | 30min |
| 3.6 | Testing & debugging | 30min |

**Deliverables**:
- Formal state machine
- Predictable state transitions
- Debug-friendly state logging
- Removal of boolean flags

---

### Phase 4: Entity Registry (PLUGIN ARCHITECTURE)
**Στόχος**: Extensible entity system

| Task | Περιγραφή | Εκτίμηση |
|------|-----------|----------|
| 4.1 | Create `core/entity-registry/interfaces.ts` | 30min |
| 4.2 | Implement `EntityRegistry.ts` | 45min |
| 4.3 | Create `LineFactory.ts` | 20min |
| 4.4 | Create `CircleFactory.ts` | 20min |
| 4.5 | Create `PolylineFactory.ts` | 20min |
| 4.6 | Create `RectangleFactory.ts` | 20min |
| 4.7 | Create `ArcFactory.ts` | 20min |
| 4.8 | Migrate existing code to use Registry | 30min |
| 4.9 | Documentation for plugin developers | 30min |

**Deliverables**:
- Entity Registry με factory pattern
- All built-in entity types as factories
- Plugin documentation
- Example custom entity type

---

### Phase 5: Event-Driven Architecture (OPTIONAL)
**Στόχος**: Decoupled component communication

| Task | Περιγραφή | Εκτίμηση |
|------|-----------|----------|
| 5.1 | Create `core/events/interfaces.ts` | 20min |
| 5.2 | Implement `EntityEventBus.ts` | 45min |
| 5.3 | Migrate entity operations to emit events | 1h |
| 5.4 | Create event logging/debugging tools | 30min |

**Deliverables**:
- Entity Event Bus
- All entity operations emit events
- Event debugging tools

---

## 6. MIGRATION GUIDE

### 6.1 Backwards Compatibility Strategy
```
ΚΑΝΟΝΑΣ: Κάθε phase πρέπει να είναι backwards compatible.
         Δεν σπάμε existing functionality.

Approach:
1. Create new system alongside old
2. Gradually migrate usage
3. Deprecate old system
4. Remove old system (after testing)
```

### 6.2 Phase 1 Migration (Consolidation)

#### Before:
```typescript
// File A: hooks/drawing/useEntityCreation.ts
export function useEntityCreation() { ... }

// File B: systems/entity-creation/useEntityCreation.ts
export function useEntityCreation() { ... }

// Usage varies - inconsistent
import { useEntityCreation } from '../../hooks/drawing/useEntityCreation';
import { useEntityCreation } from '../../systems/entity-creation/useEntityCreation';
```

#### After:
```typescript
// SINGLE SOURCE: systems/entity-creation/useEntityCreation.ts
export function useEntityCreation() { ... }

// Re-export for backwards compatibility:
// hooks/drawing/useEntityCreation.ts
export { useEntityCreation } from '../../systems/entity-creation/useEntityCreation';

// CONSISTENT USAGE:
import { useEntityCreation } from '@/subapps/dxf-viewer/systems/entity-creation';
```

### 6.3 Phase 2 Migration (Commands)

#### Before:
```typescript
// Direct mutation
const handleVertexMove = (entityId: string, vertexIndex: number, newPos: Point2D) => {
  overlayStore.updateVertex(entityId, vertexIndex, [newPos.x, newPos.y]);
  // NO UNDO POSSIBLE
};
```

#### After:
```typescript
// Command-based
const handleVertexMove = (entityId: string, vertexIndex: number, oldPos: Point2D, newPos: Point2D) => {
  const command = new MoveVertexCommand(entityId, vertexIndex, oldPos, newPos, overlayStore);
  commandHistory.execute(command);
  // UNDO: commandHistory.undo() or Ctrl+Z
};
```

### 6.4 Phase 3 Migration (State Machine)

#### Before:
```typescript
// Boolean flags
const [isDrawing, setIsDrawing] = useState(false);
const [tempPoints, setTempPoints] = useState<Point2D[]>([]);
const [previewEntity, setPreviewEntity] = useState<Entity | null>(null);

// Complex conditions
if (isDrawing && tempPoints.length >= 2 && activeTool === 'line') {
  // ...
}
```

#### After:
```typescript
// State machine
const { state, context, dispatch } = useDrawingMachine();

// Clear state checks
if (state === 'previewing' && context.tool === 'line') {
  // ...
}

// Clear transitions
dispatch({ type: 'CLICK', point: snappedPoint });
dispatch({ type: 'COMPLETE' });
```

### 6.5 Phase 4 Migration (Registry)

#### Before:
```typescript
// Switch statement
function createEntityFromTool(tool: DrawingTool, points: Point2D[]): Entity {
  switch (tool) {
    case 'line':
      return { type: 'line', start: points[0], end: points[1], ... };
    case 'circle':
      return { type: 'circle', center: points[0], radius: ..., ... };
    // 20+ more cases
  }
}
```

#### After:
```typescript
// Registry-based
const entity = entityRegistry.create(tool, points, options);

// Adding new entity type (plugin):
entityRegistry.register(new CustomShapeFactory());
```

---

## 7. API REFERENCE

### 7.1 Command API
```typescript
// Create and execute command
const command = new CreateEntityCommand('line', points, scene);
commandHistory.execute(command);

// Undo/Redo
commandHistory.undo();  // or Ctrl+Z
commandHistory.redo();  // or Ctrl+Y

// Check status
commandHistory.canUndo(); // boolean
commandHistory.canRedo(); // boolean
```

### 7.2 State Machine API
```typescript
// Initialize
const machine = useDrawingMachine();

// Dispatch events
machine.dispatch({ type: 'SELECT_TOOL', tool: 'line' });
machine.dispatch({ type: 'CLICK', point: { x: 100, y: 100 } });
machine.dispatch({ type: 'COMPLETE' });
machine.dispatch({ type: 'CANCEL' });

// Read state
machine.state;    // 'idle' | 'tool_ready' | 'drawing' | ...
machine.context;  // { tool, points, previewEntity, snapPoint }
```

### 7.3 Entity Registry API
```typescript
// Create entity
const line = entityRegistry.create('line', [p1, p2]);

// Register custom factory
entityRegistry.register(new CustomShapeFactory());

// Get factory info
const factory = entityRegistry.get('line');
factory.minPoints;    // 2
factory.maxPoints;    // 2
factory.displayName;  // 'Line'
```

### 7.4 Event Bus API
```typescript
// Subscribe
const unsubscribe = eventBus.on('entity:created', (event) => {
  console.log('New entity:', event.entity);
});

// Emit
eventBus.emit({ type: 'entity:created', entity: newEntity });

// Cleanup
unsubscribe();
```

---

## 8. ΠΑΡΑΡΤΗΜΑΤΑ

### 8.1 Εταιρείες που χρησιμοποιούν αυτά τα Patterns

| Company | Product | Command Pattern | State Machine | Registry | Event-Driven |
|---------|---------|-----------------|---------------|----------|--------------|
| **Autodesk** | AutoCAD | ✅ | ✅ | ✅ | ✅ |
| **Autodesk** | Revit | ✅ | ✅ | ✅ | ✅ |
| **Bentley** | MicroStation | ✅ | ✅ | ✅ | ✅ |
| **Dassault** | SolidWorks | ✅ | ✅ | ✅ | ✅ |
| **Adobe** | Illustrator | ✅ | ✅ | ✅ | ✅ |
| **Adobe** | Photoshop | ✅ | ✅ | ✅ | ✅ |
| **Figma** | Figma | ✅ | ✅ | ✅ | ✅ |
| **Sketch** | Sketch | ✅ | ✅ | ✅ | ✅ |

### 8.2 Design Pattern References

| Pattern | Book/Source | Chapter |
|---------|-------------|---------|
| Command | GoF Design Patterns | Chapter 5 |
| State | GoF Design Patterns | Chapter 5 |
| Abstract Factory | GoF Design Patterns | Chapter 3 |
| Registry | Fowler's PoEAA | - |
| Event-Driven | Enterprise Integration Patterns | - |

### 8.3 Testing Strategy
```
Unit Tests:
- Each Command (execute, undo, redo, merge)
- State Machine transitions
- Entity Factory validation
- Event Bus pub/sub

Integration Tests:
- Full drawing workflow
- Undo/Redo sequences
- Plugin registration

E2E Tests:
- User creates entity
- User undoes action
- User uses custom entity type
```

### 8.4 Performance Considerations
```
Command History:
- Max 100 commands (configurable)
- Merge consecutive moves (500ms threshold)
- Lazy serialization for persistence

State Machine:
- Minimal state copies
- Immutable context updates
- Efficient listener notification

Entity Registry:
- O(1) factory lookup
- Lazy factory instantiation
- Cached validation results
```

---

## CHANGELOG

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-25 | 1.0.0 | Initial document creation |
| 2026-01-25 | 1.1.0 | ✅ Phase 1.1 COMPLETE: Deleted legacy `hooks/drawing/useEntityCreation.ts` (dead code). Enterprise Facade Pattern implemented. |
| 2026-01-25 | 1.2.0 | ✅ Phase 1.2 COMPLETE: Cleaned `utils.ts` - removed 250+ lines of dead code (createEntityFromPoints, duplicate types, unused utilities). Only `generateEntityId()` retained. Single Source of Truth: `useUnifiedDrawing.tsx`. |
| 2026-01-25 | 2.0.0 | ✅ Phase 2 COMPLETE: **Feature-Complete Command Pattern**. Created 13 files in `core/commands/`. Enterprise features: Serialization, CompoundCommand, AuditTrail, Persistence (IndexedDB), CommandRegistry. SAP/Salesforce/Autodesk-grade. |

---

**Document End**

> *"The best architectures are those that are invisible - they just work."*
> — Robert C. Martin (Uncle Bob)
