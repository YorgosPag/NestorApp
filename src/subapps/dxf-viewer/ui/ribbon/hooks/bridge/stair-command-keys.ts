/**
 * ADR-358 Phase 7a — Stair contextual ribbon command-key registry.
 *
 * Centralizes the `commandKey` strings shared between the ribbon data
 * declaration (`contextual-stair-tab.ts`) and the bridge mappings
 * (`useRibbonStairBridge`). Mirrors `ARRAY_RIBBON_KEYS` pattern from
 * the array editor bridge.
 */

export const STAIR_RIBBON_KEYS = {
  stringParams: {
    structureType: 'stair.params.structureType',
    riserType: 'stair.params.riserType',
    /**
     * ADR-358 Phase 7b2b-β Stream F — multi-flight turn direction.
     * For `l-shape`/`u-shape` (2 flights) → `variant.turnDirection`.
     * For `gamma` (3 flights, 2 turns) → `variant.turnSequence[0]`.
     */
    flight2TurnDirection: 'stair.params.flight2TurnDirection',
    /**
     * ADR-358 Phase 7b2b-β Stream F — flight 3 turn direction.
     * Only applies to `gamma` (`variant.turnSequence[1]`). No-op for other kinds.
     */
    flight3TurnDirection: 'stair.params.flight3TurnDirection',
    /**
     * ADR-358 Phase 3d — discriminated variant kind selector. Reads
     * `variant.kind`; writes a fresh variant of the target kind seeded with
     * defaults from `buildDefaultVariantFor` (kind-specific previous fields
     * are discarded — Revit "Family Type" swap convention).
     */
    variantKind: 'stair.params.variantKind',
    /**
     * ADR-358 Phase 3f — l-shape corner sub-style discriminator.
     * Reads/writes `variant.cornerStyle` on `l-shape` variant (∈ {'landing','winders'}).
     * No-op for other kinds.
     */
    cornerStyle: 'stair.params.cornerStyle',
    /**
     * ADR-358 Phase 3f — winder method for l-shape with winders.
     * Reads/writes `variant.winderMethod` (∈ {'equal-going','pie'}; 'kite'/'balanced'
     * throw Phase 4c sentinel).
     */
    winderMethod: 'stair.params.winderMethod',
    /**
     * ADR-358 Phase 3g — NOK stair scope selector (Άρθρο 13 Κτιριοδομικού).
     * Reads/writes `nokSubType` ∈ {'main','low-rise','internal','auxiliary'}.
     * Drives legal + comfort width thresholds in `gateStairChecker.checkNOK`.
     * Visible only when `codeProfile === 'nok'`.
     */
    nokSubType: 'stair.params.nokSubType',
  },
  params: {
    rise: 'stair.params.rise',
    tread: 'stair.params.tread',
    width: 'stair.params.width',
    stepCount: 'stair.params.stepCount',
    storyCount: 'stair.params.storyCount',
    storyHeight: 'stair.params.storyHeight',
    /**
     * ADR-358 Phase 3f — winder count for l-shape with winders. Numeric
     * combobox 1-5 (NOK quarter-turn default 3). Recomputes `flightSplit`
     * so `n1 + winderCount + n2 = stepCount` invariant holds.
     */
    winderCount: 'stair.params.winderCount',
  },
  actions: {
    close: 'stair.actions.close',
  },
} as const;

/**
 * ADR-358 Phase 7b2b-β Stream F + Phase 9B-3 — panel visibility keys
 * consumed by `RibbonPanelDef.visibilityKey`.
 *
 * - `multiFlight`: visible iff `variant.kind ∈ {l-shape, u-shape, gamma}`.
 * - `multiStoryHeightEditor`: visible iff stair is NOT linked to a floor
 *   (free mode). When linked, `storyHeight` is governed by the floor and
 *   shown read-only in the floor info widget; the editable combobox hides
 *   to remove the duplicate "Ύψος" surface (Phase 9B-3 UX fix).
 */
export const STAIR_RIBBON_VISIBILITY_KEYS = {
  multiFlight: 'stair.visibility.multiFlight',
  multiStoryHeightEditor: 'stair.visibility.multiStoryHeightEditor',
  /**
   * ADR-358 Phase 3f — visible iff `variant.kind === 'l-shape'`. Surfaces
   * the cornerStyle combobox (landing | winders) as a sub-option of L-shape.
   */
  lShapeCorner: 'stair.visibility.lShapeCorner',
  /**
   * ADR-358 Phase 3f — visible iff `variant.kind === 'l-shape' && cornerStyle === 'winders'`.
   * Surfaces the winderCount + winderMethod editors only when relevant.
   */
  lShapeWindersParams: 'stair.visibility.lShapeWindersParams',
} as const;

export type StairRibbonComboKey =
  | typeof STAIR_RIBBON_KEYS.params.rise
  | typeof STAIR_RIBBON_KEYS.params.tread
  | typeof STAIR_RIBBON_KEYS.params.width
  | typeof STAIR_RIBBON_KEYS.params.stepCount
  | typeof STAIR_RIBBON_KEYS.params.storyCount
  | typeof STAIR_RIBBON_KEYS.params.storyHeight
  | typeof STAIR_RIBBON_KEYS.params.winderCount;

export type StairRibbonStringComboKey =
  | typeof STAIR_RIBBON_KEYS.stringParams.structureType
  | typeof STAIR_RIBBON_KEYS.stringParams.riserType
  | typeof STAIR_RIBBON_KEYS.stringParams.flight2TurnDirection
  | typeof STAIR_RIBBON_KEYS.stringParams.flight3TurnDirection
  | typeof STAIR_RIBBON_KEYS.stringParams.variantKind
  | typeof STAIR_RIBBON_KEYS.stringParams.cornerStyle
  | typeof STAIR_RIBBON_KEYS.stringParams.winderMethod
  | typeof STAIR_RIBBON_KEYS.stringParams.nokSubType;

export type StairRibbonVisibilityKey =
  | typeof STAIR_RIBBON_VISIBILITY_KEYS.multiFlight
  | typeof STAIR_RIBBON_VISIBILITY_KEYS.multiStoryHeightEditor
  | typeof STAIR_RIBBON_VISIBILITY_KEYS.lShapeCorner
  | typeof STAIR_RIBBON_VISIBILITY_KEYS.lShapeWindersParams;

const ALL_STAIR_COMBO_KEYS: ReadonlySet<string> = new Set<string>([
  STAIR_RIBBON_KEYS.params.rise,
  STAIR_RIBBON_KEYS.params.tread,
  STAIR_RIBBON_KEYS.params.width,
  STAIR_RIBBON_KEYS.params.stepCount,
  STAIR_RIBBON_KEYS.params.storyCount,
  STAIR_RIBBON_KEYS.params.storyHeight,
  STAIR_RIBBON_KEYS.params.winderCount,
]);

const ALL_STAIR_STRING_COMBO_KEYS: ReadonlySet<string> = new Set<string>([
  STAIR_RIBBON_KEYS.stringParams.structureType,
  STAIR_RIBBON_KEYS.stringParams.riserType,
  STAIR_RIBBON_KEYS.stringParams.flight2TurnDirection,
  STAIR_RIBBON_KEYS.stringParams.flight3TurnDirection,
  STAIR_RIBBON_KEYS.stringParams.variantKind,
  STAIR_RIBBON_KEYS.stringParams.cornerStyle,
  STAIR_RIBBON_KEYS.stringParams.winderMethod,
  STAIR_RIBBON_KEYS.stringParams.nokSubType,
]);

const ALL_STAIR_VISIBILITY_KEYS: ReadonlySet<string> = new Set<string>([
  STAIR_RIBBON_VISIBILITY_KEYS.multiFlight,
  STAIR_RIBBON_VISIBILITY_KEYS.multiStoryHeightEditor,
  STAIR_RIBBON_VISIBILITY_KEYS.lShapeCorner,
  STAIR_RIBBON_VISIBILITY_KEYS.lShapeWindersParams,
]);

export function isStairRibbonKey(key: string): key is StairRibbonComboKey {
  return ALL_STAIR_COMBO_KEYS.has(key);
}

export function isStairRibbonStringKey(key: string): key is StairRibbonStringComboKey {
  return ALL_STAIR_STRING_COMBO_KEYS.has(key);
}

export function isStairVisibilityKey(key: string): key is StairRibbonVisibilityKey {
  return ALL_STAIR_VISIBILITY_KEYS.has(key);
}
