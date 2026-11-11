/**
 * @fileoverview **Οι κωδικοί της ΑΑΔΕ για το myDATA — ο ΕΝΑΣ πίνακας** (ADR-ACC-003 §7–§9).
 * @module subapps/accounting/services/mydata/mydata-codes
 *
 * 📘 **Πηγή**: ΑΑΔΕ, *myDATA REST API — τεχνική περιγραφή για χρήστες ERP*, **έκδοση 2.0.2**
 * (Σεπτ. 2026), Παράρτημα §8, και τα XSD v2.0.2 (`InvoicesDoc`, `SimpleTypes`).
 * https://www.aade.gr/mydata/tehnikes-prodiagrafes-ekdoseis-mydata
 *
 * 🔴 **Γιατί υπάρχει**: οι πίνακες §7–§9 του ADR-ACC-003 (γραμμένοι 2026-02 από μνήμης) ήταν
 * **λάθος** σε τρόπους πληρωμής και παρακρατήσεις — π.χ. «1 = Μετρητά» ενώ η ΑΑΔΕ λέει 3.
 * Εδώ ζει η αντιστοίχιση **μία φορά**, με παραπομπή ανά πίνακα· όποιος τη χρειάζεται την εισάγει.
 *
 * ⚠️ **Καμία μαντεψιά**: όπου η αντιστοίχιση από τα δεδομένα της εφαρμογής **δεν είναι μονοσήμαντη**
 * (π.χ. παρακράτηση 20% — ποια περίπτωση του άρθρου 64 ν.4172;), η συνάρτηση επιστρέφει `null`
 * και ο έλεγχος πριν την αποστολή **μπλοκάρει**. Λάθος κωδικός στην ΑΑΔΕ είναι λάθος δήλωση.
 *
 * Καθαρό αρχείο: καμία εξάρτηση εκτέλεσης — πελάτης, διακομιστής, tests.
 */

import type { InvoiceLineItem, InvoiceType } from '../../types/invoice';
import type { PaymentMethod } from '../../types/common';
import { GREEK_VAT_RATES } from '../config/vat-rates';
import { isVatExemptionCode, type VatExemptionCode } from '../config/vat-exemption-reasons';

/** Η έκδοση των προδιαγραφών ΑΑΔΕ με την οποία είναι γραμμένοι οι πίνακες. */
export const MYDATA_SPEC_VERSION = '2.0.2' as const;

/** Namespace του `InvoicesDoc` (XSD v2.0.2 — το namespace παραμένει `v1.0`). */
export const MYDATA_INVOICE_NAMESPACE = 'http://www.aade.gr/myDATA/invoice/v1.0' as const;

// ============================================================================
// §8.1 ΕΙΔΗ ΠΑΡΑΣΤΑΤΙΚΩΝ
// ============================================================================

/** Τύπος παραστατικού της εφαρμογής → κωδικός ΑΑΔΕ (§8.1). Εξαντλητικός: νέος τύπος = σφάλμα μεταγλώττισης. */
export const MYDATA_INVOICE_TYPE_CODES = {
  sales_invoice: '1.1', // Τιμολόγιο Πώλησης
  service_invoice: '2.1', // Τιμολόγιο Παροχής
  service_invoice_eu: '2.2', // Τιμολόγιο Παροχής / Ενδοκοινοτική Παροχή Υπηρεσιών
  service_invoice_3rd: '2.3', // Τιμολόγιο Παροχής / Παροχή Υπηρεσιών σε λήπτη Τρίτης Χώρας
  credit_invoice: '5.1', // Πιστωτικό Τιμολόγιο / Συσχετιζόμενο
  retail_receipt: '11.1', // ΑΛΠ
  service_receipt: '11.2', // ΑΠΥ
} as const satisfies Record<InvoiceType, string>;

export type MyDataInvoiceTypeCode = (typeof MYDATA_INVOICE_TYPE_CODES)[InvoiceType];

/** Αντικριζόμενα παραστατικά: απαιτούν στοιχεία λήπτη (`counterpart`). Οι αποδείξεις λιανικής (11.x) όχι. */
export const MYDATA_COUNTERPART_REQUIRED: ReadonlySet<InvoiceType> = new Set<InvoiceType>([
  'sales_invoice',
  'service_invoice',
  'service_invoice_eu',
  'service_invoice_3rd',
  'credit_invoice',
]);

/** Το 5.1 είναι **συσχετιζόμενο**: απαιτεί τον ΜΑΡΚ του αρχικού στο `correlatedInvoices`. */
export const MYDATA_CORRELATION_REQUIRED: ReadonlySet<InvoiceType> = new Set<InvoiceType>(['credit_invoice']);

// ============================================================================
// §8.2 ΚΑΤΗΓΟΡΙΑ ΦΠΑ · §8.3 ΑΙΤΙΑ ΕΞΑΙΡΕΣΗΣ
// ============================================================================

/**
 * Κατηγορία ΦΠΑ «0% — Άνευ ΦΠΑ» (§8.2 κωδ. 7): απαιτεί **πάντα** αιτία εξαίρεσης (§8.3).
 * ⚠️ ΟΧΙ το 8: εκείνο είναι «Εγγραφές χωρίς ΦΠΑ (π.χ. μισθοδοσία, αποσβέσεις)», όχι γραμμή τιμολογίου.
 */
export const MYDATA_VAT_CATEGORY_ZERO = 7 as const;

/**
 * Συντελεστής ΦΠΑ → κατηγορία ΑΑΔΕ. **Πηγή ο πίνακας `GREEK_VAT_RATES`** (μία αλήθεια για τους
 * συντελεστές)· εδώ μόνο η αναζήτηση. `null` = συντελεστής που η εφαρμογή δεν γνωρίζει.
 */
export function myDataVatCategoryOf(vatRate: number): number | null {
  return GREEK_VAT_RATES.find((entry) => entry.rate === vatRate)?.mydataCategory ?? null;
}

/**
 * Αιτία εξαίρεσης ΦΠΑ (§8.3, XSD `VatExemptionType`) — **μέλος του καταλόγου** `VAT_EXEMPTION_REASONS`,
 * όχι απλώς ακέραιος σε εύρος: ο κατάλογος είναι η μία αλήθεια για το ποιοι κωδικοί υπάρχουν.
 */
export function isValidMyDataVatExemption(code: number | null | undefined): code is VatExemptionCode {
  return isVatExemptionCode(code);
}

/** Ο συντελεστής ανήκει στην κατηγορία 7 «Άνευ ΦΠΑ» ⇒ η γραμμή **χρειάζεται** αιτία εξαίρεσης. */
export function requiresVatExemption(vatRate: number): boolean {
  return myDataVatCategoryOf(vatRate) === MYDATA_VAT_CATEGORY_ZERO;
}

/**
 * Λείπει (ή είναι άκυρη) η αιτία που απαιτείται. **ΕΝΑΣ κανόνας** για τη φόρμα (μήνυμα στη γραμμή) και τον
 * έλεγχο πριν τη διαβίβαση (`VAT_EXEMPTION_MISSING`): ό,τι λέει η φόρμα «λείπει» είναι ό,τι θα μπλοκάρει.
 */
export function isVatExemptionMissing(line: Pick<InvoiceLineItem, 'vatRate' | 'vatExemptionCategory'>): boolean {
  return requiresVatExemption(line.vatRate) && !isValidMyDataVatExemption(line.vatExemptionCategory);
}

/**
 * Αιτία εξαίρεσης σε συντελεστή που **δεν** τη δέχεται (π.χ. κωδικός 15 σε γραμμή 24%). **ΕΝΑΣ κανόνας** για τον
 * διακομιστή — γραμμές τιμολογίου (`invoice-schemas.ts`) **και** υπηρεσίες (`setup/presets`): αντίφαση = απόρριψη.
 */
export function hasVatExemptionContradiction(
  item: Pick<InvoiceLineItem, 'vatRate' | 'vatExemptionCategory'>,
): boolean {
  return item.vatExemptionCategory != null && !requiresVatExemption(item.vatRate);
}

// ============================================================================
// §8.11 ΧΑΡΑΚΤΗΡΙΣΜΟΣ ΦΠΑ ΕΞΟΔΩΝ (υποσύνολο ΦΠΑ του «Κωδικός Τύπου Χαρακτηρισμού Εξόδων»)
// ============================================================================

/**
 * Κωδικοί χαρακτηρισμού ΦΠΑ του **λήπτη** (§8.11) — αντιστοιχούν στα πεδία εισροών 361–366 του Φ2· `NOT_VAT_295` =
 * «Μη συμμετοχή στο ΦΠΑ (έξοδα – εισροές Φ2)». Χρησιμοποιούνται **μόνο** στον χαρακτηρισμό εξόδων (`vatAmount`,
 * `vatCategory`, `vatExemptionCategory` του `ExpensesClassificationType` — §5.x, παρατήρηση 3). ADR-ACC-003 §22.7.
 */
export const MYDATA_EXPENSE_VAT_CLASSIFICATIONS = [
  'VAT_361', // Αγορές & δαπάνες στο εσωτερικό της χώρας
  'VAT_362', // Αγορές & εισαγωγές επενδ. αγαθών (πάγια)
  'VAT_363', // Λοιπές εισαγωγές εκτός επενδ. αγαθών (πάγια)
  'VAT_364', // Ενδοκοινοτικές αποκτήσεις αγαθών
  'VAT_365', // Ενδοκοινοτικές λήψεις υπηρεσιών άρθρ. 14.2.α (Φ2 2025: 18.2.α)
  'VAT_366', // Λοιπές πράξεις λήπτη
  'NOT_VAT_295', // Μη συμμετοχή στο ΦΠΑ (σφάλμα 341: όχι σε 14.1 / 14.3)
] as const;

export type MyDataExpenseVatClassification = (typeof MYDATA_EXPENSE_VAT_CLASSIFICATIONS)[number];

/**
 * Σφάλμα **334**: «σε περίπτωση χωρίς υποχρέωση ΦΠΑ, απαιτείται ταξινόμηση με παρόμοια κατηγορία απαλλαγής ΦΠΑ,
 * κατηγορία ΦΠΑ **24% ή 17%** και τύπο ταξινόμησης 366» — ο λήπτης αυτοεπιβαρύνεται με αυτές τις κατηγορίες §8.2.
 */
export const MYDATA_SELF_ASSESSED_VAT_CATEGORIES = [1, 4] as const; // 24% · 17%

// ============================================================================
// §8.4 ΚΑΤΗΓΟΡΙΑ ΠΑΡΑΚΡΑΤΟΥΜΕΝΩΝ ΦΟΡΩΝ
// ============================================================================

/**
 * Ποσοστό παρακράτησης → κατηγορία ΑΑΔΕ, **μόνο όπου η αντιστοίχιση είναι μονοσήμαντη**.
 *
 * - 3% → **4** «Περιπτ. δ' — Τεχνικά Έργα 3%».
 *
 * ❓ Ανοιχτά (ADR-ACC-003 §20): το **20%** της εφαρμογής (αμοιβές ελ. επαγγελματιών) δεν αντιστοιχεί
 * σε μία γραμμή του §8.4 (2 = Δικαιώματα 20%, 3 = Αμοιβές Συμβουλών Διοίκησης 20%)· το **1%** της
 * εφαρμογής ορίζεται «αντιπρόσωποι» (`types/invoice.ts`), ενώ στο §8.4 το 1% είναι **5 = Υγρά καύσιμα
 * και προϊόντα καπνοβιομηχανίας**. Μέχρι να απαντήσει λογιστής → `null` → μπλοκάρει.
 */
const WITHHOLDING_CATEGORY_BY_RATE: ReadonlyMap<number, number> = new Map([[3, 4]]);

export function myDataWithholdingCategoryOf(withholdingRate: number): number | null {
  return WITHHOLDING_CATEGORY_BY_RATE.get(withholdingRate) ?? null;
}

// ============================================================================
// §8.12 ΤΡΟΠΟΙ ΠΛΗΡΩΜΗΣ
// ============================================================================

/**
 * Τρόπος πληρωμής της εφαρμογής → κωδικός ΑΑΔΕ (§8.12):
 * 1 Επαγγ. Λογαριασμός Πληρωμών Ημεδαπής · 2 … Αλλοδαπής · 3 Μετρητά · 4 Επιταγή · 5 Επί Πιστώσει ·
 * 6 Web Banking · 7 POS / e-POS · 8 Άμεσες Πληρωμές IRIS.
 *
 * - `bank_transfer` → 1: κατάθεση στον δηλωμένο επαγγελματικό λογαριασμό.
 * - `card` → 7: η εφαρμογή δεν ξεχωρίζει άλλο κανάλι κάρτας (και τα πορτοφόλια Apple Pay / Google Pay είναι κάρτα).
 * - `iris` → 8: άμεση πληρωμή IRIS (ΑΑΔΕ, myDATA v1.0.9 — 15.07.2024· ADR-ACC-030).
 * - `mixed` → `null`: ο μικτός τρόπος θέλει **ανάλυση ποσών ανά τρόπο**, που το τιμολόγιο δεν κρατά.
 * - `non_cash` → `null`: μη ταμειακή εγγραφή (απόσβεση) — δεν είναι παραστατικό προς διαβίβαση.
 */
export const MYDATA_PAYMENT_METHOD_CODES = {
  bank_transfer: 1,
  cash: 3,
  check: 4,
  credit: 5,
  card: 7,
  iris: 8,
  mixed: null,
  non_cash: null,
} as const satisfies Record<PaymentMethod, number | null>;

export function myDataPaymentMethodOf(method: PaymentMethod): number | null {
  return MYDATA_PAYMENT_METHOD_CODES[method];
}
