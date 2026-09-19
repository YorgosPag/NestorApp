/**
 * @fileoverview **ΟΙ ΧΡΕΩΣΕΙΣ ΠΑΝΩ ΑΠΟ ΤΙΣ ΝΥΧΤΕΣ** — σήμερα η χρέωση κατοικιδίου, σε ακέραια λεπτά.
 * @related ADR-777 §8.60.21.7 · ADR-835 §21 · lib/stay/stay-nightly-quote.ts ·
 *   types/property-offers.ts (`StayPetPolicy` · `PET_FEE_BASES`) · lib/money/money.ts
 * @module lib/stay/stay-quote-fees
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 Η ΠΡΑΚΤΙΚΗ ΤΩΝ ΜΕΓΑΛΩΝ — ΚΑΙ ΠΟΥ ΤΗΝ ΞΕΠΕΡΝΑΜΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Airbnb (Help 3623): τέσσερις τρόποι χρέωσης — *«per booking · per night · per pet · per pet
 * per night»* — και η χρέωση *«shown… in the total price at checkout»*. Η Booking με το
 * `charges_may_apply` **δεν δείχνει καν ποσό** (πληρώνεται στο κατάλυμα)· το Expedia Rapid
 * *«does not… provide pet fee inclusive prices»*. Εδώ η χρέωση είναι **γραμμή του συνόλου**,
 * με **προέλευση** (τιμή μονάδας × μονάδες), ώστε ο επισκέπτης να ελέγξει την αριθμητική.
 *
 * 🔑 **Μία στρογγύλευση**: το ποσό μονάδας περνά σε λεπτά **μία φορά** (`minorFromMajor`) και
 * μετά μόνο ακέραιος πολλαπλασιασμός — ποτέ `ευρώ × μονάδες` σε κινητή υποδιαστολή.
 *
 * ⛔ **Ο σκύλος βοήθειας δεν μετριέται εδώ** — δεν είναι κατοικίδιο (Airbnb: *«service animals
 * always stay for free»* · Expedia Service Animal Policy). Η **απουσία** πεδίου είναι η εγγύηση.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 */

import { minorFromMajor, type MinorAmount } from '@/lib/money/money';
import type { PetFeeBasis, StayPetPolicy } from '@/types/property-offers';

/** Τα είδη χρέωσης πάνω από τις νύχτες — κλειστό σύνολο· αύριο ο καθαρισμός μπαίνει **εδώ**. */
export const STAY_QUOTE_FEE_KINDS = ['pet'] as const;
export type StayQuoteFeeKind = (typeof STAY_QUOTE_FEE_KINDS)[number];

/**
 * **Μία γραμμή χρέωσης, με την αριθμητική της.** `amountMinor === unitMinor × units` — πάντα.
 *
 * 🔑 Η προέλευση ταξιδεύει μαζί με το ποσό: η οθόνη γράφει «10 € × 2 κατοικίδια × 3 νύχτες»
 * χωρίς να ξαναϋπολογίσει τίποτα.
 */
export interface StayQuoteFee {
  readonly kind: StayQuoteFeeKind;
  readonly basis: PetFeeBasis;
  /** Η τιμή μονάδας, σε λεπτά. */
  readonly unitMinor: MinorAmount;
  /** Πόσες μονάδες: 1 · νύχτες · κατοικίδια · κατοικίδια × νύχτες. */
  readonly units: number;
  /** Πόσα κατοικίδια μέτρησε η γραμμή — για την ανάλυση, όχι για αριθμητική. */
  readonly pets: number;
  readonly amountMinor: MinorAmount;
}

/** Η χρέωση κατοικιδίου για μια διαμονή: γραμμή, καμία, ή **αδύνατη** (το ποσό δεν διαβάζεται). */
export type StayPetFeeOutcome =
  | { readonly kind: 'none' }
  | { readonly kind: 'fee'; readonly fee: StayQuoteFee }
  /** Δηλωμένη χρέωση που δεν γίνεται λεπτά — ποτέ σιωπηλό 0. */
  | { readonly kind: 'unpriced' };

const NO_FEE: StayPetFeeOutcome = { kind: 'none' };

/**
 * **Πόσες μονάδες χρεώνονται** — ο ΕΝΑΣ πίνακας των τεσσάρων τρόπων.
 * `Record` πάνω στο κλειστό σύνολο ⇒ νέος τρόπος δεν μεταγλωττίζεται χωρίς απάντηση εδώ.
 */
const UNITS_OF: Readonly<Record<PetFeeBasis, (pets: number, nights: number) => number>> = {
  stay: () => 1,
  night: (_pets, nights) => nights,
  pet: (pets) => pets,
  petNight: (pets, nights) => pets * nights,
};

/** Πόσες μονάδες για τον τρόπο `basis` — εκτεθειμένο για την άγκυρα, όχι για δεύτερο υπολογισμό. */
export function petFeeUnits(basis: PetFeeBasis, pets: number, nights: number): number {
  return UNITS_OF[basis](pets, nights);
}

/**
 * **Η χρέωση κατοικιδίου** για `pets` κατοικίδια σε `nights` νύχτες.
 *
 * Καμία γραμμή όταν: δεν φέρνει κατοικίδιο (`null`/`0`) · η πολιτική δεν δηλώθηκε ή λέει «όχι»
 * (ο **κριτής** `petsVerdict` ονομάζει ήδη το εμπόδιο — εδώ δεν κρίνεται δεύτερη φορά) · ή ο
 * κάτοχος **δεν** χρεώνει (`fee: null`). Το «κατόπιν συνεννόησης» **χρεώνει**: η τιμή ισχύει αν
 * δεχτεί ο οικοδεσπότης, και ο επισκέπτης πρέπει να την ξέρει **πριν** ζητήσει.
 */
export function petFeeOf(policy: StayPetPolicy | null, pets: number | null | undefined, nights: number): StayPetFeeOutcome {
  if (pets === null || pets === undefined || pets < 1) return NO_FEE;
  if (policy === null || policy.accepts === 'no' || policy.fee === null) return NO_FEE;
  const unitMinor = minorFromMajor(policy.fee.amount);
  if (unitMinor === null || unitMinor === 0) return { kind: 'unpriced' };
  const units = petFeeUnits(policy.fee.per, pets, nights);
  const amountMinor = unitMinor * units;
  if (!Number.isSafeInteger(amountMinor)) return { kind: 'unpriced' };
  return { kind: 'fee', fee: { kind: 'pet', basis: policy.fee.per, unitMinor, units, pets, amountMinor } };
}
