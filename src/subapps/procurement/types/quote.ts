import type { Timestamp } from 'firebase/firestore';
import type { TradeCode } from './trade';

// ============================================================================
// QUOTE STATUS FSM — ADR-327 §5.1
// ============================================================================

export type QuoteStatus =
  | 'draft'
  | 'sent_to_vendor'
  | 'submitted'
  | 'under_review'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'archived'
  | 'superseded'; // §5.AA — replaced by a newer revision

export const QUOTE_STATUSES = [
  'draft', 'sent_to_vendor', 'submitted', 'under_review',
  'accepted', 'rejected', 'expired', 'archived', 'superseded',
] as const satisfies readonly QuoteStatus[];

export const QUOTE_STATUS_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft:          ['sent_to_vendor', 'under_review', 'rejected', 'archived'],
  sent_to_vendor: ['submitted', 'expired', 'archived'],
  submitted:      ['under_review', 'rejected', 'archived'],
  under_review:   ['accepted', 'rejected', 'archived'],
  accepted:       ['archived'],
  rejected:       ['archived'],
  expired:        ['archived'],
  archived:       ['draft'],
  superseded:     ['archived'],
} as const;

export const QUOTE_STATUS_META: Record<QuoteStatus, {
  labelEl: string; labelEn: string;
  color: 'gray' | 'blue' | 'yellow' | 'orange' | 'green' | 'red' | 'purple';
}> = {
  draft:          { labelEl: 'Πρόχειρο',        labelEn: 'Draft',          color: 'gray' },
  sent_to_vendor: { labelEl: 'Απεστάλη',        labelEn: 'Sent to Vendor', color: 'blue' },
  submitted:      { labelEl: 'Υποβλήθηκε',      labelEn: 'Submitted',      color: 'yellow' },
  under_review:   { labelEl: 'Υπό Εξέταση',     labelEn: 'Under Review',   color: 'orange' },
  accepted:       { labelEl: 'Εγκρίθηκε',       labelEn: 'Accepted',       color: 'green' },
  rejected:       { labelEl: 'Απορρίφθηκε',     labelEn: 'Rejected',       color: 'red' },
  expired:        { labelEl: 'Έληξε',            labelEn: 'Expired',        color: 'gray' },
  archived:       { labelEl: 'Αρχειοθετήθηκε',  labelEn: 'Archived',       color: 'purple' },
  superseded:     { labelEl: 'Αντικαταστάθηκε', labelEn: 'Superseded',     color: 'gray' },
} as const;

// ============================================================================
// QUOTE SOURCE
// ============================================================================

export type QuoteSource = 'manual' | 'scan' | 'portal' | 'email_inbox';

export type AcceptanceMode = 'manual' | 'auto';

// ============================================================================
// QUOTE LINE
// ============================================================================

export interface QuoteLine {
  id: string;
  description: string;
  categoryCode: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  vatRate: 0 | 6 | 13 | 24;
  lineTotal: number;
  notes: string | null;
}

// ============================================================================
// AI EXTRACTED DATA
// ============================================================================

export interface FieldWithConfidence<T> {
  value: T;
  confidence: number;
}

export interface ExtractedBankAccount {
  bankName: string;
  bic: string | null;
  iban: string;
  currency: string | null;
  accountHolder: string | null;
}

export interface ExtractedQuoteLine {
  description: FieldWithConfidence<string>;
  quantity: FieldWithConfidence<number>;
  unit: FieldWithConfidence<string>;
  unitPrice: FieldWithConfidence<number>;
  discountPercent: FieldWithConfidence<number | null>;
  vatRate: FieldWithConfidence<number>;
  lineTotal: FieldWithConfidence<number>;
  parentRowNumber: string | null;
}

export interface ExtractedQuoteData {
  vendorName: FieldWithConfidence<string | null>;
  vendorVat: FieldWithConfidence<string | null>;
  vendorPhone: FieldWithConfidence<string | null>;
  vendorEmails: FieldWithConfidence<string[]>;
  vendorAddress: FieldWithConfidence<string | null>;
  vendorCity: FieldWithConfidence<string | null>;
  vendorPostalCode: FieldWithConfidence<string | null>;
  vendorCountry: FieldWithConfidence<string | null>;
  quoteDate: FieldWithConfidence<string | null>;
  validUntil: FieldWithConfidence<string | null>;
  quoteReference: FieldWithConfidence<string | null>;
  lineItems: ExtractedQuoteLine[];
  subtotal: FieldWithConfidence<number | null>;
  vatAmount: FieldWithConfidence<number | null>;
  totalAmount: FieldWithConfidence<number | null>;
  paymentTerms: FieldWithConfidence<string | null>;
  deliveryTerms: FieldWithConfidence<string | null>;
  warranty: FieldWithConfidence<string | null>;
  notes: FieldWithConfidence<string | null>;
  tradeHint: FieldWithConfidence<string | null>;
  pricingType: FieldWithConfidence<'unit_prices' | 'lump_sum' | 'mixed' | null>;
  vatIncluded: FieldWithConfidence<boolean | null>;
  laborIncluded: FieldWithConfidence<boolean | null>;
  vendorBankAccounts: ExtractedBankAccount[];
  detectedLanguage: string;
  overallConfidence: number;
  vendorLogoUrl?: string | null;
}

// ============================================================================
// AUDIT TRAIL
// ============================================================================

export interface QuoteAuditEntry {
  timestamp: Timestamp;
  userId: string;
  action: string;
  previousValue: string | null;
  newValue: string | null;
  source: QuoteSource | 'system';
  ip: string | null;
}

// ============================================================================
// QUOTE ATTACHMENTS
// ============================================================================

export interface QuoteAttachment {
  id: string;
  fileUrl: string;
  storagePath: string;
  fileType: 'image' | 'pdf';
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Timestamp;
  uploadedBy: string | null;
}

// ============================================================================
// QUOTE ENTITY
// ============================================================================

export interface Quote {
  id: string;
  displayNumber: string;
  rfqId: string | null;
  projectId: string;
  buildingId: string | null;
  companyId: string;
  vendorContactId: string;
  trade: TradeCode;
  source: QuoteSource;
  status: QuoteStatus;
  lines: QuoteLine[];
  totals: {
    subtotal: number;
    vatAmount: number;
    total: number;
    vatRate: 0 | 6 | 13 | 24;
  };
  /** Declared lump-sum total from the scanned document. Used as fallback when line prices are 0. */
  quotedTotal: number | null;
  validUntil: Timestamp | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  warranty: string | null;
  notes: string | null;
  attachments: QuoteAttachment[];
  extractedData: ExtractedQuoteData | null;
  overallConfidence: number | null;
  acceptanceMode: AcceptanceMode | null;
  overrideReason: string | null;
  overrideAt: Timestamp | null;
  overriddenBy: string | null;
  vendorEditHistory: Array<{
    version: number;
    editedAt: Timestamp;
    changes: string;
  }>;
  editWindowExpiresAt: Timestamp | null;
  auditTrail: QuoteAuditEntry[];
  submittedAt: Timestamp | null;
  submitterIp: string | null;
  linkedPoId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  // §5.AA versioning fields (Phase 9)
  version?: number;
  previousVersionId?: string;
  supersededBy?: string;
  supersededAt?: Timestamp;
  _previousStatus?: QuoteStatus; // internal: status before supersede, used by revertSupersede
  // §5.V vendor notification fields (Phase 12)
  lastNotifiedAt?: Timestamp;
  lastNotifiedTemplate?: 'winner' | 'rejection';
}

// ============================================================================
// DTOs
// ============================================================================

export interface CreateQuoteDTO {
  rfqId?: string | null;
  projectId: string;
  buildingId?: string | null;
  vendorContactId: string;
  trade: TradeCode;
  source: QuoteSource;
  lines?: QuoteLine[];
  validUntil?: string | null;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  warranty?: string | null;
  notes?: string | null;
}

export interface UpdateQuoteDTO {
  lines?: QuoteLine[];
  quotedTotal?: number | null;
  validUntil?: string | null;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  warranty?: string | null;
  notes?: string | null;
  status?: QuoteStatus;
  overrideReason?: string;
  vendorContactId?: string;
}

export interface QuoteFilters {
  projectId?: string;
  rfqId?: string;
  vendorContactId?: string;
  trade?: TradeCode;
  status?: QuoteStatus;
  source?: QuoteSource;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Compute quote totals from line items.
 * `quotedTotal` is the fallback for lump-sum quotes where line prices are 0
 * (e.g. scanned invoices with a single grand total, no per-line prices).
 * When line prices sum to 0 and quotedTotal is set, the declared total is used directly.
 */
export function computeQuoteTotals(
  lines: QuoteLine[],
  quotedTotal: number | null = null
): Quote['totals'] {
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const vatAmount = lines.reduce((s, l) => s + l.lineTotal * (l.vatRate / 100), 0);
  const computedTotal = subtotal + vatAmount;
  const dominantVatRate = lines[0]?.vatRate ?? 24;
  if (computedTotal === 0 && quotedTotal != null && quotedTotal > 0) {
    return { subtotal: quotedTotal, vatAmount: 0, total: quotedTotal, vatRate: dominantVatRate };
  }
  return { subtotal, vatAmount, total: computedTotal, vatRate: dominantVatRate };
}

export function isTransitionAllowed(from: QuoteStatus, to: QuoteStatus): boolean {
  return QUOTE_STATUS_TRANSITIONS[from].includes(to);
}
