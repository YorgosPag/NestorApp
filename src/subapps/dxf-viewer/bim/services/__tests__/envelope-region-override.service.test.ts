/**
 * ADR-396 v2 Φ6b — envelope-region-override.service tests.
 *
 * Καλύπτει:
 *  - `buildRegionOverrideTargets`: distinct element ids ανά ring, ordinal ανά role,
 *    currentFn (ομοιόμορφο / auto / mixed), παράλειψη ring χωρίς στοιχεία.
 *  - `buildRegionOverrideCommand`: per-type dispatch (wall/column/beam), παράλειψη
 *    missing / μη-υποστηριζόμενου τύπου, εγγραφή `envelopeFunction` (incl. clear).
 */

import {
  buildRegionOverrideTargets,
  buildRegionOverrideCommand,
} from '../envelope-region-override.service';
import type {
  ClassifiedFootprintRing,
  FootprintClassificationResult,
  RegionEnvelopeRole,
} from '../../geometry/footprint-region-classifier';
import type { FootprintEdge } from '../../geometry/building-footprint';
import type { EnvelopeFunction } from '../../types/thermal-envelope-types';
import { UpdateWallParamsCommand } from '../../../core/commands/entity-commands/UpdateWallParamsCommand';
import { UpdateColumnParamsCommand } from '../../../core/commands/entity-commands/UpdateColumnParamsCommand';
import { UpdateBeamParamsCommand } from '../../../core/commands/entity-commands/UpdateBeamParamsCommand';
import type { ISceneManager, SceneEntity } from '../../../core/commands/interfaces';

// ── Fixtures ────────────────────────────────────────────────────────────────

const P = { x: 0, y: 0, z: 0 };

function edge(sourceEntityId: string | null): FootprintEdge {
  return {
    a: P,
    b: { x: 1, y: 0, z: 0 },
    sourceEntityId,
    sourceEntityType: sourceEntityId ? 'wall' : null,
  };
}

function classifiedRing(
  role: RegionEnvelopeRole,
  ids: ReadonlyArray<string | null>,
): ClassifiedFootprintRing {
  const isHole = role === 'atrium' || role === 'interior-room';
  return {
    ring: {
      points: { points: [P], closed: true },
      edges: ids.map(edge),
      isHole,
      areaCanvas: 1,
    },
    role,
    insulated: role === 'exterior' || role === 'atrium',
    coverageAbove: 0,
  };
}

function classification(rings: ClassifiedFootprintRing[]): FootprintClassificationResult {
  return { rings, exterior: [], atria: [], interiorRooms: [], openStructures: [] };
}

describe('buildRegionOverrideTargets', () => {
  it('distinct element ids ανά ring (αγνοεί διπλά + null)', () => {
    const targets = buildRegionOverrideTargets(
      classification([classifiedRing('exterior', ['w1', 'w1', 'w2', null])]),
      new Map(),
    );
    expect(targets).toHaveLength(1);
    expect(targets[0].elementIds).toEqual(['w1', 'w2']);
  });

  it('παραλείπει ring χωρίς αποδοσμένα στοιχεία (μόνο null)', () => {
    const targets = buildRegionOverrideTargets(
      classification([classifiedRing('atrium', [null, null])]),
      new Map(),
    );
    expect(targets).toHaveLength(0);
  });

  it('ordinal + regionId ανά role (δύο αίθρια → 1, 2)', () => {
    const targets = buildRegionOverrideTargets(
      classification([
        classifiedRing('exterior', ['w1']),
        classifiedRing('atrium', ['w2']),
        classifiedRing('atrium', ['w3']),
      ]),
      new Map(),
    );
    expect(targets.map((t) => t.regionId)).toEqual(['exterior-1', 'atrium-1', 'atrium-2']);
    expect(targets.map((t) => t.ordinal)).toEqual([1, 1, 2]);
  });

  it('currentFn ομοιόμορφο → η τιμή· διαφορετικά → mixed', () => {
    const overrides = new Map<string, EnvelopeFunction>([
      ['w1', 'exterior'],
      ['w2', 'exterior'],
      ['w3', 'interior'],
    ]);
    const [uniform, mixed] = buildRegionOverrideTargets(
      classification([
        classifiedRing('exterior', ['w1', 'w2']),
        classifiedRing('atrium', ['w2', 'w3']),
      ]),
      overrides,
    );
    expect(uniform.currentFn).toBe('exterior');
    expect(mixed.currentFn).toBe('mixed');
  });

  it('κανένα override → currentFn undefined (auto)', () => {
    const [target] = buildRegionOverrideTargets(
      classification([classifiedRing('interior-room', ['w1', 'w2'])]),
      new Map(),
    );
    expect(target.currentFn).toBeUndefined();
  });

  it('μερικό override (ένα στοιχείο auto) → mixed', () => {
    const [target] = buildRegionOverrideTargets(
      classification([classifiedRing('exterior', ['w1', 'w2'])]),
      new Map<string, EnvelopeFunction>([['w1', 'exterior']]),
    );
    expect(target.currentFn).toBe('mixed');
  });
});

// ── Command builder ───────────────────────────────────────────────────────

function mockSceneManager(entities: Record<string, SceneEntity>): ISceneManager {
  return {
    getEntity: (id: string) => entities[id],
  } as unknown as ISceneManager;
}

function entity(id: string, type: string): SceneEntity {
  return { id, type, visible: true, params: { envelopeFunction: undefined } } as unknown as SceneEntity;
}

describe('buildRegionOverrideCommand', () => {
  const sm = mockSceneManager({
    w1: entity('w1', 'wall'),
    c1: entity('c1', 'column'),
    b1: entity('b1', 'beam'),
    s1: entity('s1', 'slab'), // μη-υποστηριζόμενο
  });

  it('per-type dispatch (wall/column/beam) + σωστό size', () => {
    const cmd = buildRegionOverrideCommand(['w1', 'c1', 'b1'], 'exterior', sm);
    expect(cmd.size()).toBe(3);
    expect(cmd.commands[0]).toBeInstanceOf(UpdateWallParamsCommand);
    expect(cmd.commands[1]).toBeInstanceOf(UpdateColumnParamsCommand);
    expect(cmd.commands[2]).toBeInstanceOf(UpdateBeamParamsCommand);
    expect(cmd.getAffectedEntityIds().sort()).toEqual(['b1', 'c1', 'w1']);
  });

  it('παραλείπει missing entity + μη-υποστηριζόμενο τύπο (slab)', () => {
    const cmd = buildRegionOverrideCommand(['w1', 's1', 'missing'], 'interior', sm);
    expect(cmd.size()).toBe(1);
    expect(cmd.getAffectedEntityIds()).toEqual(['w1']);
  });

  it('γράφει το envelopeFunction στα next params (column)', () => {
    const cmd = buildRegionOverrideCommand(['c1'], 'interior', sm);
    const data = cmd.commands[0].serialize().data as { params: { envelopeFunction?: EnvelopeFunction } };
    expect(data.params.envelopeFunction).toBe('interior');
  });

  it('clear (fn undefined) → next params χωρίς override', () => {
    const cmd = buildRegionOverrideCommand(['c1'], undefined, sm);
    const data = cmd.commands[0].serialize().data as { params: { envelopeFunction?: EnvelopeFunction } };
    expect(data.params.envelopeFunction).toBeUndefined();
  });

  it('κενά elementIds → κενό CompoundCommand (no-op)', () => {
    expect(buildRegionOverrideCommand([], 'exterior', sm).size()).toBe(0);
  });
});
