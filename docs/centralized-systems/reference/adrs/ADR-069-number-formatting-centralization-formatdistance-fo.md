# ADR-069: Number Formatting Centralization (formatDistance/formatAngle)

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Data & State |
| **Canonical Location** | `formatDistance()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `formatDistance()`, `formatAngle()` from `distance-label-utils.ts`
- **Impact**: 2 duplicate formatDistance implementations → 1 canonical
- **Files Migrated**:
  - `distance-label-utils.ts` - Canonical source (added formatAngle)
  - `useDynamicInputMultiPoint.ts` - Re-exports from canonical (backward compatibility)
- **Pattern**: Single Source of Truth (SSOT)
- **API**:
  - `formatDistance(distance: number, decimals?: number): string` (default: 2 decimals)
  - `formatAngle(angle: number, decimals?: number): string` (default: 1 decimal, includes °)
- **Benefits**:
  - Zero duplicate number formatting code
  - Configurable decimal precision
  - Consistent formatting across DXF Viewer
  - Special case handling for near-zero values
- **Companion**: ADR-065 (Distance Calc), ADR-066 (Angle Calc), ADR-041 (Distance Labels)
