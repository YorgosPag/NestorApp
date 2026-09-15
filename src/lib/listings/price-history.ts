/**
 * @fileoverview **Η ΚΡΙΣΗ «ΜΕΙΩΘΗΚΕ Η ΤΙΜΗ;»** — καθαρή, χωρίς Firestore, χωρίς ρολόι.
 * @related ADR-777 §8.69 · types/price-history.ts · services/listings/price-history-stamp.ts
 * @module lib/listings/price-history
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΡΕΙΣ ΕΡΩΤΗΣΕΙΣ, ΜΙΑ ΘΕΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Ερώτηση | Συνάρτηση | Καλών |
 * |---|---|---|
 * | «άλλαξε η κατάσταση αγοράς; τι γράφω;» | {@link nextPriceHistory} | η σφραγίδα |
 * | «ποια μείωση ισχύει;» | {@link reductionForListing} | η προβολή |
 * | «δείχνεται ακόμη;» | {@link isReductionFresh} | η οθόνη · ο ειδοποιητής |
 *
 * ⛔ **Καμία από τις τρεις δεν ξαναγράφεται αλλού.** Ένας δεύτερος υπολογισμός
 * «μείωσης» στην οθόνη ή στο email θα ήταν το σχήμα του ADR-749: δύο κριτές που
 * διαφωνούν ακριβώς στο όριο των 30 ημερών ή του 2%.
 *
 * 🔴 **Η ΤΙΜΗ ΛΥΝΕΤΑΙ ΜΟΝΟ ΑΠΟ ΤΟΝ `price-resolver`** — ποτέ ωμό `askingPrice`. Αλλιώς
 * ένα `for-sale-and-rent` θα κατέγραφε το λάθος σκέλος, και ένα `sold` θα σύγκρινε
 * τιμή συμβολαίου με ζητούμενη.
 */

import { z } from 'zod';

import { MS_PER_DAY } from '@/lib/date-local';
import {
  resolveDisplayPrice,
  type PriceRole,
  type PricedPropertyLike,
} from '@/lib/properties/price-resolver';
import type { PriceObservation, PriceReduction } from '@/types/price-history';

// ============================================================================
// ΟΙ ΣΤΑΘΕΡΕΣ — μία θέση
// ============================================================================

/** Το παράθυρο αναφοράς του κανόνα Omnibus — και η διάρκεια ζωής της σήμανσης. */
export const PRICE_REDUCTION_WINDOW_DAYS = 30;

/**
 * **Το κατώφλι: 2%** (απόφαση Giorgio 2026-09-15 · Rightmove, ADR-777 §8.22.6).
 * Σε μονάδες βάσης, ώστε η σύγκριση να είναι **ακέραιη** και όχι κινητής υποδιαστολής.
 */
export const PRICE_REDUCTION_MIN_BASIS_POINTS = 200;

/** Πόσο πίσω κρατιέται το ιστορικό — πολύ πέρα από το παράθυρο, για τη διάγνωση. */
export const PRICE_HISTORY_RETENTION_DAYS = 180;

/** Άνω φράγμα εγγραφών — ένα έγγραφο ακινήτου δεν μεγαλώνει ποτέ χωρίς όριο. */
export const PRICE_HISTORY_MAX_ENTRIES = 24;

/**
 * Οι ρόλοι τιμής ως **εξαντλητικός** πίνακας: τέταρτος ρόλος στο `PriceRole` δεν
 * μεταγλωττίζεται εδώ μέχρι να δηλωθεί — ίδιο ιδίωμα με το `ANSWER_WHERE_LEGACY_IS_SILENT`.
 */
const PRICE_ROLE_TABLE: Readonly<Record<PriceRole, true>> = { sale: true, rent: true, nightly: true };
const PRICE_ROLES = Object.keys(PRICE_ROLE_TABLE) as [PriceRole, ...PriceRole[]];

// ============================================================================
// ΑΝΑΓΝΩΣΗ — το σύνορο του αποθηκευμένου
// ============================================================================

const isoInstant = z
  .string()
  .trim()
  .min(1)
  .refine((value) => Number.isFinite(Date.parse(value)));

const marketPriceShape = z.object({
  role: z.enum(PRICE_ROLES),
  amount: z.number().finite().positive(),
});

const observationShape = z.object({ at: isoInstant, price: marketPriceShape.nullable() });

/**
 * **Το σχήμα της δημόσιας μείωσης** — εξάγεται για τον κρίκο v11 του
 * `public-listing-schema.ts`, ώστε η μετανάστευση να ρωτά **τον ίδιο** κριτή μορφής.
 */
export const priceReductionShape = z.object({
  role: z.enum(PRICE_ROLES),
  from: z.number().finite().positive(),
  to: z.number().finite().positive(),
  dropBasisPoints: z.number().int().min(PRICE_REDUCTION_MIN_BASIS_POINTS),
  since: isoInstant,
});

/**
 * **Το αποθηκευμένο ιστορικό** — ή κενό, όταν λείπει ή δεν στέκει.
 *
 * ⚠️ **Σκουπίδι ⇒ κενό, και είναι η ΣΥΝΤΗΡΗΤΙΚΗ κατεύθυνση**: κενό ιστορικό δεν
 * γεννά **ποτέ** μείωση. Ένα ιστορικό που δεν μπορούμε να διαβάσουμε δεν επιτρέπεται
 * να στηρίξει ισχυρισμό «ήταν X €» στον κόσμο.
 *
 * 🔑 **Ταξινομείται κατά χρόνο** — η κρίση υποθέτει διάστημα ισχύος «μέχρι την επόμενη
 * παρατήρηση», και μια αναποδογυρισμένη σειρά θα έδινε αρνητικά διαστήματα.
 */
export function readPriceHistory(value: unknown): readonly PriceObservation[] {
  const parsed = z.array(observationShape).safeParse(value);
  if (!parsed.success) return [];
  return [...parsed.data].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/** **Η αποθηκευμένη δημόσια μείωση** — ή `null`. Ο ίδιος κριτής μορφής με τον κρίκο v11. */
export function readPriceReduction(value: unknown): PriceReduction | null {
  const parsed = priceReductionShape.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// ============================================================================
// Η ΚΑΤΑΣΤΑΣΗ ΑΓΟΡΑΣ ΕΝΟΣ ΑΚΙΝΗΤΟΥ
// ============================================================================

/** Η τιμή που **δείχνει** μια αγγελία — από τον ΕΝΑ `price-resolver`, ή `null`. */
function headlineOf(input: PricedPropertyLike): PriceObservation['price'] {
  const display = resolveDisplayPrice(input);
  if (display.kind !== 'priced') return null;
  return { role: display.headline.role, amount: display.headline.amount };
}

/**
 * **Τι βλέπει η αγορά αυτή τη στιγμή** — η τιμή της αγγελίας, ή `null` αν δεν είναι
 * δημόσια.
 *
 * ⚠️ **Το «δημόσια;» ΔΕΝ κρίνεται εδώ** — έρχεται ως όρισμα από το `isPubliclyListed`,
 * τον **έναν** κριτή δημοσίευσης. Δεύτερος κριτής εδώ θα κατέγραφε τιμές σε αγορά που
 * η αγγελία δεν μπήκε ποτέ.
 */
export function marketPriceOf(
  input: PricedPropertyLike,
  publiclyListed: boolean,
): PriceObservation['price'] {
  return publiclyListed ? headlineOf(input) : null;
}

function samePrice(a: PriceObservation['price'], b: PriceObservation['price']): boolean {
  if (a === null || b === null) return a === b;
  return a.role === b.role && a.amount === b.amount;
}

// ============================================================================
// Η ΕΓΓΡΑΦΗ — τι προστίθεται, και τι κρατιέται
// ============================================================================

/**
 * **Το ιστορικό μετά από αυτό το πέρασμα** — ή `null` όταν **δεν αλλάζει τίποτα**.
 *
 * 🔑 **Το `null` είναι η βελτιστοποίηση που κάνει τη σφραγίδα δωρεάν**: μια αποθήκευση
 * που δεν άγγιξε την τιμή δεν ανοίγει καν συναλλαγή. Είναι το ίδιο συμβόλαιο με το
 * `resolveListedAt` — *«μηδέν επιπλέον ανάγνωση για ώριμη αγγελία»*.
 *
 * ⚠️ **Ακίνητο που δεν μπήκε ΠΟΤΕ στην αγορά δεν αποκτά ιστορικό**: κενό ιστορικό +
 * «εκτός αγοράς» ⇒ `null`. Αλλιώς κάθε πρόχειρο θα γέμιζε εγγραφές «εκτός αγοράς».
 *
 * 🔴 **Ιστορικό μόνο προς τα εμπρός στον χρόνο.** Ένα πέρασμα με στιγμή **παλαιότερη** από
 * την τελευταία παρατήρηση (δύο γραφείς σε αγώνα, ρολόι που γύρισε πίσω) **δεν γράφει**:
 * η νεότερη αλήθεια δεν ξαναγράφεται από παλαιότερη.
 */
export function nextPriceHistory(
  history: readonly PriceObservation[],
  price: PriceObservation['price'],
  at: string,
): readonly PriceObservation[] | null {
  const last = history.at(-1);
  if (last === undefined && price === null) return null;
  if (last !== undefined && samePrice(last.price, price)) return null;
  if (last !== undefined && Date.parse(at) <= Date.parse(last.at)) return null;

  return pruneHistory([...history, { at, price }], at);
}

/**
 * Κρατά ό,τι είναι μέσα στο {@link PRICE_HISTORY_RETENTION_DAYS} **και** την τελευταία
 * παρατήρηση πριν από αυτό — δηλαδή την τιμή που **ίσχυε** τη στιγμή της αποκοπής.
 * Χωρίς αυτήν, το πρώτο διάστημα του παραθύρου θα έμενε **χωρίς τιμή**.
 */
function pruneHistory(
  entries: readonly PriceObservation[],
  at: string,
): readonly PriceObservation[] {
  const cutoff = Date.parse(at) - PRICE_HISTORY_RETENTION_DAYS * MS_PER_DAY;
  const firstInside = entries.findIndex((entry) => Date.parse(entry.at) >= cutoff);
  const start = firstInside <= 0 ? Math.max(0, firstInside) : firstInside - 1;
  return entries.slice(start).slice(-PRICE_HISTORY_MAX_ENTRIES);
}

// ============================================================================
// Η ΚΡΙΣΗ — ο κανόνας των 30 ημερών
// ============================================================================

/**
 * **Η χαμηλότερη τιμή του ίδιου ρόλου που ίσχυσε μέσα στο παράθυρο** — ή `null`.
 *
 * 🔑 Κάθε παρατήρηση ισχύει **από το `at` της μέχρι το `at` της επόμενης**. Μετρά αν το
 * διάστημα αυτό **αγγίζει** το παράθυρο — άρα μετρά και η τιμή που ίσχυε ήδη **πριν**
 * ανοίξει το παράθυρο και συνέχιζε μέσα σε αυτό. Αυτός είναι ο ορισμός της ΔΕΕ
 * (*ALDI SÜD*): *«η χαμηλότερη τιμή που εφαρμόστηκε»*, όχι *«που καταχωρίστηκε»*.
 *
 * ⚠️ **Διάστημα «εκτός αγοράς» δεν είναι τιμή** — παραλείπεται. Τιμή που ίσχυε πριν
 * από μακρά απόσυρση **δεν** φτάνει στο παράθυρο, γιατί το διάστημά της **έκλεισε** με
 * την απόσυρση.
 */
function lowestInWindow(
  prior: readonly PriceObservation[],
  currentAt: string,
  role: PriceRole,
  windowStartMs: number,
): number | null {
  let lowest: number | null = null;
  prior.forEach((observation, index) => {
    const validUntilMs = Date.parse(prior[index + 1]?.at ?? currentAt);
    if (observation.price === null || observation.price.role !== role) return;
    if (validUntilMs <= windowStartMs) return;
    lowest = lowest === null ? observation.price.amount : Math.min(lowest, observation.price.amount);
  });
  return lowest;
}

/**
 * **Η μείωση που προκύπτει από το ιστορικό** — ή `null`.
 *
 * Μείωση υπάρχει **μόνο** όταν:
 * 1. η τρέχουσα κατάσταση είναι **τιμή** (όχι «εκτός αγοράς»),
 * 2. υπάρχει τιμή **ίδιου ρόλου** στις 30 ημέρες πριν (αλλαγή ρόλου ≠ μείωση),
 * 3. η τρέχουσα είναι **κάτω από τη χαμηλότερη** από αυτές,
 * 4. η διαφορά είναι **≥ 2%**.
 *
 * 🏆 **Γι' αυτό το «ανεβάζω και κατεβάζω» είναι άκαρπο**: 300.000 → 330.000 → 300.000
 * δίνει αναφορά **300.000** (η χαμηλότερη), άρα καμία μείωση.
 */
export function priceReductionOf(history: readonly PriceObservation[]): PriceReduction | null {
  const current = history.at(-1);
  if (current?.price == null) return null;

  const windowStartMs = Date.parse(current.at) - PRICE_REDUCTION_WINDOW_DAYS * MS_PER_DAY;
  const { role, amount } = current.price;
  const reference = lowestInWindow(history.slice(0, -1), current.at, role, windowStartMs);
  if (reference === null || amount >= reference) return null;

  const dropBasisPoints = Math.floor(((reference - amount) * 10_000) / reference);
  if (dropBasisPoints < PRICE_REDUCTION_MIN_BASIS_POINTS) return null;

  return { role, from: reference, to: amount, dropBasisPoints, since: current.at };
}

/**
 * **Η μείωση που γράφεται στη δημόσια αγγελία** — μόνο αν λέει την **ίδια** τιμή με την
 * αγγελία.
 *
 * 🔴 **ΤΟ ΔΙΧΤΥ (N.7.2 #4)**: αν η σφραγίδα απέτυχε, το ιστορικό μένει **πίσω** και η
 * τελευταία του παρατήρηση **δεν** είναι η τρέχουσα τιμή. Χωρίς αυτόν τον έλεγχο η
 * κάρτα θα έγραφε *«3.200.000 € ↓8%»* δίπλα σε αγγελία που ζητά **3.100.000 €**.
 * Ασυμφωνία ⇒ **καμία** μείωση: η σιωπή είναι αληθής, το λάθος ποσό όχι.
 */
export function reductionForListing(
  storedHistory: unknown,
  listing: PricedPropertyLike,
): PriceReduction | null {
  const headline = headlineOf(listing);
  const reduction = priceReductionOf(readPriceHistory(storedHistory));
  if (headline === null || reduction === null) return null;
  return reduction.role === headline.role && reduction.to === headline.amount ? reduction : null;
}

/**
 * **Δείχνεται ακόμη η μείωση;** — όσο δεν πέρασαν 30 ημέρες από τη στιγμή που ίσχυσε.
 *
 * ⚠️ **Το «τώρα» είναι όρισμα** — ίδιο συμβόλαιο με όλη τη μηχανή ζήτησης: μια κρίση που
 * αλλάζει απάντηση ανάλογα με το πότε τρέχει η δοκιμή δεν είναι αναπαραγώγιμη.
 */
export function isReductionFresh(reduction: PriceReduction, nowMs: number): boolean {
  const sinceMs = Date.parse(reduction.since);
  return Number.isFinite(sinceMs) && nowMs - sinceMs <= PRICE_REDUCTION_WINDOW_DAYS * MS_PER_DAY;
}
