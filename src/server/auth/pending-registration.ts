/**
 * =============================================================================
 * PENDING REGISTRATION — SSoT provisioning service (ADR-660)
 * =============================================================================
 *
 * Αντικαθιστά την παλιά ανοιχτή αυτο-εγγραφή: αντί να χορηγεί αυτόματα tenant +
 * ρόλο `external_user` σε κάθε αυθεντικοποιημένο χρήστη, δημιουργεί μια εγγραφή
 * σε κατάσταση **pending** — ΧΩΡΙΣ custom claims, ΧΩΡΙΣ companyId, ΧΩΡΙΣ member
 * doc. Το fail-closed (ADR-657 §3.5) κόβει έτσι τον χρήστη μέχρι να τον εγκρίνει
 * ρητά ένας διαχειριστής μέσω της υπάρχουσας κονσόλας (set-user-claims).
 *
 * Καλείται από **ΕΝΑ** σημείο: `POST /api/auth/session` — το universal login
 * chokepoint, που πυροδοτείται από το `onAuthStateChanged` για **κάθε** provider.
 * ⛔ **Και πλέον το «ΕΝΑ» είναι ΦΡΟΥΡΟΥΜΕΝΟ, όχι υποσχόμενο**: κλειστό σύνολο
 * καλούντων με υποχρεωτικό λόγο, που κοκκινίζει **και στις δύο** κατευθύνσεις
 * (άγκυρες `Χ1`·`Χ1β` στο `__tests__/pending-registration.test.ts`). Μέχρι
 * 2026-08-23 αυτές οι γραμμές έλεγαν «ΔΥΟ σημεία» και ήταν **λάθος** — *η
 * περιγραφή ήταν η απόκλιση*, το σχήμα των CHECK 3.34 / 3.57.
 *
 * 🔴 **ΔΙΟΡΘΩΣΗ 2026-08-23 (ADR-660).** Αυτές οι γραμμές έλεγαν «ΔΥΟ σημεία» και
 * ονόμαζαν και το `POST /api/auth/complete-registration`. Εκείνο ήταν **νεκρό ΚΑΙ
 * δομικά αδύνατο**: τυλιγμένο σε `withAuth`, επέστρεφε **401 ακριβώς στους χρήστες
 * που υπήρχε για να εξυπηρετήσει** (κανένα claim ⇒ `missing_claims`), και ο πελάτης
 * το είχε εγκαταλείψει ρητά (`useAuthActions.ts`).
 * ⚠️ Δηλαδή **η περιγραφή ήταν η απόκλιση** — το σχήμα των CHECK 3.34 / 3.57.
 *
 * ✅ **ΔΙΑΓΡΑΦΗΚΕ 2026-08-23 (ADR-660 §5.13).** Και ο λόγος δεν ήταν «δεν το καλεί
 * κανείς»: η απαρίθμηση **όλων** των δυνατών καλούντων έδωσε **401 · 401 · no-op ·
 * ΥΠΟΒΑΘΜΙΣΗ**. Ο **μόνος** κλάδος του που έγραφε κάτι ήταν εκείνος που περνά το
 * `withAuth` με **claim** αλλά βρίσκει έγγραφο **χωρίς** `companyId` — και τότε αυτή
 * η συνάρτηση γράφει `companyId: null, globalRole: null, status:'pending'` πάνω σε
 * **προβεβλημένο** χρήστη. Η απόκλιση claim↔έγγραφο είναι **ρητά ανεκτή** από δύο
 * μη-ατομικές διπλές εγγραφές (`set-user-claims` · `bootstrap-admin`), που την
 * αναφέρουν οι ίδιες ως `warning: 'Custom claims set but Firestore sync failed'`.
 * *Μετρημένο 2026-08-23: **0/4** χρήστες σε απόκλιση — λανθάνον, όχι ενεργό.*
 *
 * ⚠️ **ΓΙ' ΑΥΤΟ ΤΟ `assigned` ΕΙΝΑΙ ΑΥΣΤΗΡΟ NO-OP ΚΑΙ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΧΑΛΑΡΩΣΕΙ.**
 * Είναι η **μοναδική** άμυνα απέναντι σε αυτή την υποβάθμιση, και ο έλεγχός του
 * κρίνει το **έγγραφο** — όχι το claim, που ο καλών ήδη απέδειξε ότι έχει.
 *
 * Notify-once: η ειδοποίηση των admin γίνεται ΜΙΑ φορά ανά χρήστη, μέσω
 * transaction-guarded `pendingNotifiedAt` — zero race ακόμη κι αν τα δύο σημεία
 * τρέξουν ταυτόχρονα.
 *
 * @module server/auth/pending-registration
 * @enterprise ADR-660 — Self-registration hardening (pending / admin-approval)
 * @see ADR-657 §3.5 (fail-closed auth) · ADR-439 Phase 3 (tenant provisioning)
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { FieldValue as AdminFieldValue } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getCompanyId } from '@/config/tenant';
import { sendReplyViaMailgun } from '@/services/ai-pipeline/shared/mailgun-sender';
import { buildPendingRegistrationAdminEmail } from '@/services/email-templates/pending-registration-admin';
import { CITIZEN_STATUS } from '@/server/auth/citizen-identity';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('PENDING_REGISTRATION');

const ADMIN_ROLES: readonly string[] = ['super_admin', 'company_admin'];

// =============================================================================
// TYPES
// =============================================================================

/**
 * ⚠️ **ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ, ΚΑΙ Η ΤΡΙΤΗ ΔΕΝ ΕΙΝΑΙ ΠΑΡΑΛΛΑΓΗ ΤΩΝ ΑΛΛΩΝ ΔΥΟ.**
 *
 * - `pending` — ζήτησε είσοδο σε **χώρο εργασίας** και **περιμένει άνθρωπο**.
 * - `assigned` — έχει ήδη μισθωτή· εδώ δεν γίνεται τίποτα.
 * - `citizen` — **δεν ζήτησε ποτέ χώρο εργασίας** (ADR-844). Ήρθε από δημόσια
 *   αγγελία, έχει ταυτότητα **χωρίς οργανισμό**, και **δεν περιμένει κανέναν**.
 *
 * 🔴 Το `citizen` **δεν** μπορούσε να μπει στο `assigned`: εκείνο σημαίνει *«έχει
 * tenant»*, που για τον πολίτη είναι **ψευδές**. Μια κοινή τιμή θα έκανε τους
 * δύο ισχυρισμούς έναν — το σχήμα του ADR-749.
 */
export type PendingRegistrationStatus = 'pending' | 'assigned' | 'citizen';

export interface PendingRegistrationInput {
  uid: string;
  email: string;
  displayName?: string | null;
  authProvider?: string | null;
}

export interface PendingRegistrationResult {
  /**
   * `assigned` = έχει ήδη tenant (no-op) · `citizen` = ταυτότητα χωρίς οργανισμό,
   * δεν περιμένει έγκριση (no-op, ADR-844) · `pending` = εκκρεμεί έγκριση.
   */
  status: PendingRegistrationStatus;
  /** True μόνο όταν στάλθηκε (τώρα) ειδοποίηση προς διαχειριστές. */
  notified: boolean;
}

interface TransactionOutcome {
  kind: PendingRegistrationStatus;
  /** True όταν αυτή η κλήση «κέρδισε» το πρώτο-notification stamp. */
  firstNotification: boolean;
  displayName: string | null;
  authProvider: string | null;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Εξασφαλίζει ότι ο χρήστης βρίσκεται σε κατάσταση pending (ή είναι ήδη
 * assigned). Idempotent + race-proof. Στέλνει admin notification το πολύ μία
 * φορά ανά χρήστη.
 */
export async function ensurePendingRegistration(
  input: PendingRegistrationInput,
): Promise<PendingRegistrationResult> {
  const db = getAdminFirestore();
  const userRef = db.collection(COLLECTIONS.USERS).doc(input.uid);

  const outcome = await db.runTransaction<TransactionOutcome>(async (tx) => {
    const snap = await tx.get(userRef);
    const data = snap.exists ? (snap.data() as Record<string, unknown>) : null;

    // Ήδη εγκεκριμένος (έχει tenant) — ΠΟΤΕ downgrade, no-op.
    const companyId = data?.companyId;
    if (typeof companyId === 'string' && companyId.length > 0) {
      return { kind: 'assigned', firstNotification: false, displayName: null, authProvider: null };
    }

    // 🔴 **Ο ΠΟΛΙΤΗΣ — ΑΥΣΤΗΡΟ NO-OP, ΓΙΑ ΤΟΝ ΙΔΙΟ ΛΟΓΟ ΜΕ ΤΟ `assigned`** (ADR-844).
    //
    // Ο άνθρωπος που ήρθε από δημόσια αγγελία έχει **ταυτότητα χωρίς οργανισμό**:
    // claim `globalRole: external_user`, **κανένα** `companyId`. Δηλαδή περνά τον
    // πρώτο φρουρό (δεν έχει μισθωτή) και θα έπεφτε **ίσια** στη γραφή παρακάτω —
    // που θα του έγραφε `globalRole: null, status: 'pending'`.
    //
    // ⚠️ **ΤΟ CLAIM ΔΕΝ ΘΑ ΑΓΓΙΖΟΤΑΝ, ΚΑΙ ΓΙ' ΑΥΤΟ ΑΚΡΙΒΩΣ ΕΙΝΑΙ ΣΟΒΑΡΟ**: θα
    // έμενε `external_user` στο token και `null` στο έγγραφο — **ενεργή** απόκλιση
    // claim↔εγγράφου, το ίδιο σχήμα που το §5.13 χαρακτηρίζει «ρητά ανεκτό» αλλά
    // **μετρά 0/4 σήμερα**, δηλαδή λανθάνον. Θα το κάναμε ενεργό, σε **κάθε**
    // σύνδεση **κάθε** πολίτη — και μαζί θα τον έβαζε στη λίστα «εκκρεμείς
    // εγκρίσεις» ενός διαχειριστή που **δεν ζήτησε ποτέ** τίποτα να εγκρίνει.
    //
    // ⛔ Ο έλεγχος κρίνει το **έγγραφο**, ποτέ το claim — ίδια αρχή με τον
    //    φρουρό του `assigned` από πάνω: το έγγραφο είναι αυτό που θα γραφόταν.
    if (data?.status === CITIZEN_STATUS) {
      return { kind: 'citizen', firstNotification: false, displayName: null, authProvider: null };
    }

    const alreadyNotified = Boolean(data?.pendingNotifiedAt);
    const displayName = input.displayName ?? (data?.displayName as string | null) ?? null;
    const authProvider = input.authProvider ?? (data?.authProvider as string | null) ?? 'unknown';

    const writeData: Record<string, unknown> = {
      email: input.email,
      displayName,
      companyId: null,
      globalRole: null,
      // ⚠️ ΕΝΑ πεδίο κατάστασης, ΠΟΤΕ δύο. Μέχρι 2026-08-23 γραφόταν δίπλα και
      // `registrationStatus: 'pending'` — δεύτερη αυθεντία για το ΙΔΙΟ ερώτημα
      // (ADR-749), με **μηδέν αναγνώστες** σε όλο το `src/` και **μηδέν έγγραφα**
      // στη βάση που να το φέρουν. Αφαιρέθηκε· άγκυρα στο test του αρχείου.
      status: 'pending',
      authProvider,
      updatedAt: AdminFieldValue.serverTimestamp(),
    };
    if (!snap.exists) {
      writeData.uid = input.uid;
      writeData.requestedAt = AdminFieldValue.serverTimestamp();
      writeData.createdAt = AdminFieldValue.serverTimestamp();
    }
    if (!alreadyNotified) {
      writeData.pendingNotifiedAt = AdminFieldValue.serverTimestamp();
    }
    tx.set(userRef, writeData, { merge: true });

    return { kind: 'pending', firstNotification: !alreadyNotified, displayName, authProvider };
  });

  // ⚠️ **`!== 'pending'`, ΚΑΙ ΟΧΙ ΑΠΑΡΙΘΜΗΣΗ ΤΩΝ ΑΛΛΩΝ ΔΥΟ.** Η ειδοποίηση
  //    διαχειριστή έχει νόημα **μόνο** για κάποιον που όντως περιμένει έγκριση.
  //    Γραμμένο ως λίστα (`'assigned' || 'citizen'`), μια **τέταρτη** κατάσταση
  //    αύριο θα έπεφτε σιωπηλά στη διαδρομή της ειδοποίησης — δηλαδή θα
  //    ενοχλούσε άνθρωπο για κάτι που δεν του ζητήθηκε να κρίνει.
  if (outcome.kind !== 'pending') {
    return { status: outcome.kind, notified: false };
  }
  if (!outcome.firstNotification) {
    return { status: 'pending', notified: false };
  }

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
    reviewUrl: buildReviewUrl(),
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

/** Πλήρες URL της κονσόλας διαχείρισης ρόλων (κενό αν δεν υπάρχει base URL). */
function buildReviewUrl(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? '').trim();
  if (!base) return '';
  return `${base.replace(/\/+$/, '')}/admin/role-management`;
}
