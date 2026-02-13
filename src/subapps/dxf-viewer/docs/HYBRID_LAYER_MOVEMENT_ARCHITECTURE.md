# HYBRID LAYER MOVEMENT ARCHITECTURE

> **Ημερομηνία**: 2026-01-25
> **Έκδοση**: 2.0.0
> **Κατάσταση**: ✅ ΟΛΟΚΛΗΡΩΘΗΚΕ
> **Συντάκτης**: Claude Code (Anthropic AI)

---

## ΠΕΡΙΕΧΟΜΕΝΑ

1. [Εκτελεστική Περίληψη](#1-εκτελεστική-περίληψη)
2. [Ευρήματα Έρευνας](#2-ευρήματα-έρευνας)
3. [Enterprise Analysis](#3-enterprise-analysis)
4. [Target Architecture](#4-target-architecture)
5. [Φάσεις Υλοποίησης](#5-φάσεις-υλοποίησης)
6. [API Reference](#6-api-reference)
7. [Migration Guide](#7-migration-guide)
8. [Testing Strategy](#8-testing-strategy)

---

## 1. ΕΚΤΕΛΕΣΤΙΚΗ ΠΕΡΙΛΗΨΗ

### 1.1 Στόχος
Υλοποίηση **υβριδικού συστήματος μετακίνησης layers/entities** που θα ακολουθεί τα enterprise standards των Autodesk, Adobe, Figma. Ο χρήστης θα μπορεί να μετακινεί entities με πολλαπλούς τρόπους:

| Μέθοδος | Περιγραφή |
|---------|-----------|
| **Layer Panel Click** | Click στο layer → επιλέγει όλα τα entities |
| **Window Selection** | Drag rectangle (left→right) → επιλέγει entities μέσα |
| **Crossing Selection** | Drag rectangle (right→left) → επιλέγει entities που αγγίζουν |
| **Keyboard Shortcuts** | Ctrl+A, M for Move, Arrow keys for nudge |
| **Direct Drag** | Drag επιλεγμένα entities |

### 1.2 Κύρια Οφέλη
| Όφελος | Περιγραφή |
|--------|-----------|
| **Undo/Redo** | Πλήρης υποστήριξη Ctrl+Z/Ctrl+Y μέσω MoveEntityCommand |
| **Multiple Selection Methods** | Ο χρήστης διαλέγει τη μέθοδο που του ταιριάζει |
| **Enterprise Patterns** | Command Pattern, Centralized Shortcuts, Type Safety |
| **CAD Standard** | Window/Crossing selection όπως AutoCAD |
| **Precision** | Arrow keys για ακριβές nudge, snap support |

### 1.3 Πρόοδος Υλοποίησης
| Φάση | Περιγραφή | Status | Ημερομηνία |
|------|-----------|--------|------------|
| Phase 1 | MoveEntityCommand (Foundation) | ✅ COMPLETE | 2026-01-25 |
| Phase 2 | Selection Enhancements (Ctrl+A, Layer click) | ✅ COMPLETE | 2026-01-25 |
| Phase 3 | Movement Methods (Drag, Nudge, Move tool) | ✅ COMPLETE | 2026-01-25 |
| Phase 4 | Integration & Polish | ✅ COMPLETE | 2026-01-25 |

### 1.4 Implementation Statistics
| Metric | Value |
|--------|-------|
| Total New Files | 8 |
| Total Lines of Code | ~2,500+ |
| New Hooks | 5 (useMoveEntities, useEnhancedSelection, useEntityDrag, useMovementOperations, useGripMovement) |
| New Commands | 2 (MoveEntityCommand, MoveMultipleEntitiesCommand) |
| Rendering Utilities | 1 (ghost-entity-renderer) |
| Enterprise Patterns Used | Command, Facade, Bridge, Observer, Strategy |

---

## 2. ΕΥΡΗΜΑΤΑ ΕΡΕΥΝΑΣ

### 2.1 Τρέχουσα Κατάσταση - Τι Υπάρχει

#### 2.1.1 Selection System ✅ 70% Complete
**Location**: `src/subapps/dxf-viewer/systems/selection/`

| Αρχείο | Περιγραφή | Status |
|--------|-----------|--------|
| `SelectionSystem.tsx` | Context provider + useSelection() hook | ✅ ACTIVE |
| `useSelectionSystemState.ts` | State management με reducer | ✅ ACTIVE |
| `useSelectionActions.ts` | Selection actions (selectRegions, clearSelection, toggleSelection) | ✅ ACTIVE |
| `UniversalMarqueeSelection.ts` | Window/Crossing selection class | ✅ ACTIVE |
| `SelectionRenderer.ts` | Rendering του selection box | ✅ ACTIVE |
| `useFilterActions.ts` | Filter actions | ✅ ACTIVE |
| `useViewActions.ts` | View actions | ✅ ACTIVE |

**Υπάρχουσες Capabilities:**
- ✅ Single selection
- ✅ Multi-selection
- ✅ Selection by region
- ✅ Toggle selection
- ✅ Clear selection
- ✅ Window vs Crossing selection (AutoCAD pattern)
- ✅ Tolerance support (default 5px)

**Τι Λείπει:**
- ❌ Select All (Ctrl+A)
- ❌ Select by Layer
- ❌ Invert Selection
- ❌ Select by properties (color, type)

#### 2.1.2 Command System ✅ Complete (Commands module)
**Location**: `src/subapps/dxf-viewer/core/commands/`

| Αρχείο | Περιγραφή | Status |
|--------|-----------|--------|
| `interfaces.ts` | ICommand, ICommandHistory interfaces | ✅ ACTIVE |
| `CommandHistory.ts` | Undo/redo stack με merging | ✅ ACTIVE |
| `CreateEntityCommand.ts` | Create entities με undo | ✅ ACTIVE |
| `DeleteEntityCommand.ts` | Delete entities με undo | ✅ ACTIVE |
| `MoveVertexCommand.ts` | Move individual vertices | ✅ ACTIVE |
| `AddVertexCommand.ts` | Add vertices | ✅ ACTIVE |
| `RemoveVertexCommand.ts` | Remove vertices | ✅ ACTIVE |
| `CompoundCommand.ts` | Batch commands | ✅ ACTIVE |
| `AuditTrail.ts` | Command history logging | ✅ ACTIVE |
| `CommandPersistence.ts` | IndexedDB persistence | ✅ ACTIVE |
| `CommandRegistry.ts` | Command type registry | ✅ ACTIVE |
| `useCommandHistory.ts` | React hook | ✅ ACTIVE |

**Τι Λείπει:**
- ❌ **MoveEntityCommand** - Κλειδί για μετακίνηση entities
- ❌ RotateEntityCommand
- ❌ ScaleEntityCommand
- ❌ CopyEntityCommand

#### 2.1.3 Keyboard Shortcuts ✅ Centralized
**Location**: `src/subapps/dxf-viewer/config/keyboard-shortcuts.ts`

**Single Source of Truth** - Όλα τα shortcuts ορίζονται σε ένα αρχείο.

**Υπάρχοντα Shortcuts:**
```typescript
// Tool shortcuts
{ key: 'S', tool: 'select' }
{ key: 'P', tool: 'pan' }
{ key: 'L', tool: 'line' }
// etc.

// Action shortcuts
{ key: 'Delete', action: 'deleteOverlay' }
{ key: 'Escape', action: 'closeMenu' }

// Zoom shortcuts
{ key: '+', action: 'zoomIn' }
{ key: '-', action: 'zoomOut' }

// Nudge shortcuts (in useKeyboardShortcuts.ts)
{ key: 'ArrowUp', action: 'nudgeUp' }    // 0.1 units
{ key: 'ArrowDown', action: 'nudgeDown' }
{ key: 'ArrowLeft', action: 'nudgeLeft' }
{ key: 'ArrowRight', action: 'nudgeRight' }
// Shift+Arrow = 0.3 units (large nudge)
```

**Τι Λείπει:**
- ❌ `Ctrl+A` - Select All
- ❌ `M` - Move tool
- ❌ `Ctrl+C` / `Ctrl+V` - Copy/Paste
- ❌ `Ctrl+D` - Duplicate
- ❌ `R` - Rotate
- ❌ `Ctrl+G` - Group

#### 2.1.4 Grip System ⚠️ 50% Complete
**Location**: `src/subapps/dxf-viewer/systems/grip-interaction/`

| Αρχείο | Περιγραφή | Status |
|--------|-----------|--------|
| `GripInteractionManager.ts` | Centralized grip system | ⚠️ Infrastructure only |

**Υπάρχουσες Capabilities:**
- ✅ Grip color states (cold→warm→hot)
- ✅ Hover detection
- ✅ Drag start/update/end
- ✅ Entity geometry cloning
- ✅ Real-time measurements

**Type-safe geometry union:**
```typescript
export type EntityGeometry =
  | { start: Point2D; end: Point2D }                    // line
  | { center: Point2D; radius: number }                 // circle
  | { corner1: Point2D; corner2: Point2D }              // rectangle
  | { center: Point2D; radius: number; startAngle: number; endAngle: number } // arc
  | { vertices: Point2D[] }                             // polyline
  | { center: Point2D; majorAxis: number; minorAxis: number } // ellipse
```

**Τι Λείπει:**
- ❌ Complete grip rendering
- ❌ Move entity via grip (calculateNewGeometry incomplete)
- ❌ Integration with MoveEntityCommand

#### 2.1.5 Layer Panel ⚠️ 50% Complete
**Location**: `src/subapps/dxf-viewer/ui/components/layer-manager/`

| Αρχείο | Περιγραφή | Status |
|--------|-----------|--------|
| `AdminLayerManager.tsx` | Main layer panel component | ✅ ACTIVE |
| `useLayerManagerState.ts` | State με mock data | ⚠️ Mock data |
| `useLayerFiltering.ts` | Search & filtering | ✅ ACTIVE |
| `useLayerStatistics.ts` | Statistics calculation | ✅ ACTIVE |
| `types.ts` | Type definitions | ✅ ACTIVE |

**Τι Λείπει:**
- ❌ Click layer → select all entities
- ❌ Real data integration (χρησιμοποιεί mock data)
- ❌ Layer operations (rename, delete, duplicate)

### 2.2 Εντοπισμένα Κενά (Gap Analysis)

| Gap | Impact | Enterprise Solution |
|-----|--------|---------------------|
| Χωρίς MoveEntityCommand | 🔴 CRITICAL | Command Pattern με undo/redo |
| Χωρίς Ctrl+A | 🟠 HIGH | Extend keyboard-shortcuts.ts |
| Χωρίς Layer click-to-select | 🟠 HIGH | Extend useSelectionActions.ts |
| Χωρίς entity drag | 🟠 HIGH | GripInteractionManager + MoveEntityCommand |
| Grips δεν μετακινούν entities | 🟡 MEDIUM | Integration με Command system |

### 2.3 Dependency Graph

```
MoveEntityCommand (NEW)
    ↓
┌───────────────────────────────────────────────────────────┐
│                                                           │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐  │
│  │ Selection   │    │ Keyboard     │    │ Grip        │  │
│  │ System      │───→│ Shortcuts    │←───│ Interaction │  │
│  │ (existing)  │    │ (existing)   │    │ (existing)  │  │
│  └─────────────┘    └──────────────┘    └─────────────┘  │
│         ↑                  ↑                   ↑          │
│         │                  │                   │          │
│  ┌──────┴──────────────────┴───────────────────┴───────┐ │
│  │                 CommandHistory                       │ │
│  │                   (existing)                         │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

## 3. ENTERPRISE ANALYSIS

### 3.1 Τι Κάνουν οι Μεγάλες Εταιρείες

#### 3.1.1 Autodesk AutoCAD
| Feature | Implementation |
|---------|----------------|
| **Selection** | Window (left→right), Crossing (right→left), Fence, Polygon |
| **Move** | MOVE command με base point + destination |
| **Keyboard** | M for Move, Ctrl+A for Select All |
| **Grips** | Blue squares, drag to move vertex/entity |
| **Undo** | Unlimited undo stack |

#### 3.1.2 Adobe Illustrator
| Feature | Implementation |
|---------|----------------|
| **Selection** | Selection tool (V), Direct Selection (A), Group Selection |
| **Move** | Drag selected, Transform panel, Object > Transform > Move |
| **Keyboard** | Arrow keys for nudge, Shift+Arrow for 10x |
| **Layers** | Click layer to select all contents |
| **Undo** | Edit > Undo (Ctrl+Z) |

#### 3.1.3 Figma
| Feature | Implementation |
|---------|----------------|
| **Selection** | Click, Shift+Click for add, Cmd+A for all in frame |
| **Move** | Direct drag, Arrow keys, Position panel |
| **Keyboard** | Arrow = 1px, Shift+Arrow = 10px |
| **Frames** | Click frame in layers = select frame |
| **Undo** | Cmd+Z, collaborative history |

#### 3.1.4 Bentley MicroStation
| Feature | Implementation |
|---------|----------------|
| **Selection** | Element Selection, Fence, PowerSelector |
| **Move** | Move tool με AccuDraw |
| **Keyboard** | Shortcuts configurable |
| **Grips** | Handles for manipulation |
| **Undo** | Mark/Return to Mark system |

### 3.2 Common Patterns (Enterprise Standard)

| Pattern | Adoption | Description |
|---------|----------|-------------|
| **Window/Crossing Selection** | AutoCAD, MicroStation | Left→Right vs Right→Left |
| **Layer Click = Select All** | Illustrator, Photoshop, Figma | Click layer in panel |
| **Arrow Keys Nudge** | All | 1px/1unit normal, 10x with Shift |
| **Move Command/Tool** | AutoCAD, MicroStation | Explicit move with base point |
| **Direct Drag** | Figma, Illustrator | Drag selected entities |
| **Undo/Redo Stack** | All | Command history |
| **Grips/Handles** | All | Visual manipulation points |

### 3.3 Η Πρόταση μας: Υβριδικό Σύστημα

Συνδυάζουμε τα καλύτερα από κάθε εταιρεία:

| Feature | Source | Priority |
|---------|--------|----------|
| Window/Crossing Selection | AutoCAD | ✅ Υπάρχει ήδη |
| Layer Click-to-Select | Adobe/Figma | 🔴 Phase 2 |
| Ctrl+A Select All | Universal | 🔴 Phase 2 |
| M for Move Tool | AutoCAD | 🟠 Phase 3 |
| Arrow Keys Nudge | Universal | ✅ Υπάρχει ήδη |
| Direct Drag | Figma | 🟠 Phase 3 |
| Undo/Redo | Universal | ✅ CommandHistory υπάρχει |
| MoveEntityCommand | AutoCAD pattern | 🔴 Phase 1 |

---

## 4. TARGET ARCHITECTURE

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER INTERACTION LAYER                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │ Layer      │  │ Canvas     │  │ Keyboard   │  │ Grip       │    │
│  │ Panel      │  │ Click/Drag │  │ Shortcuts  │  │ Interaction│    │
│  │ Click      │  │            │  │            │  │            │    │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘    │
│        │               │               │               │            │
│        └───────────────┴───────┬───────┴───────────────┘            │
│                                │                                     │
├────────────────────────────────┼────────────────────────────────────┤
│                        SELECTION LAYER                               │
│                                │                                     │
│  ┌─────────────────────────────┴─────────────────────────────────┐  │
│  │                    SelectionSystem                             │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │  │
│  │  │ selectAll() │  │ selectBy    │  │ Window/Crossing     │   │  │
│  │  │ (NEW)       │  │ Layer()(NEW)│  │ Selection (EXISTS)  │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                │                                     │
├────────────────────────────────┼────────────────────────────────────┤
│                        COMMAND LAYER                                 │
│                                │                                     │
│  ┌─────────────────────────────┴─────────────────────────────────┐  │
│  │                    CommandHistory (EXISTS)                     │  │
│  │                                                                │  │
│  │  ┌──────────────────┐  ┌──────────────────┐                   │  │
│  │  │ MoveEntityCommand│  │ MoveVertexCommand│                   │  │
│  │  │ (NEW)            │  │ (EXISTS)         │                   │  │
│  │  └──────────────────┘  └──────────────────┘                   │  │
│  │                                                                │  │
│  │  ┌──────────────────┐  ┌──────────────────┐                   │  │
│  │  │ CreateEntity     │  │ DeleteEntity     │                   │  │
│  │  │ Command (EXISTS) │  │ Command (EXISTS) │                   │  │
│  │  └──────────────────┘  └──────────────────┘                   │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                │                                     │
├────────────────────────────────┼────────────────────────────────────┤
│                        DATA LAYER                                    │
│                                │                                     │
│  ┌─────────────────────────────┴─────────────────────────────────┐  │
│  │                    Levels System (EXISTS)                      │  │
│  │                    └── Scene Entities                          │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 MoveEntityCommand Design

```typescript
/**
 * MoveEntityCommand
 *
 * Enterprise Command για μετακίνηση entities με:
 * - Full undo/redo support
 * - Command merging για smooth drag (500ms window)
 * - Batch move για multiple entities
 * - Serialization για persistence
 */
interface MoveEntityCommandParams {
  /** Entity IDs to move */
  entityIds: string[];

  /** Movement delta (dx, dy) */
  delta: Point2D;

  /** Level ID where entities exist */
  levelId: string;

  /** Optional: Whether this is part of a drag sequence */
  isDragging?: boolean;
}

interface IMoveEntityCommand extends ICommand {
  type: 'MOVE_ENTITY';

  execute(): void;
  undo(): void;
  redo(): void;

  /** For smooth dragging - merge consecutive moves */
  canMerge(other: ICommand): boolean;
  merge(other: IMoveEntityCommand): IMoveEntityCommand;

  /** Serialization */
  serialize(): SerializedCommand;

  /** Affected entities */
  getAffectedEntityIds(): string[];

  /** Validation */
  validate(): boolean;
}
```

### 4.3 Selection Enhancements Design

```typescript
/**
 * Extended Selection Actions
 */
interface ExtendedSelectionActions {
  // Existing
  selectRegions(regionIds: string[]): void;
  clearSelection(): void;
  toggleSelection(regionId: string): void;

  // NEW
  selectAll(): void;                           // Ctrl+A
  selectByLayer(layerId: string): void;        // Layer panel click
  selectByType(entityType: string): void;      // Future
  invertSelection(): void;                     // Future
  selectByProperty(property: string, value: unknown): void; // Future
}
```

### 4.4 Keyboard Shortcuts Enhancement

```typescript
/**
 * New shortcuts to add to keyboard-shortcuts.ts
 */
const NEW_SHORTCUTS = {
  // Selection
  selectAll: { key: 'a', ctrl: true, action: 'selectAll' },

  // Movement
  moveTool: { key: 'm', action: 'activateMoveTool' },

  // Future
  copy: { key: 'c', ctrl: true, action: 'copy' },
  paste: { key: 'v', ctrl: true, action: 'paste' },
  duplicate: { key: 'd', ctrl: true, action: 'duplicate' },
  rotate: { key: 'r', action: 'activateRotateTool' },
  group: { key: 'g', ctrl: true, action: 'group' },
};
```

### 4.5 File Structure (After Implementation)

```
src/subapps/dxf-viewer/
├── core/
│   └── commands/
│       ├── index.ts                    # Updated exports
│       ├── interfaces.ts               # Existing
│       ├── CommandHistory.ts           # Existing
│       ├── MoveEntityCommand.ts        # 🆕 NEW
│       ├── MoveVertexCommand.ts        # Existing
│       ├── CreateEntityCommand.ts      # Existing
│       ├── DeleteEntityCommand.ts      # Existing
│       └── ...
├── config/
│   └── keyboard-shortcuts.ts           # Updated with new shortcuts
├── systems/
│   └── selection/
│       ├── SelectionSystem.tsx         # Existing
│       ├── useSelectionActions.ts      # Updated with selectAll, selectByLayer
│       └── ...
├── hooks/
│   └── useKeyboardShortcuts.ts         # Updated handlers
└── docs/
    └── HYBRID_LAYER_MOVEMENT_ARCHITECTURE.md  # This document
```

---

## 5. ΦΑΣΕΙΣ ΥΛΟΠΟΙΗΣΗΣ

### Phase 1: MoveEntityCommand (Foundation) ✅ COMPLETE (2026-01-25)

**Στόχος**: Δημιουργία του βασικού command για μετακίνηση entities

| Task | Περιγραφή | Αρχείο | Status |
|------|-----------|--------|--------|
| 1.1 | Create MoveEntityCommand class | `core/commands/entity-commands/MoveEntityCommand.ts` | ✅ DONE |
| 1.2 | Implement execute() - apply delta to entities | ↑ | ✅ DONE |
| 1.3 | Implement undo() - reverse delta | ↑ | ✅ DONE |
| 1.4 | Implement merge() για smooth drag | ↑ | ✅ DONE |
| 1.5 | Implement serialize/deserialize | ↑ | ✅ DONE |
| 1.6 | Add to CommandRegistry | `core/commands/index.ts` | ✅ DONE |
| 1.7 | Create useMoveEntities() hook | `hooks/useMoveEntities.ts` | ✅ DONE |

**Deliverables COMPLETED:**
- ✅ MoveEntityCommand με full undo/redo (~350 lines)
- ✅ MoveMultipleEntitiesCommand για batch operations
- ✅ Command merging (500ms window για drag operations)
- ✅ Serialization support για persistence
- ✅ useMoveEntities() React hook (~300 lines)
- ✅ SceneManager adapter για bridge με Levels system
- ✅ TypeScript compilation verified - ZERO errors

**Entity Types Support:**
| Entity Type | Move Logic |
|-------------|------------|
| Line | `start += delta`, `end += delta` |
| Circle | `center += delta` |
| Rectangle | `corner1 += delta`, `corner2 += delta` |
| Polyline | `vertices.forEach(v => v += delta)` |
| Arc | `center += delta` |
| Ellipse | `center += delta` |
| Text | `position += delta` |
| Point | `position += delta` |

---

### Phase 2: Selection Enhancements ✅ COMPLETE (2026-01-25)

**Στόχος**: Προσθήκη Ctrl+A και Layer click-to-select

| Task | Περιγραφή | Αρχείο | Status |
|------|-----------|--------|--------|
| 2.1 | Add `selectAll()` action | `systems/selection/useSelectionActions.ts` | ✅ DONE |
| 2.2 | Add `selectByLayer()` action | ↑ | ✅ DONE |
| 2.3 | Add `addMultipleToSelection()` action | ↑ | ✅ DONE |
| 2.4 | Create `useEnhancedSelection` hook | `hooks/useEnhancedSelection.ts` | ✅ DONE |
| 2.5 | Ctrl+A shortcut ready | `config/keyboard-shortcuts.ts` | ✅ EXISTS |

**Deliverables COMPLETED:**
- ✅ `selectAllEntities()` action with performance guards
- ✅ `selectByLayer()` action with validation
- ✅ `addMultipleToSelection()` for Shift+click
- ✅ `useEnhancedSelection` hook bridging Selection + Levels (~300 lines)
- ✅ Enterprise patterns: Facade, error handling, debug logging, performance warnings

**Files Created/Modified:**
- `systems/selection/config.ts` - Extended SelectionActions interface
- `systems/selection/useSelectionReducer.ts` - New action types + handlers
- `systems/selection/useSelectionActions.ts` - New action creators
- `hooks/useEnhancedSelection.ts` - NEW (~300 lines)
- `hooks/index.ts` - Updated exports

---

### Phase 3: Movement Methods ✅ COMPLETE (2026-01-25)

**Στόχος**: Υλοποίηση direct drag και Move tool

| Task | Περιγραφή | Αρχείο | Status |
|------|-----------|--------|--------|
| 3.1 | Implement drag handler for selected entities | `hooks/useEntityDrag.ts` | ✅ DONE |
| 3.2 | Add M shortcut for Move tool | `config/keyboard-shortcuts.ts` | ✅ EXISTS |
| 3.3 | Add Move tool to ToolStateManager | `systems/tools/ToolStateManager.ts` | ✅ DONE |
| 3.4 | Create unified movement operations hook | `hooks/useMovementOperations.ts` | ✅ DONE |
| 3.5 | Enhanced nudge with Shift modifier (10x) | `hooks/useMovementOperations.ts` | ✅ DONE |

**Deliverables COMPLETED:**
- ✅ `useEntityDrag` hook (~350 lines) with:
  - Mouse down/move/up handling
  - Minimum drag distance threshold (3px)
  - RAF throttling for performance (60fps)
  - ESC key cancellation
  - Snap-to-grid support
- ✅ `useMovementOperations` unified hook (~350 lines) with:
  - Nudge operations (up/down/left/right)
  - Normal (1 unit) and Large (10 units with Shift) nudge
  - Direct move by delta
  - Full undo/redo integration
- ✅ Move tool definition in ToolStateManager (category: 'editing')
- ✅ Copy, delete, grip-edit tools also added

**Files Created/Modified:**
- `hooks/useEntityDrag.ts` - NEW (~350 lines)
- `hooks/useMovementOperations.ts` - NEW (~350 lines)
- `systems/tools/ToolStateManager.ts` - Added editing tools
- `hooks/index.ts` - Updated exports

**Nudge Configuration:**
| Modifier | Step Size |
|----------|-----------|
| Normal (Arrow only) | 1 unit |
| Large (Shift+Arrow) | 10 units |
| Small (Ctrl+Arrow) | 0.1 units |

---

### Phase 4: Integration & Polish ✅ COMPLETE (2026-01-25)

**Στόχος**: Ενσωμάτωση με GripInteractionManager και polish

| Task | Περιγραφή | Αρχείο | Status |
|------|-----------|--------|--------|
| 4.1 | Create useGripMovement hook | `hooks/useGripMovement.ts` | ✅ DONE |
| 4.2 | Bridge grips with Command Pattern | ↑ | ✅ DONE |
| 4.3 | Add visual feedback during drag | `rendering/utils/ghost-entity-renderer.ts` | ✅ DONE |
| 4.4 | Snap-to-grid support | All drag/grip hooks | ✅ DONE |
| 4.5 | Performance optimization for large selections | ghost-entity-renderer.ts | ✅ DONE |
| 4.6 | Update documentation | This file | ✅ DONE |

**Deliverables COMPLETED:**
- ✅ `useGripMovement` hook (~350 lines) bridging:
  - GripInteractionManager state
  - MoveEntityCommand (for entity grips)
  - MoveVertexCommand (for vertex grips)
  - Full undo/redo support
- ✅ `ghost-entity-renderer.ts` (~450 lines) with:
  - Ghost outline rendering (semi-transparent preview)
  - Delta indicator line with arrow
  - Coordinate readout during drag
  - Simplified box for large selections (>50 entities)
  - Strategy Pattern for different entity types
- ✅ Snap-to-grid support in all movement hooks
- ✅ Performance thresholds and optimizations

**Files Created/Modified:**
- `hooks/useGripMovement.ts` - NEW (~350 lines)
- `rendering/utils/ghost-entity-renderer.ts` - NEW (~450 lines)
- `rendering/utils/index.ts` - NEW (exports)
- `hooks/index.ts` - Updated exports

**Visual Feedback Configuration:**
| Setting | Value | Description |
|---------|-------|-------------|
| GHOST_FILL | rgba(0, 120, 255, 0.15) | Semi-transparent blue fill |
| GHOST_STROKE | rgba(0, 120, 255, 0.6) | Blue stroke |
| DELTA_LINE_COLOR | rgba(255, 165, 0, 0.8) | Orange delta indicator |
| DETAIL_THRESHOLD | 50 | Max entities for detailed ghost |
| SIMPLIFIED_BOX_COLOR | rgba(0, 120, 255, 0.3) | Simplified mode color |

---

## 6. API REFERENCE

### 6.1 MoveEntityCommand

```typescript
import { MoveEntityCommand } from '@/subapps/dxf-viewer/core/commands';

// Create command
const command = new MoveEntityCommand({
  entityIds: ['entity_1', 'entity_2'],
  delta: { x: 100, y: 50 },
  levelId: 'level_1',
  isDragging: false,
});

// Execute with history (undo support)
commandHistory.execute(command);

// Undo
commandHistory.undo();

// Redo
commandHistory.redo();
```

### 6.2 useMoveEntities Hook

```typescript
import { useMoveEntities } from '@/subapps/dxf-viewer/hooks';

function MyComponent() {
  const { moveEntities, isMoving } = useMoveEntities();

  const handleMove = () => {
    moveEntities({
      entityIds: selectedEntityIds,
      delta: { x: 10, y: 0 },
    });
  };

  return (
    <button onClick={handleMove} disabled={isMoving}>
      Move Right
    </button>
  );
}
```

### 6.3 Selection Actions

```typescript
import { useSelection } from '@/subapps/dxf-viewer/systems/selection';

function MyComponent() {
  const { selectAll, selectByLayer, clearSelection } = useSelection();

  // Select all entities
  const handleSelectAll = () => {
    selectAll();
  };

  // Select entities in a layer
  const handleLayerClick = (layerId: string) => {
    selectByLayer(layerId);
  };

  return (
    <div>
      <button onClick={handleSelectAll}>Select All (Ctrl+A)</button>
      <button onClick={() => handleLayerClick('layer_1')}>Select Layer 1</button>
    </div>
  );
}
```

### 6.4 Keyboard Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+A` | selectAll | Select all entities |
| `M` | activateMoveTool | Activate Move tool |
| `Arrow Keys` | nudge | Move 1 unit |
| `Shift+Arrow` | nudgeLarge | Move 10 units |
| `Delete` | delete | Delete selected |
| `Escape` | cancel | Cancel current operation |

---

## 7. MIGRATION GUIDE

### 7.1 Από Boolean State σε Command Pattern

**Πριν (Anti-pattern):**
```typescript
// ❌ Direct state mutation - no undo
const moveEntity = (entity, delta) => {
  entity.position.x += delta.x;
  entity.position.y += delta.y;
  setEntities([...entities]);
};
```

**Μετά (Enterprise):**
```typescript
// ✅ Command Pattern - full undo/redo
const moveEntity = (entityIds, delta) => {
  const command = new MoveEntityCommand({
    entityIds,
    delta,
    levelId: currentLevelId,
  });
  commandHistory.execute(command);
};
```

### 7.2 Integration με Existing Code

**GripInteractionManager:**
```typescript
// Before: Direct mutation
onDragEnd(entityId, newPosition) {
  updateEntityGeometry(entityId, newPosition);
}

// After: Via command
onDragEnd(entityId, delta) {
  const command = new MoveEntityCommand({
    entityIds: [entityId],
    delta,
    levelId: currentLevelId,
    isDragging: true, // Enables merging
  });
  commandHistory.execute(command);
}
```

---

## 8. TESTING STRATEGY

### 8.1 Unit Tests

| Test Suite | Coverage |
|------------|----------|
| MoveEntityCommand.test.ts | execute, undo, redo, merge, serialize |
| useSelectionActions.test.ts | selectAll, selectByLayer |
| keyboard-shortcuts.test.ts | New shortcuts |

### 8.2 Integration Tests

| Test | Description |
|------|-------------|
| Move + Undo | Move entities, verify undo restores position |
| Ctrl+A + Move | Select all, move, verify all moved |
| Drag + Merge | Drag entity, verify commands merge |
| Layer Click + Move | Click layer, move, verify all layer entities moved |

### 8.3 Manual Testing Checklist

- [ ] Ctrl+A selects all entities
- [ ] Click layer selects all layer entities
- [ ] Drag selected entities moves them
- [ ] Arrow keys nudge selected entities
- [ ] Shift+Arrow nudges 10x
- [ ] M key activates Move tool
- [ ] Undo reverses move
- [ ] Redo re-applies move
- [ ] Multiple entities move together
- [ ] Grips work with move system

---

---

## 9. MULTI-SELECTION & MARQUEE SELECTION SYSTEM (2026-01-25)

### 🔒 ΣΤΑΘΕΡΟ ΣΥΣΤΗΜΑ — ΛΕΙΤΟΥΡΓΕΙ ΠΛΗΡΩΣ ΣΩΣΤΑ (2026-02-13)

> **⚠️ ΜΗΝ ΤΡΟΠΟΠΟΙΗΘΕΙ ΧΩΡΙΣ ΣΟΒΑΡΟ ΛΟΓΟ**
>
> Μετά από 8+ bug fixes (2026-02-13), το Window/Crossing selection system λειτουργεί **ΠΛΗΡΩΣ ΣΩΣΤΑ**.
> Υποστηρίζει **ΟΛΟΥΣ** τους τύπους entities: line, circle, arc, polyline, lwpolyline, rect, rectangle, angle-measurement, text.
> Υποστηρίζει επίσης color layer overlays ταυτόχρονα με drawn entities.
>
> **Κρίσιμες αρχιτεκτονικές σημειώσεις:**
> - DxfCanvas (z-10) forward-ει ΟΛΑ τα marquee props στο `useCentralizedMouseHandlers`
> - Marquee box rendering γίνεται ΜΕΣΑ στο RAF loop (step 4 στο `renderScene()`)
> - ΔΥΟ ξεχωριστές `calculateEntityBounds()` (selection-utils + DxfRenderer) — πρέπει να μένουν σε sync
> - `'rect'` ΚΑΙ `'rectangle'` πρέπει να υποστηρίζονται σε κάθε switch statement
>
> Αναλυτικό changelog: Βλ. [ADR-035](../../docs/centralized-systems/reference/adrs/ADR-035-tool-overlay-mode-metadata.md)

### 9.1 Overview

Υλοποιήθηκε πλήρες **Multi-Selection System** για color overlays με:
- Window Selection (left→right) - επιλογή entities εντός του box
- Crossing Selection (right→left) - επιλογή entities που τέμνονται
- Single-Click Selection με point-in-polygon hit-test
- Accurate polygon-to-rectangle intersection
- Grip drag prevention logic

### 9.2 Multi-Selection Store (overlay-store.tsx)

**Location**: `src/subapps/dxf-viewer/stores/overlay-store.tsx`

#### 9.2.1 New State

```typescript
interface OverlayStoreState {
  overlays: Record<string, Overlay>;
  selectedOverlayId: string | null;      // Backward compatible (single)
  selectedOverlayIds: Set<string>;       // 🆕 NEW: Multi-selection
  isLoading: boolean;
  currentLevelId: string | null;
}
```

#### 9.2.2 New Actions

| Action | Description | Implementation |
|--------|-------------|----------------|
| `setSelectedOverlays(ids: string[])` | Set multiple overlays as selected | Clears existing, sets all at once |
| `addToSelection(id: string)` | Add overlay to selection | Set.add(), syncs with `selectedOverlayId` |
| `removeFromSelection(id: string)` | Remove overlay from selection | Set.delete() |
| `toggleSelection(id: string)` | Toggle overlay selection state | Add if not present, remove if present |
| `clearSelection()` | Clear all selections | Clears Set + nulls selectedOverlayId |
| `getSelectedOverlays()` | Get all selected Overlay objects | Returns Overlay[] from selectedOverlayIds |
| `isSelected(id: string)` | Check if overlay is selected | Set.has() |

#### 9.2.3 Usage Example

```typescript
import { useOverlayStore } from '@/subapps/dxf-viewer/stores/overlay-store';

function MyComponent() {
  const overlayStore = useOverlayStore();

  // Multi-select
  overlayStore.setSelectedOverlays(['overlay_1', 'overlay_2', 'overlay_3']);

  // Check selection
  if (overlayStore.isSelected('overlay_1')) {
    console.log('Overlay 1 is selected');
  }

  // Get all selected
  const selected = overlayStore.getSelectedOverlays();
  console.log(`${selected.length} overlays selected`);

  // Toggle
  overlayStore.toggleSelection('overlay_2');

  // Clear all
  overlayStore.clearSelection();
}
```

### 9.3 Marquee Selection Improvements (useCentralizedMouseHandlers.ts)

**Location**: `src/subapps/dxf-viewer/systems/cursor/useCentralizedMouseHandlers.ts`

#### 9.3.1 New Props

```typescript
interface CentralizedMouseHandlersProps {
  // Existing props...

  /** 🆕 Callback when multiple layers are selected via marquee */
  onMultiLayerSelected?: (layerIds: string[]) => void;

  /** 🆕 Whether grip dragging is active (prevents selection box) */
  isGripDragging?: boolean;
}
```

#### 9.3.2 Single-Click Layer Detection

Όταν η περιοχή επιλογής είναι μικρή (< 5px), γίνεται **point-in-polygon hit-test**:

```typescript
const MIN_MARQUEE_SIZE = 5; // pixels

// In onMouseUp:
const isSmallSelection = selectionWidth < MIN_MARQUEE_SIZE &&
                         selectionHeight < MIN_MARQUEE_SIZE;

if (isSmallSelection && colorLayers) {
  // Point-in-polygon hit-test (ray casting algorithm)
  for (const layer of colorLayers) {
    for (const polygon of layer.polygons) {
      const vertices = polygon.vertices.map(v => transform.canvasToWorld(v));
      const inside = pointInPolygon(clickPoint, vertices);
      if (inside) {
        hitLayerId = layer.id;
        break;
      }
    }
  }

  if (hitLayerId) {
    onMultiLayerSelected([hitLayerId]);
  } else {
    onMultiLayerSelected([]); // Click on empty = deselect
  }
}
```

#### 9.3.3 Grip Drag Prevention

```typescript
// In CanvasSection.tsx:
<LayerCanvas
  isGripDragging={
    draggingVertex !== null ||
    draggingEdgeMidpoint !== null ||
    hoveredVertexInfo !== null ||  // 🔑 KEY: Check hover state too
    hoveredEdgeInfo !== null       // (state changes AFTER mousedown)
  }
/>

// In useCentralizedMouseHandlers:
if (e.button === 0 &&
    !e.shiftKey &&
    activeTool !== 'pan' &&
    !isDrawingTool &&
    !shouldStartPan &&
    !isGripDragging) {  // 🆕 NEW: Prevent selection during grip interaction
  cursor.startSelection(screenPos);
}
```

### 9.4 Accurate Polygon Intersection (UniversalMarqueeSelection.ts)

**Location**: `src/subapps/dxf-viewer/systems/selection/UniversalMarqueeSelection.ts`

#### 9.4.1 Problem Solved

Το προηγούμενο bounding box intersection ήταν πολύ "χοντρό" - επέλεγε layers που δεν τέμνονταν πραγματικά με το selection box.

#### 9.4.2 New Methods

| Method | Description |
|--------|-------------|
| `polygonIntersectsRectangle()` | Accurate polygon-to-rectangle intersection test |
| `lineIntersectsRectangle()` | Check if line segment intersects rectangle |
| `lineSegmentsIntersect()` | Cross-product based line intersection |
| `pointInPolygon()` | Ray casting algorithm for point-in-polygon |

#### 9.4.3 Algorithm (Polygon-Rectangle Intersection)

```typescript
private static polygonIntersectsRectangle(
  polygonVertices: Point2D[],
  rectBounds: { min: Point2D, max: Point2D }
): boolean {
  // Step 1: Check if any polygon vertex is inside rectangle
  for (const vertex of polygonVertices) {
    if (vertex.x >= rectBounds.min.x && vertex.x <= rectBounds.max.x &&
        vertex.y >= rectBounds.min.y && vertex.y <= rectBounds.max.y) {
      return true;
    }
  }

  // Step 2: Check if any polygon edge intersects rectangle edges
  for (let i = 0; i < polygonVertices.length; i++) {
    const p1 = polygonVertices[i];
    const p2 = polygonVertices[(i + 1) % polygonVertices.length];
    if (this.lineIntersectsRectangle(p1, p2, rectBounds)) {
      return true;
    }
  }

  // Step 3: Check if rectangle center is inside polygon
  const rectCenter = {
    x: (rectBounds.min.x + rectBounds.max.x) / 2,
    y: (rectBounds.min.y + rectBounds.max.y) / 2
  };
  if (this.pointInPolygon(rectCenter, polygonVertices)) {
    return true;
  }

  return false;
}
```

#### 9.4.4 Line Segment Intersection (Cross-Product)

```typescript
private static lineSegmentsIntersect(
  p1: Point2D, p2: Point2D,
  p3: Point2D, p4: Point2D
): boolean {
  const d1 = this.direction(p3, p4, p1);
  const d2 = this.direction(p3, p4, p2);
  const d3 = this.direction(p1, p2, p3);
  const d4 = this.direction(p1, p2, p4);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  // Collinear cases...
  return false;
}

private static direction(p1: Point2D, p2: Point2D, p3: Point2D): number {
  return (p3.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p3.y - p1.y);
}
```

### 9.5 Visual Feedback for Multi-Selection

**Location**: `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx`

#### 9.5.1 Grip Display for All Selected

```typescript
// Before: Only single selection
const isSelected = overlay.id === overlayStore.selectedOverlayId;

// After: Check multi-selection Set
const isSelected = overlayStore.isSelected(overlay.id);
```

#### 9.5.2 Grip Hover Detection for All Selected

```typescript
// Check grips for ALL selected overlays, not just one
const selectedOverlays = overlayStore.getSelectedOverlays();
for (const selectedOv of selectedOverlays) {
  // Check vertex grips
  for (let i = 0; i < selectedOv.points.length; i++) {
    if (isPointNearVertex(mousePos, vertex)) {
      setHoveredVertexInfo({ overlayId: selectedOv.id, vertexIndex: i });
    }
  }
  // Check edge midpoint grips
  // ...
}
```

### 9.6 Files Modified

| File | Changes |
|------|---------|
| `stores/overlay-store.tsx` | Added `selectedOverlayIds: Set<string>`, new actions |
| `systems/cursor/useCentralizedMouseHandlers.ts` | Added `onMultiLayerSelected`, `isGripDragging`, point-in-polygon |
| `systems/selection/UniversalMarqueeSelection.ts` | Added accurate polygon intersection methods |
| `components/dxf-layout/CanvasSection.tsx` | Changed `isSelected` check, added grip hover for multi |
| `canvas-v2/layer-canvas/LayerCanvas.tsx` | Added `isGripDragging` prop |

### 9.7 Testing Checklist

- [x] Marquee selection (Window mode - left→right) επιλέγει layers εντός
- [x] Marquee selection (Crossing mode - right→left) επιλέγει layers που τέμνονται
- [x] Single-click on layer επιλέγει το layer
- [x] Single-click on empty canvas αποεπιλέγει όλα
- [x] Grips εμφανίζονται σε όλα τα επιλεγμένα layers
- [x] Grip drag δεν εμφανίζει selection box
- [x] Crossing selection δεν επιλέγει overlapping layers που δεν τέμνονται

---

## CHANGELOG

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-25 | 1.0.0 | Initial document creation - Research & Architecture |
| 2026-01-25 | 2.0.0 | Added Section 9: Multi-Selection & Marquee Selection System |
| 2026-02-13 | 2.1.0 | Section 9: Marked as STABLE — 8+ bug fixes, full entity type support, DO NOT MODIFY |

---

**Document End**

> *"The best architectures are those that feel natural to use."*
> — Donald Norman
