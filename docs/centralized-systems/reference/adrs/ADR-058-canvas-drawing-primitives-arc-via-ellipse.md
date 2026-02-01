# ADR-058: Canvas Drawing Primitives (Arc via Ellipse)

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Canvas & Rendering |
| **Canonical Location** | `rendering/primitives/canvasPaths.ts` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `rendering/primitives/canvasPaths.ts`
- **Decision**: Use `ctx.ellipse()` instead of `ctx.arc()` for all circle/arc rendering
- **Background**: `ctx.arc()` found unreliable with HiDPI canvas transforms
- **API**: `drawCircle()`, `drawArc()`, `addCirclePath()`, `addArcPath()`, `TAU`
- **Migration**: 23 files updated to use centralized primitives
- **Files Migrated**:
  - CircleRenderer.ts, EllipseRenderer.ts, BaseEntityRenderer.ts
  - SnapRenderer.ts, CursorRenderer.ts, OriginMarkersRenderer.ts, GridRenderer.ts
  - OverlayPass.ts, BackgroundPass.ts, ghost-entity-renderer.ts
  - angle-utils.ts, dot-rendering-utils.ts, GripShapeRenderer.ts
- **Exceptions**:
  - Canvas2DContext.ts (low-level wrapper - must keep raw API)
  - EllipseRenderer.ts (uses ctx.ellipse for actual ellipses with different radii)
