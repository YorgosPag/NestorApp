/**
 * Center Measurement Label — SSoT (ADR-557 follow-up)
 *
 * Single source of truth for the "center measurement label" system: the stacked
 * area/perimeter/dimension text drawn at the centre of a measured entity
 * (polygon, rectangle, circle, ellipse, arc) across committed / preview / hover.
 *
 * TWO painting modes, ONE entry point (`paintMeasurementText`):
 *   • GATED (`gate: true`) — delegates to `renderStyledTextWithOverride`, the
 *     canonical gated preview-text primitive. Honours the "Κείμενο" enable toggle
 *     + the user's draft-text style (font/colour/decorations). This is the mode
 *     the committed rect/ellipse/arc/circle renderers use — pixel-identical to
 *     the pre-refactor `renderStyledTextWithOverride(...)` calls.
 *   • UNGATED (default) — fixed `DEFAULT_MEASUREMENT_LABEL_STYLE`, ALWAYS renders
 *     (a measurement RESULT, not a preview overlay). Used by the closed-polygon
 *     area label (`paintStackedMeasurementLabel` / `paintPolygonAreaLabel`);
 *     fixes the bug where the committed measure-area text silently disappeared
 *     behind the preview-text gate.
 *
 * Geometry (area/perimeter/centroid) is composed from the existing SSoT
 * calculators — never re-implement shoelace/centroid at a call site.
 *
 * The gated path reads the preview-text store (via `renderStyledTextWithOverride`);
 * the ungated path is pure canvas.
 */

import type { Point2D } from '../../types/Types';
import { calculatePolygonArea, calculatePolygonCentroid } from './geometry-utils';
import { calculatePerimeter } from './line-utils';
// 🏢 ADR-462: display-unit SSoT — area + perimeter follow the status-bar unit selector
import { formatLengthForDisplay, formatAreaForDisplay } from '../../../config/display-length-format';
// 🏢 ADR-091: Centralized UI Fonts + Text Label Offsets
import { buildUIFont, TEXT_LABEL_OFFSETS } from '../../../config/text-rendering-config';
import { UI_COLORS } from '../../../config/color-config';
// Canonical gated preview-text primitive (SSoT for the "Κείμενο" toggle + draft-text style).
import { renderStyledTextWithOverride } from '../../../hooks/useTextPreviewStyle';
import { i18n } from '@/i18n';

/** Area + perimeter + centroid derived from the SAME closed-polygon geometry. */
export interface PolygonAreaMetrics {
  area: number;
  perimeter: number;
  centroid: Point2D;
}

/**
 * Compose the EXISTING SSoT calculators — the ONLY allowed area/centroid/
 * perimeter source for the closed-polygon measurement label. Never
 * re-implement shoelace area / vertex-average centroid at a call site.
 */
export function computePolygonAreaMetrics(vertices: Point2D[], closed: boolean): PolygonAreaMetrics {
  return {
    area: calculatePolygonArea(vertices),
    perimeter: calculatePerimeter(vertices, closed),
    centroid: calculatePolygonCentroid(vertices),
  };
}

/** Visual style (colour + font) for the painted label. */
export interface MeasurementLabelStyle {
  color: string;
  font: string;
}

/**
 * 🏢 Canonical measurement-label style — mirrors
 * `BaseEntityRenderer.applyCenterMeasurementTextStyle()` (fuchsia, 11px arial,
 * ADR-159 dimension style) so the committed look is unchanged by this refactor.
 */
export const DEFAULT_MEASUREMENT_LABEL_STYLE: MeasurementLabelStyle = {
  color: UI_COLORS.ANGLE_MEASUREMENT_TEXT,
  font: buildUIFont(11, 'arial'),
};

export interface AreaLabelOptions {
  /** Include the perimeter line below the area line. Default: true. */
  includePerimeter?: boolean;
  style?: MeasurementLabelStyle;
}

/** Single "Ε: 12.3 m²"-shaped area line — the AREA half of {@link buildAreaPerimeterLabelLines}. */
export function buildAreaLabel(area: number): string {
  const areaPrefix = i18n.t('areaMeasureLabel.areaPrefix', { ns: 'dxf-viewer-shell' });
  return `${areaPrefix}: ${formatAreaForDisplay(area)}`;
}

/**
 * Canonical text lines for the label: AREA first, PERIMETER second (only when
 * `includePerimeter !== false`). Prefixes resolve via i18n (N.11 — no
 * hardcoded Greek/English literals in .ts files).
 */
export function buildAreaPerimeterLabelLines(
  metrics: Pick<PolygonAreaMetrics, 'area' | 'perimeter'>,
  opts?: AreaLabelOptions,
): string[] {
  const lines = [buildAreaLabel(metrics.area)];

  if (opts?.includePerimeter !== false) {
    const perimeterPrefix = i18n.t('areaMeasureLabel.perimeterPrefix', { ns: 'dxf-viewer-shell' });
    lines.push(`${perimeterPrefix}: ${formatLengthForDisplay(metrics.perimeter)}`);
  }

  return lines;
}

/**
 * 🏢 ADR-557 follow-up (N.11): i18n-resolved content builders for the remaining
 * per-entity centre-measurement label lines (radius/length/axis prefixes were
 * hardcoded Greek/Latin literals at each call site — RectangleRenderer's area+
 * perimeter pair already went through {@link buildAreaPerimeterLabelLines}
 * above; these cover Arc/Ellipse/Circle so ALL committed centre-labels resolve
 * prefixes via i18n, never literals).
 */

/** "R: 1.20 m" — arc/circle radius line (`centerMeasureLabel.radiusPrefix`). */
export function buildRadiusLabel(radius: number): string {
  const radiusPrefix = i18n.t('centerMeasureLabel.radiusPrefix', { ns: 'dxf-viewer-shell' });
  return `${radiusPrefix}: ${formatLengthForDisplay(radius)}`;
}

/** "L: 2.40 m" — arc length line (`centerMeasureLabel.lengthPrefix`). */
export function buildArcLengthLabel(arcLength: number): string {
  const lengthPrefix = i18n.t('centerMeasureLabel.lengthPrefix', { ns: 'dxf-viewer-shell' });
  return `${lengthPrefix}: ${formatLengthForDisplay(arcLength)}`;
}

/** "Ma: …" / "Mi: …" — ellipse major/minor axis lines, in that order. */
export function buildEllipseAxisLabelLines(majorAxis: number, minorAxis: number): [string, string] {
  const majorPrefix = i18n.t('centerMeasureLabel.majorAxisPrefix', { ns: 'dxf-viewer-shell' });
  const minorPrefix = i18n.t('centerMeasureLabel.minorAxisPrefix', { ns: 'dxf-viewer-shell' });
  return [
    `${majorPrefix}: ${formatLengthForDisplay(majorAxis)}`,
    `${minorPrefix}: ${formatLengthForDisplay(minorAxis)}`,
  ];
}

/**
 * "Εμβαδόν: …" / "Περιφέρεια: …" — the committed CIRCLE's full-word area +
 * circumference pair (`circleMeasureLabel.*`). Deliberately a SEPARATE key
 * group from `areaMeasureLabel` (abbreviated "Ε"/"Περ") — the circle renderer
 * has always shown the full words, a pre-existing distinct label, not a
 * duplicate to merge.
 */
export function buildCircleAreaCircumferenceLines(area: number, circumference: number): [string, string] {
  const areaPrefix = i18n.t('circleMeasureLabel.areaPrefix', { ns: 'dxf-viewer-shell' });
  const circumferencePrefix = i18n.t('circleMeasureLabel.circumferencePrefix', { ns: 'dxf-viewer-shell' });
  return [
    `${areaPrefix}: ${formatAreaForDisplay(area)}`,
    `${circumferencePrefix}: ${formatLengthForDisplay(circumference)}`,
  ];
}

/** Per-line painter options: gated (preview style) vs ungated (fixed style). */
export interface MeasurementTextOptions {
  /** `true` → gated preview-text path (honours "Κείμενο" toggle + draft style). */
  gate?: boolean;
  /** Ungated fixed style (ignored when `gate` is true). */
  style?: MeasurementLabelStyle;
}

/**
 * THE single per-line measurement-text painter. Both render modes go through
 * here so the drawing logic exists in ONE place:
 *   • `gate === true` → delegate to `renderStyledTextWithOverride` (the canonical
 *     gated primitive) — preview font/colour + "Κείμενο" enable gate +
 *     superscript/subscript + underline/strikethrough, EXACTLY as before. Wrapped
 *     in save/restore so it never leaks canvas state to the caller.
 *   • falsy `gate` → ungated fixed-style draw (`opts.style ?? DEFAULT`), always
 *     renders (measurement RESULT).
 */
export function paintMeasurementText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts?: MeasurementTextOptions,
): void {
  if (opts?.gate === true) {
    ctx.save();
    renderStyledTextWithOverride(ctx, text, x, y);
    ctx.restore();
    return;
  }

  const style = opts?.style ?? DEFAULT_MEASUREMENT_LABEL_STYLE;
  ctx.save();
  ctx.fillStyle = style.color;
  ctx.font = style.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * Ungated painter for N stacked, centred measurement-label lines. This label is
 * a measurement RESULT (not a preview-text overlay) so it MUST always render —
 * it does NOT read the "Κείμενο" preview gate (that gate hid the committed
 * measure-area entity's text — the bug this SSoT fixes). Delegates per-line to
 * `paintMeasurementText` (ungated) so drawing lives in one place.
 */
export function paintStackedMeasurementLabel(
  ctx: CanvasRenderingContext2D,
  screenCenter: Point2D,
  lines: string[],
  style: MeasurementLabelStyle = DEFAULT_MEASUREMENT_LABEL_STYLE,
): void {
  if (lines.length === 0) return;

  // 🏢 ADR-091: keep the 2-line spacing visually equal to the previous
  // committed layout, which used ±TEXT_LABEL_OFFSETS.TWO_LINE around centre.
  const lineHeight = TEXT_LABEL_OFFSETS.TWO_LINE * 2;

  lines.forEach((line, i) => {
    const y = screenCenter.y + (i - (lines.length - 1) / 2) * lineHeight;
    paintMeasurementText(ctx, line, screenCenter.x, y, { style });
  });
}

/** One line of a stacked, gated centre-measurement label: text + vertical offset from centre. */
export interface StackedCenterMeasurementLine {
  text: string;
  /** Screen-px vertical offset from the entity's screen centre (negative = above). */
  offsetY: number;
}

/**
 * 🏢 ADR-557 follow-up ("stacked-center-measurement-label" dedup): the
 * `ctx.save()` → base dimension-text style (mirrors
 * `BaseEntityRenderer.applyCenterMeasurementTextStyle()`, i.e. the SAME
 * fuchsia/11px style as {@link DEFAULT_MEASUREMENT_LABEL_STYLE}) → N × GATED
 * per-line paint → `ctx.restore()` scaffolding hand-rolled in the committed
 * Rectangle/Ellipse/Arc/Circle renderers. Each call site supplies its own
 * text + vertical offset — offsets differ by entity (2/3/4-line stacks use
 * different subsets of `TEXT_LABEL_OFFSETS`), so this helper does NOT
 * recompute spacing; it is a behaviour-preserving 1:1 replacement for the
 * previous inline block, not a new layout algorithm.
 */
export function renderStackedCenterMeasurementLabel(
  ctx: CanvasRenderingContext2D,
  screenCenter: Point2D,
  lines: StackedCenterMeasurementLine[],
): void {
  ctx.save();
  ctx.fillStyle = DEFAULT_MEASUREMENT_LABEL_STYLE.color;
  ctx.font = DEFAULT_MEASUREMENT_LABEL_STYLE.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const { text, offsetY } of lines) {
    paintMeasurementText(ctx, text, screenCenter.x, screenCenter.y + offsetY, { gate: true });
  }

  ctx.restore();
}

/** Convenience: build the canonical lines + paint them at the screen centroid. */
export function paintPolygonAreaLabel(
  ctx: CanvasRenderingContext2D,
  screenCentroid: Point2D,
  metrics: PolygonAreaMetrics,
  opts?: AreaLabelOptions,
): void {
  paintStackedMeasurementLabel(ctx, screenCentroid, buildAreaPerimeterLabelLines(metrics, opts), opts?.style);
}
