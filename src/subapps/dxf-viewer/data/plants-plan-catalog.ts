/**
 * ADR-654 — Plants Plan (Entourage) Catalog — top-view φυτά/δέντρα (M7).
 *
 * Faceted βιβλιοθήκη raster φυτών σε ΚΑΤΟΨΗ (cut-outs με alpha) πάνω στη μηχανή
 * `entourage-catalog-core`. ΜΟΝΟ `category` = τύπος φυτού (ΚΡΙΣΙΜΟΣ για το μέγεθος — ένα δέντρο
 * είναι 13× ένα λουλούδι). Χωρίς facets: η top-view δεν δίνει αξιόπιστο δεύτερο χαρακτηριστικό
 * (ADR-654 M7 Φάση Β).
 *
 * Prefix `pl-*` = curated builtins (σταθερά ids, ντετερμινιστικά από τον builder).
 *
 * Types/data file (size-exempt): pure lookups, καμία runtime λογική.
 *
 * @see ./entourage-catalog-core.ts — η κοινή μηχανή (getSizeMm/getLabelParts)
 * @see ./plants-plan-catalog.data.ts — AUTO-GENERATED entries
 * @see ./entourage-plan-sources.ts — id → URL (asset pack proxy, ADR-655)
 */

import {
  createEntourageCatalog,
  type EntourageDef,
  type EntourageLabelParts,
  type EntourageSizeMm,
} from './entourage-catalog-core';
import { PLANTS_PLAN_CATALOG_DATA } from './plants-plan-catalog.data';

/** Τύπος φυτού — SSoT μεγέθους + κύριο φίλτρο. Μόνο size-distinct, vision-reliable κατηγορίες. */
export type PlantsPlanCategory =
  | 'tree'
  | 'largeTree'
  | 'shrub'
  | 'hedge'
  | 'palm'
  | 'flower'
  | 'grass';

/** Τα φυτά δεν έχουν facets ⇒ `facets` πάντα `{}` (μόνο category). */
export interface PlantsPlanDef extends EntourageDef {
  readonly category: PlantsPlanCategory;
}

/**
 * Μήκος (ΜΕΓΑΛΗ πλευρά) ανά τύπο σε mm — ο μοναδικός SSoT της κλίμακας. Τυπικές διαστάσεις κόμης
 * σε κάτοψη, όχι μετρήσεις του pack. Λάθος τύπος = δραματικά λάθος μέγεθος (γι' αυτό vision = τύπος).
 */
export const PLANTS_PLAN_LONG_SIDE_MM: Readonly<Record<PlantsPlanCategory, number>> = {
  tree: 6000,
  largeTree: 9000,
  shrub: 2000,
  hedge: 2500,
  palm: 5000,
  flower: 450,
  grass: 1000,
};

const catalog = createEntourageCatalog<PlantsPlanCategory>({
  data: PLANTS_PLAN_CATALOG_DATA,
  longSideMm: PLANTS_PLAN_LONG_SIDE_MM,
  i18nPrefix: 'plantsPlan',
});

export function listPlantsPlanDefs(): readonly PlantsPlanDef[] {
  return catalog.list() as readonly PlantsPlanDef[];
}

export function getPlantsPlanDef(id: string): PlantsPlanDef | undefined {
  return catalog.getById(id) as PlantsPlanDef | undefined;
}

export function getPlantsPlanLabelParts(def: PlantsPlanDef): EntourageLabelParts {
  return catalog.getLabelParts(def);
}

export function getPlantsPlanSizeMm(id: string): EntourageSizeMm | null {
  return catalog.getSizeMm(id);
}
