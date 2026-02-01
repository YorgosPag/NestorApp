# ADR-094: Device Pixel Ratio Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `getDevicePixelRatio()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `getDevicePixelRatio()` from `systems/cursor/utils.ts`
- **Decision**: Centralize inline `window.devicePixelRatio || 1` patterns to SSR-safe centralized function
- **Problem**: 10+ inline occurrences of `window.devicePixelRatio || 1` across 6 files:
  - `canvas-v2/preview-canvas/PreviewRenderer.ts`: 3 occurrences (lines 151, 160, 220)
  - `debug/CursorSnapAlignmentDebugOverlay.ts`: 2 occurrences (lines 102, 252)
  - `rendering/canvas/utils/CanvasUtils.ts`: 2 occurrences (lines 43, 124)
  - `rendering/canvas/core/CanvasSettings.ts`: 1 occurrence (line 184)
  - `systems/zoom/ZoomManager.ts`: 1 occurrence (line 162)
- **SSR Risk**: Inline `window.devicePixelRatio` without checks fails in SSR environments
- **Solution**: Use existing centralized function (already present in cursor/utils.ts):
  ```typescript
  export function getDevicePixelRatio(): number {
    return typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  }
  ```
- **API**:
  - `getDevicePixelRatio()` - Returns current device pixel ratio (SSR-safe, defaults to 1)
- **Pattern**: Single Source of Truth (SSOT) for DPR access
- **Benefits**:
  - SSR-safe by default (no `window is not defined` errors)
  - Consistent fallback value (always 1)
  - Single point of change if DPR handling logic changes
  - Testable (can mock in unit tests)
- **Files Migrated**:
  - `canvas-v2/preview-canvas/PreviewRenderer.ts` - 3 replacements
  - `debug/CursorSnapAlignmentDebugOverlay.ts` - 2 replacements
  - `rendering/canvas/utils/CanvasUtils.ts` - 2 replacements
  - `rendering/canvas/core/CanvasSettings.ts` - 1 replacement
  - `systems/zoom/ZoomManager.ts` - 1 replacement
- **Skipped**: `automatedTests.ts` - Test file, inline DPR is acceptable
- **Companion**: ADR-043 (Zoom Constants), ADR-044 (Canvas Line Widths), ADR-088 (Pixel-Perfect Rendering)
