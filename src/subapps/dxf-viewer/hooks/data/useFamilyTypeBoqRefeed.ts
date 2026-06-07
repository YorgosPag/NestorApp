'use client';

/**
 * ADR-412 Φ5 — host hook that re-feeds BOQ for ALL instances of an edited wall
 * family type, across ALL floors of the active building (Revit-grade).
 *
 * Mounted in `WallPersistenceHost` (the always-on host that already holds the
 * company/project/building context + level manager). Listens for
 * `bim:family-type-changed` (emitted by `UpdateWallFamilyTypeCommand` on
 * execute/undo) and runs the `refeedBoqForTypeAcrossFloors` fan-out.
 *
 * The command keeps the catalog store / persist / audit (it has the service);
 * the BOQ side-effect lives HERE because only the host knows
 * project/building/floor context — same separation as wall BOQ (which lives in
 * `useWallPersistence`, not in `UpdateWallParamsCommand`).
 *
 * Zero high-frequency subscriptions (CHECK 6B/6C compliant): one EventBus
 * listener, fired only on a type edit/undo.
 *
 * @see bim/family-types/family-type-side-effects.ts — the pure fan-out
 * @see core/commands/entity-commands/UpdateWallFamilyTypeCommand.ts — the emitter
 */

import { useEffect, useRef } from 'react';
import { EventBus } from '../../systems/events/EventBus';
import { useLevels } from '../../systems/levels';
import { DxfFirestoreService } from '../../services/dxf-firestore.service';
import {
  refeedBoqForTypeAcrossFloors,
  refeedRoofBoqForTypeAcrossFloors,
  refeedSlabBoqForTypeAcrossFloors,
} from '../../bim/family-types/family-type-side-effects';
import { refeedOpeningBoqForTypeAcrossFloors } from '../../bim/family-types/opening-boq-side-effects';

export interface FamilyTypeBoqRefeedContext {
  readonly companyId: string | null;
  readonly projectId?: string;
  readonly buildingId?: string;
}

export function useFamilyTypeBoqRefeed(ctx: FamilyTypeBoqRefeedContext): void {
  const { levels, getLevelScene, currentLevelId } = useLevels();

  // Hold the latest values in a ref so the EventBus listener (subscribed once)
  // always reads fresh context/levels without re-subscribing on every render.
  const latest = useRef({ ctx, levels, getLevelScene, currentLevelId });
  latest.current = { ctx, levels, getLevelScene, currentLevelId };

  useEffect(() => {
    return EventBus.on('bim:family-type-changed', ({ typeId, category }) => {
      if (category !== 'wall' && category !== 'slab' && category !== 'roof' && category !== 'opening') return;
      const snap = latest.current;
      const { companyId, projectId, buildingId } = snap.ctx;
      if (!companyId || !projectId || !buildingId) return;
      const buildingLevels = snap.levels.filter((l) => l.buildingId === buildingId);
      const boqContextBase = { companyId, projectId, buildingId };
      const shared = {
        typeId,
        levels: buildingLevels,
        activeLevelId: snap.currentLevelId,
        getLevelScene: snap.getLevelScene,
        loadFileV2: (fileId: string) => DxfFirestoreService.loadFileV2(fileId),
        boqContextBase,
      };
      if (category === 'slab') {
        void refeedSlabBoqForTypeAcrossFloors(shared);
      } else if (category === 'roof') {
        void refeedRoofBoqForTypeAcrossFloors(shared);
      } else if (category === 'opening') {
        // ADR-421 SLICE C — openings live only in FLOORPLAN_OPENINGS, so a PURE
        // Firestore signature-group re-feed (no scene / loadFileV2). floorplanId
        // = level.sceneFileId, resolved per floor inside the fan-out.
        void refeedOpeningBoqForTypeAcrossFloors({ typeId, levels: buildingLevels, boqContextBase });
      } else {
        void refeedBoqForTypeAcrossFloors(shared);
      }
    });
  }, []);
}
