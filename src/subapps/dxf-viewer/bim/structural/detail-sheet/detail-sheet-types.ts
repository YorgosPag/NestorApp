/**
 * ADR-457 — Column Reinforcement Detail Sheet · drawing-model types (SSoT).
 *
 * Pure type module describing ONE paper-style detail sheet of a column's
 * reinforcement as a backend-agnostic geometric model in **sheet-millimetres**
 * (origin top-left, +y downwards — matches both the offscreen Canvas2D preview
 * AND jsPDF page space). The same `DetailSheetModel` is consumed by two
 * backends so that **preview === PDF**:
 *   - `render/detail-canvas-renderer.ts` → live preview inside the dialog.
 *   - `render/detail-pdf-renderer.ts`    → exported / printed PDF.
 *
 * No runtime logic, no imports of runtime code (keeps the dependency graph
 * acyclic). `RectMm` is re-used from the print engine (ADR-453) so the sheet
 * geometry shares the print SSoT for paper rectangles.
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/detail-sheet-types
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { PaperSpec, RectMm } from '../../../print/config/paper-types';

export type { RectMm };

/** The five fixed regions of the detail sheet (Revit/Tekla layout). */
export type SheetRegionId =
  | 'plan'          // (1) κάτοψη — κάτω-αριστερά
  | 'elevation'     // (2) όψη — πάνω-αριστερά
  | 'perspective'   // (3) 3Δ προοπτικό — κέντρο/δεξιά
  | 'schedule'      // (5) στοιχεία οπλισμού — πάνω-δεξιά
  | 'title-block';  // (4) στοιχεία σχεδίου — κάτω-δεξιά

/** Stroke styling for a vector primitive, in millimetre line weight. */
export interface SheetStroke {
  /** CSS colour string (hex). */
  readonly colorHex: string;
  /** Line weight in millimetres (ISO pen widths, e.g. 0.13 / 0.25 / 0.5). */
  readonly widthMm: number;
  /** Dash pattern in millimetres (omitted → solid line). */
  readonly dashMm?: readonly number[];
}

/** A straight segment in sheet-mm. */
export interface LinePrimitive {
  readonly kind: 'line';
  readonly a: Point2D;
  readonly b: Point2D;
  readonly stroke: SheetStroke;
}

/** An open or closed polyline in sheet-mm. */
export interface PolylinePrimitive {
  readonly kind: 'polyline';
  readonly points: readonly Point2D[];
  readonly stroke: SheetStroke;
  readonly closed: boolean;
  /** Optional solid fill colour (hex) — used for rebar dots / hatching. */
  readonly fillHex?: string;
}

/** A circle in sheet-mm (longitudinal bar dot, spiral marker). */
export interface CirclePrimitive {
  readonly kind: 'circle';
  readonly center: Point2D;
  readonly radiusMm: number;
  readonly stroke?: SheetStroke;
  readonly fillHex?: string;
}

/**
 * Horizontal text-alignment for a {@link TextPrimitive}. Vertical baseline is
 * always the alphabetic baseline at `position.y` (renderer-handled).
 */
export type TextAlign = 'left' | 'center' | 'right';

/** A pre-resolved text label in sheet-mm (N.11: no i18n keys live in the model). */
export interface TextPrimitive {
  readonly kind: 'text';
  readonly position: Point2D;
  /** Already-translated string — the orchestrator injects resolved labels. */
  readonly text: string;
  /** Cap height in millimetres. */
  readonly heightMm: number;
  readonly colorHex: string;
  readonly align: TextAlign;
  /** Bold weight (headings / values). */
  readonly bold?: boolean;
}

/**
 * A linear dimension between two points in sheet-mm. The renderer materialises
 * extension lines, the dimension line, arrowheads and the centred text from
 * this declarative description via the `detail-sheet-dim` SSoT helper.
 */
export interface DimPrimitive {
  readonly kind: 'dim';
  /** First measured point (sheet-mm). */
  readonly p1: Point2D;
  /** Second measured point (sheet-mm). */
  readonly p2: Point2D;
  /** Perpendicular offset of the dimension line from the p1→p2 axis (mm). */
  readonly offsetMm: number;
  /** Pre-resolved dimension text (e.g. "400"). */
  readonly text: string;
  readonly stroke: SheetStroke;
  /** Text cap height in mm (defaults applied by the renderer when omitted). */
  readonly textHeightMm?: number;
}

/**
 * A raster slot in sheet-mm — the 3D perspective region is rendered offscreen
 * (WebGL → PNG) and placed here so preview and PDF share the identical image.
 */
export interface RasterPrimitive {
  readonly kind: 'raster';
  readonly rect: RectMm;
  /** PNG data URL (offscreen capture); `null` while still rendering. */
  readonly dataUrl: string | null;
}

/** Any drawable element of a region, in sheet-mm. */
export type DetailPrimitive =
  | LinePrimitive
  | PolylinePrimitive
  | CirclePrimitive
  | TextPrimitive
  | DimPrimitive
  | RasterPrimitive;

/** One laid-out region of the sheet with its drawable contents. */
export interface SheetRegion {
  readonly id: SheetRegionId;
  /** Region rectangle in sheet-mm (from `detail-sheet-layout`). */
  readonly rectMm: RectMm;
  /** Pre-resolved region heading (already translated). */
  readonly title: string;
  /** Optional pre-resolved caption (scale, e.g. "1:20"). */
  readonly caption?: string;
  /** Drawable contents, in sheet-mm (empty in the Slice 0 shell). */
  readonly primitives: readonly DetailPrimitive[];
}

/** The complete backend-agnostic detail-sheet drawing model. */
export interface DetailSheetModel {
  readonly paper: PaperSpec;
  /** Full sheet width in mm (paper, orientation-resolved). */
  readonly sheetWidthMm: number;
  /** Full sheet height in mm (paper, orientation-resolved). */
  readonly sheetHeightMm: number;
  /** The five regions in render order. */
  readonly regions: readonly SheetRegion[];
}

/** Pre-resolved region headings injected by the UI host (N.11-safe). */
export interface DetailSheetLabels {
  readonly plan: string;
  readonly elevation: string;
  readonly perspective: string;
  readonly schedule: string;
  readonly titleBlock: string;
}
