'use client';

/**
 * ADR-421 SLICE C — Opening family-type edit side-effect: all-floors BOQ re-feed.
 *
 * The opening analogue of `family-type-side-effects.ts`, kept SEPARATE because
 * openings work fundamentally differently from wall/slab/roof:
 *   - wall/slab/roof live IN the scene file → the fan-out re-resolves in-memory
 *     entities and feeds the per-entity `bimToBoqBridge` (see that module).
 *   - openings live ONLY in the `FLOORPLAN_OPENINGS` collection (merged into the
 *     scene at runtime by `useOpeningPersistence`). Their BOQ is a Firestore
 *     signature-group aggregate. So this fan-out is PURE Firestore: per building
 *     floorplan it re-feeds the affected signature groups effective-aware, WITHOUT
 *     touching any scene or re-persisting any opening doc (geometry self-heals on
 *     next load via «type wins» hydration — exactly the Revit model→schedule
 *     relationship: the type is the source of truth, the schedule a derived view).
 *
 * Zero scene I/O (no `loadFileV2`/`getLevelScene`), zero opening/audit writes —
 * only BOQ rows are written.
 *
 * @see bim/services/opening-boq-sync.ts §refeedOpeningBoqForTypeOnFloorplan
 * @see hooks/data/useFamilyTypeBoqRefeed.ts — the host hook that wires this up
 * @see docs/centralized-systems/reference/adrs/ADR-421-bim-opening-types-revit-grade.md
 */

import { createModuleLogger } from '@/lib/telemetry';
import {
  refeedOpeningBoqForTypeOnFloorplan,
  type OpeningBoqContext,
} from '../services/opening-boq-sync';
import type { FloorLevelLike } from './family-type-side-effects';

const logger = createModuleLogger('OpeningBoqSideEffects');

export interface RefeedOpeningBoqForTypeArgs {
  readonly typeId: string;
  /** Levels of the active building (caller pre-filters by `buildingId`). */
  readonly levels: readonly FloorLevelLike[];
  readonly boqContextBase: { readonly companyId: string; readonly projectId: string; readonly buildingId: string };
  /** Injectable for tests; defaults to the production Firestore re-feed. */
  readonly recompute?: (context: OpeningBoqContext, typeId: string) => Promise<void>;
}

/**
 * Re-feed the BOQ signature groups of every opening of `typeId` across all of
 * the building's floors. The opening `floorplanId` IS the level's `sceneFileId`
 * (BOQ groups are scoped per floorplan, matching the active-floor save path).
 * Callers MUST invoke this AFTER the optimistic catalog `setTypes` (the command
 * does) so the effective resolution reads the NEW type. Per-floor failures are
 * isolated; re-feeds are fire-and-forget.
 */
export async function refeedOpeningBoqForTypeAcrossFloors(
  args: RefeedOpeningBoqForTypeArgs,
): Promise<void> {
  const { companyId, projectId, buildingId } = args.boqContextBase;
  if (!companyId || !projectId || !buildingId) return;
  const recompute = args.recompute ?? refeedOpeningBoqForTypeOnFloorplan;

  for (const level of args.levels) {
    if (!level.sceneFileId) {
      logger.warn('Skipping opening BOQ re-feed for floor without sceneFileId (stale until loaded)', {
        levelId: level.id,
        floorId: level.floorId,
        typeId: args.typeId,
      });
      continue;
    }
    await recompute(
      { companyId, projectId, buildingId, floorplanId: level.sceneFileId, floorId: level.floorId },
      args.typeId,
    ).catch((err) => {
      logger.error('Opening BOQ re-feed failed for floor', { levelId: level.id, err });
    });
  }
}
