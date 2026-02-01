# ADR-124: Renderer Constants Centralization (DOT_RADIUS, TEXT_GAP, CIRCLE_LABEL)

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-02-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `RENDER_GEOMETRY` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Status**: ✅ APPROVED
- **Date**: 2026-02-01
- **Canonical**: `RENDER_GEOMETRY`, `TEXT_LABEL_OFFSETS`, `calculateTextGap()`
- **Location**: `config/text-rendering-config.ts`, `rendering/entities/shared/geometry-rendering-utils.ts`
- **Decision**: Centralize duplicate hardcoded values in entity renderers
- **Problem**: 8 hardcoded values across 5 files:
  - `const dotRadius = 4;` in ArcRenderer.ts, EllipseRenderer.ts, LineRenderer.ts
  - `clamp(30 * scale, 20, 60)` in CircleRenderer.ts, LineRenderer.ts
  - `- 25` label offset in CircleRenderer.ts (2 places), SnapModeIndicator.tsx
- **Solution**:
  - Add `RENDER_GEOMETRY.DOT_RADIUS = 4` to text-rendering-config.ts
  - Add `TEXT_LABEL_OFFSETS.CIRCLE_LABEL = 25` to text-rendering-config.ts
  - Add `calculateTextGap(scale)` utility function to geometry-rendering-utils.ts
- **Files Changed** (7 files):
  - `config/text-rendering-config.ts` - Added constants
  - `rendering/entities/shared/geometry-rendering-utils.ts` - Added calculateTextGap()
  - `rendering/entities/ArcRenderer.ts` - Using RENDER_GEOMETRY.DOT_RADIUS
  - `rendering/entities/EllipseRenderer.ts` - Using RENDER_GEOMETRY.DOT_RADIUS
  - `rendering/entities/LineRenderer.ts` - Using RENDER_GEOMETRY.DOT_RADIUS + calculateTextGap()
  - `rendering/entities/CircleRenderer.ts` - Using TEXT_LABEL_OFFSETS.CIRCLE_LABEL + calculateTextGap()
  - `canvas-v2/overlays/SnapModeIndicator.tsx` - Using TEXT_LABEL_OFFSETS.CIRCLE_LABEL
- **Pattern**: Single Source of Truth (SSOT)
- **Benefits**:
  - Single source of truth for rendering constants
  - Easy global adjustments (change once, apply everywhere)
  - Eliminates duplicate formula code
  - Type-safe references
- **Verification**:
  - TypeScript: `npx tsc --noEmit --project src/subapps/dxf-viewer/tsconfig.json`
  - Visual: Draw circle/arc/line entities, verify measurements and dots render correctly
- **Companion**: ADR-091 (Text Label Offsets), ADR-048 (Hardcoded Values), ADR-044 (Canvas Line Widths)
