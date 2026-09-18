/**
 * @fileoverview **Το σύνολο μιας διαμονής, όπως το δείχνει η αναζήτηση με ημερομηνίες.**
 * @related ADR-777 §8.60.12 · ADR-835 §21 · lib/stay/stay-nightly-quote.ts
 * @module lib/listings/listing-stay-total
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 Η ΠΡΑΚΤΙΚΗ ΤΟΥ AIRBNB — ΚΑΙ ΤΟ ΣΗΜΕΙΟ ΟΠΟΥ ΤΗΝ ΞΕΠΕΡΝΑΜΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Από 2025-04 το Airbnb δείχνει **παντού** (λίστα, χάρτης) το **σύνολο** της διαμονής
 * όταν ο επισκέπτης έχει δώσει ημερομηνίες — όχι την τιμή ανά νύχτα, που δεν απαντά
 * *«πόσο θα πληρώσω;»*. Εμείς κάνουμε το ίδιο, με δύο διαφορές **υπέρ** του επισκέπτη:
 *
 * 1. **Γράφουμε ΚΑΙ τις νύχτες** («150 € · 3 νύχτες»): σε χάρτη που ανακατεύει πώληση
 *    και μίσθωμα, ένα σκέτο «150 €» θα διαβαζόταν ως τιμή πώλησης ή ενοίκιο.
 * 2. **Σύνολο ΜΟΝΟ όταν η απάντηση είναι `free`.** Μια τιμή διαμονής για ημερομηνίες που
 *    το κατάλυμα **δεν** δέχεται είναι αριθμός για κάτι που δεν μπορείς να αγοράσεις.
 *    Τότε μένει η τιμή ανά νύχτα — και η γραμμή λογιστικής λέει ήδη **γιατί**.
 *
 * ⚠️ **Ο υπολογισμός δεν γίνεται εδώ.** Το σύνολο το έχει ήδη υπολογίσει ο διακομιστής
 * (`stayQuoteOf`, σε ακέραια λεπτά, με υπερβάσεις ανά ημέρα) και φτάνει μέσα στην
 * απάντηση του `POST /api/public-listings/stay-availability`. Εδώ γίνεται μόνο **επιλογή**
 * — δεύτερη αριθμητική θα ήταν δεύτερη απάντηση στο *«πόσο κάνει;»*.
 */

import type { MinorAmount } from '@/lib/money/money';
import type { StayQuery } from '@/lib/stay/stay-availability-vocabulary';
import type { PublicStayAnswer } from '@/lib/stay/stay-public-request';
import type { PublicListing } from '@/types/public-listing';

/** Το σύνολο μιας διαμονής που **μπορεί** να γίνει: ποσό και πλήθος νυχτών. */
export interface StayTotal {
  readonly totalMinor: MinorAmount;
  readonly nights: number;
}

/** `listingId` → σύνολο, **μόνο** για αγγελίες με διαθέσιμη και τιμολογημένη διαμονή. */
export type StayTotals = Readonly<Record<string, StayTotal>>;

/**
 * Οι απαντήσεις που **πουλιούνται** σε αυτές τις ημερομηνίες χωρίς αίρεση πώλησης: `free` και —από
 * το §8.60.21— `pets-on-request` (ελεύθερο· μόνο το κατοικίδιο θέλει συνεννόηση, η τιμή ισχύει).
 */
const TOTALLED_KINDS: ReadonlySet<PublicStayAnswer['answer']['kind']> = new Set(['free', 'pets-on-request']);

/** Καμία ερώτηση ημερομηνιών ⇒ κανένα σύνολο. Ένα κοινό αντικείμενο, όχι νέο ανά απόδοση. */
export const NO_STAY_TOTALS: StayTotals = Object.freeze({});

/**
 * Η απάντηση μιας αγγελίας → σύνολο, ή `null` όταν **δεν** πρέπει να δειχθεί.
 *
 * 🔴 **Δύο φρουροί, και ο καθένας κόβει άλλο ψέμα**: `answer.kind !== 'free'` ⇒ τιμή για
 * ημερομηνίες που δεν πουλιούνται · `quote.kind !== 'priced'` ⇒ σύνολο με νύχτες **χωρίς**
 * τιμή (ο κριτής τις ονομάζει στο `missing`· ένα μερικό άθροισμα θα ήταν φθηνότερο ψέμα).
 */
export function stayTotalOf(stay: PublicStayAnswer | undefined): StayTotal | null {
  if (stay === undefined || !TOTALLED_KINDS.has(stay.answer.kind)) return null;
  if (stay.quote === null || stay.quote.kind !== 'priced') return null;
  if (stay.quote.nights.length === 0) return null;
  return { totalMinor: stay.quote.totalMinor, nights: stay.quote.nights.length };
}

/**
 * Αγγελίες όπου το σύνολο **δεν θα ήταν ολόκληρο**: ο επισκέπτης φέρνει κατοικίδιο και ο κάτοχος
 * χρεώνει (ADR-777 §8.60.21). Η χρέωση δεν μπαίνει ακόμη στο σύνολο του διακομιστή (δηλωμένο
 * όριο, Φ5) ⇒ **κανένα σύνολο** — ίδιος λόγος με το `unpriced`: μερικό άθροισμα = φθηνότερο ψέμα.
 * Η σελίδα της αγγελίας λέει τη χρέωση ρητά.
 */
export function listingsWithUnpricedPetFee(
  listings: readonly PublicListing[],
  query: StayQuery | null,
): ReadonlySet<string> {
  const pets = query?.pets ?? null;
  if (pets === null || pets <= 0) return NO_LISTINGS;
  const charged = listings.filter((listing) => {
    const policy = listing.stay?.pets ?? null;
    return policy !== null && policy.accepts !== 'no' && policy.fee !== null;
  });
  return new Set(charged.map((listing) => listing.id));
}

const NO_LISTINGS: ReadonlySet<string> = new Set();

/** Όλες οι απαντήσεις → πίνακας συνόλων. Αγγελίες χωρίς σύνολο **λείπουν** από τον πίνακα. */
export function stayTotalsOf(
  answers: Readonly<Record<string, PublicStayAnswer>>,
  incomplete: ReadonlySet<string> = NO_LISTINGS,
): StayTotals {
  const totals: Record<string, StayTotal> = {};
  for (const [listingId, stay] of Object.entries(answers)) {
    if (incomplete.has(listingId)) continue;
    const total = stayTotalOf(stay);
    if (total !== null) totals[listingId] = total;
  }
  return totals;
}
