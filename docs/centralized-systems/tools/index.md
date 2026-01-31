# ⚒️ **TOOLS SYSTEM**

> **Enterprise Documentation**: Drawing tools, keyboard shortcuts, and user interaction systems

**📊 Stats**: 10 ADRs | Last Updated: 2026-01-31

---

## 🎯 **RELATED ADRs**

| ADR | Decision | Status |
|-----|----------|--------|
| **ADR-026** | DXF Toolbar Colors System | ✅ APPROVED |
| **ADR-027** | DXF Keyboard Shortcuts System | ✅ APPROVED |
| **ADR-028** | Button Component Consolidation | ✅ APPROVED |
| **ADR-035** | Tool Overlay Mode Metadata | ✅ APPROVED |
| **ADR-038** | Centralized Tool Detection Functions | ✅ APPROVED |
| **ADR-040** | Preview Canvas Performance | ✅ APPROVED |
| **ADR-047** | Close Polygon on First-Point Click | ✅ APPROVED |
| **ADR-048** | Unified Grip Rendering System | ✅ APPROVED |
| **ADR-049** | Unified Move Tool (DXF + Overlays) | ✅ APPROVED |
| **ADR-055** | Centralized Tool State Persistence | ✅ APPROVED |

---

## 🎨 **ADR-026: DXF TOOLBAR COLORS SYSTEM**

**Date**: 2026-01-24
**Status**: ✅ APPROVED

### Decision

Semantic color mapping for toolbar icons following CAD industry standards.

### Canonical Source

```typescript
import { TOOLBAR_COLORS } from '@/subapps/dxf-viewer/config/toolbar-colors';

// Usage
<ToolButton color={TOOLBAR_COLORS.DRAW} />
<ToolButton color={TOOLBAR_COLORS.MEASURE} />
<ToolButton color={TOOLBAR_COLORS.MODIFY} />
```

---

## ⌨️ **ADR-027: DXF KEYBOARD SHORTCUTS SYSTEM**

**Date**: 2026-01-24
**Status**: ✅ APPROVED

### Decision

Centralized keyboard shortcuts following AutoCAD F-key standards.

### Canonical API

```typescript
import {
  matchesShortcut,
  getShortcutDisplayLabel,
  KEYBOARD_SHORTCUTS
} from '@/subapps/dxf-viewer/config/keyboard-shortcuts';

// Check if event matches shortcut
if (matchesShortcut(event, 'ZOOM_FIT')) {
  fitToExtents();
}

// Get display label
const label = getShortcutDisplayLabel('ZOOM_FIT'); // "F5"
```

### Standard Shortcuts

| Key | Action |
|-----|--------|
| F1 | Help |
| F2 | Toggle Console |
| F3 | Snap Toggle |
| F5 | Fit to Extents |
| F8 | Ortho Toggle |
| Escape | Cancel |
| Delete | Delete Selected |

---

## 🔘 **ADR-028: BUTTON COMPONENT CONSOLIDATION**

**Date**: 2026-01-24
**Status**: ✅ APPROVED

### Decision

Use Shadcn Button + specialized `ToolButton` for toolbars.

### Canonical Components

```typescript
// General UI
import { Button } from '@/components/ui/button';

// Toolbar specific
import { ToolButton } from '@/subapps/dxf-viewer/ui/toolbar/ToolButton';
```

### Migration Strategy

- Migrate on touch (49 files remaining)
- No breaking changes to existing code

---

## 🎭 **ADR-035: TOOL OVERLAY MODE METADATA**

**Date**: 2026-01-26
**Status**: ✅ APPROVED

### Decision

Tools declare whether they preserve overlay mode via metadata.

### Pattern

```typescript
interface ToolInfo {
  type: ToolType;
  name: string;
  preservesOverlayMode: boolean; // KEY PROPERTY
}

// Helper function
import { preservesOverlayMode } from '@/subapps/dxf-viewer/tools/ToolStateManager';

if (preservesOverlayMode(currentTool)) {
  // Don't reset overlay mode
}
```

---

## 🔍 **ADR-038: CENTRALIZED TOOL DETECTION FUNCTIONS**

**Date**: 2026-01-26
**Status**: ✅ APPROVED

### Decision

Single source of truth for tool type detection.

### Canonical Functions

```typescript
import {
  isDrawingTool,
  isMeasurementTool,
  isInteractiveTool,
  isSelectionTool
} from '@/subapps/dxf-viewer/tools/ToolStateManager';

// Usage
if (isDrawingTool(tool)) {
  enableSnapping();
}

if (isMeasurementTool(tool)) {
  showDistanceLabel();
}
```

---

## ⚡ **ADR-040: PREVIEW CANVAS PERFORMANCE**

**Date**: 2027-01-27
**Status**: ✅ APPROVED

### Decision

Dedicated preview canvas with optimized rendering pipeline.

### Performance

| Metric | Before | After |
|--------|--------|-------|
| Frame time | ~250ms | <16ms |
| Jank | Frequent | None |

### Canonical Component

```typescript
import { PreviewCanvas } from '@/subapps/dxf-viewer/canvas-v2/preview-canvas';
import { PreviewRenderer } from '@/subapps/dxf-viewer/canvas-v2/preview-canvas/PreviewRenderer';
```

---

## 🔷 **ADR-047: CLOSE POLYGON ON FIRST-POINT CLICK**

**Date**: 2027-01-27
**Status**: ✅ APPROVED

### Decision

Follow AutoCAD/BricsCAD pattern - clicking first point closes polygon.

### Behavior

1. User draws polygon points
2. User clicks near first point
3. Polygon automatically closes
4. Drawing completes

---

## 🎯 **ADR-048: UNIFIED GRIP RENDERING SYSTEM**

**Date**: 2027-01-27
**Status**: ✅ APPROVED

### Decision

Single grip renderer using Facade Pattern.

### Canonical Component

```typescript
import { UnifiedGripRenderer } from '@/subapps/dxf-viewer/canvas-v2/overlays/UnifiedGripRenderer';

// Result: ~90 lines duplicate code removed
```

---

## 🚚 **ADR-049: UNIFIED MOVE TOOL**

**Date**: 2027-01-27
**Status**: ✅ APPROVED

### Decision

Single move tool for both DXF entities and overlays.

### Canonical Command

```typescript
import { MoveOverlayCommand } from '@/subapps/dxf-viewer/core/commands/MoveOverlayCommand';

// 380+ lines, Command Pattern with undo/redo
```

---

## 💾 **ADR-055: CENTRALIZED TOOL STATE PERSISTENCE**

**Date**: 2026-01-30
**Status**: ✅ APPROVED

### Decision

Tool state persisted through `ToolStateStore` with `useSyncExternalStore`.

### Canonical API

```typescript
import { ToolStateStore, useToolState } from '@/subapps/dxf-viewer/stores/ToolStateStore';

// ✅ CANONICAL
const { currentTool, setTool } = useToolState();

// ❌ PROHIBITED
const [tool, setTool] = useState<ToolType>('select'); // Local state!
```

### Property

```typescript
// Tools that allow continuous drawing
interface ToolConfig {
  allowsContinuous: boolean;
}
```

---

## 📚 **RELATED DOCUMENTATION**

- **[ADR Index](../reference/adr-index.md)** - Complete ADR listing
- **[Drawing System](../data-systems/drawing-system.md)** - Drawing tools
- **[Canvas System](../ui-systems/canvas-system.md)** - Canvas interaction

---

> **🔄 Last Updated**: 2026-01-31
>
> **👥 Maintainers**: Γιώργος Παγώνης + Claude Code (Anthropic AI)
