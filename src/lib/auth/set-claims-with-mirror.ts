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
 *
 * 🔴 ADR-867 Β9(β) Ε1: because it is the ONE path, it is also where the claim-is-a-projection
 * rule lives — a `companyId` claim is refused unless an ACTIVE `workspace_members` seat with the
 * same role already exists (`claims-seat.ts`). Callers write the seat FIRST.
 *
 * 🔴 ADR-853 §16 (Ε-Α): the mirror is ALSO the projection of the claim-owned profile fields
 * (`companyId`, `globalRole` — derived from `MATERIALISED_FIELDS`, `claims-mirror-fields.ts`).
 * Before, every caller re-wrote them by hand after this call — and invitation acceptance did
 * not, leaving `users/{uid}` stale until the next sign-in. One writer of claims ⇒ one writer of
 * their mirror. `emailVerified` is NOT here: its owner is Auth, not claims.
 *
 * 🔴 ADR-894 §10.7: the ONE path is also where `revokedSignIns` is PROJECTED from
 * `users/{uid}/security/revoked_sign_ins` — the Firestore/Storage rules read it from the token
 * (`signInIsLive()`), zero reads per request. Whatever the caller passes for that field is ignored.
 */
import 'server-only';

import { FieldValue as AdminFieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { assertClaimsHaveSeat } from '@/lib/auth/claims-seat';
import { claimMirrorOf } from '@/lib/auth/claims-mirror-fields';
import { withClaimsWriteLease } from '@/lib/auth/claims-write-lease';
import { readRevokedSignIns } from '@/lib/auth/revoked-sign-ins';
import {
  REVOKED_SIGN_INS_CLAIM,
  readRevokedSignInsClaim,
  sameRevokedSignIns,
  withRevokedSignInsClaim,
} from '@/lib/auth/revoked-sign-ins-claim';

const logger = createModuleLogger('SetClaimsWithMirror');

/** Φραγμένη σύγκλιση: τρεις γύροι αρκούν για τρεις ταυτόχρονες ανακλήσεις — ποτέ ατέρμων βρόχος. */
const MAX_PROJECTION_ROUNDS = 3;

export interface SetClaimsResult {
  claimsUpdatedAt: number;
  firestoreMirrorOk: boolean;
}

/**
 * Apply custom claims atomically with a Firestore mirror.
 *
 * - Stamps `claimsUpdatedAt` (epoch ms) inside the claims AND in the mirror doc
 * - Mirrors the claim-owned profile fields (`claimMirrorOf`) in the SAME
 *   write — absence in the claim ⇒ `null`, never "keep the old value"
 * - Auth write is authoritative; Firestore mirror failure is logged but
 *   non-fatal (Auth claims are the source of truth; the mirror is a
 *   notification channel + read-side projection, healed by the next sign-in)
 * - Caller passes the FULL claim payload (this helper does NOT merge with
 *   existing claims — that responsibility stays with the caller so audit logs
 *   keep a complete before/after view).
 */
export async function setClaimsWithMirror(
  uid: string,
  claims: Record<string, unknown>,
): Promise<SetClaimsResult> {
  // 🔴 ADR-894 §10.7: ONE claims writer at a time per person — Auth has no compare-and-set (`claims-write-lease.ts`).
  return withClaimsWriteLease(uid, () => writeClaimsUnderLease(uid, claims));
}

/** The write itself. ⛔ Only under the lease (`setClaimsWithMirror` · `syncRevokedSignInsClaim`). */
async function writeClaimsUnderLease(
  uid: string,
  claims: Record<string, unknown>,
): Promise<SetClaimsResult> {
  // 🔴 Fail-closed BEFORE the Auth write: a claim without a seat is access nobody can see.
  await assertClaimsHaveSeat(uid, claims);

  const claimsUpdatedAt = Date.now();
  await writeProjectedClaims(uid, claims, claimsUpdatedAt);

  let firestoreMirrorOk = true;
  try {
    await getAdminFirestore()
      .collection(COLLECTIONS.USERS)
      .doc(uid)
      .set(
        {
          ...claimMirrorOf(claims),
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

/** Η λίστα-πηγή ως ταξινομημένος πίνακας. Ρίχνει αν η Firestore δεν απαντά: claims χωρίς τη λίστα = ανάκληση που χάθηκε. */
async function currentRevokedSignIns(uid: string): Promise<readonly number[]> {
  return readRevokedSignInsClaim([...(await readRevokedSignIns(uid))]);
}

/**
 * 🔴 ADR-894 §10.7 — **το `revokedSignIns` είναι ΠΡΟΒΟΛΗ της λίστας, όχι είσοδος του καλούντα.** Οι καλούντες
 * χτίζουν το σύνολο από την αρχή (αλλαγή ρόλου, MFA, πρόσκληση): αν το πεδίο ζούσε σε αυτούς, κάθε τέτοια εγγραφή θα
 * **έσβηνε** τις ανακλήσεις. Άρα ξαναβγαίνει εδώ, από το έγγραφο, κάθε φορά.
 *
 * 🔑 **Σύγκλιση**: μια ανάκληση μπορεί να γραφτεί στη λίστα **ανάμεσα** στην ανάγνωση και στην εγγραφή μας. Γι' αυτό
 * ξαναδιαβάζουμε **μετά** την εγγραφή· αν άλλαξε, ξαναγράφουμε. Η λίστα γράφεται πάντα **πριν** από τον συγχρονισμό
 * της (`syncRevokedSignInsClaim`) ⇒ ο **τελευταίος** γραφέας claims τη βλέπει — καμία ανάκληση δεν χάνεται.
 */
async function writeProjectedClaims(
  uid: string,
  claims: Record<string, unknown>,
  claimsUpdatedAt: number,
): Promise<void> {
  let revoked = await currentRevokedSignIns(uid);
  for (let round = 1; ; round += 1) {
    await getAdminAuth().setCustomUserClaims(uid, { ...withRevokedSignInsClaim(claims, revoked), claimsUpdatedAt });
    const latest = await currentRevokedSignIns(uid);
    if (sameRevokedSignIns(latest, revoked)) return;
    if (round >= MAX_PROJECTION_ROUNDS) {
      logger.error('Η λίστα ανακλήσεων άλλαζε σε κάθε γύρο — το claim μένει πίσω μέχρι τον επόμενο συγχρονισμό', { uid });
      return;
    }
    revoked = latest;
  }
}

export type RevokedSignInsSyncOutcome = 'unchanged' | 'written';

/**
 * **Φέρνει το claim στη λίστα** — μετά από κάθε ανάκληση (ή άδειασμα) της λίστας. Ιδεμποτικό: ίδιο claim ⇒ καμία
 * εγγραφή (και κανένα ξύπνημα browser από το `claimsUpdatedAt`). Περνά από τον **ίδιο** γραφέα ⇒ ίδιος φύλακας θέσης,
 * ίδιος καθρέφτης, ίδια σύγκλιση.
 */
export async function syncRevokedSignInsClaim(uid: string): Promise<RevokedSignInsSyncOutcome> {
  // 🔴 Διαβάζει-και-ξαναγράφει ΟΛΑ τα claims ⇒ η ανάγνωση ΜΕΣΑ στο lease: αλλιώς μια αλλαγή ρόλου ανάμεσα θα χανόταν.
  return withClaimsWriteLease(uid, async () => {
    const current = (await getAdminAuth().getUser(uid)).customClaims ?? {};
    const revoked = await currentRevokedSignIns(uid);
    if (sameRevokedSignIns(readRevokedSignInsClaim(current[REVOKED_SIGN_INS_CLAIM]), revoked)) return 'unchanged';
    await writeClaimsUnderLease(uid, current);
    return 'written';
  });
}
