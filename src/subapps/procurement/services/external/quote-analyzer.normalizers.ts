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
    firstName: field<string | null>(raw.firstName ?? null, raw.firstNameConfidence),
    lastName: field<string | null>(raw.lastName ?? null, raw.lastNameConfidence),
    role: field<string | null>(raw.role ?? null, raw.roleConfidence),
    profession: field<string | null>(raw.profession ?? null, raw.professionConfidence),
    mobile: field<string | null>(raw.mobile ?? null, raw.mobileConfidence),
    email: field<string | null>(raw.email ?? null, raw.emailConfidence),
    vatNumber: field<string | null>(raw.vatNumber ?? null, raw.vatNumberConfidence),
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
  };
}

// ============================================================================
// LINE ITEMS
// ============================================================================

function normalizeComponent(c: RawComponent, parentRowNumber: string | null, parentDescription: string): ExtractedQuoteLine {
  const compDesc = c.description ?? '';
  const merged = parentDescription && compDesc && !compDesc.includes(parentDescription)
    ? `${parentDescription} — ${compDesc}`
    : compDesc || parentDescription;
  return {
    description: { value: merged, confidence: c.descriptionConfidence ?? 0 },
    quantity: { value: c.quantity ?? 0, confidence: c.quantityConfidence ?? 0 },
    unit: { value: c.unit ?? '', confidence: c.unitConfidence ?? 0 },
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
    const parentDesc = item.description ?? '';
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
        parentRowNumber: item.rowNumber ?? null,
      });
      continue;
    }
    for (const c of components) {
      flat.push(normalizeComponent(c, item.rowNumber ?? null, parentDesc));
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
  let notesValue = raw.notes ?? null;
  if (failed) {
    notesValue = appendValidationIssuesToNotes(notesValue, validationIssues);
  } else if (softWarnings.length > 0) {
    notesValue = appendValidationIssuesToNotes(notesValue, softWarnings);
  }
  return {
    vendorName: field<string | null>(raw.vendorName ?? null, c.vendorName),
    vendorVat: field<string | null>(raw.vendorVat ?? null, c.vendorVat),
    vendorPhone: field<string | null>(raw.vendorPhone ?? null, c.vendorPhone),
    vendorEmails: field<string[]>(Array.isArray(raw.vendorEmails) ? raw.vendorEmails : [], c.vendorEmails),
    vendorAddress: field<string | null>(raw.vendorAddress ?? null, c.vendorAddress),
    vendorCity: field<string | null>(raw.vendorCity ?? null, c.vendorCity),
    vendorPostalCode: field<string | null>(raw.vendorPostalCode ?? null, c.vendorPostalCode),
    vendorCountry: field<string | null>(raw.vendorCountry ?? null, c.vendorCountry),
    quoteDate: field<string | null>(raw.quoteDate ?? null, c.quoteDate),
    validUntil: field<string | null>(raw.validUntil ?? null, c.validUntil),
    quoteReference: field<string | null>(raw.quoteReference ?? null, c.quoteReference),
    lineItems: normalizeLineItems(raw.lineItems),
    subtotal: field<number | null>(raw.subtotal ?? null, cap(c.subtotal)),
    vatAmount: field<number | null>(raw.vatAmount ?? null, cap(c.vatAmount)),
    totalAmount: field<number | null>(raw.totalAmount ?? null, cap(c.totalAmount)),
    paymentTerms: field<string | null>(raw.paymentTerms ?? null, c.paymentTerms),
    deliveryTerms: field<string | null>(raw.deliveryTerms ?? null, c.deliveryTerms),
    warranty: field<string | null>(raw.warranty ?? null, c.warranty),
    notes: field<string | null>(notesValue, c.notes),
    tradeHint: field<string | null>(raw.tradeHint ?? null, c.tradeHint),
    pricingType: field<'unit_prices' | 'lump_sum' | 'mixed' | null>(
      (raw.pricingType as 'unit_prices' | 'lump_sum' | 'mixed' | null) ?? null,
      raw.pricingType != null ? 90 : 0,
    ),
    vatIncluded: field<boolean | null>(raw.vatIncluded ?? null, raw.vatIncludedConfidence ?? 0),
    laborIncluded: field<boolean | null>(raw.laborIncluded ?? null, raw.laborIncludedConfidence ?? 0),
    vendorBankAccounts: (raw.vendorBankAccounts ?? []).map((b) => ({
      bankName: b.bankName,
      bic: b.bic ?? null,
      iban: b.iban,
      currency: b.currency ?? null,
      accountHolder: b.accountHolder ?? null,
    })),
    signatory: normalizeSignatory(raw.signatory),
    detectedLanguage: raw.detectedLanguage ?? 'unknown',
    overallConfidence,
  };
}
