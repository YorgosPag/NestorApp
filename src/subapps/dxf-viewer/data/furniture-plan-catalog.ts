/**
 * ADR-654 — Furniture Plan (Entourage) Catalog SSoT — faceted taxonomy (M5).
 *
 * Curated βιβλιοθήκη raster επίπλων σε ΚΑΤΟΨΗ (top-view cut-outs με alpha) που τοποθετούνται ως
 * `ImageEntity` πάνω στο σχέδιο. Το μοντέλο ονοματοδοσίας ακολουθεί τους «μεγάλους» (Revit /
 * ArchiCAD): αντί για ~380 χειρόγραφα ονόματα, κάθε sprite περιγράφεται από **facets** —
 * `category` (τι είναι) + `style` (πώς δείχνει) + `series` (σταθερός αριθμός). Το εμφανιζόμενο
 * όνομα ΣΥΝΤΙΘΕΤΑΙ στο runtime από τα i18n κλειδιά των facets («Πολυθρόνα · Δερμάτινη · 03»):
 *   • Πεπερασμένο, μεταφρασμένο λεξιλόγιο (category ~15, style ~10) αντί για N per-item strings.
 *   • Τα facets τροφοδοτούν τα φίλτρα της παλέτας (κλιμακώνει σε εκατοντάδες sprites).
 *
 * ⚠️ ΚΡΙΣΙΜΟ — γιατί «μεγάλη πλευρά» και ΟΧΙ «πλάτος»:
 * Το pack ΔΕΝ έχει ενιαία κλίμακα (τα μονά αρχεία γυρίστηκαν σε άλλη κλίμακα από τα σετ) → το
 * πραγματικό μέγεθος ΔΕΝ συνάγεται από τα pixels· το ορίζει η **κατηγορία**. Επιπλέον τα sprites
 * ΔΕΝ έχουν κοινό προσανατολισμό (διθέσιοι γυρισμένοι κάθετα, aspect 0.57). Αν η κατηγορία όριζε
 * «πλάτος» και το εφαρμόζαμε στον x, ένας διθέσιος 1500mm θα έβγαινε 2632mm ΒΑΘΥΣ. Άρα η κατηγορία
 * ορίζει το **μήκος** και εφαρμόζεται στη ΜΕΓΑΛΗ πλευρά του sprite· η μικρή βγαίνει από το `aspect`
 * ⇒ μηδέν παραμόρφωση.
 *
 * Prefix `furn-*` = curated builtins (σταθερά ids, ντετερμινιστικά από τον builder).
 *
 * Types/data file (size-exempt): pure lookups, καμία runtime λογική.
 *
 * @see ./furniture-plan-catalog.data.ts — AUTO-GENERATED entries (generate-furniture-plan-catalog.js)
 * @see ./furniture-plan-source.ts — id → URL (asset pack proxy, ADR-655)
 * @see docs/centralized-systems/reference/adrs/ADR-654-furniture-plan-entourage.md
 */

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

export interface FurniturePlanDef {
  /** Σταθερό curated id — ίδιο με το όνομα του asset (`<id>.webp`). Η ΤΑΥΤΟΤΗΤΑ του sprite. */
  readonly id: string;
  /** Κατηγορία — καθορίζει το πραγματικό μέγεθος + το grouping της παλέτας. */
  readonly category: FurniturePlanCategory;
  /** Στυλ — δευτερεύον facet για φίλτρο/όνομα. */
  readonly style: FurniturePlanStyle;
  /** Σταθερός αύξων αριθμός μέσα στο ζεύγος (category, style) — μόνο για εμφάνιση. */
  readonly series: number;
  /** wPx / hPx του cropped sprite. Διατηρεί τις αναλογίες — ΠΟΤΕ παραμόρφωση. */
  readonly aspect: number;
}

// ─── Catalog data ─────────────────────────────────────────────────────────────

const CATALOG = FURNITURE_PLAN_CATALOG_DATA;
const BY_ID: ReadonlyMap<string, FurniturePlanDef> = new Map(CATALOG.map((d) => [d.id, d]));

// ─── Lookups ──────────────────────────────────────────────────────────────────

export function getFurniturePlanDef(id: string): FurniturePlanDef | undefined {
  return BY_ID.get(id);
}

export function listFurniturePlanDefs(): readonly FurniturePlanDef[] {
  return CATALOG;
}

/** Τα i18n κλειδιά + ο αριθμός για σύνθεση εμφανιζόμενου ονόματος (η σύνθεση με `t()` ζει στο UI). */
export interface FurniturePlanLabelParts {
  readonly categoryKey: string;
  readonly styleKey: string;
  readonly series: number;
}

export function getFurniturePlanLabelParts(def: FurniturePlanDef): FurniturePlanLabelParts {
  return {
    categoryKey: `furniturePlan.categories.${def.category}`,
    styleKey: `furniturePlan.styles.${def.style}`,
    series: def.series,
  };
}

export interface FurniturePlanSizeMm {
  readonly widthMm: number;
  readonly heightMm: number;
}

/**
 * Πραγματικό μέγεθος τοποθέτησης: το μήκος της κατηγορίας πάει στη ΜΕΓΑΛΗ πλευρά του sprite, η
 * μικρή προκύπτει από το `aspect`. Έτσι ένα κάθετα γυρισμένο sprite παίρνει το μήκος στον σωστό
 * άξονα και οι αναλογίες μένουν άθικτες.
 */
export function getFurniturePlanSizeMm(id: string): FurniturePlanSizeMm | null {
  const def = BY_ID.get(id);
  if (!def || !Number.isFinite(def.aspect) || def.aspect <= 0) return null;

  const longSideMm = FURNITURE_PLAN_LONG_SIDE_MM[def.category];
  return def.aspect >= 1
    ? { widthMm: longSideMm, heightMm: longSideMm / def.aspect }
    : { widthMm: longSideMm * def.aspect, heightMm: longSideMm };
}
