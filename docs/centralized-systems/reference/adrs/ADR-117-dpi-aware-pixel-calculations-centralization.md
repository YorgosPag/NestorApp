# ADR-117: DPI-Aware Pixel Calculations Centralization

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `toDevicePixels()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `toDevicePixels()` from `systems/cursor/utils.ts`
- **Decision**: Centralize the `Math.round(cssPixels * dpr)` pattern for canvas buffer sizing
- **Status**: ✅ **IMPLEMENTED** (2026-02-01)
- **Problem**: The pattern `Math.round(value * dpr)` for physical pixel calculations was scattered across 3 files:
  - `canvas-v2/preview-canvas/PreviewRenderer.ts` (lines 170-171)
  - `canvas-v2/overlays/CrosshairOverlay.tsx` (lines 115-116)
  - `rendering/canvas/utils/CanvasUtils.ts` (lines 53-54)
- **Solution**: Create `toDevicePixels()` utility function
- **API**:
  ```typescript
  /**
   * Convert CSS pixels to device/physical pixels
   * @param cssPixels - Value in CSS pixels
   * @param dpr - Device pixel ratio (defaults to current device)
   * @returns Rounded physical pixel value
   */
  export function toDevicePixels(cssPixels: number, dpr?: number): number {
    const ratio = dpr ?? getDevicePixelRatio();
    return Math.round(cssPixels * ratio);
  }
  ```
- **Migration**:
  ```typescript
  // Before (scattered pattern):
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  // After (centralized):
  import { toDevicePixels } from '../../systems/cursor/utils';
  canvas.width = toDevicePixels(width, dpr);
  canvas.height = toDevicePixels(height, dpr);
  ```
- **Files Changed**:
  - `systems/cursor/utils.ts` (+20 lines: `toDevicePixels()` function)
  - `canvas-v2/preview-canvas/PreviewRenderer.ts` (2 replacements)
  - `canvas-v2/overlays/CrosshairOverlay.tsx` (2 replacements)
  - `rendering/canvas/utils/CanvasUtils.ts` (2 replacements)
- **Benefits**:
  - Single Source of Truth for DPI-aware pixel calculations
  - Self-documenting code: `toDevicePixels(width)` vs `Math.round(width * dpr)`
  - Consistent rounding behavior across all canvas operations
  - Easier to test and maintain
- **Companion**: ADR-094 (Device Pixel Ratio), ADR-115 (Canvas Context Setup)
