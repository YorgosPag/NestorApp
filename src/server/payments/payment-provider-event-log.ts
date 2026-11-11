import 'server-only';

/**
 * @fileoverview Ημερολόγιο παραλαβής συμβάντων παρόχου (`payment_provider_events`) — ADR-ACC-030 §5
 * @description «Τι μας είπε ο πάροχος και τι κάναμε» — η απάντηση όταν ο λογιστής ρωτήσει γιατί μια πληρωμή
 *   καταγράφηκε (ή όχι). Ένα έγγραφο ανά **διακριτό** σώμα (ντετερμινιστικό id από το SHA-256 του ωμού σώματος):
 *   η επαναπαράδοση του ίδιου συμβάντος αυξάνει το `deliveries`, δεν γεννά δεύτερη γραμμή.
 *
 *   🔒 **Δεν** αποθηκεύεται το σώμα: περιέχει email / τηλέφωνο πληρωτή και ψηφία κάρτας. Μόνο το αποτύπωμά του, το
 *   σήμα και το αποτέλεσμα. Η ιδεμποτία της καταγραφής πληρωμής **δεν** εξαρτάται από εδώ (ντετερμινιστικά
 *   `paymentId` στον γραφέα) — το ημερολόγιο είναι ίχνος, όχι κλειδαριά.
 *
 *   Λήξη: `expireAt` (Timestamp, πολιτική TTL στο `firestore.indexes.json`) μετά από 400 ημέρες.
 */

import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { sha256HexOfText } from '@/lib/hash/sha256';
import { generateDeterministicPaymentProviderEventId } from '@/services/enterprise-id.service';

import type { PaymentProviderId } from './payment-provider';

export const PAYMENT_PROVIDER_EVENT_RETENTION_DAYS = 400;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ProviderEventReceipt {
  readonly provider: PaymentProviderId;
  readonly rawBody: string;
  /** Το είδος του σήματος (`checkout-reference` · `payment-reference` · `authorized-source` · `ignored` · `refused`). */
  readonly signal: string;
  /** Τι έγινε (`recorded` · `unchanged` · `open` · `closed` · `unknown` · `failed` · …). */
  readonly outcome: string;
  readonly receivedAtMs: number;
}

export async function recordProviderEventReceipt(db: Firestore, receipt: ProviderEventReceipt): Promise<void> {
  const bodySha256 = await sha256HexOfText(receipt.rawBody);
  const id = generateDeterministicPaymentProviderEventId(`${receipt.provider}:${bodySha256}`);
  await db.collection(COLLECTIONS.PAYMENT_PROVIDER_EVENTS).doc(id).set({
    provider: receipt.provider,
    bodySha256,
    signal: receipt.signal,
    outcome: receipt.outcome,
    lastReceivedAt: new Date(receipt.receivedAtMs).toISOString(),
    deliveries: FieldValue.increment(1),
    expireAt: Timestamp.fromMillis(receipt.receivedAtMs + PAYMENT_PROVIDER_EVENT_RETENTION_DAYS * DAY_MS),
  }, { merge: true });
}
