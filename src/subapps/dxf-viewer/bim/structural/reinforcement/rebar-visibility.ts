/**
 * ADR-456 Slice 3 — master view-level gate «Οπλισμός» (rebar visibility).
 *
 * ΕΝΑ SSoT σημείο που διαβάζουν ΚΑΙ ο 2D orchestrator (`DxfRenderer.render`) ΚΑΙ ο
 * 3D converter (`bim-three-structural-converters`): non-React, event-time read του
 * per-view flag `showReinforcement` (Revit visibility-only — καθαρά display· το
 * schedule/BOQ μετράει πάντα τον οπλισμό όταν οριστεί). Mirror του
 * `isStructuralFinishVisible` (ADR-449).
 *
 * Opt-in: default OFF (ο οπλισμός είναι λεπτομέρεια — δείχνεται όταν ζητηθεί).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-456-structural-quantities-reinforcement.md
 */

import { isStructuralComponentVisible } from '../../visibility/structural-component-visibility';

/**
 * True όταν ο οπλισμός πρέπει να προβάλλεται (default OFF). Event-time, μηδέν subscription.
 *
 * ADR-469 — thin alias του ενοποιημένου resolver (`component='reinforcement'`,
 * view-level): διατηρείται για back-compat. Για per-element ορατότητα οι callers
 * καλούν απευθείας `isStructuralComponentVisible('reinforcement', entity)`.
 */
export function isReinforcementVisible(): boolean {
  return isStructuralComponentVisible('reinforcement');
}
