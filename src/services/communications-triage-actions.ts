
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
import { normalizeToISO } from '@/lib/date-local';
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

  if (!companyId || !adminUid) {
    logger.error(
      'Invalid context for approveCommunication',
      buildActionErrorMetadata({ errorId, companyId, communicationId, adminUid, operationId, error: new Error('Missing companyId or adminUid') })
    );
    return { ok: false, errorId, code: 'invalid_context' };
  }

  try {
    const adminDb = getAdminFirestore();
    const commDoc = await adminDb.collection(COLLECTIONS.MESSAGES).doc(communicationId).get();

    if (!commDoc.exists) {
      logger.error('Communication not found on approveCommunication',
        buildActionErrorMetadata({ errorId, companyId, communicationId, adminUid, operationId, error: new Error('Communication not found') })
      );
      return { ok: false, errorId, code: 'not_found' };
    }

    const data = commDoc.data()!;
    const communication: Partial<Communication> & { id: string } = { id: commDoc.id };

    for (const key in data) {
      const value = data[key];
      const iso = normalizeToISO(value);
      (communication as Record<string, unknown>)[key] = iso ?? value;
    }
    const comm = communication as Communication;

    if (comm.companyId !== companyId) {
      logger.error('Tenant isolation violation on approveCommunication',
        buildActionErrorMetadata({ errorId, companyId, communicationId, adminUid, operationId, error: new Error('Communication belongs to different company') })
      );
      return { ok: false, errorId, code: 'tenant_mismatch' };
    }

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
    const tasksRef = adminDb.collection(COLLECTIONS.TASKS);
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

    // Update communication with approval + linkedTaskId
    await adminDb.collection(COLLECTIONS.MESSAGES).doc(communicationId).update({
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
          dueDate: normalizeToISO(dueDate) ?? new Date().toISOString(),
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

  if (!companyId || !adminUid) {
    logger.error('Invalid context for rejectCommunication',
      buildActionErrorMetadata({ errorId, companyId, communicationId, adminUid, operationId, error: new Error('Missing companyId or adminUid') })
    );
    return { ok: false, errorId, code: 'invalid_context' };
  }

  try {
    const adminDb = getAdminFirestore();
    const commDoc = await adminDb.collection(COLLECTIONS.MESSAGES).doc(communicationId).get();

    if (!commDoc.exists) {
      logger.error('Communication not found on rejectCommunication',
        buildActionErrorMetadata({ errorId, companyId, communicationId, adminUid, operationId, error: new Error('Communication not found') })
      );
      return { ok: false, errorId, code: 'not_found' };
    }

    const data = commDoc.data() as Communication | undefined;
    if (data?.companyId !== companyId) {
      logger.error('Tenant isolation violation on rejectCommunication',
        buildActionErrorMetadata({ errorId, companyId, communicationId, adminUid, operationId, error: new Error('Communication belongs to different company') })
      );
      return { ok: false, errorId, code: 'tenant_mismatch' };
    }

    await adminDb.collection(COLLECTIONS.MESSAGES).doc(communicationId).update({
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
