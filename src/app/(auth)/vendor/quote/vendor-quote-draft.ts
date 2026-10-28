/**
 * Η προσφορά υπό σύνταξη στην πύλη (ADR-327 §8.5) — καθαρή λογική, χωρίς React:
 * αρχική κατάσταση · σύνολα · έλεγχος · ωφέλιμο φορτίο υποβολής.
 *
 * Το μοντέλο: **μία απάντηση ανά ζητούμενη γραμμή** (τιμή / περιλαμβάνεται / εξαιρείται) + εναλλακτικές δεμένες
 * σε γραμμή + πρόσθετες γραμμές. Οι κανόνες δεσίματος είναι του `rfq-line-binding` (ΕΝΑ σύνολο κανόνων, client
 * και server)· εδώ μόνο η μορφή της φόρμας.
 *
 * @module app/(auth)/vendor/quote/vendor-quote-draft
 * @enterprise ADR-327 §8.5
 */

import { generateOptimisticId } from '@/services/enterprise-id.service';
import { DEFAULT_UOM, resolveUom } from '@/lib/uom/uom-registry';
import { inferRfqLineId } from '@/subapps/procurement/utils/rfq-line-binding';
import { lockedFieldsOf, UNLOCKED_RESPONSE } from '@/subapps/procurement/utils/rfq-response-lock';
import type { RfqResponseLock } from '@/subapps/procurement/types/rfq';
import { computeQuoteTotals, type QuoteLine, type RfqScopeResponse } from '@/subapps/procurement/types/quote';
import { quoteLineTotal } from '@/subapps/procurement/utils/quote-line-total';
import type { PublicRfqLine } from '@/subapps/procurement/types/rfq-line';
import type {
  AdditionalLineDraft,
  AlternateDraft,
  QuoteLineDraft,
  QuoteSnapshot,
  RfqAnswerDraft,
  VendorQuoteDraft,
} from './types';

/** Κλειστό σύνολο ⇒ στατική `t()` ανά μέλος στη φόρμα (ADR-877 §6). */
export type DraftValidationError = 'validationLines' | 'validationAnswers' | 'validationAlternate';

/** Η μονάδα όπως τη λέει το μητρώο — άγνωστη γραφή μένει αυτούσια· κενή ⇒ `DEFAULT_UOM`. */
export function draftUnit(raw: string | null | undefined): string {
  return resolveUom(raw) ?? (raw?.trim() || DEFAULT_UOM);
}

export function emptyLineDraft(): QuoteLineDraft {
  return { description: '', quantity: '', unit: DEFAULT_UOM, unitPrice: '', vatRate: 24, notes: '' };
}

export function newAdditionalLine(): AdditionalLineDraft {
  return { ...emptyLineDraft(), key: generateOptimisticId() };
}

export function newAlternate(rfqLine: PublicRfqLine): AlternateDraft {
  return {
    ...emptyLineDraft(),
    key: generateOptimisticId(),
    rfqLineId: rfqLine.id,
    quantity: rfqLine.quantity != null ? String(rfqLine.quantity) : '',
    unit: draftUnit(rfqLine.unit),
  };
}

function lineToDraft(line: QuoteLine): QuoteLineDraft {
  return {
    description: line.description,
    quantity: String(line.quantity),
    unit: draftUnit(line.unit),
    unitPrice: String(line.unitPrice),
    vatRate: line.vatRate,
    notes: line.notes ?? '',
  };
}

// ============================================================================
// INITIAL STATE
// ============================================================================

/** Οι γραμμές της υπάρχουσας προσφοράς, ανά γραμμή RFQ — ρητά (§8.5) ή, σε παλιά προσφορά, με συμπέρασμα. */
function baseLinesByRfqLine(quote: QuoteSnapshot, rfqLines: readonly PublicRfqLine[]): Map<string, QuoteLine> {
  const explicit = quote.scopeResponses.length > 0 || quote.lines.some((l) => typeof l.rfqLineId === 'string');
  const out = new Map<string, QuoteLine>();
  for (const line of quote.lines) {
    const id = explicit ? line.rfqLineId ?? null : inferRfqLineId(line, rfqLines);
    if (id && !out.has(id)) out.set(id, line);
  }
  return out;
}

function freshAnswer(rfqLine: PublicRfqLine): RfqAnswerDraft {
  return {
    rfqLineId: rfqLine.id,
    answer: 'priced',
    quantity: rfqLine.quantity != null ? String(rfqLine.quantity) : '',
    unit: draftUnit(rfqLine.unit),
    unitPrice: '',
    vatRate: 24,
    notes: '',
  };
}

/** §8.5 Β — ο ίδιος κανόνας με τον server (`lockedFieldsOf`): η φόρμα ξεκινά ΗΔΗ με τις κλειδωμένες τιμές. */
function withLock(answer: RfqAnswerDraft, rfqLine: PublicRfqLine, lock: RfqResponseLock): RfqAnswerDraft {
  const locked = lockedFieldsOf(lock, rfqLine);
  return {
    ...answer,
    quantity: locked.quantity !== null ? String(locked.quantity) : answer.quantity,
    unit: locked.unit !== null ? draftUnit(locked.unit) : answer.unit,
  };
}

function answerFor(
  rfqLine: PublicRfqLine,
  priced: Map<string, QuoteLine>,
  scope: Map<string, RfqScopeResponse>,
): RfqAnswerDraft {
  const line = priced.get(rfqLine.id);
  if (line) {
    const { description: _description, ...draft } = lineToDraft(line);
    return { ...draft, rfqLineId: rfqLine.id, answer: 'priced' };
  }
  const response = scope.get(rfqLine.id);
  if (response) return { ...freshAnswer(rfqLine), answer: response.response, notes: response.note ?? '' };
  return freshAnswer(rfqLine);
}

export function initialVendorDraft(
  rfqLines: readonly PublicRfqLine[],
  quote: QuoteSnapshot | null,
  lock: RfqResponseLock = UNLOCKED_RESPONSE,
): VendorQuoteDraft {
  const priced = quote ? baseLinesByRfqLine(quote, rfqLines) : new Map<string, QuoteLine>();
  const scope = new Map((quote?.scopeResponses ?? []).map((r) => [r.rfqLineId, r] as const));
  const claimed = new Set(priced.values());
  const additional = (quote?.lines ?? [])
    .filter((line) => !claimed.has(line))
    .map((line) => ({ ...lineToDraft(line), key: generateOptimisticId() }));
  const alternates = (quote?.alternates ?? [])
    .filter((alt): alt is QuoteLine & { rfqLineId: string } => typeof alt.rfqLineId === 'string')
    .map((alt) => ({ ...lineToDraft(alt), key: generateOptimisticId(), rfqLineId: alt.rfqLineId }));
  return {
    answers: rfqLines.map((l) => withLock(answerFor(l, priced, scope), l, lock)),
    alternates,
    additional: rfqLines.length === 0 && additional.length === 0 ? [newAdditionalLine()] : additional,
  };
}

// ============================================================================
// TOTALS + VALIDATION
// ============================================================================

/** Σύνολο γραμμής με τον ΙΔΙΟ τύπο που γράφει ο server (`quoteLineTotal`)· μισοσυμπληρωμένη γραμμή ⇒ 0. */
export function draftLineTotal(line: Pick<QuoteLineDraft, 'quantity' | 'unitPrice'>): number {
  const total = quoteLineTotal(Number(line.quantity), Number(line.unitPrice));
  return Number.isFinite(total) ? total : 0;
}

/**
 * Η ΒΑΣΙΚΗ προσφορά: τιμολογημένες απαντήσεις + πρόσθετες. Οι εναλλακτικές ΔΕΝ μετρούν (ADR-327 §8.5).
 * Ο ΙΔΙΟΣ υπολογισμός με τον server (`computeQuoteTotals`) ⇒ ό,τι βλέπει ο προμηθευτής είναι ό,τι αποθηκεύεται.
 */
export function draftTotals(draft: VendorQuoteDraft): { subtotal: number; vatAmount: number; total: number } {
  const counted = [...draft.answers.filter((a) => a.answer === 'priced'), ...draft.additional];
  const { subtotal, vatAmount, total } = computeQuoteTotals(
    counted.map((l) => ({ lineTotal: draftLineTotal(l), vatRate: l.vatRate })),
  );
  return { subtotal, vatAmount, total };
}

function isPriceable(line: Pick<QuoteLineDraft, 'quantity' | 'unitPrice'>): boolean {
  const quantity = Number(line.quantity);
  const unitPrice = Number(line.unitPrice);
  return line.quantity.trim() !== '' && line.unitPrice.trim() !== ''
    && Number.isFinite(quantity) && quantity > 0 && Number.isFinite(unitPrice) && unitPrice >= 0;
}

function isBlank(line: QuoteLineDraft): boolean {
  return !line.description.trim() && !line.quantity.trim() && !line.unitPrice.trim();
}

export function validateDraft(draft: VendorQuoteDraft): DraftValidationError | null {
  if (draft.answers.some((a) => a.answer === 'priced' && !isPriceable(a))) return 'validationAnswers';
  if (draft.alternates.some((a) => !a.description.trim() || !isPriceable(a))) return 'validationAlternate';
  const additional = draft.additional.filter((l) => !isBlank(l));
  if (additional.some((l) => !l.description.trim() || !isPriceable(l))) return 'validationLines';
  const pricedCount = draft.answers.filter((a) => a.answer === 'priced').length + additional.length;
  return pricedCount === 0 ? 'validationLines' : null;
}

// ============================================================================
// SUBMISSION PAYLOAD (JSON fields of the multipart — `parsing.ts` on the server)
// ============================================================================

function lineJson(line: QuoteLineDraft, rfqLineId: string | null) {
  return {
    description: line.description.trim(),
    quantity: Number(line.quantity),
    unit: line.unit,
    unitPrice: Number(line.unitPrice),
    vatRate: line.vatRate,
    notes: line.notes.trim() || null,
    rfqLineId,
  };
}

export function toSubmissionPayload(draft: VendorQuoteDraft, rfqLines: readonly PublicRfqLine[]) {
  const descriptions = new Map(rfqLines.map((l) => [l.id, l.description] as const));
  const priced = draft.answers.filter((a) => a.answer === 'priced');
  return {
    lines: [
      ...priced.map((a) => lineJson({ ...a, description: descriptions.get(a.rfqLineId) ?? '' }, a.rfqLineId)),
      ...draft.additional.filter((l) => !isBlank(l)).map((l) => lineJson(l, null)),
    ],
    alternates: draft.alternates.map((a) => lineJson(a, a.rfqLineId)),
    scopeResponses: draft.answers
      .filter((a): a is RfqAnswerDraft & { answer: RfqScopeResponse['response'] } => a.answer !== 'priced')
      .map((a) => ({
        rfqLineId: a.rfqLineId,
        description: descriptions.get(a.rfqLineId) ?? '',
        response: a.answer,
        note: a.notes.trim() || null,
      })),
  };
}
