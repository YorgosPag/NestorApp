/**
 * ADR-929 Δ21 (δ) — οι γραμμές της λίστας «Τι διάβασα»: η πιο ύποπτη πρώτη (σύγκρουση · αδέτη ή χωρίς τιμή · |w| ·
 * χαμηλή βεβαιότητα), με τιμή, κατάσταση, απόκλιση και προέλευση από τα δεδομένα που ήδη υπάρχουν.
 */

import type { FusedDimension, FusedDimensionStatus } from '../../../bim/plan-recognition/fusion/plan-fusion-types';
import type { PlanReading, PlanText, PlanTextKind } from '../../../bim/plan-recognition/plan-recognition-types';
import { planReadValueRows } from '../plan-read-values';

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

const FUSION = {
  dimensions: [
    fused('t2', 2050, 'consistent', 0.4, 2060),
    fused('t3', 4120, 'conflict', -4.2, 3700),
    fused('t5', 3000, 'consistent', 0.4, 2990),
    fused('t6', 1800, 'unbound', null, null),
    fused('t7', 2400, 'consistent', 2.1, 2450),
  ],
};

describe('planReadValueRows — Δ21 (δ): η πιο ύποπτη πρώτη', () => {
  it('σύγκρουση → αδέτη / χωρίς τιμή → διαστάσεις κατά |w| και μετά χαμηλή βεβαιότητα → άλλα κείμενα', () => {
    expect(planReadValueRows(READING, FUSION).map((r) => r.textId)).toEqual(['t3', 't6', 't4', 't7', 't5', 't2', 't1']);
  });

  it('κάθε γραμμή: τιμή, κατάσταση, απόκλιση σχεδίου − γραμμένου, w, προέλευση «διορθώθηκε»', () => {
    const rows = new Map(planReadValueRows(READING, FUSION).map((r) => [r.textId, r]));
    expect(rows.get('t3')).toEqual({
      textId: 't3', raw: '4.12', correctedFrom: '4.15', kind: 'dimension', valueMm: 4120, confidence: 0.9,
      status: 'conflict', deviationMm: -420, w: -4.2,
    });
    expect(rows.get('t4')).toMatchObject({ valueMm: null, status: null, deviationMm: null, correctedFrom: null });
  });

  it('χωρίς σύντηξη ⇒ οι γραμμές υπάρχουν, χωρίς κατάσταση', () => {
    const rows = planReadValueRows(READING, null);
    expect(rows).toHaveLength(READING.texts.length);
    expect(rows.every((r) => r.status === null && r.w === null)).toBe(true);
  });
});
