/**
 * @fileoverview **Η ΖΗΤΗΣΗ ΣΕ ΦΡΑΣΕΙΣ** — τόπος, χρόνος, τιμή, διαμονή, είδη. Καθαρές συναρτήσεις.
 * @related ADR-777 §7 (Α9) · ADR-886 · components/demand/DemandSummary.tsx · lib/demand/demand-display-name.ts
 * @module lib/demand/demand-phrases
 *
 * 🔑 **ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟ `DemandSummary`** (ADR-886): οι φράσεις ζούσαν ως React hooks μέσα στο
 * component. Το **αυτόματο όνομα** της ζήτησης χρειάζεται τις **ίδιες** φράσεις — και κάποτε και ο
 * **server** (το email «νέα αγγελία για τη ζήτησή σου «…»»), που δεν έχει React. Δεύτερη διατύπωση
 * θα απέκλινε στην πρώτη αλλαγή, και ο άνθρωπος θα διάβαζε **δύο περιγραφές του ίδιου αιτήματος**.
 * ⇒ **Μετακίνηση, όχι αντίγραφο**: το `DemandSummary` είναι πλέον λεπτό περιτύλιγμα.
 *
 * 🔑 Ο μεταφραστής είναι ο **στενός** `PriceLabelT` (`lib/listings/listing-price-label.ts`): χωρά σε
 * αυτόν και το `t` του `useTranslation` και ένα `TFunction` του server. Τα κλειδιά φέρουν **ρητό**
 * namespace (`property-market:` · `properties-enums:`), ώστε η φράση να μην εξαρτάται από το ποια
 * namespaces φόρτωσε ο καλών.
 *
 * 🔑 **Οι ΟΡΟΙ (ένα ποσό με μονάδα · ένα είδος ακινήτου) ζουν στο `demand-terms.ts`**, όχι εδώ: τους
 * χρειάζεται και το **όνομα** της ζήτησης, και μετρήθηκε (CHECK 3.34) ότι εισάγοντας **αυτό** το module
 * η φόρμα κουβαλούσε **+2.280 bytes** κλειδιών περίληψης που δεν ζωγραφίζει ποτέ.
 *
 * ⚠️ **Οι διακριτές ενώσεις κρίνονται με `switch` πάνω σε `kind`, ποτέ με προαιρετικά πεδία.** Το
 * μοντέλο φρόντισε ώστε *«η σύγκρουση να μη μεταγλωττίζεται»*· μια φράση με `place.radiusKm ?? …` θα
 * ξανάνοιγε ακριβώς την πόρτα που ο τύπος έκλεισε.
 */

import type { PriceLabelT } from '@/lib/listings/listing-price-label';
import { formatPercentage } from '@/lib/intl-formatting';
import {
  boundedPricedSeeks,
  isExchangeSeek,
  isShortStaySeek,
  isStayTermsSet,
  matchDemandPlace,
  type DemandPlace,
  type DemandSeek,
  type DemandTiming,
} from '@/types/property-demand';
import { demandSeekRangePhrase, demandTypeName } from './demand-terms';
import { SEEK_KIND_I18N_KEYS } from './seek-kind-labels';

const K = 'property-market:demand.summary';

/** Ο χωρικός άξονας ως φράση. */
export function demandPlacePhrase(t: PriceLabelT, place: DemandPlace): string {
  return matchDemandPlace<string>(place, {
    anywhere: () => t(`${K}.anywhere`),
    near: ({ radiusKm }) => t(`${K}.near`, { radiusKm }),
    area: () => t(`${K}.area`),
    place: () => t(`${K}.place`),
    // 🔑 **ΔΥΟ ΚΛΕΙΔΙΑ, ΟΧΙ ΕΝΑ ΜΕ ΚΕΝΗ ΠΑΡΑΜΕΤΡΟ.** Το ICU `select` **δεν** ξεχωρίζει το κενό
    // string ως περίπτωση, οπότε ένα μοναδικό κλειδί θα απαιτούσε από **εδώ** να χτίσει την ουρά
    // «` (Μεγάλου Αλεξάνδρου)`» — μορφοποίηση κειμένου σε κώδικα, ό,τι απαγορεύει ο N.11.
    //
    // ⚠️ Το `side` ταξιδεύει **ωμό** (`'left'|'right'|'both'`): το `select` το μεταφράζει **μέσα**
    // στο locale. Περνώντας έτοιμη ελληνική λέξη, κανένα `case` δεν θα ταίριαζε.
    frontage: ({ side, streetName }) =>
      streetName === null ? t(`${K}.frontage`, { side }) : t(`${K}.frontageNamed`, { side, street: streetName }),
  });
}

/** Ο χρονικός άξονας ως φράση. */
export function demandTimingPhrase(t: PriceLabelT, timing: DemandTiming): string {
  switch (timing.kind) {
    case 'now':
      return t(`${K}.now`);
    case 'window':
      return t(`${K}.window`, { fromDate: timing.fromDate, toDate: timing.toDate });
    case 'whenever':
      return t(`${K}.whenever`);
  }
}

/**
 * Ο άξονας τιμής ως φράση — **ανά εναλλακτική, με τη μονάδα της** (ADR-777 §8.60.15): «Αγορά: έως
 * 250.000 € · Ενοικίαση: έως 900 €/μήνα», όχι ένα ποσό χωρίς να λέει **σε ποια** συναλλαγή.
 */
export function demandPricePhrase(t: PriceLabelT, seeks: readonly DemandSeek[]): string {
  const parts = boundedPricedSeeks(seeks).map((seek) =>
    t(`${K}.seekPrice`, {
      kind: t(SEEK_KIND_I18N_KEYS[seek.kind]),
      range: demandSeekRangePhrase(t, seek) ?? t(`${K}.noPriceLimit`),
    }),
  );
  // 🔑 ADR-777 §8.60.17 — η αντιπαροχή δεν έχει ποσό, έχει **οροφή ποσοστού οικοπεδούχου**.
  const shareMax = seeks.find(isExchangeSeek)?.landownerShareMax ?? null;
  if (shareMax !== null) parts.push(t(`${K}.exchangeShare`, { share: formatPercentage(shareMax) }));
  const stay = demandStayTermsPhrase(t, seeks);
  if (stay !== null) parts.push(stay);
  return parts.length === 0 ? t(`${K}.noPriceLimit`) : parts.join(' · ');
}

/**
 * Οι **όροι διαμονής** ως φράση (ADR-777 §8.60.19) — «Διαμονή: 4–6 νύχτες, 2 ενήλικες, 1 βρέφος».
 * `null` όταν δεν ζητείται διαμονή ή δεν τέθηκε όρος. Μηδενικά παιδιά/βρέφη **δεν** λέγονται.
 */
function demandStayTermsPhrase(t: PriceLabelT, seeks: readonly DemandSeek[]): string | null {
  const stay = seeks.find(isShortStaySeek);
  if (stay === undefined || !isStayTermsSet(stay)) return null;
  const { min, max } = stay.nights;
  const parts: string[] = [];
  if (min !== null && max !== null) parts.push(t(`${K}.stayNightsRange`, { min, max }));
  else if (min !== null) parts.push(t(`${K}.stayNightsFrom`, { min }));
  else if (max !== null) parts.push(t(`${K}.stayNightsUpTo`, { max }));
  const party = stay.party;
  if (party !== null) {
    parts.push(t(`${K}.stayAdults`, { count: party.adults }));
    if (party.children > 0) parts.push(t(`${K}.stayChildren`, { count: party.children }));
    if (party.infants > 0) parts.push(t(`${K}.stayInfants`, { count: party.infants }));
    // ADR-777 §8.60.21 — τα κατοικίδια είναι όρος της παρέας, όχι άτομα.
    if (party.pets > 0) parts.push(t(`${K}.stayPets`, { count: party.pets }));
  }
  return t(`${K}.stayTerms`, { kind: t(SEEK_KIND_I18N_KEYS.leaseShort), terms: parts.join(', ') });
}

/** Τα είδη ακινήτου ως φράση. Κενό = **κάθε είδος**, όχι «κανένα». */
export function demandTypesPhrase(t: PriceLabelT, types: readonly string[]): string {
  if (types.length === 0) return t(`${K}.anyType`);
  return types.map((type) => demandTypeName(t, type)).join(' · ');
}
