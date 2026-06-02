'use client';

/**
 * ADR-408 Φ5 — scene-time MEP connector reconciliation.
 *
 * Writes the derived `MepConnector.systemId` cache onto the fixture/panel scene
 * entities so it always reflects the System membership truth ("System always
 * wins"). The System owns `members[]`; this hook re-derives the per-connector
 * back-reference whenever the systems list or the scene changes, via the pure
 * `reconcileEntityConnectors` coordinator (ADR-401 pattern C).
 *
 * **Scene-only, not persisted**: the cache is rebuilt from truth on every load,
 * so there is no extra Firestore write (the type contract says a stale
 * `systemId` is harmless). Idempotent — `reconcileEntityConnectors` returns the
 * same array reference when nothing changed, so `setLevelScene` only fires on a
 * real diff and the `currentScene` effect converges without a render loop.
 *
 * @see ../../bim/mep-systems/mep-system-coordinator.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { useCallback, useEffect, useRef } from 'react';

import type { SceneModel } from '../../types/scene';
import type { useLevels } from '../../systems/levels';
import { isMepFixtureEntity, isElectricalPanelEntity } from '../../types/entities';
import type { MepFixtureEntity } from '../../bim/types/mep-fixture-types';
import type { ElectricalPanelEntity } from '../../bim/types/electrical-panel-types';
import { useMepSystemStore } from '../../bim/mep-systems/mep-system-store';
import {
  buildConnectorSystemIndex,
  reconcileEntityConnectors,
} from '../../bim/mep-systems/mep-system-coordinator';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseMepConnectorReconciliationParams {
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelManagerLike;
}

/** Re-derive one connector host's `systemId` cache; same ref when unchanged. */
function reconcileHost<T extends MepFixtureEntity | ElectricalPanelEntity>(
  entity: T,
  index: ReadonlyMap<string, string>,
): T {
  const current = entity.params.connectors ?? [];
  const reconciled = reconcileEntityConnectors(entity.id, current, index);
  if (reconciled === current) return entity;
  return { ...entity, params: { ...entity.params, connectors: reconciled } } as T;
}

export function useMepConnectorReconciliation(
  params: UseMepConnectorReconciliationParams,
): void {
  const { currentScene, levelManager } = params;
  const levelManagerRef = useRef(levelManager);
  levelManagerRef.current = levelManager;

  const reconcile = useCallback((): void => {
    const lm = levelManagerRef.current;
    const levelId = lm.currentLevelId;
    if (!levelId) return;
    const scene = lm.getLevelScene(levelId);
    if (!scene) return;

    const index = buildConnectorSystemIndex(useMepSystemStore.getState().getSystems());
    let changed = false;
    const nextEntities = scene.entities.map((e) => {
      if (isMepFixtureEntity(e)) {
        const next = reconcileHost(e, index);
        if (next !== e) changed = true;
        return next;
      }
      if (isElectricalPanelEntity(e)) {
        const next = reconcileHost(e, index);
        if (next !== e) changed = true;
        return next;
      }
      return e;
    });

    if (changed) lm.setLevelScene(levelId, { ...scene, entities: nextEntities });
  }, []);

  // (a) Scene change — a fixture/panel was placed, or the active level switched.
  useEffect(() => {
    reconcile();
  }, [currentScene, reconcile]);

  // (b) Systems change — a circuit was created / a member reassigned / dissolved.
  useEffect(() => {
    const unsub = useMepSystemStore.subscribe(() => reconcile());
    return () => unsub();
  }, [reconcile]);
}
