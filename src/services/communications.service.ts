
'use server';

import { db } from '@/lib/firebase';
import { randomUUID } from 'crypto';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  QueryConstraint,
  Timestamp,
  writeBatch,
  deleteDoc,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { FieldValue as AdminFieldValue, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import type { Communication, TriageStatus } from '@/types/crm';
import { TRIAGE_STATUSES } from '@/types/crm';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/server/admin/admin-guards';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getCompanyWidePolicyAdmin, getProjectPolicyAdmin } from '@/services/assignment/AssignmentPolicyRepository';
import { resolveTaskDueInHours } from '@/services/assignment/AssignmentPolicyService';

// 🏢 ENTERPRISE: Centralized collection configuration
// 🔄 2026-01-17: Changed from COMMUNICATIONS to MESSAGES (COMMUNICATIONS collection deprecated)
const COMMUNICATIONS_COLLECTION = COLLECTIONS.MESSAGES;

// ============================================================================
// LOGGER
// ============================================================================

const logger = createModuleLogger('COMMUNICATIONS_SERVICE');

// ============================================================================
// ERROR HELPERS
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

// 🏢 ENTERPRISE: Type-safe document transformation
const transformCommunication = (docSnapshot: QueryDocumentSnapshot<DocumentData>): Communication => {
    const data = docSnapshot.data();
    const communication: Partial<Communication> & { id: string } = { id: docSnapshot.id };

    for (const key in data) {
        const value = data[key];
        if (value instanceof Timestamp) {
            (communication as Record<string, unknown>)[key] = value.toDate().toISOString();
        } else {
            (communication as Record<string, unknown>)[key] = value;
        }
    }
    return communication as Communication;
};

// ============================================================================
// 🏢 ENTERPRISE: Shared triage query helper (Admin SDK)
// ============================================================================

const TRIAGE_STATUS_VALUES = Object.values(TRIAGE_STATUSES);

async function fetchTriageCommunications(params: {
  companyId?: string;  // Optional for global admin access
  status?: TriageStatus;
}): Promise<Communication[]> {
  const adminDb = getAdminFirestore();
  const messagesRef = adminDb.collection(COLLECTIONS.MESSAGES);

  // 🏢 ENTERPRISE: Global Admin Support
  // If companyId is undefined/null, fetch ALL messages (global admin view)
  const isGlobalAccess = !params.companyId;

  let snapshots;
  if (isGlobalAccess) {
    // Global admin: fetch all messages without company filter
    snapshots = params.status
      ? [await messagesRef.where('triageStatus', '==', params.status).get()]
      : await Promise.all(
          TRIAGE_STATUS_VALUES.map((status) =>
            messagesRef.where('triageStatus', '==', status).get()
          )
        );
  } else {
    // Tenant-scoped: filter by companyId
    snapshots = params.status
      ? [await messagesRef.where('companyId', '==', params.companyId).where('triageStatus', '==', params.status).get()]
      : await Promise.all(
          TRIAGE_STATUS_VALUES.map((status) =>
            messagesRef
              .where('companyId', '==', params.companyId)
              .where('triageStatus', '==', status)
              .get()
          )
        );
  }

  const communications = snapshots.flatMap((snapshot) =>
    snapshot.docs.map((doc) => {
      const data = doc.data();
      const communication: Partial<Communication> & { id: string } = { id: doc.id };

      for (const key in data) {
        const value = data[key];
        if (value && typeof value === 'object' && 'toDate' in value) {
          (communication as Record<string, unknown>)[key] = value.toDate().toISOString();
        } else {
          (communication as Record<string, unknown>)[key] = value;
        }
      }

      return communication as Communication;
    })
  );

  const sorted = communications.sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return dateB - dateA;
  });

  return sorted;
}

export async function addCommunication(communicationData: Omit<Communication, 'id' | 'createdAt' | 'updatedAt'>) {
  try {
    const docRef = await addDoc(collection(db, COMMUNICATIONS_COLLECTION), {
      ...communicationData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { id: docRef.id, success: true };
  } catch (error) {
    // Error logging removed //('Σφάλμα κατά την προσθήκη επικοινωνίας:', error);
    throw error;
  }
}

export async function getCommunicationsByContact(contactId: string): Promise<Communication[]> {
  try {
    const q = query(
      collection(db, COMMUNICATIONS_COLLECTION),
      where('contactId', '==', contactId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(transformCommunication);
  } catch (error) {
    // Error logging removed //('Σφάλμα κατά την ανάκτηση επικοινωνιών:', error);
    throw error;
  }
}

export async function updateCommunicationStatus(communicationId: string, status: Communication['status']) {
  try {
    const commRef = doc(db, COMMUNICATIONS_COLLECTION, communicationId);
    await updateDoc(commRef, {
      status,
      updatedAt: serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    // Error logging removed //('Σφάλμα κατά την ενημέρωση επικοινωνίας:', error);
    throw error;
  }
}

// ΝΕΑ ΣΥΝΑΡΤΗΣΗ: Διαγραφή όλων των επικοινωνιών
export async function deleteAllCommunications(): Promise<{ success: boolean; deletedCount: number }> {
    try {
        const querySnapshot = await getDocs(collection(db, COMMUNICATIONS_COLLECTION));
        const batch = writeBatch(db);
        let deletedCount = 0;

        querySnapshot.forEach((doc) => {
            batch.delete(doc.ref);
            deletedCount++;
        });

        await batch.commit();
        return { success: true, deletedCount };
    } catch (error) {
        // Error logging removed //('Σφάλμα κατά τη μαζική διαγραφή επικοινωνιών:', error);
        throw error;
    }
}

// ============================================================================
// 🏢 ENTERPRISE: AI INBOX SERVER ACTIONS (Stage 2)
// ============================================================================

/**
 * Get pending communications for AI Inbox triage queue
 *
 * @param companyId - Company ID for tenant isolation
 * @returns Array of communications with triageStatus="pending"
 *
 * @enterprise Tenant-scoped query, server-side only
 * @created 2026-02-03 - Stage 2: Real Data + Actions
 */
export async function getPendingTriageCommunications(
  companyId: string,
  operationId?: string
): Promise<
  | { ok: true; data: Communication[] }
  | { ok: false; errorId: string; code: ActionErrorCode }
> {
  return getTriageCommunications(companyId, operationId, TRIAGE_STATUSES.PENDING);
}

/**
 * Get triage communications for AI Inbox (optional status filter)
 *
 * @param companyId - Company ID for tenant isolation (undefined = global admin access)
 * @param status - Optional triage status filter
 * @returns Array of communications in triage workflow
 *
 * @enterprise Tenant-scoped query OR global admin access (if companyId is undefined)
 */
export async function getTriageCommunications(
  companyId: string | undefined,
  operationId?: string,
  status?: TriageStatus
): Promise<
  | { ok: true; data: Communication[] }
  | { ok: false; errorId: string; code: ActionErrorCode }
> {
  const errorId = randomUUID();

  // 🏢 ENTERPRISE: Global Admin Support
  // companyId undefined = global admin access (all companies)
  const isGlobalAccess = !companyId;

  try {
    logger.info('Fetching triage communications', {
      companyId: companyId || 'GLOBAL_ACCESS',
      status,
      isGlobalAccess,
    });
    const data = await fetchTriageCommunications({ companyId, status });
    return { ok: true, data };
  } catch (error) {
    logger.error(
      'Failed to fetch triage communications',
      buildActionErrorMetadata({ errorId, companyId: companyId || 'GLOBAL_ACCESS', operationId, error })
    );
    return { ok: false, errorId, code: 'unknown' };
  }
}

/**
 * Get triage summary stats for AI Inbox
 *
 * @param companyId - Company ID for tenant isolation (undefined = global admin access)
 * @returns Counts per triage status
 *
 * @enterprise Tenant-scoped query OR global admin access (if companyId is undefined)
 */
export async function getTriageStats(
  companyId: string | undefined,
  operationId?: string
): Promise<
  | { ok: true; data: { total: number; pending: number; approved: number; rejected: number; reviewed: number } }
  | { ok: false; errorId: string; code: ActionErrorCode }
> {
  const errorId = randomUUID();

  // 🏢 ENTERPRISE: Global Admin Support - companyId undefined = all companies
  const isGlobalAccess = !companyId;

  try {
    logger.info('Fetching triage stats', {
      companyId: companyId || 'GLOBAL_ACCESS',
      isGlobalAccess,
    });

    const statusEntries: Array<{ key: keyof typeof TRIAGE_STATUSES; value: string | undefined }> = [
      { key: 'PENDING', value: TRIAGE_STATUSES.PENDING },
      { key: 'APPROVED', value: TRIAGE_STATUSES.APPROVED },
      { key: 'REJECTED', value: TRIAGE_STATUSES.REJECTED },
      { key: 'REVIEWED', value: TRIAGE_STATUSES.REVIEWED },
    ];

    const invalidStatus = statusEntries.find(
      (entry) => typeof entry.value !== 'string' || entry.value.trim().length === 0
    );

    if (invalidStatus) {
      logger.error(
        'Invalid triage status configuration',
        buildActionErrorMetadata({
          errorId,
          companyId: companyId || 'GLOBAL_ACCESS',
          operationId,
          error: new Error(`Invalid TRIAGE_STATUSES.${invalidStatus.key}`),
        })
      );
      return { ok: false, errorId, code: 'invalid_context' };
    }

    const communications = await fetchTriageCommunications({ companyId });
    const counts = communications.reduce(
      (acc, comm) => {
        switch (comm.triageStatus) {
          case TRIAGE_STATUSES.PENDING:
            acc.pending += 1;
            break;
          case TRIAGE_STATUSES.APPROVED:
            acc.approved += 1;
            break;
          case TRIAGE_STATUSES.REJECTED:
            acc.rejected += 1;
            break;
          case TRIAGE_STATUSES.REVIEWED:
            acc.reviewed += 1;
            break;
          default:
            break;
        }
        return acc;
      },
      { pending: 0, approved: 0, rejected: 0, reviewed: 0 }
    );

    const total = counts.pending + counts.approved + counts.rejected + counts.reviewed;

    return {
      ok: true,
      data: {
        total,
        pending: counts.pending,
        approved: counts.approved,
        rejected: counts.rejected,
        reviewed: counts.reviewed
      }
    };
  } catch (error) {
    logger.error(
      'Failed to fetch triage stats',
      buildActionErrorMetadata({ errorId, companyId: companyId || 'GLOBAL_ACCESS', operationId, error })
    );
    return { ok: false, errorId, code: 'unknown' };
  }
}

/**
 * Approve communication and create linked CRM task (idempotent)
 *
 * @param communicationId - Communication ID to approve
 * @param adminUid - Admin user ID (from auth context)
 * @returns Success status with task ID
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
      buildActionErrorMetadata({
        errorId,
        companyId,
        communicationId,
        adminUid,
        operationId,
        error: new Error('Missing companyId or adminUid'),
      })
    );
    return { ok: false, errorId, code: 'invalid_context' };
  }

  try {
    // 🏢 ENTERPRISE: Use Firebase Admin SDK
    const adminDb = getAdminFirestore();
    const commDoc = await adminDb.collection(COLLECTIONS.MESSAGES).doc(communicationId).get();

    if (!commDoc.exists) {
      logger.error(
        'Communication not found on approveCommunication',
        buildActionErrorMetadata({
          errorId,
          companyId,
          communicationId,
          adminUid,
          operationId,
          error: new Error('Communication not found'),
        })
      );
      return { ok: false, errorId, code: 'not_found' };
    }

    const data = commDoc.data()!;
    const communication: Partial<Communication> & { id: string } = { id: commDoc.id };

    // Convert Admin Timestamps to ISO strings
    for (const key in data) {
      const value = data[key];
      if (value && typeof value === 'object' && 'toDate' in value) {
        (communication as Record<string, unknown>)[key] = value.toDate().toISOString();
      } else {
        (communication as Record<string, unknown>)[key] = value;
      }
    }
    const comm = communication as Communication;

    if (comm.companyId !== companyId) {
      logger.error(
        'Tenant isolation violation on approveCommunication',
        buildActionErrorMetadata({
          errorId,
          companyId,
          communicationId,
          adminUid,
          operationId,
          error: new Error('Communication belongs to different company'),
        })
      );
      return { ok: false, errorId, code: 'tenant_mismatch' };
    }

    // 2. Idempotency: If already approved and has linkedTaskId, return existing task ID
    if (comm.triageStatus === 'approved' && comm.linkedTaskId) {
      return { ok: true, taskId: comm.linkedTaskId };
    }

    const projectPolicy = comm.projectId
      ? await getProjectPolicyAdmin(companyId, comm.projectId)
      : null;
    const companyPolicy = projectPolicy ?? await getCompanyWidePolicyAdmin(companyId);
    const dueInHours = resolveTaskDueInHours(comm.intentAnalysis?.intentType, companyPolicy ?? undefined);
    const dueDate = AdminTimestamp.fromMillis(Date.now() + dueInHours * 60 * 60 * 1000);

    // 3. Create CRM Task using Admin SDK (STOP 5 fix - no client-side repository)
    const tasksRef = adminDb.collection(COLLECTIONS.TASKS);

    const taskData = {
      title: comm.subject || `Follow-up: ${comm.from}`,
      description: comm.content,
      type: 'follow_up',
      contactId: comm.contactId,
      companyId,
      status: 'pending',
      priority: comm.intentAnalysis?.needsTriage ? 'high' : 'medium',
      assignedTo: adminUid, // TODO: Use AssignmentPolicyService to resolve assignee
      dueDate,
      createdAt: AdminFieldValue.serverTimestamp(),
      updatedAt: AdminFieldValue.serverTimestamp(),
      completedAt: null,
      reminderSent: false,
    };

    // 🏢 ENTERPRISE: Server-side task creation with Admin SDK
    const taskDoc = await tasksRef.add(taskData);
    const taskId = taskDoc.id;

    // 4. Update communication with approval + linkedTaskId (Admin SDK)
    await adminDb.collection(COLLECTIONS.MESSAGES).doc(communicationId).update({
      triageStatus: 'approved',
      linkedTaskId: taskId,
      updatedAt: AdminFieldValue.serverTimestamp()
    });

    return { ok: true, taskId };
  } catch (error) {
    logger.error(
      'Failed to approve communication',
      buildActionErrorMetadata({
        errorId,
        companyId,
        communicationId,
        adminUid,
        operationId,
        error,
      })
    );
    return { ok: false, errorId, code: 'unknown' };
  }
}

/**
 * Reject communication (mark as rejected, no task creation)
 *
 * @param communicationId - Communication ID to reject
 * @returns Success status
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
    logger.error(
      'Invalid context for rejectCommunication',
      buildActionErrorMetadata({
        errorId,
        companyId,
        communicationId,
        adminUid,
        operationId,
        error: new Error('Missing companyId or adminUid'),
      })
    );
    return { ok: false, errorId, code: 'invalid_context' };
  }

  try {
    // 🏢 ENTERPRISE: Use Firebase Admin SDK
    const adminDb = getAdminFirestore();
    const commDoc = await adminDb.collection(COLLECTIONS.MESSAGES).doc(communicationId).get();

    if (!commDoc.exists) {
      logger.error(
        'Communication not found on rejectCommunication',
        buildActionErrorMetadata({
          errorId,
          companyId,
          communicationId,
          adminUid,
          operationId,
          error: new Error('Communication not found'),
        })
      );
      return { ok: false, errorId, code: 'not_found' };
    }

    const data = commDoc.data() as Communication | undefined;
    if (data?.companyId !== companyId) {
      logger.error(
        'Tenant isolation violation on rejectCommunication',
        buildActionErrorMetadata({
          errorId,
          companyId,
          communicationId,
          adminUid,
          operationId,
          error: new Error('Communication belongs to different company'),
        })
      );
      return { ok: false, errorId, code: 'tenant_mismatch' };
    }

    await adminDb.collection(COLLECTIONS.MESSAGES).doc(communicationId).update({
      triageStatus: 'rejected',
      updatedAt: AdminFieldValue.serverTimestamp()
    });

    return { ok: true };
  } catch (error) {
    logger.error(
      'Failed to reject communication',
      buildActionErrorMetadata({
        errorId,
        companyId,
        communicationId,
        adminUid,
        operationId,
        error,
      })
    );
    return { ok: false, errorId, code: 'unknown' };
  }
}
