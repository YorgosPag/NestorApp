/**
 * Tests for `reconcileAssociativeGeometry` — ADR-540 universal associative reconcile.
 *
 * Unit under test = the orchestration: it runs the scene-derived cascades in dependency
 * order (openings → wall, then beams → column faces) and merges `announceEntities` (transform
 * hosts/followers) with the reframed beams into ONE `bim:entities-moved` (reframed wins by id),
 * idempotent (no change + no announce → no emit). The two cascades have their own suites, so they
 * are mocked here; we assert wiring + the single-emit merge only.
 */

jest.mock('../../walls/wall-opening-coordinator', () => ({
  cascadeHostedOpeningsForWalls: jest.fn(),
}));
jest.mock('../../beams/beam-column-reframe-cascade', () => ({
  cascadeBeamReframe: jest.fn(() => []),
}));

import { reconcileAssociativeGeometry } from '../associative-geometry-reconcile';
import { cascadeHostedOpeningsForWalls } from '../../walls/wall-opening-coordinator';
import { cascadeBeamReframe } from '../../beams/beam-column-reframe-cascade';
import { EventBus } from '../../../systems/events/EventBus';
import type { ISceneManager, SceneEntity } from '../../../core/commands/interfaces';

const mockOpenings = cascadeHostedOpeningsForWalls as jest.Mock;
const mockReframe = cascadeBeamReframe as jest.Mock;

const sm = { getEntity: () => undefined, updateEntities: () => {}, getEntities: () => [] } as unknown as ISceneManager;
const ent = (id: string, tag: string): SceneEntity => ({ id, type: tag } as unknown as SceneEntity);

function captureMoved(fn: () => void): SceneEntity[][] {
  const payloads: SceneEntity[][] = [];
  const unsub = EventBus.on('bim:entities-moved', ({ movedEntities }) => {
    payloads.push(movedEntities as unknown as SceneEntity[]);
  });
  fn();
  unsub();
  return payloads;
}

beforeEach(() => {
  mockOpenings.mockReset();
  mockReframe.mockReset().mockReturnValue([]);
});

describe('reconcileAssociativeGeometry', () => {
  it('runs the openings cascade BEFORE the beam reframe, both with the changed ids', () => {
    const order: string[] = [];
    mockOpenings.mockImplementation(() => order.push('openings'));
    mockReframe.mockImplementation(() => {
      order.push('reframe');
      return [];
    });
    reconcileAssociativeGeometry(['w1'], sm);
    expect(order).toEqual(['openings', 'reframe']);
    expect(mockOpenings).toHaveBeenCalledWith(['w1'], sm);
    expect(mockReframe).toHaveBeenCalledWith(['w1'], sm);
  });

  it('idempotent: no reframe + no announce → NO emit (zero churn)', () => {
    const spy = jest.spyOn(EventBus, 'emit');
    reconcileAssociativeGeometry(['c1'], sm);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('emits ONLY the reframed beams when no announceEntities (params / after-restore path)', () => {
    mockReframe.mockReturnValue([ent('beam_1', 'beam')]);
    const payloads = captureMoved(() => reconcileAssociativeGeometry(['c2'], sm));
    expect(payloads).toHaveLength(1);
    expect(payloads[0].map((e) => e.id)).toEqual(['beam_1']);
  });

  it('announces hosts/followers even when nothing reframed (transform with no beams)', () => {
    const payloads = captureMoved(() =>
      reconcileAssociativeGeometry(['h'], sm, { announceEntities: [ent('h', 'mep-manifold')] }),
    );
    expect(payloads).toHaveLength(1);
    expect(payloads[0].map((e) => e.id)).toEqual(['h']);
  });

  it('merges announce + reframed into ONE emit; reframed wins by id (dedup)', () => {
    const reframedBeam = { id: 'beam_1', type: 'beam', tag: 'new' } as unknown as SceneEntity;
    mockReframe.mockReturnValue([reframedBeam]);
    const announcedStale = { id: 'beam_1', type: 'beam', tag: 'stale' } as unknown as SceneEntity;
    const payloads = captureMoved(() =>
      reconcileAssociativeGeometry(['beam_1', 'c2'], sm, {
        announceEntities: [announcedStale, ent('c2', 'column')],
      }),
    );
    expect(payloads).toHaveLength(1);
    const byId = new Map(payloads[0].map((e) => [e.id, e]));
    expect([...byId.keys()].sort()).toEqual(['beam_1', 'c2']);
    // reframed (tag:'new') replaced the stale announced copy.
    expect((byId.get('beam_1') as unknown as { tag: string }).tag).toBe('new');
  });
});
