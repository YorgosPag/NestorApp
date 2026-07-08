/**
 * ADR-419 — Floor-finish contextual ribbon command-key registry.
 *
 * Centralizes the `commandKey` strings shared between the ribbon data declaration
 * (`contextual-floor-finish-tab.ts`) and the bridge
 * (`useRibbonFloorFinishBridge`). Mirrors the pattern of `floorplan-symbol-command-keys.ts`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-419-floor-finish-per-room.md
 */

import { makeKeySetGuard } from './make-key-set-guard';

export const FLOOR_FINISH_RIBBON_KEYS = {
  stringParams: {
    /** Material selector (FloorFinishMaterialId). */
    materialId: 'floorFinish.params.materialId',
  },
  params: {
    /** mm — finish layer thickness. */
    thicknessMm: 'floorFinish.params.thicknessMm',
    /** mm — physical tile length (U axis). */
    tileLengthMm: 'floorFinish.params.tileLengthMm',
    /** mm — physical tile width (V axis). */
    tileWidthMm: 'floorFinish.params.tileWidthMm',
  },
  toggles: {
    /** Swap U↔V — texture rotation 90°. */
    tileRotate90: 'floorFinish.toggle.tileRotate90',
  },
  actions: {
    /** Close selection (return to Select tool). */
    close: 'floorFinish.action.close',
    /** Delete entity. */
    delete: 'floorFinish.action.delete',
  },
} as const;

export type FloorFinishRibbonNumberCommandKey =
  | typeof FLOOR_FINISH_RIBBON_KEYS.params.thicknessMm
  | typeof FLOOR_FINISH_RIBBON_KEYS.params.tileLengthMm
  | typeof FLOOR_FINISH_RIBBON_KEYS.params.tileWidthMm;

export type FloorFinishRibbonToggleKey =
  | typeof FLOOR_FINISH_RIBBON_KEYS.toggles.tileRotate90;

export type FloorFinishRibbonStringCommandKey =
  | typeof FLOOR_FINISH_RIBBON_KEYS.stringParams.materialId;

export type FloorFinishRibbonActionKey =
  | typeof FLOOR_FINISH_RIBBON_KEYS.actions.close
  | typeof FLOOR_FINISH_RIBBON_KEYS.actions.delete;

export const isFloorFinishRibbonNumberKey = makeKeySetGuard<FloorFinishRibbonNumberCommandKey>([
  FLOOR_FINISH_RIBBON_KEYS.params.thicknessMm,
  FLOOR_FINISH_RIBBON_KEYS.params.tileLengthMm,
  FLOOR_FINISH_RIBBON_KEYS.params.tileWidthMm,
]);

export const isFloorFinishRibbonToggleKey = makeKeySetGuard<FloorFinishRibbonToggleKey>([
  FLOOR_FINISH_RIBBON_KEYS.toggles.tileRotate90,
]);

export const isFloorFinishRibbonStringKey = makeKeySetGuard<FloorFinishRibbonStringCommandKey>([
  FLOOR_FINISH_RIBBON_KEYS.stringParams.materialId,
]);

export const isFloorFinishRibbonActionKey = makeKeySetGuard<FloorFinishRibbonActionKey>([
  FLOOR_FINISH_RIBBON_KEYS.actions.close,
  FLOOR_FINISH_RIBBON_KEYS.actions.delete,
]);
