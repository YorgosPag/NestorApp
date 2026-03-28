
'use server';

import { db } from '@/lib/firebase';
import { randomUUID } from 'crypto';
import {
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import type { Communication } from '@/types/crm';
import { TRIAGE_STATUSES, TRIAGE_STATUS_VALUES, type TriageStatus } from '@/constants/triage-statuses';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { generateMessageId } from '@/services/enterprise-id.service';
import { getAdminFirestore } from '@/server/admin/admin-guards';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { normalizeToISO } from '@/lib/date-local';

// ── Re-exports for backward compatibility ──────────
export { approveCommunication, rejectCommunication } from './communications-triage-actions';

// 🏢 ENTERPRISE: Centralized collection configuration
const COMMUNICATIONS_COLLECTION = COLLECTIONS.MESSAGES;

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

const resolveDateValue = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  if (value && typeof value === 'object' && 'toDate' in value) {
    const dateValue = (value as { toDate?: () => Date }).toDate?.();
    if (dateValue instanceof Date) return dateValue;
  }
  return new Date();
};

// ============================================================================
// SHARED TRIAGE QUERY HELPER (Admin SDK)
// ============================================================================

async function fetchTriageCommunications(params: {
  companyId?: string;
  status?: TriageStatus;
}): Promise<Communication[]> {
  const adminDb = getAdminFirestore();
  const messagesRef = adminDb.collection(COLLECTIONS.MESSAGES);
  const isGlobalAccess = !params.companyId;

  let snapshots;
  if (isGlobalAccess) {
    snapshots = params.status
      ? [await messagesRef.where('triageStatus', '==', params.status).get()]
      : await Promise.all(
          TRIAGE_STATUS_VALUES.map((status) =>
            messagesRef.where('triageStatus', '==', status).get()
          )
        );
  } else {
    if (params.status) {
      snapshots = [await messagesRef.where(FIELDS.COMPANY_ID, '==', params.companyId).where('triageStatus', '==', params.status).get()];
    } else {
      logger.info('📊 Fetching stats - running queries for each status', {
        companyId: params.companyId,
        statuses: TRIAGE_STATUS_VALUES
      });

      snapshots = await Promise.all(
        TRIAGE_STATUS_VALUES.map(async (status) => {
          const snapshot = await messagesRef
            .where(FIELDS.COMPANY_ID, '==', params.companyId)
            .where('triageStatus', '==', status)
            .get();
          logger.info(`📊 Query result for status "${status}"`, { count: snapshot.size });
          return snapshot;
        })
      );
    }
  }

  const communications = snapshots.flatMap((snapshot) =>
    snapshot.docs.map((doc) => {
      const data = doc.data();
      const communication: Partial<Communication> & { id: string } = { id: doc.id };
      for (const key in data) {
        const value = data[key];
        const iso = normalizeToISO(value);
        (communication as Record<string, unknown>)[key] = iso ?? value;
      }
      return communication as Communication;
    })
  );

  return communications.sort((a, b) => {
    return resolveDateValue(b.createdAt).getTime() - resolveDateValue(a.createdAt).getTime();
  });
}

// ============================================================================
// BASIC CRUD
// ============================================================================

export async function addCommunication(communicationData: Omit<Communication, 'id' | 'createdAt' | 'updatedAt'>) {
  const enterpriseId = generateMessageId();
  const docRef = doc(db, COMMUNICATIONS_COLLECTION, enterpriseId);
  await setDoc(docRef, {
    ...communicationData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return { id: enterpriseId, success: true };
}

export async function updateCommunicationStatus(communicationId: string, status: Communication['status']) {
  const commRef = doc(db, COMMUNICATIONS_COLLECTION, communicationId);
  await updateDoc(commRef, { status, updatedAt: serverTimestamp() });
  return { success: true };
}

// ============================================================================
// TRIAGE QUERIES
// ============================================================================

export async function getPendingTriageCommunications(
  companyId: string,
  operationId?: string
): Promise<
  | { ok: true; data: Communication[] }
  | { ok: false; errorId: string; code: ActionErrorCode }
> {
  return getTriageCommunications(companyId, operationId, TRIAGE_STATUSES.PENDING);
}

export async function getTriageCommunications(
  companyId: string | undefined,
  operationId?: string,
  status?: TriageStatus
): Promise<
  | { ok: true; data: Communication[] }
  | { ok: false; errorId: string; code: ActionErrorCode }
> {
  const errorId = randomUUID();

  try {
    logger.info('Fetching triage communications', {
      companyId: companyId || 'GLOBAL_ACCESS',
      status,
      isGlobalAccess: !companyId,
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

export async function getTriageStats(
  companyId: string | undefined,
  operationId?: string
): Promise<
  | { ok: true; data: { total: number; pending: number; approved: number; rejected: number; reviewed: number } }
  | { ok: false; errorId: string; code: ActionErrorCode }
> {
  const errorId = randomUUID();

  try {
    logger.info('Fetching triage stats', {
      companyId: companyId || 'GLOBAL_ACCESS',
      isGlobalAccess: !companyId,
    });

    const communications = await fetchTriageCommunications({ companyId });

    logger.info('📊 Stats calculation', {
      totalCommunications: communications.length,
      sample: communications.slice(0, 2).map(c => ({ id: c.id, triageStatus: c.triageStatus, from: c.from }))
    });

    const counts = communications.reduce(
      (acc, comm) => {
        switch (comm.triageStatus) {
          case TRIAGE_STATUSES.PENDING: acc.pending += 1; break;
          case TRIAGE_STATUSES.APPROVED: acc.approved += 1; break;
          case TRIAGE_STATUSES.REJECTED: acc.rejected += 1; break;
          case TRIAGE_STATUSES.REVIEWED: acc.reviewed += 1; break;
          default:
            logger.warn('Unknown triage status', { status: comm.triageStatus, commId: comm.id });
            break;
        }
        return acc;
      },
      { pending: 0, approved: 0, rejected: 0, reviewed: 0 }
    );

    const total = counts.pending + counts.approved + counts.rejected + counts.reviewed;
    logger.info('📊 Stats result', { total, ...counts });

    return { ok: true, data: { total, ...counts } };
  } catch (error) {
    logger.error(
      'Failed to fetch triage stats',
      buildActionErrorMetadata({ errorId, companyId: companyId || 'GLOBAL_ACCESS', operationId, error })
    );
    return { ok: false, errorId, code: 'unknown' };
  }
}
