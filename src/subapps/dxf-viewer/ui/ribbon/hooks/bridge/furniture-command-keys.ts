/**
 * ADR-410 — Furniture contextual ribbon command-key registry.
 *
 * Centralizes the `commandKey` strings shared between the ribbon data
 * declaration (`contextual-furniture-tab.ts`) and the bridge mappings
 * (`useRibbonFurnitureBridge`). Mirrors `MEP_FIXTURE_RIBBON_KEYS`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-410-cc0-mesh-furniture-import.md
 */

export const FURNITURE_RIBBON_KEYS = {
  stringParams: {
    /** Catalog asset selector (which furniture model to place). */
    assetId: 'furniture.params.assetId',
  },
  params: {
    /** deg — plan rotation about the insertion point. */
    rotation: 'furniture.params.rotation',
    /** unitless — uniform scale multiplier applied to the mesh. */
    scale: 'furniture.params.scale',
    /** mm — mounting elevation above FFL (0 = on the floor). */
    mountingElevation: 'furniture.params.mountingElevation',
  },
} as const;

export type FurnitureRibbonNumberCommandKey =
  | typeof FURNITURE_RIBBON_KEYS.params.rotation
  | typeof FURNITURE_RIBBON_KEYS.params.scale
  | typeof FURNITURE_RIBBON_KEYS.params.mountingElevation;

export type FurnitureRibbonStringCommandKey =
  | typeof FURNITURE_RIBBON_KEYS.stringParams.assetId;

export const FURNITURE_RIBBON_NUMBER_KEYS: readonly FurnitureRibbonNumberCommandKey[] = [
  FURNITURE_RIBBON_KEYS.params.rotation,
  FURNITURE_RIBBON_KEYS.params.scale,
  FURNITURE_RIBBON_KEYS.params.mountingElevation,
];

export const FURNITURE_RIBBON_STRING_KEYS: readonly FurnitureRibbonStringCommandKey[] = [
  FURNITURE_RIBBON_KEYS.stringParams.assetId,
];

export const FURNITURE_RIBBON_KEYS_ACTIONS = {
  close: 'furniture.actions.close',
} as const;

const FURNITURE_ACTION_KEY_SET: ReadonlySet<string> = new Set<string>(
  Object.values(FURNITURE_RIBBON_KEYS_ACTIONS),
);

export function isFurnitureActionKey(action: string): boolean {
  return FURNITURE_ACTION_KEY_SET.has(action);
}

// ─── Type guards (used by useRibbonCommands composer) ────────────────────────

const FURNITURE_NUMBER_KEY_SET: ReadonlySet<string> = new Set<string>(
  FURNITURE_RIBBON_NUMBER_KEYS,
);
const FURNITURE_STRING_KEY_SET: ReadonlySet<string> = new Set<string>(
  FURNITURE_RIBBON_STRING_KEYS,
);

export function isFurnitureRibbonKey(commandKey: string): boolean {
  return FURNITURE_NUMBER_KEY_SET.has(commandKey);
}

export function isFurnitureRibbonStringKey(commandKey: string): boolean {
  return FURNITURE_STRING_KEY_SET.has(commandKey);
}
