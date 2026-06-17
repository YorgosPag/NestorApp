/**
 * ADR-449 Slice 5 — master view-level gate «Σοβατισμένη όψη» (structural finish skin).
 *
 * ΕΝΑ SSoT σημείο που διαβάζουν ΚΑΙ ο 2D orchestrator (`DxfRenderer.render`) ΚΑΙ ο
 * 3D converter (`bim-three-structural-converters`): non-React, event-time read του
 * per-view flag `showFinishSkin` (Revit visibility-only semantics — καθαρά display·
 * το BOQ μετράει πάντα όταν `finish.enabled`, schedule = model, όχι view).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md
 */

import { isStructuralComponentVisible } from '../visibility/structural-component-visibility';

/**
 * True όταν ο σοβάς πρέπει να προβάλλεται (default ON). Event-time, μηδέν subscription.
 *
 * ADR-469 — thin alias του ενοποιημένου resolver (`component='plaster'`, view-level):
 * διατηρείται για back-compat στα ~6 call-sites. Για per-element ορατότητα οι callers
 * καλούν απευθείας `isStructuralComponentVisible('plaster', entity)`.
 */
export function isStructuralFinishVisible(): boolean {
  return isStructuralComponentVisible('plaster');
}
