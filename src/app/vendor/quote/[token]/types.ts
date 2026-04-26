/**
 * Shared types for the public vendor portal page.
 * @module app/vendor/quote/[token]/types
 */

import type { TradeCode } from '@/subapps/procurement/types/trade';
import type { QuoteAttachment, QuoteLine, QuoteStatus } from '@/subapps/procurement/types/quote';

export interface InitialInvite {
  id: string;
  status: string;
  rfqId: string;
  vendorContactId: string;
  expiresAt: string;
  editWindowExpiresAt: string | null;
  editWindowOpen: boolean;
}

export interface InitialRfqLine {
  id: string;
  description: string;
  trade: TradeCode;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
}

export interface InitialRfq {
  id: string;
  title: string;
  description: string | null;
  lines: InitialRfqLine[];
  deadlineDate: string | null;
}

export interface InitialData {
  invite: InitialInvite;
  rfq: InitialRfq;
}

/** Mutable client-side line draft — values stay as strings until submit. */
export interface QuoteLineDraft {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  vatRate: 0 | 6 | 13 | 24;
  notes: string;
}

export interface QuoteSnapshot {
  id: string;
  lines: QuoteLine[];
  totals: { subtotal: number; vatAmount: number; total: number; vatRate: number };
  paymentTerms: string | null;
  deliveryTerms: string | null;
  warranty: string | null;
  notes: string | null;
  validUntil: string | null;
  attachments: QuoteAttachment[];
  status: QuoteStatus;
}
