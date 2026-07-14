/**
 * ADR-654 — Furniture Plan (Entourage) Catalog — faceted taxonomy πάνω στον ΚΟΙΝΟ core (M7 Φάση Γ).
 *
 * Curated βιβλιοθήκη raster επίπλων σε ΚΑΤΟΨΗ (top-view cut-outs με alpha) που τοποθετούνται ως
 * `ImageEntity`. Το μοντέλο ονοματοδοσίας ακολουθεί τους «μεγάλους» (Revit / ArchiCAD): αντί για
 * ~380 χειρόγραφα ονόματα, κάθε sprite περιγράφεται από **facets** — `category` (τι είναι· ο ΜΟΝΟΣ
 * που ορίζει ΤΟ ΜΕΓΕΘΟΣ) + `kind` (Μεμονωμένα ⇄ Συνθέσεις — Revit «Furniture» vs «Furniture
 * Systems») + `style` (πώς δείχνει) + `series` (σταθερός αριθμός). Το εμφανιζόμενο όνομα ΣΥΝΤΙΘΕΤΑΙ
 * στο runtime από τα i18n κλειδιά των facets («Πολυθρόνα · Μεμονωμένο · Δερμάτινη · 03»).
 *
 * ⚠️ ΚΡΙΣΙΜΟ — «μεγάλη πλευρά» και ΟΧΙ «πλάτος»: το pack ΔΕΝ έχει ενιαία κλίμακα ούτε κοινό
 * προσανατολισμό (διθέσιοι γυρισμένοι κάθετα, aspect 0.57). Η κατηγορία ορίζει το **μήκος**, που
 * εφαρμόζεται στη ΜΕΓΑΛΗ πλευρά του sprite· η μικρή βγαίνει από το `aspect` ⇒ μηδέν παραμόρφωση.
 *
 * Πλέον thin wrapper πάνω στο `entourage-catalog-core` (N.18: μία μηχανή, μηδέν sibling clone —
 * ίδιο μοτίβο με people/vehicles/plants). Prefix `furn-*` = curated builtins (σταθερά ids).
 *
 * Types/data file (size-exempt): pure lookups, καμία runtime λογική.
 *
 * @see ./entourage-catalog-core.ts — η κοινή μηχανή (getSizeMm/getLabelParts)
 * @see ./furniture-plan-catalog.data.ts — AUTO-GENERATED entries (generate-entourage-catalog.js furniture)
 * @see ./entourage-plan-sources.ts — id → URL (asset pack proxy, ADR-655)
 * @see docs/centralized-systems/reference/adrs/ADR-654-furniture-plan-entourage.md
 */

import {
  createEntourageCatalog,
  type EntourageDef,
  type EntourageLabelParts,
  type EntourageSizeMm,
} from './entourage-catalog-core';
import { FURNITURE_PLAN_CATALOG_DATA } from './furniture-plan-catalog.data';

// ─── Facets ───────────────────────────────────────────────────────────────────

/** Τι ΕΙΝΑΙ το έπιπλο — ο SSoT του πραγματικού μεγέθους + το κύριο φίλτρο της παλέτας. */
export type FurniturePlanCategory =
  | 'sofa3'
  | 'sofa2'
  | 'sofaCorner'
  | 'armchair'
  | 'recliner'
  | 'chair'
  | 'officeChair'
  | 'stool'
  | 'bench'
  | 'pouf'
  | 'bedDouble'
  | 'bedSingle'
  | 'washbasin'
  | 'coffeeTable'
  | 'rug';

/**
 * Μεμονωμένο έπιπλο ⇄ ολόκληρη σύνθεση/σετ (Revit «Furniture» vs «Furniture Systems»). Το πρώτο,
 * top-level φίλτρο της παλέτας — δεν επηρεάζει το μέγεθος (το ορίζει η `category`).
 */
export type FurniturePlanKind = 'individual' | 'composition';

/** Πώς ΔΕΙΧΝΕΙ — δευτερεύον φίλτρο/αναζήτηση, δεν επηρεάζει το μέγεθος. */
export type FurniturePlanStyle =
  | 'solid'
  | 'floral'
  | 'leather'
  | 'striped'
  | 'retro'
  | 'modern'
  | 'plaid'
  | 'checkered'
  | 'classic'
  | 'velvet';

/**
 * Μήκος (η ΜΕΓΑΛΗ πλευρά) του επίπλου σε mm — ο μοναδικός SSoT της κλίμακας.
 * Τυπικές διαστάσεις επίπλου, όχι μετρήσεις του pack.
 */
export const FURNITURE_PLAN_LONG_SIDE_MM: Readonly<Record<FurniturePlanCategory, number>> = {
  sofa3: 2100,
  sofa2: 1500,
  sofaCorner: 2600, // η μεγάλη πλευρά του Γ
  armchair: 900,
  recliner: 1600,
  chair: 500,
  officeChair: 650,
  stool: 400,
  bench: 1200,
  pouf: 600,
  bedDouble: 2000, // μήκος κρεβατιού (το πλάτος ~1600 βγαίνει από το aspect)
  bedSingle: 2000,
  washbasin: 600,
  coffeeTable: 1100,
  rug: 2400,
};

// ─── Catalog entry ────────────────────────────────────────────────────────────

/**
 * Έπιπλο κάτοψης: γενικό `EntourageDef` με στενεμένη ΜΟΝΟ την `category` (τα `facets` μένουν
 * `Record<string,string>` όπως στα people/vehicles/plants — ο generator + τα tests επικυρώνουν
 * τις τιμές `kind`/`style`, ώστε να αποφεύγεται το TS index-signature friction).
 */
export interface FurniturePlanDef extends EntourageDef {
  /** Κατηγορία — καθορίζει το πραγματικό μέγεθος + το grouping της παλέτας. */
  readonly category: FurniturePlanCategory;
}

// ─── Catalog (thin wrapper πάνω στον κοινό core) ────────────────────────────────

const catalog = createEntourageCatalog<FurniturePlanCategory>({
  data: FURNITURE_PLAN_CATALOG_DATA,
  longSideMm: FURNITURE_PLAN_LONG_SIDE_MM,
  i18nPrefix: 'furniturePlan',
});

// ─── Lookups (ίδια ονόματα εξαγωγής — callers/tests αμετάβλητα) ──────────────────

export function getFurniturePlanDef(id: string): FurniturePlanDef | undefined {
  return catalog.getById(id) as FurniturePlanDef | undefined;
}

export function listFurniturePlanDefs(): readonly FurniturePlanDef[] {
  return catalog.list() as readonly FurniturePlanDef[];
}

/** Τα i18n κλειδιά + ο αριθμός για σύνθεση εμφανιζόμενου ονόματος (η σύνθεση με `t()` ζει στο UI). */
export function getFurniturePlanLabelParts(def: FurniturePlanDef): EntourageLabelParts {
  return catalog.getLabelParts(def);
}

/**
 * Πραγματικό μέγεθος τοποθέτησης: το μήκος της κατηγορίας πάει στη ΜΕΓΑΛΗ πλευρά του sprite, η
 * μικρή προκύπτει από το `aspect`. `null` για άγνωστο id (ο καλών δεν τοποθετεί σκουπίδι).
 */
export function getFurniturePlanSizeMm(id: string): EntourageSizeMm | null {
  return catalog.getSizeMm(id);
}
