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
import type {
  DisplayPrice,
  PriceClass,
  PriceRole,
  ResolvedPrice,
} from '@/lib/properties/price-resolver';
import {
  pricedRolesOf,
  type PriceTotals,
  type PriceTotalsByRole,
} from '@/lib/properties/price-totals';
import {
  MISSING_PRICE_KEY,
  PRICE_AMOUNT_KEY,
  PRICE_PER_AREA_KEY,
  PRICE_SECTION_KEY,
} from './listing-price-keys';
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

/**
 * **Η επιγραφή μιας κλάσης, με το πλήθος της** — «Πώληση · 3 ακίνητα» (ADR-777 §8.60.14).
 *
 * 🔑 **Ένα σημείο για κάθε επιφάνεια που ονομάζει κλάση**: τμήμα της δημόσιας λίστας, γραμμή-
 * επικεφαλίδα εσωτερικού πίνακα (§8.60.14.14), υποσύνολο κάρτας στατιστικού (§8.60.14.13). Το
 * πλήθος ζει **μέσα** στην επιγραφή: λέει πόσα προσπερνά όποιος κυλά (λογιστική του §8.62).
 */
export function priceSectionLabel(t: PriceLabelT, heading: PriceClass, count: number): string {
  return t(PRICE_SECTION_KEY[heading], { count });
}

/**
 * **Το ποσό ενός ΚΕΛΙΟΥ πίνακα** — η κύρια τιμή με τη μονάδα της, ή `—` όταν δεν υπάρχει.
 *
 * ⚠️ Σε πυκνό πίνακα η αιτία της απουσίας (`displayPriceLabel`) δεν χωρά· το κενό κελί είναι η
 * σύμβαση κάθε φύλλου εργασίας — **ποτέ** «0 €». Ως τις 2026-09-18 τα κελιά έγραφαν
 * `formatCurrencyWhole(priceSortKey(x))`: «900 €» για μηνιαίο ενοίκιο (§8.60.14.14).
 */
export function priceCellLabel(t: PriceLabelT, price: DisplayPrice): string {
  return price.kind === 'priced' ? resolvedPriceLabel(t, price.headline) : NO_PRICE_TOTAL;
}

/**
 * **Τιμή ανά m², με τη μονάδα του ρόλου** — «2.450 €/m²», «9 €/m²/μήνα». Ο ΕΝΑΣ δρόμος
 * (`PRICE_PER_AREA_KEY`): ως τις 2026-09-18 κάρτες πωλήσεων έγραφαν `${ποσό}/m²` πάνω από
 * ποσό που μπορούσε να είναι μηνιαίο.
 */
export function pricePerAreaLabel(t: PriceLabelT, price: Pick<ResolvedPrice, 'role' | 'amount'>): string {
  return t(PRICE_PER_AREA_KEY[price.role], { price: formatCurrency(price.amount) });
}

// ============================================================================
// ΑΘΡΟΙΣΜΑΤΑ ΑΝΑ ΡΟΛΟ → ΚΕΙΜΕΝΟ ΟΘΟΝΗΣ (ADR-777 §8.60.14.13)
// ============================================================================

/** Ποιο μέγεθος ενός υποσυνόλου ζητά η οθόνη. */
export type PriceTotalsMeasure = 'total' | 'average' | 'perArea';

/**
 * Μία γραμμή υποσυνόλου: **η κλάση με το πλήθος της**, και το ποσό **με τη μονάδα του**.
 *
 * `value: null` ⇒ η κλάση **δεν έχει** ποσό (`'unpriced'`) — ονομάζεται, δεν μηδενίζεται.
 */
export interface PriceTotalsRow {
  readonly key: PriceClass;
  readonly label: string;
  readonly value: string | null;
}

/**
 * Η απάντηση μιας κάρτας στατιστικού: **είτε** ένα ποσό **είτε** υποσύνολα — ποτέ και τα δύο.
 *
 * ⚠️ Τα ονόματα ταιριάζουν επίτηδες με το `DashboardStat` (`value` · `priceBreakdown`), ώστε
 * η σελίδα να γράφει `{ title, ...priceTotalsView(…), icon }` και να μη μεταφέρει πεδία.
 */
export interface PriceTotalsView {
  /** Το ποσό της μίας κλάσης, ή `NO_PRICE_TOTAL`· κενό όταν μιλούν τα υποσύνολα. */
  readonly value: string;
  /** Κενό ⇔ **μία** κλάση: η επιγραφή δεν θα πρόσθετε τίποτα (ίδιος κανόνας με τα τμήματα λίστας). */
  readonly priceBreakdown: readonly PriceTotalsRow[];
}

/**
 * «Δεν υπάρχει ποσό να δειχτεί». Τυπογραφικό σύμβολο, ίδιο σε κάθε γλώσσα — όχι κείμενο (N.11).
 * Μετακόμισε εδώ από το `sales-stat-values` (`SALES_STAT_EMPTY`) όταν οι σελίδες πωλήσεων
 * πέρασαν σε υποσύνολα: ο κανόνας «μηδέν σημαίνει άγνωστο» ανήκει στα αθροίσματα, όχι στις πωλήσεις.
 */
export const NO_PRICE_TOTAL = '—';

/** Το μέγεθος ενός ρόλου — `null` όταν αυτός ο ρόλος δεν το μετρά. */
function measureOf(totals: PriceTotals, measure: PriceTotalsMeasure): { amount: number; count: number } | null {
  if (measure === 'total') return { amount: totals.total, count: totals.pricedCount };
  if (measure === 'average') return { amount: Math.round(totals.average), count: totals.pricedCount };
  return totals.perArea
    ? { amount: Math.round(totals.perArea.amount), count: totals.perArea.measuredCount }
    : null;
}

/** Το ποσό με τη μονάδα του ρόλου — και, για το €/m², με τη μονάδα **του εμβαδού**. */
function measureLabel(t: PriceLabelT, role: PriceRole, amount: number, measure: PriceTotalsMeasure): string {
  return measure === 'perArea'
    ? pricePerAreaLabel(t, { role, amount })
    : resolvedPriceLabel(t, { role, amount });
}

/**
 * **Υποσύνολα ανά ρόλο → κάρτα στατιστικού.** Ο ΕΝΑΣ δρόμος για κάθε «Συνολική Αξία».
 *
 * 🏆 Το `Footer → «Title, count, and totals»` του **Revit**, σε κάρτα: κάθε γραμμή λέει
 * **ποια** κλάση, **πόσες** μονάδες καλύπτει και **πόσο** — στη **δική της** μονάδα.
 *
 * 🔑 **Μία κλάση ⇒ ένα ποσό, χωρίς επιγραφή** — η οθόνη μένει η σημερινή (με τη μονάδα
 * πλέον γραμμένη). Ίδιος κανόνας με τα τμήματα της λίστας (§8.60.14): επιγραφή πάνω από
 * ομοιογενές σύνολο θα ήταν θόρυβος. **Δύο κλάσεις και πάνω ⇒ υποσύνολα**, και η απουσία
 * τιμής είναι **κλάση** (τελευταία) — λέει πόσες μονάδες **δεν** μπήκαν στον αριθμό.
 */
export function priceTotalsView(
  t: PriceLabelT,
  totals: PriceTotalsByRole,
  measure: PriceTotalsMeasure,
): PriceTotalsView {
  const rows: PriceTotalsRow[] = [];
  for (const role of pricedRolesOf(totals)) {
    const measured = measureOf(totals.byRole[role], measure);
    if (measured === null || measured.count === 0) continue;
    rows.push({
      key: role,
      label: priceSectionLabel(t, role, measured.count),
      value: measureLabel(t, role, measured.amount, measure),
    });
  }

  if (rows.length === 0) return { value: NO_PRICE_TOTAL, priceBreakdown: [] };
  if (rows.length === 1 && totals.unpricedCount === 0) {
    return { value: rows[0].value ?? NO_PRICE_TOTAL, priceBreakdown: [] };
  }
  if (totals.unpricedCount > 0) {
    rows.push({
      key: 'unpriced',
      label: priceSectionLabel(t, 'unpriced', totals.unpricedCount),
      value: null,
    });
  }
  return { value: '', priceBreakdown: rows };
}

/**
 * Τα υποσύνολα ως **μία πρόταση** — για `aria-label` και για επιφάνειες χωρίς διάταξη
 * γραμμών. Ποτέ άθροισμα: κάθε ποσό μένει στη γραμμή της κλάσης του.
 */
export function priceTotalsSentence(view: PriceTotalsView): string {
  if (view.priceBreakdown.length === 0) return view.value;
  return view.priceBreakdown
    .map((row) => (row.value === null ? row.label : `${row.label}: ${row.value}`))
    .join(' · ');
}
