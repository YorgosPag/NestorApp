/**
 * ADR-499 §D — `runFeasibilityChecks`: error «ανέφικτο στο πρακτικό μέγιστο» όταν η
 * αυτο-διόρθωση (Slice B/§6.3) έχει εξαντληθεί — πλάκα-πρόβολος / κολώνα / δοκός-στρέψη.
 * Η έσχατη παρέμβαση του οργανισμού (ADR-487 §7). Fixtures: canvas = mm.
 */

import { runFeasibilityChecks } from '../feasibility-checks';
import { EUROCODE_PROVIDER } from '../../codes/eurocode-provider';
import type { Entity } from '../../../../types/entities';
import type { ColumnEntity, ColumnParams } from '../../../types/column-types';

function beam(id: string, widthMm: number, depthMm: number, x1: number): Entity {
  return {
    id, type: 'beam', kind: 'straight',
    params: { kind: 'straight', width: widthMm, depth: depthMm, sceneUnits: 'mm', startPoint: { x: 0, y: 0 }, endPoint: { x: x1, y: 0 } },
    geometry: { length: x1 / 1000, volume: 0.5 },
  } as unknown as Entity;
}

function slab(id: string, xMax: number, yMax: number, deadAxialKn: number): Entity {
  return {
    id, type: 'slab', kind: 'roof',
    params: {
      kind: 'roof', sceneUnits: 'mm', thickness: 200,
      appliedLoad: { deadAxialKn, liveAxialKn: 0 },
      outline: { vertices: [
        { x: 0, y: 0, z: 0 }, { x: xMax, y: 0, z: 0 },
        { x: xMax, y: yMax, z: 0 }, { x: 0, y: yMax, z: 0 },
      ] },
    },
    geometry: { maxFreeSpanM: yMax / 1000, area: (xMax * yMax) / 1e6 },
  } as unknown as Entity;
}

function column(id: string, over: Partial<ColumnParams> = {}): ColumnEntity {
  const params = {
    kind: 'rectangular', position: { x: 0, y: 0, z: 0 }, rotation: 0, anchor: 'center',
    width: 400, depth: 400, height: 3000, sceneUnits: 'mm', ...over,
  } as ColumnParams;
  return { type: 'column', kind: params.kind, id, params } as unknown as ColumnEntity;
}

const NO_FEM = new Map<string, number>();
const CODE = 'sectionInfeasibleAtMaxSize';
const kindOf = (d: { messageParams?: Record<string, unknown> }) => d.messageParams?.memberKind;

describe('runFeasibilityChecks — column (As,req > ρ_max·A_c @ max)', () => {
  it('τεράστια FEM ροπή → κολώνα ανέφικτη ακόμη και στο 1200×1200 → error', () => {
    const fem = new Map([['c1', 100000]]); // 100.000 kNm — αδύνατο για οποιαδήποτε διατομή
    const diags = runFeasibilityChecks([column('c1')], EUROCODE_PROVIDER, fem);
    const d = diags.find((x) => x.code === CODE && x.primaryEntityId === 'c1');
    expect(d).toBeDefined();
    expect(d?.severity).toBe('error');
    expect(kindOf(d!)).toBe('column');
  });

  it('χωρίς φορτίο (κενό FEM map) → κανονική κολώνα χωρά → κανένα error', () => {
    expect(runFeasibilityChecks([column('c1')], EUROCODE_PROVIDER, NO_FEM)).toHaveLength(0);
  });

  it('μη-ορθογώνια κολώνα → no-op (DEFER auto-size)', () => {
    const fem = new Map([['c1', 100000]]);
    const diags = runFeasibilityChecks([column('c1', { kind: 'circular' })], EUROCODE_PROVIDER, fem);
    expect(diags).toHaveLength(0);
  });
});

describe('runFeasibilityChecks — beam torsion (T_Ed > T_Rd,max @ max depth)', () => {
  it('λεπτή δοκός 250×400 + μεγάλος πρόβολος → στρέψη ανέφικτη → error', () => {
    const diags = runFeasibilityChecks(
      [beam('b1', 250, 400, 5000), slab('s1', 5000, 4000, 300)], EUROCODE_PROVIDER, NO_FEM,
    );
    const d = diags.find((x) => x.code === CODE && x.primaryEntityId === 'b1');
    expect(d).toBeDefined();
    expect(d?.severity).toBe('error');
    expect(kindOf(d!)).toBe('beam');
  });

  it('φαρδιά δοκός (700×400, λύνεται με μεγαλύτερο ύψος) → ΟΧΙ error (μένει warning στο §C)', () => {
    const diags = runFeasibilityChecks(
      [beam('b1', 700, 400, 5000), slab('s1', 5000, 4000, 300)], EUROCODE_PROVIDER, NO_FEM,
    );
    expect(diags.find((x) => x.primaryEntityId === 'b1')).toBeUndefined();
  });
});

describe('runFeasibilityChecks — slab (M_Ed > M_Rd,lim @ max thickness)', () => {
  it('πρόβολος-πλάκα με τεράστιο φορτίο → ανέφικτη ακόμη και στο μέγιστο πάχος → error', () => {
    const diags = runFeasibilityChecks(
      [beam('b1', 250, 400, 5000), slab('s1', 5000, 4000, 30000)], EUROCODE_PROVIDER, NO_FEM,
    );
    const d = diags.find((x) => x.code === CODE && x.primaryEntityId === 's1');
    expect(d).toBeDefined();
    expect(kindOf(d!)).toBe('slab');
  });

  it('λογικός πρόβολος-πλάκα → χωρά στο μέγιστο πάχος → κανένα slab error', () => {
    const diags = runFeasibilityChecks(
      [beam('b1', 800, 1200, 5000), slab('s1', 5000, 2000, 100)], EUROCODE_PROVIDER, NO_FEM,
    );
    expect(diags.find((x) => x.primaryEntityId === 's1')).toBeUndefined();
  });
});

describe('runFeasibilityChecks — όλα εφικτά', () => {
  it('κανονική κολώνα + δοκός χωρίς πρόβολο → κενό', () => {
    expect(runFeasibilityChecks([column('c1'), beam('b1', 300, 500, 5000)], EUROCODE_PROVIDER, NO_FEM))
      .toHaveLength(0);
  });
});
