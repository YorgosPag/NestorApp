/**
 * SSOT for setting Firebase Auth custom claims with Firestore mirror (ADR-360).
 *
 * Why: setting `setCustomUserClaims` alone does not notify connected clients.
 * The client's cached ID token (≤1h) keeps the old claims until logout/login
 * or an explicit `getIdToken(true)`. By mirroring `claimsUpdatedAt` to
 * `users/{uid}` we give the client a Firestore signal it can listen to and
 * trigger a token force-refresh (see `use-claims-refresh.ts`).
 *
 * ALL server code paths that mutate custom claims MUST go through this helper.
 */
import 'server-only';

import { FieldValue as AdminFieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('SetClaimsWithMirror');

export interface SetClaimsResult {
  claimsUpdatedAt: number;
  firestoreMirrorOk: boolean;
}

/**
 * Apply custom claims atomically with a Firestore mirror.
 *
 * - Stamps `claimsUpdatedAt` (epoch ms) inside the claims AND in the mirror doc
 * - Auth write is authoritative; Firestore mirror failure is logged but
 *   non-fatal (Auth claims are the source of truth; the mirror is only a
 *   notification channel)
 * - Caller passes the FULL claim payload (this helper does NOT merge with
 *   existing claims — that responsibility stays with the caller so audit logs
 *   keep a complete before/after view).
 */
export async function setClaimsWithMirror(
  uid: string,
  claims: Record<string, unknown>,
): Promise<SetClaimsResult> {
  const claimsUpdatedAt = Date.now();
  const stampedClaims = { ...claims, claimsUpdatedAt };

  await getAdminAuth().setCustomUserClaims(uid, stampedClaims);

  let firestoreMirrorOk = true;
  try {
    await getAdminFirestore()
      .collection(COLLECTIONS.USERS)
      .doc(uid)
      .set(
        {
          claimsUpdatedAt,
          updatedAt: AdminFieldValue.serverTimestamp(),
        },
        { merge: true },
      );
  } catch (error) {
    firestoreMirrorOk = false;
    logger.warn('Failed to mirror claimsUpdatedAt to Firestore (non-blocking)', {
      uid,
      error: getErrorMessage(error),
    });
  }

  return { claimsUpdatedAt, firestoreMirrorOk };
}
