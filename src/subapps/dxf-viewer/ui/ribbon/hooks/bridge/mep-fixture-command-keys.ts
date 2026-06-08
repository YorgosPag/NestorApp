/**
 * ADR-406 — MEP fixture contextual ribbon command-key registry.
 *
 * Centralizes τα `commandKey` strings που μοιράζονται μεταξύ ribbon data
 * declaration (`contextual-mep-fixture-tab.ts`) και bridge mappings
 * (`useRibbonMepFixtureBridge`). Mirrors `COLUMN_RIBBON_KEYS` /
 * `BEAM_RIBBON_KEYS` pattern.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
 */

export const MEP_FIXTURE_RIBBON_KEYS = {
  stringParams: {
    /** Footprint shape selector (rectangular / circular). */
    shape: 'mepFixture.params.shape',
    /**
     * ADR-411 — 3D representation selector. Empty value = parametric box; a
     * catalog asset id = realistic glTF mesh override (`bim-mesh-library/<cat>/`).
     */
    assetId: 'mepFixture.params.assetId',
  },
  params: {
    /** mm — footprint width (διάμετρος αν circular). */
    width: 'mepFixture.params.width',
    /** mm — footprint length (αγνοείται αν circular). */
    length: 'mepFixture.params.length',
    /** deg — rotation about insertion point (αγνοείται αν circular). */
    rotation: 'mepFixture.params.rotation',
    /** mm — body thickness (thin solid in 3D). */
    bodyHeight: 'mepFixture.params.bodyHeight',
    /** mm — ceiling-relative mounting elevation above FFL. */
    mountingElevation: 'mepFixture.params.mountingElevation',
  },
} as const;

export type MepFixtureRibbonNumberCommandKey =
  | typeof MEP_FIXTURE_RIBBON_KEYS.params.width
  | typeof MEP_FIXTURE_RIBBON_KEYS.params.length
  | typeof MEP_FIXTURE_RIBBON_KEYS.params.rotation
  | typeof MEP_FIXTURE_RIBBON_KEYS.params.bodyHeight
  | typeof MEP_FIXTURE_RIBBON_KEYS.params.mountingElevation;

export type MepFixtureRibbonStringCommandKey =
  | typeof MEP_FIXTURE_RIBBON_KEYS.stringParams.shape
  | typeof MEP_FIXTURE_RIBBON_KEYS.stringParams.assetId;

export const MEP_FIXTURE_RIBBON_NUMBER_KEYS: readonly MepFixtureRibbonNumberCommandKey[] = [
  MEP_FIXTURE_RIBBON_KEYS.params.width,
  MEP_FIXTURE_RIBBON_KEYS.params.length,
  MEP_FIXTURE_RIBBON_KEYS.params.rotation,
  MEP_FIXTURE_RIBBON_KEYS.params.bodyHeight,
  MEP_FIXTURE_RIBBON_KEYS.params.mountingElevation,
];

export const MEP_FIXTURE_RIBBON_STRING_KEYS: readonly MepFixtureRibbonStringCommandKey[] = [
  MEP_FIXTURE_RIBBON_KEYS.stringParams.shape,
  MEP_FIXTURE_RIBBON_KEYS.stringParams.assetId,
];

export const MEP_FIXTURE_RIBBON_KEYS_ACTIONS = {
  close: 'mepFixture.actions.close',
  delete: 'mepFixture.actions.delete',
  /**
   * ADR-408 Φ7 — jump to the fixture's circuit (Revit "Select Panel" / "Edit
   * Circuit"): selects the circuit's source panel so the panel-centric circuit
   * tab surfaces in manage mode with the fixture's circuit active.
   */
  editCircuit: 'mepFixture.actions.editCircuit',
} as const;

const MEP_FIXTURE_ACTION_KEY_SET: ReadonlySet<string> = new Set<string>(
  Object.values(MEP_FIXTURE_RIBBON_KEYS_ACTIONS),
);

export function isMepFixtureActionKey(action: string): boolean {
  return MEP_FIXTURE_ACTION_KEY_SET.has(action);
}

/**
 * Panel visibility keys (ADR-358 Phase 7b2b-β pattern).
 *   - `rectangularParams`: visible iff `params.shape === 'rectangular'` —
 *     surfaces the length + rotation inputs (αγνοούνται για circular).
 */
export const MEP_FIXTURE_RIBBON_VISIBILITY_KEYS = {
  rectangularParams: 'mepFixture.visibility.rectangularParams',
  /** ADR-408 Φ7 — circuit panel visible iff the fixture belongs to a circuit. */
  hasCircuit: 'mepFixture.visibility.hasCircuit',
} as const;

export type MepFixtureRibbonVisibilityKey =
  | typeof MEP_FIXTURE_RIBBON_VISIBILITY_KEYS.rectangularParams
  | typeof MEP_FIXTURE_RIBBON_VISIBILITY_KEYS.hasCircuit;

const MEP_FIXTURE_VISIBILITY_KEY_SET: ReadonlySet<string> = new Set<string>([
  MEP_FIXTURE_RIBBON_VISIBILITY_KEYS.rectangularParams,
  MEP_FIXTURE_RIBBON_VISIBILITY_KEYS.hasCircuit,
]);

export function isMepFixtureVisibilityKey(
  key: string,
): key is MepFixtureRibbonVisibilityKey {
  return MEP_FIXTURE_VISIBILITY_KEY_SET.has(key);
}

// ─── Type guards (used by useRibbonCommands composer) ────────────────────────

const MEP_FIXTURE_NUMBER_KEY_SET: ReadonlySet<string> = new Set<string>(
  MEP_FIXTURE_RIBBON_NUMBER_KEYS,
);
const MEP_FIXTURE_STRING_KEY_SET: ReadonlySet<string> = new Set<string>(
  MEP_FIXTURE_RIBBON_STRING_KEYS,
);

export function isMepFixtureRibbonKey(commandKey: string): boolean {
  return MEP_FIXTURE_NUMBER_KEY_SET.has(commandKey);
}

export function isMepFixtureRibbonStringKey(commandKey: string): boolean {
  return MEP_FIXTURE_STRING_KEY_SET.has(commandKey);
}
