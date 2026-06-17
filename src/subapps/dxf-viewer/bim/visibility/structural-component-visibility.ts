/**
 * ADR-470 — Structural Component Visibility resolver SSoT (2D + 3D).
 *
 * ΕΝΑ σημείο που αποφασίζει αν ένα visual component (σώμα/σοβάς/οπλισμός) ενός
 * δομικού στοιχείου πρέπει να προβάλλεται. Revit precedence:
 *
 *   ① per-element override  (`entity.styleOverride.componentVisibility[component]`)
 *   ② per-view flag         (`showStructuralCore` / `showFinishSkin` / `showReinforcement`)
 *   ③ default               (core ON · plaster ON · reinforcement OFF)
 *
 * Pure, non-React, event-time read (ADR-040: μηδέν subscriptions). Το `entity`
 * είναι προαιρετικό — όταν λείπει (π.χ. scene-level pass χωρίς element context),
 * ισχύει μόνο το per-view επίπεδο.
 *
 * Τα legacy `isStructuralFinishVisible` (ADR-449) / `isReinforcementVisible`
 * (ADR-456) είναι πλέον thin aliases αυτού του resolver (component='plaster' /
 * 'reinforcement', χωρίς element) → μηδέν αλλαγή στα υπάρχοντα call-sites.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-470-structural-component-visibility.md
 */

import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import {
  STRUCTURAL_COMPONENT_DEFAULT_VISIBLE,
  type StructuralComponent,
} from '../../config/bim-structural-components';
import type { BimElementStyleOverride } from '../../config/bim-object-styles';

/** Ελάχιστο σχήμα entity που κουβαλά το προαιρετικό per-element override. */
export interface ComponentVisibilityEntity {
  readonly styleOverride?: BimElementStyleOverride;
}

/** Per-view ορατότητα ενός component (event-time read του store SSoT). */
function viewLevelVisible(component: StructuralComponent): boolean {
  const s = useBimRenderSettingsStore.getState();
  switch (component) {
    case 'core':
      return s.showStructuralCore ?? STRUCTURAL_COMPONENT_DEFAULT_VISIBLE.core;
    case 'plaster':
      return s.showFinishSkin ?? STRUCTURAL_COMPONENT_DEFAULT_VISIBLE.plaster;
    case 'reinforcement':
      return s.showReinforcement ?? STRUCTURAL_COMPONENT_DEFAULT_VISIBLE.reinforcement;
  }
}

/**
 * True όταν το `component` του στοιχείου πρέπει να προβάλλεται.
 * Precedence: element override → view-level flag → default.
 */
export function isStructuralComponentVisible(
  component: StructuralComponent,
  entity?: ComponentVisibilityEntity | null,
): boolean {
  const override = entity?.styleOverride?.componentVisibility?.[component];
  if (override !== undefined) return override;
  return viewLevelVisible(component);
}
