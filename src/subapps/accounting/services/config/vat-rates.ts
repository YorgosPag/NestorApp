/**
 * @fileoverview **Ελληνικοί συντελεστές ΦΠΑ — ο ΕΝΑΣ πίνακας** (ADR-ACC-004 · ADR-928 §5.10).
 * @module subapps/accounting/services/config/vat-rates
 *
 * 🔑 **Γιατί χωριστό αρχείο από το `vat-config.ts`**: εκείνο φέρνει μαζί του το `ACCOUNT_CATEGORIES` (κανόνες
 * εκπτωσιμότητας). Οι προσφορές, οι παραγγελίες και τα συμφωνητικά χρειάζονται **μόνο** το σύνολο των
 * συντελεστών, και στον browser. Εδώ ζει ο πίνακας, χωρίς καμία εξάρτηση εκτέλεσης· το `vat-config.ts` τον
 * επανεξάγει, ώστε οι υπάρχοντες εισαγωγείς να μένουν ως έχουν.
 *
 * 🔴 **Τι αντικατέστησε** (ADR-928 Φ0): το `0 | 6 | 13 | 24` ήταν γραμμένο **χωριστά** στο `Quote`, στο
 * `POVatRate`, σε δύο φόρμες, στον ορισμό αναφορών, στην εξαγωγή AI και σε route — επτά αντίγραφα, χωρίς
 * κανείς να τα δένει με τον πίνακα της λογιστικής. Πλέον ο τύπος **παράγεται** από τον πίνακα: νέος
 * συντελεστής = μία γραμμή εδώ, και ο μεταγλωττιστής δείχνει κάθε `switch` που πρέπει να τον μάθει.
 *
 * Πηγή: Ν.2859/2000 (Κώδικας ΦΠΑ), όπως ισχύει από 01/06/2016 (Ν.4389/2016), ηπειρωτική Ελλάδα.
 */

import type { VATRate } from '../../types/vat';

export const GREEK_VAT_RATES = [
  {
    code: 'standard_24',
    rate: 24,
    mydataCategory: 1,
    label: 'vatConfig.labels.standard_24',
    validFrom: '2016-06-01',
    validTo: null,
  },
  {
    code: 'reduced_13',
    rate: 13,
    mydataCategory: 2,
    label: 'vatConfig.labels.reduced_13',
    validFrom: '2016-06-01',
    validTo: null,
  },
  {
    code: 'super_reduced_6',
    rate: 6,
    mydataCategory: 3,
    label: 'vatConfig.labels.super_reduced_6',
    validFrom: '2016-06-01',
    validTo: null,
  },
  {
    code: 'exempt_0',
    rate: 0,
    // myDATA v2.0.2 §8.2: 7 = «0% — Άνευ ΦΠΑ» (απαιτεί αιτία εξαίρεσης, §8.3). Ήταν 8, που σημαίνει
    // «Εγγραφές χωρίς ΦΠΑ (μισθοδοσία, αποσβέσεις)» — όχι γραμμή τιμολογίου (ADR-ACC-003 §7).
    mydataCategory: 7,
    label: 'vatConfig.labels.exempt_0',
    validFrom: '2016-06-01',
    validTo: null,
  },
] as const satisfies readonly VATRate[];

/** Ποσοστό ΦΠΑ που ισχύει στην Ελλάδα: `24 | 13 | 6 | 0` — παραγόμενο, ποτέ γραμμένο με το χέρι. */
export type GreekVatRatePercent = (typeof GREEK_VAT_RATES)[number]['rate'];

/** Τα ποσοστά με τη σειρά του πίνακα (κανονικός πρώτος) — για επιλογείς και επικύρωση. */
export const GREEK_VAT_RATE_PERCENTS: readonly GreekVatRatePercent[] = GREEK_VAT_RATES.map((r) => r.rate);

/**
 * Ο κανονικός συντελεστής — η προεπιλογή όπου η πηγή δεν δηλώνει συντελεστή. Η **πρώτη** γραμμή του πίνακα
 * (ο τύπος είναι το literal της, όχι `number`)· ότι είναι η `standard_24` το φυλά το `vat-rates.test.ts`.
 */
export const GREEK_STANDARD_VAT_RATE = GREEK_VAT_RATES[0].rate;

/**
 * Ο συντελεστής «Άνευ ΦΠΑ» (κατηγορία myDATA 7, απαιτεί αιτία εξαίρεσης) — η αφετηρία της γραμμής απαλλασσόμενης
 * επιχείρησης (ADR-ACC-003 §22.4). Η γραμμή `exempt_0` του πίνακα· ότι απαιτεί αιτία το φυλά το
 * `company-vat-regime.test.ts`.
 */
export const GREEK_EXEMPT_VAT_RATE = GREEK_VAT_RATES[3].rate;

/** Στενευτής χωρίς `as`: `unknown` → συντελεστής, ή `false`. */
export function isGreekVatRatePercent(value: unknown): value is GreekVatRatePercent {
  return GREEK_VAT_RATE_PERCENTS.some((rate) => rate === value);
}
