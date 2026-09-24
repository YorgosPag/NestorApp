/**
 * Shared types for the public vendor portal page.
 * @module app/(auth)/vendor/quote/types
 */

import type { TradeCode } from '@/subapps/procurement/types/trade';
import type { QuoteAttachment, QuoteLine, QuoteStatus } from '@/subapps/procurement/types/quote';
import type { VendorInvitePermits } from '@/subapps/procurement/services/vendor-invite-resolver';

export interface InitialInvite {
  id: string;
  status: string;
  rfqId: string;
  vendorContactId: string;
  expiresAt: string;
  editWindowExpiresAt: string | null;
  /** Από τον server (`vendorInvitePermits`) — ο client ΔΕΝ κρίνει μόνος του τι επιτρέπεται. */
  permits: VendorInvitePermits;
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

/** Ό,τι επιστρέφει το `GET /api/vendor/quote` — η πύλη φορτώνει **από τον client** (το token ζει στο fragment). */
export interface VendorPortalView extends InitialData {
  quote: QuoteSnapshot | null;
}

/**
 * Η αποτυχία πράξης που δείχνει η φόρμα — **κλειστό σύνολο**, ΠΟΤΕ ελεύθερο κλειδί i18n (ADR-877 §6).
 * Ήταν `string` και αποδιδόταν με `` t(`vendor-portal:${errorKey}`) ``: δυναμική `t()` που το route
 * slice δεν μπορεί να λύσει ⇒ η πύλη δεν είχε slice ⇒ ωμό κλειδί στο SSR, στη σελίδα που ανοίγει
 * **από email** χωρίς λογαριασμό. Κάθε μέλος αντιστοιχεί σε **στατική** `t()` στη φόρμα (`Record`).
 */
export type VendorPortalActionError = 'submitFailed';
