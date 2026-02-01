# ADR-138: Overlay Dimensions Centralization

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-01-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `OVERLAY_DIMENSIONS` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `OVERLAY_DIMENSIONS` from `utils/hover/config.ts`
- **Decision**: Centralize all overlay UI dimension constants (crosshair, snap, move arrows)
- **Status**: ✅ IMPLEMENTED
- **Problem**: Magic numbers scattered across files with inconsistencies:
  - OverlayPass.ts: `size = 20` (crosshair), `arrowSize = 8` (move cursor), `size = 8` (snap crosshair)
  - radius-utils.ts: fallback `|| 15` (conflicted with `gripAvoidance: 20`)
  - SnapIndicatorOverlay.tsx: `SNAP_INDICATOR_SIZE = 12`
- **Solution**: Single source of truth in existing hover config:
  ```typescript
  export const OVERLAY_DIMENSIONS = {
    SNAP_INDICATOR: 12,    // Snap indicator marker size (pixels)
    CROSSHAIR: 20,         // Crosshair cursor size (pixels)
    MIN_MARQUEE: 5,        // Minimum marquee selection size
    MOVE_ARROW: 8,         // 4-way arrow indicator size
    SNAP_CROSSHAIR: 8,     // Snap crosshair in OverlayPass
  } as const;
  ```
- **Files Migrated**:
  - `rendering/passes/OverlayPass.ts` - CROSSHAIR, MOVE_ARROW, SNAP_CROSSHAIR
  - `utils/hover/radius-utils.ts` - Removed fallback `|| 15` (HOVER_CONFIG.offsets.gripAvoidance always defined)
- **Benefits**:
  - Eliminates magic numbers in rendering code
  - Ensures visual consistency across overlays
  - Documents purpose of each constant
- **Companion**: ADR-137 (Snap Icon Geometry), ADR-075 (Grip Size Multipliers)
