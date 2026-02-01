# ADR-103: Angular Constants Centralization (RIGHT_ANGLE, ARROW_ANGLE)

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Data & State |
| **Canonical Location** | `RIGHT_ANGLE` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `RIGHT_ANGLE`, `ARROW_ANGLE` from `rendering/entities/shared/geometry-utils.ts`
- **Impact**: 18 inline `Math.PI / 2` and `Math.PI / 6` patterns → 2 constants
- **Constants Added**:
  - `RIGHT_ANGLE = Math.PI / 2` (≈ 1.5708 rad = 90°)
  - `ARROW_ANGLE = Math.PI / 6` (≈ 0.5236 rad = 30°)
- **Files Migrated** (10 files, 18 replacements):
  - `utils/hover/text-labeling-utils.ts` - Text flip check (1× RIGHT_ANGLE)
  - `utils/hover/edge-utils.ts` - Text flip check (1× RIGHT_ANGLE)
  - `systems/rulers-grid/utils.ts` - Vertical ruler text rotation (2× RIGHT_ANGLE)
  - `canvas-v2/layer-canvas/LayerRenderer.ts` - Vertical ruler text rotation (1× RIGHT_ANGLE)
  - `snapping/engines/TangentSnapEngine.ts` - Tangent point calculation (4× RIGHT_ANGLE)
  - `rendering/ui/ruler/RulerRenderer.ts` - Vertical ruler text rotation (1× RIGHT_ANGLE)
  - `rendering/entities/shared/distance-label-utils.ts` - Text flip check (2× RIGHT_ANGLE)
  - `rendering/entities/BaseEntityRenderer.ts` - Text flip check (1× RIGHT_ANGLE)
  - `rendering/passes/BackgroundPass.ts` - Vertical ruler text rotation (1× RIGHT_ANGLE)
  - `rendering/utils/ghost-entity-renderer.ts` - Arrow head rendering (4× ARROW_ANGLE)
- **Pattern**: Single Source of Truth (SSOT)
- **API**:
  ```typescript
  import { RIGHT_ANGLE, ARROW_ANGLE } from './geometry-utils';

  // Text flip check (if angle > 90°, flip text)
  if (Math.abs(textAngle) > RIGHT_ANGLE) {
    textAngle += Math.PI;
  }

  // Arrow head rendering (30° angle)
  ctx.lineTo(x - size * Math.cos(angle - ARROW_ANGLE), ...);
  ctx.lineTo(x - size * Math.cos(angle + ARROW_ANGLE), ...);
  ```
- **Benefits**:
  - Zero inline angular magic numbers
  - Semantic constant names (`RIGHT_ANGLE` vs `Math.PI / 2`)
  - Single point of documentation
  - Consistent angular calculations across codebase
- **Companion**: ADR-077 (TAU Constant), ADR-067 (Radians/Degrees Conversion), ADR-068 (Angle Normalization)
