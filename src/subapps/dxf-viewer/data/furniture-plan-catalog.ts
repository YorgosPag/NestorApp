/**
 * ADR-654 — Furniture Plan (Entourage) Catalog SSoT.
 *
 * Curated βιβλιοθήκη raster επίπλων σε ΚΑΤΟΨΗ (top-view cut-outs με alpha) που
 * τοποθετούνται ως `ImageEntity` πάνω στο σχέδιο, ώστε η κάτοψη να διαβάζεται σαν
 * render παρουσίασης αντί για σκέτες γραμμές. Μοτίβο ίδιο με το
 * `material-image-catalog.ts` (ADR-643 Φ2): pure data façade, καμία runtime λογική.
 *
 * ⚠️ ΚΡΙΣΙΜΟ — γιατί «μεγάλη πλευρά» και ΟΧΙ «πλάτος»:
 * Το pack ΔΕΝ έχει ενιαία κλίμακα (τα μονά αρχεία γυρίστηκαν σε άλλη κλίμακα από τα
 * σετ) → το πραγματικό μέγεθος ΔΕΝ συνάγεται από τα pixels· το ορίζει η κατηγορία.
 * Επιπλέον, τα sprites ΔΕΝ έχουν κοινό προσανατολισμό: οι διθέσιοι είναι γυρισμένοι
 * κάθετα (aspect 0.57). Αν η κατηγορία όριζε «πλάτος» και το εφαρμόζαμε στον άξονα x,
 * ένας διθέσιος 1500mm θα έβγαινε 2632mm ΒΑΘΥΣ. Άρα η κατηγορία ορίζει το **μήκος του
 * επίπλου** και εφαρμόζεται στη ΜΕΓΑΛΗ πλευρά του sprite, όποια κι αν είναι αυτή.
 * Η μικρή πλευρά προκύπτει από το `aspect` ⇒ το sprite ΠΟΤΕ δεν παραμορφώνεται.
 *
 * Prefix `furn-*` = curated builtins (σταθερά ids, ντετερμινιστικά από τον builder) —
 * διακριτά από τα `matimg-*` (hatch images) και τα `bmat_*` (bim_materials).
 *
 * Types/data file (size-exempt): pure lookups.
 *
 * @see ./furniture-plan-source.ts — id → URL (public ↔ storage, mirror ADR-413)
 * @see scripts/build-furniture-plan-assets.js — ο builder που παράγει sprites + aspect
 * @see docs/centralized-systems/reference/adrs/ADR-654-furniture-plan-entourage.md
 */

// ─── Κατηγορίες ───────────────────────────────────────────────────────────────

/** Ομαδοποίηση για την παλέτα + ο SSoT του πραγματικού μεγέθους. */
export type FurniturePlanCategory =
  | 'sofa3'
  | 'sofa2'
  | 'armchair'
  | 'recliner'
  | 'chair'
  | 'officeChair'
  | 'bedDouble'
  | 'bedSingle'
  | 'rug';

/**
 * Μήκος (η ΜΕΓΑΛΗ πλευρά) του επίπλου σε mm — ο μοναδικός SSoT της κλίμακας.
 * Τυπικές διαστάσεις επίπλου, όχι μετρήσεις του pack.
 */
export const FURNITURE_PLAN_LONG_SIDE_MM: Readonly<Record<FurniturePlanCategory, number>> = {
  sofa3: 2100,
  sofa2: 1500,
  armchair: 900,
  recliner: 1600,
  chair: 500,
  officeChair: 650,
  bedDouble: 2000, // μήκος κρεβατιού (το πλάτος ~1600 βγαίνει από το aspect)
  bedSingle: 2000,
  rug: 2400,
};

// ─── Catalog entry ────────────────────────────────────────────────────────────

export interface FurniturePlanDef {
  /** Σταθερό curated id — ίδιο με το όνομα του asset (`<id>.webp`). */
  readonly id: string;
  /** Κατηγορία — καθορίζει το πραγματικό μέγεθος + το grouping της παλέτας. */
  readonly category: FurniturePlanCategory;
  /** wPx / hPx του cropped sprite. Διατηρεί τις αναλογίες — ΠΟΤΕ παραμόρφωση. */
  readonly aspect: number;
  /** i18n suffix κάτω από `furniturePlan.items.<suffix>`. */
  readonly labelKeySuffix: string;
}

// ─── Catalog data ─────────────────────────────────────────────────────────────

const CATALOG: readonly FurniturePlanDef[] = [
  // Σαλόνια — κάθε πηγαίο TIF έδωσε τριθέσιο + διθέσιο + πολυθρόνα.
  { id: 'furn-obj-001-1', category: 'sofa3',       aspect: 2.4363, labelKeySuffix: 'sofa3Striped' },
  { id: 'furn-obj-001-2', category: 'sofa2',       aspect: 0.571,  labelKeySuffix: 'sofa2Striped' },
  { id: 'furn-obj-001-3', category: 'armchair',    aspect: 0.9179, labelKeySuffix: 'armchairStriped' },
  { id: 'furn-obj-005-1', category: 'sofa3',       aspect: 2.4301, labelKeySuffix: 'sofa3StripedBlue' },
  { id: 'furn-obj-005-2', category: 'sofa2',       aspect: 0.5687, labelKeySuffix: 'sofa2StripedBlue' },
  { id: 'furn-obj-005-3', category: 'armchair',    aspect: 0.9169, labelKeySuffix: 'armchairStripedBlue' },
  { id: 'furn-obj-015-1', category: 'armchair',    aspect: 1.0921, labelKeySuffix: 'armchairPlaid' },
  { id: 'furn-obj-027-1', category: 'sofa3',       aspect: 2.4146, labelKeySuffix: 'sofa3Classic' },
  { id: 'furn-obj-027-2', category: 'sofa2',       aspect: 0.5509, labelKeySuffix: 'sofa2Classic' },
  { id: 'furn-obj-027-3', category: 'armchair',    aspect: 0.7778, labelKeySuffix: 'armchairClassic' },
  { id: 'furn-obj-054-1', category: 'sofa3',       aspect: 3.0957, labelKeySuffix: 'sofa3Modern' },
  { id: 'furn-obj-054-2', category: 'sofa2',       aspect: 0.4609, labelKeySuffix: 'sofa2Modern' },
  { id: 'furn-obj-054-3', category: 'armchair',    aspect: 0.8136, labelKeySuffix: 'armchairModern' },

  // Υπνοδωμάτιο / καθιστικά.
  { id: 'furn-obj-120-1', category: 'bedDouble',   aspect: 0.7835, labelKeySuffix: 'bedDoubleOrange' },
  { id: 'furn-obj-160-1', category: 'chair',       aspect: 1.0271, labelKeySuffix: 'chairUpholstered' },
  { id: 'furn-obj-176-1', category: 'recliner',    aspect: 0.5619, labelKeySuffix: 'reclinerLeather' },

  // Χαλιά (ορθογώνια — πλήρως αδιαφανή, χωρίς alpha, by design).
  { id: 'furn-rug-001-1', category: 'rug',         aspect: 0.6852, labelKeySuffix: 'rugCircles' },
  { id: 'furn-rug-005-1', category: 'rug',         aspect: 0.7155, labelKeySuffix: 'rugWaves' },
  { id: 'furn-rug-015-1', category: 'rug',         aspect: 0.6163, labelKeySuffix: 'rugRetro' },
];

const BY_ID: ReadonlyMap<string, FurniturePlanDef> = new Map(CATALOG.map((d) => [d.id, d]));

// ─── Lookups ──────────────────────────────────────────────────────────────────

export function getFurniturePlanDef(id: string): FurniturePlanDef | undefined {
  return BY_ID.get(id);
}

export function listFurniturePlanDefs(): readonly FurniturePlanDef[] {
  return CATALOG;
}

export interface FurniturePlanSizeMm {
  readonly widthMm: number;
  readonly heightMm: number;
}

/**
 * Πραγματικό μέγεθος τοποθέτησης: το μήκος της κατηγορίας πάει στη ΜΕΓΑΛΗ πλευρά του
 * sprite, η μικρή προκύπτει από το `aspect`. Έτσι ένα κάθετα γυρισμένο sprite παίρνει
 * το μήκος στον σωστό άξονα και οι αναλογίες μένουν άθικτες.
 */
export function getFurniturePlanSizeMm(id: string): FurniturePlanSizeMm | null {
  const def = BY_ID.get(id);
  if (!def || !Number.isFinite(def.aspect) || def.aspect <= 0) return null;

  const longSideMm = FURNITURE_PLAN_LONG_SIDE_MM[def.category];
  return def.aspect >= 1
    ? { widthMm: longSideMm, heightMm: longSideMm / def.aspect }
    : { widthMm: longSideMm * def.aspect, heightMm: longSideMm };
}
