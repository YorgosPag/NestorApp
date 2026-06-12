/**
 * Tests for wall-structural-attach-coordinator (ADR-401 Phase C).
 *
 * Covers the host-deletion warning path: detecting `attached` walls that lose
 * their structural top support and emitting `bim:wall-attach-host-missing`.
 * The associative *follow* behaviour (host move/resize) is intentionally NOT
 * tested here -- it is handled by fresh-recompute in BimSceneLayer.syncWalls /
 * section-intersect / wall-boq-feed, not by this module.
 */

import {
  notifyWallsOnHostDeletion,
  findWallsToAutoAttachToHost,
  findWallsToAutoAttachBaseToHost,
  findHostsToAttachWallTop,
  findHostsToAttachWallBase,
} from '../wall-structural-attach-coordinator';
import { findAttachedWalls } from '../../cascade/bim-cascade-resolver';
import { EventBus, type DrawingEventPayload } from '../../../systems/events/EventBus';
import type { ISceneManager } from '../../../core/commands/interfaces';
import type { Entity } from '../../../types/entities';
import type { BeamEntity } from '../../types/beam-types';
import type { SlabEntity } from '../../types/slab-types';
import type { RoofEntity } from '../../types/roof-types';

interface FakeEntity {
  id: string;
  type: string;
  params?: Record<string, unknown>;
}

function makeSceneManager(entities: FakeEntity[]): ISceneManager {
  const byId = new Map(entities.map((e) => [e.id, e]));
  return {
    getEntity: (id: string) => byId.get(id) ?? null,
    getEntities: () => [...byId.values()],
    updateEntities: () => {},
    updateEntity: () => {},
  } as unknown as ISceneManager;
}

/** Capture every `bim:wall-attach-host-missing` payload during `fn`. */
function captureHostMissing(
  fn: () => void,
): Array<DrawingEventPayload<'bim:wall-attach-host-missing'>> {
  const events: Array<DrawingEventPayload<'bim:wall-attach-host-missing'>> = [];
  const unsub = EventBus.on('bim:wall-attach-host-missing', (p) => events.push(p));
  try {
    fn();
  } finally {
    unsub();
  }
  return events;
}

const attachedWall = (id: string, hostIds: string[]): FakeEntity => ({
  id,
  type: 'wall',
  params: { topBinding: 'attached', attachTopToIds: hostIds },
});

describe('findAttachedWalls', () => {
  it('returns walls whose attachTopToIds intersect the host set', () => {
    const entities = [
      attachedWall('w1', ['beam1']),
      attachedWall('w2', ['beam2']),
      { id: 'beam1', type: 'beam' },
    ] as unknown as Entity[];
    expect(findAttachedWalls(new Set(['beam1']), entities)).toEqual(['w1']);
  });

  it('ignores walls whose topBinding is not "attached"', () => {
    const entities = [
      { id: 'w1', type: 'wall', params: { topBinding: 'storey-ceiling', attachTopToIds: ['beam1'] } },
    ] as unknown as Entity[];
    expect(findAttachedWalls(new Set(['beam1']), entities)).toEqual([]);
  });

  it('ignores walls with no attachTopToIds', () => {
    const entities = [{ id: 'w1', type: 'wall', params: { topBinding: 'attached' } }] as unknown as Entity[];
    expect(findAttachedWalls(new Set(['beam1']), entities)).toEqual([]);
  });

  it('matches multiple walls and unions multiple hosts', () => {
    const entities = [
      attachedWall('w1', ['beam1']),
      attachedWall('w2', ['slab1', 'beam9']),
      attachedWall('w3', ['beam2']),
    ] as unknown as Entity[];
    expect(findAttachedWalls(new Set(['beam1', 'slab1']), entities).sort()).toEqual(['w1', 'w2']);
  });

  it('no-ops on an empty host set', () => {
    const entities = [attachedWall('w1', ['beam1'])] as unknown as Entity[];
    expect(findAttachedWalls(new Set(), entities)).toEqual([]);
  });
});

describe('notifyWallsOnHostDeletion', () => {
  it('emits one event listing affected walls when a referenced host is deleted', () => {
    const manager = makeSceneManager([
      attachedWall('w1', ['beam1']),
      attachedWall('w2', ['beam1']),
    ]);
    const events = captureHostMissing(() => {
      const affected = notifyWallsOnHostDeletion(['beam1'], manager);
      expect(affected.sort()).toEqual(['w1', 'w2']);
    });
    expect(events).toHaveLength(1);
    expect(events[0].wallIds.slice().sort()).toEqual(['w1', 'w2']);
    expect(events[0].deletedHostIds).toEqual(['beam1']);
  });

  it('does NOT emit when the deleted entity hosts no attached wall', () => {
    const manager = makeSceneManager([attachedWall('w1', ['beam1'])]);
    const events = captureHostMissing(() => {
      expect(notifyWallsOnHostDeletion(['beam2'], manager)).toEqual([]);
    });
    expect(events).toHaveLength(0);
  });

  it('does NOT emit for a non-attached wall referencing the host', () => {
    const manager = makeSceneManager([
      { id: 'w1', type: 'wall', params: { topBinding: 'storey-ceiling', attachTopToIds: ['beam1'] } },
    ]);
    const events = captureHostMissing(() => {
      expect(notifyWallsOnHostDeletion(['beam1'], manager)).toEqual([]);
    });
    expect(events).toHaveLength(0);
  });

  it('no-ops on empty input or a manager without getEntities', () => {
    expect(notifyWallsOnHostDeletion([], makeSceneManager([]))).toEqual([]);
    const bare = { getEntity: () => null } as unknown as ISceneManager;
    expect(notifyWallsOnHostDeletion(['beam1'], bare)).toEqual([]);
  });
});

// ─── ADR-401 Phase D — auto-attach detection ─────────────────────────────────

/** Beam axis (0,0)→(4000,0), width 250 → footprint band y∈[-125,125], underside 2500. */
function beamOverWall(undersideTopElevation = 3000): BeamEntity {
  return {
    id: 'beam_1', type: 'beam', kind: 'straight',
    params: {
      kind: 'straight', startPoint: { x: 0, y: 0 }, endPoint: { x: 4000, y: 0 },
      width: 250, depth: 500, topElevation: undersideTopElevation, zOffset: 0, sceneUnits: 'mm',
    },
  } as unknown as BeamEntity;
}

/** Slab footprint 5000×5000 at level `levelElevation`, thickness 150. */
function slabAt(levelElevation: number): SlabEntity {
  return {
    id: 'slab_1', type: 'slab', kind: 'floor',
    params: {
      kind: 'floor',
      outline: { vertices: [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 5000 }, { x: 0, y: 5000 }] },
      levelElevation, heightOffsetFromLevel: 0, thickness: 150, geometryType: 'box',
    },
  } as unknown as SlabEntity;
}

/** storey-ceiling wall axis along y=`y`, base at FFL (baseOffset 0 → baseZ 0). */
const ceilingWall = (id: string, y: number, sx = 1000, ex = 4000): Entity => ({
  id, type: 'wall', kind: 'straight',
  params: {
    topBinding: 'storey-ceiling', baseBinding: 'storey-floor', baseOffset: 0,
    start: { x: sx, y, z: 0 }, end: { x: ex, y, z: 0 }, height: 3000, thickness: 250,
  },
} as unknown as Entity);

describe('findWallsToAutoAttachToHost (Phase D)', () => {
  it('attaches a storey-ceiling wall under a beam (plan overlap + beam above base)', () => {
    const beam = beamOverWall();
    const wall = ceilingWall('w1', 0); // y=0 inside beam band [-125,125]
    expect(findWallsToAutoAttachToHost(beam as unknown as Entity, [wall])).toEqual(['w1']);
  });

  it('attaches walls under a CEILING slab (underside above base)', () => {
    const slab = slabAt(3000); // underside 2850 > base 0
    const wall = ceilingWall('w1', 1000); // inside slab footprint
    expect(findWallsToAutoAttachToHost(slab as unknown as Entity, [wall])).toEqual(['w1']);
  });

  it('does NOT attach to a FLOOR slab below the wall base (Z gate)', () => {
    const slab = slabAt(0); // underside -150 <= base 0 → skip
    const wall = ceilingWall('w1', 1000); // overlaps in plan, but slab is below
    expect(findWallsToAutoAttachToHost(slab as unknown as Entity, [wall])).toEqual([]);
  });

  it('ΔΕΝ τραβά τοίχο που κατεβαίνει κάτω από το FFL: floor slab@0 με base −1000 (ADR-441)', () => {
    // Τοίχος με base −1000 (φτάνει στη θεμελίωση). Floor slab top 0, underside −150.
    // Παλιό gate (underside > base) θα attach-άρε (−150 > −1000)· νέο (max(base,FFL))
    // → −150 <= 0 → ΟΧΙ (η εδαφόπλακα/δάπεδο δεν είναι ταβάνι).
    const slab = slabAt(0);
    const deepWall = { ...ceilingWall('w1', 1000) } as unknown as { params: Record<string, unknown> };
    deepWall.params.baseOffset = -1000;
    expect(findWallsToAutoAttachToHost(slab as unknown as Entity, [deepWall as unknown as Entity])).toEqual([]);
  });

  it('ΕΞΑΚΟΛΟΥΘΕΙ να attach-άρει σε ΟΡΟΦΗ slab παρά το βαθύ base (−1000): underside 2850 > FFL', () => {
    const slab = slabAt(3000); // underside 2850 > FFL 0 → ταβάνι, attach
    const deepWall = { ...ceilingWall('w1', 1000) } as unknown as { params: Record<string, unknown> };
    deepWall.params.baseOffset = -1000;
    expect(findWallsToAutoAttachToHost(slab as unknown as Entity, [deepWall as unknown as Entity])).toEqual(['w1']);
  });

  it('does NOT attach when the host does not overlap the wall in plan', () => {
    const beam = beamOverWall();
    const wall = ceilingWall('w1', 5000); // far from beam band
    expect(findWallsToAutoAttachToHost(beam as unknown as Entity, [wall])).toEqual([]);
  });

  it('ignores walls whose topBinding is not "storey-ceiling"', () => {
    const beam = beamOverWall();
    const attached = { ...ceilingWall('w1', 0) } as unknown as { params: Record<string, unknown> };
    attached.params.topBinding = 'unconnected';
    expect(findWallsToAutoAttachToHost(beam as unknown as Entity, [attached as unknown as Entity])).toEqual([]);
  });

  it('returns [] for a non-host entity (not beam/slab)', () => {
    const line = { id: 'l1', type: 'line', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as unknown as Entity;
    const wall = ceilingWall('w1', 0);
    expect(findWallsToAutoAttachToHost(line, [wall])).toEqual([]);
  });
});

// ─── ADR-417 Φ4 — roof host auto-attach detection ────────────────────────────

/** Flat RoofEntity 5m×5m footprint, basePivotZ=3000mm, thickness=200mm → underside=2800. */
function roofAt(basePivotZ: number): RoofEntity {
  return {
    id: 'roof_1', type: 'roof', kind: 'roof',
    ifcType: 'IfcRoof',
    params: {
      outline: { vertices: [
        { x: 0, y: 0, z: basePivotZ }, { x: 5000, y: 0, z: basePivotZ },
        { x: 5000, y: 5000, z: basePivotZ }, { x: 0, y: 5000, z: basePivotZ },
      ] },
      edges: [
        { definesSlope: false, slope: 0, overhangMm: 0 },
        { definesSlope: false, slope: 0, overhangMm: 0 },
        { definesSlope: false, slope: 0, overhangMm: 0 },
        { definesSlope: false, slope: 0, overhangMm: 0 },
      ],
      slopeUnit: 'deg',
      basePivotZ,
      thickness: 200,
      sceneUnits: 'mm',
    },
  } as unknown as RoofEntity;
}

describe('findWallsToAutoAttachToHost — roof (ADR-417 Φ4)', () => {
  it('attaches a storey-ceiling wall under a roof (plan overlap + roof above base)', () => {
    const r = roofAt(3000); // underside = 2800 > base 0 ✓
    const wall = ceilingWall('w1', 1000); // inside roof footprint
    expect(findWallsToAutoAttachToHost(r as unknown as Entity, [wall])).toEqual(['w1']);
  });

  it('does NOT attach when wall is outside roof footprint (plan miss)', () => {
    const r = roofAt(3000);
    const wall = ceilingWall('w1', 8000); // y=8000 outside [0,5000]
    expect(findWallsToAutoAttachToHost(r as unknown as Entity, [wall])).toEqual([]);
  });

  it('does NOT attach to a roof whose underside is at or below wall base (Z gate)', () => {
    const r = roofAt(0); // underside = -200 <= base 0 → skip
    const wall = ceilingWall('w1', 1000);
    expect(findWallsToAutoAttachToHost(r as unknown as Entity, [wall])).toEqual([]);
  });
});

// ─── ADR-401 (γ) — base auto-attach detection (inverted Z gate) ───────────────

describe('findWallsToAutoAttachBaseToHost (γ)', () => {
  it('attaches a storey-floor wall over a FOUNDATION beam (topside below base)', () => {
    const beam = beamOverWall(-100); // topElevation -100 → topside -100 < base 0
    const wall = ceilingWall('w1', 0); // y=0 inside beam band [-125,125]
    expect(findWallsToAutoAttachBaseToHost(beam as unknown as Entity, [wall])).toEqual(['w1']);
  });

  it('attaches walls over a FOUNDATION slab (topside below base)', () => {
    const slab = slabAt(-100); // topside -100 < base 0
    const wall = ceilingWall('w1', 1000); // inside slab footprint
    expect(findWallsToAutoAttachBaseToHost(slab as unknown as Entity, [wall])).toEqual(['w1']);
  });

  it('does NOT attach to a kind="foundation" raft (ADR-441 — εδαφόπλακα δεν τραβά βάσεις)', () => {
    // Ίδια γεωμετρία/θέση με το παραπάνω (topside κάτω από τη βάση) αλλά kind='foundation'
    // → η εδαφόπλακα-θεμελίωσης εξαιρείται από auto base-host.
    const raft = { ...slabAt(-1000), kind: 'foundation', params: { ...slabAt(-1000).params, kind: 'foundation' } } as unknown as Entity;
    const wall = ceilingWall('w1', 1000);
    expect(findWallsToAutoAttachBaseToHost(raft, [wall])).toEqual([]);
  });

  it('does NOT attach to a CEILING slab above the wall base (inverted Z gate)', () => {
    const slab = slabAt(3000); // topside 3000 > base 0 → skip
    const wall = ceilingWall('w1', 1000); // overlaps in plan, but host is above
    expect(findWallsToAutoAttachBaseToHost(slab as unknown as Entity, [wall])).toEqual([]);
  });

  it('does NOT attach when the host does not overlap the wall in plan', () => {
    const beam = beamOverWall(-100);
    const wall = ceilingWall('w1', 5000); // far from beam band
    expect(findWallsToAutoAttachBaseToHost(beam as unknown as Entity, [wall])).toEqual([]);
  });

  it('ignores walls whose baseBinding is not "storey-floor"', () => {
    const beam = beamOverWall(-100);
    const wall = { ...ceilingWall('w1', 0) } as unknown as { params: Record<string, unknown> };
    wall.params.baseBinding = 'absolute';
    expect(findWallsToAutoAttachBaseToHost(beam as unknown as Entity, [wall as unknown as Entity])).toEqual([]);
  });

  it('returns [] for a non-host entity (not beam/slab)', () => {
    const line = { id: 'l1', type: 'line', start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as unknown as Entity;
    const wall = ceilingWall('w1', 0);
    expect(findWallsToAutoAttachBaseToHost(line, [wall])).toEqual([]);
  });
});

// ─── ADR-401 Phase D (αντίστροφη φορά) — wall → hosts auto-attach detection ────

describe('findHostsToAttachWallTop (Phase D reverse)', () => {
  it('attaches a new wall top to a beam already above it (host-first → wall-after)', () => {
    const beam = beamOverWall(); // underside 2500 > base 0
    const wall = ceilingWall('w1', 0); // y=0 inside beam band [-125,125]
    expect(findHostsToAttachWallTop(wall, [beam as unknown as Entity])).toEqual(['beam_1']);
  });

  it('attaches a new wall top to a CEILING slab above it', () => {
    const slab = slabAt(3000); // underside 2850 > base 0
    const wall = ceilingWall('w1', 1000); // inside slab footprint
    expect(findHostsToAttachWallTop(wall, [slab as unknown as Entity])).toEqual(['slab_1']);
  });

  it('returns multiple host ids when several hosts cross above (stepped top)', () => {
    const beam = beamOverWall();
    const slab = slabAt(3000);
    const wall = ceilingWall('w1', 0); // y=0 hits beam band AND slab footprint
    expect(findHostsToAttachWallTop(wall, [beam as unknown as Entity, slab as unknown as Entity]).sort())
      .toEqual(['beam_1', 'slab_1']);
  });

  it('does NOT attach to a FLOOR slab below the wall base (Z gate)', () => {
    const slab = slabAt(0); // underside -150 <= base 0 → skip
    const wall = ceilingWall('w1', 1000);
    expect(findHostsToAttachWallTop(wall, [slab as unknown as Entity])).toEqual([]);
  });

  it('does NOT attach when no host overlaps the wall in plan', () => {
    const beam = beamOverWall();
    const wall = ceilingWall('w1', 5000); // far from beam band
    expect(findHostsToAttachWallTop(wall, [beam as unknown as Entity])).toEqual([]);
  });

  it('skips a wall whose topBinding is not "storey-ceiling" (already attached → idempotent)', () => {
    const beam = beamOverWall();
    const wall = { ...ceilingWall('w1', 0) } as unknown as { params: Record<string, unknown> };
    wall.params.topBinding = 'attached';
    expect(findHostsToAttachWallTop(wall as unknown as Entity, [beam as unknown as Entity])).toEqual([]);
  });

  it('returns [] for a non-wall entity', () => {
    const beam = beamOverWall();
    expect(findHostsToAttachWallTop(beam as unknown as Entity, [beam as unknown as Entity])).toEqual([]);
  });
});

describe('findHostsToAttachWallBase (γ reverse)', () => {
  it('attaches a new wall base to a FOUNDATION beam below it', () => {
    const beam = beamOverWall(-100); // topside -100 < base 0
    const wall = ceilingWall('w1', 0); // inside beam band
    expect(findHostsToAttachWallBase(wall, [beam as unknown as Entity])).toEqual(['beam_1']);
  });

  it('does NOT attach the base to a CEILING slab above the wall base (inverted Z gate)', () => {
    const slab = slabAt(3000); // topside 3000 > base 0 → skip
    const wall = ceilingWall('w1', 1000);
    expect(findHostsToAttachWallBase(wall, [slab as unknown as Entity])).toEqual([]);
  });

  it('skips a wall whose baseBinding is not "storey-floor"', () => {
    const beam = beamOverWall(-100);
    const wall = { ...ceilingWall('w1', 0) } as unknown as { params: Record<string, unknown> };
    wall.params.baseBinding = 'absolute';
    expect(findHostsToAttachWallBase(wall as unknown as Entity, [beam as unknown as Entity])).toEqual([]);
  });

  it('returns [] for a non-wall entity', () => {
    const beam = beamOverWall(-100);
    expect(findHostsToAttachWallBase(beam as unknown as Entity, [beam as unknown as Entity])).toEqual([]);
  });
});
