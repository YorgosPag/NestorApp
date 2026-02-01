# ADR-144: Icon Click Sequence Colors Centralization

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-01 |
| **Category** | UI Components |
| **Canonical Location** | `ICON_CLICK_COLORS` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `ICON_CLICK_COLORS` in `config/color-config.ts`
- **Decision**: Centralize all icon click sequence colors (Red→Orange→Green pattern)
- **Status**: ✅ IMPLEMENTED
- **Date**: 2026-02-01
- **Problem**: Identical `CLICK_COLORS` constant duplicated across 5 icon files:
  - `ui/toolbar/icons/LineIcon.tsx` (lines 19-24)
  - `ui/toolbar/icons/CircleIcon.tsx` (lines 7-11)
  - `ui/toolbar/icons/ArcIcon.tsx` (lines 23-27)
  - `ui/toolbar/icons/shared/AngleIconBase.tsx` (lines 18-22)
  - `ui/toolbar/icons/AngleTwoArcsIcon.tsx` (lines 17-21)
  - All 5 files had identical values:
    - FIRST: `#ef4444` (Red - 1st click)
    - SECOND: `#f97316` (Orange - 2nd click)
    - THIRD: `#22c55e` (Green - last click)
    - REFERENCE: `#9ca3af` (Gray - reference line, only in LineIcon)
- **Solution**: Single centralized constant in `color-config.ts`:
  ```typescript
  // 🏢 ADR-144: ICON CLICK SEQUENCE COLORS
  export const ICON_CLICK_COLORS = {
    FIRST: '#ef4444',     // 🔴 Red - 1st click (start point)
    SECOND: '#f97316',    // 🟠 Orange - 2nd click (intermediate)
    THIRD: '#22c55e',     // 🟢 Green - 3rd/last click (end point)
    REFERENCE: '#9ca3af', // Gray - Reference line (perpendicular/parallel)
  } as const;
  ```
- **Files Migrated** (5 files):
  - `ui/toolbar/icons/LineIcon.tsx` - Import ICON_CLICK_COLORS
  - `ui/toolbar/icons/CircleIcon.tsx` - Import ICON_CLICK_COLORS
  - `ui/toolbar/icons/ArcIcon.tsx` - Import ICON_CLICK_COLORS
  - `ui/toolbar/icons/shared/AngleIconBase.tsx` - Import ICON_CLICK_COLORS
  - `ui/toolbar/icons/AngleTwoArcsIcon.tsx` - Import ICON_CLICK_COLORS
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - 5x duplicate elimination (5 local constants → 1 centralized)
  - Consistent color coding across all drawing tool icons
  - Easy global theme changes (e.g., color blind friendly palette)
  - JSDoc documentation for each color's semantic meaning
  - Type-safe with `IconClickColor` type export
- **Companion**: ADR-026 (DXF Toolbar Colors), ADR-042 (UI Fonts)
