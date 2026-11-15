/**
 * @fileoverview ADR-915 §42 — **το πρόχειρο της προσφοράς**: ό,τι κρατά η φόρμα και η ΜΙΑ μετάφρασή του σε όρους του
 *   σώματος. Καθαρό (χωρίς UI), ώστε η σελίδα να κρατά την κατάσταση ενώ τα πεδία φορτώνονται με `next/dynamic`.
 * @related IssuanceQuoteFields.tsx (τα πεδία) · lib/document-validity/issuance-request.ts (`quoteTermsBody`)
 * @module components/document-registry/issuance-quote-draft
 */

import { conveyanceToday } from '@/lib/conveyance/conveyance-calendar';
import {
  isQuoteDeliveryBusinessDays,
  QUOTE_SCOPE_ITEMS,
  type QuoteBasis,
  type QuoteScopeItem,
} from '@/lib/document-validity/issuance-quote';
import type { QuoteTermsBody } from '@/lib/document-validity/issuance-request';
import { majorFromMinor, minorFromMajor } from '@/lib/money/money';
import { parseStrictDecimal } from '@/lib/number/locale-number';
import { GREEK_STANDARD_VAT_RATE, type GreekVatRatePercent } from '@/subapps/accounting/services/config/vat-rates';

/** Ό,τι κρατά η φόρμα — το ποσό ως κείμενο (ό,τι πληκτρολόγησε ο άνθρωπος), όλα τα άλλα ήδη τυπωμένα. */
export interface QuoteDraft {
  readonly amount: string;
  readonly vatRatePercent: GreekVatRatePercent;
  readonly vatIncluded: boolean;
  readonly basis: QuoteBasis | null;
  readonly validUntil: string;
  readonly scope: readonly QuoteScopeItem[];
  /** §45 Φ2 — «παράδοση σε N εργάσιμες», ως κείμενο· **καμία** προεπιλογή: τον χρόνο τον δεσμεύει ο επαγγελματίας. */
  readonly deliveryDays: string;
}

const DEFAULT_VALIDITY_DAYS = 30;
const DAY_MS = 86_400_000;

export function emptyQuoteDraft(now: Date = new Date()): QuoteDraft {
  return {
    amount: '',
    vatRatePercent: GREEK_STANDARD_VAT_RATE,
    vatIncluded: false,
    basis: null,
    validUntil: conveyanceToday(new Date(now.getTime() + DEFAULT_VALIDITY_DAYS * DAY_MS)),
    scope: QUOTE_SCOPE_ITEMS,
    deliveryDays: '',
  };
}

/** Οι εργάσιμες ως ακέραιος του επιτρεπτού εύρους — αλλιώς `null` (μόνο ψηφία: «5», όχι «5,5» ούτε «5 ημ.»). */
export function deliveryDaysOf(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const days = Number(trimmed);
  return isQuoteDeliveryBusinessDays(days) ? days : null;
}

/**
 * Το ποσό σε λεπτά — από τη ΜΙΑ γραμματική αριθμού της εφαρμογής (`parseStrictDecimal`: «150,50» · «1.200,50» ·
 * «150.50»)· οτιδήποτε άλλο, ή περισσότερα από δύο δεκαδικά (δεν χωρά σε λεπτά χωρίς στρογγύλευση) ⇒ `null`.
 */
function amountMinorOf(amount: string): number | null {
  const major = parseStrictDecimal(amount);
  if (major === null || major <= 0) return null;
  const minor = minorFromMajor(major);
  return minor !== null && minor > 0 && Math.abs(majorFromMinor(minor) - major) < 1e-9 ? minor : null;
}

/** Η φόρμα → οι όροι του σώματος· `null` όσο κάτι λείπει (το κουμπί μένει ανενεργό). */
export function quoteTermsFromDraft(draft: QuoteDraft): QuoteTermsBody | null {
  const amountMinor = amountMinorOf(draft.amount);
  const deliveryBusinessDays = deliveryDaysOf(draft.deliveryDays);
  if (amountMinor === null || draft.basis === null || draft.scope.length === 0 || draft.validUntil === '' || deliveryBusinessDays === null) return null;
  return {
    basis: draft.basis,
    amountMinor,
    vatRatePercent: draft.vatRatePercent,
    // «Άνευ ΦΠΑ» δεν έχει «με ή χωρίς» — μία αλήθεια και εδώ.
    vatIncluded: draft.vatRatePercent === 0 ? false : draft.vatIncluded,
    validUntil: draft.validUntil,
    scope: [...draft.scope],
    deliveryBusinessDays,
  };
}
