# ADR-146: Canvas Size Observer Hook Centralization

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `useCanvasSizeObserver` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `useCanvasSizeObserver` from `hooks/canvas/useCanvasSizeObserver.ts`
- **Decision**: Centralize ResizeObserver + canvas size setup pattern to single reusable hook
- **Status**: ✅ IMPLEMENTED
- **Date**: 2026-02-01
- **Problem**: Duplicate ResizeObserver setup code (~35-18 lines) in 2 files:
  - `canvas-v2/overlays/CrosshairOverlay.tsx` (lines 105-140): ~35 lines ResizeObserver + DPI canvas sizing
  - `canvas-v2/preview-canvas/PreviewCanvas.tsx` (lines 159-176): ~18 lines ResizeObserver + renderer.updateSize()
  - Both files had identical patterns:
    - Create ResizeObserver
    - Observe canvas element
    - Handle zero-dimension check
    - Call resize callback
    - Disconnect on cleanup
- **Solution**: Single Source of Truth hook:
  ```typescript
  // 🏢 ADR-146: Centralized Canvas Size Observer Hook
  export interface UseCanvasSizeObserverOptions {
    canvasRef: RefObject<HTMLCanvasElement | null>;
    onSizeChange: (canvas: HTMLCanvasElement) => void;
    skipZeroDimensions?: boolean;  // Default: true
  }

  export function useCanvasSizeObserver(options: UseCanvasSizeObserverOptions): void;
  ```
- **Files Migrated** (2 files):
  - `canvas-v2/overlays/CrosshairOverlay.tsx`:
    - Before: ~35 lines manual ResizeObserver setup
    - After: ~10 lines with `useCanvasSizeObserver({ canvasRef, onSizeChange: handleCanvasSizeChange })`
  - `canvas-v2/preview-canvas/PreviewCanvas.tsx`:
    - Before: ~18 lines manual ResizeObserver setup
    - After: ~5 lines with `useCanvasSizeObserver({ canvasRef, onSizeChange })`
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - ~53 lines duplicate code eliminated (35 + 18 lines)
  - Consistent ResizeObserver pattern across all canvas components
  - `skipZeroDimensions` option prevents invalid canvas operations
  - Proper cleanup via `disconnect()` guaranteed
  - Reusable for future canvas components
  - Works seamlessly with:
    - `CanvasUtils.setupCanvasContext()` (ADR-115)
    - `getDevicePixelRatio()` (ADR-094)
    - `toDevicePixels()` (ADR-117)
- **Companion**: ADR-115 (Canvas Context Setup), ADR-118 (useCanvasResize), ADR-094 (Device Pixel Ratio), ADR-117 (toDevicePixels)
