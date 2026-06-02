/**
 * ADR-408 Φ5 — scene-time connector reconciliation hook tests.
 *
 * Verifies the derived `connector.systemId` cache is written from the System
 * membership truth ("System wins"), that it is idempotent (no second scene
 * write when nothing changed), and that it clears the cache for non-members.
 */

import { renderHook } from '@testing-library/react';
import { useMepConnectorReconciliation } from '../useMepConnectorReconciliation';
import { useMepSystemStore } from '../../../bim/mep-systems/mep-system-store';
import type { SceneModel } from '../../../types/scene';
import type { MepSystemEntity } from '../../../bim/types/mep-system-types';

function fixture(id: string, systemId?: string) {
  return {
    type: 'mep-fixture',
    id,
    params: {
      connectors: [
        { connectorId: 'c1', domain: 'electrical', flow: 'in', localPosition: { x: 0, y: 0 }, ...(systemId ? { systemId } : {}) },
      ],
    },
  };
}

function makeScene(...entities: unknown[]): SceneModel {
  return { entities } as unknown as SceneModel;
}

function sys(id: string, members: Array<[string, string]>): MepSystemEntity {
  return {
    id,
    params: {
      systemType: 'electrical-circuit',
      name: id,
      systemClassification: 'lighting',
      sourceEntityId: 'pnl1',
      sourceConnectorId: 'out1',
      members: members.map(([entityId, connectorId]) => ({ entityId, connectorId })),
    },
  };
}

function makeLevelManager(initial: SceneModel) {
  let scene = initial;
  const setLevelScene = jest.fn((_id: string, next: SceneModel) => { scene = next; });
  return {
    currentLevelId: 'L1',
    getLevelScene: () => scene,
    setLevelScene,
    getScene: () => scene,
  };
}

afterEach(() => useMepSystemStore.getState().setSystems([]));

describe('useMepConnectorReconciliation', () => {
  it('writes systemId onto a member connector (System wins)', () => {
    useMepSystemStore.getState().setSystems([sys('sys1', [['fx1', 'c1']])]);
    const scene = makeScene(fixture('fx1'));
    const lm = makeLevelManager(scene);

    renderHook(() => useMepConnectorReconciliation({ currentScene: scene, levelManager: lm }));

    expect(lm.setLevelScene).toHaveBeenCalledTimes(1);
    const written = lm.getScene().entities[0] as ReturnType<typeof fixture>;
    expect(written.params.connectors[0].systemId).toBe('sys1');
  });

  it('is idempotent — no second write when already reconciled', () => {
    useMepSystemStore.getState().setSystems([sys('sys1', [['fx1', 'c1']])]);
    const scene = makeScene(fixture('fx1', 'sys1'));
    const lm = makeLevelManager(scene);

    renderHook(() => useMepConnectorReconciliation({ currentScene: scene, levelManager: lm }));

    expect(lm.setLevelScene).not.toHaveBeenCalled();
  });

  it('clears a stale systemId when the entity is no longer a member', () => {
    useMepSystemStore.getState().setSystems([]); // no systems → no memberships
    const scene = makeScene(fixture('fx1', 'sysGone'));
    const lm = makeLevelManager(scene);

    renderHook(() => useMepConnectorReconciliation({ currentScene: scene, levelManager: lm }));

    expect(lm.setLevelScene).toHaveBeenCalledTimes(1);
    const written = lm.getScene().entities[0] as ReturnType<typeof fixture>;
    expect(written.params.connectors[0].systemId).toBeUndefined();
  });
});
