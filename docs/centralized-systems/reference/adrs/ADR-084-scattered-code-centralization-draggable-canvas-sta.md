# ADR-084: Scattered Code Centralization (Draggable + Canvas State)

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `FloatingPanel` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Decision**: Centralize scattered draggable logic and canvas state operations
- **Two Components**:
  1. **CursorSettingsPanel Refactor** - 70+ lines manual drag → FloatingPanel
  2. **withCanvasState() Helper** - 89 hardcoded ctx.fillStyle/strokeStyle → centralized

#### Part 1: CursorSettingsPanel Migration
- **Before**: Manual drag state, mouse handlers, event listeners (70 lines)
- **After**: FloatingPanel compound component (10 lines)
- **Canonical**: `FloatingPanel` from `@/components/ui/floating`
- **File Changed**: `ui/CursorSettingsPanel.tsx`
- **Result**: -60 lines, consistent with other floating panels

#### Part 2: Canvas State Helper
- **Canonical**: `withCanvasState()` from `rendering/canvas/withCanvasState.ts`
- **API**:
  - `withCanvasState(ctx, style, callback)` - Save/restore pattern
  - `withCanvasStateAsync(ctx, style, callback)` - Async version
  - `applyCanvasStyle(ctx, style)` - Apply style options
  - `setFillStyle(ctx, color, opacity?)` - Set fill with optional opacity
  - `setStrokeStyle(ctx, color, width?, dash?)` - Set stroke with optional width/dash
  - `resetCanvasState(ctx)` - Reset to defaults
- **Type**: `CanvasStyleOptions` - All canvas style properties
- **Supports Config Keys**: `lineWidth: 'NORMAL'`, `lineDash: 'DASHED'`

#### Migration Example
```typescript
// Before (scattered code):
ctx.save();
ctx.fillStyle = UI_COLORS.WHITE;
ctx.globalAlpha = 0.5;
ctx.fillRect(0, 0, width, height);
ctx.restore();

// After (centralized):
import { withCanvasState } from '../canvas/withCanvasState';

withCanvasState(ctx, { fill: UI_COLORS.WHITE, opacity: 0.5 }, () => {
  ctx.fillRect(0, 0, width, height);
});
```

- **Migration Strategy**: On-touch migration for 56 files with canvas state operations
- **Files Created**:
  - `rendering/canvas/withCanvasState.ts` (~100 lines)
- **Files Changed**:
  - `ui/CursorSettingsPanel.tsx` (-60 lines, +20 lines)
  - `rendering/canvas/index.ts` (new exports)
- **Companion**: ADR-003 (FloatingPanel), ADR-044 (Line Widths), ADR-083 (Line Dash)
