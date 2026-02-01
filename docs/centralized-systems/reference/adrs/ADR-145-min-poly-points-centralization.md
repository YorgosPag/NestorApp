# ADR-145: MIN_POLY_POINTS Centralization

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-01 |
| **Category** | Data & State |
| **Canonical Location** | `MIN_POLY_POINTS` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `MIN_POLY_POINTS` in `config/tolerance-config.ts`
- **Decision**: Centralize minimum vertices constant for polygon validation
- **Status**: ✅ IMPLEMENTED
- **Date**: 2026-02-01
- **Problem**: Same constant `= 3` (minimum vertices for polygon) existed in 3 places:
  - `config/tolerance-config.ts:55` - `MIN_POLY_POINTS = 3` (centralized)
  - `overlays/overlay-store.tsx:314` - `MIN_VERTICES = 3` (local duplicate)
  - `systems/phase-manager/drag-measurements/PolylineDragMeasurement.ts:20` - `MIN_VERTICES_FOR_AREA = 3` (local duplicate)
- **Risk**: If only one of the three was changed, inconsistency would occur
- **Solution**: Import existing centralized `MIN_POLY_POINTS` from tolerance-config:
  ```typescript
  // 🏢 ADR-145: Centralized MIN_POLY_POINTS constant
  import { MIN_POLY_POINTS } from '../config/tolerance-config';

  // Usage: minimum vertices for valid polygon
  if (polygon.length <= MIN_POLY_POINTS) { ... }
  ```
- **Files Migrated** (2 files):
  - `overlays/overlay-store.tsx` - removeVertex() validation
  - `systems/phase-manager/drag-measurements/PolylineDragMeasurement.ts` - area calculation check
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - 2x duplicate elimination (3 constants → 1 centralized)
  - Consistency guaranteed: change in one place = change everywhere
  - Semantic clarity: polygon validation uses same constant as area calculation
- **Companion**: ADR-099 (Polygon Tolerances), ADR-034 (Geometry Calculations)
