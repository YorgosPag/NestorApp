/**
 * ADR-363 Phase 2 — Opening contextual ribbon command-key registry.
 *
 * Centralizes the `commandKey` strings shared μεταξύ ribbon data declaration
 * (`contextual-opening-tab.ts`) και bridge mappings (`useRibbonOpeningBridge`).
 * Mirrors `WALL_RIBBON_KEYS` pattern.
 */

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

export const OPENING_RIBBON_KEYS_ACTIONS = {
  close: 'opening.actions.close',
  delete: 'opening.actions.delete',
  /** ADR-376 Phase B.1 — Open the Renumber Openings dialog. */
  renumber: 'opening.actions.renumber',
} as const;

const OPENING_ACTION_KEY_SET: ReadonlySet<string> = new Set<string>(
  Object.values(OPENING_RIBBON_KEYS_ACTIONS),
);

export function isOpeningActionKey(action: string): boolean {
  return OPENING_ACTION_KEY_SET.has(action);
}

/** Visibility key (red badge when `validation.hasCodeViolations === true`). */
export const OPENING_RIBBON_BADGE_KEYS = {
  violations: 'opening.badge.violations',
} as const;

// ─── Type guards (used by useRibbonCommands composer) ────────────────────────

const OPENING_NUMBER_KEY_SET: ReadonlySet<string> = new Set<string>(OPENING_RIBBON_NUMBER_KEYS);
const OPENING_STRING_KEY_SET: ReadonlySet<string> = new Set<string>(OPENING_RIBBON_STRING_KEYS);

export function isOpeningRibbonKey(commandKey: string): boolean {
  return OPENING_NUMBER_KEY_SET.has(commandKey);
}

export function isOpeningRibbonStringKey(commandKey: string): boolean {
  return OPENING_STRING_KEY_SET.has(commandKey);
}
