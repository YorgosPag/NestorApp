import type { ObligationApprovalEntry, ObligationDocument, ObligationStatus } from '@/types/obligations';

const ALLOWED_TRANSITIONS: Record<ObligationStatus, ObligationStatus[]> = {
  draft: ['in-review'],
  'in-review': ['returned', 'approved'],
  returned: ['in-review', 'draft'],
  approved: ['issued', 'returned'],
  issued: ['superseded', 'archived', 'completed'],
  superseded: ['archived'],
  archived: [],
  completed: ['archived'],
};

const hasApprovedEntry = (approvals?: ObligationApprovalEntry[]): boolean => {
  if (!approvals || approvals.length === 0) {
    return false;
  }
  return approvals.some((entry) => entry.approved === true);
};

export interface ObligationTransitionValidation {
  isValid: boolean;
  errors: string[];
}

export const validateObligationStatusTransition = (
  document: ObligationDocument,
  targetStatus: ObligationStatus
): ObligationTransitionValidation => {
  const errors: string[] = [];
  const currentStatus = document.status;

  if (currentStatus === targetStatus) {
    return { isValid: true, errors };
  }

  const allowedTargets = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowedTargets.includes(targetStatus)) {
    errors.push(`Transition not allowed: ${currentStatus} -> ${targetStatus}`);
  }

  if (targetStatus === 'in-review') {
    if (!document.assigneeId && !document.assigneeName) {
      errors.push('Assignee is required before moving to in-review.');
    }
    if (!document.dueDate) {
      errors.push('Due date is required before moving to in-review.');
    }
  }

  if (targetStatus === 'approved') {
    if (!hasApprovedEntry(document.approvals)) {
      errors.push('At least one approved entry is required before moving to approved.');
    }
  }

  if (targetStatus === 'issued') {
    if (!document.docNumber || document.docNumber.trim().length === 0) {
      errors.push('Document number is required before issuing.');
    }
    if (document.revision === undefined || document.revision === null) {
      errors.push('Revision is required before issuing.');
    }
    if (!hasApprovedEntry(document.approvals)) {
      errors.push('At least one approved entry is required before issuing.');
    }
  }

  if (targetStatus === 'superseded') {
    if (!document.revisionNotes || document.revisionNotes.trim().length === 0) {
      errors.push('Revision notes are required before marking as superseded.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
