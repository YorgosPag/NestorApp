/**
 * ADR-504 Φ2 — `deriveBeamSpanModel`: συνεχής δοκός + inter-support sizing-span.
 *
 * Επαληθεύει: <3 στηρίξεις → base condition + πλήρες άνοιγμα (μηδέν regression)· ≥3 στηρίξεις
 * → `'continuous'` + max καθαρό υπο-άνοιγμα από την προβολή των κολωνών στον άξονα. Συν: ο
 * continuous αριθμός ροπής (10) + το `buildBeamSectionContext` span override (load από πλήρες,
 * spanMm από sub-span) + ο συμμετρικός άνω οπλισμός. Fixtures: canvas = mm.
 */

import { deriveBeamSpanModel, buildBeamSpanModelMap } from '../derive-beam-span-model';
import { spanMomentDivisor } from '../../codes/suggest-reinforcement';
import { buildBeamSectionContext } from '../../section-context';
import { EUROCODE_PROVIDER } from '../../codes/eurocode-provider';
import type { Entity } from '../../../../types/entities';
import type { BeamEntity, BeamParams } from '../../../types/beam-types';
import type { StructuralEdge, StructuralGraph, StructuralNode } from '../structural-organism-types';

function beam(id: string, lengthMm: number, over: Partial<BeamParams> = {}): BeamEntity {
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
  } as unknown as BeamEntity;
}

/** Κολώνα ως σημείο (footprint απών → projectColumnFootprintOnAxis πέφτει στο position). */
function column(id: string, x: number, y = 0): Entity {
  return {
    id, type: 'column',
    params: { position: { x, y }, sceneUnits: 'mm', width: 400, depth: 400 },
    geometry: {},
  } as unknown as Entity;
}

const edge = (columnId: string, beamId: string): StructuralEdge => ({
  id: `${columnId}->${beamId}:column-bearing`,
  supportId: columnId,
  supportedId: beamId,
  kind: 'column-bearing',
});

const graphOf = (edges: StructuralEdge[], nodes: StructuralNode[] = []): StructuralGraph => ({ nodes, edges });

describe('deriveBeamSpanModel — base (μηδέν regression)', () => {
  it('2 στηρίξεις → όχι συνεχής: stored supportType + πλήρες άνοιγμα', () => {
    const b = beam('b1', 16000);
    const g = graphOf([edge('c1', 'b1'), edge('c2', 'b1')]);
    const m = deriveBeamSpanModel(b, g, [b, column('c1', 0), column('c2', 16000)], 'simple');
    expect(m.supportType).toBe('simple');
    expect(m.sizingSpanMm).toBe(16000);
    expect(m.supportCount).toBe(2);
  });

  it('1 στήριξη → πρόβολος + πλήρες άνοιγμα (cantilever, μηδέν continuous)', () => {
    const b = beam('b1', 16000);
    const g = graphOf([edge('c1', 'b1')]);
    const m = deriveBeamSpanModel(b, g, [b, column('c1', 0)], 'simple');
    expect(m.supportType).toBe('cantilever');
    expect(m.sizingSpanMm).toBe(16000);
  });
});

describe('deriveBeamSpanModel — συνεχής (≥3 στηρίξεις)', () => {
  it('3 ισαπέχουσες στηρίξεις (0/8000/16000) → continuous + max sub-span 8000', () => {
    const b = beam('b1', 16000);
    const g = graphOf([edge('c1', 'b1'), edge('c2', 'b1'), edge('c3', 'b1')]);
    const cols = [column('c1', 0), column('c2', 8000), column('c3', 16000)];
    const m = deriveBeamSpanModel(b, g, [b, ...cols], 'simple');
    expect(m.supportType).toBe('continuous');
    expect(m.sizingSpanMm).toBeCloseTo(8000, 0);
    expect(m.supportCount).toBe(3);
  });

  it('6 στηρίξεις (5 ίσα ανοίγματα) → max sub-span ≈ 3200', () => {
    const b = beam('b1', 16000);
    const xs = [0, 3200, 6400, 9600, 12800, 16000];
    const g = graphOf(xs.map((_x, i) => edge(`c${i}`, 'b1')));
    const cols = xs.map((x, i) => column(`c${i}`, x));
    const m = deriveBeamSpanModel(b, g, [b, ...cols], 'simple');
    expect(m.supportType).toBe('continuous');
    expect(m.sizingSpanMm).toBeCloseTo(3200, 0);
  });

  it('άνισες στηρίξεις (0/4000/16000) → max κενό 12000 (συντηρητικό)', () => {
    const b = beam('b1', 16000);
    const g = graphOf([edge('c1', 'b1'), edge('c2', 'b1'), edge('c3', 'b1')]);
    const cols = [column('c1', 0), column('c2', 4000), column('c3', 16000)];
    const m = deriveBeamSpanModel(b, g, [b, ...cols], 'simple');
    expect(m.sizingSpanMm).toBeCloseTo(12000, 0);
  });
});

describe('buildBeamSpanModelMap', () => {
  it('χαρτογραφεί μόνο δοκάρια του graph με τα entities τους', () => {
    const b = beam('b1', 16000);
    const node: StructuralNode = {
      id: 'b1', memberKind: 'beam', entityType: 'beam',
      axis: { start: { x: 0, y: 0 }, end: { x: 16000, y: 0 }, halfWidth: 125 },
      supportType: 'simple', baseZmm: 0, topZmm: 500,
    };
    const g = graphOf([edge('c1', 'b1'), edge('c2', 'b1'), edge('c3', 'b1')], [node]);
    const cols = [column('c1', 0), column('c2', 8000), column('c3', 16000)];
    const map = buildBeamSpanModelMap(g, [b, ...cols]);
    expect(map.get('b1')?.supportType).toBe('continuous');
    expect(map.has('c1')).toBe(false);
  });
});

describe('continuous moment model (S1)', () => {
  it('spanMomentDivisor(continuous) = 10 (envelope, μεταξύ simple 8 και fixed 12)', () => {
    expect(spanMomentDivisor('continuous')).toBe(10);
    expect(spanMomentDivisor('simple')).toBe(8);
    expect(spanMomentDivisor('fixed')).toBe(12);
    expect(spanMomentDivisor('cantilever')).toBe(2);
  });

  it('buildBeamSectionContext span override: spanMm = sub-span, w από ΠΛΗΡΕΣ άνοιγμα', () => {
    const b = beam('b1', 16000);
    const full = buildBeamSectionContext(b, 'continuous');
    const sub = buildBeamSectionContext(b, 'continuous', undefined, 4000);
    expect(sub.spanMm).toBe(4000);
    expect(full.spanMm).toBe(16000);
    // Το γραμμικό φορτίο (kN/m) ΔΕΝ αλλάζει με το override (φορτίο ανά μέτρο = ίδιο).
    expect(sub.designLineLoadKnM).toBeCloseTo(full.designLineLoadKnM ?? 0, 6);
  });

  it('συμμετρικός άνω οπλισμός: continuous top/bottom >> simple top/bottom (hogging)', () => {
    const b = beam('b1', 8000);
    const areaTop = (r: { top: { count: number; diameterMm: number } }) =>
      r.top.count * r.top.diameterMm ** 2;
    const areaBot = (r: { bottom: { count: number; diameterMm: number } }) =>
      r.bottom.count * r.bottom.diameterMm ** 2;
    const rSimple = EUROCODE_PROVIDER.suggestBeamReinforcement(buildBeamSectionContext(b, 'simple'));
    const rCont = EUROCODE_PROVIDER.suggestBeamReinforcement(buildBeamSectionContext(b, 'continuous'));
    const ratio = (r: typeof rSimple) => areaTop(r) / areaBot(r);
    expect(ratio(rCont)).toBeGreaterThan(ratio(rSimple));
  });
});
