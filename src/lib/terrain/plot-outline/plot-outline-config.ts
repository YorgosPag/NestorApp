/**
 * @fileoverview **Plot outline — every threshold and word the evidence uses, in ONE place** (ADR-920 §14.11 Π4/Π5/Π6).
 *
 * Config, not logic: each constant states WHY it has its value, so a later change argues with the reason, not the number.
 */

import { UPLOAD_LIMITS } from '@/config/file-upload-config';
import { DOCUMENT_TEXT_MAX_BYTES } from '@/lib/pdf/pdf-page-text';

/**
 * Layer-name STEMS that name the plot boundary (Π4, approved by Giorgio 2026-11-23 incl. ΓΕΩΤΕΜΑΧΙΟ + PLOT).
 * Compared after `normalizeForLabelMatch` (homoglyphs folded, accents/case/punctuation dropped), as substrings, so
 * `ΟΡΙΑ_ΟΙΚΟΠΕΔΟΥ`, `Ιδιοκτησία` and `PARCEL-BOUNDARY` all match. Stems, not words: Greek inflects
 * (ΟΙΚΟΠΕΔΟ · ΟΙΚΟΠΕΔΟΥ · ΟΙΚΟΠΕΔΑ). ⚠️ A layer name is EVIDENCE, never the decision — `ΟΡΙΟ ΡΕΜΑΤΟΣ` matches too.
 */
export const PLOT_OUTLINE_LAYER_STEMS: readonly string[] = [
  'ΟΡΙΟ', 'ΟΡΙΑ', 'ΟΙΚΟΠΕΔ', 'ΙΔΙΟΚΤΗΣΙ', 'ΓΕΩΤΕΜΑΧ',
  'BOUNDAR', 'PARCEL', 'PROPERT', 'PLOT',
];

/**
 * Declared area (the listing's, or an «Ε = …» written on the drawing) vs the outline's area, as |Δ| / declared.
 * ≤ 5 % counts FOR: a title-deed area and a modern survey of the same plot routinely differ by a few percent.
 * > 25 % counts AGAINST: no re-measurement explains a quarter — it is another polygon (a building, a neighbour).
 */
export const PLOT_AREA_AGREES_FRACTION = 0.05;
export const PLOT_AREA_DISAGREES_FRACTION = 0.25;

/**
 * Π6 — share of the outline covered by the relief. At or above this the relief «covers» the plot (the residue is the
 * float noise of clipping a tessellated arc); exactly 0 means another system or another place.
 */
export const PLOT_COVERAGE_FULL_FRACTION = 0.999;
/** At or above this, relief overlap counts FOR a candidate; 0 counts AGAINST. In between: no opinion. */
export const PLOT_COVERAGE_EVIDENCE_FRACTION = 0.5;

/**
 * A corner label sits «at» a vertex when it is closer than this fraction of the vertex's SHORTER adjacent edge —
 * relative, so it holds in any drawing unit and any scale, and a label can never be nearer to the next corner.
 */
export const CORNER_LABEL_REACH_FRACTION = 0.35;
/** Share of corners that must carry a label for the labels to count FOR the candidate. */
export const CORNER_LABELS_EVIDENCE_FRACTION = 0.75;
/**
 * What a corner label looks like: a Greek or Latin capital (optionally doubled — ΑΑ, ΑΒ after Ω), optionally
 * followed by digits (Κ1, Σ12). Compared after homoglyph folding + upper case.
 * ⚠️ **Bare numbers are NOT corner labels, on purpose**: a survey drawing numbers EVERY measured point (1, 2, 3 …), so
 * the corners of every building and kerb carry a number too — counting them would make every polygon look lettered.
 * A spot height («125.40») is not a label either.
 */
export const CORNER_LABEL_PATTERN = /^[Α-ΩA-Z]{1,2}\d{0,3}$/u;

/**
 * Closed polylines with more drawn corners than this are rejected as `too-many-corners`: a plot outline has tens of
 * corners, a closed contour thousands — and the self-intersection test is O(n²) (`planar-polygon`), so a sheet of
 * closed contours would stall the import for an answer that is never «this is the plot».
 */
export const PLOT_OUTLINE_MAX_CORNERS = 1000;

/** A coordinate table needs at least a triangle's worth of rows. */
export const COORDINATE_TABLE_MIN_ROWS = 3;
/**
 * Two rows of the same column whose vertical gap exceeds this multiple of the column's median row spacing belong to
 * DIFFERENT tables (a second table further down the sheet).
 */
export const COORDINATE_TABLE_GAP_FACTOR = 3;
/** Labels of one table column align within this many page units (a column is left- or centre-aligned). */
export const COORDINATE_COLUMN_X_TOLERANCE = 24;
/**
 * A written side length agrees with the coordinates when |Δ| ≤ this, metres: the table rounds to the centimetre, so
 * two rounded coordinates and a rounded length differ by at most ~1.5 cm.
 */
export const COORDINATE_SIDE_TOLERANCE_M = 0.02;
/**
 * A written area agrees with the coordinates when |Δ| ≤ perimeter × this (m² per metre of perimeter): coordinates
 * rounded to ±0.5 cm move the shoelace area by at most ~perimeter × 0.005 m; the factor 2 absorbs the area's own
 * rounding and the surveyor's choice of rounding before or after summing.
 */
export const COORDINATE_AREA_TOLERANCE_M2_PER_M = 0.01;

/**
 * Ζ3 — the byte ceilings of the surveyor's DRAWING at the door, per kind. Neither is a new number:
 * - DXF: the platform's ceiling for any stored file (`UPLOAD_LIMITS.MAX_FILE_SIZE`) — the DXF is kept in the dossier as the
 *   human's document, so it obeys the dossier's rule, and its text scan is linear.
 * - PDF: the ONE ceiling for documents read as text (`DOCUMENT_TEXT_MAX_BYTES`, ADR-949 Α-2) — the server opens the PDF with
 *   pdf.js to re-read its coordinate table, and that ceiling is what stops a PDF bomb before the parser.
 */
export const PLOT_DRAWING_MAX_BYTES = {
  dxf: UPLOAD_LIMITS.MAX_FILE_SIZE,
  pdf: DOCUMENT_TEXT_MAX_BYTES,
} as const;

/**
 * Ζ4 — how many PDF pages are searched for a coordinate table, by the server (`PUT`) AND by the device (the owner's
 * preview). ONE number: if the device read more pages than the server, it would offer a candidate the door then refuses
 * (`TERRAIN_PLOT_OUTLINE_NOT_IN_DRAWING`). 10 = the server's long-standing text ceiling (`pdf-rasterize.service`); a
 * topographic diagram is one or two sheets.
 */
export const PLOT_DRAWING_MAX_PDF_PAGES = 10;
