/**
 * ADR-411 — MEP fixture LIBRARY (drawing-tool picker) command-key registry.
 *
 * Distinct from `MEP_FIXTURE_RIBBON_KEYS` (ADR-406, the selected-entity property
 * editor): these keys drive the TOOL-ACTIVE library picker that lets the user
 * choose a CC0 mesh model (+ rotation / scale) before placing. Mirrors
 * `FURNITURE_RIBBON_KEYS`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-411-bim-mesh-library.md
 */

import { makeKeySetGuard } from './make-key-set-guard';

export const MEP_FIXTURE_LIBRARY_KEYS = {
  stringParams: {
    /** Catalog asset selector — `''` ⇒ parametric fixture (no mesh). */
    assetId: 'mepFixtureLibrary.params.assetId',
  },
  params: {
    /** deg — plan rotation about the insertion point. */
    rotation: 'mepFixtureLibrary.params.rotation',
    /** unitless — uniform scale multiplier applied to the mesh. */
    scale: 'mepFixtureLibrary.params.scale',
  },
} as const;

export type MepFixtureLibraryNumberCommandKey =
  | typeof MEP_FIXTURE_LIBRARY_KEYS.params.rotation
  | typeof MEP_FIXTURE_LIBRARY_KEYS.params.scale;

export type MepFixtureLibraryStringCommandKey =
  | typeof MEP_FIXTURE_LIBRARY_KEYS.stringParams.assetId;

export const MEP_FIXTURE_LIBRARY_NUMBER_KEYS: readonly MepFixtureLibraryNumberCommandKey[] = [
  MEP_FIXTURE_LIBRARY_KEYS.params.rotation,
  MEP_FIXTURE_LIBRARY_KEYS.params.scale,
];

export const MEP_FIXTURE_LIBRARY_STRING_KEYS: readonly MepFixtureLibraryStringCommandKey[] = [
  MEP_FIXTURE_LIBRARY_KEYS.stringParams.assetId,
];

export const MEP_FIXTURE_LIBRARY_KEYS_ACTIONS = {
  close: 'mepFixtureLibrary.actions.close',
} as const;

export const isMepFixtureLibraryActionKey = makeKeySetGuard(
  Object.values(MEP_FIXTURE_LIBRARY_KEYS_ACTIONS),
);

// ─── Type guards (used by useRibbonCommands composer) ────────────────────────

export const isMepFixtureLibraryKey = makeKeySetGuard(MEP_FIXTURE_LIBRARY_NUMBER_KEYS);
export const isMepFixtureLibraryStringKey = makeKeySetGuard(MEP_FIXTURE_LIBRARY_STRING_KEYS);
