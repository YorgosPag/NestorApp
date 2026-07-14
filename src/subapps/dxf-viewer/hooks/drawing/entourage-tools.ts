/**
 * ADR-654 M6 — Τα δύο entourage placement tools (People, Vehicles) από το ΚΟΙΝΟ factory.
 *
 * Ένα αρχείο, δύο instances ⇒ μηδέν near-identical clone (N.18). Καθένα δένει τον per-family
 * selection store + placer + τα i18n κλειδιά κατάστασης/σφαλμάτων.
 *
 * @see ./create-entourage-tool.ts — το factory (wraps createSingleClickPlacementTool)
 */

import { createEntourageTool } from './create-entourage-tool';
import {
  peoplePlanSelection,
  vehiclesPlanSelection,
  plantsPlanSelection,
} from '../../bim/entourage/entourage-selection-stores';
import {
  peoplePlanPlacer,
  vehiclesPlanPlacer,
  plantsPlanPlacer,
} from '../../bim/entourage/entourage-placers';

/** Single-click τοποθέτηση ανθρώπου κάτοψης (ImageEntity). */
export const usePeoplePlanTool = createEntourageTool({
  selection: peoplePlanSelection,
  placer: peoplePlanPlacer,
  statusPositionKey: 'tools.peoplePlan.statusPosition',
  errorNoSelectionKey: 'tools.peoplePlan.errorNoSelection',
  errorUnknownItemKey: 'tools.peoplePlan.errorUnknownItem',
});

/** Single-click τοποθέτηση οχήματος κάτοψης (ImageEntity). */
export const useVehiclesPlanTool = createEntourageTool({
  selection: vehiclesPlanSelection,
  placer: vehiclesPlanPlacer,
  statusPositionKey: 'tools.vehiclePlan.statusPosition',
  errorNoSelectionKey: 'tools.vehiclePlan.errorNoSelection',
  errorUnknownItemKey: 'tools.vehiclePlan.errorUnknownItem',
});

/** Single-click τοποθέτηση φυτού κάτοψης (ImageEntity). */
export const usePlantsPlanTool = createEntourageTool({
  selection: plantsPlanSelection,
  placer: plantsPlanPlacer,
  statusPositionKey: 'tools.plantsPlan.statusPosition',
  errorNoSelectionKey: 'tools.plantsPlan.errorNoSelection',
  errorUnknownItemKey: 'tools.plantsPlan.errorUnknownItem',
});
