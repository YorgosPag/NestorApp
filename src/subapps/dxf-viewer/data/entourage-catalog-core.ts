/**
 * ADR-654 — Entourage Catalog CORE (faceted taxonomy engine, M6).
 *
 * Ο ΚΟΙΝΟΣ πυρήνας κάθε οικογένειας entourage (άνθρωποι, οχήματα — και, σε δεύτερο βήμα, τα
 * έπιπλα): raster cut-outs σε ΚΑΤΟΨΗ που τοποθετούνται ως `ImageEntity`. Κάθε sprite περιγράφεται
 * από **facets** — `category` (τι είναι· ορίζει ΤΟ ΜΕΓΕΘΟΣ) + προαιρετικό `secondary` (πώς δείχνει:
 * στυλ/χρώμα) + `series` (σταθερός αριθμός). Το εμφανιζόμενο όνομα ΣΥΝΤΙΘΕΤΑΙ στο runtime από τα
 * i18n κλειδιά των facets. Ένας πυρήνας ⇒ πολλές οικογένειες (N.18: μηδέν sibling clone ανά pack).
 *
 * ⚠️ ΚΡΙΣΙΜΟ — «μεγάλη πλευρά», ΟΧΙ «πλάτος»: το pack ΔΕΝ έχει ενιαία κλίμακα και τα sprites δεν
 * έχουν κοινό προσανατολισμό. Η κατηγορία ορίζει το **μήκος** (μεγάλη πλευρά)· η μικρή προκύπτει
 * από το `aspect` ⇒ μηδέν παραμόρφωση, ανεξάρτητα από το πώς γυρίστηκε το κάθε sprite.
 *
 * Η δευτερεύουσα facet είναι ΠΡΟΑΙΡΕΤΙΚΗ: οι άνθρωποι έχουν μόνο `category` (η top-view πόζα δεν
 * αναγνωρίζεται αξιόπιστα), τα οχήματα έχουν `secondary = χρώμα`. `secondary: null` ⇒ το όνομα
 * είναι «Κατηγορία · NN» χωρίς δεύτερο όρο.
 *
 * Types/data file (size-exempt): pure lookups, καμία runtime λογική, μηδέν React.
 *
 * @see ./people-plan-catalog.ts, ./vehicles-plan-catalog.ts — οι per-pack καταναλωτές
 * @see scripts/generate-entourage-catalog.js — παράγει τα *.data.ts (manifest + classification)
 * @see docs/centralized-systems/reference/adrs/ADR-654-furniture-plan-entourage.md
 */

/** Μία εγγραφή καταλόγου — γενική (η per-pack κατηγορία στενεύει το `category` με δικό της union). */
export interface EntourageDef {
  /** Σταθερό curated id — ίδιο με το όνομα του asset (`<id>.webp`). Η ΤΑΥΤΟΤΗΤΑ του sprite. */
  readonly id: string;
  /** Κατηγορία — καθορίζει το πραγματικό μέγεθος + το grouping της παλέτας. */
  readonly category: string;
  /** Δευτερεύον facet (στυλ/χρώμα) ή `null` αν η οικογένεια δεν έχει. */
  readonly secondary: string | null;
  /** Σταθερός αύξων αριθμός μέσα στο ζεύγος facets — μόνο για εμφάνιση. */
  readonly series: number;
  /** wPx / hPx του cropped sprite. Διατηρεί τις αναλογίες — ΠΟΤΕ παραμόρφωση. */
  readonly aspect: number;
}

export interface EntourageSizeMm {
  readonly widthMm: number;
  readonly heightMm: number;
}

/** Τα i18n κλειδιά + ο αριθμός· η σύνθεση με `t()` ζει στο UI (secondaryKey `null` ⇒ παραλείπεται). */
export interface EntourageLabelParts {
  readonly categoryKey: string;
  readonly secondaryKey: string | null;
  readonly series: number;
}

export interface EntourageCatalogConfig<C extends string> {
  /** AUTO-GENERATED entries (generate-entourage-catalog.js). */
  readonly data: readonly EntourageDef[];
  /** Μήκος (ΜΕΓΑΛΗ πλευρά) ανά κατηγορία, σε mm — ο μοναδικός SSoT της κλίμακας. */
  readonly longSideMm: Readonly<Record<C, number>>;
  /** i18n namespace-prefix των facets, π.χ. `'peoplePlan'` ⇒ `peoplePlan.categories.person`. */
  readonly i18nPrefix: string;
}

/** Οι lookups ενός pack — παράγονται από το {@link createEntourageCatalog}. */
export interface EntourageCatalog {
  list(): readonly EntourageDef[];
  getById(id: string): EntourageDef | undefined;
  getLabelParts(def: EntourageDef): EntourageLabelParts;
  getSizeMm(id: string): EntourageSizeMm | null;
}

/**
 * Χτίζει τους lookups μιας οικογένειας entourage από τα δεδομένα + το size map + το i18n prefix.
 * Καμία per-pack λογική εδώ — μόνο δεδομένα διαφέρουν (N.18).
 */
export function createEntourageCatalog<C extends string>(
  config: EntourageCatalogConfig<C>,
): EntourageCatalog {
  const { data, longSideMm, i18nPrefix } = config;
  const byId = new Map<string, EntourageDef>(data.map((d) => [d.id, d]));

  return {
    list: () => data,
    getById: (id) => byId.get(id),
    getLabelParts: (def) => ({
      categoryKey: `${i18nPrefix}.categories.${def.category}`,
      secondaryKey: def.secondary ? `${i18nPrefix}.secondary.${def.secondary}` : null,
      series: def.series,
    }),
    getSizeMm: (id) => {
      const def = byId.get(id);
      if (!def || !Number.isFinite(def.aspect) || def.aspect <= 0) return null;

      // Η κατηγορία δίνει το μήκος στη ΜΕΓΑΛΗ πλευρά· η μικρή βγαίνει από το aspect.
      const longSide = (longSideMm as Record<string, number>)[def.category];
      if (!Number.isFinite(longSide)) return null;
      return def.aspect >= 1
        ? { widthMm: longSide, heightMm: longSide / def.aspect }
        : { widthMm: longSide * def.aspect, heightMm: longSide };
    },
  };
}
