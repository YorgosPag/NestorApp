# ADR-095: Snap Tolerance Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `SNAP_TOLERANCE` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `SNAP_TOLERANCE` from `config/tolerance-config.ts`
- **Decision**: Centralize hardcoded `tolerance = 10` patterns to existing centralized constant
- **Problem**: 7 hardcoded `tolerance = 10` or `tolerance: 10` patterns across 6 files:
  - `rendering/hitTesting/HitTester.ts`: line 70 - `private snapTolerance = 10;`
  - `rendering/ui/snap/SnapTypes.ts`: line 92 - `tolerance: 10,`
  - `systems/toolbars/utils.ts`: line 357 - `tolerance: 10`
  - `systems/rulers-grid/useRulersGrid.ts`: lines 179-180 - 2x `tolerance: 10`
  - `rendering/canvas/core/CanvasSettings.ts`: line 104 - `tolerance: 10,`
  - `systems/cursor/utils.ts`: line 42 - `tolerance: number = 10`
- **Existing Infrastructure**: `SNAP_TOLERANCE` constant already existed but was not being used!
  ```typescript
  // Already in tolerance-config.ts:
  export const SNAP_TOLERANCE = TOLERANCE_CONFIG.SNAP_DEFAULT; // = 10
  ```
- **Solution**: Simple import migration - replace hardcoded values with centralized constant
- **API**:
  - `SNAP_TOLERANCE` - Default snap tolerance in pixels (10px)
  - `TOLERANCE_CONFIG.SNAP_DEFAULT` - Source constant (10)
- **Pattern**: Single Source of Truth (SSOT) for snap tolerance
- **Benefits**:
  - Single point of change for snap sensitivity
  - Consistent snap behavior across all systems (HitTester, Snap, Grid, Rulers, Cursor)
  - CAD-standard tolerance value (10px matches AutoCAD default)
  - Eliminates risk of inconsistent snap behavior
- **Files Migrated** (6 files, 7 replacements):
  - `rendering/hitTesting/HitTester.ts` - 1 replacement
  - `rendering/ui/snap/SnapTypes.ts` - 1 replacement
  - `systems/toolbars/utils.ts` - 1 replacement
  - `systems/rulers-grid/useRulersGrid.ts` - 2 replacements
  - `rendering/canvas/core/CanvasSettings.ts` - 1 replacement
  - `systems/cursor/utils.ts` - 1 replacement
- **Companion**: ADR-043 (Zoom Constants), ADR-079 (Geometric Precision), ADR-087 (Snap Engine Config)
