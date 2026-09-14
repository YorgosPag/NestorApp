/**
 * @fileoverview **ΤΟ ΗΜΕΡΟΛΟΓΙΟ ΣΥΜΒΑΝΤΩΝ ΠΑΡΑΔΟΣΗΣ** — ο ΕΝΑΣ γραφέας, για όλη την πλατφόρμα (ADR-841 §7 Α21.20).
 * @related lib/communications/email-delivery/recipient-standing.ts (η αναδίπλωση) ·
 *   app/api/communications/webhooks/mailgun/events/route.ts (ο καλών) · types/email-delivery.ts
 * @module server/comms/email-delivery/email-delivery-ledger
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΜΙΑ ΣΥΝΑΛΛΑΓΗ: ΣΥΜΒΑΝ + ΚΑΤΑΣΤΑΣΗ — ΚΑΙ ΤΟ ΚΛΕΙΔΙ ΕΙΝΑΙ Η ΙΔΕΜΠΟΤΕΝΕΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο πάροχος ξαναστέλνει το ίδιο συμβάν για ώρες (Mailgun: ~8 προσπάθειες σε 8ω). Το έγγραφο του
 * συμβάντος έχει **ντετερμινιστικό** κλειδί· αν υπάρχει ήδη, η συναλλαγή **δεν γράφει τίποτα** και
 * επιστρέφει `duplicate`. Δύο ταυτόχρονες παραδόσεις του ίδιου συμβάντος διαβάζουν το ίδιο έγγραφο ⇒
 * η δεύτερη ξαναεκτελείται και βλέπει την πρώτη.
 *
 * 🔴 **ΚΑΤΑΣΤΑΣΗ ΚΑΙ ΣΥΜΒΑΝ ΜΑΖΙ Ή ΚΑΘΟΛΟΥ**: κατάσταση χωρίς συμβάν = «νεκρό» χωρίς απόδειξη· συμβάν
 * χωρίς κατάσταση = απόδειξη που κανείς δεν διαβάζει.
 *
 * ⚠️ **Οι καταναλωτές ΔΕΝ τρέχουν εδώ μέσα**: μια παρενέργεια σε συναλλαγή φεύγει όσες φορές
 * ξαναεκτελεστεί. Ο καλών παίρνει `becameAbsent` και αποφασίζει **μετά** το commit.
 *
 * ⚠️ **SERVER-ONLY** — Admin SDK.
 */

import 'server-only';

import { createHash } from 'crypto';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { normaliseChannelEmail } from '@/lib/contact/channel-email';
import { becameAbsent, emptyStanding, foldStanding } from '@/lib/communications/email-delivery/recipient-standing';
import { emailDeliveryEventKey, recipientStandingKey } from '@/services/enterprise-id-composite-keys';
import type { EmailDeliveryEvent, RecipientStanding } from '@/types/email-delivery';

/** Πόσο κρατιέται ένα συμβάν (πολιτική TTL στο πεδίο `expireAt`). Η **κατάσταση** δεν λήγει. */
export const EMAIL_DELIVERY_EVENT_RETENTION_DAYS = 400;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface EmailDeliveryRecord {
  readonly outcome: 'recorded' | 'duplicate';
  readonly standing: RecipientStanding;
  /** Το συμβάν **μόλις** απέδειξε ότι το γραμματοκιβώτιο δεν υπάρχει — ξυπνά τους καταναλωτές. */
  readonly becameAbsent: boolean;
}

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

/** Το κλειδί της κατάστασης — **ένα** σημείο, για γραφέα και αναγνώστες. */
function standingKeyOf(email: string): string {
  return recipientStandingKey(sha256(normaliseChannelEmail(email)));
}

/** Αποθηκευμένη κατάσταση → τύπος. Ό,τι δεν διαβάζεται ⇒ κενή κατάσταση (ποτέ «νεκρό» από σκουπίδια). */
function readStanding(email: string, data: unknown): RecipientStanding {
  const raw = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>;
  const iso = (value: unknown): string | null => (typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null);
  const mailboxAbsentAt = iso(raw.mailboxAbsentAt);
  return {
    email,
    mailboxAbsentAt,
    evidenceEventId: mailboxAbsentAt !== null && typeof raw.evidenceEventId === 'string' ? raw.evidenceEventId : null,
    lastDeliveredAt: iso(raw.lastDeliveredAt),
    lastComplainedAt: iso(raw.lastComplainedAt),
    lastEventAt: iso(raw.lastEventAt),
  };
}

function expireAtOf(occurredAt: string): string {
  return new Date(Date.parse(occurredAt) + EMAIL_DELIVERY_EVENT_RETENTION_DAYS * DAY_MS).toISOString();
}

/**
 * **Κατέγραψε ένα συμβάν.** Ιδεμποτενές: το ίδιο συμβάν δεύτερη φορά ⇒ `duplicate`, καμία εγγραφή.
 * Πετά σε βλάβη βάσης — ο καλών απαντά 5xx ώστε ο πάροχος να ξαναστείλει.
 */
export async function recordEmailDeliveryEvent(
  adminDb: AdminFirestore,
  event: EmailDeliveryEvent,
  receivedAt: string,
): Promise<EmailDeliveryRecord> {
  const eventRef = adminDb
    .collection(COLLECTIONS.EMAIL_DELIVERY_EVENTS)
    .doc(emailDeliveryEventKey(event.provider, sha256(event.providerEventId)));
  const standingRef = adminDb.collection(COLLECTIONS.EMAIL_RECIPIENT_STANDING).doc(standingKeyOf(event.recipient));

  return adminDb.runTransaction(async (tx): Promise<EmailDeliveryRecord> => {
    const existing = await tx.get(eventRef);
    const stored = await tx.get(standingRef);
    const previous = stored.exists ? readStanding(event.recipient, stored.data()) : emptyStanding(event.recipient);
    if (existing.exists) return { outcome: 'duplicate', standing: previous, becameAbsent: false };

    const next = foldStanding(previous, event);
    tx.set(eventRef, { ...event, receivedAt, expireAt: expireAtOf(event.occurredAt) });
    tx.set(standingRef, { ...next, updatedAt: receivedAt });
    return { outcome: 'recorded', standing: next, becameAbsent: becameAbsent(previous, next) };
  });
}

/** **Τι ξέρουμε για αυτές τις διευθύνσεις;** — μία ανάγνωση ανά διεύθυνση, σε ένα ταξίδι. */
export async function readRecipientStandings(
  adminDb: AdminFirestore,
  emails: readonly string[],
): Promise<ReadonlyMap<string, RecipientStanding>> {
  const unique = [...new Set(emails.map(normaliseChannelEmail).filter((email) => email.includes('@')))];
  if (unique.length === 0) return new Map();
  const collection = adminDb.collection(COLLECTIONS.EMAIL_RECIPIENT_STANDING);
  const snapshots = await adminDb.getAll(...unique.map((email) => collection.doc(standingKeyOf(email))));
  return new Map(
    unique.map((email, index) => [email, snapshots[index].exists ? readStanding(email, snapshots[index].data()) : emptyStanding(email)]),
  );
}
