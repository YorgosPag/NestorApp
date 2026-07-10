/**
 * ADR-632 — Φάση 3: `StairwellOpeningEngine` tests (planner + inputs + coordinator).
 *
 * Καλύπτει τον pure planner (`planStairwellOpenings` — create/update/delete/
 * idempotent/dedupe), τους pure input builders (`stairwell-opening-inputs` —
 * slab candidates, plan stairs με nosing scene→mm, managed-opening φίλτρο), και
 * τον coordinator apply (`cascadeStairwellOpenings` — lifecycle σε mock σκηνή).
 */

import type { Polygon3D } from '../../../types/bim-base';
import type { Entity } from '../../../../types/entities';
import type { SlabEntity } from '../../../types/slab-types';
import type { StairEntity } from '../../../types/stair-types';
import type { StairwellSlabCandidate } from '../stair-slab-overlap';
import {
  planStairwellOpenings,
  type StairwellManagedOpening,
  type StairwellPlanStair,
} from '../stairwell-opening-plan';
import {
  buildStairwellPlanStairs,
  buildStairwellSlabCandidates,
  collectManagedStairwellOpenings,
} from '../../../stairs/stairwell-opening-inputs';
import { cascadeStairwellOpenings } from '../../../stairs/stairwell-opening-coordinator';
import { findHostedStairwellOpenings } from '../../../cascade/bim-cascade-resolver';
import { EventBus } from '../../../../systems/events/EventBus';

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** Tread CCW: [x0,x0+depth] × [y0,y0+width] στο ύψος z. */
function makeTread(x0: number, depth: number, z: number, y0 = 0, width = 1000): Polygon3D {
  return {
    vertices: [
      { x: x0, y: y0, z },
      { x: x0 + depth, y: y0, z },
      { x: x0 + depth, y: y0 + width, z },
      { x: x0, y: y0 + width, z },
    ],
  };
}

function makeRect(x0: number, y0: number, x1: number, y1: number, z = 0): Polygon3D {
  return {
    vertices: [
      { x: x0, y: y0, z },
      { x: x1, y: y0, z },
      { x: x1, y: y1, z },
      { x: x0, y: y1, z },
    ],
  };
}

/** 4 ανοδικά treads (z 300/600/900/1200), footprint [0,1200]×[0,1000]. */
const TREADS: Polygon3D[] = [
  makeTread(0, 300, 300),
  makeTread(300, 300, 600),
  makeTread(600, 300, 900),
  makeTread(900, 300, 1200),
];

/** Πλάκα οροφής αυστηρά μεγαλύτερη από τα treads (opening μένει εντός). */
function ceilingCandidate(topZmm = 3000, thickness = 200): StairwellSlabCandidate {
  return {
    slabId: 'slab-1',
    outline: makeRect(-500, -500, 2000, 1500, topZmm),
    topZmm,
    undersideZmm: topZmm - thickness,
  };
}

/** Planner stair με nosings ήδη σε mm (z των treads). */
function planStair(overrides: Partial<StairwellPlanStair> = {}): StairwellPlanStair {
  return {
    stairId: 'stair-1',
    footprint: makeRect(0, 0, 1200, 1000),
    baseZmm: 0,
    topZmm: 1200,
    treads: TREADS,
    nosingsZmm: [
      { treadIndex: 0, zMm: 300 },
      { treadIndex: 1, zMm: 600 },
      { treadIndex: 2, zMm: 900 },
      { treadIndex: 3, zMm: 1200 },
    ],
    minHeadroomMm: 2200,
    ...overrides,
  };
}

// ─── Planner ─────────────────────────────────────────────────────────────────

describe('planStairwellOpenings', () => {
  it('δημιουργεί ένα well opening όταν το headroom παραβιάζεται', () => {
    // underside 2800, Hmin 2200 → clearances 2500/2200/1900/1600 → violating 2,3.
    const plan = planStairwellOpenings([planStair()], [ceilingCandidate()], []);
    expect(plan.creates).toHaveLength(1);
    expect(plan.updates).toHaveLength(0);
    expect(plan.deletes).toHaveLength(0);
    expect(plan.creates[0]).toMatchObject({ autoStairId: 'stair-1', slabId: 'slab-1' });
    // margin 1 → treads 1..3 union = x[300,1200] × [0,1000] = 900 × 1000.
    expect(plan.creates[0].areaSceneUnits2).toBeCloseTo(900_000, 0);
  });

  it('καμία παράβαση (ψηλή πλάκα) → κανένα opening', () => {
    const plan = planStairwellOpenings([planStair()], [ceilingCandidate(6000)], []);
    expect(plan.creates).toHaveLength(0);
    expect(plan.deletes).toHaveLength(0);
  });

  it('idempotent — υπάρχον managed που ταιριάζει → μηδέν αλλαγές', () => {
    const first = planStairwellOpenings([planStair()], [ceilingCandidate()], []);
    const existing: StairwellManagedOpening[] = [
      {
        openingId: 'op-1',
        autoStairId: 'stair-1',
        slabId: 'slab-1',
        outline: first.creates[0].outline,
      },
    ];
    const again = planStairwellOpenings([planStair()], [ceilingCandidate()], existing);
    expect(again.creates).toHaveLength(0);
    expect(again.updates).toHaveLength(0);
    expect(again.deletes).toHaveLength(0);
  });

  it('η πλάκα ανέβηκε (καμία παράβαση) → delete orphan managed opening', () => {
    const existing: StairwellManagedOpening[] = [
      { openingId: 'op-1', autoStairId: 'stair-1', slabId: 'slab-1', outline: makeRect(300, 0, 1200, 1000) },
    ];
    const plan = planStairwellOpenings([planStair()], [ceilingCandidate(6000)], existing);
    expect(plan.creates).toHaveLength(0);
    expect(plan.deletes).toEqual([{ openingId: 'op-1' }]);
  });

  it('άλλαξε το outline → update (ίδιο id)', () => {
    const existing: StairwellManagedOpening[] = [
      { openingId: 'op-1', autoStairId: 'stair-1', slabId: 'slab-1', outline: makeRect(0, 0, 10, 10) },
    ];
    const plan = planStairwellOpenings([planStair()], [ceilingCandidate()], existing);
    expect(plan.creates).toHaveLength(0);
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].openingId).toBe('op-1');
  });

  it('διπλά managed ίδιου (σκάλα,πλάκα) → κρατά ένα, σβήνει τα υπόλοιπα', () => {
    const shared = planStairwellOpenings([planStair()], [ceilingCandidate()], []).creates[0].outline;
    const existing: StairwellManagedOpening[] = [
      { openingId: 'op-1', autoStairId: 'stair-1', slabId: 'slab-1', outline: shared },
      { openingId: 'op-dup', autoStairId: 'stair-1', slabId: 'slab-1', outline: shared },
    ];
    const plan = planStairwellOpenings([planStair()], [ceilingCandidate()], existing);
    expect(plan.deletes).toEqual([{ openingId: 'op-dup' }]);
    expect(plan.creates).toHaveLength(0);
    expect(plan.updates).toHaveLength(0);
  });
});

// ─── Input builders ──────────────────────────────────────────────────────────

function fakeStair(id = 'stair-1'): StairEntity {
  return {
    id,
    type: 'stair',
    geometry: {
      treads: TREADS,
      bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 1200, y: 1000, z: 1200 } },
    },
    params: {
      basePoint: { x: 0, y: 0, z: 0 },
      direction: 0,
      rise: 300,
      stepCount: 4,
      totalRise: 1200,
      totalRun: 1200,
      width: 1000,
      codeProfile: 'nok',
    },
  } as unknown as StairEntity;
}

function fakeSlab(id = 'slab-1'): SlabEntity {
  return {
    id,
    type: 'slab',
    layerId: 'layer-bim',
    geometry: { polygon: makeRect(-500, -500, 2000, 1500, 3000) },
    params: {
      kind: 'floor',
      outline: makeRect(-500, -500, 2000, 1500, 3000),
      levelElevation: 3000,
      thickness: 200,
    },
  } as unknown as SlabEntity;
}

describe('stairwell-opening-inputs', () => {
  it('buildStairwellSlabCandidates — top/underside σε mm από levelElevation', () => {
    const [c] = buildStairwellSlabCandidates([fakeSlab()]);
    expect(c.topZmm).toBe(3000);
    expect(c.undersideZmm).toBe(2800);
    expect(c.slabId).toBe('slab-1');
  });

  it('buildStairwellPlanStairs — nosings σε mm + footprint από bbox (mm scene)', () => {
    const [s] = buildStairwellPlanStairs([fakeStair()], { sceneUnits: 'mm' });
    expect(s.baseZmm).toBe(0);
    expect(s.topZmm).toBe(1200); // 4 × 300 nominal
    expect(s.minHeadroomMm).toBe(2200); // nok
    expect(s.nosingsZmm.map((n) => n.zMm)).toEqual([300, 600, 900, 1200]);
    expect(s.footprint.vertices).toHaveLength(4);
  });

  it('buildStairwellPlanStairs — meter scene: nosing z ×1000 → mm', () => {
    const meterTreads = TREADS.map((t) => ({
      vertices: t.vertices.map((v) => ({ ...v, z: v.z / 1000 })),
    }));
    const stair = fakeStair();
    (stair as unknown as { geometry: { treads: Polygon3D[] } }).geometry.treads = meterTreads;
    const [s] = buildStairwellPlanStairs([stair], { sceneUnits: 'm' });
    expect(s.nosingsZmm.map((n) => Math.round(n.zMm))).toEqual([300, 600, 900, 1200]);
  });

  it('collectManagedStairwellOpenings — μόνο openings με autoStairId', () => {
    const managed = {
      id: 'op-auto',
      type: 'slab-opening',
      params: { slabId: 'slab-1', outline: makeRect(0, 0, 10, 10), autoStairId: 'stair-1' },
    } as unknown as Entity;
    const manual = {
      id: 'op-manual',
      type: 'slab-opening',
      params: { slabId: 'slab-1', outline: makeRect(0, 0, 10, 10) },
    } as unknown as Entity;
    const result = collectManagedStairwellOpenings([managed, manual]);
    expect(result).toHaveLength(1);
    expect(result[0].openingId).toBe('op-auto');
  });
});

// ─── Coordinator (lifecycle σε mock σκηνή) ───────────────────────────────────

function makeSceneManager(initial: Entity[]) {
  const map = new Map<string, Entity>(initial.map((e) => [e.id, e]));
  return {
    map,
    getEntities: () => [...map.values()] as unknown as readonly Entity[],
    getEntity: (id: string) => map.get(id) as unknown as never,
    addEntity: (e: { id: string }) => map.set(e.id, e as unknown as Entity),
    updateEntities: (updates: ReadonlyMap<string, object>) => {
      for (const [id, patch] of updates) {
        const cur = map.get(id);
        if (cur) map.set(id, { ...cur, ...patch } as Entity);
      }
    },
    removeEntity: (id: string) => void map.delete(id),
  };
}

describe('cascadeStairwellOpenings', () => {
  it('δημιουργεί auto well opening· είναι idempotent στο επόμενο run', () => {
    const mgr = makeSceneManager([fakeStair() as unknown as Entity, fakeSlab() as unknown as Entity]);
    const first = cascadeStairwellOpenings(mgr, { sceneUnits: 'mm' });
    expect(first.created).toHaveLength(1);

    const created = mgr.map.get(first.created[0]) as unknown as {
      type: string;
      kind: string;
      params: { autoStairId?: string; slabId: string };
    };
    expect(created.type).toBe('slab-opening');
    expect(created.kind).toBe('well');
    expect(created.params.autoStairId).toBe('stair-1');
    expect(created.params.slabId).toBe('slab-1');

    const second = cascadeStairwellOpenings(mgr, { sceneUnits: 'mm' });
    expect(second).toEqual({ created: [], updated: [], deleted: [] });
  });

  it('η σκάλα αφαιρέθηκε → το managed opening σβήνεται (orphan cleanup)', () => {
    const mgr = makeSceneManager([fakeStair() as unknown as Entity, fakeSlab() as unknown as Entity]);
    const first = cascadeStairwellOpenings(mgr, { sceneUnits: 'mm' });
    const openingId = first.created[0];

    mgr.map.delete('stair-1');
    const after = cascadeStairwellOpenings(mgr, { sceneUnits: 'mm' });
    expect(after.deleted).toEqual([openingId]);
    expect(mgr.map.has(openingId)).toBe(false);
  });

  it('no-op όταν ο scene manager δεν εκθέτει getEntities', () => {
    const bare = {
      getEntity: () => undefined as unknown as never,
      addEntity: () => {},
      updateEntities: () => {},
      removeEntity: () => {},
    };
    expect(cascadeStairwellOpenings(bare)).toEqual({ created: [], updated: [], deleted: [] });
  });

  it('changedIds gate — command που δεν άγγιξε σκάλα/πλάκα → skip', () => {
    const mgr = makeSceneManager([fakeStair() as unknown as Entity, fakeSlab() as unknown as Entity]);
    // Το changed set δείχνει μόνο μια (ανύπαρκτη) κολόνα → μηδέν recompute.
    const res = cascadeStairwellOpenings(mgr, { sceneUnits: 'mm', changedIds: ['column-99'] });
    expect(res).toEqual({ created: [], updated: [], deleted: [] });
    // Κανένα opening δεν μπήκε στη σκηνή.
    expect([...mgr.map.values()].some((e) => (e as { type?: string }).type === 'slab-opening')).toBe(false);
  });

  it('changedIds που περιέχει τη σκάλα → τρέχει κανονικά', () => {
    const mgr = makeSceneManager([fakeStair() as unknown as Entity, fakeSlab() as unknown as Entity]);
    const res = cascadeStairwellOpenings(mgr, { sceneUnits: 'mm', changedIds: ['stair-1'] });
    expect(res.created).toHaveLength(1);
  });
});

// ─── Φ4 — lifecycle events (persistence + BOQ trigger) ───────────────────────

describe('cascadeStairwellOpenings — Φ4 lifecycle events', () => {
  function captureEvents() {
    const created: unknown[] = [];
    const deleted: unknown[] = [];
    const offCreate = EventBus.on('drawing:entity-created', (p) => created.push(p));
    const offDelete = EventBus.on('bim:slab-opening-delete-requested', (p) => deleted.push(p));
    return { created, deleted, cleanup: () => { offCreate(); offDelete(); } };
  }

  // queueMicrotask flush (τα emits είναι deferred, mirror CreateBimEntityCommand).
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it('create → drawing:entity-created (tool slab-opening)', async () => {
    const { created, cleanup } = captureEvents();
    const mgr = makeSceneManager([fakeStair() as unknown as Entity, fakeSlab() as unknown as Entity]);
    cascadeStairwellOpenings(mgr, { sceneUnits: 'mm' });
    await flush();
    cleanup();
    expect(created).toHaveLength(1);
    expect((created[0] as { tool: string }).tool).toBe('slab-opening');
    expect((created[0] as { entity: { kind: string } }).entity.kind).toBe('well');
  });

  it('delete → bim:slab-opening-delete-requested· idempotent re-run → μηδέν emit', async () => {
    const mgr = makeSceneManager([fakeStair() as unknown as Entity, fakeSlab() as unknown as Entity]);
    const first = cascadeStairwellOpenings(mgr, { sceneUnits: 'mm' });
    await flush();

    const { created, deleted, cleanup } = captureEvents();
    mgr.map.delete('stair-1');
    cascadeStairwellOpenings(mgr, { sceneUnits: 'mm' });
    await flush();
    // Δεύτερο (idempotent, αμετάβλητο) run μετά το delete — τίποτα άλλο.
    cascadeStairwellOpenings(mgr, { sceneUnits: 'mm' });
    await flush();
    cleanup();

    expect(deleted).toHaveLength(1);
    expect((deleted[0] as { slabOpeningId: string }).slabOpeningId).toBe(first.created[0]);
    expect(created).toHaveLength(0);
  });
});

// ─── Φ4 — orphan-cleanup resolver ────────────────────────────────────────────

describe('findHostedStairwellOpenings', () => {
  const auto1 = {
    id: 'auto-1',
    type: 'slab-opening',
    params: { slabId: 'slab-1', outline: makeRect(0, 0, 10, 10), autoStairId: 'stair-1' },
  } as unknown as Entity;
  const auto2 = {
    id: 'auto-2',
    type: 'slab-opening',
    params: { slabId: 'slab-1', outline: makeRect(0, 0, 10, 10), autoStairId: 'stair-2' },
  } as unknown as Entity;
  const manual = {
    id: 'manual-1',
    type: 'slab-opening',
    params: { slabId: 'slab-1', outline: makeRect(0, 0, 10, 10) },
  } as unknown as Entity;

  it('βρίσκει μόνο τα auto openings της διαγραφόμενης σκάλας', () => {
    expect(findHostedStairwellOpenings(new Set(['stair-1']), [auto1, auto2, manual])).toEqual(['auto-1']);
  });

  it('αγνοεί χειροκίνητα openings (χωρίς autoStairId)', () => {
    expect(findHostedStairwellOpenings(new Set(['stair-1']), [manual])).toEqual([]);
  });

  it('exclude set + κενό stairIds → κενό', () => {
    expect(findHostedStairwellOpenings(new Set(['stair-1']), [auto1], new Set(['auto-1']))).toEqual([]);
    expect(findHostedStairwellOpenings(new Set(), [auto1])).toEqual([]);
  });
});
