/**
 * =============================================================================
 * IDENTITY RECORD — το προφίλ του ανθρώπου, και **τίποτα άλλο** (ADR-853 Φ1)
 * =============================================================================
 *
 * Καλείται από **ΕΝΑ** σημείο: `POST /api/auth/session` — το universal login
 * chokepoint, που πυροδοτείται από το `onAuthStateChanged` για **κάθε** provider.
 * ⛔ **Και το «ΕΝΑ» είναι ΦΡΟΥΡΟΥΜΕΝΟ, όχι υποσχόμενο**: κλειστό σύνολο καλούντων με
 * υποχρεωτικό λόγο, που κοκκινίζει **και στις δύο** κατευθύνσεις (άγκυρες `Χ1`·`Χ1β`
 * στο `__tests__/identity-record.test.ts`). Το αποσυρμένο
 * `POST /api/auth/complete-registration` (ADR-660 §5.13) δεν επανέρχεται (`Χ3`).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ADR-853 §1 — ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ ΠΟΥ ΑΔΕΙΑΣΕ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μέχρι τις 2026-09-11 αυτή η μονάδα λεγόταν `pending-registration` και έκανε **τρία**
 * πράγματα: έγραφε ταυτότητα, **άνοιγε αίτημα ένταξης** και **ειδοποιούσε διαχειριστές**.
 * Τα δύο τελευταία πήγαιναν **πάντα** στην ίδια εταιρεία (`getCompanyId()` → ΠΑΓΩΝΗΣ),
 * γιατί η πλατφόρμα είχε μία. Δηλαδή **κάθε** άνθρωπος που έμπαινε στο nestorconstruct.gr
 * γινόταν, χωρίς να το ζητήσει, **αίτημα προς ένα γραφείο που κανείς δεν επέλεξε**.
 *
 * Η αρχή ήταν ήδη γραμμένη και παραβιαζόταν: **ADR-787 §2.2 — «η εγγραφή ΔΕΝ δίνει χώρο»**.
 *
 * ⇒ Πλέον η σύνδεση κάνει **μόνο** αυτό που δικαιολογεί: γράφει **ποιος είναι** ο άνθρωπος.
 * Η ένταξη σε ξένο χώρο ξεκινά **από τον χώρο**, με **πρόσκληση** (ADR-853 Α1), γιατί μόνο
 * ο χώρος ξέρει ποιος του ανήκει. Ο ιδιωτικός χώρος υπάρχει **ούτως ή άλλως** και δεν
 * ζητείται ποτέ (ADR-787 Ε-3 §2) — άρα ο άνθρωπος **δεν περιμένει κανέναν** για να υπάρχει.
 *
 * ⚠️ **ΤΟ `assigned` ΚΑΙ ΤΟ `citizen` ΜΕΝΟΥΝ ΑΥΣΤΗΡΑ NO-OP** (ADR-660 §5.13 · ADR-844):
 * είναι η **μοναδική** άμυνα απέναντι στην υποβάθμιση προβεβλημένου χρήστη, και ο έλεγχός
 * τους κρίνει το **έγγραφο** — όχι το claim.
 *
 * @module server/auth/identity-record
 * @enterprise ADR-853 — Προσκλήσεις χώρου (Φ1: κλείσιμο της διαρροής σταθερής εταιρείας)
 * @see ADR-660 §6 (το αίτημα ως οντότητα — **παγώνει**) · ADR-657 §3.5 (fail-closed auth)
 */

import 'server-only';

import type { DocumentReference, Transaction } from 'firebase-admin/firestore';
import { FieldValue as AdminFieldValue } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { CITIZEN_STATUS } from '@/server/auth/citizen-identity';

// =============================================================================
// TYPES
// =============================================================================

/**
 * ⚠️ **ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ, ΚΑΙ ΚΑΜΙΑ ΔΕΝ ΕΙΝΑΙ ΠΑΡΑΛΛΑΓΗ ΤΩΝ ΑΛΛΩΝ.**
 *
 * - `identity` — γράφτηκε (ή ανανεώθηκε) το προφίλ του ανθρώπου. **Καμία** πρόσβαση,
 *   **καμία** ειδοποίηση, **κανένα** αίτημα προς κανέναν.
 * - `assigned` — έχει ήδη χώρο· εδώ δεν γίνεται τίποτα.
 * - `citizen` — απέδειξε το email του από δημόσια αγγελία (ADR-844)· **αυστηρό no-op**,
 *   γιατί οποιαδήποτε γραφή θα έσπαγε την ταυτότητά του.
 *
 * 🔴 Το `pending` **έφυγε από το λεξιλόγιο** (ADR-853 Α4): κανείς δεν ανοίγει πια αίτημα
 * αυτόματα, άρα καμία σύνδεση δεν καταλήγει σε «περιμένει».
 */
export type IdentityRecordStatus = 'identity' | 'assigned' | 'citizen';

export interface IdentityRecordInput {
  uid: string;
  email: string;
  displayName?: string | null;
  authProvider?: string | null;
}

export interface IdentityRecordResult {
  status: IdentityRecordStatus;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Εξασφαλίζει ότι ο συνδεδεμένος άνθρωπος έχει **προφίλ ταυτότητας** — και **μόνο** αυτό.
 * Idempotent + race-proof (ένα transaction, καμία εξάρτηση από σειρά).
 */
export async function ensureIdentityRecord(input: IdentityRecordInput): Promise<IdentityRecordResult> {
  const db = getAdminFirestore();
  const userRef = db.collection(COLLECTIONS.USERS).doc(input.uid);

  return db.runTransaction<IdentityRecordResult>((tx) => writeIdentityInTransaction(tx, userRef, input));
}

async function writeIdentityInTransaction(
  tx: Transaction,
  userRef: DocumentReference,
  input: IdentityRecordInput,
): Promise<IdentityRecordResult> {
  const snap = await tx.get(userRef);
  const data = snap.exists ? (snap.data() as Record<string, unknown>) : null;

  // Ήδη μέλος χώρου (έχει tenant) — ΠΟΤΕ downgrade, no-op.
  const companyId = data?.companyId;
  if (typeof companyId === 'string' && companyId.length > 0) return { status: 'assigned' };

  // 🔴 **Ο ΠΟΛΙΤΗΣ — ΑΥΣΤΗΡΟ NO-OP** (ADR-844): δεν γράφουμε τίποτα, γιατί θα έσπαγε
  //    την ταυτότητα που απέδειξε ο ίδιος από δημόσια αγγελία.
  if (data?.status === CITIZEN_STATUS) return { status: 'citizen' };

  const displayName = input.displayName ?? (data?.displayName as string | null) ?? null;
  const authProvider = input.authProvider ?? (data?.authProvider as string | null) ?? 'unknown';

  tx.set(userRef, identityWrite(input, snap.exists, displayName, authProvider), { merge: true });
  return { status: 'identity' };
}

/**
 * Το `users/{uid}` — **μόνο ταυτότητα**. ⚠️ **ΚΑΝΕΝΑ `status`**: το «περιμένει έγκριση»
 * δεν υπάρχει πια ως κατάσταση λογαριασμού (ADR-660 §6 · ADR-853 Α4)· ένα `status` εδώ
 * θα ήταν δεύτερη αυθεντία για ερώτημα που **κανείς δεν κάνει**.
 */
function identityWrite(
  input: IdentityRecordInput,
  exists: boolean,
  displayName: string | null,
  authProvider: string | null,
): Record<string, unknown> {
  const write: Record<string, unknown> = {
    email: input.email,
    displayName,
    companyId: null,
    globalRole: null,
    authProvider,
    updatedAt: AdminFieldValue.serverTimestamp(),
  };
  if (!exists) {
    write.uid = input.uid;
    write.createdAt = AdminFieldValue.serverTimestamp();
  }
  return write;
}
