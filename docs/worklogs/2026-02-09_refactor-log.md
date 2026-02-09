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

## Entry 2
- What changed: Replaced hardcoded `transparent` canvas background default with `UI_COLORS.TRANSPARENT` in GeoCanvasAdapter.
- Why: Enforce zero hardcoded values and keep transparency defaults centralized.
- Central system used: `src/subapps/dxf-viewer/config/color-config.ts` (UI_COLORS_BASE/UI_COLORS).
- Files touched: `src/adapters/canvas/geo-adapter/GeoCanvasAdapter.ts`.
- How tested: `pnpm -w run lint` (FAILED: exit 1; repo-wide lint errors). Typecheck/tests/build not run (stopped on first failing gate).
- Risk: Low. Default value only; same semantic value via centralized constant.

## Entry 3
- What changed: Replaced hardcoded `transparent` default/comparison in CanvasUtils with `UI_COLORS.TRANSPARENT`.
- Why: Enforce zero hardcoded values and keep canvas transparency centralized.
- Central system used: `src/subapps/dxf-viewer/config/color-config.ts` (UI_COLORS_BASE/UI_COLORS).
- Files touched: `src/subapps/dxf-viewer/rendering/canvas/utils/CanvasUtils.ts`.
- How tested: Skipped per instruction (user will run checks).
- Risk: Low. Same semantic value via centralized constant.

## Entry 4
- What changed: Replaced hardcoded `transparent` fill style in SnapRenderer with `UI_COLORS.TRANSPARENT`.
- Why: Enforce zero hardcoded values in rendering primitives.
- Central system used: `src/subapps/dxf-viewer/config/color-config.ts` (UI_COLORS_BASE/UI_COLORS).
- Files touched: `src/subapps/dxf-viewer/rendering/ui/snap/SnapRenderer.ts`.
- How tested: Skipped per instruction (user will run checks).
- Risk: Low. Same semantic value via centralized constant.

## Entry 5
- What changed: Replaced hardcoded default stroke/fill colors in canvasPaths with `UI_COLORS.BLACK` and `UI_COLORS.TRANSPARENT`.
- Why: Enforce zero hardcoded values in core drawing primitives.
- Central system used: `src/subapps/dxf-viewer/config/color-config.ts` (UI_COLORS_BASE/UI_COLORS).
- Files touched: `src/subapps/dxf-viewer/rendering/primitives/canvasPaths.ts`.
- How tested: Skipped per instruction (user will run checks).
- Risk: Low. Same semantic values via centralized constants.

## Entry 6
- What changed: Replaced hardcoded `transparent` in SearchSystem styles with `GEO_COLORS.TRANSPARENT` and added GEO_COLORS import.
- Why: Enforce zero hardcoded values in geo-canvas styles.
- Central system used: `src/subapps/geo-canvas/config/color-config.ts` (GEO_COLORS).
- Files touched: `src/subapps/geo-canvas/ui/design-system/search/SearchSystem.styles.ts`.
- How tested: Skipped per instruction (user will run checks).
- Risk: Low. Same semantic value via centralized constant.

## Entry 7
- What changed: Replaced hardcoded `transparent` fill check with `GEO_COLORS.TRANSPARENT` in FloorPlanCanvasLayer.
- Why: Enforce zero hardcoded values in geo-canvas rendering.
- Central system used: `src/subapps/geo-canvas/config/color-config.ts` (GEO_COLORS).
- Files touched: `src/subapps/geo-canvas/floor-plan-system/rendering/FloorPlanCanvasLayer.tsx`.
- How tested: Skipped per instruction (user will run checks).
- Risk: Low. Same semantic value via centralized constant.

## Entry 8
- What changed: Replaced hardcoded `transparent` values in InteractiveMap styles with `GEO_COLORS.TRANSPARENT`.
- Why: Enforce zero hardcoded values in geo-canvas styles.
- Central system used: `src/subapps/geo-canvas/config/color-config.ts` (GEO_COLORS).
- Files touched: `src/subapps/geo-canvas/components/InteractiveMap.styles.ts`.
- How tested: Skipped per instruction (user will run checks).
- Risk: Low. Same semantic value via centralized constant.

## Entry 9
- What changed: Replaced hardcoded spacing/colors/shadows in GeoToolbar styles with centralized design tokens and GEO_COLORS.
- Why: Enforce zero hardcoded values in geo-canvas domain UI.
- Central system used: `src/styles/design-tokens.ts` (spacing/typography/shadows/borderRadius/zIndex/borders) and `src/subapps/geo-canvas/config/color-config.ts` (GEO_COLORS/withOpacity).
- Files touched: `src/subapps/geo-canvas/domains/toolbar-controls/GeoToolbar.tsx`.
- How tested: Skipped per instruction (user will run checks).
- Risk: Low-medium. Visual tokens mapped to nearest centralized values.

## Entry 10
- What changed: Created centralized info panel config/styles and refactored DraggableInfoPanels to use it (removed hardcoded values).
- Why: Enforce zero hardcoded values and avoid duplicate panel style systems.
- Central system used: `src/subapps/geo-canvas/config/info-panels-config.ts` (styles/dimensions) and `src/styles/design-tokens.ts` + `src/subapps/geo-canvas/config/color-config.ts`.
- Files touched: `src/subapps/geo-canvas/config/info-panels-config.ts`, `src/subapps/geo-canvas/config/index.ts`, `src/subapps/geo-canvas/domains/info-panels/DraggableInfoPanels.tsx`.
- How tested: Skipped per instruction (user will run checks).
- Risk: Low-medium. Visual tokens mapped to centralized values.

## Entry 11
- What changed: Created centralized dialog config/styles and refactored GeoDialogSystem to use it (removed hardcoded values).
- Why: Enforce zero hardcoded values and eliminate duplicate modal style systems.
- Central system used: `src/subapps/geo-canvas/config/dialog-config.ts` and design tokens/colors.
- Files touched: `src/subapps/geo-canvas/config/dialog-config.ts`, `src/subapps/geo-canvas/config/index.ts`, `src/subapps/geo-canvas/domains/dialog-modals/GeoDialogSystem.tsx`.
- How tested: Skipped per instruction (user will run checks).
- Risk: Low-medium. Visual tokens mapped to centralized values.

## Entry 12
- What changed: Removed mock GEO_COLORS in CitizenDrawingInterface and imported centralized GEO_COLORS.
- Why: Eliminate hardcoded color values and enforce centralized color system usage.
- Central system used: `src/subapps/geo-canvas/config/color-config.ts` (GEO_COLORS).
- Files touched: `src/subapps/geo-canvas/components/CitizenDrawingInterface.tsx`.
- How tested: Skipped per instruction (user will run checks).
- Risk: Low. Replaced mock constants with canonical config.

## Entry 13
- What changed: Created centralized map core styles and refactored InteractiveMapCore to use them.
- Why: Enforce zero hardcoded values in map-core UI.
- Central system used: `src/subapps/geo-canvas/config/map-core-config.ts` + design tokens/colors.
- Files touched: `src/subapps/geo-canvas/config/map-core-config.ts`, `src/subapps/geo-canvas/config/index.ts`, `src/subapps/geo-canvas/domains/map-core/InteractiveMapCore.tsx`.
- How tested: Skipped per instruction (user will run checks).
- Risk: Low. Visual tokens mapped to centralized values.
