# ADR-085: Split Line Rendering Centralization

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Drawing System |
| **Canonical Location** | `renderSplitLineWithGap()` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `renderSplitLineWithGap()`, `renderLineWithTextCheck()` from `rendering/entities/shared/line-rendering-utils.ts`
- **Decision**: Centralize split line rendering logic (line with gap for distance text)
- **Problem**: 2 parallel implementations with inconsistent gap sizes:
  - `BaseEntityRenderer.renderSplitLineWithGap()`: 30px gap, phase-aware
  - `line-rendering-utils.renderSplitLineWithGap()`: 40px gap, standalone
- **Solution**: Single Source of Truth in `line-rendering-utils.ts`
- **Gap Size**: Unified to `RENDER_GEOMETRY.SPLIT_LINE_GAP` (30px) from ADR-048
- **Gap Calculation**: Uses `calculateSplitLineGap()` from `line-utils.ts`
- **API**:
  - `renderSplitLineWithGap(ctx, startScreen, endScreen, gapSize?)` - Draw line with centered gap
  - `renderLineWithTextCheck(ctx, startScreen, endScreen, gapSize?)` - Conditional gap based on text settings
  - `renderContinuousLine(ctx, startScreen, endScreen)` - Draw solid line (no gap)
- **Files Changed**:
  - `line-rendering-utils.ts` - Canonical source, uses centralized gap calculation
  - `BaseEntityRenderer.ts` - Delegates to centralized utilities
- **Consumers**:
  - LineRenderer, PolylineRenderer, RectangleRenderer, AngleMeasurementRenderer (via BaseEntityRenderer)
  - CircleRenderer (via line-rendering-utils.ts)
- **Pattern**: Single Source of Truth (SSOT) + Delegation
- **Benefits**:
  - Zero duplicate split line rendering code
  - Consistent 30px gap across all renderers
  - Phase-aware behavior preserved in BaseEntityRenderer
  - CircleRenderer now uses same gap size as other renderers
- **Companion**: ADR-048 (RENDER_GEOMETRY), ADR-044 (Line Widths), ADR-065 (Distance Calculation)
