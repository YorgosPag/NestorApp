# ADR-091: Scattered Code Centralization (Fonts + Formatting)

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | Design System |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Decision**: Migrate hardcoded `ctx.font` strings and inline `.toFixed()` calls to centralized systems
- **Problem**: Two categories of scattered code identified:
  - **42 hardcoded `ctx.font`** strings across 22 files (e.g., `'12px Inter'`, `'14px Arial'`)
  - **245 inline `.toFixed()`** patterns across 94 files (e.g., `radius.toFixed(2)`)
- **Solution**: Use existing centralized systems from ADR-042 and ADR-069
- **Phase 1 Migrations** (15 high-impact files):
  - **Font Migrations** (8 files):
    - `CollaborationOverlay.tsx` → `UI_FONTS.INTER.NORMAL`, `UI_FONTS.INTER.BOLD_SMALL`
    - `PreviewRenderer.ts` → `UI_FONTS.ARIAL.LARGE`
    - `overlay-drawing.ts` → `UI_FONTS.SYSTEM.NORMAL`
    - `CursorSnapAlignmentDebugOverlay.ts` → `UI_FONTS.ARIAL.BOLD`
    - `hover/config.ts` → `UI_FONTS.ARIAL.SMALL`, `UI_FONTS.ARIAL.LARGE`
    - `ghost-entity-renderer.ts` → `UI_FONTS.MONOSPACE.SMALL`
    - `BaseDragMeasurementRenderer.ts` → `UI_FONTS.ARIAL.NORMAL`
    - `text-spline-renderers.ts` → `UI_FONTS.ARIAL.LARGE`
  - **Formatting Migrations** (7 files):
    - `CircleRenderer.ts` → `formatDistance()` for diameter/radius
    - `ArcRenderer.ts` → `formatDistance()`, `formatAngle()`
    - `BaseEntityRenderer.ts` → `formatDistance()`, `formatAngle()`
    - `BaseDragMeasurementRenderer.ts` → `formatDistance()`, `formatAngle()`
- **New UI_FONTS Addition**:
  - `UI_FONTS.INTER` - For collaboration overlays and modern UI elements
    - `SMALL`: `'10px Inter, sans-serif'`
    - `NORMAL`: `'12px Inter, sans-serif'`
    - `BOLD_SMALL`: `'bold 10px Inter, sans-serif'`
- **Pattern**: On-touch migration (Phase 2 covers remaining files as they're edited)
- **Canonical Sources**:
  - Fonts: `UI_FONTS` from `config/text-rendering-config.ts` (ADR-042)
  - Formatting: `formatDistance()`, `formatAngle()` from `distance-label-utils.ts` (ADR-069)
- **Benefits**:
  - Zero hardcoded font strings in migrated files
  - Consistent number formatting across all entity renderers
  - Single point of change for typography and precision
  - Future locale-aware formatting support via `formatDistanceLocale()`
- **Companion**: ADR-042 (UI Fonts), ADR-069 (formatDistance/formatAngle), ADR-082 (FormatterRegistry)
