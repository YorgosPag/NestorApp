/**
 * ADR-941 Δ15 — `pdfVectorScale`: οι γραμμένες τιμές που δέθηκαν σε ακμές προτείνουν βαθμονόμηση (μία λύση, του
 * `solveCalibration`), επιβεβαιώνουν την υπάρχουσα όταν συμφωνούν, ή τη φέρνουν σε αντιπαράθεση όταν διαφωνούν.
 */

import type { CalibrationData, FloorplanBackground } from '../../../floorplan-background/providers/types';
import { rasterPixelToScene } from '../../../floorplan-background/geometry/raster-scene-mapping';
import type { PdfVectorContent } from '../../../pdf-background/services/pdf-vector-content';
import type { PdfDimensionBinding, PdfDimensionReading } from '../pdf-vector-dimension-binding';
import { isPdfVectorScaleCurrent, pdfVectorScale, pdfVectorScaleCalibration, type PdfVectorScaleProposal } from '../pdf-vector-scale';

/** Το σχήμα του ΤΕΣΤ1: ορθογώνιο 205 × 412 px, γραμμένο «2.05» × «4.12» (m) ⇒ 1 px = 10 mm. */
const CONTENT: PdfVectorContent = {
  polylines: [{ points: [[100, 100], [305, 100], [305, 512], [100, 512]], closed: true }],
  texts: [],
  skippedFills: 0,
};

const binding = (patch: Partial<PdfDimensionBinding>): PdfDimensionBinding => ({
  textIndex: 0, raw: '2.05', valueMm: 2050, precisionMm: 10,
  edge: { polylineIndex: 0, from: 0, to: 1 }, baselineMid: [202, 80], ...patch,
});

const READING: PdfDimensionReading = {
  bindings: [binding({}), binding({ textIndex: 1, raw: '4.12', valueMm: 4120, edge: { polylineIndex: 0, from: 1, to: 2 } })],
  pxPerMm: 0.1,
  unbound: 0,
};

const CALIBRATION: CalibrationData = {
  method: 'two-point', pointA: { x: 0, y: 0 }, pointB: { x: 1, y: 0 }, realDistance: 1, unit: 'mm',
  rotationDerived: false, calibratedAt: 0, calibratedBy: 'usr_test',
};

type Bg = Pick<FloorplanBackground, 'id' | 'transform' | 'naturalBounds' | 'calibration'>;
const background = (scale: number, calibration: CalibrationData | null): Bg => ({
  id: 'bg_1',
  transform: { translateX: 0, translateY: 0, scaleX: scale, scaleY: scale, rotation: 0 },
  naturalBounds: { width: 600, height: 700 },
  calibration,
});

const scaleOf = (bg: Bg, reading: PdfDimensionReading = READING) =>
  pdfVectorScale({ reading, content: CONTENT, background: bg, sceneUnits: 'mm' });

const proposalOf = (bg: Bg): PdfVectorScaleProposal => {
  const scale = scaleOf(bg);
  if (scale?.kind !== 'proposal') throw new Error(`expected proposal, got ${scale?.kind ?? 'null'}`);
  return scale;
};

const sceneLength = (bg: Bg, a: readonly [number, number], b: readonly [number, number]): number => {
  const pa = rasterPixelToScene({ x: a[0], y: a[1] }, bg);
  const pb = rasterPixelToScene({ x: b[0], y: b[1] }, bg);
  return Math.hypot(pb.x - pa.x, pb.y - pa.y);
};

describe('pdfVectorScale', () => {
  it('αβαθμονόμητο ⇒ πρόταση· η λύση κάνει τις πλευρές 2050 × 4120 mm, απόκλιση ≈ 0', () => {
    const proposal = proposalOf(background(1, null));
    expect(proposal.references.map((r) => r.raw)).toEqual(['2.05', '4.12']);
    expect(proposal.replacesMmPerPixel).toBeNull();
    expect(proposal.needsReview).toBe(false);
    const solved: Bg = { ...background(1, null), transform: proposal.solution.transform };
    expect(sceneLength(solved, [100, 100], [305, 100])).toBeCloseTo(2050, 6);
    expect(sceneLength(solved, [305, 100], [305, 512])).toBeCloseTo(4120, 6);
    for (const r of proposal.solution.residualsRel) expect(Math.abs(r)).toBeLessThan(1e-9);
  });

  it('βαθμονομημένο και συμφωνεί μέσα στο ψηφίο γραφής ⇒ επιβεβαίωση, καμία πρόταση', () => {
    expect(scaleOf(background(10, CALIBRATION))).toEqual({ kind: 'confirmed', agreeing: 2, maxDeviationRel: expect.any(Number) });
  });

  it('βαθμονομημένο αλλά διαφωνεί ⇒ πρόταση που δείχνει ΚΑΙ την τρέχουσα κλίμακα', () => {
    const proposal = proposalOf(background(1, CALIBRATION));
    expect(proposal.replacesMmPerPixel).toBeCloseTo(1, 9);
  });

  it('αβαθμονόμητο με ίδια κλίμακα ⇒ ακόμη πρόταση (η κλίμακα δεν έχει δηλωθεί)', () => {
    expect(scaleOf(background(10, null))?.kind).toBe('proposal');
  });

  it('χωρίς αποδεδειγμένη συναίνεση ή χωρίς δέσιμο ⇒ καμία κάρτα', () => {
    expect(scaleOf(background(1, null), { ...READING, pxPerMm: null })).toBeNull();
    expect(scaleOf(background(1, null), { bindings: [], pxPerMm: 0.1, unbound: 2 })).toBeNull();
  });

  it('ασυνεπείς τιμές ⇒ η πρόταση ζητά έλεγχο', () => {
    const reading = { ...READING, bindings: [READING.bindings[0], { ...READING.bindings[1], valueMm: 5000, raw: '5.00' }] };
    const scale = pdfVectorScale({ reading, content: CONTENT, background: background(1, null), sceneUnits: 'mm' });
    expect(scale?.kind === 'proposal' && scale.needsReview).toBe(true);
  });
});

describe('pdfVectorScaleCalibration · isPdfVectorScaleCurrent', () => {
  it('η εγγραφή είναι η ΙΔΙΑ λύση, με προέλευση pdf-vector-dimensions και όλες τις αναφορές', () => {
    const proposal = proposalOf(background(1, null));
    const { transform, data } = pdfVectorScaleCalibration(proposal, 123);
    expect(transform).toEqual(proposal.solution.transform);
    expect(data.origin).toBe('pdf-vector-dimensions');
    expect(data.calibratedAt).toBe(123);
    expect(data.references).toHaveLength(2);
    expect(data.references?.[0]).toMatchObject({ pointA: { x: 100, y: 100 }, pointB: { x: 305, y: 100 }, realDistance: 2050, unit: 'mm' });
  });

  it('άλλο υπόβαθρο ή άλλη τοποθέτηση ⇒ μπαγιάτικη', () => {
    const proposal = proposalOf(background(1, null));
    expect(isPdfVectorScaleCurrent(proposal, background(1, null))).toBe(true);
    expect(isPdfVectorScaleCurrent(proposal, { ...background(1, null), id: 'bg_2' })).toBe(false);
    expect(isPdfVectorScaleCurrent(proposal, background(2, null))).toBe(false);
    expect(isPdfVectorScaleCurrent(proposal, null)).toBe(false);
  });
});
