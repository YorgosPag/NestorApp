/**
 * @fileoverview **Η προβολή του τοπογραφικού σχεδίου** — ό,τι χρειάζεται ένα SVG για να δείξει το σχέδιο με τα υποψήφια
 * περιγράμματα, και η ζώνη της σελίδας PDF όπου διαβάστηκε ο πίνακας (ADR-920 §14.11 Ζ4 · Π4 · Π5).
 * @related components/terrain/plot-outline/PlotDxfDrawingView · PlotPdfDrawingView (οι καταναλωτές) ·
 *   ./dxf-plot-outline-candidates (τα υποψήφια, WORLD mm) · ./pdf-coordinate-rows (οι γραμμές του πίνακα, με θέσεις)
 * @module lib/terrain/plot-outline/plot-drawing-view
 *
 * 🔑 **Μία κλίμακα για όλα**: το σχέδιο (ως πλαίσιο) και τα υποψήφια ζωγραφίζονται στο ΙΔΙΟ WORLD mm — με την ίδια κλίμακα
 *    που έδωσε τα υποψήφια — άρα το τονισμένο πέφτει ακριβώς πάνω στη γραμμή του σχεδίου από την οποία βγήκε.
 * 🔑 **Βορράς πάνω**: το SVG μετρά y προς τα κάτω, η κάτοψη προς τα πάνω· η αναστροφή γίνεται ΕΔΩ, μία φορά (`-y`).
 * 🔑 **Ζώνη, όχι πλαίσιο**: από τον πίνακα ξέρουμε το y κάθε γραμμής και το x της ετικέτας — όχι πού τελειώνουν οι αριθμοί.
 *    Τονίζεται λοιπόν η οριζόντια ζώνη των γραμμών που έδωσαν το περίγραμμα, ποτέ ένα πλαίσιο που θα επινοούσε πλάτος.
 *
 * Pure: no I/O, importable by the browser.
 */

import type { PlanarPoint } from '@/lib/geometry/planar-polygon';
import type { PdfPositionedPage } from '@/lib/pdf/pdf-page-text';

import type { DxfPlotDrawing } from './dxf-plot-outline-candidates';
import { coordinateRowsOf } from './pdf-coordinate-rows';
import type { PlotOutlineCandidate } from './plot-outline-types';

/** Το περιθώριο γύρω από το σχέδιο, ως κλάσμα της μεγαλύτερης διάστασης. */
const VIEW_MARGIN_FRACTION = 0.04;

/** Ελάχιστη διάσταση του πλαισίου (mm) — ένα σχέδιο ενός σημείου δεν γίνεται πλαίσιο μηδενικού πλάτους. */
const MIN_VIEW_EXTENT_MM = 1000;

/** Ένα SVG `viewBox` σε WORLD mm με αναστραμμένο y (βορράς πάνω). */
export interface PlanViewBox {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
}

/** Το `viewBox` που χωρά όλα τα σημεία, με περιθώριο — `null` όταν δεν υπάρχει κανένα. */
export function planViewBoxOf(lines: readonly (readonly PlanarPoint[])[]): PlanViewBox | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const line of lines) {
    for (const { x, y } of line) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, -y); maxY = Math.max(maxY, -y);
    }
  }
  if (!Number.isFinite(minX)) return null;
  const extent = Math.max(maxX - minX, maxY - minY, MIN_VIEW_EXTENT_MM);
  const margin = extent * VIEW_MARGIN_FRACTION;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const half = extent / 2 + margin;
  return { minX: cx - half, minY: cy - half, width: 2 * half, height: 2 * half };
}

/** `viewBox` → η τιμή του χαρακτηριστικού. */
export function viewBoxAttribute(box: PlanViewBox): string {
  return `${box.minX} ${box.minY} ${box.width} ${box.height}`;
}

/** Μια γραμμή κάτοψης → `d` ενός SVG path, με αναστραμμένο y. */
export function planPathData(line: readonly PlanarPoint[], closed: boolean): string {
  if (line.length === 0) return '';
  const head = `M${line[0].x} ${-line[0].y}`;
  const rest = line.slice(1).map((p) => `L${p.x} ${-p.y}`).join('');
  return `${head}${rest}${closed ? 'Z' : ''}`;
}

/** Ένα σημείο κάτοψης → θέση SVG (αναστραμμένο y) — για ετικέτες κορυφών. */
export function planSvgPoint(point: PlanarPoint): { readonly x: number; readonly y: number } {
  return { x: point.x, y: -point.y };
}

/** Μια γραμμή του σχεδίου ως πλαίσιο της προβολής: οι κορυφές της σε WORLD mm, με τη σημαία κλεισίματος. */
export interface PlanContextLine {
  readonly points: readonly PlanarPoint[];
  readonly closed: boolean;
}

/**
 * **Όλες οι πολυγραμμές του σχεδίου, σε WORLD mm** — το πλαίσιο πάνω στο οποίο τονίζονται τα υποψήφια. Τα τόξα εδώ
 * σχεδιάζονται ως χορδές: είναι μόνο φόντο· τα υποψήφια έρχονται με τα τόξα τους τεμαχισμένα από τον πυρήνα.
 */
export function dxfContextLines(drawing: DxfPlotDrawing, scaleToMm: number): PlanContextLine[] {
  return drawing.polylines.polylines.map((polyline) => ({
    points: polyline.vertices.map(({ x, y }) => ({ x: x * scaleToMm, y: y * scaleToMm })),
    closed: polyline.closed,
  }));
}

/** Η ζώνη της σελίδας (κλάσματα του ύψους, 0 = πάνω) όπου βρίσκονται οι γραμμές του πίνακα. */
export interface PageBand {
  readonly top: number;
  readonly bottom: number;
}

/** Μισό ύψος γραμμής κειμένου ως κλάσμα της σελίδας — η ζώνη αγκαλιάζει τα γράμματα, όχι μόνο τη γραμμή βάσης. */
const BAND_PAD_FRACTION = 0.008;

/**
 * **Πού στη σελίδα διαβάστηκε αυτό το περίγραμμα** — οι γραμμές του πίνακα της σελίδας του υποψηφίου που δίνουν τις
 * κορυφές του (ίδιες συντεταγμένες στο χιλιοστό). `null` όταν δεν βρίσκεται καμία (π.χ. άλλη σελίδα).
 */
export function pdfTableBandOf(pages: readonly PdfPositionedPage[], candidate: PlotOutlineCandidate): PageBand | null {
  if (candidate.origin.source !== 'pdf-table') return null;
  const pageNumber = candidate.origin.page;
  const page = pages.find((p) => p.page === pageNumber);
  if (page === undefined || page.height <= 0) return null;
  const corners = new Set(candidate.ringWorldMm.map(({ x, y }) => `${Math.round(x)}:${Math.round(y)}`));
  const ys = coordinateRowsOf(page)
    .filter((row) => corners.has(`${Math.round(row.eastingM * 1000)}:${Math.round(row.northingM * 1000)}`))
    .map((row) => row.y / page.height);
  if (ys.length === 0) return null;
  return {
    top: Math.max(0, Math.min(...ys) - BAND_PAD_FRACTION * 2),
    bottom: Math.min(1, Math.max(...ys) + BAND_PAD_FRACTION),
  };
}
