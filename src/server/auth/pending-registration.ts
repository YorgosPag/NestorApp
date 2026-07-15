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
 * Καλείται από ΔΥΟ σημεία (και τα δύο συγκλίνουν εδώ — μηδέν διπλότυπο):
 *  - `POST /api/auth/session` (universal login chokepoint, κάθε provider)
 *  - `POST /api/auth/complete-registration` (client onboarding, email/password)
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
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('PENDING_REGISTRATION');

const ADMIN_ROLES: readonly string[] = ['super_admin', 'company_admin'];

// =============================================================================
// TYPES
// =============================================================================

export type PendingRegistrationStatus = 'pending' | 'assigned';

export interface PendingRegistrationInput {
  uid: string;
  email: string;
  displayName?: string | null;
  authProvider?: string | null;
}

export interface PendingRegistrationResult {
  /** `assigned` = ο χρήστης έχει ήδη tenant (no-op)· `pending` = εκκρεμεί έγκριση. */
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

    const alreadyNotified = Boolean(data?.pendingNotifiedAt);
    const displayName = input.displayName ?? (data?.displayName as string | null) ?? null;
    const authProvider = input.authProvider ?? (data?.authProvider as string | null) ?? 'unknown';

    const writeData: Record<string, unknown> = {
      email: input.email,
      displayName,
      companyId: null,
      globalRole: null,
      status: 'pending',
      registrationStatus: 'pending',
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

  if (outcome.kind === 'assigned') {
    return { status: 'assigned', notified: false };
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
