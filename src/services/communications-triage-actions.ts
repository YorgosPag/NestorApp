
'use server';

/**
 * =============================================================================
 * COMMUNICATIONS TRIAGE ACTIONS (Server Actions)
 * =============================================================================
 *
 * Approve/Reject operations for AI Inbox triage workflow.
 *
 * @module services/communications-triage-actions
 * @enterprise ADR-214 - Communications Service Refactoring
 */

import { randomUUID } from 'crypto';
import { FieldValue as AdminFieldValue, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import type { Communication } from '@/types/crm';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateTaskId } from '@/services/enterprise-id.service';
import { getAdminFirestore } from '@/server/admin/admin-guards';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getCompanyWidePolicyAdmin, getProjectPolicyAdmin } from '@/services/assignment/AssignmentPolicyRepository';
import { resolveTaskDueInHours } from '@/services/assignment/AssignmentPolicyService';
import { logCommunicationApproved, logCommunicationRejected } from '@/lib/auth/audit';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { normalizeToISO, nowISO } from '@/lib/date-local';
import type { AuthContext } from '@/lib/auth/types';

const logger = createModuleLogger('COMMUNICATIONS_TRIAGE_ACTIONS');

// ============================================================================
// ERROR HELPERS (shared with communications.service.ts)
// ============================================================================

type ActionErrorCode = 'invalid_context' | 'not_found' | 'tenant_mismatch' | 'unknown';

function getErrorDetails(error: unknown): { message: string; stack?: string; cause?: unknown } {
  if (error instanceof Error) {
    const withCause = error as Error & { cause?: unknown };
    return { message: error.message, stack: error.stack, cause: withCause.cause };
  }
  return { message: 'Unknown error' };
}

function buildActionErrorMetadata(params: {
  errorId: string;
  companyId?: string;
  communicationId?: string;
  adminUid?: string;
  operationId?: string;
  error: unknown;
}) {
  const details = getErrorDetails(params.error);
  return {
    errorId: params.errorId,
    companyId: params.companyId,
    communicationId: params.communicationId,
    adminUid: params.adminUid,
    operationId: params.operationId,
    errorMessage: details.message,
    errorStack: details.stack,
    errorCause: details.cause,
  };
}

/**
 * 🔴 **Άνοιξε την επικοινωνία — αν επιτρέπεται**: συμφραζόμενα → ύπαρξη →
 * ιδιοκτησία, **μία φορά** για το approve και το reject (N.18 · CHECK 3.28)
 *
 * Boy Scout (N.0.2): οι δύο διαδρομές έγραφαν την ίδια **τετράδα** — έλεγχο
 * συμφραζομένων, άνοιγμα εγγράφου, έλεγχο ύπαρξης, έλεγχο μισθωτή — με μόνη
 * διαφορά το **όνομα της πράξης** μέσα στο μήνυμα καταγραφής. Προϋπάρχουσα
 * διπλοτυπία που την αποκάλυψε το `jscpd` μόλις άλλαξε το αρχείο.
 *
 * 🔑 Το κέρδος δεν είναι οι γραμμές: με δύο αντίγραφα, **η σειρά** ύπαρξη →
 * ιδιοκτησία μπορούσε να αποκλίνει σε ένα από τα δύο χωρίς κανένα test να το
 * δει (ADR-742 §7.1 — *ο κίνδυνος δεν είναι οι γραμμές, είναι η ΣΕΙΡΑ*).
 *
 * ⚠️ Το ίχνος ελέγχου **κρατά την αλήθεια** («belongs to different company»):
 * εκεί οφείλει (§3.4). Ό,τι φεύγει στον καλούντα είναι μόνο ο **κωδικός**.
 */
async function openOwnedCommunication(spec: {
  readonly action: string;
  readonly communicationId: string;
  readonly companyId: string;
  readonly adminUid: string;
  readonly operationId?: string;
  readonly errorId: string;
}): Promise<
  | { readonly ok: true; readonly snap: FirebaseFirestore.DocumentSnapshot }
  | { readonly ok: false; readonly code: ActionErrorCode }
> {
  const { action, communicationId, companyId, adminUid, operationId, errorId } = spec;
  const meta = (error: Error) =>
    buildActionErrorMetadata({ errorId, companyId, communicationId, adminUid, operationId, error });

  if (!companyId || !adminUid) {
    logger.error(`Invalid context for ${action}`, meta(new Error('Missing companyId or adminUid')));
    return { ok: false, code: 'invalid_context' };
  }

  const snap = await getAdminFirestore()
    .collection(COLLECTIONS.MESSAGES)
    .doc(communicationId)
    .get();

  if (!snap.exists) {
    logger.error(`Communication not found on ${action}`, meta(new Error('Communication not found')));
    return { ok: false, code: 'not_found' };
  }

  // 🔴 ADR-742 §4 — και οι δύο διαδρομές έγραφαν σκέτο `!==` πάνω σε
  // `as Communication`: **ο τύπος υπόσχεται, η βάση δεν εγγυάται**. Επικοινωνία
  // χωρίς μισθωτή και διαχειριστής με χαλασμένο token ταίριαζαν.
  if (!isPayloadOwnedByCompany(snap.data(), companyId)) {
    logger.error(
      `Tenant isolation violation on ${action}`,
      meta(new Error('Communication belongs to different company')),
    );
    return { ok: false, code: 'tenant_mismatch' };
  }

  return { ok: true, snap };
}

// ============================================================================
// APPROVE COMMUNICATION
// ============================================================================

/**
 * Approve communication and create linked CRM task (idempotent)
 *
 * @enterprise Idempotent operation (safe to retry)
 * @audit Logs admin action
 */
export async function approveCommunication(
  communicationId: string,
  adminUid: string,
  companyId: string,
  operationId?: string
): Promise<
  | { ok: true; taskId: string }
  | { ok: false; errorId: string; code: ActionErrorCode }
> {
  const errorId = randomUUID();

  try {
    const opened = await openOwnedCommunication({
      action: 'approveCommunication', communicationId, companyId, adminUid, operationId, errorId,
    });
    if (!opened.ok) return { ok: false, errorId, code: opened.code };

    const data = opened.snap.data()!;
    const communication: Partial<Communication> & { id: string } = { id: opened.snap.id };

    for (const key in data) {
      const value = data[key];
      const iso = normalizeToISO(value);
      (communication as Record<string, unknown>)[key] = iso ?? value;
    }
    const comm = communication as Communication;

    // Idempotency: If already approved and has linkedTaskId, return existing
    if (comm.triageStatus === 'approved' && comm.linkedTaskId) {
      return { ok: true, taskId: comm.linkedTaskId };
    }

    const projectPolicy = comm.projectId
      ? await getProjectPolicyAdmin(companyId, comm.projectId)
      : null;
    const companyPolicy = projectPolicy ?? await getCompanyWidePolicyAdmin(companyId);
    const dueInHours = resolveTaskDueInHours(comm.intentAnalysis?.intentType, companyPolicy ?? undefined);
    const dueDate = AdminTimestamp.fromMillis(Date.now() + dueInHours * 60 * 60 * 1000);

    // Create CRM Task using Admin SDK
    const tasksRef = getAdminFirestore().collection(COLLECTIONS.TASKS);
    const taskData = {
      title: comm.subject || `Follow-up: ${comm.from}`,
      description: comm.content,
      type: 'follow_up',
      contactId: comm.contactId,
      companyId,
      status: 'pending',
      priority: comm.intentAnalysis?.needsTriage ? 'high' : 'medium',
      assignedTo: adminUid,
      dueDate,
      createdAt: AdminFieldValue.serverTimestamp(),
      updatedAt: AdminFieldValue.serverTimestamp(),
      completedAt: null,
      reminderSent: false,
    };

    const taskId = generateTaskId();
    await tasksRef.doc(taskId).set(taskData);

    // Update communication with approval + linkedTaskId — `snap.ref`, δηλαδή
    // **το έγγραφο που κρίθηκε**, όχι δεύτερη αναζήτηση με το ίδιο id.
    await opened.snap.ref.update({
      triageStatus: 'approved',
      linkedTaskId: taskId,
      updatedAt: AdminFieldValue.serverTimestamp()
    });

    // Audit log
    try {
      const authContext: AuthContext = {
        uid: adminUid,
        email: '',
        companyId,
        globalRole: 'company_admin',
        mfaEnrolled: false,
        isAuthenticated: true,
      };

      await logCommunicationApproved(
        authContext,
        communicationId,
        comm.triageStatus ?? 'pending',
        taskId,
        {
          assignedTo: adminUid,
          dueDate: normalizeToISO(dueDate) ?? nowISO(),
          priority: comm.intentAnalysis?.needsTriage ? 'high' : 'medium',
          contactId: comm.contactId,
          projectId: comm.projectId,
        },
        comm.intentAnalysis?.intentType
          ? `Approved communication with intent: ${comm.intentAnalysis.intentType}`
          : 'Communication approved'
      );
    } catch (auditError) {
      logger.error('Failed to log communication approval audit', { communicationId, taskId, error: auditError });
    }

    return { ok: true, taskId };
  } catch (error) {
    logger.error('Failed to approve communication',
      buildActionErrorMetadata({ errorId, companyId, communicationId, adminUid, operationId, error })
    );
    return { ok: false, errorId, code: 'unknown' };
  }
}

// ============================================================================
// REJECT COMMUNICATION
// ============================================================================

/**
 * Reject communication (mark as rejected, no task creation)
 *
 * @enterprise Simple status update
 * @audit Logs admin action
 */
export async function rejectCommunication(
  communicationId: string,
  companyId: string,
  adminUid: string,
  operationId?: string
): Promise<
  | { ok: true }
  | { ok: false; errorId: string; code: ActionErrorCode }
> {
  const errorId = randomUUID();

  try {
    const opened = await openOwnedCommunication({
      action: 'rejectCommunication', communicationId, companyId, adminUid, operationId, errorId,
    });
    if (!opened.ok) return { ok: false, errorId, code: opened.code };

    const data = opened.snap.data() as Communication | undefined;

    // `snap.ref` αντί για ξαναχτίσιμο της διαδρομής: το έγγραφο **που κρίθηκε**
    // είναι αυτό που ενημερώνεται — δεν υπάρχει δεύτερη αναζήτηση να αποκλίνει.
    await opened.snap.ref.update({
      triageStatus: 'rejected',
      updatedAt: AdminFieldValue.serverTimestamp()
    });

    // Audit log
    try {
      const authContext: AuthContext = {
        uid: adminUid,
        email: '',
        companyId,
        globalRole: 'company_admin',
        mfaEnrolled: false,
        isAuthenticated: true,
      };

      await logCommunicationRejected(
        authContext,
        communicationId,
        data?.triageStatus ?? 'pending',
        'Communication rejected by admin'
      );
    } catch (auditError) {
      logger.error('Failed to log communication rejection audit', { communicationId, error: auditError });
    }

    return { ok: true };
  } catch (error) {
    logger.error('Failed to reject communication',
      buildActionErrorMetadata({ errorId, companyId, communicationId, adminUid, operationId, error })
    );
    return { ok: false, errorId, code: 'unknown' };
  }
}
