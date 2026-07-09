/**
 * ADR-363 Phase 2 — Opening contextual ribbon command-key registry.
 *
 * Centralizes the `commandKey` strings shared μεταξύ ribbon data declaration
 * (`contextual-opening-tab.ts`) και bridge mappings (`useRibbonOpeningBridge`).
 * Mirrors `WALL_RIBBON_KEYS` pattern.
 */

import { makeKeySetGuard } from './make-key-set-guard';

/**
 * ADR-615 — commandKey / `activeTool` literal for the free-standing (self-hosted)
 * opening placement tool («Ελεύθερη τοποθέτηση κουφώματος»). Mirrors the plain
 * `'opening'` / `'slab-opening'` tool-activation literals already inlined in
 * `structural-tab.ts` (`toolBtn(...)`) — this is the ONE string shared between
 * the ribbon descriptor (consumer: `structural-tab.ts`) and the future placement
 * tool's activation gate (`useSpecialTools`, `activeTool === SELF_OPENING_TOOL_COMMAND_KEY`),
 * so `useSelfOpeningTool` wiring imports it instead of retyping the literal.
 * Foundation-only here — the FSM/hook itself is a later track (see ADR-615 §File plan).
 */
export const SELF_OPENING_TOOL_COMMAND_KEY = 'self-opening' as const;

export const OPENING_RIBBON_KEYS = {
  stringParams: {
    /** Opening kind selector (5 options: door/window/sliding-door/french-door/fixed). */
    kind: 'opening.params.kind',
    /** Door swing handing (left / right). */
    handing: 'opening.params.handing',
    /** Door open direction (inward / outward). */
    openDirection: 'opening.params.openDirection',
    /** ADR-376 Phase A — Instance Mark (free-text, auto-allocated on placement). */
    mark: 'opening.params.mark',
  },
  params: {
    /** mm — opening width along host wall axis. */
    width: 'opening.params.width',
    /** mm — opening height (sill to head). */
    height: 'opening.params.height',
    /** mm — sill height above floor. */
    sillHeight: 'opening.params.sillHeight',
  },
  /**
   * ADR-611 — Frame profile (διατομή κάσας) editor. Cascading manufacturer →
   * profile/series selects plus the two editable, CONSTANT cross-section
   * dims. Kept as its own group (not merged into `params`/`stringParams`)
   * because these keys route through the dedicated
   * `opening-frame-profile-bridge.ts` resolver, not the flat field maps below.
   */
  frameProfile: {
    /** Manufacturer brand select — cascading filter for `profile` below (not itself persisted). */
    manufacturer: 'opening.params.frameProfileManufacturer',
    /** Catalog profile/series select — writes `params.frameProfileId`. */
    profile: 'opening.params.frameProfileId',
    /** mm — visible frame face width (elevation). CONSTANT vs opening size. */
    faceWidth: 'opening.params.frameProfileFaceWidth',
    /** mm — frame depth through the wall thickness. INDEPENDENT of wall.thickness. */
    depth: 'opening.params.frameProfileDepth',
  },
} as const;

export type OpeningRibbonNumberCommandKey =
  | typeof OPENING_RIBBON_KEYS.params.width
  | typeof OPENING_RIBBON_KEYS.params.height
  | typeof OPENING_RIBBON_KEYS.params.sillHeight;

export type OpeningRibbonStringCommandKey =
  | typeof OPENING_RIBBON_KEYS.stringParams.kind
  | typeof OPENING_RIBBON_KEYS.stringParams.handing
  | typeof OPENING_RIBBON_KEYS.stringParams.openDirection
  | typeof OPENING_RIBBON_KEYS.stringParams.mark;

export type OpeningFrameProfileCommandKey =
  | typeof OPENING_RIBBON_KEYS.frameProfile.manufacturer
  | typeof OPENING_RIBBON_KEYS.frameProfile.profile
  | typeof OPENING_RIBBON_KEYS.frameProfile.faceWidth
  | typeof OPENING_RIBBON_KEYS.frameProfile.depth;

export const OPENING_RIBBON_NUMBER_KEYS: readonly OpeningRibbonNumberCommandKey[] = [
  OPENING_RIBBON_KEYS.params.width,
  OPENING_RIBBON_KEYS.params.height,
  OPENING_RIBBON_KEYS.params.sillHeight,
];

export const OPENING_RIBBON_STRING_KEYS: readonly OpeningRibbonStringCommandKey[] = [
  OPENING_RIBBON_KEYS.stringParams.kind,
  OPENING_RIBBON_KEYS.stringParams.handing,
  OPENING_RIBBON_KEYS.stringParams.openDirection,
  OPENING_RIBBON_KEYS.stringParams.mark,
];

/** ADR-611 — the 4 frame-profile editor keys (manufacturer/profile/faceWidth/depth). */
export const OPENING_FRAME_PROFILE_KEYS: readonly OpeningFrameProfileCommandKey[] = [
  OPENING_RIBBON_KEYS.frameProfile.manufacturer,
  OPENING_RIBBON_KEYS.frameProfile.profile,
  OPENING_RIBBON_KEYS.frameProfile.faceWidth,
  OPENING_RIBBON_KEYS.frameProfile.depth,
];

/** ADR-376 Phase C.2+ — Per-project tag style keys (combobox + toggle). */
export const OPENING_TAG_STYLE_KEYS = {
  fontSizePx:    'opening.tagStyle.fontSizePx',
  borderWidthPx: 'opening.tagStyle.borderWidthPx',
  leaderStyle:   'opening.tagStyle.leaderStyle',
  pillBgColor:   'opening.tagStyle.pillBgColor',
  leaderColor:   'opening.tagStyle.leaderColor',
  leaderVisible: 'opening.tagStyle.leaderVisible',
} as const;

export type OpeningTagStyleComboboxKey =
  | typeof OPENING_TAG_STYLE_KEYS.fontSizePx
  | typeof OPENING_TAG_STYLE_KEYS.borderWidthPx
  | typeof OPENING_TAG_STYLE_KEYS.leaderStyle
  | typeof OPENING_TAG_STYLE_KEYS.pillBgColor
  | typeof OPENING_TAG_STYLE_KEYS.leaderColor;

export const isOpeningTagStyleComboboxKey = makeKeySetGuard([
  OPENING_TAG_STYLE_KEYS.fontSizePx,
  OPENING_TAG_STYLE_KEYS.borderWidthPx,
  OPENING_TAG_STYLE_KEYS.leaderStyle,
  OPENING_TAG_STYLE_KEYS.pillBgColor,
  OPENING_TAG_STYLE_KEYS.leaderColor,
]);

export const OPENING_RIBBON_KEYS_ACTIONS = {
  close: 'opening.actions.close',
  delete: 'opening.actions.delete',
  /** ADR-376 Phase B.1 — Open the Renumber Openings dialog. */
  renumber: 'opening.actions.renumber',
  /** ADR-376 Phase C.1 — Reset draggable tag offset back to auto-centroid. */
  resetTagPosition: 'opening.actions.resetTagPosition',
  /** ADR-376 Phase C.2 — Open the per-project Tag Style dialog. */
  openTagStyle: 'opening.actions.openTagStyle',
  /** ADR-376 Phase C.3 — Export opening schedule as PDF (doors + windows). */
  exportSchedulePdf: 'opening.actions.exportSchedulePdf',
} as const;

export const isOpeningTagStyleToggleKey = makeKeySetGuard([
  OPENING_TAG_STYLE_KEYS.leaderVisible,
]);

export const isOpeningActionKey = makeKeySetGuard([
  ...Object.values(OPENING_RIBBON_KEYS_ACTIONS),
]);

/** Visibility key (red badge when `validation.hasCodeViolations === true`). */
export const OPENING_RIBBON_BADGE_KEYS = {
  violations: 'opening.badge.violations',
} as const;

// ─── Type guards (used by useRibbonCommands composer) ────────────────────────

export const isOpeningRibbonKey = makeKeySetGuard(OPENING_RIBBON_NUMBER_KEYS);
export const isOpeningRibbonStringKey = makeKeySetGuard(OPENING_RIBBON_STRING_KEYS);

/** ADR-611 — guard for the frame-profile editor's 4 commandKeys. */
export const isOpeningFrameProfileKey = makeKeySetGuard(OPENING_FRAME_PROFILE_KEYS);

// ─── ADR-421 SLICE C follow-up (a): type-aware gating ────────────────────────

/**
 * Ribbon comboboxes whose value is owned by the assigned opening **Type**
 * (Revit: type params render read-only on the instance — edit via «Edit type»).
 * SSoT for {@link useRibbonOpeningBridge} gating.
 *
 * Membership follows the locked Revit split (ADR-421): the TYPE owns
 * `kind` / `width` / `height` (mirrors the overridable subset
 * `OPENING_OVERRIDABLE_KEYS` in `family-type-ui-helpers`, plus `kind` which is
 * type-governed but switches the family rather than being overridable). The
 * INSTANCE owns `sillHeight` / `handing` / `openDirection` / `mark`, so those
 * stay fully editable on a typed opening (zero regression for untyped openings).
 */
export const isOpeningTypeGovernedComboboxKey = makeKeySetGuard([
  OPENING_RIBBON_KEYS.stringParams.kind,
  OPENING_RIBBON_KEYS.params.width,
  OPENING_RIBBON_KEYS.params.height,
]);
