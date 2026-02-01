# ADR-150: Arrow Head Size Centralization

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `OVERLAY_DIMENSIONS.ARROW_HEAD` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `OVERLAY_DIMENSIONS.ARROW_HEAD` from `utils/hover/config.ts`
- **Decision**: Centralize arrow head / marker size (8px) to single source of truth
- **Status**: ✅ IMPLEMENTED
- **Date**: 2026-02-01
- **Problem**: Duplicate hardcoded `8` (pixels) for arrow/marker sizes in 2 files:
  - `rendering/utils/ghost-entity-renderer.ts:488` - `arrowSize = 8` for ghost delta display arrows
  - `rendering/entities/LineRenderer.ts:173` - `markerSize = 8` for perpendicular markers on dimension lines
  - Risk: Visual inconsistency if one is changed without the other
- **Solution**: Add `ARROW_HEAD: 8` to existing `OVERLAY_DIMENSIONS` constant object:
  ```typescript
  // 🏢 ADR-150: Centralized arrow/marker size for visual consistency
  export const OVERLAY_DIMENSIONS = {
    // ... existing constants ...
    ARROW_HEAD: 8,  // Arrow head size for directional indicators (pixels)
  } as const;
  ```
- **Files Migrated** (2 files):
  - `rendering/utils/ghost-entity-renderer.ts`:
    - Before: `const arrowSize = 8;`
    - After: `const arrowSize = OVERLAY_DIMENSIONS.ARROW_HEAD;`
  - `rendering/entities/LineRenderer.ts`:
    - Before: `const markerSize = 8;`
    - After: `const markerSize = OVERLAY_DIMENSIONS.ARROW_HEAD;`
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Visual consistency between ghost entity arrows and dimension line markers
  - Single place to adjust arrow/marker size for all UI elements
  - Follows established OVERLAY_DIMENSIONS centralization pattern (ADR-138)
- **Companion**: ADR-138 (Overlay Dimensions Centralization)
