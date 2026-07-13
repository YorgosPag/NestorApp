/**
 * ADR-453 — Print/Export engine · pure paper geometry math (SSoT).
 *
 * All unit conversions and transform computations for print live here so they
 * can be unit-tested in isolation (the highest bug-risk area is the 1:N
 * drawing-scale transform). No DOM, no React, no jsPDF.
 *
 * @module subapps/dxf-viewer/print/config/paper-math
 */

import type { ViewTransform, Viewport } from '../../rendering/types/Types';
import type { Bounds } from '../../utils/bounds-utils';
import type {
  FitMode,
  PaperSpec,
  PaperDimensionsMm,
  PrintableAreaMm,
  RasterTargetPx,
} from './paper-types';
import {
  MM_PER_INCH,
  MAX_CANVAS_DIMENSION_PX,
  PAPER_SIZES_MM_PORTRAIT,
} from './paper-constants';

/** Resolve sheet dimensions for a size + orientation (landscape swaps axes). */
export function resolvePaperDimensionsMm(spec: PaperSpec): PaperDimensionsMm {
  const base = PAPER_SIZES_MM_PORTRAIT[spec.size];
  if (spec.orientation === 'landscape') {
    return { widthMm: base.heightMm, heightMm: base.widthMm };
  }
  return { widthMm: base.widthMm, heightMm: base.heightMm };
}

/** Millimetres → pixels at a given DPI. */
export function mmToPx(mm: number, dpi: number): number {
  return (mm / MM_PER_INCH) * dpi;
}

/** Pixels → millimetres at a given DPI. */
export function pxToMm(px: number, dpi: number): number {
  return (px / dpi) * MM_PER_INCH;
}

/** The drawable rectangle inside the sheet after subtracting a symmetric margin. */
export function resolvePrintableAreaMm(
  spec: PaperSpec,
  marginMm: number,
): PrintableAreaMm {
  const { widthMm, heightMm } = resolvePaperDimensionsMm(spec);
  const safeMargin = Math.max(0, Math.min(marginMm, widthMm / 2 - 1, heightMm / 2 - 1));
  return {
    xMm: safeMargin,
    yMm: safeMargin,
    widthMm: widthMm - safeMargin * 2,
    heightMm: heightMm - safeMargin * 2,
  };
}

/**
 * ADR-651 Φάση ΣΤ — η κλίμακα που ΟΝΤΩΣ τυπώνεται. Καθαρή συνάρτηση του request (οι capture
 * adapters εφαρμόζουν ακριβώς αυτόν τον κανόνα), οπότε είναι γνωστή **πριν** το capture — και
 * μπορεί να μπει στην πινακίδα του PDF χωρίς να περιμένει το σχέδιο (μηδέν race, N.7.2).
 */
export function resolveAppliedScaleDenominator(
  fitMode: FitMode,
  scaleDenominator: number | undefined,
): number | null {
  return fitMode === 'drawing-scale' ? scaleDenominator ?? null : null;
}

/** Άγνωστη/μη πραγματική κλίμακα (fit-to-page, 3D) — ουδέτερο σύμβολο, όχι κείμενο UI. */
const NO_SCALE_TEXT = '—';

/** `1:100` ή `—` — το κείμενο κλίμακας που γράφεται στην πινακίδα/λεζάντα. */
export function formatScaleText(denominator: number | null): string {
  return denominator ? `1:${denominator}` : NO_SCALE_TEXT;
}

/**
 * Physical-pixel size of the offscreen capture canvas for an ARBITRARY printable
 * rectangle, clamping the DPI down so neither axis exceeds MAX_CANVAS_DIMENSION_PX.
 *
 * ADR-651 Φάση ΣΤ — με πινακίδα, η περιοχή σχεδίου δεν είναι πια συμμετρική (είναι η
 * ωφέλιμη περιοχή της κορνίζας ISO 5457), γι' αυτό το raster sizing δέχεται **ορθογώνιο**
 * και όχι περιθώριο.
 */
export function computeRasterPxForArea(
  area: PrintableAreaMm,
  requestedDpi: number,
): RasterTargetPx {
  const largestMm = Math.max(area.widthMm, area.heightMm);
  const largestPxAtDpi = mmToPx(largestMm, requestedDpi);
  const effectiveDpi =
    largestPxAtDpi > MAX_CANVAS_DIMENSION_PX
      ? (requestedDpi * MAX_CANVAS_DIMENSION_PX) / largestPxAtDpi
      : requestedDpi;
  return {
    widthPx: Math.max(1, Math.round(mmToPx(area.widthMm, effectiveDpi))),
    heightPx: Math.max(1, Math.round(mmToPx(area.heightMm, effectiveDpi))),
    effectiveDpi,
  };
}

/**
 * Physical-pixel size of the offscreen capture canvas for the symmetric-margin printable
 * area (the no-title-block sheet). Thin wrapper over {@link computeRasterPxForArea} — one
 * clamping rule, two entry points.
 */
export function computePaperRasterPx(
  spec: PaperSpec,
  requestedDpi: number,
  marginMm: number,
): RasterTargetPx {
  return computeRasterPxForArea(resolvePrintableAreaMm(spec, marginMm), requestedDpi);
}

/** Build the renderer Viewport from a raster target. */
export function rasterToViewport(raster: RasterTargetPx): Viewport {
  return { width: raster.widthPx, height: raster.heightPx };
}

/**
 * Compute the real-world 1:N transform for drawing-scale mode.
 *
 * transform.scale = screen-px per scene-unit. At ratio 1:N a scene unit of
 * `mmPerSceneUnit` real millimetres occupies `mmPerSceneUnit / N` paper mm,
 * i.e. `mmPerSceneUnit / N * dpi / 25.4` pixels. Offsets centre the bounds,
 * mirroring FitToViewService's non-aligned convention so it composes with
 * CoordinateTransforms.worldToScreen identically to fit-to-page.
 */
export function computeDrawingScaleTransform(
  bounds: Bounds,
  viewport: Viewport,
  opts: { scaleDenominator: number; mmPerSceneUnit: number; dpi: number },
): ViewTransform {
  const { scaleDenominator, mmPerSceneUnit, dpi } = opts;
  const scale = (mmPerSceneUnit / scaleDenominator) * (dpi / MM_PER_INCH);
  const centerX = (bounds.min.x + bounds.max.x) / 2;
  const centerY = (bounds.min.y + bounds.max.y) / 2;
  return {
    scale,
    offsetX: viewport.width / 2 - centerX * scale,
    offsetY: viewport.height / 2 - centerY * scale,
  };
}
