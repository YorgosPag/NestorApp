/**
 * =============================================================================
 * Μητρώο λήξεων — Η ΠΡΟΣΦΟΡΑ του επαγγελματία πριν από την ανάθεση (ADR-915 §42)
 * =============================================================================
 *
 * **«Πόσο, με τι ΦΠΑ, για τι, μέχρι πότε — και είναι δεσμευτικό;»** Ο επαγγελματίας βλέπει τον φάκελο προσφοράς,
 * δίνει **μία** τιμή, ο υπεύθυνος την εγκρίνει, και τότε ξεκινά η ανάθεση (Thumbtack · Upwork · Procore · Houzz).
 *
 * 🔑 **Μία τιμή, μία αλήθεια.** Κανένα πεδίο «μετρητά», καμία δεύτερη τιμή: ό,τι καταγράφεται είναι η συμφωνία. Ο
 *    ΜΑΡΚ του παραστατικού (myDATA) δένεται **μόνο** με το σύνολο της **εγκεκριμένης** αναθεώρησης· αν διαφέρει,
 *    πρώτα αναθεώρηση — ποτέ δύο ποσά για την ίδια δουλειά.
 * 🔑 **Ενδεικτική ≠ δεσμευτική** (Checkatrade/MyBuilder): η ενδεικτική («υπό αυτοψία») αναθεωρείται **μία** φορά μετά
 *    την αυτοψία, και η αναθεώρηση **ακυρώνει** την έγκριση (Houzz change order) — το στάδιο το παράγει ο μειωτής.
 * 🔑 **Ποσά σε λεπτά** (`MinorAmount`) και συντελεστής από τον **έναν** πίνακα ΦΠΑ — ποτέ κινητή υποδιαστολή.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O. Στη Φάση Π2 κάθε προσκεκλημένος κρατά μία τέτοια προσφορά.
 *
 * @module lib/document-validity/issuance-quote
 */

import { isMinorAmount, type MinorAmount } from '@/lib/money/money';
import { GREEK_VAT_RATE_PERCENTS, type GreekVatRatePercent } from '@/subapps/accounting/services/config/vat-rates';

/** `indicative` = υπό αυτοψία (αναθεωρείται μία φορά) · `firm` = δεσμευτική. */
export const QUOTE_BASES = ['indicative', 'firm'] as const;
export type QuoteBasis = (typeof QUOTE_BASES)[number];

/** Τι περιλαμβάνει η τιμή — κλειστό σύνολο, ό,τι απαιτεί η έκδοση ΠΕΑ (ν.4122/2013). */
export const QUOTE_SCOPE_ITEMS = ['site-visit', 'issuance', 'registration'] as const;
export type QuoteScopeItem = (typeof QUOTE_SCOPE_ITEMS)[number];

/** Η πρώτη προσφορά και η **μία** αναθεώρηση μετά την αυτοψία. */
export const QUOTE_MAX_REVISION = 2;

/**
 * §45 Φ2 — «παράδοση σε N εργάσιμες από την έγκριση»: δέσμευση του επαγγελματία μέσα στην προσφορά. Τα όρια είναι
 * αμυντικά (ακέραιος, όχι ανοιχτό πεδίο), **όχι** εκτίμηση του χρόνου έκδοσης — αυτόν τον δεσμεύει ο ίδιος.
 */
export const QUOTE_DELIVERY_BUSINESS_DAYS = { min: 1, max: 90 } as const;

export function isQuoteDeliveryBusinessDays(value: number | null): value is number {
  return value !== null && Number.isInteger(value)
    && value >= QUOTE_DELIVERY_BUSINESS_DAYS.min && value <= QUOTE_DELIVERY_BUSINESS_DAYS.max;
}

/** Ο ΜΑΡΚ του myDATA: 15 ψηφία. */
export const MYDATA_MARK_PATTERN = /^\d{15}$/;

/** Ποιος καταχώρισε την προσφορά — ο ίδιος με τον σύνδεσμό του, ή το γραφείο που την έλαβε. */
export type QuoteSubmission =
  | { readonly by: 'professional-link'; readonly invitationId: string }
  | { readonly by: 'recorded'; readonly recordedByUid: string };

/** Οι όροι της προσφοράς — ό,τι στέλνει ο επαγγελματίας (ή καταγράφει το γραφείο). */
export interface QuoteTerms {
  readonly basis: QuoteBasis;
  /** Το ποσό **όπως το δηλώνει** — καθαρό ή με ΦΠΑ, κατά `vatIncluded`. */
  readonly amountMinor: MinorAmount;
  /** `0` = άνευ ΦΠΑ. */
  readonly vatRatePercent: GreekVatRatePercent;
  readonly vatIncluded: boolean;
  /** ISO ημέρα (YYYY-MM-DD) — μέχρι πότε ισχύει. */
  readonly validUntil: string;
  readonly scope: readonly QuoteScopeItem[];
  readonly note: string | null;
  /**
   * §45 Φ2 — παράδοση σε N εργάσιμες **από την έγκριση**. Υποχρεωτικό σε κάθε νέα προσφορά ({@link areQuoteTermsValid})·
   * `null` = προσφορά πριν από τη Φ2 (καμία δέσμευση χρόνου — την ημερομηνία την ορίζει τότε το γραφείο, με ίχνος).
   */
  readonly deliveryBusinessDays: number | null;
}

export interface IssuanceQuote extends QuoteTerms {
  /** 1 = αρχική · 2 = αναθεώρηση μετά την αυτοψία. */
  readonly revision: number;
  readonly at: string;
  readonly submission: QuoteSubmission;
  /** Η αναθεώρηση κρατά την αρχική — το ίχνος δεν σβήνεται. */
  readonly previous: Omit<IssuanceQuote, 'previous'> | null;
}

/** Το παραστατικό της εγκεκριμένης τιμής — προαιρετικό, δεν μπλοκάρει τίποτα. */
export interface IssuanceReceipt {
  readonly mark: string;
  /** ISO ημέρα έκδοσης του παραστατικού. */
  readonly issuedOn: string;
  readonly totalMinor: MinorAmount;
  readonly at: string;
  readonly recordedByUid: string;
}

export interface QuoteTotals {
  readonly netMinor: MinorAmount;
  readonly vatMinor: MinorAmount;
  readonly totalMinor: MinorAmount;
}

/**
 * Καθαρό · ΦΠΑ · σύνολο σε λεπτά. Με ΦΠΑ μέσα, το καθαρό βγαίνει με **μία** στρογγύλευση και το ΦΠΑ είναι η διαφορά
 * ⇒ `net + vat === total` πάντα.
 */
export function quoteTotalsOf(terms: Pick<QuoteTerms, 'amountMinor' | 'vatRatePercent' | 'vatIncluded'>): QuoteTotals {
  const { amountMinor, vatRatePercent, vatIncluded } = terms;
  if (vatIncluded) {
    const netMinor = Math.round((amountMinor * 100) / (100 + vatRatePercent));
    return { netMinor, vatMinor: amountMinor - netMinor, totalMinor: amountMinor };
  }
  const vatMinor = Math.round((amountMinor * vatRatePercent) / 100);
  return { netMinor: amountMinor, vatMinor, totalMinor: amountMinor + vatMinor };
}

/**
 * Είναι οι όροι αποδεκτοί; — θετικό ποσό, συντελεστής του πίνακα, έστω ένα περιλαμβανόμενο, ισχύς από σήμερα, και
 * (§45 Φ2) χρόνος παράδοσης: καμία **νέα** προσφορά χωρίς δέσμευση χρόνου.
 */
export function areQuoteTermsValid(terms: QuoteTerms, today: string): boolean {
  return isMinorAmount(terms.amountMinor) && terms.amountMinor > 0
    && GREEK_VAT_RATE_PERCENTS.includes(terms.vatRatePercent)
    && terms.scope.length > 0
    && terms.validUntil >= today
    && isQuoteDeliveryBusinessDays(terms.deliveryBusinessDays);
}

/** Επιτρέπεται αναθεώρηση; — μόνο ενδεικτικής, μόνο μία φορά. */
export function canReviseQuote(quote: IssuanceQuote): boolean {
  return quote.basis === 'indicative' && quote.revision < QUOTE_MAX_REVISION;
}

/** Η προσφορά που προκύπτει από νέους όρους — πρώτη ή αναθεώρηση της τρέχουσας. */
export function nextQuoteOf(current: IssuanceQuote | null, terms: QuoteTerms, submission: QuoteSubmission, at: string): IssuanceQuote {
  if (current === null) return { ...terms, revision: 1, at, submission, previous: null };
  const prior: Omit<IssuanceQuote, 'previous'> = {
    basis: current.basis, amountMinor: current.amountMinor, vatRatePercent: current.vatRatePercent,
    vatIncluded: current.vatIncluded, validUntil: current.validUntil, scope: current.scope, note: current.note,
    deliveryBusinessDays: current.deliveryBusinessDays, revision: current.revision, at: current.at, submission: current.submission,
  };
  return { ...terms, revision: current.revision + 1, at, submission, previous: prior };
}

/** Ταιριάζει το παραστατικό με την εγκεκριμένη τιμή; — ίδιο σύνολο, έγκυρος ΜΑΡΚ. */
export function receiptMatchesQuote(receipt: Pick<IssuanceReceipt, 'mark' | 'totalMinor'>, quote: IssuanceQuote): boolean {
  return MYDATA_MARK_PATTERN.test(receipt.mark) && receipt.totalMinor === quoteTotalsOf(quote).totalMinor;
}

/** Από ποιο σύνολο και πάνω η εξόφληση σε ιδιώτη γίνεται μόνο ηλεκτρονικά (ν.5301/2026 — ενημερωτικό, όχι επιβολή). */
export const ELECTRONIC_PAYMENT_THRESHOLD_MINOR: MinorAmount = 50_000;

export function requiresElectronicPayment(totals: QuoteTotals): boolean {
  return totals.totalMinor >= ELECTRONIC_PAYMENT_THRESHOLD_MINOR;
}
