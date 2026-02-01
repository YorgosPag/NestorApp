# ADR-115: Canvas Context Setup Standardization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `CanvasUtils.setupCanvasContext()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `CanvasUtils.setupCanvasContext()` from `rendering/canvas/utils/CanvasUtils.ts`
- **Decision**: Document existing centralized canvas setup function as the Single Source of Truth
- **Status**: ✅ **ALREADY CENTRALIZED** - No code changes needed
- **Current State Analysis**:
  - **Files using centralized function (3/5 = 60%)**:
    - `canvas-v2/layer-canvas/LayerCanvas.tsx` - ✅ Uses `CanvasUtils.setupCanvasContext()`
    - `canvas-v2/dxf-canvas/DxfCanvas.tsx` - ✅ Uses `CanvasUtils.setupCanvasContext()`
    - `rendering/canvas/core/CanvasManager.ts` - ✅ Uses `CanvasUtils.setupCanvasContext()`
  - **Files with acceptable inline pattern (2/5 = 40%)**:
    - `canvas-v2/overlays/CrosshairOverlay.tsx` - Uses ResizeObserver callback (special case)
    - `canvas-v2/preview-canvas/PreviewRenderer.ts` - Standalone class (special case)
  - **Total duplicate lines**: ~20 (negligible)
  - **Pattern consistency**: 100% (all use same DPI pattern)
- **Centralized Function API**:
  ```typescript
  static setupCanvasContext(
    canvas: HTMLCanvasElement,
    config: CanvasConfig
  ): CanvasRenderingContext2D {
    const dpr = config.enableHiDPI ? (config.devicePixelRatio || getDevicePixelRatio()) : 1;
    const rect = canvasBoundsService.getBounds(canvas);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = config.imageSmoothingEnabled !== false;
    return ctx;
  }
  ```
- **Why Inline is Acceptable for 2 Files**:
  - `CrosshairOverlay.tsx`: Uses `ResizeObserver` callback with dimension comparison logic
  - `PreviewRenderer.ts`: Standalone renderer class with different lifecycle
  - Both use `getDevicePixelRatio()` from ADR-094 (centralized DPR)
  - Both follow identical DPI scaling pattern
- **Enterprise Features of CanvasUtils**:
  - Uses `canvasBoundsService` for cached `getBoundingClientRect()` (performance optimization)
  - Uses `getDevicePixelRatio()` from ADR-094 (SSR-safe)
  - Safety checks for invalid canvas elements
  - Full utility suite: `clearCanvas()`, `getCanvasDimensions()`, `screenToCanvas()`, etc.
- **Recommendation**: No refactoring needed - current state is acceptable
- **Benefits**:
  - 60% centralization with 100% pattern consistency
  - ~20 lines of duplicate code (negligible vs 500 estimated)
  - Risk of change outweighs benefit for remaining 2 files
  - Clear documentation of the canonical approach
- **Companion**: ADR-094 (Device Pixel Ratio), ADR-088 (Pixel-Perfect Rendering), ADR-043 (Zoom Constants)
