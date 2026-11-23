/**
 * ADR-920 §14.11 Ζ4 — ο ΚΟΙΝΟΣ πυρήνας ανάγνωσης σχεδίου (συσκευή + πόρτα), η κατάσταση της πόρτας, η προβολή.
 *
 * Άγκυρες: Κ = είδος από τα bytes · Μ = μονάδα (ποτέ μαντεψιά) · Τ = κατάταξη στη συσκευή (Π6 = της πόρτας) ·
 * Δ = ίδιος δακτύλιος στο κανονικό χιλιοστό · Σ = συμβόλαιο κατάστασης (zod) · Π = προβολή (κουτί, διαδρομή, ζώνη PDF).
 */

import { scanDxfPlotDrawing } from '../dxf-plot-outline-candidates';
import {
  dxfDeclaresUnit,
  dxfDrawingScaleToMm,
  plotDrawingKindOf,
  rankedDxfDrawing,
  rankedPdfReading,
} from '../plot-drawing-read';
import { pdfTableBandOf, planPathData, planViewBoxOf } from '../plot-drawing-view';
import { PLOT_DRAWING_MAX_BYTES } from '../plot-outline-config';
import { parsePlotOutlineStatus } from '../plot-outline-status';
import type { PlotOutlineCandidate } from '../plot-outline-types';
import { samePlotOutlineRing } from '../../publication/listing-terrain-source';

const bytesOf = (text: string) => new TextEncoder().encode(text);

const header = (insunits: number | null): string[] =>
  insunits === null ? [] : ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', String(insunits), '0', 'ENDSEC'];

/** Ένα DXF με ένα κλειστό LWPOLYLINE `ΟΡΙΟ` 30×20 (μονάδες σχεδίου). */
function plotDxf(insunits: number | null): string {
  const vertices = [[0, 0], [30, 0], [30, 20], [0, 20]].flatMap(([x, y]) => ['10', String(x), '20', String(y)]);
  return [
    ...header(insunits),
    '0', 'SECTION', '2', 'ENTITIES',
    '0', 'LWPOLYLINE', '5', 'A1', '8', 'ΟΡΙΟ', '90', '4', '70', '1', ...vertices,
    '0', 'ENDSEC', '0', 'EOF',
  ].join('\n');
}

describe('Κ — είδος από τα bytes (ο ΙΔΙΟΣ κριτής με την πόρτα)', () => {
  it('DXF κειμένου ⇒ dxf, ακόμη και με όνομα .txt', () => {
    expect(plotDrawingKindOf('plan.txt', bytesOf(plotDxf(6)))).toEqual({ ok: true, kind: 'dxf' });
  });
  it('PDF ⇒ pdf', () => {
    expect(plotDrawingKindOf('plan.pdf', bytesOf('%PDF-1.7\n…'))).toEqual({ ok: true, kind: 'pdf' });
  });
  it('DWG ⇒ ονομασμένη άρνηση dwg', () => {
    const dwg = new Uint8Array([0x41, 0x43, 0x31, 0x30, 0x33, 0x32, 0, 0, 0, 0, 0, 0, 0]);
    expect(plotDrawingKindOf('plan.dwg', dwg)).toEqual({ ok: false, refusal: 'dwg' });
  });
  it('κενό ⇒ empty · CSV ⇒ unsupported', () => {
    expect(plotDrawingKindOf('plan.dxf', new Uint8Array())).toEqual({ ok: false, refusal: 'empty' });
    expect(plotDrawingKindOf('points.csv', bytesOf('x,y,z\n1,2,3\n'))).toEqual({ ok: false, refusal: 'unsupported' });
  });
  it('πάνω από το ταβάνι ΤΟΥ ΕΙΔΟΥΣ ⇒ too-large', () => {
    const big = new Uint8Array(PLOT_DRAWING_MAX_BYTES.pdf + 1);
    big.set(bytesOf('%PDF-1.7'));
    expect(plotDrawingKindOf('plan.pdf', big)).toEqual({ ok: false, refusal: 'too-large' });
  });
});

describe('Μ — μονάδα: του αρχείου, αλλιώς του ανθρώπου, ποτέ μαντεψιά', () => {
  it('$INSUNITS = 6 (μέτρα) ⇒ 1000, και ο άνθρωπος δεν ρωτιέται', () => {
    const drawing = scanDxfPlotDrawing(plotDxf(6));
    expect(dxfDeclaresUnit(drawing)).toBe(true);
    expect(dxfDrawingScaleToMm(drawing.declaredInsunits, 'ft')).toBe(1000);
  });
  it('χωρίς $INSUNITS ⇒ null μέχρι να διαλέξει ο άνθρωπος', () => {
    const drawing = scanDxfPlotDrawing(plotDxf(null));
    expect(dxfDeclaresUnit(drawing)).toBe(false);
    expect(dxfDrawingScaleToMm(drawing.declaredInsunits, null)).toBeNull();
    expect(dxfDrawingScaleToMm(drawing.declaredInsunits, 'm')).toBe(1000);
  });
});

describe('Τ — κατάταξη στη συσκευή', () => {
  it('το ΟΡΙΟ με εμβαδόν ίσο με της αγγελίας προτείνεται· η επικάλυψη μένει «άγνωστη» (Π6 = της πόρτας)', () => {
    const { found, ranking } = rankedDxfDrawing(scanDxfPlotDrawing(plotDxf(6)), 1000, { listingAreaM2: 600 });
    expect(found.candidates).toHaveLength(1);
    expect(ranking.proposedId).toBe(found.candidates[0].id);
    const relief = ranking.ranked[0].evidence.find((e) => e.kind === 'relief-overlap');
    expect(relief === undefined || relief.verdict === 'unknown').toBe(true);
  });
  it('PDF χωρίς πίνακα ⇒ καμία κατάταξη (φαίνεται, δεν δίνει περίγραμμα)', () => {
    expect(rankedPdfReading({ status: 'no-coordinate-table' }, { listingAreaM2: null })).toBeNull();
    expect(rankedPdfReading({ status: 'unreadable' }, { listingAreaM2: null })).toBeNull();
  });
});

describe('Δ — ίδιος δακτύλιος στο κανονικό χιλιοστό', () => {
  const ring = [{ x: 412345678.4, y: 4498765432.6 }, { x: 412355678, y: 4498765433 }, { x: 412355678, y: 4498775433 }];
  it('ωμό WORLD mm ⇔ στρογγυλεμένο της πηγής = ίδιος', () => {
    expect(samePlotOutlineRing(ring, ring.map(({ x, y }) => ({ x: Math.round(x), y: Math.round(y) })))).toBe(true);
  });
  it('ένα χιλιοστό αλλού ή άλλο πλήθος ⇒ άλλος', () => {
    expect(samePlotOutlineRing(ring, [{ x: 412345679, y: 4498765433 }, ...ring.slice(1)])).toBe(false);
    expect(samePlotOutlineRing(ring, ring.slice(1))).toBe(false);
  });
});

describe('Σ — συμβόλαιο κατάστασης', () => {
  const drawing = {
    fileId: 'file_1', fileName: 'topo.dxf', createdAt: '2026-11-23T10:00:00.000Z', place: 'trash',
    candidateId: 'dxf:A1', origin: { source: 'dxf', handle: 'A1', layer: 'ΟΡΙΟ', closure: 'flag' },
    drawingUnit: null, drawingSha256: 'a'.repeat(64), areaM2: 600, isOutlineSource: true,
  };
  it('έγκυρη απάντηση περνά αυτούσια', () => {
    const raw = { hasRelief: true, outline: { showInListing: false, areaM2: 600, authority: 'relief' }, drawing };
    expect(parsePlotOutlineStatus(raw)).toEqual(raw);
  });
  it.each([
    ['χωρίς hasRelief', { outline: null, drawing: null }],
    ['άγνωστη αρχή', { hasRelief: true, outline: { showInListing: true, areaM2: 1, authority: 'browser' }, drawing: null }],
    ['άγνωστο place', { hasRelief: true, outline: null, drawing: { ...drawing, place: 'archived' } }],
    ['σπασμένο sha', { hasRelief: true, outline: null, drawing: { ...drawing, drawingSha256: 'xyz' } }],
  ])('%s ⇒ null (ποτέ cast)', (_label, raw) => {
    expect(parsePlotOutlineStatus(raw)).toBeNull();
  });
});

describe('Π — προβολή', () => {
  it('βορράς πάνω: το y αναστρέφεται μία φορά', () => {
    expect(planPathData([{ x: 0, y: 0 }, { x: 10, y: 5 }], true)).toBe('M0 0L10 -5Z');
  });
  it('το κουτί χωρά τα πάντα, τετράγωνο, με περιθώριο', () => {
    const box = planViewBoxOf([[{ x: 0, y: 0 }, { x: 30000, y: 20000 }]]);
    expect(box).not.toBeNull();
    expect(box!.width).toBe(box!.height);
    expect(box!.minX).toBeLessThan(0);
    expect(box!.minY).toBeLessThan(-20000);
    expect(planViewBoxOf([])).toBeNull();
  });
  it('η ζώνη του πίνακα: μόνο οι γραμμές που δίνουν τις κορυφές, μόνο στη σελίδα τους', () => {
    const candidate: PlotOutlineCandidate = {
      id: 'pdf:1:0', origin: { source: 'pdf-table', page: 2 }, ringWorldMm: [], corners: [], areaM2: 1,
    };
    expect(pdfTableBandOf([], candidate)).toBeNull();
    const dxfCandidate: PlotOutlineCandidate = { ...candidate, origin: { source: 'dxf', handle: null, layer: 'x', closure: 'flag' } };
    expect(pdfTableBandOf([], dxfCandidate)).toBeNull();
  });
});
