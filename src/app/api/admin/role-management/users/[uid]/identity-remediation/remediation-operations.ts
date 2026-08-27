/**
 * =============================================================================
 * Ο ΕΚΤΕΛΕΣΤΗΣ ΤΗΣ ΘΕΡΑΠΕΙΑΣ — COMPARE-AND-SWAP, ΠΟΤΕ ΤΥΦΛΗ ΓΡΑΦΗ (ADR-822 §4.5)
 * =============================================================================
 *
 * Χωρισμένο από το `route.ts` για τον λόγο του **N.7.1**: το route κρατά το
 * *«ποιος επιτρέπεται και τι απαντάμε»*, εδώ ζει το *«πώς γράφεται, ασφαλώς»*.
 *
 * 🔑 **Η ΓΡΑΦΗ ΓΙΝΕΤΑΙ ΜΟΝΟ ΑΝ ΤΟ ΕΓΓΡΑΦΟ ΕΙΝΑΙ ΑΚΟΜΑ ΑΥΤΟ ΠΟΥ ΔΙΑΒΑΣΤΗΚΕ.**
 * Το remediation των μεγάλων *(AWS, Okta)* γράφει τυφλά: διαβάζει, αποφασίζει,
 * γράφει — και ό,τι μεσολάβησε **χάνεται σιωπηλά**. Εδώ η `expectedUpdatedAtMs`
 * ελέγχεται **μέσα στην ίδια συναλλαγή** με τη γραφή. Αν κάποιος άλλος άγγιξε
 * το έγγραφο στο μεσοδιάστημα, η πράξη **αρνείται** — δεν υπεργράφει.
 * Ίδιο μοτίβο CAS με το ADR-769· **ένα** λεξιλόγιο, όχι δεύτερο.
 *
 * ⛔ **ΚΑΜΙΑ ΔΙΑΓΡΑΦΗ, ΚΑΜΙΑ ΔΗΜΙΟΥΡΓΙΑ.** Μόνο `update` σε έγγραφο που
 * **υπάρχει**, και μόνο στα πεδία που δηλώνει το `RemediationPatch`.
 *
 * @module api/admin/identity-remediation/[uid]/remediation-operations
 * @see ADR-822 §4.5
 */

import 'server-only';

import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

import { FieldValue } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { IdentityAccountFacts, IdentityDocumentFacts } from '@/lib/auth/identity-provenance';
import type { AuthProfileFacts, MaterialisationPlan, RemediationPlan } from '@/lib/auth/identity-remediation';

/** Ό,τι διαβάστηκε **και από τα δύο** μητρώα, σε μία στιγμή. */
export interface IdentityPair {
  readonly account: IdentityAccountFacts | null;
  readonly document: IdentityDocumentFacts | null;
  /** Η **ταυτότητα της κατάστασης** — `null` αν το έγγραφο δεν είχε `updatedAt`. */
  readonly updatedAtMs: number | null;
}

/**
 * Διαβάζει **και τα δύο** μητρώα για ένα uid.
 *
 * ⚠️ Ο λογαριασμός που **δεν υπάρχει** δεν είναι σφάλμα εδώ — είναι **εύρημα**
 * *(`document-without-account`)*. Γι' αυτό το `getUser` πιάνεται και γίνεται
 * `null`, αντί να ανέβει ως 500.
 */
export async function readIdentityPair(db: Firestore, auth: Auth, uid: string): Promise<IdentityPair> {
  const [account, snapshot] = await Promise.all([readAccount(auth, uid), db.collection(COLLECTIONS.USERS).doc(uid).get()]);

  if (!snapshot.exists) return { account, document: null, updatedAtMs: null };

  const data = snapshot.data() ?? {};
  return {
    account,
    document: {
      authProvider: typeof data.authProvider === 'string' ? data.authProvider : null,
      status: typeof data.status === 'string' ? data.status : null,
      globalRole: typeof data.globalRole === 'string' ? data.globalRole : null,
      loginCount: typeof data.loginCount === 'number' ? data.loginCount : null,
    },
    updatedAtMs: toMillis(data.updatedAt),
  };
}

/** Ο λογαριασμός Auth, ή `null` αν δεν υπάρχει. **Μόνο ανάγνωση.** */
async function readAccount(auth: Auth, uid: string): Promise<IdentityAccountFacts | null> {
  try {
    const user = await auth.getUser(uid);
    const claims = (user.customClaims ?? {}) as Record<string, unknown>;
    return {
      disabled: user.disabled,
      globalRoleClaim: typeof claims.globalRole === 'string' ? claims.globalRole : null,
      mfaEnrolled: (user.multiFactor?.enrolledFactors?.length ?? 0) > 0,
    };
  } catch {
    return null;
  }
}

/** Το `updatedAt` σε ms — Timestamp, Date ή αριθμός. Οτιδήποτε άλλο ⇒ `null`. */
function toMillis(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  const candidate = value as { toMillis?: () => number };
  return typeof candidate.toMillis === 'function' ? candidate.toMillis() : null;
}

/** Τα πεδία που η θεραπεία αγγίζει — **ο παρονομαστής του before/after**. */
const OBSERVED_FIELDS = ['globalRole', 'status'] as const;

/** Το αποτέλεσμα της γραφής: απόδειξη πριν **και** μετά, ή ονομασμένη άρνηση. */
export type ApplyResult =
  | { readonly ok: true; readonly before: Record<string, unknown>; readonly after: Record<string, unknown> }
  | { readonly ok: false; readonly error: string };

/**
 * Εκτελεί τη **forward** πράξη — μόνο αν το έγγραφο δεν έχει αλλάξει.
 *
 * 🔑 **Ιδεμποτεντικό** (N.7.2 #3): δεύτερη κλήση με το ίδιο σχέδιο βρίσκει
 * διαφορετικό `updatedAt` και **αρνείται**· δεν διπλογράφει, δεν σπάει.
 */
export async function applyRemediation(
  db: Firestore,
  plan: RemediationPlan,
  actorUid: string,
): Promise<ApplyResult> {
  const ref = db.collection(COLLECTIONS.USERS).doc(plan.forward.uid);

  try {
    return await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) {
        // ⛔ Δεν το δημιουργούμε. Έγγραφο που εξαφανίστηκε είναι γεγονός, όχι κενό.
        throw new RemediationRefused('Document no longer exists — refusing to create it');
      }

      const data = snapshot.data() ?? {};
      const currentUpdatedAt = toMillis(data.updatedAt);
      if (currentUpdatedAt !== plan.forward.expectedUpdatedAtMs) {
        throw new RemediationRefused(
          `Document changed since it was read (expected updatedAt ${plan.forward.expectedUpdatedAtMs}, found ${currentUpdatedAt}). Re-read and approve again.`,
        );
      }

      const before = pick(data);
      tx.update(ref, {
        ...plan.forward.patch,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actorUid,
      });

      return { ok: true as const, before, after: { ...before, ...plan.forward.patch } };
    });
  } catch (error) {
    if (error instanceof RemediationRefused) return { ok: false, error: error.message };
    throw error;
  }
}

/** Άρνηση **με λόγο** — ξεχωριστή από πραγματικό σφάλμα υποδομής. */
class RemediationRefused extends Error {}

/** Μόνο τα πεδία που αγγίζουμε — ένα «before» με 20 πεδία δεν είναι απόδειξη. */
function pick(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of OBSERVED_FIELDS) out[field] = data[field] ?? null;
  return out;
}

// ============================================================================
// Η ΥΛΟΠΟΙΗΣΗ — Η ΜΟΝΗ ΔΗΜΙΟΥΡΓΙΑ, ΚΑΙ ΜΟΝΟ ΟΤΑΝ ΤΟ ΕΓΓΡΑΦΟ ΔΕΝ ΥΠΑΡΧΕΙ
// ============================================================================

/** Τα γεγονότα του Auth για την {@link MaterialisationPlan}. **Μόνο ανάγνωση.** */
export async function readAuthProfile(auth: Auth, uid: string): Promise<AuthProfileFacts | null> {
  try {
    const user = await auth.getUser(uid);
    const claims = (user.customClaims ?? {}) as Record<string, unknown>;
    return {
      uid: user.uid,
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      photoURL: user.photoURL ?? null,
      emailVerified: user.emailVerified,
      disabled: user.disabled,
      providerId: user.providerData[0]?.providerId ?? null,
      creationTimeMs: toMillisFromIso(user.metadata.creationTime),
      lastSignInTimeMs: toMillisFromIso(user.metadata.lastSignInTime),
      globalRoleClaim: typeof claims.globalRole === 'string' ? claims.globalRole : null,
      companyIdClaim: typeof claims.companyId === 'string' ? claims.companyId : null,
    };
  } catch {
    return null;
  }
}

/** Οι ISO ημερομηνίες του `UserRecord.metadata`. Άκυρη ⇒ `null`, ποτέ `NaN`. */
function toMillisFromIso(iso: string | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Δημιουργεί το έγγραφο — **μόνο αν δεν υπάρχει**.
 *
 * 🔑 **Η ΠΡΟΫΠΟΘΕΣΗ ΕΙΝΑΙ Η ΑΠΟΥΣΙΑ.** Αν στο μεταξύ κάποιος το δημιούργησε, η
 * πράξη **αρνείται** — δεν υπεργράφει ξένη δουλειά. Το CAS των άλλων πράξεων
 * ελέγχει *«είναι ακόμα αυτό που είδα;»*· εδώ ελέγχει *«είναι ακόμα τίποτα;»*.
 * Ιδεμποτεντικό: δεύτερη κλήση αρνείται, δεν διπλογράφει.
 */
export async function materialiseDocument(
  db: Firestore,
  plan: MaterialisationPlan,
  actorUid: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ref = db.collection(COLLECTIONS.USERS).doc(plan.uid);
  try {
    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (snapshot.exists) {
        throw new RemediationRefused('Document already exists — refusing to overwrite it');
      }
      tx.set(ref, { ...plan.document, updatedBy: actorUid });
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof RemediationRefused) return { ok: false, error: error.message };
    throw error;
  }
}
