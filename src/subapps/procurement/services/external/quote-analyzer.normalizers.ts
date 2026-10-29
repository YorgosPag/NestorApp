/**
 * Quote Analyzer Normalizers — ADR-327 §6 + ADR-336.
 *
 * Pure functions that turn `RawExtractedQuote` (OpenAI JSON shape) into
 * `ExtractedQuoteData` (FieldWithConfidence-wrapped UI shape). Extracted
 * from `openai-quote-analyzer.ts` to keep that file under the Google
 * file-size limit.
 */

import type {
  ExtractedQuoteData,
  ExtractedQuoteLine,
  ExtractedSignatory,
  FieldWithConfidence,
} from '../../types/quote';
import type {
  RawComponent,
  RawExtractedQuote,
  RawSignatory,
} from './quote-analyzer.schemas';
import { structuredText, structuredTextList } from '@/lib/ai-structured-output';
import { QUOTE_EXTRACTION_NORMALIZATION_VERSION } from './quote-extraction-version';

// ============================================================================
// FIELD WRAPPER
// ============================================================================

export function field<T>(value: T, confidence: number | undefined): FieldWithConfidence<T> {
  return { value, confidence: typeof confidence === 'number' ? confidence : 0 };
}

// ============================================================================
// SIGNATORY (ADR-336)
// ============================================================================

export function buildEmptySignatory(): ExtractedSignatory {
  return {
    firstName: field<string | null>(null, 0),
    lastName: field<string | null>(null, 0),
    role: field<string | null>(null, 0),
    profession: field<string | null>(null, 0),
    mobile: field<string | null>(null, 0),
    email: field<string | null>(null, 0),
    vatNumber: field<string | null>(null, 0),
  };
}

export function normalizeSignatory(raw: RawSignatory | undefined | null): ExtractedSignatory {
  if (!raw) return buildEmptySignatory();
  return {
    firstName: field<string | null>(structuredText(raw.firstName), raw.firstNameConfidence),
    lastName: field<string | null>(structuredText(raw.lastName), raw.lastNameConfidence),
    role: field<string | null>(structuredText(raw.role), raw.roleConfidence),
    profession: field<string | null>(structuredText(raw.profession), raw.professionConfidence),
    mobile: field<string | null>(structuredText(raw.mobile), raw.mobileConfidence),
    email: field<string | null>(structuredText(raw.email), raw.emailConfidence),
    vatNumber: field<string | null>(structuredText(raw.vatNumber), raw.vatNumberConfidence),
  };
}

// ============================================================================
// FALLBACK
// ============================================================================

export function buildFallbackExtractedData(): ExtractedQuoteData {
  return {
    vendorName: field<string | null>(null, 0),
    vendorVat: field<string | null>(null, 0),
    vendorPhone: field<string | null>(null, 0),
    vendorEmails: field<string[]>([], 0),
    vendorAddress: field<string | null>(null, 0),
    vendorCity: field<string | null>(null, 0),
    vendorPostalCode: field<string | null>(null, 0),
    vendorCountry: field<string | null>(null, 0),
    quoteDate: field<string | null>(null, 0),
    validUntil: field<string | null>(null, 0),
    quoteReference: field<string | null>(null, 0),
    lineItems: [],
    subtotal: field<number | null>(null, 0),
    vatAmount: field<number | null>(null, 0),
    totalAmount: field<number | null>(null, 0),
    paymentTerms: field<string | null>(null, 0),
    deliveryTerms: field<string | null>(null, 0),
    warranty: field<string | null>(null, 0),
    notes: field<string | null>(null, 0),
    tradeHint: field<string | null>(null, 0),
    pricingType: field<'unit_prices' | 'lump_sum' | 'mixed' | null>(null, 0),
    vatIncluded: field<boolean | null>(null, 0),
    laborIncluded: field<boolean | null>(null, 0),
    vendorBankAccounts: [],
    signatory: buildEmptySignatory(),
    detectedLanguage: 'unknown',
    overallConfidence: 0,
    normalizationVersion: QUOTE_EXTRACTION_NORMALIZATION_VERSION,
  };
}

// ============================================================================
// LINE ITEMS
// ============================================================================

function normalizeComponent(c: RawComponent, parentRowNumber: string | null, parentDescription: string): ExtractedQuoteLine {
  const compDesc = structuredText(c.description) ?? '';
  const merged = parentDescription && compDesc && !compDesc.includes(parentDescription)
    ? `${parentDescription} — ${compDesc}`
    : compDesc || parentDescription;
  return {
    description: { value: merged, confidence: c.descriptionConfidence ?? 0 },
    quantity: { value: c.quantity ?? 0, confidence: c.quantityConfidence ?? 0 },
    unit: { value: structuredText(c.unit) ?? '', confidence: c.unitConfidence ?? 0 },
    unitPrice: { value: c.unitPrice ?? 0, confidence: c.unitPriceConfidence ?? 0 },
    discountPercent: { value: c.discountPercent, confidence: c.discountPercentConfidence ?? 0 },
    vatRate: { value: c.vatRate ?? 24, confidence: c.vatRateConfidence ?? 0 },
    lineTotal: { value: c.lineTotal ?? 0, confidence: c.lineTotalConfidence ?? 0 },
    parentRowNumber,
  };
}

export function normalizeLineItems(raw: RawExtractedQuote['lineItems']): ExtractedQuoteLine[] {
  if (!Array.isArray(raw)) return [];
  const flat: ExtractedQuoteLine[] = [];
  for (const item of raw) {
    const parentDesc = structuredText(item.description) ?? '';
    const components = Array.isArray(item.components) ? item.components : [];
    if (components.length === 0) {
      flat.push({
        description: { value: parentDesc, confidence: item.descriptionConfidence ?? 0 },
        quantity: { value: 1, confidence: 0 },
        unit: { value: '', confidence: 0 },
        unitPrice: { value: item.rowSubtotal ?? 0, confidence: item.rowSubtotalConfidence ?? 0 },
        discountPercent: { value: null, confidence: 0 },
        vatRate: { value: 24, confidence: 0 },
        lineTotal: { value: item.rowSubtotal ?? 0, confidence: item.rowSubtotalConfidence ?? 0 },
        parentRowNumber: structuredText(item.rowNumber),
      });
      continue;
    }
    for (const c of components) {
      flat.push(normalizeComponent(c, structuredText(item.rowNumber), parentDesc));
    }
  }
  return flat;
}

// ============================================================================
// FULL EXTRACTION NORMALIZE
// ============================================================================

const VALIDATION_FAIL_CONFIDENCE_CAP = 50;

function appendValidationIssuesToNotes(originalNotes: string | null, issues: string[]): string {
  const header = '⚠️ Αυτόματη επαλήθευση εντόπισε ασυνέπειες — απαιτείται χειροκίνητος έλεγχος:';
  const bullets = issues.slice(0, 6).map((i) => `  • ${i}`).join('\n');
  const block = `${header}\n${bullets}`;
  return originalNotes ? `${originalNotes}\n\n${block}` : block;
}

export function normalizeExtracted(
  raw: RawExtractedQuote,
  validationIssues: string[] = [],
  softWarnings: string[] = [],
): ExtractedQuoteData {
  const c = raw.confidence ?? {};
  const failed = validationIssues.length > 0;
  const rawOverall = typeof raw.overallConfidence === 'number' ? raw.overallConfidence : 0;
  const overallConfidence = failed ? Math.min(VALIDATION_FAIL_CONFIDENCE_CAP, rawOverall) : rawOverall;
  const cap = (n: number | undefined): number => {
    const v = typeof n === 'number' ? n : 0;
    return failed ? Math.min(VALIDATION_FAIL_CONFIDENCE_CAP, v) : v;
  };
  let notesValue = structuredText(raw.notes);
  if (failed) {
    notesValue = appendValidationIssuesToNotes(notesValue, validationIssues);
  } else if (softWarnings.length > 0) {
    notesValue = appendValidationIssuesToNotes(notesValue, softWarnings);
  }
  return {
    vendorName: field<string | null>(structuredText(raw.vendorName), c.vendorName),
    vendorVat: field<string | null>(structuredText(raw.vendorVat), c.vendorVat),
    vendorPhone: field<string | null>(structuredText(raw.vendorPhone), c.vendorPhone),
    vendorEmails: field<string[]>(structuredTextList(raw.vendorEmails), c.vendorEmails),
    vendorAddress: field<string | null>(structuredText(raw.vendorAddress), c.vendorAddress),
    vendorCity: field<string | null>(structuredText(raw.vendorCity), c.vendorCity),
    vendorPostalCode: field<string | null>(structuredText(raw.vendorPostalCode), c.vendorPostalCode),
    vendorCountry: field<string | null>(structuredText(raw.vendorCountry), c.vendorCountry),
    quoteDate: field<string | null>(structuredText(raw.quoteDate), c.quoteDate),
    validUntil: field<string | null>(structuredText(raw.validUntil), c.validUntil),
    quoteReference: field<string | null>(structuredText(raw.quoteReference), c.quoteReference),
    lineItems: normalizeLineItems(raw.lineItems),
    subtotal: field<number | null>(raw.subtotal ?? null, cap(c.subtotal)),
    vatAmount: field<number | null>(raw.vatAmount ?? null, cap(c.vatAmount)),
    totalAmount: field<number | null>(raw.totalAmount ?? null, cap(c.totalAmount)),
    paymentTerms: field<string | null>(structuredText(raw.paymentTerms), c.paymentTerms),
    deliveryTerms: field<string | null>(structuredText(raw.deliveryTerms), c.deliveryTerms),
    warranty: field<string | null>(structuredText(raw.warranty), c.warranty),
    notes: field<string | null>(notesValue, c.notes),
    tradeHint: field<string | null>(structuredText(raw.tradeHint), c.tradeHint),
    pricingType: field<'unit_prices' | 'lump_sum' | 'mixed' | null>(
      (raw.pricingType as 'unit_prices' | 'lump_sum' | 'mixed' | null) ?? null,
      raw.pricingType != null ? 90 : 0,
    ),
    vatIncluded: field<boolean | null>(raw.vatIncluded ?? null, raw.vatIncludedConfidence ?? 0),
    laborIncluded: field<boolean | null>(raw.laborIncluded ?? null, raw.laborIncludedConfidence ?? 0),
    vendorBankAccounts: (raw.vendorBankAccounts ?? []).map((b) => ({
      bankName: b.bankName,
      bic: structuredText(b.bic),
      iban: b.iban,
      currency: structuredText(b.currency),
      accountHolder: structuredText(b.accountHolder),
    })),
    signatory: normalizeSignatory(raw.signatory),
    detectedLanguage: raw.detectedLanguage ?? 'unknown',
    overallConfidence,
    normalizationVersion: QUOTE_EXTRACTION_NORMALIZATION_VERSION,
  };
}
