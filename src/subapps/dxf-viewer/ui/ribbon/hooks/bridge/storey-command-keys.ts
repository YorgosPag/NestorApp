/**
 * ADR-451 Slice 4 — Storey ribbon command-key registry (zero-dep).
 *
 * Χωριστά από το `storey-height-bridge` (που τραβά gateway/store) ώστε το tab data
 * (`contextual-column-tab`) να εισάγει ΜΟΝΟ το key constant — mirror του
 * `column-command-keys` pattern.
 */

import { makeKeySetGuard } from './make-key-set-guard';

export const STOREY_RIBBON_KEYS = {
  /** mm — ύψος του ΕΝΕΡΓΟΥ ορόφου (γράφει `floors/{id}.height`, σε μέτρα). */
  height: 'storey.params.height',
} as const;

export const isStoreyRibbonKey = makeKeySetGuard(Object.values(STOREY_RIBBON_KEYS));
