/**
 * ADR-451 Slice 4 — Storey ribbon command-key registry (zero-dep).
 *
 * Χωριστά από το `storey-height-bridge` (που τραβά gateway/store) ώστε το tab data
 * (`contextual-column-tab`) να εισάγει ΜΟΝΟ το key constant — mirror του
 * `column-command-keys` pattern.
 */

export const STOREY_RIBBON_KEYS = {
  /** mm — ύψος του ΕΝΕΡΓΟΥ ορόφου (γράφει `floors/{id}.height`, σε μέτρα). */
  height: 'storey.params.height',
} as const;

const STOREY_KEY_SET: ReadonlySet<string> = new Set<string>(Object.values(STOREY_RIBBON_KEYS));

export function isStoreyRibbonKey(commandKey: string): boolean {
  return STOREY_KEY_SET.has(commandKey);
}
