# 🖼️ **OVERLAY SYSTEMS**

> **Enterprise Documentation**: Canvas overlays, crosshairs, rulers, and visual feedback systems

**📊 Stats**: 3 ADRs | Last Updated: 2026-01-31

---

## 🎯 **RELATED ADRs**

| ADR | Decision | Status |
|-----|----------|--------|
| **ADR-006** | Crosshair Overlay Consolidation | ✅ APPROVED |
| **ADR-009** | Ruler Corner Box Interactive | ✅ APPROVED |
| **ADR-045** | Viewport Ready Guard | ✅ APPROVED |

---

## 🎨 **ADR-006: CROSSHAIR OVERLAY CONSOLIDATION**

**Date**: 2026-01-03
**Status**: ✅ APPROVED

### Decision

Centralize crosshair rendering to a single overlay component.

### Canonical Component

```typescript
// ✅ CANONICAL
import { CrosshairOverlay } from '@/subapps/dxf-viewer/canvas-v2/overlays/CrosshairOverlay';

// ❌ DEPRECATED (DELETED)
// canvas/CrosshairOverlay.tsx (495 lines)
```

### Features

- Real-time cursor tracking
- Coordinate display
- Theme-aware styling
- Snap point indicators
- Performance-optimized rendering

---

## 📐 **ADR-009: RULER CORNER BOX INTERACTIVE**

**Date**: 2026-01-04
**Status**: ✅ APPROVED

### Decision

The ruler corner box provides interactive zoom controls.

### Canonical Component

```typescript
import { RulerCornerBox } from '@/subapps/dxf-viewer/canvas-v2/overlays/RulerCornerBox';
```

### Interactions

| Action | Result |
|--------|--------|
| **Single Click** | Fit to extents |
| **Double Click** | Reset to 100% |
| **Ctrl+Click** | Previous zoom level |

---

## 🎯 **ADR-045: VIEWPORT READY GUARD**

**Date**: 2027-01-27
**Status**: ✅ APPROVED

### Decision

Use fresh viewport bounds with centralized margins for coordinate calculations.

### Pattern

```typescript
import { COORDINATE_LAYOUT } from '@/subapps/dxf-viewer/config/coordinate-layout';

// ✅ CORRECT: Fresh viewport + margins
const rect = canvas.getBoundingClientRect();
const x = (e.clientX - rect.left - COORDINATE_LAYOUT.MARGINS.left);

// ❌ WRONG: Hardcoded margins
const x = (e.clientX - rect.left - 80); // Hardcoded!
```

### Fix

Resolved first-click offset bug (~80px) by using centralized margins.

---

## 📚 **RELATED DOCUMENTATION**

- **[Canvas & Rendering ADRs](../reference/adr-index.md#-canvas--rendering)** - Complete canvas ADRs
- **[Design Tokens](../design-system/tokens.md)** - Visual styling tokens
- **[Canvas System](./canvas-system.md)** - Canvas coordinate system

---

> **🔄 Last Updated**: 2026-01-31
>
> **👥 Maintainers**: Γιώργος Παγώνης + Claude Code (Anthropic AI)
