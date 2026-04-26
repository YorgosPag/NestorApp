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
  | 'archived';

export const QUOTE_STATUSES = [
  'draft', 'sent_to_vendor', 'submitted', 'under_review',
  'accepted', 'rejected', 'expired', 'archived',
] as const satisfies readonly QuoteStatus[];

export const QUOTE_STATUS_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft:          ['sent_to_vendor', 'under_review', 'rejected', 'archived'],
  sent_to_vendor: ['submitted', 'expired', 'archived'],
  submitted:      ['under_review', 'rejected', 'archived'],
  under_review:   ['accepted', 'rejected', 'archived'],
  accepted:       ['archived'],
  rejected:       ['archived'],
  expired:        ['archived'],
  archived:       [],
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
  vendorEmail: FieldWithConfidence<string | null>;
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
  detectedLanguage: string;
  overallConfidence: number;
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
  validUntil?: string | null;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  warranty?: string | null;
  notes?: string | null;
  status?: QuoteStatus;
  overrideReason?: string;
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

export function computeQuoteTotals(lines: QuoteLine[]): Quote['totals'] {
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const vatAmount = lines.reduce((s, l) => s + l.lineTotal * (l.vatRate / 100), 0);
  const dominantVatRate = lines[0]?.vatRate ?? 24;
  return { subtotal, vatAmount, total: subtotal + vatAmount, vatRate: dominantVatRate };
}

export function isTransitionAllowed(from: QuoteStatus, to: QuoteStatus): boolean {
  return QUOTE_STATUS_TRANSITIONS[from].includes(to);
}
