/**
 * @fileoverview **Η προβολή του τοπογραφικού σχεδίου** — ό,τι χρειάζεται ένα SVG για να δείξει το σχέδιο με τα υποψήφια
 * περιγράμματα, και η ζώνη της σελίδας PDF όπου διαβάστηκε ο πίνακας (ADR-920 §14.11 Ζ4 · Π4 · Π5).
 * @related components/terrain/plot-outline/PlotDxfDrawingView · PlotPdfDrawingView (οι καταναλωτές) ·
 *   ./dxf-plot-outline-candidates (τα υποψήφια, WORLD mm) · ./pdf-coordinate-rows (οι γραμμές του πίνακα, με θέσεις)
 * @module lib/terrain/plot-outline/plot-drawing-view
 *
 * 🔑 **Μία κλίμακα για όλα**: το σχέδιο (ως πλαίσιο) και τα υποψήφια ζωγραφίζονται στο ΙΔΙΟ WORLD mm — με την ίδια κλίμακα
 *    που έδωσε τα υποψήφια — άρα το τονισμένο πέφτει ακριβώς πάνω στη γραμμή του σχεδίου από την οποία βγήκε.
 * 🔑 **Βορράς πάνω**: το SVG μετρά y προς τα κάτω, η κάτοψη προς τα πάνω· η αναστροφή γίνεται ΕΔΩ, μία φορά (`planSvgPoint`).
 * 🔑 **Τοπική αρχή, ποτέ απόλυτο ΕΓΣΑ στο SVG**: ο ζωγράφος του browser δουλεύει σε float32 — με συντεταγμένες ~4,5·10⁹ mm το
 *    βήμα του είναι εκατοντάδες mm και το σχέδιο βγαίνει ΚΕΝΟ (μετρημένο ζωντανά 2026-11-24, ενώ το `getBoundingClientRect`
 *    έβγαινε σωστό). Γι' αυτό το `viewBox` ξεκινά από το 0 και ΚΑΘΕ συντεταγμένη περνά από το ΙΔΙΟ `planSvgPoint`, που
 *    αφαιρεί την αρχή του πλαισίου σε διπλή ακρίβεια (SSoT `worldToLocal`, ADR-650) — γραμμές, στόχοι κλικ, ετικέτες μαζί.
 * 🔑 **Ζώνη, όχι πλαίσιο**: από τον πίνακα ξέρουμε το y κάθε γραμμής και το x της ετικέτας — όχι πού τελειώνουν οι αριθμοί.
 *    Τονίζεται λοιπόν η οριζόντια ζώνη των γραμμών που έδωσαν το περίγραμμα, ποτέ ένα πλαίσιο που θα επινοούσε πλάτος.
 *
 * Pure: no I/O, importable by the browser.
 */

import type { PlanarPoint } from '@/lib/geometry/planar-polygon';
import type { PdfPositionedPage } from '@/lib/pdf/pdf-page-text';
import type { LocalOrigin } from '@/lib/terrain/terrain-types';
import { localToWorld, worldToLocal } from '@/lib/terrain/topo-local-origin';

import type { DxfPlotDrawing } from './dxf-plot-outline-candidates';
import { coordinateRowsOf } from './pdf-coordinate-rows';
import type { PlotOutlineCandidate } from './plot-outline-types';

/** Το περιθώριο γύρω από το σχέδιο, ως κλάσμα της μεγαλύτερης διάστασης. */
const VIEW_MARGIN_FRACTION = 0.04;

/** Ελάχιστη διάσταση του πλαισίου (mm) — ένα σχέδιο ενός σημείου δεν γίνεται πλαίσιο μηδενικού πλάτους. */
const MIN_VIEW_EXTENT_MM = 1000;

/**
 * Το πλαίσιο της προβολής: η **τοπική αρχή** του (WORLD mm — η πάνω-αριστερή γωνία: ελάχιστο x, μέγιστο y) και οι διαστάσεις του.
 * Το SVG `viewBox` ξεκινά ΠΑΝΤΑ από το 0· κάθε συντεταγμένη γράφεται σχετική προς την αρχή (`planPathData` · `planSvgPoint`).
 */
export interface PlanViewBox {
  readonly origin: LocalOrigin;
  readonly width: number;
  readonly height: number;
}

/** Το πλαίσιο που χωρά όλα τα σημεία, τετράγωνο, με περιθώριο — `null` όταν δεν υπάρχει κανένα. */
export function planViewBoxOf(lines: readonly (readonly PlanarPoint[])[]): PlanViewBox | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const line of lines) {
    for (const { x, y } of line) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  if (!Number.isFinite(minX)) return null;
  const extent = Math.max(maxX - minX, maxY - minY, MIN_VIEW_EXTENT_MM);
  const margin = extent * VIEW_MARGIN_FRACTION;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const half = extent / 2 + margin;
  return { origin: { x: cx - half, y: cy + half }, width: 2 * half, height: 2 * half };
}

/** Πλαίσιο → η τιμή του χαρακτηριστικού `viewBox` — πάντα από το 0 (η αρχή έχει ήδη αφαιρεθεί από τις συντεταγμένες). */
export function viewBoxAttribute(box: PlanViewBox): string {
  return `0 0 ${box.width} ${box.height}`;
}

/** Ένα σημείο κάτοψης (WORLD mm) → θέση SVG μέσα στο πλαίσιο: σχετική προς την αρχή, με αναστραμμένο y (≥ 0 προς τα κάτω). */
export function planSvgPoint(point: PlanarPoint, box: PlanViewBox): { readonly x: number; readonly y: number } {
  const local = worldToLocal(point, box.origin);
  // `0 - y`: το μηδέν μένει +0 (ποτέ «-0» μέσα στο `d`).
  return { x: local.x, y: 0 - local.y };
}

/** Το αντίστροφο του {@link planSvgPoint}: θέση SVG μέσα στο πλαίσιο → σημείο κάτοψης (WORLD mm) — για τον δείκτη πάνω στο σχέδιο. */
export function planWorldPoint(svgPoint: { readonly x: number; readonly y: number }, box: PlanViewBox): PlanarPoint {
  return localToWorld({ x: svgPoint.x, y: 0 - svgPoint.y }, box.origin);
}

/** Μια γραμμή κάτοψης (WORLD mm) → `d` ενός SVG path μέσα στο πλαίσιο. */
export function planPathData(line: readonly PlanarPoint[], closed: boolean, box: PlanViewBox): string {
  if (line.length === 0) return '';
  const body = line.map((point, index) => {
    const { x, y } = planSvgPoint(point, box);
    return `${index === 0 ? 'M' : 'L'}${x} ${y}`;
  }).join('');
  return `${body}${closed ? 'Z' : ''}`;
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
