/**
 * =============================================================================
 * File Approval Service — Document approval workflows
 * =============================================================================
 *
 * Multi-step approval chains for documents requiring sign-off.
 * Supports sequential approvers, rejection with reason, and audit trail.
 *
 * @module services/file-approval.service
 * @enterprise ADR-191 Phase 3.3 — Approval Workflows
 */

import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FileAuditService } from './file-audit.service';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';

// ============================================================================
// TYPES
// ============================================================================

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface ApprovalStep {
  /** Approver user ID */
  approverId: string;
  /** Approver display name */
  approverName: string;
  /** Step order (1-based) */
  order: number;
  /** Current status */
  status: ApprovalStatus;
  /** Decision timestamp */
  decidedAt: Date | string | null;
  /** Rejection reason (if rejected) */
  reason: string | null;
}

export interface FileApproval {
  /** Document ID */
  id: string;
  /** File ID this approval belongs to */
  fileId: string;
  /** Company ID for tenant isolation */
  companyId: string;
  /** Who requested the approval */
  requestedBy: string;
  /** Requester display name */
  requestedByName: string;
  /** Overall status */
  status: ApprovalStatus;
  /** Approval steps (sequential) */
  steps: ApprovalStep[];
  /** Optional note from requester */
  note: string | null;
  /** Creation timestamp */
  createdAt: Date | string;
  /** Last update */
  updatedAt: Date | string | null;
}

export interface CreateApprovalInput {
  fileId: string;
  companyId: string;
  requestedBy: string;
  requestedByName: string;
  approvers: Array<{ id: string; name: string }>;
  note?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export const FileApprovalService = {
  /**
   * Create an approval workflow for a file
   */
  async createApproval(input: CreateApprovalInput): Promise<string> {
    const steps: ApprovalStep[] = input.approvers.map((a, i) => ({
      approverId: a.id,
      approverName: a.name,
      order: i + 1,
      status: i === 0 ? 'pending' : 'pending',
      decidedAt: null,
      reason: null,
    }));

    const docRef = await addDoc(collection(db, COLLECTIONS.FILE_APPROVALS), {
      fileId: input.fileId,
      companyId: input.companyId,
      requestedBy: input.requestedBy,
      requestedByName: input.requestedByName,
      status: 'pending',
      steps,
      note: input.note ?? null,
      createdAt: serverTimestamp(),
      updatedAt: null,
    });

    FileAuditService.log(input.fileId, 'approval_request', input.requestedBy, {
      approvalId: docRef.id,
      approverCount: input.approvers.length,
    }).catch(() => {});

    return docRef.id;
  },

  /**
   * Get all approvals for a file
   * 🏢 ADR-214 Phase 3: via FirestoreQueryService
   */
  async getFileApprovals(fileId: string): Promise<FileApproval[]> {
    const result = await firestoreQueryService.getAll<DocumentData>('FILE_APPROVALS', {
      constraints: [
        where('fileId', '==', fileId),
        orderBy('createdAt', 'desc'),
      ],
    });
    return result.documents as unknown as FileApproval[];
  },

  /**
   * Get pending approvals for a user (across all files)
   * 🏢 ADR-214 Phase 3: via FirestoreQueryService (auto tenant filter replaces manual companyId)
   */
  async getPendingForUser(userId: string, companyId: string): Promise<FileApproval[]> {
    const result = await firestoreQueryService.getAll<DocumentData>('FILE_APPROVALS', {
      constraints: [
        // companyId auto-injected by tenant filter
        where('status', '==', 'pending'),
      ],
    });
    // Filter client-side: current step's approver === userId
    return (result.documents as unknown as FileApproval[])
      .filter((a) => {
        const currentStep = a.steps.find((s) => s.status === 'pending');
        return currentStep?.approverId === userId;
      });
  },

  /**
   * Subscribe to approval updates for a file
   */
  subscribeToApprovals(
    fileId: string,
    callback: (approvals: FileApproval[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, COLLECTIONS.FILE_APPROVALS),
      where('fileId', '==', fileId),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as FileApproval[]);
    });
  },

  /**
   * Approve the current step
   */
  async approve(approvalId: string, userId: string): Promise<void> {
    const approvalRef = doc(db, COLLECTIONS.FILE_APPROVALS, approvalId);
    const q = query(
      collection(db, COLLECTIONS.FILE_APPROVALS),
      where('__name__', '==', approvalId)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;

    const data = snap.docs[0].data() as Omit<FileApproval, 'id'>;
    const steps = [...data.steps];

    // Find current pending step for this user
    const stepIdx = steps.findIndex(
      (s) => s.approverId === userId && s.status === 'pending'
    );
    if (stepIdx === -1) return;

    steps[stepIdx] = {
      ...steps[stepIdx],
      status: 'approved',
      decidedAt: new Date().toISOString(),
    };

    // Check if all steps are approved
    const allApproved = steps.every((s) => s.status === 'approved');

    await updateDoc(approvalRef, {
      steps,
      status: allApproved ? 'approved' : 'pending',
      updatedAt: serverTimestamp(),
    });

    FileAuditService.log(data.fileId, 'approval_approve', userId, {
      approvalId,
      step: stepIdx + 1,
      allApproved,
    }).catch(() => {});
  },

  /**
   * Reject the current step
   */
  async reject(
    approvalId: string,
    userId: string,
    reason: string
  ): Promise<void> {
    const approvalRef = doc(db, COLLECTIONS.FILE_APPROVALS, approvalId);
    const q = query(
      collection(db, COLLECTIONS.FILE_APPROVALS),
      where('__name__', '==', approvalId)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;

    const data = snap.docs[0].data() as Omit<FileApproval, 'id'>;
    const steps = [...data.steps];

    const stepIdx = steps.findIndex(
      (s) => s.approverId === userId && s.status === 'pending'
    );
    if (stepIdx === -1) return;

    steps[stepIdx] = {
      ...steps[stepIdx],
      status: 'rejected',
      decidedAt: new Date().toISOString(),
      reason,
    };

    await updateDoc(approvalRef, {
      steps,
      status: 'rejected',
      updatedAt: serverTimestamp(),
    });

    FileAuditService.log(data.fileId, 'approval_reject', userId, {
      approvalId,
      step: stepIdx + 1,
      reason,
    }).catch(() => {});
  },

  /**
   * Cancel an approval workflow
   */
  async cancel(approvalId: string, userId: string, fileId: string): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.FILE_APPROVALS, approvalId), {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    });

    FileAuditService.log(fileId, 'approval_cancel', userId, {
      approvalId,
    }).catch(() => {});
  },
};
