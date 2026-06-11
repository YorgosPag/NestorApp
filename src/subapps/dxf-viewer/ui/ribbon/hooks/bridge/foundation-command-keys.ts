/**
 * ADR-436 Slice 1 — Foundation ribbon command-key registry.
 *
 * Central string-constant registry shared μεταξύ του contextual foundation tab
 * data (`contextual-foundation-tab.ts`) και του bridge hook
 * (`useRibbonFoundationBridge.ts`). Mirror του `column-command-keys.ts`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md §6
 */

export const FOUNDATION_RIBBON_KEYS = {
  stringParams: {
    kind: 'foundation.params.kind',
    anchor: 'foundation.params.anchor',
    material: 'foundation.params.material',
    // ADR-441 Slice 5a-control — Location Line (justification) γραμμικού πεδίλου/συνδετήριας.
    justification: 'foundation.params.justification',
  },
  params: {
    width: 'foundation.params.width',
    length: 'foundation.params.length',
    thickness: 'foundation.params.thickness',
    rotation: 'foundation.params.rotation',
    topElevation: 'foundation.params.topElevation',
  },
} as const;

export type FoundationRibbonNumberCommandKey =
  (typeof FOUNDATION_RIBBON_KEYS.params)[keyof typeof FOUNDATION_RIBBON_KEYS.params];

export type FoundationRibbonStringCommandKey =
  (typeof FOUNDATION_RIBBON_KEYS.stringParams)[keyof typeof FOUNDATION_RIBBON_KEYS.stringParams];

export const FOUNDATION_RIBBON_NUMBER_KEYS: readonly FoundationRibbonNumberCommandKey[] = [
  FOUNDATION_RIBBON_KEYS.params.width,
  FOUNDATION_RIBBON_KEYS.params.length,
  FOUNDATION_RIBBON_KEYS.params.thickness,
  FOUNDATION_RIBBON_KEYS.params.rotation,
  FOUNDATION_RIBBON_KEYS.params.topElevation,
];

export const FOUNDATION_RIBBON_STRING_KEYS: readonly FoundationRibbonStringCommandKey[] = [
  FOUNDATION_RIBBON_KEYS.stringParams.kind,
  FOUNDATION_RIBBON_KEYS.stringParams.anchor,
  FOUNDATION_RIBBON_KEYS.stringParams.material,
  FOUNDATION_RIBBON_KEYS.stringParams.justification,
];

export const FOUNDATION_RIBBON_KEYS_ACTIONS = {
  close: 'foundation.actions.close',
  delete: 'foundation.actions.delete',
  // ADR-441 Slice 2 — one-shot «Εσχάρα πεδιλοδοκών από κάναβο» (δεν θέλει επιλογή).
  fromGrid: 'foundation.actions.fromGrid',
} as const;

export const FOUNDATION_RIBBON_BADGE_KEYS = {
  violations: 'foundation.badge.violations',
} as const;

/**
 * ADR-436 Slice 2 — panel visibility keys (kind-conditional). Το kind ορίζεται
 * από το tool id (Revit 3 separate tools)· τα panels εμφανίζονται ανά geometry
 * family: `padOnly` (anchor + length + rotation) vs `lineOnly` (band width).
 */
export const FOUNDATION_RIBBON_VISIBILITY_KEYS = {
  padOnly: 'foundation.visibility.pad',
  lineOnly: 'foundation.visibility.line',
} as const;

export function isFoundationActionKey(action: string): boolean {
  return (
    action === FOUNDATION_RIBBON_KEYS_ACTIONS.close ||
    action === FOUNDATION_RIBBON_KEYS_ACTIONS.delete ||
    action === FOUNDATION_RIBBON_KEYS_ACTIONS.fromGrid
  );
}

export function isFoundationRibbonKey(commandKey: string): boolean {
  return (FOUNDATION_RIBBON_NUMBER_KEYS as readonly string[]).includes(commandKey);
}

export function isFoundationRibbonStringKey(commandKey: string): boolean {
  return (FOUNDATION_RIBBON_STRING_KEYS as readonly string[]).includes(commandKey);
}

export function isFoundationBadgeKey(badgeKey: string): boolean {
  return badgeKey === FOUNDATION_RIBBON_BADGE_KEYS.violations;
}
