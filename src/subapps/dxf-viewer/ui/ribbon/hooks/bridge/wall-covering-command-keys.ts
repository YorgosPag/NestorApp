/**
 * ADR-511 — Wall-covering contextual ribbon command-key registry.
 *
 * Centralizes τα `commandKey` strings που μοιράζονται η ribbon data declaration
 * (`contextual-wall-covering-tab.ts`) και το bridge (`useRibbonWallCoveringBridge`).
 * Mirror του `floor-finish-command-keys.ts`.
 *
 * Edit model (Slice B): δύο material pickers (body finish + surface paint) ανασυνθέτουν
 * το compound assembly· faceSide toggle· height. Full per-layer editor = follow-up.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-511-wall-finish-per-room.md
 */

import { makeKeySetGuard } from './make-key-set-guard';

export const WALL_COVERING_RIBBON_KEYS = {
  stringParams: {
    /** Body finish material (σοβάς / knauf / πλακίδια). */
    bodyMaterialId: 'wallCovering.params.bodyMaterialId',
    /** Surface coat material (μπογιά λευκή/κόκκινη/πράσινη/γαλάζια). */
    surfaceMaterialId: 'wallCovering.params.surfaceMaterialId',
    /** Παρειά (inner / outer). */
    faceSide: 'wallCovering.params.faceSide',
  },
  params: {
    /** mm — πάνω όριο ύψους covering. */
    heightTopMm: 'wallCovering.params.heightTopMm',
  },
  actions: {
    /** Close selection (return to Select tool). */
    close: 'wallCovering.action.close',
    /** Delete entity. */
    delete: 'wallCovering.action.delete',
  },
} as const;

export type WallCoveringRibbonNumberCommandKey =
  | typeof WALL_COVERING_RIBBON_KEYS.params.heightTopMm;

export type WallCoveringRibbonStringCommandKey =
  | typeof WALL_COVERING_RIBBON_KEYS.stringParams.bodyMaterialId
  | typeof WALL_COVERING_RIBBON_KEYS.stringParams.surfaceMaterialId
  | typeof WALL_COVERING_RIBBON_KEYS.stringParams.faceSide;

export type WallCoveringRibbonActionKey =
  | typeof WALL_COVERING_RIBBON_KEYS.actions.close
  | typeof WALL_COVERING_RIBBON_KEYS.actions.delete;

export const isWallCoveringRibbonNumberKey = makeKeySetGuard<WallCoveringRibbonNumberCommandKey>([
  WALL_COVERING_RIBBON_KEYS.params.heightTopMm,
]);

export const isWallCoveringRibbonStringKey = makeKeySetGuard<WallCoveringRibbonStringCommandKey>([
  WALL_COVERING_RIBBON_KEYS.stringParams.bodyMaterialId,
  WALL_COVERING_RIBBON_KEYS.stringParams.surfaceMaterialId,
  WALL_COVERING_RIBBON_KEYS.stringParams.faceSide,
]);

export const isWallCoveringRibbonActionKey = makeKeySetGuard<WallCoveringRibbonActionKey>([
  WALL_COVERING_RIBBON_KEYS.actions.close,
  WALL_COVERING_RIBBON_KEYS.actions.delete,
]);
