/**
 * Εκκρεμή αιτήματα εξουσιοδότησης (ADR-738)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΤΟ ΑΙΤΗΜΑ **ΠΑΓΩΝΕΙ** ΠΡΙΝ ΔΕΙ ΤΗΝ ΟΘΟΝΗ Ο ΧΡΗΣΤΗΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η προφανής υλοποίηση περνά τις παραμέτρους (`client_id`, `redirect_uri`,
 * `scope`, …) ως κρυφά πεδία φόρμας και τις ξανα-επικυρώνει στο POST. Δουλεύει,
 * αλλά έχει δύο ρωγμές:
 *
 * 1. **Ό,τι βλέπει ο χρήστης δεν είναι ό,τι εγκρίνει.** Ανάμεσα στο GET και το
 *    POST τα πεδία είναι στα χέρια του browser. Η οθόνη λέει «boq:read για τον
 *    Claude Desktop», η υποβολή μπορεί να λέει κάτι άλλο. Η συγκατάθεση χάνει
 *    το νόημά της αν το αντικείμενό της είναι μεταβλητό.
 * 2. **CSRF.** Χωρίς κρατική σύνδεση, το POST είναι μια φόρμα που μπορεί να
 *    υποβάλει τρίτη σελίδα εκ μέρους του συνδεδεμένου χρήστη.
 *
 * Αποθηκεύοντας το **επικυρωμένο** αίτημα και δίνοντας στον browser μόνο ένα
 * αδιαφανές 256-bit αναγνωριστικό, και τα δύο κλείνουν: οι παράμετροι είναι
 * αμετάβλητες, και το POST απαιτεί μυστικό που μόνο η νόμιμη ροή έδωσε. Το
 * έγγραφο δένεται και στο `uid`, ώστε το αναγνωριστικό να είναι άχρηστο σε
 * άλλον λογαριασμό.
 *
 * @module lib/oauth/authorize-request-store
 * @see ADR-738 §4
 */

import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTERPRISE_ID_PREFIXES } from '@/services/enterprise-id-prefixes';
import { OAUTH_TTL, type OAuthScope } from './oauth-config';
import { isExpiredDoc } from './oauth-doc-guards';

// ============================================================================
// ΤΥΠΟΙ
// ============================================================================

/** Ό,τι χρειάζεται η οθόνη συγκατάθεσης **και** η έκδοση του code. */
export interface PendingAuthorizeRequest {
  readonly clientId: string;
  readonly clientName: string;
  readonly clientUri: string | null;
  readonly redirectUri: string;
  /** Το πρότυπο ζητά ρητή προειδοποίηση σε loopback-only redirects. */
  readonly isLoopbackRedirect: boolean;
  readonly codeChallenge: string;
  readonly scopes: readonly OAuthScope[];
  readonly state: string | null;
  readonly resource: string;
  readonly uid: string;
  readonly companyId: string;
  readonly globalRole: string;
  readonly isFamiliarClient: boolean;
}

export type PendingRejection = 'not_found' | 'expired' | 'consumed' | 'wrong_user';

export type PendingLookup =
  | { readonly ok: true; readonly request: PendingAuthorizeRequest }
  | { readonly ok: false; readonly rejection: PendingRejection };

// ============================================================================
// ΑΠΟΘΗΚΗ
// ============================================================================

function requestDocId(handle: string): string {
  const digest = createHash('sha256').update(handle, 'utf8').digest('hex');
  return `${ENTERPRISE_ID_PREFIXES.OAUTH_AUTH_REQUEST}_${digest}`;
}

/**
 * Αποθηκεύει επικυρωμένο αίτημα και επιστρέφει το αδιαφανές handle.
 *
 * Το handle είναι **μυστικό** (όπως ο code): αποθηκεύεται μόνο το hash του.
 */
export async function storePendingRequest(
  request: PendingAuthorizeRequest,
): Promise<string> {
  const handle = randomBytes(32).toString('base64url');
  const now = Date.now();

  await getAdminFirestore()
    .collection(COLLECTIONS.OAUTH_AUTH_REQUESTS)
    .doc(requestDocId(handle))
    .set({
      ...request,
      scopes: [...request.scopes],
      createdAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(now + OAUTH_TTL.AUTH_REQUEST_MS),
      consumedAt: null,
    });

  return handle;
}

function toPending(data: FirebaseFirestore.DocumentData): PendingAuthorizeRequest {
  return {
    clientId: String(data.clientId),
    clientName: String(data.clientName),
    clientUri: data.clientUri ? String(data.clientUri) : null,
    redirectUri: String(data.redirectUri),
    isLoopbackRedirect: data.isLoopbackRedirect === true,
    codeChallenge: String(data.codeChallenge),
    scopes: (data.scopes as OAuthScope[]) ?? [],
    state: data.state === null || data.state === undefined ? null : String(data.state),
    resource: String(data.resource),
    uid: String(data.uid),
    companyId: String(data.companyId),
    globalRole: String(data.globalRole),
    isFamiliarClient: data.isFamiliarClient === true,
  };
}

/**
 * Η **μία** απόφαση αποδοχής ενός εκκρεμούς αιτήματος.
 *
 * Και οι δύο δρόμοι (ανάγνωση για την οθόνη, κατανάλωση κατά την υποβολή)
 * περνούν από εδώ. Γραμμένη δύο φορές, η σειρά των ελέγχων θα μπορούσε να
 * αποκλίνει — και τότε η οθόνη θα έδειχνε αίτημα που η υποβολή απορρίπτει,
 * ή χειρότερα, το αντίστροφο.
 */
function evaluatePending(
  snapshot: FirebaseFirestore.DocumentSnapshot,
  uid: string,
): PendingLookup {
  if (!snapshot.exists) return { ok: false, rejection: 'not_found' };

  const data = snapshot.data() as FirebaseFirestore.DocumentData;
  if (String(data.uid) !== uid) return { ok: false, rejection: 'wrong_user' };
  if (data.consumedAt !== null) return { ok: false, rejection: 'consumed' };
  if (isExpiredDoc(data)) return { ok: false, rejection: 'expired' };

  return { ok: true, request: toPending(data) };
}

/**
 * Διαβάζει εκκρεμές αίτημα **χωρίς** να το καταναλώσει — για την οθόνη.
 *
 * Το `uid` ελέγχεται εδώ: ένα handle που διέρρευσε δεν πρέπει να εμφανίζει σε
 * άλλον χρήστη τι ζητά ένας client εκ μέρους του πρώτου.
 */
export async function peekPendingRequest(handle: string, uid: string): Promise<PendingLookup> {
  const snapshot = await getAdminFirestore()
    .collection(COLLECTIONS.OAUTH_AUTH_REQUESTS)
    .doc(requestDocId(handle))
    .get();

  return evaluatePending(snapshot, uid);
}

/**
 * Καταναλώνει το αίτημα **ατομικά** — μία απόφαση ανά αίτημα.
 *
 * ⚠️ Σε `runTransaction`. Δύο ταυτόχρονες υποβολές της ίδιας φόρμας (διπλό
 * κλικ, retry του browser) θα εξέδιδαν **δύο** codes για μία συγκατάθεση χωρίς
 * αυτό — και ο δεύτερος code θα ήταν λειτουργικός μετά την ανάκληση του πρώτου.
 */
export async function consumePendingRequest(
  handle: string,
  uid: string,
): Promise<PendingLookup> {
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.OAUTH_AUTH_REQUESTS).doc(requestDocId(handle));

  return db.runTransaction<PendingLookup>(async (tx) => {
    const outcome = evaluatePending(await tx.get(ref), uid);
    if (!outcome.ok) return outcome;

    tx.set(ref, { consumedAt: Timestamp.now() }, { merge: true });
    return outcome;
  });
}
