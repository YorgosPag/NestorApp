/**
 * @fileoverview **ΟΙ ΚΛΑΣΕΙΣ ΣΥΓΚΡΙΣΙΜΟΤΗΤΑΣ ΤΗΣ ΤΙΜΗΣ** — ποια ποσά επιτρέπεται να συγκριθούν.
 * @related ADR-777 §8.60.14 · ADR-835 §4.4 · lib/listings/listing-results-order.ts
 * @module lib/listings/listing-price-sections
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΡΩΤΗΜΑ ΠΟΥ ΑΠΑΝΤΑ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ, ΚΑΙ ΜΟΝΟ ΑΥΤΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * *«Ποια ποσά είναι ΣΥΓΚΡΙΣΙΜΑ μεταξύ τους — και τι κάνουμε με όσα δεν είναι;»*
 *
 * Ο Νέστωρ δείχνει **πώληση, μίσθωμα και διανυκτέρευση στην ΙΔΙΑ οθόνη**. Ως τις
 * 2026-09-17 η «τιμή ↑» έβαζε σε **έναν** άξονα `50 €/νύχτα`, `900 €/μήνα` και
 * `170.000 €` πώλησης. Δεν είναι σφάλμα μορφοποίησης: **δεν είναι σύγκριση**.
 *
 * 🔑 Ποσά διαφορετικού ρόλου είναι **ΑΣΥΓΚΡΙΤΑ** ⇒ η «σειρά κατά τιμή» είναι **μερική**
 * διάταξη, όχι ολική — και μια μερική διάταξη **δεν γίνεται επίπεδη λίστα χωρίς να
 * εφευρεθεί κάτι**. Τα τμήματα εδώ είναι ακριβώς οι **κλάσεις συγκρισιμότητας**: δεν
 * προσθέτουν απόφαση, **αποκαλύπτουν** αυτήν που ήδη υπήρχε κρυμμένη.
 *
 * ⚠️ **ΓΙΑΤΙ ΧΩΡΙΣΤΟ ΑΡΧΕΙΟ ΑΠΟ ΤΟΝ `listing-results-order.ts`** (N.7.1, 500 γραμμές):
 * εκείνο απαντά *«ΠΟΙΕΣ σειρές προσφέρονται και πώς ζουν στη διεύθυνση»* — κλειστό
 * λεξιλόγιο, προεπιλογή, κωδικοποιητής URL. Αυτό απαντά *«ΠΟΙΑ ποσά μπαίνουν στον ίδιο
 * άξονα»* — κανόνας του **τομέα**, που θα ίσχυε ακόμη κι αν η οθόνη δεν πρόσφερε καμία
 * επιλογή σειράς. Δύο ερωτήσεις, δύο αρχεία· **ένας** εξαγόμενος δρόμος
 * ({@link orderResultsListings}) που τις ενώνει.
 *
 * ⛔ **ΜΗΝ γεννήσεις εδώ δεύτερο κλειδί τιμής.** Ο ρόλος και το ποσό έρχονται **και τα
 * δύο** από τον ΕΝΑ κριτή (`resolveDisplayPrice`) — τον ίδιο που ζωγραφίζει την τιμή σε
 * κάρτα, φούσκα, δείκτη άκρης και πινακίδα χάρτη.
 */

import { compareSortValues, type SortDirection } from '@/lib/array-utils';
import { compareByNameThenId } from '@/lib/ordering/total-name-order';
import {
  PRICE_ROLE_ORDER,
  resolveDisplayPrice,
  type PriceClass,
  type PriceRole,
} from '@/lib/properties/price-resolver';
import { NO_STAY_TOTALS, type StayTotals } from '@/lib/listings/listing-stay-total';
import type { PublicListing } from '@/types/public-listing';

// ============================================================================
// ΤΑ ΤΜΗΜΑΤΑ — οι κλάσεις συγκρισιμότητας
// ============================================================================

/**
 * **Η κλάση στην οποία ανήκει ένα τμήμα** — ο ρόλος του ποσού, ή η ρητή απουσία ποσού.
 *
 * 🔑 **Δεν δηλώνεται εδώ**: είναι το {@link PriceClass} του `price-resolver`, δηλαδή του
 * ιδιοκτήτη του λεξιλογίου. Το ίδιο ερώτημα το ρωτά και το **φίλτρο εύρους τιμής**
 * (§8.60.14 Φάση 2), που ζει στο `lib/criteria` — και τα δύο δέντρα **δεν επιτρέπεται
 * να εισάγουν το ένα το άλλο** (κύκλος, CHECK 3.80). Ένα τοπικό αντίγραφο του τύπου θα
 * ήταν δεύτερη δήλωση της ίδιας διαμέρισης, ελεύθερη να αποκλίνει.
 *
 * ⚠️ Το όνομα μένει **τοπικό ψευδώνυμο** γιατί εδώ σημαίνει «επιγραφή τμήματος» — ίδιος
 * τύπος, άλλη ανάγνωση.
 */
export type ListingSectionHeading = PriceClass;

/**
 * Ένα τμήμα της λίστας: **μία** κλάση συγκρισιμότητας, ταξινομημένη μέσα της.
 *
 * ⚠️ **`heading: null` σημαίνει «καμία επιγραφή», ΟΧΙ «καμία κλάση».** Όταν όλα τα
 * αποτελέσματα ανήκουν σε **μία** κλάση, η επιγραφή δεν προσθέτει πληροφορία — την
 * λέει ήδη κάθε κάρτα με τη μονάδα της (§8.60.11). Επιγραφή πάνω από ομοιογενή λίστα
 * θα ήταν θόρυβος με στολή ειλικρίνειας.
 */
export interface ListingSection {
  readonly heading: ListingSectionHeading | null;
  readonly listings: readonly PublicListing[];
}

/** Η λίστα ως **ακολουθία κλάσεων**. Πάντα ≥1 τμήμα όταν υπάρχει ≥1 αγγελία. */
export type ListingSections = readonly ListingSection[];

/**
 * Ό,τι χρειάζεται η σειρά **πέρα από τις ίδιες τις αγγελίες**.
 *
 * Σήμερα ένα πράγμα: τα **σύνολα διαμονής** του §8.60.12. Είναι αντικείμενο και όχι
 * σκέτο όρισμα ώστε μια δεύτερη εξάρτηση να μην αλλάξει την υπογραφή κάθε καλούντος.
 */
export interface ListingOrderContext {
  readonly stayTotals: StayTotals;
}

/** Καμία ερώτηση ημερομηνιών. Ένα κοινό αντικείμενο, όχι νέο ανά απόδοση. */
export const NO_ORDER_CONTEXT: ListingOrderContext = Object.freeze({
  stayTotals: NO_STAY_TOTALS,
});

// ============================================================================
// Η ΚΡΙΣΗ — μία φορά ανά αγγελία
// ============================================================================

/**
 * Μία αγγελία **με την κρίση του επιλυτή ήδη παρμένη** — κλάση και ποσό.
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ο επιλυτής ΔΕΝ ΚΑΛΕΙΤΑΙ ΜΕΣΑ ΣΤΟΝ ΣΥΓΚΡΙΤΗ.** Ένας συγκριτής που
 * ρωτά τον `resolveDisplayPrice` εκτελεί **O(n log n)** κρίσεις — με τα 1.200
 * αποτελέσματα που το §8.62 ονομάζει ρητά, ~12.000 κλήσεις ανά ταξινόμηση, **κάθε φορά
 * που αλλάζει ένα φίλτρο**. Η κρίση γίνεται **μία φορά ανά αγγελία** *(Schwartzian
 * transform)* — και το **ίδιο** πέρασμα δίνει **και** την κλάση **και** το ποσό.
 */
interface PricedEntry {
  readonly listing: PublicListing;
  readonly heading: ListingSectionHeading;
  /** Το ποσό της κύριας τιμής — `null` **ακριβώς όταν** η κλάση είναι `'unpriced'`. */
  readonly amount: number | null;
}

function pricedEntryOf(listing: PublicListing): PricedEntry {
  const price = resolveDisplayPrice(listing);
  return price.kind === 'priced'
    ? { listing, heading: price.headline.role, amount: price.headline.amount }
    : { listing, heading: 'unpriced', amount: null };
}

/** Με ποια μονάδα ταξινομείται ένα τμήμα. */
type SectionUnit = 'amount' | 'stayTotal';

/**
 * **Το κλειδί τιμής ΜΕΣΑ σε μία κλάση** — `null` όταν η αγγελία δεν είναι απάντηση.
 *
 * 🔴 **ΤΟ ΣΥΝΟΛΟ ΔΙΑΜΟΝΗΣ ΑΛΛΑΖΕΙ ΤΗ ΜΟΝΑΔΑ ΤΟΥ ΤΜΗΜΑΤΟΣ, ΚΑΙ ΕΙΝΑΙ ΟΛΟ Ή ΤΙΠΟΤΑ.**
 * Όταν ο επισκέπτης έδωσε ημερομηνίες, η ερώτηση παύει να είναι *«πόσο η νύχτα;»* και
 * γίνεται *«πόσο η διαμονή;»* — και η κάρτα γράφει ήδη το σύνολο (§8.60.12). Αν το
 * τμήμα ταξινομούνταν με **σύνολο** για όσα το έχουν και **τιμή νύχτας** για τα
 * υπόλοιπα, θα είχαμε αναπαραγάγει την ίδια αμαρτία **ένα επίπεδο πιο κάτω**: «250 €
 * σύνολο» δίπλα σε «50 €/νύχτα», σε έναν άξονα.
 *
 * ⇒ Μόλις **έστω μία** αγγελία του τμήματος έχει σύνολο, η μονάδα του τμήματος **είναι**
 * το σύνολο· όσες δεν το έχουν *(κατειλημμένες, χωρίς δηλωμένο ημερολόγιο, κάτω από
 * ελάχιστες νύχτες — ο κριτής τις **ονομάζει**)* **δεν είναι απάντηση** και πάνε στο
 * τέλος, **και στις δύο** κατευθύνσεις. Ίδιος ακριβώς κανόνας με την απουσία τιμής, ίδια
 * μηχανή ({@link compareSortValues}), **μηδέν** νέος κώδικας.
 *
 * ⚠️ Το σύνολο είναι σε **λεπτά** (`MinorAmount`) και η τιμή σε **ακέραιες μονάδες** —
 * δεν αναμειγνύονται ποτέ, ακριβώς επειδή η επιλογή είναι όλο-ή-τίποτα **ανά τμήμα**.
 */
function priceKeyWithin(
  entry: PricedEntry,
  unit: SectionUnit,
  context: ListingOrderContext,
): number | null {
  return unit === 'stayTotal'
    ? context.stayTotals[entry.listing.id]?.totalMinor ?? null
    : entry.amount;
}

/**
 * **Κατά τιμή, ΜΕΣΑ στην ίδια κλάση**, στην κατεύθυνση που ζητήθηκε.
 *
 * ⚠️ **Δεν καλείται ποτέ πάνω σε δύο διαφορετικές κλάσεις** — τη διαμέριση την κάνει ο
 * {@link orderResultsListings}, και είναι ο **μόνος** εξαγόμενος δρόμος προς τη σειρά.
 * Γι' αυτό η συνάρτηση δεν χρειάζεται —και δεν έχει— κλάδο «τι κάνω αν διαφέρουν».
 */
function compareWithinClass(
  a: PricedEntry,
  b: PricedEntry,
  direction: SortDirection,
  unit: SectionUnit,
  context: ListingOrderContext,
): number {
  const byPrice = compareSortValues(
    priceKeyWithin(a, unit, context),
    priceKeyWithin(b, unit, context),
    direction,
  );
  return byPrice !== 0
    ? byPrice
    : compareByNameThenId(a.listing.title, a.listing.id, b.listing.title, b.listing.id);
}
/**
 * Η σειρά των κλάσεων στην οθόνη: **η δηλωμένη σειρά των ρόλων, και η απουσία τελευταία.**
 *
 * ⚠️ Δεν είναι ιεραρχία αξίας: το {@link PRICE_ROLE_ORDER} είναι προβολή του
 * `OFFER_KINDS`, δηλαδή του λεξιλογίου που το έργο **ήδη** έχει δηλώσει. Η απουσία
 * πηγαίνει τελευταία για τον ίδιο λόγο που πηγαίνει τελευταία **μέσα** σε ένα τμήμα:
 * δεν είναι απάντηση στην ερώτηση που έκανε ο άνθρωπος.
 */
const UNPRICED_RANK = Number.MAX_SAFE_INTEGER;

function classRank(heading: ListingSectionHeading): number {
  return heading === 'unpriced' ? UNPRICED_RANK : PRICE_ROLE_ORDER[heading];
}


// ============================================================================
// Η ΔΙΑΜΕΡΙΣΗ
// ============================================================================

/**
 * **Οι αγγελίες σε ΚΛΑΣΕΙΣ, ταξινομημένες μέσα σε καθεμία.**
 *
 * 🔑 **Μία κλάση ⇒ καμία επιγραφή.** Η οθόνη μένει ακριβώς η σημερινή, και ο χάρτης
 * συμφωνεί με τη λίστα **χωρίς δεύτερο κανόνα** (§8.60.11: με έναν ρόλο ο `fairOrder`
 * εκφυλίζεται μόνος του σε «τιμή ↑»).
 *
 * ⚠️ **ΕΝΑ πέρασμα**: ο επιλυτής ρωτιέται **μία φορά ανά αγγελία**, και η απάντηση
 * ταξιδεύει μέσα στο {@link PricedEntry} ως την ταξινόμηση.
 */
export function partitionByPriceClass(
  listings: readonly PublicListing[],
  direction: SortDirection,
  context: ListingOrderContext,
): ListingSections {
  const byClass = new Map<ListingSectionHeading, PricedEntry[]>();

  for (const listing of listings) {
    const entry = pricedEntryOf(listing);
    const group = byClass.get(entry.heading) ?? [];
    group.push(entry);
    byClass.set(entry.heading, group);
  }

  const single = byClass.size === 1;

  return [...byClass.entries()]
    .sort(([a], [b]) => classRank(a) - classRank(b))
    .map(([heading, group]) => ({
      heading: single ? null : heading,
      listings: sortClass(heading, group, direction, context),
    }));
}

/**
 * Η σειρά **μέσα** σε μία κλάση.
 *
 * ⚠️ Το `'unpriced'` **δεν ταξινομείται κατά τιμή** — δεν έχει. Παίρνει τη σταθερή,
 * ολική σειρά ονόματος/`id`: χωρίς αυτήν το τμήμα θα αναδιατασσόταν μεταξύ αποδόσεων με
 * **τα ίδια δεδομένα**, που είναι η ίδια αδήλωτη κατάταξη σε μικρότερη κλίμακα.
 */
function sortClass(
  heading: ListingSectionHeading,
  group: readonly PricedEntry[],
  direction: SortDirection,
  context: ListingOrderContext,
): readonly PublicListing[] {
  if (heading === 'unpriced') {
    return [...group]
      .sort((a, b) =>
        compareByNameThenId(a.listing.title, a.listing.id, b.listing.title, b.listing.id))
      .map((entry) => entry.listing);
  }

  const unit = sectionUnit(heading, group, context);
  return [...group]
    .sort((a, b) => compareWithinClass(a, b, direction, unit, context))
    .map((entry) => entry.listing);
}

/**
 * **Η μονάδα ενός τμήματος** — ποσό, ή σύνολο διαμονής.
 *
 * 🔑 **Η απόφαση είναι του ΤΜΗΜΑΤΟΣ, όχι της αγγελίας** — δες {@link priceKeyWithin}.
 * Μόνο τα καταλύματα έχουν σύνολο διαμονής· ένα τμήμα πώλησης δεν το ρωτά ποτέ.
 */
function sectionUnit(
  heading: PriceRole,
  group: readonly PricedEntry[],
  context: ListingOrderContext,
): SectionUnit {
  if (heading !== 'nightly') return 'amount';
  return group.some((entry) => context.stayTotals[entry.listing.id] !== undefined)
    ? 'stayTotal'
    : 'amount';
}

// ============================================================================
// ΠΡΟΒΟΛΕΣ ΤΩΝ ΤΜΗΜΑΤΩΝ
// ============================================================================

/**
 * Τα τμήματα ως **ένας** πίνακας, για επιφάνειες που δεν ζωγραφίζουν τιμές.
 *
 * 🔑 **Δεν παραβιάζει τον κανόνα, τον ΤΗΡΕΙ**: η ακολουθία είναι η **συνένωση** των
 * ταξινομημένων κλάσεων — μια *γραμμική επέκταση* της μερικής διάταξης. Καμία σύγκριση
 * ανάμεσα σε κλάσεις δεν εκτελέστηκε, και καμία δεν δηλώνεται.
 *
 * ⚠️ **Ο ΜΟΝΟΣ νόμιμος καταναλωτής σήμερα είναι η συμπτυγμένη γραμμή των αγγελιών χωρίς
 * θέση** (`UnmappedListingsRow`), που δείχνει **μόνο τίτλους** — άρα δεν υπάρχει μονάδα
 * να μπερδευτεί και μια επιγραφή εκεί θα ήταν θόρυβος. **ΜΗΝ** το χρησιμοποιήσεις για
 * να «ισιώσεις» μια λίστα που δείχνει ποσά.
 */
export function flattenListingSections(sections: ListingSections): readonly PublicListing[] {
  return sections.flatMap((section) => section.listings);
}

/** Πόσες αγγελίες περιέχουν συνολικά τα τμήματα — **η λογιστική του §8.62 κλείνει εδώ**. */
export function countListingSections(sections: ListingSections): number {
  return sections.reduce((total, section) => total + section.listings.length, 0);
}
