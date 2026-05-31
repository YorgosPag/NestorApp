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
    /** ADR-363 Phase 5.5i+ — Steel section type (I / H). */
    sectionType: 'beam.params.sectionType',
    /** ADR-363 Phase 5.5i+ — Free-text profile designation (e.g. "IPE 300"). */
    profileDesignation: 'beam.params.profileDesignation',
    /** ADR-396 v2 Φ6a — ETICS envelope-function override (auto/exterior/interior). */
    envelopeFunction: 'beam.params.envelopeFunction',
  },
  params: {
    /** mm — beam cross-section width. */
    width: 'beam.params.width',
    /** mm — beam structural depth (cross-section Y). */
    depth: 'beam.params.depth',
    /** mm — top face (top-of-beam) από project origin. ADR-369 §2.2. */
    topElevation: 'beam.params.topElevation',
    /**
     * mm — άνω παρειά στο τέλος (endPoint) της δοκού. ADR-401 Phase E.2.
     * Όταν διαφέρει από `topElevation` → κεκλιμένη δοκός (Revit sloped beam).
     */
    topElevationEnd: 'beam.params.topElevationEnd',
  },
} as const;

export type BeamRibbonNumberCommandKey =
  | typeof BEAM_RIBBON_KEYS.params.width
  | typeof BEAM_RIBBON_KEYS.params.depth
  | typeof BEAM_RIBBON_KEYS.params.topElevation
  | typeof BEAM_RIBBON_KEYS.params.topElevationEnd;

export type BeamRibbonStringCommandKey =
  | typeof BEAM_RIBBON_KEYS.stringParams.kind
  | typeof BEAM_RIBBON_KEYS.stringParams.supportType
  | typeof BEAM_RIBBON_KEYS.stringParams.material
  | typeof BEAM_RIBBON_KEYS.stringParams.sectionType
  | typeof BEAM_RIBBON_KEYS.stringParams.profileDesignation
  | typeof BEAM_RIBBON_KEYS.stringParams.envelopeFunction;

export const BEAM_RIBBON_NUMBER_KEYS: readonly BeamRibbonNumberCommandKey[] = [
  BEAM_RIBBON_KEYS.params.width,
  BEAM_RIBBON_KEYS.params.depth,
  BEAM_RIBBON_KEYS.params.topElevation,
  BEAM_RIBBON_KEYS.params.topElevationEnd,
];

export const BEAM_RIBBON_STRING_KEYS: readonly BeamRibbonStringCommandKey[] = [
  BEAM_RIBBON_KEYS.stringParams.kind,
  BEAM_RIBBON_KEYS.stringParams.supportType,
  BEAM_RIBBON_KEYS.stringParams.material,
  BEAM_RIBBON_KEYS.stringParams.sectionType,
  BEAM_RIBBON_KEYS.stringParams.profileDesignation,
  BEAM_RIBBON_KEYS.stringParams.envelopeFunction,
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
