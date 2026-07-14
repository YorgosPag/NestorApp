/**
 * ADR-654 — People Plan (Entourage) Catalog — top-view ανθρώπινες φιγούρες (M6).
 *
 * Faceted βιβλιοθήκη raster ανθρώπων σε ΚΑΤΟΨΗ (cut-outs με alpha) πάνω στη μηχανή
 * `entourage-catalog-core`. ΜΟΝΟ `category` (χωρίς δευτερεύον facet): η top-view πόζα δεν
 * αναγνωρίζεται αξιόπιστα, ΚΑΙ οι όρθιες πόζες έχουν ίδιο footprint — άρα «όρθιος/περπάτημα/
 * καθιστός/εργασία» ενοποιήθηκαν σε `person`. Κρατήθηκαν μόνο οι κατηγορίες που **αλλάζουν
 * μέγεθος** και βρέθηκαν σίγουρα από τη vision (ADR-654 M6 Φάση 2).
 *
 * Prefix `ppl-*` = curated builtins (σταθερά ids, ντετερμινιστικά από τον builder).
 *
 * Types/data file (size-exempt): pure lookups, καμία runtime λογική.
 *
 * @see ./entourage-catalog-core.ts — η κοινή μηχανή (getSizeMm/getLabelParts)
 * @see ./people-plan-catalog.data.ts — AUTO-GENERATED entries
 * @see ./people-plan-source.ts — id → URL (asset pack proxy, ADR-655)
 */

import {
  createEntourageCatalog,
  type EntourageDef,
  type EntourageLabelParts,
  type EntourageSizeMm,
} from './entourage-catalog-core';
import { PEOPLE_PLAN_CATALOG_DATA } from './people-plan-catalog.data';

/** Τι ΕΙΝΑΙ η φιγούρα — SSoT μεγέθους + κύριο φίλτρο. Μόνο size-distinct, vision-reliable κατηγορίες. */
export type PeoplePlanCategory =
  | 'person'
  | 'lying'
  | 'group'
  | 'stroller'
  | 'wheelchair'
  | 'child';

/** Οι άνθρωποι δεν έχουν δευτερεύον facet ⇒ `secondary` πάντα `null`. */
export interface PeoplePlanDef extends EntourageDef {
  readonly category: PeoplePlanCategory;
  readonly secondary: null;
}

/**
 * Μήκος (ΜΕΓΑΛΗ πλευρά) ανά κατηγορία σε mm — ο μοναδικός SSoT της κλίμακας.
 * Ο όρθιος `person` ~650mm· ο ξαπλωμένος `lying` ~1800mm (3× — γι' αυτό ξεχωριστή κατηγορία).
 */
export const PEOPLE_PLAN_LONG_SIDE_MM: Readonly<Record<PeoplePlanCategory, number>> = {
  person: 650,
  lying: 1800,
  group: 1400,
  stroller: 1600,
  wheelchair: 1200,
  child: 450,
};

const catalog = createEntourageCatalog<PeoplePlanCategory>({
  data: PEOPLE_PLAN_CATALOG_DATA,
  longSideMm: PEOPLE_PLAN_LONG_SIDE_MM,
  i18nPrefix: 'peoplePlan',
});

export function listPeoplePlanDefs(): readonly PeoplePlanDef[] {
  return catalog.list() as readonly PeoplePlanDef[];
}

export function getPeoplePlanDef(id: string): PeoplePlanDef | undefined {
  return catalog.getById(id) as PeoplePlanDef | undefined;
}

export function getPeoplePlanLabelParts(def: PeoplePlanDef): EntourageLabelParts {
  return catalog.getLabelParts(def);
}

export function getPeoplePlanSizeMm(id: string): EntourageSizeMm | null {
  return catalog.getSizeMm(id);
}
