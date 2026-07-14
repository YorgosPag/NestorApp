/**
 * ADR-654 M6 — Οι placers των δύο entourage οικογενειών (People, Vehicles) ως module singletons.
 *
 * Ένα αρχείο, δύο instances από το ΚΟΙΝΟ factory ⇒ μηδέν clone (N.18). Καθένας δένει το per-pack
 * size map (`get*PlanSizeMm`) με το δικό του layer. Το layer είναι το ToolType-scoped «ένα κλικ
 * ανοιγοκλείνει ΟΛΗ την οικογένεια».
 *
 * @see ./place-entourage.ts — το factory (mm → scene, κέντρο → γωνία, ghost)
 */

import { createEntouragePlacer, type EntouragePlacer } from './place-entourage';
import { getPeoplePlanSizeMm } from '../../data/people-plan-catalog';
import { getVehiclePlanSizeMm } from '../../data/vehicles-plan-catalog';

/** Το layer όπου προσγειώνονται ΟΛΟΙ οι άνθρωποι κάτοψης. */
export const PEOPLE_PLAN_LAYER_ID = 'PEOPLE-2D';
/** Το layer όπου προσγειώνονται ΟΛΑ τα οχήματα κάτοψης. */
export const VEHICLES_PLAN_LAYER_ID = 'VEHICLES-2D';

/** Placer ανθρώπων: μεγέθη από τον people catalog, layer PEOPLE-2D. */
export const peoplePlanPlacer: EntouragePlacer = createEntouragePlacer({
  getSizeMm: getPeoplePlanSizeMm,
  layerId: PEOPLE_PLAN_LAYER_ID,
});

/** Placer οχημάτων: μεγέθη από τον vehicles catalog, layer VEHICLES-2D. */
export const vehiclesPlanPlacer: EntouragePlacer = createEntouragePlacer({
  getSizeMm: getVehiclePlanSizeMm,
  layerId: VEHICLES_PLAN_LAYER_ID,
});
