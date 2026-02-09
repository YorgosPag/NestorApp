# Refactor Log

**Date**: 2026-02-09
**Topic**: Canvas background color centralization (AutoCAD dark)

## Entry 1
- What changed: Replaced hardcoded canvas background fallback `#1a1a1a` with `UI_COLORS.CANVAS_BACKGROUND_AUTOCAD_DARK` and added the centralized constant.
- Why: Enforce zero hardcoded values and keep the AutoCAD dark background consistent across adapters.
- Central system used: `src/subapps/dxf-viewer/config/color-config.ts` (UI_COLORS_BASE/UI_COLORS).
- Files touched: `src/subapps/dxf-viewer/config/color-config.ts`, `src/adapters/canvas/geo-adapter/GeoCanvasAdapter.ts`, `src/adapters/canvas/dxf-adapter/DxfCanvasAdapter.ts`.
- How tested: pnpm -w run lint (FAILED: exit 1; repo-wide lint errors). Typecheck/tests/build not run (stopped on first failing gate).
- Risk: Low. Default value only; same color value via centralized constant.

