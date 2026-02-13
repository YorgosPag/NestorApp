# 🎯 **SELECTION SYSTEM**

> **Universal Selection Architecture**: Unified selection for all entity types
>
> Related ADRs: **ADR-030** (Universal Selection), **ADR-031** (Multi-Grip), **ADR-032** (Smart Delete)

---

## 📋 **ADR-030: Universal Selection System**

**Status**: ✅ IMPLEMENTED | **Date**: 2026-01-25

### Decision

| Rule | Description |
|------|-------------|
| **CANONICAL** | `systems/selection/` + `useUniversalSelection()` |
| **DEPRECATED** | Selection logic σε `overlay-store.tsx` |
| **PROHIBITION** | ❌ New selection implementations σε άλλα stores |

### Architecture (1,040+ lines)

```
systems/selection/
├── types.ts                    # Selection types
├── SelectionManager.ts         # Core selection logic
├── useUniversalSelection.ts    # React hook
└── index.ts                    # Public API
```

### Features
- Universal entity selection
- Window/Crossing selection (AutoCAD pattern)
- Multi-type support (DXF + Overlays)

### 🔒 Window/Crossing Marquee Selection — ΛΕΙΤΟΥΡΓΕΙ ΣΩΣΤΑ, ΜΗΝ ΠΕΙΡΑΧΤΕΙ (2026-02-13)

> **⚠️ ΣΤΑΘΕΡΟ ΣΥΣΤΗΜΑ — ΜΗΝ ΤΡΟΠΟΠΟΙΗΘΕΙ ΧΩΡΙΣ ΣΟΒΑΡΟ ΛΟΓΟ**
>
> Το AutoCAD-style Window/Crossing selection είναι **ΠΛΗΡΩΣ ΛΕΙΤΟΥΡΓΙΚΟ** (2026-02-13).
> Μετά από 8+ bug fixes σε μία session, το σύστημα δουλεύει σωστά σε όλους τους τύπους entities.

**Τι λειτουργεί:**
- **Window Selection** (αριστερά→δεξιά, μπλε, solid): Επιλέγει entities **πλήρως εντός** του πλαισίου
- **Crossing Selection** (δεξιά→αριστερά, πράσινο, dashed): Επιλέγει entities που **τέμνουν** το πλαίσιο
- **Υποστηριζόμενοι τύποι**: line, circle, arc, polyline, lwpolyline, rect, rectangle, angle-measurement, text
- **Οπτική ανάδραση**: Μπλε/πράσινο marquee box + dashed highlight rectangles γύρω από επιλεγμένα entities
- **Overlays + Entities**: Επιλέγει ταυτόχρονα drawn entities ΚΑΙ color layer overlays

**Κρίσιμα αρχεία (ΜΗΝ πειραχτούν χωρίς ανάγκη):**
| Αρχείο | Ρόλος |
|--------|-------|
| `systems/selection/UniversalMarqueeSelection.ts` | Κεντρική selection logic (Window vs Crossing) |
| `systems/cursor/useCentralizedMouseHandlers.ts` | Mouse event routing, marquee callbacks |
| `canvas-v2/dxf-canvas/DxfCanvas.tsx` | RAF-synchronized marquee rendering + prop forwarding |
| `canvas-v2/dxf-canvas/DxfRenderer.ts` | Visual selection highlight (dashed rectangles) |
| `systems/selection/shared/selection-duplicate-utils.ts` | Entity bounds calculation (world coords) |
| `components/dxf-layout/CanvasSection.tsx` | Callback wiring DxfCanvas ↔ selection state |

**Αρχιτεκτονικές σημειώσεις:**
- Λόγω dual-canvas z-index (DxfCanvas z-10 > LayerCanvas z-0), ΟΛΑ τα mouse events περνούν μέσω DxfCanvas
- Marquee rendering ΠΡΕΠΕΙ να γίνεται μέσα στο RAF loop (όχι σε ξεχωριστό useEffect) — αλλιώς γίνεται invisible
- Υπάρχουν **ΔΥΟ ξεχωριστές** `calculateEntityBounds()`: μία στο selection-utils (world coords) και μία στο DxfRenderer (screen coords) — πρέπει να παραμένουν σε sync
- Οι τύποι `'rect'` και `'rectangle'` είναι ξεχωριστοί αλλά ισοδύναμοι — κάθε switch πρέπει να τους χειρίζεται και τους δύο

### Usage

```typescript
import { useUniversalSelection } from '@/subapps/dxf-viewer/systems/selection';

const {
  selectedIds,
  selectedType,
  select,
  deselect,
  clearSelection,
  isSelected,
} = useUniversalSelection();

// Select an entity
select('entity-id', 'overlay');

// Check selection
if (isSelected('entity-id')) {
  // ...
}
```

### Migration Status
✅ **COMPLETE (2026-01-25)**: Selection logic αφαιρέθηκε πλήρως από `overlay-store.tsx` - όλα τα components χρησιμοποιούν τώρα `useUniversalSelection()`.

---

## 📋 **ADR-031: Multi-Grip Selection System**

**Status**: ✅ APPROVED | **Date**: 2026-01-26

### Problem
Single `selectedGripIndex` limited vertex editing.

### Decision
- **New**: `selectedGripIndices[]` array
- **Interaction**: Shift+Click for multi-selection

### Implementation

```typescript
// Before: Single grip
selectedGripIndex: number | null;

// After: Multiple grips
selectedGripIndices: number[];
```

---

## 📋 **ADR-032: Smart Delete + Undo System**

**Status**: ✅ APPROVED | **Date**: 2026-01-26

### Problem
Direct `overlayStore.remove()` without undo support.

### Decision

| Rule | Description |
|------|-------------|
| **CANONICAL** | `handleSmartDelete()` + `DeleteOverlayCommand` |
| **UNDO** | Ctrl+Z support via Command Pattern |
| **PROHIBITION** | ❌ Direct `overlayStore.remove()` |

### Implementation

```typescript
import { DeleteOverlayCommand } from '@/subapps/dxf-viewer/core/commands';

// ✅ ENTERPRISE: With undo support
const command = new DeleteOverlayCommand(overlayId, overlayStore);
commandHistory.execute(command);

// ❌ PROHIBITED: Direct removal
overlayStore.remove(overlayId); // NO UNDO!
```

---

## 📋 **Command Pattern Integration**

### ADR-031: Enterprise Command Pattern

**Location**: `core/commands/`

### Overlay-Specific Commands

| Command | Purpose |
|---------|---------|
| `DeleteOverlayCommand` | Single/batch overlay delete |
| `DeleteOverlayVertexCommand` | Single/batch vertex delete |
| `MoveOverlayVertexCommand` | Single/batch vertex move |
| `MoveMultipleOverlayVerticesCommand` | Multi-grip movement |

### Usage

```typescript
import {
  useCommandHistory,
  DeleteOverlayCommand,
  MoveMultipleOverlayVerticesCommand,
  type VertexMovement,
} from '@/subapps/dxf-viewer/core/commands';

const { execute, undo, redo, canUndo, canRedo } = useCommandHistory();

// Delete with undo
execute(new DeleteOverlayCommand(overlayId, overlayStore));

// Multi-grip vertex movement
const movements: VertexMovement[] = [
  { overlayId: 'id1', vertexIndex: 0, oldPosition: [0, 0], newPosition: [10, 10] },
  { overlayId: 'id1', vertexIndex: 1, oldPosition: [5, 5], newPosition: [15, 15] },
];
execute(new MoveMultipleOverlayVerticesCommand(movements, overlayStore));

// Undo
if (canUndo) undo();
```

### Enterprise Features

| Feature | Description |
|---------|-------------|
| **Serialization** | All commands serializable to JSON |
| **Compound Commands** | Batch operations with atomic rollback |
| **Audit Trail** | Full compliance logging |
| **Persistence** | IndexedDB + localStorage |
| **Merge Support** | Consecutive drags merge (500ms window) |

---

## 📚 **QUICK REFERENCE**

### Import Paths

| System | Import |
|--------|--------|
| Universal Selection | `@/subapps/dxf-viewer/systems/selection` |
| Command History | `@/subapps/dxf-viewer/core/commands` |
| Delete Command | `@/subapps/dxf-viewer/core/commands/overlay-commands/DeleteOverlayCommand` |
| Move Command | `@/subapps/dxf-viewer/core/commands/overlay-commands/MoveOverlayCommand` |

---

> **📍 Full Reference**: [centralized_systems.md](../../../src/subapps/dxf-viewer/docs/centralized_systems.md)
>
> **🔄 Last Updated**: 2026-02-13
