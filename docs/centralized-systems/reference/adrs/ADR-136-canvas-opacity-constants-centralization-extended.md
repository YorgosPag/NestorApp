# ADR-136: Canvas Opacity Constants Centralization (Extended)

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-01-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `OPACITY` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `OPACITY` from `config/color-config.ts`
- **Decision**: Extend OPACITY constant with additional values for complete coverage
- **Status**: ✅ IMPLEMENTED
- **Problem**: 68+ hardcoded opacity values in 25+ files; original OPACITY constant missing values (0.85, 0.95, 0.4)
- **Solution**: Extended OPACITY constant with new semantic values:
  ```typescript
  export const OPACITY = {
    OPAQUE: 1.0,        // Full opacity - no transparency
    VERY_HIGH: 0.95,    // Near-opaque (electrical cables, critical elements)
    HIGH: 0.9,          // Snap indicators, preview lines
    MEDIUM_HIGH: 0.85,  // Constraints, furniture lines
    MEDIUM: 0.8,        // Selection, cursor, axes (CHANGED from 0.7)
    MEDIUM_LOW: 0.7,    // Regions, secondary elements
    SUBTLE: 0.6,        // Origin markers, subtle overlays
    LOW: 0.5,           // PDF backgrounds, disabled states
    DISABLED: 0.4,      // Disabled menu items
    VERY_LOW: 0.3,      // Grid opacity
    FAINT: 0.1,         // Barely visible elements
  } as const;
  ```
- **Files Migrated (Phase 1)**:
  - `rendering/ui/snap/SnapTypes.ts` - opacity: 0.9 → OPACITY.HIGH
  - `rendering/ui/cursor/CursorTypes.ts` - opacity: 0.8 → OPACITY.MEDIUM
  - `rendering/ui/origin/OriginMarkersTypes.ts` - opacity: 0.8 → OPACITY.MEDIUM
  - `rendering/ui/grid/GridTypes.ts` - opacity: 0.3 → OPACITY.VERY_LOW
  - `canvas-v2/preview-canvas/PreviewRenderer.ts` - opacity: 0.9 → OPACITY.HIGH
  - `utils/region-operations.ts` - opacity: 0.7 → OPACITY.MEDIUM_LOW (x2)
- **Benefits**:
  - Complete opacity spectrum (11 values vs original 7)
  - Semantic naming for all use cases
  - Zero hardcoded values in UI rendering types
- **Companion**: ADR-120 (Original Opacity Centralization), ADR-004 (Canvas Theme)
