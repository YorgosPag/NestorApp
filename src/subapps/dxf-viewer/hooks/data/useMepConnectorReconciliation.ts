'use client';

/**
 * ADR-408 Φ5 — scene-time MEP connector seeding + reconciliation.
 *
 * One scene pass that keeps every connector host (fixture / panel) network-ready:
 *   1. **Seed** — a legacy host placed before the connector model has no
 *      `params.connectors`; `seedDefaultConnectors` re-materialises the host
 *      type's default connector from the builder SSoT (Revit: a family always
 *      declares its connectors). Scene-only, no Firestore write — re-derived on
 *      every load, exactly like the cache below.
 *   2. **Reconcile** — writes the derived `MepConnector.systemId` cache onto the
 *      (now seeded) connectors so it always reflects the System membership truth
 *      ("System always wins"). The System owns `members[]`; this re-derives the
 *      per-connector back-reference via the pure `reconcileEntityConnectors`
 *      coordinator (ADR-401 pattern C).
 *
 * **Scene-only, not persisted**: both steps are rebuilt from truth on every load,
 * so there is no extra Firestore write (the type contract says a stale
 * `systemId` is harmless, and the default connector is a deterministic property
 * of the host type). Idempotent — both `seedDefaultConnectors` and
 * `reconcileEntityConnectors` return the same reference when nothing changed, so
 * `setLevelScene` only fires on a real diff and the `currentScene` effect
 * converges without a render loop.
 *
 * @see ../../bim/mep-systems/mep-connector-seed.ts
 * @see ../../bim/mep-systems/mep-system-coordinator.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { useCallback, useEffect, useRef } from 'react';

import type { SceneModel } from '../../types/scene';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import {
  isMepFixtureEntity,
  isElectricalPanelEntity,
  isMepSegmentEntity,
  isMepRadiatorEntity,
  isMepBoilerEntity,
  isMepWaterHeaterEntity,
  isMepUnderfloorEntity,
} from '../../types/entities';
import type { MepFixtureEntity } from '../../bim/types/mep-fixture-types';
import type { ElectricalPanelEntity } from '../../bim/types/electrical-panel-types';
import type { MepSegmentEntity } from '../../bim/types/mep-segment-types';
import type { MepRadiatorEntity } from '../../bim/types/mep-radiator-types';
import type { MepBoilerEntity } from '../../bim/types/mep-boiler-types';
import type { MepWaterHeaterEntity } from '../../bim/types/mep-water-heater-types';
import type { MepUnderfloorEntity } from '../../bim/types/mep-underfloor-types';
import { useMepSystemStore } from '../../bim/mep-systems/mep-system-store';
import {
  buildConnectorSystemIndex,
  reconcileEntityConnectors,
} from '../../bim/mep-systems/mep-system-coordinator';
import { seedDefaultConnectors } from '../../bim/mep-systems/mep-connector-seed';

export interface UseMepConnectorReconciliationParams {
  readonly currentScene: SceneModel | null;
  readonly levelManager: LevelSceneWriter;
}

/** Re-derive one connector host's `systemId` cache; same ref when unchanged. */
function reconcileHost<
  T extends MepFixtureEntity | ElectricalPanelEntity | MepSegmentEntity | MepRadiatorEntity | MepBoilerEntity | MepWaterHeaterEntity | MepUnderfloorEntity,
>(
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
      // Seed a legacy host's default connector first, then reconcile its cache —
      // one pass, one diff. Both steps are referentially stable when unchanged,
      // so `next !== e` is true iff the seed OR the reconcile touched the host.
      const seeded = seedDefaultConnectors(e);
      if (isMepFixtureEntity(seeded)) {
        const next = reconcileHost(seeded, index);
        if (next !== e) changed = true;
        return next;
      }
      if (isElectricalPanelEntity(seeded)) {
        const next = reconcileHost(seeded, index);
        if (next !== e) changed = true;
        return next;
      }
      if (isMepSegmentEntity(seeded)) {
        const next = reconcileHost(seeded, index);
        if (next !== e) changed = true;
        return next;
      }
      // ADR-408 Εύρος Β — a heating radiator is a MEMBER of a supply + a return
      // network (one per connector); reconcile its per-connector systemId cache so
      // colour-by-system + circuit membership resolve, exactly like the fixture.
      if (isMepRadiatorEntity(seeded)) {
        const next = reconcileHost(seeded, index);
        if (next !== e) changed = true;
        return next;
      }
      // ADR-408 Εύρος Β #2 — a boiler SOURCES a supply network + is a member of the
      // return network (one per connector); reconcile its per-connector systemId
      // cache exactly like the radiator/manifold.
      if (isMepBoilerEntity(seeded)) {
        const next = reconcileHost(seeded, index);
        if (next !== e) changed = true;
        return next;
      }
      // ADR-408 DHW — a water heater SOURCES the domestic-hot-water network + is a
      // member of the domestic-cold-water network (one per connector); reconcile its
      // per-connector systemId cache exactly like the boiler.
      if (isMepWaterHeaterEntity(seeded)) {
        const next = reconcileHost(seeded, index);
        if (next !== e) changed = true;
        return next;
      }
      // ADR-408 Εύρος Β #3 — an underfloor loop is a MEMBER of a supply + a return
      // network (one per connector); reconcile its per-connector systemId cache
      // exactly like the radiator/boiler.
      if (isMepUnderfloorEntity(seeded)) {
        const next = reconcileHost(seeded, index);
        if (next !== e) changed = true;
        return next;
      }
      return seeded;
    });

    if (changed) lm.setLevelScene(levelId, { ...scene, entities: nextEntities }, 'system-reconcile');
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
