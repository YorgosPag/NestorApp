/**
 * ADR-464 Slice 5 — design-summary region (checks table) builder.
 *
 * Καλύπτει: header + 3 γραμμές ελέγχων, ένδειξη OK/!, χρωματισμό ανεπάρκειας, και
 * τη γραμμή «άνω σχάρα» όταν κυριαρχεί hogging (κάμψη).
 */

import { buildFootingDesignSummaryRegion } from '../footing-detail-design-summary';
import type { FootingDesignSummaryLabels, RectMm, TextPrimitive } from '../detail-sheet-types';
import type { FootingDesignResult } from '../../footing-design/footing-design-types';

const labels: FootingDesignSummaryLabels = {
  check: 'Έλεγχος', demand: 'Απαίτηση', capacity: 'Αντοχή', utilization: 'Αξιοπ.',
  bearing: 'Έδραση', punching: 'Διάτρηση', oneWayShear: 'Τέμνουσα',
  topMeshNote: 'Άνω σχάρα', ok: 'OK', fail: '!',
};

const region: RectMm = { x: 0, y: 0, w: 100, h: 80 };

function result(opts?: { bearingOk?: boolean; hogging?: boolean }): FootingDesignResult {
  const ok = opts?.bearingOk ?? true;
  return {
    bearing: {
      pMaxKpa: ok ? 150 : 350, pMinKpa: 100, eccentricityXMm: 0, eccentricityYMm: 0, upliftsBase: false,
      check: { demand: ok ? 150 : 350, capacity: 200, utilization: ok ? 0.75 : 1.75, adequate: ok },
    },
    flexure: {
      asBottomXMm2PerM: 500, asBottomYMm2PerM: 500, asTopMm2PerM: opts?.hogging ? 300 : 0,
      hoggingGoverns: opts?.hogging ?? false, eccentricityRatioX: 0.1, eccentricityRatioY: 0.1,
    },
    punching: {
      vEdMpa: 0.4, vRdcMpa: 0.5, controlPerimeterMm: 4000,
      check: { demand: 0.4, capacity: 0.5, utilization: 0.8, adequate: true },
    },
    oneWayShear: {
      vEdXMpa: 0.3, vEdYMpa: 0.25, vRdcMpa: 0.5,
      check: { demand: 0.3, capacity: 0.5, utilization: 0.6, adequate: true },
    },
  };
}

const texts = (prims: readonly { kind: string }[]): TextPrimitive[] =>
  prims.filter((p): p is TextPrimitive => p.kind === 'text');

describe('buildFootingDesignSummaryRegion', () => {
  it('header (4 ετικέτες) + 3 γραμμές ελέγχων', () => {
    const { primitives } = buildFootingDesignSummaryRegion(result(), region, labels);
    const t = texts(primitives);
    expect(t.some((p) => p.text === labels.bearing)).toBe(true);
    expect(t.some((p) => p.text === labels.punching)).toBe(true);
    expect(t.some((p) => p.text === labels.oneWayShear)).toBe(true);
    // util cells περιέχουν OK όταν επαρκούν.
    expect(t.filter((p) => p.text.includes('OK')).length).toBe(3);
  });

  it('ανεπαρκής έδραση → ένδειξη «!» + κόκκινο χρώμα στο util cell', () => {
    const { primitives } = buildFootingDesignSummaryRegion(result({ bearingOk: false }), region, labels);
    const failCell = texts(primitives).find((p) => p.text.includes('!') && p.text.includes('%'));
    expect(failCell).toBeDefined();
    expect(failCell!.colorHex).toBe('#b00020');
  });

  it('hogging → γραμμή «άνω σχάρα»· αλλιώς απούσα', () => {
    const withHog = buildFootingDesignSummaryRegion(result({ hogging: true }), region, labels);
    expect(texts(withHog.primitives).some((p) => p.text === labels.topMeshNote)).toBe(true);
    const noHog = buildFootingDesignSummaryRegion(result({ hogging: false }), region, labels);
    expect(texts(noHog.primitives).some((p) => p.text === labels.topMeshNote)).toBe(false);
  });
});
