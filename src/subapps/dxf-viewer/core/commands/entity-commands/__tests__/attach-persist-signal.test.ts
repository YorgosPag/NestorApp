/**
 * ADR-401 — attach-persist-signal tests.
 *
 * Verifies (1) the `signalEntitiesAttached` SSoT helper emits the post-change
 * entities for the given ids (and is a no-op for empty / unresolved ids), and
 * (2) every Attach/Detach command broadcasts `bim:entities-attached` on
 * execute / undo / redo so the persistence layer saves NON-selected entities
 * (the auto-attach case) instead of letting the next snapshot revert them.
 */

import { signalEntitiesAttached } from '../attach-persist-signal';
import { AttachWallsTopCommand } from '../AttachWallsTopCommand';
import { DetachWallsCommand } from '../DetachWallsCommand';
import { EventBus } from '../../../../systems/events/EventBus';
import type { ISceneManager, SceneEntity } from '../../interfaces';
import type { AnySceneEntity } from '../../../../types/scene';
import type { WallEntity, WallParams } from '../../../../bim/types/wall-types';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';

function makeMockScene(initial: SceneEntity[] = []): {
  scene: Map<string, SceneEntity>;
  sm: ISceneManager;
} {
  const sm = createMockSceneManager(initial, { getEntityIndex: () => -1 });
  return { scene: sm.store, sm };
}

function makeWall(id: string, overrides: Partial<WallParams> = {}): WallEntity {
  return {
    id,
    type: 'wall',
    kind: 'straight',
    layerId: 'L',
    params: {
      category: 'exterior',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 4000, y: 0, z: 0 },
      height: 3000,
      thickness: 250,
      flip: false,
      topBinding: 'storey-ceiling',
      baseBinding: 'storey-floor',
      baseOffset: 0,
      topOffset: 0,
      sceneUnits: 'mm',
      ...overrides,
    },
    geometry: { bbox: { min: { x: 0, y: -125 }, max: { x: 4000, y: 125 } } },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as WallEntity;
}

/** Capture every `bim:entities-attached` payload until the returned fn is called. */
function captureAttachedEvents(): { payloads: ReadonlyArray<AnySceneEntity>[]; stop: () => void } {
  const payloads: ReadonlyArray<AnySceneEntity>[] = [];
  const off = EventBus.on('bim:entities-attached', ({ entities }) => payloads.push(entities));
  return { payloads, stop: off };
}

describe('signalEntitiesAttached', () => {
  it('emits the resolved entities for the given ids', () => {
    const { sm } = makeMockScene([makeWall('w1') as unknown as SceneEntity]);
    const { payloads, stop } = captureAttachedEvents();
    signalEntitiesAttached(sm, ['w1']);
    stop();
    expect(payloads).toHaveLength(1);
    expect(payloads[0].map((e) => e.id)).toEqual(['w1']);
  });

  it('is a no-op for empty ids', () => {
    const { sm } = makeMockScene([makeWall('w1') as unknown as SceneEntity]);
    const { payloads, stop } = captureAttachedEvents();
    signalEntitiesAttached(sm, []);
    stop();
    expect(payloads).toHaveLength(0);
  });

  it('is a no-op when no id resolves to an entity', () => {
    const { sm } = makeMockScene([]);
    const { payloads, stop } = captureAttachedEvents();
    signalEntitiesAttached(sm, ['ghost']);
    stop();
    expect(payloads).toHaveLength(0);
  });
});

describe('Attach/Detach commands broadcast bim:entities-attached', () => {
  it('AttachWallsTopCommand emits on execute / undo / redo with the attached wall', () => {
    const { sm } = makeMockScene([makeWall('w1') as unknown as SceneEntity]);
    const cmd = new AttachWallsTopCommand('beam_1', [{ wallId: 'w1', kind: 'straight' }], sm);
    const { payloads, stop } = captureAttachedEvents();

    cmd.execute();
    cmd.undo();
    cmd.redo();
    stop();

    // 3 emissions, each carrying w1 with its post-transition params.
    expect(payloads).toHaveLength(3);
    expect((payloads[0][0] as unknown as WallEntity).params.topBinding).toBe('attached');
    expect((payloads[1][0] as unknown as WallEntity).params.topBinding).toBe('storey-ceiling');
    expect((payloads[2][0] as unknown as WallEntity).params.topBinding).toBe('attached');
  });

  it('DetachWallsCommand emits on execute carrying the detached wall', () => {
    const { sm } = makeMockScene([
      makeWall('w1', { topBinding: 'attached', attachTopToIds: ['beam_1'] }) as unknown as SceneEntity,
    ]);
    const { payloads, stop } = captureAttachedEvents();
    new DetachWallsCommand('top', [{ wallId: 'w1', kind: 'straight' }], sm).execute();
    stop();
    expect(payloads).toHaveLength(1);
    expect((payloads[0][0] as unknown as WallEntity).params.topBinding).toBe('storey-ceiling');
  });

  it('no-op command (target missing) does not emit', () => {
    const { sm } = makeMockScene([]);
    const { payloads, stop } = captureAttachedEvents();
    new AttachWallsTopCommand('beam_1', [{ wallId: 'ghost', kind: 'straight' }], sm).execute();
    stop();
    expect(payloads).toHaveLength(0);
  });
});
