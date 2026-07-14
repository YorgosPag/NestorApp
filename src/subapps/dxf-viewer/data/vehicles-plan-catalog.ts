/**
 * ADR-654 — Vehicle Plan (Entourage) Catalog — top-view οχήματα (M6).
 *
 * Faceted βιβλιοθήκη raster οχημάτων σε ΚΑΤΟΨΗ (cut-outs με alpha) πάνω στη μηχανή
 * `entourage-catalog-core`. `category` = τύπος οχήματος (ΚΡΙΣΙΜΟΣ για το μέγεθος — ένα φορτηγό
 * είναι 4× ένα αυτοκίνητο) + facet `color` = **χρώμα** (φίλτρο/όνομα, δεν επηρεάζει μέγεθος). Το
 * pack περιλαμβάνει και σκάφη, χωματουργικά, τρακτέρ, αεροπλάνα (ADR-654 M6 Φάση 2).
 *
 * Prefix `veh-*` = curated builtins (σταθερά ids, ντετερμινιστικά από τον builder).
 *
 * Types/data file (size-exempt): pure lookups, καμία runtime λογική.
 *
 * @see ./entourage-catalog-core.ts — η κοινή μηχανή (getSizeMm/getLabelParts)
 * @see ./vehicles-plan-catalog.data.ts — AUTO-GENERATED entries
 * @see ./vehicles-plan-source.ts — id → URL (asset pack proxy, ADR-655)
 */

import {
  createEntourageCatalog,
  type EntourageDef,
  type EntourageLabelParts,
  type EntourageSizeMm,
} from './entourage-catalog-core';
import { VEHICLE_PLAN_CATALOG_DATA } from './vehicles-plan-catalog.data';

/** Τύπος οχήματος — SSoT μεγέθους + κύριο φίλτρο. Μόνο τύποι που εμφανίστηκαν στο pack. */
export type VehiclePlanCategory =
  | 'car'
  | 'motorcycle'
  | 'scooter'
  | 'pickup'
  | 'van'
  | 'truck'
  | 'boat'
  | 'construction'
  | 'tractor'
  | 'airplane';

/** Χρώμα αμαξώματος — δευτερεύον facet (φίλτρο/όνομα), δεν επηρεάζει το μέγεθος. */
export type VehiclePlanColor =
  | 'red'
  | 'white'
  | 'black'
  | 'silver'
  | 'grey'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'orange'
  | 'brown'
  | 'other';

/** Τα οχήματα έχουν ένα facet `color` ⇒ `facets: { color: VehiclePlanColor }`. */
export interface VehiclePlanDef extends EntourageDef {
  readonly category: VehiclePlanCategory;
}

/**
 * Μήκος (ΜΕΓΑΛΗ πλευρά) ανά τύπο σε mm — ο μοναδικός SSoT της κλίμακας. Τυπικές διαστάσεις,
 * όχι μετρήσεις του pack. Λάθος τύπος = δραματικά λάθος μέγεθος (γι' αυτό vision = τύπος).
 */
export const VEHICLE_PLAN_LONG_SIDE_MM: Readonly<Record<VehiclePlanCategory, number>> = {
  car: 4500,
  motorcycle: 2100,
  scooter: 1900,
  pickup: 5400,
  van: 5200,
  truck: 8500,
  boat: 15000,
  construction: 8000,
  tractor: 4500,
  airplane: 40000,
};

const catalog = createEntourageCatalog<VehiclePlanCategory>({
  data: VEHICLE_PLAN_CATALOG_DATA,
  longSideMm: VEHICLE_PLAN_LONG_SIDE_MM,
  i18nPrefix: 'vehiclePlan',
});

export function listVehiclePlanDefs(): readonly VehiclePlanDef[] {
  return catalog.list() as readonly VehiclePlanDef[];
}

export function getVehiclePlanDef(id: string): VehiclePlanDef | undefined {
  return catalog.getById(id) as VehiclePlanDef | undefined;
}

export function getVehiclePlanLabelParts(def: VehiclePlanDef): EntourageLabelParts {
  return catalog.getLabelParts(def);
}

export function getVehiclePlanSizeMm(id: string): EntourageSizeMm | null {
  return catalog.getSizeMm(id);
}
