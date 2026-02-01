# ADR-075: Grip Size Multipliers Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Drawing System |
| **Canonical Location** | `GRIP_SIZE_MULTIPLIERS` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `GRIP_SIZE_MULTIPLIERS` from `rendering/grips/constants.ts`
- **Impact**: Fixed **visual inconsistency** - grips had different sizes (1.2/1.4 vs 1.25/1.5)
- **Standard Values** (AutoCAD/BricsCAD):
  - `COLD`: 1.0 (normal state)
  - `WARM`: 1.25 (hover state, +25%)
  - `HOT`: 1.5 (active/drag state, +50%)
- **Files Migrated**:
  - `LayerRenderer.ts` - Overlay grip rendering (was 1.2/1.4, now 1.25/1.5)
  - `GripProvider.tsx` - Grip context helper (was 1.2/1.4, now 1.25/1.5)
  - `BaseEntityRenderer.ts` - Entity grip rendering (was hardcoded 1.25/1.5)
  - `adapters/ZustandToConsolidatedAdapter.ts` - Line hover width (uses HOT for 1.5x effect)
  - `rendering/ui/snap/SnapRenderer.ts` - Snap indicator highlight mode (uses HOT)
  - `rendering/ui/cursor/CursorRenderer.ts` - Cursor highlight mode (uses HOT)
- **Extended Usage**: `GRIP_SIZE_MULTIPLIERS.HOT` (1.5) χρησιμοποιείται για όλα τα highlight/emphasis effects σε UI elements (όχι μόνο grips)
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Zero grip size inconsistency (all grips use same multipliers)
  - AutoCAD-standard visual feedback
  - Single place to change grip size behavior
  - Unified highlight multiplier για grips, snap indicators, cursors, και line hover
- **Companion**: ADR-048 (Unified Grip Rendering System)
