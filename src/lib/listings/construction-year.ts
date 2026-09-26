/**
 * @fileoverview **ΤΟ ΕΤΟΣ ΚΑΤΑΣΚΕΥΗΣ ΜΙΑΣ ΑΓΓΕΛΙΑΣ** — ποια πηγή νικά, και τι είναι αληθοφανές.
 * @related ADR-890 Φ0 · ADR-842 (`SourcedAttribute`) · `lib/property/attribute-provenance.ts`
 * @module lib/listings/construction-year
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙΜΗ + ΠΗΓΗ, ΟΠΩΣ ΣΤΟ RESO (`YearBuilt` + `YearBuiltSource`)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Το έτος κατασκευής είναι γεγονός του **κτιρίου**, όχι του διαμερίσματος: όλα τα ακίνητα ενός
 * κτιρίου έχουν το ίδιο. Άρα δηλώνεται **μία** φορά, στο κτίριο (ADR-777 §14.5, «χωρίς
 * διπλότυπα»), και η αγγελία το **κληρονομεί**. Δύο πηγές:
 *
 * | Πηγή | Προέλευση | Πότε |
 * |---|---|---|
 * | `Building.constructionYear` (επαγγελματίας) | `declared` | πάντα προηγείται |
 * | `PublicBuilding.constructionYear` (επίπεδο Α, π.χ. OSM `start_date`) | `public-record` | εφεδρεία |
 *
 * Η σειρά είναι η **πρακτική του κλάδου**: στο MLS η αγγελία φέρει ό,τι δηλώνει ο αγγελιοδότης·
 * το Zillow προσυμπληρώνει από δημόσια μητρώα και ο ιδιοκτήτης διορθώνει. Εδώ κάνει το ίδιο ο
 * {@link preferStrongerAttribute} — **ένας** κανόνας «ποια νικά», όχι δεύτερος.
 *
 * ⚠️ **ΞΕΧΩΡΙΣΤΟ ΑΠΟ ΤΟ `renovationYear`** (RESO `YearBuiltEffective`): μια ανακαίνιση του 2020
 * δεν κάνει νεόδμητη μια πολυκατοικία του 1975. Το MLS που τα μπερδεύει είναι γνωστή πηγή
 * απόκλισης από τα δημόσια μητρώα.
 */

import type { Attested } from '@/lib/location/location-provenance';
import {
  isPublicRecordRegistry,
  preferStrongerAttribute,
  type SourcedAttribute,
} from '@/lib/property/attribute-provenance';

// ============================================================================
// ΑΛΗΘΟΦΑΝΕΙΑ — μία σταθερά, για φόρμα ΚΑΙ προβολή
// ============================================================================

/**
 * **Τα όρια ενός αληθοφανούς έτους κατασκευής.**
 *
 * - `min` **1000**, όχι 1900: η Ελλάδα έχει κατοικήσιμα κτίρια ενετικής και οθωμανικής περιόδου.
 *   Το όριο υπάρχει για να πιάνει **λάθη πληκτρολόγησης** (`197`, `19`), όχι ιστορία.
 * - `maxYearsAhead` **5**: ένα κτίριο **υπό κατασκευή** πωλείται με το έτος παράδοσης (off-plan).
 *   Πέρα από μια πενταετία δεν είναι παράδοση, είναι λάθος.
 */
export const CONSTRUCTION_YEAR_BOUNDS = { min: 1000, maxYearsAhead: 5 } as const;

/** Το ανώτατο αποδεκτό έτος για μια στιγμή αναφοράς. */
export function maxConstructionYear(referenceYear: number): number {
  return referenceYear + CONSTRUCTION_YEAR_BOUNDS.maxYearsAhead;
}

/**
 * Αληθοφανές έτος κατασκευής; — ακέραιο, μέσα στα {@link CONSTRUCTION_YEAR_BOUNDS}.
 * Τη ρωτούν **και** η φόρμα του κτιρίου **και** η προβολή: μια τιμή που η φόρμα αρνείται
 * δεν μπορεί να φτάσει στον αγοραστή από άλλη πόρτα (εισαγωγή, κονσόλα).
 */
export function isPlausibleConstructionYear(year: unknown, referenceYear: number): year is number {
  return (
    typeof year === 'number' &&
    Number.isInteger(year) &&
    year >= CONSTRUCTION_YEAR_BOUNDS.min &&
    year <= maxConstructionYear(referenceYear)
  );
}

// ============================================================================
// Η ΦΟΡΜΑ ΤΟΥ ΚΤΙΡΙΟΥ — κείμενο πεδίου → τιμή εγγράφου
// ============================================================================

/** Ό,τι έγραψε ο άνθρωπος στο πεδίο, κριμένο. */
type ConstructionYearInput =
  | { readonly kind: 'empty' }
  | { readonly kind: 'valid'; readonly year: number }
  | { readonly kind: 'invalid' };

/** Κρίνει το κείμενο του πεδίου — **μόνο** ψηφία, μέσα στα {@link CONSTRUCTION_YEAR_BOUNDS}. */
export function readConstructionYearInput(raw: string, referenceYear: number): ConstructionYearInput {
  const text = raw.trim();
  if (text === '') return { kind: 'empty' };
  if (!/^\d+$/.test(text)) return { kind: 'invalid' };
  const year = Number(text);
  return isPlausibleConstructionYear(year, referenceYear) ? { kind: 'valid', year } : { kind: 'invalid' };
}

/**
 * **Η αλλαγή που στέλνεται στο κτίριο** — `{}` όταν η τιμή είναι άκυρη.
 *
 * 🔑 **Η ΙΔΙΑ συνάρτηση για αυτόματη ΚΑΙ ρητή αποθήκευση**: η αυτόματη αποθήκευση τρέχει χωρίς
 * το μπλοκ επικύρωσης της ρητής, οπότε αν έστελνε την τιμή αυτούσια, ένα μισογραμμένο `19` θα
 * γραφόταν στο κτίριο πριν ο άνθρωπος τελειώσει. Άκυρη ⇒ **δεν αγγίζεται** το πεδίο· κενή ⇒ `null`
 * («δεν ξέρουμε», ρητά).
 */
export function constructionYearUpdate(
  raw: string,
  referenceYear: number,
): { readonly constructionYear?: number | null } {
  const input = readConstructionYearInput(raw, referenceYear);
  if (input.kind === 'invalid') return {};
  return { constructionYear: input.kind === 'valid' ? input.year : null };
}

// ============================================================================
// ΠΟΙΑ ΠΗΓΗ ΝΙΚΑ
// ============================================================================

/** Ό,τι ξέρουμε για το έτος κατασκευής ενός ακινήτου, πριν αποφασιστεί η δημόσια τιμή. */
export interface ConstructionYearSources {
  /** Η δήλωση στο κτίριο του επαγγελματία — ωμή τιμή όπως ήρθε από το έγγραφο. */
  readonly declared: unknown;
  /** Το γεγονός του δημόσιου κτιρίου (επίπεδο Α), αν υπάρχει δεσμός. */
  readonly publicRecord: { readonly fact: Attested<number>; readonly placeId: string } | null;
}

/**
 * Γεγονός επιπέδου Α → δημόσια εγγραφή, ή `null` αν η πηγή του **δεν είναι μητρώο** (π.χ. δήλωση
 * άλλου χρήστη στο κοινό επίπεδο — ισχυρισμός, όχι εγγραφή).
 */
function publicRecordOf(
  source: ConstructionYearSources['publicRecord'],
  referenceYear: number,
): SourcedAttribute<number> | null {
  if (source === null) return null;
  const registry = source.fact.source;
  if (!isPublicRecordRegistry(registry)) return null;
  if (!isPlausibleConstructionYear(source.fact.value, referenceYear)) return null;
  return {
    provenance: 'public-record',
    value: source.fact.value,
    at: source.fact.attestedAt,
    registry,
    sourceRef: source.placeId,
  };
}

/**
 * **Το δημόσιο έτος κατασκευής της αγγελίας** — ή `null` όταν καμία πηγή δεν ξέρει.
 *
 * @param at Η στιγμή της προβολής (`projectedAt`) — γίνεται το `at` της δήλωσης **και** το
 *   έτος αναφοράς της αληθοφάνειας. Ποτέ ρολόι διαβασμένο εδώ μέσα.
 *
 * ⚠️ **Μη αληθοφανής τιμή ⇒ σαν να μην υπάρχει**, ποτέ «διορθωμένη». Ένα `197` δεν ξέρουμε αν
 * ήταν `1970` ή `1997`· η σιωπή είναι τίμια, η μαντεψιά όχι.
 */
export function resolveListingConstructionYear(
  sources: ConstructionYearSources,
  at: string,
): SourcedAttribute<number> | null {
  const referenceYear = new Date(at).getUTCFullYear();
  const declared: SourcedAttribute<number> | null = isPlausibleConstructionYear(sources.declared, referenceYear)
    ? { provenance: 'declared', value: sources.declared, at }
    : null;
  const publicRecord = publicRecordOf(sources.publicRecord, referenceYear);

  if (publicRecord === null) return declared;
  return preferStrongerAttribute(declared, publicRecord);
}
