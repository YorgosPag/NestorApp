/**
 * ADR-408 Φ8 — MEP segment (σωλήνας / αεραγωγός) contextual ribbon command-key
 * registry. ONE tab covers both domains (duct + pipe).
 *
 * Centralizes the `commandKey` strings shared between the ribbon data declaration
 * (`contextual-mep-segment-tab.ts`) and the bridge mappings
 * (`useRibbonMepSegmentBridge`). Mirrors `MEP_FIXTURE_RIBBON_KEYS`.
 *
 * `domain` ('duct'/'pipe') is deliberately NOT editable in this slice (it drives
 * discipline / IFC class / BOQ code). Instead it gates the section-shape choice
 * (a pipe is always round) via `domainAllowsSectionChoice`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ8
 */

export const MEP_SEGMENT_RIBBON_KEYS = {
  stringParams: {
    /** Cross-section profile selector (rectangular / round). */
    sectionKind: 'mepSegment.params.sectionKind',
    /** ADR-408 Φ14 — plumbing classification (cold/hot/drainage), pipe only. */
    classification: 'mepSegment.params.classification',
  },
  params: {
    /** mm — section width (rectangular only). */
    width: 'mepSegment.params.width',
    /** mm — section height (rectangular only). */
    height: 'mepSegment.params.height',
    /** mm — outer diameter (round only). */
    diameter: 'mepSegment.params.diameter',
    /** mm — centreline ("Middle Elevation"): edits BOTH endpoint z's (whole-run lift). */
    centerlineElevation: 'mepSegment.params.centerlineElevation',
    /** mm — start-endpoint elevation (Φ-A, per-endpoint riser/slope). */
    startElevation: 'mepSegment.params.startElevation',
    /** mm — end-endpoint elevation (Φ-A, per-endpoint riser/slope). */
    endElevation: 'mepSegment.params.endElevation',
    /** % — gravity fall along the run (ADR-408 Φ14, pipe only). */
    slopePercent: 'mepSegment.params.slopePercent',
  },
} as const;

export type MepSegmentRibbonNumberCommandKey =
  | typeof MEP_SEGMENT_RIBBON_KEYS.params.width
  | typeof MEP_SEGMENT_RIBBON_KEYS.params.height
  | typeof MEP_SEGMENT_RIBBON_KEYS.params.diameter
  | typeof MEP_SEGMENT_RIBBON_KEYS.params.centerlineElevation
  | typeof MEP_SEGMENT_RIBBON_KEYS.params.startElevation
  | typeof MEP_SEGMENT_RIBBON_KEYS.params.endElevation
  | typeof MEP_SEGMENT_RIBBON_KEYS.params.slopePercent;

export type MepSegmentRibbonStringCommandKey =
  | typeof MEP_SEGMENT_RIBBON_KEYS.stringParams.sectionKind
  | typeof MEP_SEGMENT_RIBBON_KEYS.stringParams.classification;

export const MEP_SEGMENT_RIBBON_NUMBER_KEYS: readonly MepSegmentRibbonNumberCommandKey[] = [
  MEP_SEGMENT_RIBBON_KEYS.params.width,
  MEP_SEGMENT_RIBBON_KEYS.params.height,
  MEP_SEGMENT_RIBBON_KEYS.params.diameter,
  MEP_SEGMENT_RIBBON_KEYS.params.centerlineElevation,
  MEP_SEGMENT_RIBBON_KEYS.params.startElevation,
  MEP_SEGMENT_RIBBON_KEYS.params.endElevation,
  MEP_SEGMENT_RIBBON_KEYS.params.slopePercent,
];

export const MEP_SEGMENT_RIBBON_STRING_KEYS: readonly MepSegmentRibbonStringCommandKey[] = [
  MEP_SEGMENT_RIBBON_KEYS.stringParams.sectionKind,
  MEP_SEGMENT_RIBBON_KEYS.stringParams.classification,
];

export const MEP_SEGMENT_RIBBON_KEYS_ACTIONS = {
  close: 'mepSegment.actions.close',
  delete: 'mepSegment.actions.delete',
} as const;

const MEP_SEGMENT_ACTION_KEY_SET: ReadonlySet<string> = new Set<string>(
  Object.values(MEP_SEGMENT_RIBBON_KEYS_ACTIONS),
);

export function isMepSegmentActionKey(action: string): boolean {
  return MEP_SEGMENT_ACTION_KEY_SET.has(action);
}

/**
 * Panel visibility keys (driven by effective section/domain):
 *   - `domainAllowsSectionChoice`: section-kind selector visible iff `domain ===
 *     'duct'` (a pipe is always round — no choice to offer).
 *   - `rectangularSection`: width + height visible iff effective section is
 *     rectangular.
 *   - `roundSection`: diameter visible iff effective section is round.
 */
export const MEP_SEGMENT_RIBBON_VISIBILITY_KEYS = {
  domainAllowsSectionChoice: 'mepSegment.visibility.domainAllowsSectionChoice',
  rectangularSection: 'mepSegment.visibility.rectangularSection',
  roundSection: 'mepSegment.visibility.roundSection',
  /** ADR-408 Φ14 — classification + slope panel, visible iff `domain === 'pipe'`. */
  pipeDomain: 'mepSegment.visibility.pipeDomain',
} as const;

export type MepSegmentRibbonVisibilityKey =
  | typeof MEP_SEGMENT_RIBBON_VISIBILITY_KEYS.domainAllowsSectionChoice
  | typeof MEP_SEGMENT_RIBBON_VISIBILITY_KEYS.rectangularSection
  | typeof MEP_SEGMENT_RIBBON_VISIBILITY_KEYS.roundSection
  | typeof MEP_SEGMENT_RIBBON_VISIBILITY_KEYS.pipeDomain;

const MEP_SEGMENT_VISIBILITY_KEY_SET: ReadonlySet<string> = new Set<string>([
  MEP_SEGMENT_RIBBON_VISIBILITY_KEYS.domainAllowsSectionChoice,
  MEP_SEGMENT_RIBBON_VISIBILITY_KEYS.rectangularSection,
  MEP_SEGMENT_RIBBON_VISIBILITY_KEYS.roundSection,
  MEP_SEGMENT_RIBBON_VISIBILITY_KEYS.pipeDomain,
]);

export function isMepSegmentVisibilityKey(
  key: string,
): key is MepSegmentRibbonVisibilityKey {
  return MEP_SEGMENT_VISIBILITY_KEY_SET.has(key);
}

// ─── Type guards (used by useRibbonCommands composer) ────────────────────────

const MEP_SEGMENT_NUMBER_KEY_SET: ReadonlySet<string> = new Set<string>(
  MEP_SEGMENT_RIBBON_NUMBER_KEYS,
);
const MEP_SEGMENT_STRING_KEY_SET: ReadonlySet<string> = new Set<string>(
  MEP_SEGMENT_RIBBON_STRING_KEYS,
);

export function isMepSegmentRibbonKey(commandKey: string): boolean {
  return MEP_SEGMENT_NUMBER_KEY_SET.has(commandKey);
}

export function isMepSegmentRibbonStringKey(commandKey: string): boolean {
  return MEP_SEGMENT_STRING_KEY_SET.has(commandKey);
}
