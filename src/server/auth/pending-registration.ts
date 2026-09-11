/**
 * =============================================================================
 * PENDING REGISTRATION — SSoT provisioning service (ADR-660)
 * =============================================================================
 *
 * Αντικαθιστά την παλιά ανοιχτή αυτο-εγγραφή: αντί να χορηγεί αυτόματα tenant +
 * ρόλο `external_user` σε κάθε αυθεντικοποιημένο χρήστη, ανοίγει **αίτημα ένταξης**
 * — ΧΩΡΙΣ custom claims, ΧΩΡΙΣ companyId, ΧΩΡΙΣ member doc. Το fail-closed
 * (ADR-657 §3.5) κόβει έτσι τον χρήστη από τον χώρο μέχρι να τον εγκρίνει ρητά
 * ένας διαχειριστής μέσω της υπάρχουσας κονσόλας (set-user-claims).
 *
 * Καλείται από **ΕΝΑ** σημείο: `POST /api/auth/session` — το universal login
 * chokepoint, που πυροδοτείται από το `onAuthStateChanged` για **κάθε** provider.
 * ⛔ **Και το «ΕΝΑ» είναι ΦΡΟΥΡΟΥΜΕΝΟ, όχι υποσχόμενο**: κλειστό σύνολο καλούντων με
 * υποχρεωτικό λόγο, που κοκκινίζει **και στις δύο** κατευθύνσεις (άγκυρες `Χ1`·`Χ1β`
 * στο `__tests__/pending-registration.test.ts`). Το αποσυρμένο
 * `POST /api/auth/complete-registration` (ADR-660 §5.13) δεν επανέρχεται (`Χ3`).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ADR-660 §6 (2026-09-11) — ΤΟ ΑΙΤΗΜΑ ΕΓΙΝΕ ΟΝΤΟΤΗΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μέχρι σήμερα το «περιμένει έγκριση» ήταν `users/{uid}.status = 'pending'` — δηλαδή το
 * **ίδιο** πεδίο που απαντά και «τι ταυτότητα έχει». Όταν ο αιτών απέδειξε το email του
 * από δημόσια αγγελία (ADR-844), η ταυτότητα έγινε `citizen` με `merge` και **το αίτημα
 * εξαφανίστηκε σιωπηλά** από τη λίστα του διαχειριστή (ADR-844 §13.6 #2).
 *
 * Πλέον: `workspace_access_requests/{id}` (`server/auth/workspace-access-request.ts`),
 * ντετερμινιστικό id ανά (χώρος, πρόσωπο), ανοιγμένο **μέσα στο ίδιο transaction**. Το
 * `users/{uid}` κρατά **μόνο ταυτότητα** — και το `'pending'` έφυγε από το λεξιλόγιο
 * (`USER_STATUSES`): 0 έγγραφα στην παραγωγή (μετρημένο 2026-09-11), κανένας κανόνας ή
 * φρουρός δεν το διάβαζε για πρόσβαση.
 *
 * ⚠️ **ΓΙ' ΑΥΤΟ ΤΟ `assigned` ΕΙΝΑΙ ΑΥΣΤΗΡΟ NO-OP ΚΑΙ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΧΑΛΑΡΩΣΕΙ**
 * (ADR-660 §5.13): είναι η **μοναδική** άμυνα απέναντι στην υποβάθμιση προβεβλημένου
 * χρήστη, και ο έλεγχός του κρίνει το **έγγραφο** — όχι το claim.
 *
 * Notify-once: η ειδοποίηση των admin γίνεται ΜΙΑ φορά ανά αίτημα, μέσω του
 * transaction-guarded `notifiedAt` **του αιτήματος** — zero race.
 *
 * @module server/auth/pending-registration
 * @enterprise ADR-660 — Self-registration hardening (pending / admin-approval)
 * @see ADR-657 §3.5 (fail-closed auth) · ADR-439 Phase 3 (tenant provisioning)
 */

import 'server-only';

import type { DocumentReference, Transaction } from 'firebase-admin/firestore';
import { FieldValue as AdminFieldValue } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { getCompanyId } from '@/config/tenant';
import { getErrorMessage } from '@/lib/error-utils';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { publicUrl } from '@/lib/http/public-origin';
import { createModuleLogger } from '@/lib/telemetry';
import { CITIZEN_STATUS } from '@/server/auth/citizen-identity';
import { openAccessRequestInTx, readAccessRequestInTx } from '@/server/auth/workspace-access-request';
import { sendReplyViaMailgun } from '@/services/ai-pipeline/shared/mailgun-sender';
import { buildPendingRegistrationAdminEmail } from '@/services/email-templates/pending-registration-admin';

const logger = createModuleLogger('PENDING_REGISTRATION');

const ADMIN_ROLES: readonly string[] = ['super_admin', 'company_admin'];

/** Η κονσόλα έγκρισης (ADR-244) — ο σύνδεσμος της ειδοποίησης διαχειριστή. */
const REVIEW_PATH = '/admin/role-management';

// =============================================================================
// TYPES
// =============================================================================

/**
 * ⚠️ **ΤΕΣΣΕΡΙΣ ΚΑΤΑΣΤΑΣΕΙΣ, ΚΑΙ ΚΑΜΙΑ ΔΕΝ ΕΙΝΑΙ ΠΑΡΑΛΛΑΓΗ ΤΩΝ ΑΛΛΩΝ.**
 *
 * - `pending` — το αίτημα ένταξης **εκκρεμεί** (άνοιξε τώρα ή ήταν ήδη ανοιχτό).
 * - `assigned` — έχει ήδη μισθωτή· εδώ δεν γίνεται τίποτα.
 * - `citizen` — **δεν ζήτησε ποτέ χώρο εργασίας** (ADR-844)· τίποτα δεν ανοίγει. ⚠️ Αν
 *   είχε **ήδη** ανοιχτό αίτημα πριν γίνει πολίτης, αυτό **μένει** — δεν το αγγίζουμε.
 * - `decided` — το αίτημα **απαντήθηκε** (εγκρίθηκε/απορρίφθηκε)· **δεν** ξανανοίγει
 *   μόνο του σε κάθε σύνδεση (Atlassian: *«can't request access again»* χωρίς διαχειριστή).
 */
export type PendingRegistrationStatus = 'pending' | 'assigned' | 'citizen' | 'decided';

export interface PendingRegistrationInput {
  uid: string;
  email: string;
  displayName?: string | null;
  authProvider?: string | null;
}

export interface PendingRegistrationResult {
  status: PendingRegistrationStatus;
  /** True μόνο όταν στάλθηκε (τώρα) ειδοποίηση προς διαχειριστές. */
  notified: boolean;
}

interface TransactionOutcome {
  kind: PendingRegistrationStatus;
  /** True όταν αυτή η κλήση «κέρδισε» την πρώτη ειδοποίηση του αιτήματος. */
  firstNotification: boolean;
  displayName: string | null;
  authProvider: string | null;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Εξασφαλίζει ότι ο χρήστης χωρίς χώρο έχει **αίτημα ένταξης** (ή είναι ήδη assigned /
 * πολίτης / αποφασισμένος). Idempotent + race-proof. Ειδοποίηση admin το πολύ μία φορά.
 */
export async function ensurePendingRegistration(
  input: PendingRegistrationInput,
): Promise<PendingRegistrationResult> {
  const db = getAdminFirestore();
  const userRef = db.collection(COLLECTIONS.USERS).doc(input.uid);
  const tenantCompanyId = getCompanyId();

  const outcome = await db.runTransaction<TransactionOutcome>((tx) =>
    registerInTransaction(tx, userRef, input, tenantCompanyId),
  );

  // ⚠️ **`!== 'pending'`, ΚΑΙ ΟΧΙ ΑΠΑΡΙΘΜΗΣΗ ΤΩΝ ΑΛΛΩΝ.** Μια πέμπτη κατάσταση αύριο θα
  //    έπεφτε σιωπηλά στη διαδρομή της ειδοποίησης — δηλαδή θα ενοχλούσε άνθρωπο.
  if (outcome.kind !== 'pending') return { status: outcome.kind, notified: false };
  if (!outcome.firstNotification) return { status: 'pending', notified: false };

  const sent = await notifyAdminsOfPendingRegistration({
    pendingEmail: input.email,
    pendingName: outcome.displayName,
    authProvider: outcome.authProvider,
  }).catch((err: unknown) => {
    logger.warn('Admin notification failed (non-blocking)', { uid: input.uid, error: getErrorMessage(err) });
    return 0;
  });

  return { status: 'pending', notified: sent > 0 };
}

const NO_OP = { firstNotification: false, displayName: null, authProvider: null } as const;

async function registerInTransaction(
  tx: Transaction,
  userRef: DocumentReference,
  input: PendingRegistrationInput,
  tenantCompanyId: string,
): Promise<TransactionOutcome> {
  const snap = await tx.get(userRef);
  const data = snap.exists ? (snap.data() as Record<string, unknown>) : null;

  // Ήδη εγκεκριμένος (έχει tenant) — ΠΟΤΕ downgrade, no-op.
  const companyId = data?.companyId;
  if (typeof companyId === 'string' && companyId.length > 0) return { kind: 'assigned', ...NO_OP };

  // 🔴 **Ο ΠΟΛΙΤΗΣ — ΑΥΣΤΗΡΟ NO-OP** (ADR-844): δεν γράφουμε τίποτα — ούτε στο έγγραφο
  //    (θα έσπαγε την ταυτότητά του) ούτε στο αίτημα (αν υπάρχει, **επιβιώνει** ανέπαφο).
  if (data?.status === CITIZEN_STATUS) return { kind: 'citizen', ...NO_OP };

  // 🔑 **ΟΛΕΣ οι αναγνώσεις ΠΡΙΝ από κάθε γραφή** — κανόνας των transactions της Firestore.
  const request = await readAccessRequestInTx(tx, tenantCompanyId, input.uid);
  const displayName = input.displayName ?? (data?.displayName as string | null) ?? null;
  const authProvider = input.authProvider ?? (data?.authProvider as string | null) ?? 'unknown';

  tx.set(userRef, identityWrite(input, snap.exists, displayName, authProvider), { merge: true });
  const opened = openAccessRequestInTx(tx, request, {
    companyId: tenantCompanyId, uid: input.uid, email: input.email, displayName, authProvider,
  });

  return {
    kind: opened.status === 'pending' ? 'pending' : 'decided',
    firstNotification: opened.firstNotification,
    displayName,
    authProvider,
  };
}

/**
 * Το `users/{uid}` — **μόνο ταυτότητα**. ⚠️ **ΚΑΝΕΝΑ `status`**: το «περιμένει έγκριση»
 * ζει στο αίτημα (§6)· ένα `status` εδώ θα ήταν δεύτερη αυθεντία για το ίδιο ερώτημα.
 */
function identityWrite(
  input: PendingRegistrationInput,
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

// =============================================================================
// ADMIN NOTIFICATION
// =============================================================================

async function notifyAdminsOfPendingRegistration(params: {
  pendingEmail: string;
  pendingName: string | null;
  authProvider: string | null;
}): Promise<number> {
  const tenantCompanyId = getCompanyId();
  const recipients = await resolveAdminEmails(tenantCompanyId);
  if (recipients.length === 0) {
    logger.warn('No admin recipients for pending-registration notification', { tenantCompanyId });
    return 0;
  }

  const { subject, html, text } = buildPendingRegistrationAdminEmail({
    pendingEmail: params.pendingEmail,
    pendingName: params.pendingName,
    authProvider: params.authProvider,
    requestedAt: new Date(),
    // 🔑 Φ5 (ADR-851) — από το ΕΝΑ SSoT· χωρίς δημόσια διεύθυνση, email **χωρίς** σύνδεσμο.
    reviewUrl: publicUrl(REVIEW_PATH) ?? '',
  });

  let sent = 0;
  for (const to of recipients) {
    const result = await sendReplyViaMailgun({ to, subject, textBody: text, htmlBody: html });
    if (result.success) {
      sent += 1;
    } else {
      logger.warn('Pending notification send failed', { to, error: result.error });
    }
  }
  logger.info('Pending-registration admin notification dispatched', {
    tenantCompanyId, recipients: recipients.length, sent,
  });
  return sent;
}

/**
 * Επιστρέφει τα emails των ενεργών super_admin / company_admin του tenant.
 *
 * SSoT = το top-level `users` collection (companyId + globalRole). ΟΧΙ το
 * `companies/{id}/members` subcollection: για bootstrap-ed owners (π.χ. ο ίδιος
 * ο ιδιοκτήτης) το member doc μπορεί να μην έχει δημιουργηθεί ποτέ — τα claims
 * τέθηκαν απευθείας. Το `users` είναι πάντα populated (JIT profile σε κάθε login).
 *
 * Ένα μόνο `where('companyId', ...)` (CHECK 3.10 compliant, χωρίς composite index)
 * + in-memory φίλτρο ρόλου· ο tenant έχει λίγους χρήστες.
 */
async function resolveAdminEmails(tenantCompanyId: string): Promise<string[]> {
  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTIONS.USERS)
    .where('companyId', '==', tenantCompanyId)
    .limit(1000)
    .get();

  const emails = new Set<string>();
  for (const doc of snap.docs) {
    const d = doc.data();
    const role = d.globalRole as string | undefined;
    if (role === undefined || !ADMIN_ROLES.includes(role)) continue;
    const email = d.email as string | undefined;
    const status = (d.status as string | undefined) ?? 'active';
    if (email && email.includes('@') && status !== 'suspended' && status !== 'inactive') {
      emails.add(email);
    }
  }
  return Array.from(emails);
}
