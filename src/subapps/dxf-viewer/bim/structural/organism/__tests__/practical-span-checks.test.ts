/**
 * ADR-504 §Φ1 — `runPracticalSpanChecks`: soft `warning` + πρόταση ενδιάμεσων κολωνών όταν
 * το αυτόματο ύψος δοκαριού κόβει το πρακτικό καθαρό ύψος κάτω της (δυναμικό threshold =
 * ύψος ορόφου − required clear). Practical ≠ Feasible. Fixtures: canvas = mm.
 */

import {
  runPracticalSpanChecks,
  suggestIntermediateColumnCount,
  MAX_INTERMEDIATE_COLUMNS,
  type PracticalSpanStorey,
} from '../practical-span-checks';
import {
  practicalBeamDepthLimitMm,
  requiredClearHeightUnderBeamMm,
} from '../../codes/clear-height-under-beam';
import { buildBeamSectionContext } from '../../section-context';
import { suggestBeamSection } from '../../sizing/member-sizing';
import { EUROCODE_PROVIDER } from '../../codes/eurocode-provider';
import type { Entity } from '../../../../types/entities';
import type { BeamParams } from '../../../types/beam-types';
import type { StructuralGraph } from '../structural-organism-types';

function beam(id: string, lengthMm: number, over: Partial<BeamParams> = {}): Entity {
  return {
    id, type: 'beam', kind: 'straight',
    params: {
      kind: 'straight', width: 250, depth: 500, sceneUnits: 'mm',
      startPoint: { x: 0, y: 0 }, endPoint: { x: lengthMm, y: 0 },
      supportType: 'simple',
      appliedLoad: { deadAxialKn: 300, liveAxialKn: 120 },
      ...over,
    },
    geometry: { length: lengthMm / 1000, volume: 1 },
  } as unknown as Entity;
}

/** Graph με `n` `column-bearing` ακμές πάνω στο δοκάρι (n στηρίξεις). */
function graphWithSupports(beamId: string, n: number): StructuralGraph {
  const edges = Array.from({ length: n }, (_unused, i) => ({
    id: `c${i}->${beamId}:column-bearing`,
    supportId: `c${i}`,
    supportedId: beamId,
    kind: 'column-bearing' as const,
  }));
  return { nodes: [], edges };
}

const STANDARD_3M: PracticalSpanStorey = { storeyHeightMm: 3000, storeyKind: 'standard' };
const BASEMENT_3M: PracticalSpanStorey = { storeyHeightMm: 3000, storeyKind: 'basement' };
const TALL_4M: PracticalSpanStorey = { storeyHeightMm: 4000, storeyKind: 'standard' };
const CODE = 'beamSpanImpractical';

const impracticalFor = (entities: readonly Entity[], graph: StructuralGraph, storey: PracticalSpanStorey) =>
  runPracticalSpanChecks(entities, graph, EUROCODE_PROVIDER, storey).find((d) => d.code === CODE);

describe('runPracticalSpanChecks — trigger', () => {
  it('16m φορτισμένη αμφιέρειστη (2 στηρίξεις) σε όροφο 3m → warning + columns≥1', () => {
    const d = impracticalFor([beam('b1', 16000)], graphWithSupports('b1', 2), STANDARD_3M);
    expect(d).toBeDefined();
    expect(d?.severity).toBe('warning');
    expect(Number(d?.messageParams?.columns)).toBeGreaterThanOrEqual(1);
    expect(d?.primaryEntityId).toBe('b1');
  });

  it('το μήνυμα φέρει το «γιατί» — καθαρό ύψος < όριο (clear < minClear)', () => {
    const d = impracticalFor([beam('b1', 16000)], graphWithSupports('b1', 2), STANDARD_3M);
    expect(Number(d?.messageParams?.minClear)).toBeCloseTo(2.2, 2); // standard → 2,20m
    expect(Number(d?.messageParams?.clear)).toBeLessThan(Number(d?.messageParams?.minClear));
  });
});

describe('runPracticalSpanChecks — no-op (skip)', () => {
  it('μικρό άνοιγμα 5m → πρακτικό ύψος → κανένα warning', () => {
    expect(impracticalFor([beam('b1', 5000)], graphWithSupports('b1', 2), STANDARD_3M)).toBeUndefined();
  });

  it('πρόβολος (1 στήριξη → cantilever) → no-op (θεμιτό ελεύθερο άκρο)', () => {
    expect(impracticalFor([beam('b1', 16000)], graphWithSupports('b1', 1), STANDARD_3M)).toBeUndefined();
  });

  it('<2 στηρίξεις (0 ακμές) → no-op (κανένα διαιρετέο άνοιγμα)', () => {
    expect(impracticalFor([beam('b1', 16000)], graphWithSupports('b1', 0), STANDARD_3M)).toBeUndefined();
  });

  it('locked διατομή (autoSized:false) → no-op (ο μηχανικός όρισε ρητά)', () => {
    const d = impracticalFor([beam('b1', 16000, { autoSized: false })], graphWithSupports('b1', 2), STANDARD_3M);
    expect(d).toBeUndefined();
  });
});

describe('runPracticalSpanChecks — δυναμικό threshold (ύψος ορόφου + χρήση)', () => {
  it('ψηλός όροφος 4m → μεγαλύτερο πρακτικό όριο → το ίδιο 16m δοκάρι δεν προειδοποιεί', () => {
    // limit(4000,standard) = 1800mm > BEAM_MAX_PRACTICAL_DEPTH_MM (1500) ⇒ ποτέ warning.
    expect(impracticalFor([beam('b1', 16000)], graphWithSupports('b1', 2), TALL_4M)).toBeUndefined();
  });

  it('πίνακας ελαχίστων: standard 2,20m → limit 800· basement 2,00m → limit 1000', () => {
    expect(requiredClearHeightUnderBeamMm('standard')).toBe(2200);
    expect(requiredClearHeightUnderBeamMm('basement')).toBe(2000);
    expect(practicalBeamDepthLimitMm(3000, 'standard')).toBe(800);
    expect(practicalBeamDepthLimitMm(3000, 'basement')).toBe(1000);
    expect(practicalBeamDepthLimitMm(4000, 'standard')).toBe(1800);
  });

  it('basement (limit 1000) εξακολουθεί να προειδοποιεί για το βαθύ 16m δοκάρι', () => {
    expect(impracticalFor([beam('b1', 16000)], graphWithSupports('b1', 2), BASEMENT_3M)).toBeDefined();
  });
});

describe('suggestIntermediateColumnCount — reuse suggestBeamSection, monotonic', () => {
  const ctx = buildBeamSectionContext(beam('b1', 16000), 'simple');

  it('χαμηλότερο πρακτικό όριο → ≥ κολόνες (πιο απαιτητικό)', () => {
    const strict = suggestIntermediateColumnCount(EUROCODE_PROVIDER, ctx, 700).columns;
    const loose = suggestIntermediateColumnCount(EUROCODE_PROVIDER, ctx, 1200).columns;
    expect(strict).toBeGreaterThanOrEqual(loose);
  });

  it('μη-εφικτό όριο (1mm) → clamp στο MAX_INTERMEDIATE_COLUMNS', () => {
    expect(suggestIntermediateColumnCount(EUROCODE_PROVIDER, ctx, 1).columns).toBe(MAX_INTERMEDIATE_COLUMNS);
  });

  it('η πρόταση μειώνει το ύψος vs το πλήρες άνοιγμα', () => {
    const full = suggestBeamSection(EUROCODE_PROVIDER, ctx).depthMm;
    const suggested = suggestIntermediateColumnCount(EUROCODE_PROVIDER, ctx, 800).suggestedDepthMm;
    expect(suggested).toBeLessThan(full);
  });
});
