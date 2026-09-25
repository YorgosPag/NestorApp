import 'server-only';

/**
 * =============================================================================
 * SHARE PASSWORD ATTEMPT — κρίση κωδικού με κλείδωμα ΑΝΑ ΣΥΝΔΕΣΜΟ (ADR-884 Φ0.12)
 * =============================================================================
 *
 * 🔑 **Δύο φράχτες, γιατί προστατεύουν από διαφορετικό επιτιθέμενο**:
 *   - το όριο ρυθμού **ανά IP** (`withSensitiveRateLimit`) σταματά τον έναν υπολογιστή·
 *   - το κλείδωμα **ανά σύνδεσμο** (εδώ) σταματά το **κατανεμημένο** μάντεμα — χίλιες
 *     IP με δέκα προσπάθειες η καθεμία είναι δέκα χιλιάδες μαντεψιές στον **ίδιο** κωδικό.
 *
 * 🏆 Ο κοινός κωδικός του Figma/Matterport δεν έχει κλείδωμα ανά σύνδεσμο. Εδώ: **10**
 * λάθη μέσα σε **15′** ⇒ ο σύνδεσμος κλειδώνει για **15′**. Η σωστή είσοδος μηδενίζει.
 *
 * ⚠️ Το κλείδωμα **δεν** ανακαλεί τον σύνδεσμο: ο νόμιμος παραλήπτης ξαναδοκιμάζει σε
 * 15′. Μόνιμη ανάκληση θα έδινε σε κάθε επιτιθέμενο ένα κουμπί «σβήσε τον σύνδεσμο».
 *
 * @module server/sharing/share-password-attempt
 */

import type { Firestore } from 'firebase-admin/firestore';

import { createModuleLogger } from '@/lib/telemetry';
import { hashSharePassword, verifySharePassword } from './share-password';
import { collectionOfShareSource, type StoredShare } from './share-token-lookup';

const logger = createModuleLogger('SharePasswordAttempt');

export const SHARE_PASSWORD_MAX_FAILURES = 10;
export const SHARE_PASSWORD_WINDOW_MS = 15 * 60 * 1000;
export const SHARE_PASSWORD_LOCK_MS = 15 * 60 * 1000;

export type SharePasswordAttemptOutcome = 'ok' | 'wrong-password' | 'locked';

/** Είναι ο σύνδεσμος κλειδωμένος **τώρα**; — καθαρό, πριν ξοδέψουμε scrypt. */
export function isSharePasswordLocked(share: StoredShare, nowMs: number): boolean {
  if (share.passwordLockedUntil === null) return false;
  const until = Date.parse(share.passwordLockedUntil);
  return Number.isFinite(until) && until > nowMs;
}

interface FailureUpdate {
  readonly passwordFailures: number;
  readonly passwordFailureWindowStart: string;
  readonly passwordLockedUntil: string | null;
}

/** Η επόμενη κατάσταση μετρητή μετά από **ένα** λάθος — καθαρή. */
export function nextFailureState(
  failures: number,
  windowStart: string | null,
  nowMs: number,
): FailureUpdate {
  const startMs = windowStart === null ? NaN : Date.parse(windowStart);
  const inWindow = Number.isFinite(startMs) && nowMs - startMs < SHARE_PASSWORD_WINDOW_MS;
  const count = inWindow ? failures + 1 : 1;
  const start = inWindow ? (windowStart as string) : new Date(nowMs).toISOString();
  const locked = count >= SHARE_PASSWORD_MAX_FAILURES;
  return {
    passwordFailures: locked ? 0 : count,
    passwordFailureWindowStart: start,
    passwordLockedUntil: locked ? new Date(nowMs + SHARE_PASSWORD_LOCK_MS).toISOString() : null,
  };
}

async function recordFailure(adminDb: Firestore, share: StoredShare): Promise<SharePasswordAttemptOutcome> {
  const ref = adminDb.collection(collectionOfShareSource(share.source)).doc(share.id);
  return adminDb.runTransaction(async (tx) => {
    const data = (await tx.get(ref)).data() ?? {};
    const update = nextFailureState(
      typeof data.passwordFailures === 'number' ? data.passwordFailures : 0,
      typeof data.passwordFailureWindowStart === 'string' ? data.passwordFailureWindowStart : null,
      Date.now(),
    );
    tx.update(ref, { ...update });
    if (update.passwordLockedUntil !== null) {
      logger.warn('Share locked after repeated wrong passwords', { shareId: share.id });
      return 'locked';
    }
    return 'wrong-password';
  });
}

async function recordSuccess(adminDb: Firestore, share: StoredShare, rehash: string | null): Promise<void> {
  const needsReset = share.passwordFailures > 0 || share.passwordLockedUntil !== null;
  if (!needsReset && rehash === null) return;
  const ref = adminDb.collection(collectionOfShareSource(share.source)).doc(share.id);
  await ref.update({
    passwordFailures: 0,
    passwordFailureWindowStart: null,
    passwordLockedUntil: null,
    ...(rehash === null ? {} : { passwordHash: rehash }),
  });
}

/**
 * Κρίνει έναν κωδικό για μια κοινοποίηση που **απαιτεί** κωδικό.
 *
 * Σειρά: κλείδωμα (φθηνό) → scrypt (ακριβό) → εγγραφή αποτελέσματος. Στη σωστή είσοδο
 * ο παλιός hash ξαναγράφεται στη σημερινή μορφή (rehash-on-verify).
 */
export async function attemptSharePassword(
  adminDb: Firestore,
  share: StoredShare,
  password: string,
): Promise<SharePasswordAttemptOutcome> {
  if (isSharePasswordLocked(share, Date.now())) return 'locked';
  if (share.passwordHash === null) {
    logger.error('Password-protected share has no password hash', { shareId: share.id });
    return 'wrong-password';
  }

  const verdict = await verifySharePassword(password, share.passwordHash);
  if (!verdict.ok) return recordFailure(adminDb, share);

  const rehash = verdict.needsRehash ? await hashSharePassword(password) : null;
  await recordSuccess(adminDb, share, rehash);
  return 'ok';
}
