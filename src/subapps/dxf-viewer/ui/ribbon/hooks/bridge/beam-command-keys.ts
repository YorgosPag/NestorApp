/**
 * ADR-363 Phase 5 — Beam contextual ribbon command-key registry.
 *
 * Centralizes τα `commandKey` strings που μοιράζονται μεταξύ ribbon data
 * declaration (`contextual-beam-tab.ts`) και bridge mappings
 * (`useRibbonBeamBridge`). Mirrors `COLUMN_RIBBON_KEYS` pattern.
 */

import type { FinishParamField } from './finish-param';

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
    /** ADR-363 Φ2 — σχήμα διατομής (rectangular / I-shape). */
    sectionKind: 'beam.params.sectionKind',
    /** ADR-363 Φ2 — EN 10365 catalog profile ID (π.χ. 'IPE-300'). */
    catalogProfile: 'beam.params.catalogProfile',
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
    /** ADR-363 Φ2 — mm. Πάχος πέλματος (tf) — nested `ishape.flangeThickness`. */
    flangeThickness: 'beam.params.flangeThickness',
    /** ADR-363 Φ2 — mm. Πάχος κορμού (tw) — nested `ishape.webThickness`. */
    webThickness: 'beam.params.webThickness',
  },
} as const;

/**
 * ADR-363 Φ2 — panel visibility keys (mirror COLUMN_RIBBON_VISIBILITY_KEYS).
 *   - `ishapeCatalog`: visible iff `params.sectionKind === 'I-shape'` — EN 10365 dropdown.
 *   - `ishapeParams`:  visible iff `params.sectionKind === 'I-shape'` — flange/web + I/H hint.
 */
export const BEAM_RIBBON_VISIBILITY_KEYS = {
  ishapeCatalog: 'beam.visibility.ishapeCatalog',
  ishapeParams:  'beam.visibility.ishapeParams',
} as const;

export type BeamRibbonVisibilityKey =
  | typeof BEAM_RIBBON_VISIBILITY_KEYS.ishapeCatalog
  | typeof BEAM_RIBBON_VISIBILITY_KEYS.ishapeParams;

const BEAM_VISIBILITY_KEY_SET: ReadonlySet<string> = new Set<string>([
  BEAM_RIBBON_VISIBILITY_KEYS.ishapeCatalog,
  BEAM_RIBBON_VISIBILITY_KEYS.ishapeParams,
]);

export function isBeamVisibilityKey(key: string): key is BeamRibbonVisibilityKey {
  return BEAM_VISIBILITY_KEY_SET.has(key);
}

export type BeamRibbonNumberCommandKey =
  | typeof BEAM_RIBBON_KEYS.params.width
  | typeof BEAM_RIBBON_KEYS.params.depth
  | typeof BEAM_RIBBON_KEYS.params.topElevation
  | typeof BEAM_RIBBON_KEYS.params.topElevationEnd
  | typeof BEAM_RIBBON_KEYS.params.flangeThickness
  | typeof BEAM_RIBBON_KEYS.params.webThickness;

export type BeamRibbonStringCommandKey =
  | typeof BEAM_RIBBON_KEYS.stringParams.kind
  | typeof BEAM_RIBBON_KEYS.stringParams.supportType
  | typeof BEAM_RIBBON_KEYS.stringParams.material
  | typeof BEAM_RIBBON_KEYS.stringParams.sectionType
  | typeof BEAM_RIBBON_KEYS.stringParams.profileDesignation
  | typeof BEAM_RIBBON_KEYS.stringParams.envelopeFunction
  | typeof BEAM_RIBBON_KEYS.stringParams.sectionKind
  | typeof BEAM_RIBBON_KEYS.stringParams.catalogProfile;

export const BEAM_RIBBON_NUMBER_KEYS: readonly BeamRibbonNumberCommandKey[] = [
  BEAM_RIBBON_KEYS.params.width,
  BEAM_RIBBON_KEYS.params.depth,
  BEAM_RIBBON_KEYS.params.topElevation,
  BEAM_RIBBON_KEYS.params.topElevationEnd,
  BEAM_RIBBON_KEYS.params.flangeThickness,
  BEAM_RIBBON_KEYS.params.webThickness,
];

export const BEAM_RIBBON_STRING_KEYS: readonly BeamRibbonStringCommandKey[] = [
  BEAM_RIBBON_KEYS.stringParams.kind,
  BEAM_RIBBON_KEYS.stringParams.supportType,
  BEAM_RIBBON_KEYS.stringParams.material,
  BEAM_RIBBON_KEYS.stringParams.sectionType,
  BEAM_RIBBON_KEYS.stringParams.profileDesignation,
  BEAM_RIBBON_KEYS.stringParams.envelopeFunction,
  BEAM_RIBBON_KEYS.stringParams.sectionKind,
  BEAM_RIBBON_KEYS.stringParams.catalogProfile,
];

export const BEAM_RIBBON_KEYS_ACTIONS = {
  close: 'beam.actions.close',
  delete: 'beam.actions.delete',
  // ADR-441 Slice GEN-BEAM — one-shot «Δοκάρια από κάναβο» (στα segments, δεν θέλει επιλογή).
  fromGrid: 'beam.actions.fromGrid',
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

// ─── ADR-449 Slice 5 — structural finish (σοβάς) per-element override ──────────

/** Command keys για τα 4 finish πεδία του δοκαριού (enabled/υλικά/πάχος). */
export const BEAM_FINISH_KEYS = {
  enabled: 'beam.params.finish.enabled',
  interiorMaterialId: 'beam.params.finish.interiorMaterialId',
  exteriorMaterialId: 'beam.params.finish.exteriorMaterialId',
  thickness: 'beam.params.finish.thickness',
} as const;

/** commandKey → πεδίο του `StructuralFinishSpec` (καταναλώνεται από finish-param helpers). */
export const BEAM_FINISH_KEY_TO_FIELD: Readonly<Record<string, FinishParamField>> = {
  [BEAM_FINISH_KEYS.enabled]: 'enabled',
  [BEAM_FINISH_KEYS.interiorMaterialId]: 'interiorMaterialId',
  [BEAM_FINISH_KEYS.exteriorMaterialId]: 'exteriorMaterialId',
  [BEAM_FINISH_KEYS.thickness]: 'thickness',
};

const BEAM_FINISH_KEY_SET: ReadonlySet<string> = new Set<string>(Object.keys(BEAM_FINISH_KEY_TO_FIELD));

export function isBeamFinishKey(commandKey: string): boolean {
  return BEAM_FINISH_KEY_SET.has(commandKey);
}
