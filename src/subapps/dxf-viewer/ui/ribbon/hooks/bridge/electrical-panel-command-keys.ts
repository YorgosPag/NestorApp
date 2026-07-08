/**
 * ADR-408 Φ3/Φ6 — Electrical panel contextual ribbon command-key registry.
 *
 * Centralizes τα `commandKey` strings που μοιράζονται μεταξύ ribbon data
 * declaration (`contextual-electrical-panel-tab.ts`) και bridge mappings
 * (`useRibbonElectricalPanelBridge`). Mirrors `MEP_FIXTURE_RIBBON_KEYS` — ο πίνακας
 * είναι point-based source element με ίδια geometry-editing επιφάνεια (width / length
 * / rotation / body height / mounting elevation), αλλά ΧΩΡΙΣ shape/assetId (το box
 * είναι πάντα rectangular και δεν έχει mesh catalog). Η διαχείριση κυκλωμάτων ΔΕΝ
 * περνά από εδώ — επαναχρησιμοποιεί αυτούσια τα circuit command keys
 * (`mep-circuit-command-keys.ts`) μέσω του folded «Κυκλώματα» panel.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { makeKeySetGuard } from './make-key-set-guard';

export const ELECTRICAL_PANEL_RIBBON_KEYS = {
  params: {
    /** mm — footprint width (panel face along the wall). */
    width: 'electricalPanel.params.width',
    /** mm — footprint length (panel depth into the wall). */
    length: 'electricalPanel.params.length',
    /** deg — rotation about the insertion point (plan). */
    rotation: 'electricalPanel.params.rotation',
    /** mm — vertical height of the panel box (3D vertical extent). */
    bodyHeight: 'electricalPanel.params.bodyHeight',
    /** mm — wall-mounted vertical-centre elevation above FFL. */
    mountingElevation: 'electricalPanel.params.mountingElevation',
  },
} as const;

export type ElectricalPanelRibbonNumberCommandKey =
  | typeof ELECTRICAL_PANEL_RIBBON_KEYS.params.width
  | typeof ELECTRICAL_PANEL_RIBBON_KEYS.params.length
  | typeof ELECTRICAL_PANEL_RIBBON_KEYS.params.rotation
  | typeof ELECTRICAL_PANEL_RIBBON_KEYS.params.bodyHeight
  | typeof ELECTRICAL_PANEL_RIBBON_KEYS.params.mountingElevation;

export const ELECTRICAL_PANEL_RIBBON_NUMBER_KEYS: readonly ElectricalPanelRibbonNumberCommandKey[] = [
  ELECTRICAL_PANEL_RIBBON_KEYS.params.width,
  ELECTRICAL_PANEL_RIBBON_KEYS.params.length,
  ELECTRICAL_PANEL_RIBBON_KEYS.params.rotation,
  ELECTRICAL_PANEL_RIBBON_KEYS.params.bodyHeight,
  ELECTRICAL_PANEL_RIBBON_KEYS.params.mountingElevation,
];

export const ELECTRICAL_PANEL_RIBBON_KEYS_ACTIONS = {
  close: 'electricalPanel.actions.close',
  delete: 'electricalPanel.actions.delete',
} as const;

export const isElectricalPanelActionKey = makeKeySetGuard(
  Object.values(ELECTRICAL_PANEL_RIBBON_KEYS_ACTIONS),
);

/**
 * Panel visibility keys.
 *   - `hasCircuits`: visible iff the selected panel sources ≥1 circuit — surfaces
 *     the folded «Κυκλώματα» management panel (Revit "Edit Circuits").
 */
export const ELECTRICAL_PANEL_RIBBON_VISIBILITY_KEYS = {
  hasCircuits: 'electricalPanel.visibility.hasCircuits',
} as const;

export type ElectricalPanelRibbonVisibilityKey =
  typeof ELECTRICAL_PANEL_RIBBON_VISIBILITY_KEYS.hasCircuits;

export const isElectricalPanelVisibilityKey = makeKeySetGuard<ElectricalPanelRibbonVisibilityKey>([
  ELECTRICAL_PANEL_RIBBON_VISIBILITY_KEYS.hasCircuits,
]);

// ─── Type guards (used by useRibbonCommands composer) ────────────────────────

export const isElectricalPanelRibbonKey = makeKeySetGuard(
  ELECTRICAL_PANEL_RIBBON_NUMBER_KEYS,
);
