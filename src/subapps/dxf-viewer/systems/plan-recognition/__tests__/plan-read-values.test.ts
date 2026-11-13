/**
 * ADR-929 Δ21 (δ) — οι γραμμές της λίστας «Τι διάβασα»: η πιο ύποπτη πρώτη (σύγκρουση · αδέτη ή χωρίς τιμή · |w| ·
 * χαμηλή βεβαιότητα), με τιμή, κατάσταση, απόκλιση και προέλευση από τα δεδομένα που ήδη υπάρχουν.
 */

import type { FusedDimension, FusedDimensionStatus, PlanScaleSuggestion } from '../../../bim/plan-recognition/fusion/plan-fusion-types';
import type { PlanReading, PlanText, PlanTextKind } from '../../../bim/plan-recognition/plan-recognition-types';
import { isHumanChecked, planReadThumbRect, planReadValueRows, planReadValuesProgress } from '../plan-read-values';

const RECT = { minX: 0, minY: 0, maxX: 10, maxY: 10 };

const text = (id: string, raw: string, kind: PlanTextKind, score: number, correctedFrom?: string): PlanText =>
  ({ id, raw, kind, rect: RECT, confidence: { score, factors: { reading: score } }, ...(correctedFrom ? { correctedFrom } : {}) });

const fused = (textId: string, valueMm: number, status: FusedDimensionStatus, w: number | null, measuredMm: number | null): FusedDimension => ({
  textId, valueMm, precisionMm: 10, binding: null, measuredMm, adjustedMm: measuredMm, w, redundancy: null,
  detectableErrorMm: null, status, confidence: { score: 0.9, factors: {} }, rect: RECT,
});

const READING: PlanReading = {
  model: 'local-ocr:test',
  schemaVersion: 1,
  texts: [
    text('t1', 'ΣΑΛΟΝΙ', 'other', 0.4),
    text('t2', '2.05', 'dimension', 0.95),
    text('t3', '4.12', 'dimension', 0.9, '4.15'),
    text('t4', '412', 'dimension', 0.99),
    text('t5', '3.00', 'dimension', 0.6),
    text('t6', '1.80', 'dimension', 0.97),
    text('t7', '2.40', 'dimension', 0.5),
  ],
  dimensions: [
    { textId: 't2', valueMm: 2050, segmentIds: [], confidence: { score: 0.95, factors: {} } },
    { textId: 't3', valueMm: 4120, segmentIds: [], confidence: { score: 1, factors: {} } },
    { textId: 't5', valueMm: 3000, segmentIds: [], confidence: { score: 0.6, factors: {} } },
    { textId: 't6', valueMm: 1800, segmentIds: [], confidence: { score: 0.97, factors: {} } },
    { textId: 't7', valueMm: 2400, segmentIds: [], confidence: { score: 0.5, factors: {} } },
  ],
  writtenScale: null,
  rooms: [],
  openings: [],
};

/** Δ3 — μια κλίμακα στη σύντηξη (εδώ: συναίνεση διαστάσεων)· χωρίς αυτήν καμία πρόταση. */
const SCALE: PlanScaleSuggestion = {
  chosen: 'dimension-consensus', mmPerAlignedPx: 10, sigmaRel: 0.005, metresPerOriginalPx: 0.01,
  evidence: [{ source: 'dimension-consensus', mmPerAlignedPx: 10, support: 4 }],
};

const FUSION = {
  scale: SCALE,
  dimensions: [
    fused('t2', 2050, 'consistent', 0.4, 2060),
    fused('t3', 4120, 'conflict', -4.2, 3700),
    fused('t5', 3000, 'consistent', 0.4, 2990),
    fused('t6', 1800, 'unbound', null, null),
    fused('t7', 2400, 'consistent', 2.1, 2450),
  ],
};

describe('planReadValueRows — Δ21 (δ): η πιο ύποπτη πρώτη', () => {
  it('σύγκρουση → θέλει έλεγχο (αδέτη · χωρίς τιμή · ανάγνωση κάτω από «υψηλή») κατά |w| και μετά βεβαιότητα → διαστάσεις → άλλα', () => {
    expect(planReadValueRows(READING, FUSION).map((r) => r.textId)).toEqual(['t3', 't7', 't5', 't1', 't6', 't4', 't2']);
  });

  it('κάθε γραμμή: τιμή, κατάσταση, απόκλιση σχεδίου − γραμμένου, w, προέλευση «διορθώθηκε»', () => {
    const rows = new Map(planReadValueRows(READING, FUSION).map((r) => [r.textId, r]));
    expect(rows.get('t3')).toEqual({
      textId: 't3', raw: '4.12', correctedFrom: '4.15', confirmed: false, kind: 'dimension', valueMm: 4120, confidence: 0.9,
      status: 'conflict', deviationMm: -420, w: -4.2, priority: 'checked', suggestion: '3.70', scaleKnown: true,
    });
    expect(rows.get('t4')).toMatchObject({ valueMm: null, status: null, deviationMm: null, correctedFrom: null });
  });

  it('χωρίς σύντηξη ⇒ οι γραμμές υπάρχουν, χωρίς κατάσταση', () => {
    const rows = planReadValueRows(READING, null);
    expect(rows).toHaveLength(READING.texts.length);
    expect(rows.every((r) => r.status === null && r.w === null)).toBe(true);
  });
});

describe('Δ21 (δ) βήμα 3 — «Σωστό ✓»: επιβεβαίωση ≠ διόρθωση, και η πρόοδος του ελέγχου', () => {
  const confirmedReading: PlanReading = {
    ...READING,
    texts: READING.texts.map((t) => (t.id === 't2' ? { ...t, confirmed: true, confidence: { score: 1, factors: { reading: 1 } } } : t)),
  };

  it('επιβεβαιωμένη γραμμή: confirmed, ΧΩΡΙΣ correctedFrom (το κείμενο δεν άλλαξε)', () => {
    const t2 = planReadValueRows(confirmedReading, FUSION).find((r) => r.textId === 't2');
    expect(t2).toMatchObject({ raw: '2.05', confirmed: true, correctedFrom: null, confidence: 1 });
  });

  it('ελέγχθηκε = διορθώθηκε ή επιβεβαιώθηκε· πρόοδος N από M', () => {
    expect(isHumanChecked({ correctedFrom: null, confirmed: false })).toBe(false);
    expect(isHumanChecked({ correctedFrom: '4.15', confirmed: false })).toBe(true);
    expect(isHumanChecked({ correctedFrom: null, confirmed: true })).toBe(true);
    expect(planReadValuesProgress(planReadValueRows(READING, FUSION))).toEqual({ checked: 1, total: 7 });
    expect(planReadValuesProgress(planReadValueRows(confirmedReading, FUSION))).toEqual({ checked: 2, total: 7 });
    expect(planReadValuesProgress([])).toEqual({ checked: 0, total: 0 });
  });
});

describe('Δ21 (δ) βήμα 4 — ετικέτα προτεραιότητας από τον ΙΔΙΟ κανόνα με τη σειρά', () => {
  it('ύποπτη: σύγκρουση · αδέτη · χωρίς τιμή · ανάγνωση < 0,8· εντάξει: τα υπόλοιπα· ελέγχθηκε: ο άνθρωπος νικά', () => {
    const priority = Object.fromEntries(planReadValueRows(READING, FUSION).map((r) => [r.textId, r.priority]));
    expect(priority).toEqual({ t1: 'suspect', t2: 'ok', t3: 'checked', t4: 'suspect', t5: 'suspect', t6: 'suspect', t7: 'suspect' });
  });

  it('καμία «εντάξει» πάνω από «ύποπτη» που δεν ελέγχθηκε (ετικέτα και θέση δεν διαφωνούν)', () => {
    const order = planReadValueRows(READING, FUSION).filter((r) => r.priority !== 'checked').map((r) => r.priority);
    expect(order.indexOf('ok')).toBeGreaterThan(order.lastIndexOf('suspect'));
  });

  it('επιβεβαίωση ⇒ «ελέγχθηκε» ακόμα κι αν η ανάγνωση ήταν χαμηλή', () => {
    const reading: PlanReading = {
      ...READING,
      texts: READING.texts.map((t) => (t.id === 't7' ? { ...t, confirmed: true, confidence: { score: 1, factors: { reading: 1 } } } : t)),
    };
    expect(planReadValueRows(reading, FUSION).find((r) => r.textId === 't7')?.priority).toBe('checked');
  });
});

describe('Δ21 (δ) βήμα 7 — πρόταση από τη συνόρθωση για τιμή σε σύγκρουση', () => {
  it('μόνο σε σύγκρουση· γραμμένη με την ακρίβεια του κειμένου (adjustedMm 3700 ⇒ «3.70»)', () => {
    const rows = planReadValueRows(READING, FUSION);
    expect(rows.filter((r) => r.suggestion !== null).map((r) => [r.textId, r.suggestion])).toEqual([['t3', '3.70']]);
  });

  it('σκέτος ακέραιος σε σχέδιο που γράφει μέτρα ⇒ η πρόταση σε εκατοστά, όπως το κείμενο', () => {
    const reading: PlanReading = {
      ...READING,
      texts: [text('t2', '2.05', 'dimension', 0.95), text('t8', '412', 'dimension', 0.9)],
      dimensions: [
        { textId: 't2', valueMm: 2050, segmentIds: [], confidence: { score: 0.95, factors: {} } },
        { textId: 't8', valueMm: 4120, segmentIds: [], confidence: { score: 0.9, factors: {} } },
      ],
    };
    const fusion = { scale: SCALE, dimensions: [fused('t2', 2050, 'consistent', 0.4, 2060), fused('t8', 4120, 'conflict', 5, 3330)] };
    expect(planReadValueRows(reading, fusion).find((r) => r.textId === 't8')?.suggestion).toBe('333');
  });

  it('χωρίς συνορθωμένη τιμή, ή πρόταση ίδια με το κείμενο ⇒ καμία πρόταση', () => {
    const noAdjusted = { scale: SCALE, dimensions: [{ ...fused('t3', 4120, 'conflict', -4.2, null) }] };
    expect(planReadValueRows(READING, noAdjusted).find((r) => r.textId === 't3')?.suggestion).toBeNull();
    const same = { scale: SCALE, dimensions: [fused('t3', 4120, 'conflict', -4.2, 4118)] };
    expect(planReadValueRows(READING, same).find((r) => r.textId === 't3')?.suggestion).toBeNull();
  });
});

describe('Δ21 (δ) Δ3 — καμία πρόταση χωρίς κλίμακα (σκίτσο: το χαρτί δεν κρίνει γραμμένο αριθμό)', () => {
  it('🔴 σύγκρουση χωρίς κλίμακα στη σύντηξη ⇒ καμία πρόταση (DOC014: 2,05 → «2,59» από παραμορφωμένο χαρτί)', () => {
    const rows = planReadValueRows(READING, { ...FUSION, scale: null });
    expect(rows.filter((r) => r.suggestion !== null)).toEqual([]);
    expect(rows.every((r) => !r.scaleKnown)).toBe(true);
  });

  it('η σύγκρουση και η απόκλιση μένουν ορατές — μόνο η πρόταση φεύγει', () => {
    const t3 = planReadValueRows(READING, { ...FUSION, scale: null }).find((r) => r.textId === 't3');
    expect(t3).toMatchObject({ status: 'conflict', deviationMm: 3700 - 4120, suggestion: null, scaleKnown: false });
  });

  it('ΑΝΤΙΣΤΡΟΦΗ: με κλίμακα η πρόταση μένει (τυπωμένη σάρωση: πιάνει λάθη OCR)', () => {
    const t3 = planReadValueRows(READING, FUSION).find((r) => r.textId === 't3');
    expect(t3).toMatchObject({ suggestion: '3.70', scaleKnown: true });
  });

  it('χωρίς σύντηξη ⇒ ούτε κλίμακα ούτε πρόταση', () => {
    expect(planReadValueRows(READING, null).every((r) => r.suggestion === null && !r.scaleKnown)).toBe(true);
  });
});

describe('Δ21 (δ) βήμα 1 — planReadThumbRect: το πλαίσιο της μικρογραφίας', () => {
  it('περιθώριο 0,35 × ύψος γύρω από το κείμενο', () => {
    expect(planReadThumbRect({ minX: 100, minY: 50, maxX: 180, maxY: 70 })).toEqual({ minX: 93, minY: 43, maxX: 187, maxY: 77 });
  });
  it('ελάχιστο περιθώριο 2 px σε πολύ χαμηλό πλαίσιο', () => {
    expect(planReadThumbRect({ minX: 10, minY: 10, maxX: 20, maxY: 12 })).toEqual({ minX: 8, minY: 8, maxX: 22, maxY: 14 });
  });
});
