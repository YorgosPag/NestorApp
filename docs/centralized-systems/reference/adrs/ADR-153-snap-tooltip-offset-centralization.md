# ADR-153: Snap Tooltip Offset Centralization

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `SNAP_TOOLTIP_OFFSET` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `SNAP_TOOLTIP_OFFSET` from `config/tolerance-config.ts`
- **Decision**: Centralize snap tooltip offset (15 pixels) to single source of truth
- **Status**: ✅ IMPLEMENTED
- **Date**: 2026-02-01
- **Problem**: Duplicate hardcoded `15` (pixels) for tooltip offset in 2 files:
  - `rendering/ui/snap/SnapTypes.ts:105` - `tooltipOffset: 15` in DEFAULT_SNAP_SETTINGS
  - `rendering/ui/snap/LegacySnapAdapter.ts:57` - `tooltipOffset: 15` in flatSettings
  - Risk: Visual inconsistency in snap tooltips if one is changed without the other
- **Solution**: Add `SNAP_TOOLTIP_OFFSET` constant to existing `tolerance-config.ts`:
  ```typescript
  // 🏢 ADR-153: Centralized Snap Tooltip Offset (2026-02-01)
  export const SNAP_TOOLTIP_OFFSET = 15;
  ```
- **Files Migrated** (2 files):
  - `rendering/ui/snap/SnapTypes.ts`:
    - Before: `tooltipOffset: 15,`
    - After: `tooltipOffset: SNAP_TOOLTIP_OFFSET,  // 🏢 ADR-153`
  - `rendering/ui/snap/LegacySnapAdapter.ts`:
    - Before: `tooltipOffset: 15,`
    - After: `tooltipOffset: SNAP_TOOLTIP_OFFSET,  // 🏢 ADR-153`
- **Pattern**: Single Source of Truth (SSOT) in tolerance-config.ts
- **Benefits**:
  - Single place to adjust snap tooltip offset
  - Consistent visual feedback across snap rendering systems
  - Follows established snap constants pattern (SNAP_TOLERANCE, SNAP_ENGINE_PRIORITIES)
- **Companion**: ADR-095 (Snap Tolerance), ADR-149 (Snap Engine Priorities)
