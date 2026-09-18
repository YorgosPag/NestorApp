/**
 * @fileoverview **ΣΕΙΡΑ ΚΑΤΑ ΤΙΜΗ = ΠΡΩΤΑ Η ΜΟΝΑΔΑ, ΜΕΤΑ Ο ΑΡΙΘΜΟΣ** — για ΟΠΟΙΑΔΗΠΟΤΕ συλλογή ακινήτων.
 * @related ADR-777 §8.60.14 (Φάση 1) · §8.60.14.14 (Φάση 4) · lib/listings/listing-price-sections.ts
 * @module lib/properties/price-class-sections
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΡΩΤΗΜΑ — ΚΑΙ ΓΙΑΤΙ ΖΕΙ ΣΤΟ `lib/properties`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * *«Με ποια σειρά διαβάζω ακίνητα "κατά τιμή", όταν τα ποσά τους είναι σε ΑΛΛΗ μονάδα;»*
 *
 * Ποσά διαφορετικού ρόλου (`170.000 €` · `900 €/μήνα` · `50 €/νύχτα`) είναι **ασύγκριτα** ⇒ η
 * «σειρά κατά τιμή» είναι **μερική** διάταξη. Η μόνη τίμια επίπεδη προβολή της είναι
 * **τμήματα ανά κλάση** (η μονάδα), ταξινομημένα **μέσα** τους — το `Sort By` (ομάδα) →
 * `Then By` (τιμή) του **Revit**, τα υποσύνολα ανά ομάδα του **ArchiCAD**.
 *
 * ⚠️ **Γεννήθηκε ως ιδιωτική μηχανή της δημόσιας αναζήτησης** (Φάση 1, `PublicListing` μόνο).
 * Η Φάση 4 βρήκε **τέσσερις** εσωτερικούς πίνακες (καρτέλες «Θέσεις»/«Αποθήκες» κτιρίου,
 * λίστες θέσεων/αποθηκών) να ταξινομούν με `priceSortKey` σε **έναν** άξονα. ⛔ Δεύτερη
 * υλοποίηση θα ήταν δεύτερη απάντηση στο ίδιο ερώτημα, ελεύθερη να αποκλίνει ⇒ η μηχανή
 * **γενικεύτηκε** σε `T extends PricedPropertyLike` και **ανέβηκε** εδώ, δίπλα στον επιλυτή
 * και στα αθροίσματα (`price-totals.ts`) — τις δύο άλλες απαντήσεις «ανά ρόλο». Η αναζήτηση
 * κρατά μόνο ό,τι είναι **δικό της** (σύνολο διαμονής, σειρά τίτλου) στο `listing-price-sections.ts`.
 *
 * 🔑 **Ο ΤΥΠΟΣ ΤΗΣ ΕΞΟΔΟΥ ΕΙΝΑΙ Ο ΦΡΟΥΡΟΣ.** Ο {@link PriceClassSections} **δεν εκφράζει**
 * ενιαία κατάταξη: κανείς δεν μπορεί να συγκρίνει «πρώτο με τελευταίο» χωρίς να ονομάσει
 * κλάση. Το «Inconsistent units» του Revit σε TypeScript.
 *
 * ⛔ **ΚΑΝΕΝΑ ΚΛΕΙΔΙ ΤΙΜΗΣ ΕΔΩ.** Ρόλος και ποσό έρχονται **μαζί** από τον ΕΝΑ κριτή
 * (`resolveDisplayPrice`) — τον ίδιο που ζωγραφίζει την τιμή στο κελί και στην κάρτα.
 */

import { compareSortValues, type SortableValue, type SortDirection } from '@/lib/array-utils';
import {
  PRICE_ROLE_ORDER,
  resolveDisplayPrice,
  type PriceClass,
  type PricedPropertyLike,
  type PriceRole,
} from '@/lib/properties/price-resolver';

// ============================================================================
// ΤΟ ΣΧΗΜΑ
// ============================================================================

/**
 * **Ένα τμήμα: μία κλάση συγκρισιμότητας, ταξινομημένη μέσα της.**
 *
 * ⚠️ **`heading: null` σημαίνει «καμία επιγραφή», ΟΧΙ «καμία κλάση».** Με **μία** κλάση η
 * επιγραφή δεν προσθέτει τίποτα — τη λέει ήδη κάθε ποσό με τη μονάδα του (§8.60.11). Όπως ένα
 * schedule με μία ομάδα δεν τυπώνει header.
 */
export interface PriceClassSection<T> {
  readonly heading: PriceClass | null;
  readonly items: readonly T[];
}

/** Η συλλογή ως **ακολουθία κλάσεων**. Πάντα ≥1 τμήμα όταν υπάρχει ≥1 στοιχείο. */
export type PriceClassSections<T> = readonly PriceClassSection<T>[];

/**
 * Ένα στοιχείο **με την κρίση του επιλυτή ήδη παρμένη** — κλάση και ποσό.
 *
 * 🔴 **Ο επιλυτής ΔΕΝ καλείται μέσα στον συγκριτή** (Schwartzian transform): ένας συγκριτής
 * που ρωτά τον `resolveDisplayPrice` εκτελεί O(n log n) κρίσεις, σε κάθε αλλαγή φίλτρου.
 */
export interface PricedEntry<T> {
  readonly item: T;
  readonly heading: PriceClass;
  /** Το ποσό της κύριας τιμής — `null` **ακριβώς όταν** η κλάση είναι `'unpriced'`. */
  readonly amount: number | null;
}

/** Το κλειδί τιμής ενός στοιχείου **μέσα** στην κλάση του — `null` ⇒ «δεν είναι απάντηση». */
export type PriceKeyWithin<T> = (entry: PricedEntry<T>) => number | null;

/**
 * **Πώς ταξινομείται ΜΕΣΑ σε κάθε κλάση** — ό,τι διαφέρει ανά οθόνη, και μόνο αυτό.
 */
export interface PriceClassOrder<T> {
  readonly direction: SortDirection;
  /**
   * **Ολική σειρά για ισοπαλίες και για την απουσία τιμής.** Χωρίς αυτήν το τμήμα θα
   * αναδιατασσόταν μεταξύ αποδόσεων με **τα ίδια δεδομένα** — αδήλωτη κατάταξη.
   */
  readonly tieBreak: (a: T, b: T) => number;
  /**
   * Προαιρετικά: **άλλη μονάδα για ΟΛΟ ένα τμήμα** (π.χ. σύνολο διαμονής αντί για τιμή
   * νύχτας, §8.60.14.5). Η απόφαση είναι του **τμήματος**, όλο ή τίποτα — ποτέ ανά στοιχείο.
   * Χωρίς αυτό — ή όταν επιστρέφει `undefined` για ένα τμήμα — το ποσό της κύριας τιμής.
   */
  readonly keyWithin?: (
    role: PriceRole,
    group: readonly PricedEntry<T>[],
  ) => PriceKeyWithin<T> | undefined;
}

// ============================================================================
// Η ΔΙΑΜΕΡΙΣΗ
// ============================================================================

/** Η απουσία τιμής πάει τελευταία — δεν είναι απάντηση ούτε στο «φθηνότερο» ούτε στο «ακριβότερο». */
const UNPRICED_RANK = Number.MAX_SAFE_INTEGER;

/**
 * Η σειρά των κλάσεων: **η δηλωμένη σειρά των ρόλων** (`PRICE_ROLE_ORDER`, προβολή του
 * `OFFER_KINDS`) και η απουσία **τελευταία** — ίδια και στις **δύο** κατευθύνσεις: η φθίνουσα
 * αντιστρέφει τον **αριθμό**, ποτέ τις κλάσεις (αλλιώς «η διανυκτέρευση είναι το ακριβότερο»).
 */
function classRank(heading: PriceClass): number {
  return heading === 'unpriced' ? UNPRICED_RANK : PRICE_ROLE_ORDER[heading];
}

function pricedEntryOf<T extends PricedPropertyLike>(item: T): PricedEntry<T> {
  const price = resolveDisplayPrice(item);
  return price.kind === 'priced'
    ? { item, heading: price.headline.role, amount: price.headline.amount }
    : { item, heading: 'unpriced', amount: null };
}

const amountOf = <T>(entry: PricedEntry<T>): number | null => entry.amount;

/**
 * Η σειρά **μέσα** σε μία κλάση. Το `'unpriced'` δεν έχει ποσό ⇒ μόνο η ολική σειρά.
 */
function sortClass<T>(
  heading: PriceClass,
  group: readonly PricedEntry<T>[],
  order: PriceClassOrder<T>,
): readonly T[] {
  if (heading === 'unpriced') {
    return [...group].sort((a, b) => order.tieBreak(a.item, b.item)).map((entry) => entry.item);
  }
  const keyOf = order.keyWithin?.(heading, group) ?? amountOf;
  return [...group]
    .sort((a, b) =>
      compareSortValues(keyOf(a), keyOf(b), order.direction) || order.tieBreak(a.item, b.item))
    .map((entry) => entry.item);
}

/**
 * **Τα στοιχεία σε ΚΛΑΣΕΙΣ, ταξινομημένα μέσα σε καθεμία.** Ο ΕΝΑΣ δρόμος προς «σειρά κατά
 * τιμή» — για τη δημόσια λίστα **και** για κάθε εσωτερικό πίνακα.
 *
 * 🔑 **Μία κλάση ⇒ καμία επιγραφή** — η οθόνη μένει ακριβώς η σημερινή.
 * ⚡ **ΕΝΑ πέρασμα**: ο επιλυτής ρωτιέται **μία φορά ανά στοιχείο**.
 * Επιστρέφει **νέους** πίνακες — η είσοδος μπορεί να ανήκει σε συνδρομή.
 */
export function partitionByPriceClass<T extends PricedPropertyLike>(
  items: readonly T[],
  order: PriceClassOrder<T>,
): PriceClassSections<T> {
  const byClass = new Map<PriceClass, PricedEntry<T>[]>();
  for (const item of items) {
    const entry = pricedEntryOf(item);
    const group = byClass.get(entry.heading) ?? [];
    group.push(entry);
    byClass.set(entry.heading, group);
  }

  const single = byClass.size === 1;
  return [...byClass.entries()]
    .sort(([a], [b]) => classRank(a) - classRank(b))
    .map(([heading, group]) => ({
      heading: single ? null : heading,
      items: sortClass(heading, group, order),
    }));
}

/**
 * **Ένα τμήμα χωρίς επιγραφή** — για κάθε σειρά που **δεν** ρωτά ποσό (όνομα, εμβαδόν, χρόνος).
 * Οι επιγραφές ανήκουν στην **ερώτηση** («πόσο;»), όχι στη λίστα. Κενή είσοδος ⇒ κανένα τμήμα.
 */
export function unsectioned<T>(items: readonly T[]): PriceClassSections<T> {
  return items.length === 0 ? [] : [{ heading: null, items }];
}

/**
 * **Μια λίστα ακινήτων, ταξινομημένη κατά ΟΠΟΙΟ πεδίο ζητήθηκε** — ο ΕΝΑΣ δρόμος για τις
 * εσωτερικές λίστες (θέσεις · αποθήκες, §8.60.14.14).
 *
 * - `byPrice` ⇒ {@link partitionByPriceClass}: η τιμή **δεν έχει** επίπεδο κλειδί.
 * - αλλιώς ⇒ **ένα** τμήμα, με τον ΕΝΑ συγκριτή της εφαρμογής (`compareSortValues`: κενά
 *   τελευταία και στις δύο κατευθύνσεις) και **ολική** σειρά στις ισοπαλίες.
 */
export interface PropertyListSort<T> extends PriceClassOrder<T> {
  readonly byPrice: boolean;
  /** Το κλειδί κάθε σειράς **εκτός** της τιμής. */
  readonly valueOf: (item: T) => SortableValue;
}

export function sortIntoPriceClassSections<T extends PricedPropertyLike>(
  items: readonly T[],
  sort: PropertyListSort<T>,
): PriceClassSections<T> {
  if (sort.byPrice) return partitionByPriceClass(items, sort);
  return unsectioned(
    [...items].sort((a, b) =>
      compareSortValues(sort.valueOf(a), sort.valueOf(b), sort.direction) || sort.tieBreak(a, b)),
  );
}

// ============================================================================
// ΠΡΟΒΟΛΕΣ
// ============================================================================

/**
 * Τα τμήματα ως **ένας** πίνακας — **μόνο** για επιφάνειες που **δεν ζωγραφίζουν ποσά**
 * (μετρητής, συμπτυγμένη γραμμή τίτλων). Η ακολουθία είναι η **συνένωση** των κλάσεων —
 * γραμμική επέκταση της μερικής διάταξης, χωρίς κανέναν ισχυρισμό σύγκρισης ανάμεσά τους.
 * ⚠️ **ΜΗΝ** το χρησιμοποιήσεις για να «ισιώσεις» λίστα που δείχνει ποσά.
 */
export function flattenPriceClassSections<T>(sections: PriceClassSections<T>): readonly T[] {
  return sections.flatMap((section) => section.items);
}

/** Πόσα στοιχεία περιέχουν τα τμήματα — **η λογιστική κλείνει εδώ** (§8.62). */
export function countPriceClassSections<T>(sections: PriceClassSections<T>): number {
  return sections.reduce((total, section) => total + section.items.length, 0);
}
