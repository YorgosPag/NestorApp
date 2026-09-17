/**
 * @fileoverview **Ετυμηγορία τιμής → ΚΕΙΜΕΝΟ ΟΘΟΝΗΣ, με τη μονάδα του.** Ένα σημείο.
 * @related ADR-835 §4.4 · ADR-777 §8.60 · lib/listings/listing-price-keys.ts
 * @module lib/listings/listing-price-label
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΤΟ ΓΕΝΝΗΣΕ (2026-09-17)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Τέσσερις** επιφάνειες της αναζήτησης (κάρτα, φούσκα χάρτη, δείκτης άκρης, πινακίδα
 * χάρτη) έγραφαν την ίδια τριμερή έκφραση
 * `kind === 'priced' ? formatCurrency(amount) : t(MISSING_PRICE_KEY[reason])` — και
 * **καμία** δεν ρωτούσε τον **ρόλο**. Αποτέλεσμα: κατάλυμα 50 €/νύχτα διαβαζόταν «50 €»,
 * με την ίδια τυπογραφία που ο διπλανός δείκτης γράφει «170.000 €» πώλησης. Είναι
 * **κατά λέξη** ο σκόπελος που το ADR-835 §4.4 είχε απαγορεύσει.
 *
 * 🏆 **Γιατί εδώ ξεπερνάμε τους μεγάλους, και όχι απλώς τους φτάνουμε**: Airbnb, Zillow
 * και idealista **δεν χρειάζονται** μονάδα στον χάρτη, γιατί κάθε αναζήτησή τους είναι
 * **ενός** είδους (μόνο διαμονές · αγορά ΧΩΡΙΣΤΑ από ενοικίαση). Ο Νέστωρ δείχνει και τα
 * τρία στην **ίδια** οθόνη — άρα η μονάδα δεν είναι διακόσμηση, είναι η μόνη διάκριση.
 *
 * ⚠️ **Καθαρή συνάρτηση πάνω σε `t`**, ίδιο ιδίωμα με το `vocabularyLabel`: το
 * `formatCurrency` κρίνει τον αριθμό (γλώσσα, διαχωριστικά), το locale κρίνει τη
 * **θέση** της μονάδας. Κανείς από τους δύο δεν κάνει τη δουλειά του άλλου.
 */

import { formatCurrency } from '@/lib/intl-formatting';
import { formatMinor } from '@/lib/money/money';
import type { DisplayPrice, ResolvedPrice } from '@/lib/properties/price-resolver';
import { MISSING_PRICE_KEY, PRICE_AMOUNT_KEY } from './listing-price-keys';
import type { StayTotal } from './listing-stay-total';

/**
 * Ό,τι χρειάζεται από το `t`: κλειδί + παράμετροι → κείμενο.
 *
 * ⚠️ **Δομικός τύπος, όχι το `TFunction` του i18next** (ADR-777 §8.60.13): οι εσωτερικές
 * κάρτες ακινήτων (`domain/cards/property`) κουβαλούν ήδη αυτό το στενό σχήμα. Το
 * `TFunction` χωρά σε αυτό· το ανάποδο όχι — άρα ο στενός τύπος δέχεται **και τους δύο**.
 */
export type PriceLabelT = (key: string, options?: Record<string, unknown>) => string;

/**
 * Ένα ποσό **με** τη μονάδα του ρόλου του — «900 €/μήνα», ποτέ σκέτο «900 €».
 *
 * ⚠️ Ζητά **μόνο** ρόλο και ποσό: η προέλευση (`source`) δεν αλλάζει τη μονάδα, και η
 * πινακίδα χάρτη δεν την κουβαλά. Στενότερος τύπος = περισσότεροι νόμιμοι καλούντες.
 */
export function resolvedPriceLabel(
  t: PriceLabelT,
  price: Pick<ResolvedPrice, 'role' | 'amount'>,
): string {
  return t(PRICE_AMOUNT_KEY[price.role], { price: formatCurrency(price.amount) });
}

/**
 * «150 € · 3 νύχτες» — το σύνολο διαμονής **μαζί** με το πλήθος νυχτών που καλύπτει.
 *
 * ⚠️ **Κλειδί ΓΡΑΜΜΕΝΟ ΜΕΣΑ στην κλήση, όχι σταθερά** — μετρημένο 2026-09-17: ως
 * `t(STAY_TOTAL_KEY, …)` ο generator της CHECK 3.34 **αρνήθηκε 4 route slices**
 * (ανεπίλυτη δυναμική `t()`). Η νύχτα κλίνεται με **ICU plural** στο locale.
 */
export function stayTotalLabel(t: PriceLabelT, total: StayTotal): string {
  return t('common:priceAmount.stayTotal', { price: formatMinor(total.totalMinor), nights: total.nights });
}

/**
 * Η κύρια τιμή όταν **ξέρουμε ήδη ότι υπάρχει** (πινακίδα χάρτη): σύνολο διαμονής αν
 * δόθηκαν ημερομηνίες που το κατάλυμα δέχεται, αλλιώς το ποσό με τη μονάδα του.
 */
export function headlinePriceLabel(
  t: PriceLabelT,
  headline: Pick<ResolvedPrice, 'role' | 'amount'>,
  stayTotal: StayTotal | null = null,
): string {
  return stayTotal !== null ? stayTotalLabel(t, stayTotal) : resolvedPriceLabel(t, headline);
}

/**
 * Η **κύρια** γραμμή τιμής μιας αγγελίας: σύνολο διαμονής, ποσό με μονάδα, ή **η αιτία**
 * που λείπει.
 *
 * 🔑 **Το σύνολο διαμονής προηγείται** όταν υπάρχει (`stayTotalOf`: ο επισκέπτης έδωσε
 * ημερομηνίες και το κατάλυμα τις δέχεται) — ακόμη κι αν η κύρια τιμή του ακινήτου είναι
 * πώληση: ο άνθρωπος που ρώτησε «από 3 έως 6 Οκτωβρίου» ρωτά **πόσο κάνει η διαμονή**.
 * Η απουσία μένει **κατάσταση με αιτία** (`MISSING_PRICE_KEY`) — ποτέ «0 €», ποτέ «—».
 */
export function displayPriceLabel(
  t: PriceLabelT,
  price: DisplayPrice,
  stayTotal: StayTotal | null = null,
): string {
  if (stayTotal !== null) return stayTotalLabel(t, stayTotal);
  return price.kind === 'priced'
    ? resolvedPriceLabel(t, price.headline)
    : t(MISSING_PRICE_KEY[price.reason]);
}
