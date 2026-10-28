/**
 * Shared types for the public vendor portal page.
 * @module app/(auth)/vendor/quote/types
 */

import type { PublicRfqLine } from '@/subapps/procurement/types/rfq-line';
import type { RfqResponseLock } from '@/subapps/procurement/types/rfq';
import type {
  QuoteAttachment,
  QuoteLine,
  QuoteStatus,
  RfqScopeResponse,
  RfqScopeResponseKind,
} from '@/subapps/procurement/types/quote';
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

export interface InitialRfq {
  id: string;
  title: string;
  description: string | null;
  /** The vendor-safe projection — the SAME type the server builds (`readRfqLinesPublic`), not a hand copy. */
  lines: PublicRfqLine[];
  deadlineDate: string | null;
  /** ADR-327 §8.5 Β — ήδη επιλυμένο από τον server (`resolveResponseLock`). */
  responseLock: RfqResponseLock;
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
  vatRate: QuoteLine['vatRate'];
  notes: string;
}

/** ADR-327 §8.5 — πώς απαντά ο προμηθευτής σε μια ζητούμενη γραμμή (Procore: Amount · Include · Exclude). */
export type RfqAnswerKind = 'priced' | RfqScopeResponseKind;

/** Η απάντηση σε ΜΙΑ γραμμή RFQ. Η περιγραφή ΔΕΝ είναι εδώ: ανήκει στη γραμμή RFQ (ο server την επιβάλλει). */
export interface RfqAnswerDraft extends Omit<QuoteLineDraft, 'description'> {
  rfqLineId: string;
  answer: RfqAnswerKind;
}

/** Εναλλακτική — δεμένη στη γραμμή RFQ που θα αντικαθιστούσε· ΕΚΤΟΣ συνόλου. */
export interface AlternateDraft extends QuoteLineDraft {
  key: string;
  rfqLineId: string;
}

/** Πρόσθετη γραμμή του προμηθευτή (δεν ζητήθηκε). */
export interface AdditionalLineDraft extends QuoteLineDraft {
  key: string;
}

/** Όλη η προσφορά υπό σύνταξη. */
export interface VendorQuoteDraft {
  answers: RfqAnswerDraft[];
  alternates: AlternateDraft[];
  additional: AdditionalLineDraft[];
}

export interface QuoteSnapshot {
  id: string;
  lines: QuoteLine[];
  alternates: QuoteLine[];
  scopeResponses: RfqScopeResponse[];
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
