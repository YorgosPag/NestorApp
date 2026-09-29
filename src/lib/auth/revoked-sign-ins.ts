import 'server-only';

/**
 * @fileoverview **ΠΟΙΕΣ ΣΥΝΔΕΣΕΙΣ ΑΥΤΟΥ ΤΟΥ ΛΟΓΑΡΙΑΣΜΟΥ ΑΝΑΚΛΗΘΗΚΑΝ ΜΙΑ-ΜΙΑ;** — ADR-894 §10 Β1.
 * @related lib/auth/revocation-watermark (ο αναγνώστης στο σύνορο) · services/session/session-server.service
 *   (ο καλών που ανακαλεί) · `firestore.rules` → `users/{uid}/security` (`read, write: if false`)
 * @module lib/auth/revoked-sign-ins
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΕΝΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η Firebase ανακαλεί **ανά λογαριασμό** (`revokeRefreshTokens` ⇒ όλες οι συσκευές), ποτέ ανά συσκευή. Μέχρι
 * τη Φάση 2 η «Αποσύνδεση» μιας συσκευής άλλαζε μόνο την εγγραφή `sess_*`: το token της ζούσε — 1 ώρα το ID
 * token, 24 ώρες το cookie, **επ' αόριστον** το refresh token.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΛΥΣΗ — ΤΟ `auth_time` ΕΙΝΑΙ Η ΤΑΥΤΟΤΗΤΑ ΤΗΣ ΣΥΝΔΕΣΗΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Κάθε ID token που κόβει μια σύνδεση φέρει το **ίδιο** `auth_time` (η Firebase το τεκμηριώνει: διαφορετικό `iat`,
 * ίδιο `auth_time`), και το cookie που γεννιέται από αυτό επίσης. Άρα «αρνήσου κάθε διαπιστευτήριο με
 * `auth_time = T`» = «αποσύνδεσε **αυτή** τη σύνδεση», σε κάθε πόρτα του server (Bearer · cookie · σελίδα SSR).
 *
 * ⚠️ **Φρουρός εαυτού**: το `auth_time` του **καλούντα** δεν μπαίνει ποτέ — αλλιώς ένας browser που έχασε το
 * `localStorage` (δύο εγγραφές, ίδια σύνδεση) θα αποσυνδεόταν πατώντας «αποσύνδεση» στο δικό του φάντασμα.
 * ⚠️ **Κλάδεμα**: ό,τι καλύπτει ήδη το `tokensValidAfterTime` (ανάκληση όλων) είναι περιττό και σβήνει.
 * ⚠️ **Όριο**: πάνω από {@link MAX_REVOKED_SIGN_INS} ο καλών **κλιμακώνει** σε ανάκληση όλων — ποτέ σιωπηλή απώλεια.
 * ⛔ Χωρίς εισαγωγή του `revocation-watermark` (κύκλος, CHECK 3.80): το «ξέχνα τη σφραγίδα» το κάνει ο καλών.
 */

import { Timestamp, type DocumentData } from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

/** Το ένα έγγραφο της λίστας — σταθερό id, ένα ανά χρήστη (όχι νέα οντότητα ⇒ κανένας γεννήτορας ID). */
export const REVOKED_SIGN_INS_DOC_ID = 'revoked_sign_ins';

/** Πάνω από τόσες ανακλημένες συνδέσεις ⇒ ανάκληση όλων (`revokeRefreshTokens`) και άδειασμα. */
export const MAX_REVOKED_SIGN_INS = 100;

const MS_PER_SECOND = 1000;

export interface RevokedSignIn {
  readonly authTimeSec: number;
  readonly revokedAtMs: number;
}

export interface RevokedSignInsPolicy {
  /** Το `auth_time` αυτού που ζητά την ανάκληση — δεν ανακαλείται ποτέ από εδώ. */
  readonly callerAuthTimeSec: number | undefined;
  /** `tokensValidAfterTime` του λογαριασμού (ms)· `0` = ποτέ ανάκληση όλων. */
  readonly validAfterMs: number;
  readonly nowMs: number;
  readonly cap?: number;
}

export type RevokedSignInsPlan =
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'write'; readonly entries: readonly RevokedSignIn[] }
  | { readonly kind: 'escalate' };

function isAuthTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * **Η καθαρή απόφαση** — τι γράφεται, ή αν πρέπει να ανακληθούν όλες. Ιδεμποτική: ίδια είσοδος ⇒ `unchanged`.
 */
export function planRevokedSignIns(
  existing: readonly RevokedSignIn[],
  additions: readonly (number | undefined)[],
  policy: RevokedSignInsPolicy,
): RevokedSignInsPlan {
  const stillNeeded = (authTimeSec: number): boolean => authTimeSec * MS_PER_SECOND >= policy.validAfterMs;
  const kept = existing.filter((entry) => stillNeeded(entry.authTimeSec));
  const known = new Set(kept.map((entry) => entry.authTimeSec));

  const fresh: RevokedSignIn[] = [];
  for (const candidate of additions) {
    if (!isAuthTime(candidate) || candidate === policy.callerAuthTimeSec) continue;
    if (!stillNeeded(candidate) || known.has(candidate)) continue;
    known.add(candidate);
    fresh.push({ authTimeSec: candidate, revokedAtMs: policy.nowMs });
  }

  if (fresh.length === 0 && kept.length === existing.length) return { kind: 'unchanged' };
  const entries = [...kept, ...fresh];
  if (entries.length > (policy.cap ?? MAX_REVOKED_SIGN_INS)) return { kind: 'escalate' };
  return { kind: 'write', entries };
}

function listRef(uid: string) {
  return getAdminFirestore()
    .collection(COLLECTIONS.USERS).doc(uid)
    .collection(SUBCOLLECTIONS.USER_SECURITY).doc(REVOKED_SIGN_INS_DOC_ID);
}

/** Ανεκτική ανάγνωση: ό,τι δεν είναι έγκυρη εγγραφή αγνοείται (ποτέ δεν ρίχνει για σχήμα). */
function entriesOf(data: DocumentData | undefined): RevokedSignIn[] {
  const raw: unknown = data?.entries;
  if (!Array.isArray(raw)) return [];
  const entries: RevokedSignIn[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const { authTimeSec, revokedAt } = item as { authTimeSec?: unknown; revokedAt?: unknown };
    if (!isAuthTime(authTimeSec)) continue;
    entries.push({ authTimeSec, revokedAtMs: revokedAt instanceof Timestamp ? revokedAt.toMillis() : 0 });
  }
  return entries;
}

/** Ο αναγνώστης του συνόρου — τα `auth_time` που αρνούμαστε. Ρίχνει αν η Firestore δεν απαντά (ο καλών κρίνει). */
export async function readRevokedSignIns(uid: string): Promise<ReadonlySet<number>> {
  const snap = await listRef(uid).get();
  return new Set(entriesOf(snap.data()).map((entry) => entry.authTimeSec));
}

/**
 * Γράφει τις ανακλημένες συνδέσεις (συναλλαγή: ανάγνωση → απόφαση → εγγραφή). Επιστρέφει `'escalate'` όταν
 * ξεπεράστηκε το όριο — τότε ο καλών **οφείλει** να ανακαλέσει όλες ({@link clearRevokedSignIns} μετά).
 */
export async function recordRevokedSignIns(
  uid: string,
  additions: readonly (number | undefined)[],
  policy: Omit<RevokedSignInsPolicy, 'nowMs'>,
): Promise<RevokedSignInsPlan['kind']> {
  const ref = listRef(uid);
  const nowMs = Date.now();
  return getAdminFirestore().runTransaction(async (tx) => {
    const plan = planRevokedSignIns(entriesOf((await tx.get(ref)).data()), additions, { ...policy, nowMs });
    if (plan.kind === 'write') {
      tx.set(ref, {
        entries: plan.entries.map((entry) => ({
          authTimeSec: entry.authTimeSec,
          revokedAt: Timestamp.fromMillis(entry.revokedAtMs || nowMs),
        })),
        updatedAt: Timestamp.fromMillis(nowMs),
      });
    }
    return plan.kind;
  });
}

/** Μετά από ανάκληση **όλων**: η λίστα είναι περιττή (όλα τα παλιά `auth_time` πέφτουν στη σφραγίδα). */
export async function clearRevokedSignIns(uid: string): Promise<void> {
  await listRef(uid).delete();
}
