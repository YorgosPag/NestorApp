import type { Timestamp } from 'firebase/firestore';
import type { TradeCode } from './trade';
import { roundMajor } from '@/lib/money/money';

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
  /**
   * ADR-327 §8.5 — **the RFQ line this line answers**. Bid leveling joins on THIS, never on description.
   * - in `Quote.lines`: `string` = the base answer to that RFQ line (at most ONE per RFQ line);
   *   `null`/absent = an item the vendor ADDED (BuildingConnected «Additional Items»), or a pre-§8.5 quote
   *   (the leveling engine then *infers* a binding and says so — `LevelingCell.binding = 'inferred'`).
   * - in `Quote.alternates`: the RFQ line the alternate would REPLACE — always set.
   */
  rfqLineId?: string | null;
}

// ============================================================================
// RFQ LINE ANSWERS WITHOUT A PRICE — ADR-327 §8.5 (Procore Include/Exclude)
// ============================================================================

/**
 * `included` = the vendor covers the RFQ line inside another price (no separate amount).
 * `excluded` = the vendor does NOT bid it — a scope gap the leveling engine plugs, visibly.
 */
export const RFQ_SCOPE_RESPONSES = ['included', 'excluded'] as const;
export type RfqScopeResponseKind = (typeof RFQ_SCOPE_RESPONSES)[number];

export interface RfqScopeResponse {
  rfqLineId: string;
  /** Η περιγραφή της γραμμής RFQ τη στιγμή της απάντησης — επιβάλλεται από τον server (`applyRfqLineAuthority`), ώστε η προσφορά να είναι αυτοτελές έγγραφο. */
  description: string;
  response: RfqScopeResponseKind;
  /** The vendor's reason / qualification («εκτός αντικειμένου», «περιλαμβάνεται στη γρ. 3»). */
  note: string | null;
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

/**
 * ADR-336 — extracted signatory / sales-rep block.
 * Per-field FieldWithConfidence wrapper so the review UI can color each cell
 * independently (green ≥85, yellow 60-84, red <60).
 */
export interface ExtractedSignatory {
  firstName: FieldWithConfidence<string | null>;
  lastName: FieldWithConfidence<string | null>;
  role: FieldWithConfidence<string | null>;
  profession: FieldWithConfidence<string | null>;
  mobile: FieldWithConfidence<string | null>;
  email: FieldWithConfidence<string | null>;
  vatNumber: FieldWithConfidence<string | null>;
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
  /**
   * ADR-336 — natural-person signatory extracted from quote footer.
   * Always present after extraction; all inner fields may be null when no
   * signatory is detected (in that case confidence values are 0).
   */
  signatory: ExtractedSignatory;
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
// VENDOR IDENTITY AS SUBMITTED — ADR-327 §8.5 Γ
// ============================================================================

/**
 * Ποιος υπέβαλε, **όπως ήταν τη στιγμή της υποβολής** — από την πρόσκληση, όχι από ερώτημα.
 * Γράφεται σε ΚΑΘΕ προσφορά πύλης (με επαφή ή χωρίς): η προσφορά είναι αυτοτελές έγγραφο, όπως ο προμηθευτής
 * στο PO. Πρόσκληση χωρίς επαφή (χειροκίνητο email) ⇒ αυτή είναι η ΜΟΝΗ ταυτότητα μέχρι ο PM να τη δέσει σε επαφή
 * (BuildingConnected «Unknown Company» → «Add to directory»). Ποτέ αυτόματη δημιουργία επαφής.
 */
export interface QuoteVendorSnapshot {
  name: string;
  email: string | null;
  inviteId: string;
}

/** ADR-327 §8.5 — μία κάλυψη κενού του PM ανά γραμμή RFQ (καθαρό ποσό, χωρίς ΦΠΑ — όπως όλο το leveling). */
export interface QuoteLevelingPlug {
  rfqLineId: string;
  amount: number;
  note: string | null;
  setBy: string;
  setAt: Timestamp;
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
  /** The BASE bid — what the buyer gets by awarding the whole quote. Feeds totals and the PO. */
  lines: QuoteLine[];
  /**
   * ADR-327 §8.5 — vendor-proposed substitutes, each bound (`rfqLineId`) to the RFQ line it would replace.
   * Kept OUT of `lines` on purpose: they are options, so they never enter `totals` or the generated PO
   * (Procore keeps Alternates in their own section for the same reason). Absent on pre-§8.5 quotes.
   */
  alternates?: QuoteLine[];
  /** ADR-327 §8.5 — RFQ lines answered WITHOUT a price (included elsewhere / excluded). */
  scopeResponses?: RfqScopeResponse[];
  /** ADR-327 §8.5 Γ — portal quotes only. Read the display name ONLY via `quoteVendorDisplayName`. */
  vendorSnapshot?: QuoteVendorSnapshot | null;
  /**
   * ADR-327 §8.5 — PM-set gap plugs (BuildingConnected «plug»): the PM's amount for an RFQ line THIS vendor excluded or
   * left unanswered. PM analysis, never vendor data — the portal never writes it. Writer: `quote-leveling-plug-service`.
   */
  levelingPlugs?: QuoteLevelingPlug[];
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
  // ADR-333 — user-editable TCO flags (override extractedData values)
  vatIncluded?: boolean | null;
  laborIncluded?: boolean | null;
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
  vatIncluded?: boolean | null;
  laborIncluded?: boolean | null;
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
 *
 * ΕΝΑΣ τύπος για server (υποβολή, `quote-service`) **και** client (φόρμες, πύλη `draftTotals`) — ό,τι βλέπει ο
 * προμηθευτής πριν την υποβολή είναι ό,τι αποθηκεύεται. Ποσά στρογγυλευμένα στο λεπτό (`roundMajor`): ως τις
 * 2026-10-28 αποθηκευόταν `vatAmount: 21.599999999999998` (ADR-327 changelog).
 */
export function computeQuoteTotals(
  lines: readonly Pick<QuoteLine, 'lineTotal' | 'vatRate'>[],
  quotedTotal: number | null = null
): Quote['totals'] {
  const subtotal = roundMajor(lines.reduce((s, l) => s + l.lineTotal, 0));
  const vatAmount = roundMajor(lines.reduce((s, l) => s + l.lineTotal * (l.vatRate / 100), 0));
  const computedTotal = roundMajor(subtotal + vatAmount);
  const dominantVatRate = lines[0]?.vatRate ?? 24;
  if (computedTotal === 0 && quotedTotal != null && quotedTotal > 0) {
    return { subtotal: quotedTotal, vatAmount: 0, total: quotedTotal, vatRate: dominantVatRate };
  }
  return { subtotal, vatAmount, total: computedTotal, vatRate: dominantVatRate };
}

export function isTransitionAllowed(from: QuoteStatus, to: QuoteStatus): boolean {
  return QUOTE_STATUS_TRANSITIONS[from].includes(to);
}
