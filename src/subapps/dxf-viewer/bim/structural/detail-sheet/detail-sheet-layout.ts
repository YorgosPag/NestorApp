/**
 * ADR-457 — Column Reinforcement Detail Sheet · region layout (pure SSoT).
 *
 * Splits the printable area of a sheet into the five fixed regions of the
 * reinforcement detail (Revit/Tekla layout), in **sheet-millimetres**
 * (origin top-left, +y downwards) — three columns:
 *
 *   ┌──────────────┬──────────────┬──────────────┐
 *   │ (2) elevation│              │ (5) schedule │
 *   │   top-left   │ (3) perspect.│   top-right  │
 *   ├──────────────┤  full height ├──────────────┤
 *   │ (1) plan     │   (centre)   │ (4) titleblk │
 *   │   bot-left   │              │   bot-right  │
 *   └──────────────┴──────────────┴──────────────┘
 *
 * Left column = two equal rows (elevation over plan). Centre column = one
 * full-height zone (the 3D perspective — the main visual). Right column = two
 * rows (reinforcement schedule over title block). Pure + deterministic →
 * unit-tested without a canvas.
 *
 * Re-uses the print engine paper math (ADR-453) as the SSoT for paper
 * dimensions and printable area, so the detail sheet inherits the exact paper
 * geometry used by the rest of the print pipeline.
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/detail-sheet-layout
 * @see docs/centralized-systems/reference/adrs/ADR-457-column-reinforcement-detail-sheet.md
 */

import type { PaperSpec } from '../../../print/config/paper-types';
import {
  resolvePaperDimensionsMm,
  resolvePrintableAreaMm,
} from '../../../print/config/paper-math';
import type { RectMm, SheetRegionId } from './detail-sheet-types';

/** Default sheet for the reinforcement detail — A3 landscape (technical sheet). */
export const DETAIL_SHEET_PAPER: PaperSpec = { size: 'A3', orientation: 'landscape' };

/** Page margin (mm) — matches the print engine default. */
export const DETAIL_SHEET_MARGIN_MM = 10;

/** Gutter (mm) between regions (both column split and row splits). */
export const DETAIL_SHEET_GUTTER_MM = 6;

/** Horizontal fractions of the gutter-reduced width (left / centre / right; sum = 1). */
const LEFT_COLUMN_FRACTION = 0.30;
const CENTRE_COLUMN_FRACTION = 0.40;

/** Fraction of the right column's usable height taken by the schedule (rest = title block). */
const RIGHT_SCHEDULE_FRACTION = 0.62;

export interface DetailSheetLayoutInput {
  readonly paper: PaperSpec;
  readonly marginMm: number;
  readonly gutterMm: number;
}

/** The five region rectangles, keyed by region id, in sheet-mm. */
export type DetailSheetRegionRects = Readonly<Record<SheetRegionId, RectMm>>;

export interface DetailSheetLayout {
  readonly sheetWidthMm: number;
  readonly sheetHeightMm: number;
  readonly regions: DetailSheetRegionRects;
}

/** Default layout input (A3 landscape, standard margin/gutter). */
export const DEFAULT_DETAIL_SHEET_LAYOUT_INPUT: DetailSheetLayoutInput = {
  paper: DETAIL_SHEET_PAPER,
  marginMm: DETAIL_SHEET_MARGIN_MM,
  gutterMm: DETAIL_SHEET_GUTTER_MM,
};

/**
 * Computes the five region rectangles for the reinforcement detail sheet.
 * Pure: depends only on the paper spec + margin/gutter. The right column's
 * three zones use fixed fractions of the gutter-reduced usable height.
 */
export function computeDetailSheetLayout(
  input: DetailSheetLayoutInput = DEFAULT_DETAIL_SHEET_LAYOUT_INPUT,
): DetailSheetLayout {
  const { paper, marginMm, gutterMm } = input;
  const dims = resolvePaperDimensionsMm(paper);
  const area = resolvePrintableAreaMm(paper, marginMm);

  // Three columns split by two gutters.
  const columnsWidth = area.widthMm - 2 * gutterMm;
  const leftWidth = columnsWidth * LEFT_COLUMN_FRACTION;
  const centreWidth = columnsWidth * CENTRE_COLUMN_FRACTION;
  const rightWidth = columnsWidth - leftWidth - centreWidth;
  const centreX = area.xMm + leftWidth + gutterMm;
  const rightX = centreX + centreWidth + gutterMm;

  // Left column: two equal rows (elevation over plan) split by one gutter.
  const leftRowHeight = (area.heightMm - gutterMm) / 2;
  const elevationRect: RectMm = {
    x: area.xMm,
    y: area.yMm,
    w: leftWidth,
    h: leftRowHeight,
  };
  const planRect: RectMm = {
    x: area.xMm,
    y: area.yMm + leftRowHeight + gutterMm,
    w: leftWidth,
    h: leftRowHeight,
  };

  // Centre column: one full-height zone (the 3D perspective).
  const perspectiveRect: RectMm = {
    x: centreX,
    y: area.yMm,
    w: centreWidth,
    h: area.heightMm,
  };

  // Right column: two rows (schedule over title block) split by one gutter.
  const rightUsableHeight = area.heightMm - gutterMm;
  const scheduleHeight = rightUsableHeight * RIGHT_SCHEDULE_FRACTION;
  const titleHeight = rightUsableHeight - scheduleHeight;
  const scheduleRect: RectMm = {
    x: rightX,
    y: area.yMm,
    w: rightWidth,
    h: scheduleHeight,
  };
  const titleBlockRect: RectMm = {
    x: rightX,
    y: area.yMm + scheduleHeight + gutterMm,
    w: rightWidth,
    h: titleHeight,
  };

  return {
    sheetWidthMm: dims.widthMm,
    sheetHeightMm: dims.heightMm,
    regions: {
      plan: planRect,
      elevation: elevationRect,
      perspective: perspectiveRect,
      schedule: scheduleRect,
      'title-block': titleBlockRect,
    },
  };
}
