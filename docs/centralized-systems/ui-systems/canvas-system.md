# 🖼️ **CANVAS SYSTEM**

> **Enterprise Documentation**: Canvas coordinates, transforms, and rendering pipeline

**📊 Stats**: 5 ADRs | Last Updated: 2026-01-31

---

## 🎯 **RELATED ADRs**

| ADR | Decision | Status |
|-----|----------|--------|
| **ADR-008** | CSS→Canvas Coordinate Contract | ✅ APPROVED |
| **ADR-010** | Panel Type Centralization | ✅ APPROVED |
| **ADR-029** | Canvas V2 Migration | ✅ COMPLETED |
| **ADR-043** | Zoom Constants Consolidation | ✅ APPROVED |
| **ADR-046** | Single Coordinate Transform | ✅ APPROVED |

---

## 📐 **ADR-008: CSS→CANVAS COORDINATE CONTRACT**

**Date**: 2026-01-04
**Status**: ✅ APPROVED

### Decision

Use industry-standard coordinate transformation formula.

### Formula

```typescript
// ✅ CANONICAL Formula (AutoCAD/Figma/Blender pattern)
const canvasX = (e.clientX - rect.left) * (canvas.width / rect.width);
const canvasY = (e.clientY - rect.top) * (canvas.height / rect.height);
```

### Prohibition

```typescript
// ❌ PROHIBITED: Direct getBoundingClientRect() in event handlers
const rect = canvas.getBoundingClientRect(); // Every frame!

// ✅ USE: canvasBoundsService
import { canvasBoundsService } from '@/subapps/dxf-viewer/services/canvasBoundsService';
const bounds = canvasBoundsService.getBounds();
```

---

## 🎯 **ADR-010: PANEL TYPE CENTRALIZATION**

**Date**: 2026-01-04
**Status**: ✅ APPROVED

### Decision

Centralize all panel types in a single definition.

### Canonical Type

```typescript
// ✅ CANONICAL
import type { FloatingPanelType } from '@/subapps/dxf-viewer/types/panel-types';

type FloatingPanelType = 'levels' | 'hierarchy' | 'overlay' | 'colors';
```

---

## 🔄 **ADR-029: CANVAS V2 MIGRATION**

**Date**: 2026-01-25
**Status**: ✅ COMPLETED

### Decision

Complete migration to Canvas V2 architecture.

### Structure

```
canvas-v2/           # ✅ ACTIVE (ONLY system)
├── DxfCanvas.tsx    # Main canvas component
├── overlays/        # Crosshairs, rulers, grips
├── preview-canvas/  # Preview rendering
└── hooks/           # Canvas-specific hooks

_canvas_LEGACY/      # ❌ DEPRECATED (excluded from TypeScript)
```

### API

```typescript
// V2 API: 4 methods (vs V1's 11 methods)
interface DxfCanvasRef {
  fitToExtents(): void;
  zoomToPercent(percent: number): void;
  getTransform(): Transform;
  setTransform(transform: Transform): void;
}
```

---

## 🔍 **ADR-043: ZOOM CONSTANTS CONSOLIDATION**

**Date**: 2027-01-27
**Status**: ✅ APPROVED

### Decision

Single source of truth for all zoom/transform constants.

### Canonical Source

```typescript
// ✅ CANONICAL
import {
  ZOOM_LIMITS,
  ZOOM_FACTORS,
  TRANSFORM_DEFAULTS
} from '@/subapps/dxf-viewer/config/transform-config';

// ❌ DELETED: zoom-constants.ts (middleman)
```

### Constants

| Constant | Value | Use Case |
|----------|-------|----------|
| `ZOOM_LIMITS.MIN` | 0.01 (1%) | Minimum zoom |
| `ZOOM_LIMITS.MAX` | 1000 (100,000%) | Maximum zoom |
| `ZOOM_FACTORS.WHEEL` | 1.1 (10%) | Mouse wheel zoom |
| `ZOOM_FACTORS.BUTTON_IN` | 1.2 (20%) | Toolbar zoom in |

---

## 📍 **ADR-046: SINGLE COORDINATE TRANSFORM**

**Date**: 2027-01-27
**Status**: ✅ APPROVED

### Decision

Pass WORLD coordinates to `onCanvasClick`, not screen coordinates.

### Pattern

```typescript
// ✅ CORRECT: Single transform in event handler
const handleCanvasClick = (worldCoords: Point) => {
  // worldCoords already transformed
  addPoint(worldCoords);
};

// ❌ WRONG: Double conversion
const handleCanvasClick = (screenCoords: Point) => {
  const worldCoords = screenToWorld(screenCoords); // Transform #1
  const drawingCoords = worldToDrawing(worldCoords); // Transform #2 (BUG!)
};
```

### Fix

Resolved ~80px X-axis offset bug caused by double coordinate conversion.

---

## 📚 **RELATED DOCUMENTATION**

- **[ADR Index](../reference/adr-index.md)** - Complete ADR listing
- **[Overlays](./overlays.md)** - Crosshairs, rulers
- **[Drawing System](../data-systems/drawing-system.md)** - Drawing tools

---

> **🔄 Last Updated**: 2026-01-31
>
> **👥 Maintainers**: Γιώργος Παγώνης + Claude Code (Anthropic AI)
