/**
 * View-Scale SSoT — convert the viewport `scale` (CSS px per scene-unit) into a
 * real-world drawing ratio 1:N, and back. This is the "how big does the drawing
 * look on screen right now" scale, Revit/AutoCAD-style — distinct from the
 * annotation/plot drawing scale owned by `DrawingScaleWidget` (ADR-375), which
 * is "how the drawing will be printed".
 *
 * ## Why a real ratio instead of a pixel-%
 * The legacy zoom indicator showed `scale * 100` ("5496%"), i.e. pixels per
 * scene-unit. That number is meaningless to a CAD engineer because a scene-unit
 * can be a millimetre, centimetre or metre (`SceneModel.units`, ADR-358). A true
 * 1:N scale folds in both the scene units and the physical screen DPI, so a
 * floorplan in metres reads as e.g. "1:69" (the on-screen size is 1/69 of life).
 *
 * ## Coordinate-space note (resolved, do not change without re-checking)
 * `ImmediateTransformStore.scale` is in **CSS pixels** per scene-unit: the 2D
 * context is pre-scaled by `devicePixelRatio` in `CanvasUtils.setupCanvasContext`
 * (`ctx.setTransform(dpr,0,0,dpr,0,0)`), so all drawing happens in CSS-px space.
 * Therefore the conversion applies NO extra `dpr` factor. The `dpr` parameter is
 * reserved (default 1) for a future device-true mode and is intentionally unused
 * in the default path.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-418-view-scale-ssot.md
 * @see config/dpi-config.ts — SCREEN_DPI / pxPerMmCss SSoT
 * @see utils/scene-units.ts — mmToSceneUnits SSoT
 */

import { mmToSceneUnits, type SceneUnits } from './scene-units';
import { pxPerMmCss } from '../config/dpi-config';
import { clampScale } from '../config/transform-config';

/**
 * View-scale ratio presets (the N in 1:N) offered in the zoom menus.
 * Deliberately distinct from `DRAWING_SCALE_PRESETS` (annotation scale, which
 * also includes 1:10): view-zoom presets start at 1:20 for floorplan ergonomics.
 */
export const VIEW_SCALE_RATIO_PRESETS = [20, 50, 100, 200, 500] as const;

/** Menu presets including 1:1 actual size (shared by the zoom menus). */
export const VIEW_SCALE_MENU_PRESETS = [1, ...VIEW_SCALE_RATIO_PRESETS] as const;

/**
 * Whether the current view ratio matches a preset closely enough to highlight
 * it as active. Relative tolerance (1% of the ratio) so it works across the
 * 1:1 … 1:500 range. SSoT for both the ruler corner menu and the ribbon widget.
 */
export function isViewRatioActive(currentN: number, presetN: number): boolean {
  return Number.isFinite(currentN) && Math.abs(currentN - presetN) <= presetN * 0.01;
}

/** Real-world millimetres represented by one scene-unit (m→1000, cm→10, mm→1). */
function modelMmPerSceneUnit(units: SceneUnits): number {
  return 1 / mmToSceneUnits(units);
}

export interface ScaleRatioParams {
  /** Viewport scale in CSS px per scene-unit (`ImmediateTransformStore.scale`). */
  readonly scaleCss: number;
  /** Active scene units (`resolveSceneUnits(scene)`). */
  readonly sceneUnits: SceneUnits;
  /** Reserved device-pixel-ratio hook; not applied in the default path. */
  readonly dpr?: number;
}

export interface RatioScaleParams {
  /** Target drawing-scale denominator N (1:N). */
  readonly ratioN: number;
  readonly sceneUnits: SceneUnits;
  readonly dpr?: number;
}

/**
 * Effective drawing-scale denominator N for the current zoom.
 * `N = modelMmPerSceneUnit(units) * pxPerMmCss / scaleCss`.
 * Returns `Infinity` for a non-positive scale (defensive; callers format it).
 */
export function scaleToRatio({ scaleCss, sceneUnits }: ScaleRatioParams): number {
  if (!Number.isFinite(scaleCss) || scaleCss <= 0) return Infinity;
  return (modelMmPerSceneUnit(sceneUnits) * pxPerMmCss()) / scaleCss;
}

/**
 * Inverse of {@link scaleToRatio}: the viewport scale (CSS px per scene-unit)
 * that renders the drawing at exactly 1:N. Clamped to the transform limits so
 * extreme ratios stay applyable.
 */
export function ratioToScale({ ratioN, sceneUnits }: RatioScaleParams): number {
  if (!Number.isFinite(ratioN) || ratioN <= 0) {
    return clampScale(0);
  }
  const raw = (modelMmPerSceneUnit(sceneUnits) * pxPerMmCss()) / ratioN;
  return clampScale(raw);
}

/**
 * Format a ratio denominator as a display string. Numeric ratio symbols are
 * locale-independent (same pattern as `DrawingScaleWidget`'s literal `1:{n}`),
 * so this is not routed through i18n.
 *
 *   n ≥ 10  → "1:69"   (integer)
 *   1 ≤ n < 10 → "1:1.5" / "1:1"   (≤1 decimal, trailing .0 dropped)
 *   n < 1   → "2:1"    (magnified past actual size → reciprocal)
 */
export function formatViewScale(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n < 1) {
    return `${Math.round(1 / n)}:1`;
  }
  if (n >= 10) {
    return `1:${Math.round(n)}`;
  }
  const oneDecimal = Math.round(n * 10) / 10;
  const body = Number.isInteger(oneDecimal) ? String(oneDecimal) : oneDecimal.toFixed(1);
  return `1:${body}`;
}
