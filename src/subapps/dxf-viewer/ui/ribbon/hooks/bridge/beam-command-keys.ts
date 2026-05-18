/**
 * ADR-363 Phase 5 — Beam contextual ribbon command-key registry.
 *
 * Centralizes τα `commandKey` strings που μοιράζονται μεταξύ ribbon data
 * declaration (`contextual-beam-tab.ts`) και bridge mappings
 * (`useRibbonBeamBridge`). Mirrors `COLUMN_RIBBON_KEYS` pattern.
 */

export const BEAM_RIBBON_KEYS = {
  stringParams: {
    /** Beam kind selector (3 options: straight/curved/cantilever). */
    kind: 'beam.params.kind',
    /** Structural support type (simple/fixed/cantilever). */
    supportType: 'beam.params.supportType',
    /** ADR-363 Phase 5.5c — Material picker (rc/steel/glulam). */
    material: 'beam.params.material',
  },
  params: {
    /** mm — beam cross-section width. */
    width: 'beam.params.width',
    /** mm — beam structural depth (cross-section Y). */
    depth: 'beam.params.depth',
    /** mm — top-of-beam elevation από project origin. */
    elevation: 'beam.params.elevation',
  },
} as const;

export type BeamRibbonNumberCommandKey =
  | typeof BEAM_RIBBON_KEYS.params.width
  | typeof BEAM_RIBBON_KEYS.params.depth
  | typeof BEAM_RIBBON_KEYS.params.elevation;

export type BeamRibbonStringCommandKey =
  | typeof BEAM_RIBBON_KEYS.stringParams.kind
  | typeof BEAM_RIBBON_KEYS.stringParams.supportType
  | typeof BEAM_RIBBON_KEYS.stringParams.material;

export const BEAM_RIBBON_NUMBER_KEYS: readonly BeamRibbonNumberCommandKey[] = [
  BEAM_RIBBON_KEYS.params.width,
  BEAM_RIBBON_KEYS.params.depth,
  BEAM_RIBBON_KEYS.params.elevation,
];

export const BEAM_RIBBON_STRING_KEYS: readonly BeamRibbonStringCommandKey[] = [
  BEAM_RIBBON_KEYS.stringParams.kind,
  BEAM_RIBBON_KEYS.stringParams.supportType,
  BEAM_RIBBON_KEYS.stringParams.material,
];

export const BEAM_RIBBON_KEYS_ACTIONS = {
  close: 'beam.actions.close',
  delete: 'beam.actions.delete',
} as const;

const BEAM_ACTION_KEY_SET: ReadonlySet<string> = new Set<string>(
  Object.values(BEAM_RIBBON_KEYS_ACTIONS),
);

export function isBeamActionKey(action: string): boolean {
  return BEAM_ACTION_KEY_SET.has(action);
}

/** Visibility key (red badge when `validation.hasCodeViolations === true`). */
export const BEAM_RIBBON_BADGE_KEYS = {
  violations: 'beam.badge.violations',
} as const;

// ─── Type guards (used by useRibbonCommands composer) ────────────────────────

const BEAM_NUMBER_KEY_SET: ReadonlySet<string> = new Set<string>(BEAM_RIBBON_NUMBER_KEYS);
const BEAM_STRING_KEY_SET: ReadonlySet<string> = new Set<string>(BEAM_RIBBON_STRING_KEYS);

export function isBeamRibbonKey(commandKey: string): boolean {
  return BEAM_NUMBER_KEY_SET.has(commandKey);
}

export function isBeamRibbonStringKey(commandKey: string): boolean {
  return BEAM_STRING_KEY_SET.has(commandKey);
}
