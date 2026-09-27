import 'server-only';

/**
 * @fileoverview **ΑΝΑΚΛΗΘΗΚΕ ΑΥΤΟ ΤΟ ΔΙΑΠΙΣΤΕΥΤΗΡΙΟ;** — ADR-892 §8.1 (Φ1).
 * @related lib/auth/token-credentials (ο καταναλωτής) · lib/auth/security-policy (η διάρκεια μνήμης)
 * @module lib/auth/revocation-watermark
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΥΡΗΜΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Τα ID tokens και τα cookies συνεδρίας της Firebase είναι **stateless**: το `revokeRefreshTokens`
 * μετακινεί μόνο τη σφραγίδα `tokensValidAfterTime` του λογαριασμού. Ό,τι έχει ήδη εκδοθεί μένει
 * **υπογεγραμμένο και έγκυρο** μέχρι να λήξει — 1 ώρα το token, **24 ώρες** το cookie μας. Το `withAuth`
 * επαλήθευε χωρίς `checkRevoked`, και ο κριτής μέλους δίνει `home` από το token με **0 αναγνώσεις**.
 * ⇒ Μέλος που αφαιρέθηκε από τον οικείο του χώρο έμπαινε κανονικά για μία μέρα.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΛΥΣΗ — Η ΙΔΙΑ ΣΥΓΚΡΙΣΗ ΜΕ ΤΟ `checkRevoked`, ΜΕ ΦΡΑΓΜΕΝΗ ΜΝΗΜΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `checkRevoked: true` του firebase-admin κάνει **ένα `getUser` ανά αίτημα** (η Firebase το λέει
 * ρητά «expensive … an extra network round trip»). Εδώ γίνεται η **ίδια** σύγκριση
 * (`auth_time` < `tokensValidAfterTime` · `disabled`), με τη σφραγίδα στη μνήμη για
 * `REVOCATION_CHECK_TTL_SECONDS`: ένα `getUser` ανά λογαριασμό ανά 30″, όχι ανά αίτημα.
 * Η διεργασία που **κάνει** την ανάκληση ξεχνά αμέσως ({@link forgetRevocationState}) — άρα σε μία
 * διεργασία η ανάκληση είναι **άμεση**, σε πολλές φραγμένη στα 30″.
 *
 * ⚠️ **Αποτυχία ερώτησης**: παλιά σφραγίδα αν υπάρχει (stale-if-error)· αλλιώς **άρνηση** — όπως το
 * `checkRevoked`, που ρίχνει. «Δεν μπόρεσα να ρωτήσω» δεν είναι «δεν ανακλήθηκε» (N.12).
 */

import type { DecodedIdToken } from 'firebase-admin/auth';

import { getAdminAuth } from '@/lib/firebaseAdmin';
import { SESSION_POLICY } from '@/lib/auth/security-policy';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('revocation-watermark');

const MS_PER_SECOND = 1000;
const TTL_MS = SESSION_POLICY.REVOCATION_CHECK_TTL_SECONDS * MS_PER_SECOND;

/** Η σφραγίδα ενός λογαριασμού — ό,τι χρειάζεται η σύγκριση, τίποτα άλλο. */
export interface RevocationState {
  /** Διαπιστευτήρια με σύνδεση **πριν** από αυτή τη στιγμή είναι άκυρα. `0` = ποτέ ανάκληση. */
  readonly validAfterMs: number;
  readonly disabled: boolean;
  /** Ο λογαριασμός **δεν υπάρχει** πια ⇒ κάθε διαπιστευτήριο άκυρο. */
  readonly missing: boolean;
}

interface CachedState {
  readonly state: RevocationState;
  readonly fetchedAtMs: number;
}

const cache = new Map<string, CachedState>();

/** **Η καθαρή σύγκριση** — η ίδια με το `verifyDecodedJWTNotRevokedOrDisabled` του firebase-admin. */
export function isCredentialRevoked(decoded: Pick<DecodedIdToken, 'auth_time'>, state: RevocationState): boolean {
  if (state.missing || state.disabled) return true;
  return decoded.auth_time * MS_PER_SECOND < state.validAfterMs;
}

/**
 * **Ισχύει ακόμη;** — `true` αν το διαπιστευτήριο δεν ανακλήθηκε. Ρίχνει **μόνο** όταν δεν υπάρχει
 * καμία σφραγίδα και το Auth δεν απαντά (ο καλών το μεταφράζει σε άρνηση).
 */
export async function isCredentialStillValid(decoded: DecodedIdToken, nowMs: number = Date.now()): Promise<boolean> {
  const state = await readRevocationState(decoded.uid, nowMs);
  return !isCredentialRevoked(decoded, state);
}

/** Η διεργασία που ανακάλεσε **ξεχνά αμέσως** — το επόμενο αίτημα ξαναρωτά. */
export function forgetRevocationState(uid: string): void {
  cache.delete(uid);
}

async function readRevocationState(uid: string, nowMs: number): Promise<RevocationState> {
  const cached = cache.get(uid);
  if (cached !== undefined && nowMs - cached.fetchedAtMs < TTL_MS) return cached.state;

  try {
    const state = await fetchRevocationState(uid);
    cache.set(uid, { state, fetchedAtMs: nowMs });
    return state;
  } catch (error: unknown) {
    if (cached !== undefined) {
      logger.warn('Το Auth δεν απάντησε — παλιά σφραγίδα ανάκλησης (stale-if-error)', { uid, error: getErrorMessage(error) });
      return cached.state;
    }
    throw error;
  }
}

async function fetchRevocationState(uid: string): Promise<RevocationState> {
  try {
    const user = await getAdminAuth().getUser(uid);
    const validAfter = user.tokensValidAfterTime ? Date.parse(user.tokensValidAfterTime) : 0;
    return { validAfterMs: Number.isNaN(validAfter) ? 0 : validAfter, disabled: user.disabled, missing: false };
  } catch (error: unknown) {
    if (isUserNotFound(error)) return { validAfterMs: 0, disabled: false, missing: true };
    throw error;
  }
}

function isUserNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error
    && (error as { readonly code: unknown }).code === 'auth/user-not-found';
}
