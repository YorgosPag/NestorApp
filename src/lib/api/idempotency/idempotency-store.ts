/**
 * @module lib/api/idempotency/idempotency-store
 * @description **Η μνήμη του συνόρου ιδεμποτίας** — κλείδωμα, αποθηκευμένη απάντηση, απελευθέρωση
 * (ADR-853 Ε3 Φάση 2). Ο **μόνος** γραφέας της `idempotency_records`.
 *
 * 🔑 Το κλείδωμα είναι η ίδια η **ύπαρξη** του εγγράφου, μέσα σε συναλλαγή: δύο ταυτόχρονα αιτήματα με το ίδιο
 * κλειδί διαβάζουν «απόν» — η Firestore επαναλαμβάνει τη μία συναλλαγή, που τότε βλέπει «σε εξέλιξη».
 * Πρότυπο Brandur (`locked_at`) · Stripe · IETF draft-07.
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';

import { IDEMPOTENCY_LEASE_MS, IDEMPOTENCY_TTL_MS } from './idempotency-contract';

/** Ποιος ζήτησε τι — ό,τι κρίνει αν μια επανάληψη είναι **η ίδια** πράξη. */
export interface IdempotencyClaim {
  readonly principal: string;
  readonly method: string;
  readonly path: string;
  /** sha256 των μεθόδου, διαδρομής, query και σώματος. */
  readonly fingerprint: string;
}

/** Η απάντηση όπως αποθηκεύτηκε — `body` ως κείμενο JSON. */
export interface StoredIdempotentResponse {
  readonly status: number;
  readonly body: string;
}

export type IdempotencyAcquisition =
  | { readonly kind: 'acquired' }
  | { readonly kind: 'replay'; readonly response: StoredIdempotentResponse }
  | { readonly kind: 'in-flight' }
  | { readonly kind: 'reused' }
  | { readonly kind: 'unknown' }
  | { readonly kind: 'unreplayable' };

interface IdempotencyRecord extends IdempotencyClaim {
  readonly state: 'in-flight' | 'completed';
  readonly lockedAtMs: number;
  readonly completedAtMs: number | null;
  /** `null` σε ολοκληρωμένη εγγραφή ⇒ έγινε, αλλά η απάντηση **δεν** αναπαράγεται. */
  readonly response: StoredIdempotentResponse | null;
  /**
   * Πεδίο της πολιτικής TTL (`firestore.indexes.json`) — **μόνο** για τη διαγραφή. ⚠️ Η λήξη **δεν** κρίνεται από
   * εδώ (Timestamp στην παραγωγή, άλλος τύπος σε κάθε αντίγραφο): κρίνεται από το `lockedAtMs` — ένας αριθμός.
   */
  readonly expiresAt: Date;
}

const recordRef = (db: Firestore, recordId: string) =>
  db.collection(COLLECTIONS.IDEMPOTENCY_RECORDS).doc(recordId);

/** Ό,τι σημαίνει μια **ζωντανή** εγγραφή για ένα νέο αίτημα με το ίδιο κλειδί. */
function judgeExisting(record: IdempotencyRecord, claim: IdempotencyClaim, nowMs: number): IdempotencyAcquisition {
  if (record.fingerprint !== claim.fingerprint) return { kind: 'reused' };
  if (record.state === 'completed') {
    return record.response === null ? { kind: 'unreplayable' } : { kind: 'replay', response: record.response };
  }
  // 🏆 Κλείδωμα πέρα από το lease: η διεργασία που το κράτησε χάθηκε. Brandur το ξαναδίνει· εμείς **όχι** —
  // μπορεί να είχε ήδη γράψει. Η έκβαση λέγεται άγνωστη και την κρίνει άνθρωπος.
  return nowMs - record.lockedAtMs < IDEMPOTENCY_LEASE_MS ? { kind: 'in-flight' } : { kind: 'unknown' };
}

/** Κλειδώνει την πράξη — ή λέει γιατί **δεν** πρέπει να εκτελεστεί. */
export async function acquireIdempotencyRecord(
  db: Firestore,
  recordId: string,
  claim: IdempotencyClaim,
  nowMs: number,
): Promise<IdempotencyAcquisition> {
  const ref = recordRef(db, recordId);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const existing = snapshot.exists ? (snapshot.data() as IdempotencyRecord) : undefined;
    // Η TTL της Firestore σβήνει **με καθυστέρηση** (έως 24 ώρες): ληγμένη εγγραφή = ανύπαρκτη.
    if (existing !== undefined && nowMs - existing.lockedAtMs < IDEMPOTENCY_TTL_MS) return judgeExisting(existing, claim, nowMs);
    const lock: IdempotencyRecord = {
      principal: claim.principal,
      method: claim.method,
      path: claim.path,
      fingerprint: claim.fingerprint,
      state: 'in-flight',
      lockedAtMs: nowMs,
      completedAtMs: null,
      response: null,
      expiresAt: new Date(nowMs + IDEMPOTENCY_TTL_MS),
    };
    transaction.set(ref, lock);
    return { kind: 'acquired' };
  });
}

/** Η πράξη έγινε — `response: null` ⇒ έγινε, αλλά η απάντηση δεν αναπαράγεται. */
export async function completeIdempotencyRecord(
  db: Firestore,
  recordId: string,
  response: StoredIdempotentResponse | null,
  nowMs: number,
): Promise<void> {
  await recordRef(db, recordId).update({ state: 'completed', completedAtMs: nowMs, response });
}

/** Ο handler δήλωσε «τίποτα δεν άλλαξε, ξαναδοκίμασε» (επέστρεψε `503`) ⇒ το κλειδί ξαναγίνεται ελεύθερο. */
export async function releaseIdempotencyRecord(db: Firestore, recordId: string): Promise<void> {
  await recordRef(db, recordId).delete();
}
