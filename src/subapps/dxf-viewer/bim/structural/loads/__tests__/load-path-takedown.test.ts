/**
 * ADR-466 — load-path takedown orchestration + ComputeLoadPathCommand + regression.
 *
 * Καλύπτει: φορτίο κολώνας/πεδίλου (= ADR-464, footing==column), δοκαριού (tributary
 * strip + ίδιο βάρος), πλάκας (area load), manual-guard, αδρανές χωρίς area loads, την
 * εφαρμογή/undo του command, και τον **regression guard** (no-beam == computeFootingTakedownLoads).
 */

import {
  computeLoadPathPatches,
  isLoadPathMember,
  type MemberLoadPatch,
} from '../load-path-takedown';
import { ComputeLoadPathCommand } from '../../../../core/commands/entity-commands/ComputeLoadPathCommand';
import { computeFootingTakedownLoads } from '../../footing-design/footing-load-takedown';
import type { Entity } from '../../../../types/entities';
import type { AppliedMemberLoad } from '../structural-loads-types';
import { DEFAULT_BAY_SPAN_M } from '../load-takedown';
import type {
  StructuralEdge,
  StructuralGraph,
  StructuralNode,
  StructuralConnectionKind,
  StructuralMemberKind,
} from '../../organism/structural-organism-types';

// ─── Entity fixtures (canvas = mm) ───────────────────────────────────────────

function column(id: string, cx: number, cy: number, footingId?: string): Entity {
  const h = 300;
  return {
    id, type: 'column', kind: 'rectangular',
    params: {
      kind: 'rectangular', position: { x: cx, y: cy, z: 0 }, anchor: 'center',
      width: 600, depth: 600, height: 3000, rotation: 0, sceneUnits: 'mm',
      ...(footingId ? { footingId } : {}),
    },
    geometry: {
      area: 0.36,
      footprint: { vertices: [
        { x: cx - h, y: cy - h }, { x: cx + h, y: cy - h },
        { x: cx + h, y: cy + h }, { x: cx - h, y: cy + h },
      ] },
    },
  } as unknown as Entity;
}

function pad(id: string, appliedLoad?: AppliedMemberLoad): Entity {
  return {
    id, type: 'foundation', kind: 'pad',
    params: { kind: 'pad', width: 1500, length: 1500, thicknessMm: 500, ...(appliedLoad ? { appliedLoad } : {}) },
  } as unknown as Entity;
}

function beam(id: string, volumeM3: number, appliedLoad?: AppliedMemberLoad): Entity {
  return {
    id, type: 'beam', kind: 'rectangular',
    params: { kind: 'rectangular', width: 250, sceneUnits: 'mm', ...(appliedLoad ? { appliedLoad } : {}) },
    geometry: { volume: volumeM3 },
  } as unknown as Entity;
}

function slab(id: string, areaM2: number, appliedLoad?: AppliedMemberLoad): Entity {
  return {
    id, type: 'slab', kind: 'floor',
    params: { kind: 'floor', sceneUnits: 'mm', ...(appliedLoad ? { appliedLoad } : {}) },
    geometry: { area: areaM2, netArea: areaM2 },
  } as unknown as Entity;
}

// ─── Graph fixtures (synthetic — decoupled from buildStructuralGraph) ─────────

function gNode(id: string, memberKind: StructuralMemberKind): StructuralNode {
  const entityType = memberKind === 'footing' ? 'foundation' : memberKind;
  return { id, memberKind, entityType, baseZmm: 0, topZmm: 3000 };
}
function gEdge(supportId: string, supportedId: string, kind: StructuralConnectionKind): StructuralEdge {
  return { id: `${supportId}->${supportedId}:${kind}`, supportId, supportedId, kind };
}

const SETTINGS = { storeyCount: 4, deadAreaLoadKpa: 6, liveAreaLoadKpa: 2 };
const COLUMN_SELF_WEIGHT_4 = 0.6 * 0.6 * 3 * 2400 * 9.81 / 1000 * 4; // ≈ 101.7 kN

function patchById(patches: readonly MemberLoadPatch[], id: string): AppliedMemberLoad | undefined {
  return patches.find((p) => p.entityId === id)?.appliedLoad;
}

describe('computeLoadPathPatches', () => {
  it('κολώνα + πέδιλο (χωρίς δοκάρι) → footing == column == tributary load', () => {
    const entities = [column('c1', 0, 0, 'f1'), pad('f1')];
    const graph: StructuralGraph = {
      nodes: [gNode('f1', 'footing'), gNode('c1', 'column')],
      edges: [gEdge('f1', 'c1', 'footing-bearing')],
    };
    const patches = computeLoadPathPatches(entities, graph, SETTINGS);
    const col = patchById(patches, 'c1');
    const foot = patchById(patches, 'f1');
    const tribArea = DEFAULT_BAY_SPAN_M * DEFAULT_BAY_SPAN_M; // 25 m²
    expect(col?.liveAxialKn).toBeCloseTo(tribArea * 4 * 2, 1); // 200
    expect(col?.deadAxialKn).toBeCloseTo(tribArea * 4 * 6 + COLUMN_SELF_WEIGHT_4, 1);
    expect(foot?.deadAxialKn).toBeCloseTo(col!.deadAxialKn, 6); // footing == column
    expect(foot?.liveAxialKn).toBeCloseTo(col!.liveAxialKn, 6);
    expect(col?.source).toBe('takedown');
  });

  it('δοκάρι μεταξύ 2 κολονών → μ.ό. tributary (1 όροφος) + ίδιο βάρος', () => {
    const entities = [
      column('c1', 0, 0), column('c2', 5000, 0), beam('b1', 0.5),
    ];
    const graph: StructuralGraph = {
      nodes: [gNode('c1', 'column'), gNode('c2', 'column'), gNode('b1', 'beam')],
      edges: [gEdge('c1', 'b1', 'column-bearing'), gEdge('c2', 'b1', 'column-bearing')],
    };
    const patches = computeLoadPathPatches(entities, graph, SETTINGS);
    const b = patchById(patches, 'b1');
    // tributary κάθε κολώνας = 25 m² (5m bay) → μ.ό. 25· 1 όροφος.
    const selfKn = 0.5 * 2400 * 9.81 / 1000; // ≈ 11.77 kN
    expect(b?.liveAxialKn).toBeCloseTo(25 * 1 * 2, 1); // 50
    expect(b?.deadAxialKn).toBeCloseTo(25 * 1 * 6 + selfKn, 1); // 150 + self
  });

  it('πλάκα → εμβαδόν panel × area-loads (1 όροφος)', () => {
    const entities = [slab('s1', 40)];
    const graph: StructuralGraph = { nodes: [], edges: [] };
    const patches = computeLoadPathPatches(entities, graph, SETTINGS);
    const s = patchById(patches, 's1');
    expect(s?.liveAxialKn).toBeCloseTo(40 * 2, 1); // 80
    expect(s?.deadAxialKn).toBeCloseTo(40 * 6, 1); // 240
  });

  it('χειροκίνητο φορτίο μέλους → ΔΕΝ αντικαθίσταται (skip)', () => {
    const manual: AppliedMemberLoad = { deadAxialKn: 900, liveAxialKn: 0, source: 'manual' };
    const entities = [column('c1', 0, 0, 'f1'), pad('f1', manual)];
    const graph: StructuralGraph = {
      nodes: [gNode('f1', 'footing'), gNode('c1', 'column')],
      edges: [gEdge('f1', 'c1', 'footing-bearing')],
    };
    const patches = computeLoadPathPatches(entities, graph, SETTINGS);
    expect(patchById(patches, 'f1')).toBeUndefined(); // manual πέδιλο skip
    expect(patchById(patches, 'c1')).toBeDefined();    // η κολώνα όμως φορτίζεται
  });

  it('χωρίς area loads → κενό (αδρανές)', () => {
    const entities = [column('c1', 0, 0, 'f1'), pad('f1')];
    const graph: StructuralGraph = {
      nodes: [gNode('f1', 'footing'), gNode('c1', 'column')],
      edges: [gEdge('f1', 'c1', 'footing-bearing')],
    };
    expect(computeLoadPathPatches(entities, graph, { storeyCount: 4, deadAreaLoadKpa: 0, liveAreaLoadKpa: 0 })).toHaveLength(0);
  });
});

describe('REGRESSION — no-beam footing loads == computeFootingTakedownLoads (ADR-464)', () => {
  it('κάναβος 2 κολονών 5m → footing patches ίδια με το ADR-464 path', () => {
    const entities = [
      column('c1', 0, 0, 'f1'), column('c2', 5000, 0, 'f2'), pad('f1'), pad('f2'),
    ];
    const graph: StructuralGraph = {
      nodes: [
        gNode('f1', 'footing'), gNode('f2', 'footing'),
        gNode('c1', 'column'), gNode('c2', 'column'),
      ],
      edges: [gEdge('f1', 'c1', 'footing-bearing'), gEdge('f2', 'c2', 'footing-bearing')],
    };
    const oracle = computeFootingTakedownLoads(entities, SETTINGS);
    const patches = computeLoadPathPatches(entities, graph, SETTINGS);
    for (const { footingId, appliedLoad } of oracle) {
      const mine = patchById(patches, footingId);
      expect(mine?.deadAxialKn).toBeCloseTo(appliedLoad.deadAxialKn, 6);
      expect(mine?.liveAxialKn).toBeCloseTo(appliedLoad.liveAxialKn, 6);
      expect(mine?.source).toBe('takedown');
    }
  });
});

describe('isLoadPathMember', () => {
  it('αναγνωρίζει κολώνα/δοκάρι/πλάκα/pad πέδιλο, απορρίπτει άγνωστα', () => {
    expect(isLoadPathMember(column('c', 0, 0))).toBe(true);
    expect(isLoadPathMember(beam('b', 0.3))).toBe(true);
    expect(isLoadPathMember(slab('s', 10))).toBe(true);
    expect(isLoadPathMember(pad('f'))).toBe(true);
    expect(isLoadPathMember({ id: 'x', type: 'line', kind: 'line', params: {} } as unknown as Entity)).toBe(false);
  });
});

describe('ComputeLoadPathCommand', () => {
  function fakeSceneManager(entities: Entity[]) {
    const map = new Map(entities.map((e) => [e.id, e]));
    return {
      getEntity: (id: string) => map.get(id),
      updateEntity: (id: string, updates: { params?: unknown }) => {
        const e = map.get(id);
        if (e && updates.params) (e as { params: unknown }).params = updates.params;
      },
    };
  }

  it('execute γράφει appliedLoad· undo επαναφέρει τα αρχικά params', () => {
    const c = column('c1', 0, 0, 'f1');
    const sm = fakeSceneManager([c]);
    const loads: MemberLoadPatch[] = [
      { entityId: 'c1', appliedLoad: { deadAxialKn: 300, liveAxialKn: 100, source: 'takedown' } },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cmd = new ComputeLoadPathCommand(loads, sm as any);
    cmd.execute();
    expect((sm.getEntity('c1') as Entity).params).toMatchObject({
      appliedLoad: { deadAxialKn: 300, source: 'takedown' },
    });
    cmd.undo();
    expect((sm.getEntity('c1') as Entity).params).not.toHaveProperty('appliedLoad');
  });

  it('getLoadedMemberIds → μόνο τα εγγράψιμα μέλη (skip χειροκίνητο)', () => {
    const manual: AppliedMemberLoad = { deadAxialKn: 900, liveAxialKn: 0, source: 'manual' };
    const sm = fakeSceneManager([column('c1', 0, 0), pad('f1', manual)]);
    const loads: MemberLoadPatch[] = [
      { entityId: 'c1', appliedLoad: { deadAxialKn: 1, liveAxialKn: 1, source: 'takedown' } },
      { entityId: 'f1', appliedLoad: { deadAxialKn: 2, liveAxialKn: 2, source: 'takedown' } },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cmd = new ComputeLoadPathCommand(loads, sm as any);
    expect(cmd.getLoadedMemberIds()).toEqual(['c1']); // f1 manual → skip
  });
});
