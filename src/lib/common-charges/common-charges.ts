/**
 * @fileoverview **Τα κοινόχρηστα μιας αγγελίας** — πόσα τον μήνα, και τι περιλαμβάνουν (ADR-777 §8.93).
 * @related `services/listings/public-listing-projection.ts` (η προβολή — καλεί το `listedCommonChargesOf`) ·
 *   `lib/listings/public-listing-migrations-21-30.ts` (ο κρίκος 21, ίδιος κριτής) ·
 *   `services/owner-property/owner-property-common-charges.service.ts` (ο γραφέας του ιδιώτη) ·
 *   `components/listing-detail/ListingCommonCharges.tsx` (η οθόνη του κοινού)
 * @module lib/common-charges/common-charges
 *
 * 🔑 **ΕΝΑ μπλοκ για ιδιώτη ΚΑΙ εταιρεία**: ο ίδιος τύπος, ο ίδιος αναγνώστης, ο ίδιος κριτής «τίθεται η ερώτηση;».
 *
 * 🔑 **Τρεις απαντήσεις για το ποσό, και δεν λιώνουν σε δύο**: `null` = κανείς δεν το δήλωσε · `0` = **χωρίς
 * κοινόχρηστα** (πραγματική απάντηση — μονοκατοικία, διπλοκατοικία χωρίς κοινά) · `> 0` = τόσα τον μήνα.
 *
 * 🔑 **Τρεις καταστάσεις και για το «τι περιλαμβάνουν»** (ίδιο ιδίωμα με τα σύνολα του ADR-842): `null` = δεν
 * ρωτήθηκε · `[]` = ρωτήθηκε, τίποτα από τον κατάλογο · `[…]`. Πρότυπο το RESO `AssociationFeeIncludes`· η τιμή που
 * κρίνει τον αριθμό στην Ελλάδα είναι η **θέρμανση** (40 € έναντι 200 € τον μήνα για το ίδιο διαμέρισμα).
 *
 * ⚠️ **Δήλωση του αγγελιοδότη, κατά προσέγγιση**: τα κοινόχρηστα κυμαίνονται εποχικά, γι' αυτό το ποσό είναι σε
 * **ακέραια ευρώ** — τα λεπτά θα ήταν ακρίβεια που κανείς δεν έχει.
 */

import { z } from 'zod';

import { isLandProperty } from '@/constants/property-classification';
import { isPlainRecord } from '@/lib/type-guards';

/** Τι μπορεί να περιλαμβάνουν — η λίστα είναι η πηγή, και η σειρά της είναι η σειρά στην οθόνη. */
export const COMMON_CHARGE_INCLUSIONS = [
  'heating',
  'water',
  'elevator',
  'cleaning',
  'commonElectricity',
  'garden',
  'concierge',
  'pool',
] as const;
export type CommonChargeInclusion = (typeof COMMON_CHARGE_INCLUSIONS)[number];

/** Άνω όριο λογικής — πάνω από αυτό είναι λάθος πληκτρολόγησης (ετήσιο ποσό, ή το ενοίκιο στο λάθος πεδίο). */
export const MAX_COMMON_CHARGES_MONTHLY = 5000;

export interface CommonCharges {
  /** Ακέραια ευρώ τον μήνα. `null` = δεν δηλώθηκε · `0` = χωρίς κοινόχρηστα. */
  readonly monthlyAmount: number | null;
  /** `null` = δεν ρωτήθηκε · `[]` = τίποτα από τον κατάλογο. **Μόνο** με θετικό ποσό — αλλιώς `null`. */
  readonly includes: readonly CommonChargeInclusion[] | null;
}

export const UNDECLARED_COMMON_CHARGES: CommonCharges = { monthlyAmount: null, includes: null };

// ============================================================================
// ΑΝΑΓΝΩΣΗ — αυστηρή ανά πεδίο: άκυρη τιμή ⇒ `null` (ποτέ ρίψη, ποτέ «διόρθωση»)
// ============================================================================

export function isCommonChargesAmount(raw: unknown): raw is number {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= MAX_COMMON_CHARGES_MONTHLY;
}

/**
 * Στη σειρά του καταλόγου, με τις διπλές συμπτυγμένες (σύνολο, όχι λίστα)· πίνακας με έστω μία **άγνωστη** τιμή ⇒
 * `null` — ποτέ μισή απάντηση.
 */
function inclusionsOf(raw: unknown): readonly CommonChargeInclusion[] | null {
  if (!Array.isArray(raw)) return null;
  const known = COMMON_CHARGE_INCLUSIONS.filter((inclusion) => raw.includes(inclusion));
  return new Set(raw).size === known.length ? known : null;
}

/**
 * Ό,τι είναι αποθηκευμένο (ή λείπει) → κανονικοποιημένο μπλοκ. Το σύνορο ανάγνωσης κάθε εγγράφου το καλεί.
 *
 * ⚠️ **Ποτέ ορφανός προσδιοριστής** (ίδιος κανόνας με είδος στάθμης χωρίς αριθμό, ADR-903): «περιλαμβάνουν θέρμανση»
 * χωρίς ποσό, ή δίπλα σε «χωρίς κοινόχρηστα», δεν προσδιορίζει τίποτα ⇒ `null`.
 */
export function readCommonCharges(raw: unknown): CommonCharges {
  const record = isPlainRecord(raw) ? raw : {};
  const monthlyAmount = isCommonChargesAmount(record.monthlyAmount) ? record.monthlyAmount : null;
  const qualified = monthlyAmount !== null && monthlyAmount > 0;
  return { monthlyAmount, includes: qualified ? inclusionsOf(record.includes) : null };
}

// ============================================================================
// ΔΙΟΡΘΩΣΗ — μερική: αλλάζουν ΜΟΝΟ τα κλειδιά που στάλθηκαν· ρητό `null` = «σβήσε την απάντηση»
// ============================================================================

const amountSchema = z.number().refine(isCommonChargesAmount);
const inclusionsSchema = z.array(z.enum(COMMON_CHARGE_INCLUSIONS));

/** Ολόκληρο το μπλοκ — η φόρμα της εταιρείας το στέλνει ακέραιο. `.strict()`: άγνωστο κλειδί ⇒ απόρριψη. */
export const commonChargesSchema = z
  .object({ monthlyAmount: amountSchema.nullable(), includes: inclusionsSchema.nullable() })
  .strict();

/**
 * Το μπλοκ **όπως θα αποθηκευτεί** — περασμένο από τον ΕΝΑΝ αναγνώστη, ώστε η γενική διαδρομή του γραφείου (που
 * γράφει το σώμα αυτούσιο) να μην αφήσει ποτέ ορφανό «τι περιλαμβάνουν» στο έγγραφο.
 */
export const storedCommonChargesSchema = commonChargesSchema.transform((block) => readCommonCharges(block));

/** Η μερική διόρθωση — η οθόνη «Βελτίωσε την αγγελία σου» αποθηκεύει κάθε απάντηση χωριστά. */
export const commonChargesPatchSchema = commonChargesSchema
  .partial()
  .strict()
  .refine((patch) => Object.keys(patch).length > 0);

export type CommonChargesPatch = z.infer<typeof commonChargesPatchSchema>;

/** Η ίδια συνάρτηση στον server και στην αισιόδοξη επικάλυψη της οθόνης — καμία δεύτερη αλήθεια. */
export function applyCommonChargesPatch(current: CommonCharges, patch: CommonChargesPatch): CommonCharges {
  return readCommonCharges({ ...current, ...patch });
}

/** Ίδια δήλωση; Και τα δύο μπλοκ είναι κανονικοποιημένα (ίδια σειρά, χωρίς διπλές) ⇒ αρκεί σύγκριση ανά θέση. */
export function sameCommonCharges(a: CommonCharges, b: CommonCharges): boolean {
  if (a.monthlyAmount !== b.monthlyAmount) return false;
  if (a.includes === null || b.includes === null) return a.includes === b.includes;
  return a.includes.length === b.includes.length && a.includes.every((inclusion, index) => inclusion === b.includes?.[index]);
}

// ============================================================================
// Ο ΚΡΙΤΗΣ — «τίθεται η ερώτηση για αυτή την αγγελία;»
// ============================================================================

/** Ό,τι χρειάζεται ο κριτής — δομικό, ώστε να τον τρέφει και η προβολή και ένα παλιό αποθηκευμένο έγγραφο. */
export interface CommonChargesSubject {
  readonly type: unknown;
  readonly offerKinds: readonly unknown[];
}

/** Οι διαθέσεις όπου ο ενδιαφερόμενος θα πληρώνει κοινόχρηστα: αγορά και μακροχρόνια μίσθωση. */
const CHARGE_BEARING_OFFER_KINDS: readonly unknown[] = ['sell', 'leaseOut'];

/**
 * **Ο ΕΝΑΣ κριτής.** Η γη δεν έχει κοινόχρηστα· ο επισκέπτης βραχυχρόνιας δεν τα πληρώνει· η αντιπαροχή αφορά
 * οικόπεδο. Εκεί η γραμμή **δεν υπάρχει** — ένα «Δεν έχουν δηλωθεί» θα κατηγορούσε τον κάτοχο για πεδίο που δεν
 * του ζητήθηκε ποτέ (ίδιο μάθημα με «η γη δεν κρίνεται σε υπνοδωμάτια», ADR-777 §8.32).
 */
export function raisesCommonChargesQuestion({ type, offerKinds }: CommonChargesSubject): boolean {
  return !isLandProperty(type) && offerKinds.some((kind) => CHARGE_BEARING_OFFER_KINDS.includes(kind));
}

/**
 * **Το κουτί της δημόσιας αγγελίας**: `null` ⇔ η ερώτηση δεν τίθεται· αλλιώς ό,τι δηλώθηκε, από τον ΕΝΑΝ αναγνώστη.
 * Το καλούν η προβολή **και** ο κρίκος του σχήματος — ώστε παλιό και νέο έγγραφο να απαντούν το ίδιο.
 */
export function listedCommonChargesOf(subject: CommonChargesSubject, raw: unknown): CommonCharges | null {
  return raisesCommonChargesQuestion(subject) ? readCommonCharges(raw) : null;
}

// ============================================================================
// ΤΟ ΣΥΝΟΛΟ ΑΝΑ ΜΗΝΑ — ενοίκιο + κοινόχρηστα
// ============================================================================

/**
 * Τι θα φεύγει κάθε μήνα. `null` όταν τα κοινόχρηστα δεν είναι **θετικό** ποσό: αδήλωτα ⇒ το σύνολο θα ήταν
 * ισχυρισμός· μηδενικά ⇒ θα επαναλάμβανε το ενοίκιο («το ίδιο γεγονός δύο φορές»).
 */
export function monthlyOutlay(rentAmount: number, charges: CommonCharges | null): number | null {
  const amount = charges?.monthlyAmount ?? null;
  return amount !== null && amount > 0 ? rentAmount + amount : null;
}
