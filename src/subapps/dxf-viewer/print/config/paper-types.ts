/**
 * ADR-453 — Print/Export engine · paper & request types (SSoT).
 *
 * Pure type module shared by the 2D/3D capture adapters, the PDF assembler,
 * the print facade and the PrintDialog UI. No logic, no imports of runtime
 * code — keeps the dependency graph acyclic.
 *
 * @module subapps/dxf-viewer/print/config/paper-types
 * @see docs/centralized-systems/reference/adrs/ADR-453-dxf-print-export-engine.md
 */

/**
 * ADR-454 — Plot Style (AutoCAD CTB / Revit print). Canonical definition lives in
 * `config/print-color-policy.ts`; re-exported here so the print types module stays
 * the single import surface for the dialog/service without a circular dependency.
 */
export type { PrintPlotStyle } from '../../config/print-color-policy';
import type { PrintPlotStyle } from '../../config/print-color-policy';

/** ISO 216 sheet sizes supported by the print engine. */
export type PaperSize = 'A4' | 'A3' | 'A2' | 'A1' | 'A0';

export type PaperOrientation = 'portrait' | 'landscape';

/**
 * How the drawing is fitted onto the sheet.
 * - `fit-to-page`    — scale the whole drawing to fill the printable area.
 * - `drawing-scale`  — render at a real-world ratio (1:N); 2D only.
 */
export type FitMode = 'fit-to-page' | 'drawing-scale';

/** Which viewer the snapshot is taken from. */
export type PrintSource = '2d' | '3d';

/**
 * Final destination of the assembled PDF.
 * - `save-pdf`    — download the .pdf file.
 * - `open-print`  — open in a new tab and trigger the OS print dialog
 *                   (covers desktop printer AND plotter).
 */
export type OutputTarget = 'save-pdf' | 'open-print';

export interface PaperSpec {
  size: PaperSize;
  orientation: PaperOrientation;
}

export interface PaperDimensionsMm {
  widthMm: number;
  heightMm: number;
}

/** The drawable rectangle inside the sheet, after subtracting page margins. */
export interface PrintableAreaMm {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

/** A rectangle in PDF millimetre space. */
export interface RectMm {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Raster target for an offscreen capture canvas. */
export interface RasterTargetPx {
  widthPx: number;
  heightPx: number;
  /** DPI actually used after MAX_CANVAS_DIMENSION_PX clamping. */
  effectiveDpi: number;
}

/** The user's print configuration, produced by the PrintDialog. */
export interface PrintRequest {
  source: PrintSource;
  paper: PaperSpec;
  fitMode: FitMode;
  target: OutputTarget;
  includeTitleBlock: boolean;
  /** Real-world denominator N for `drawing-scale` mode (e.g. 100 → 1:100). */
  scaleDenominator?: number;
  /**
   * ADR-454 — plot style for 2D source (white-safe colour / monochrome / grayscale /
   * by-pen). Ignored for 3D (WYSIWYG real materials). Defaults to `'colour'`.
   */
  plotStyle?: PrintPlotStyle;
}
