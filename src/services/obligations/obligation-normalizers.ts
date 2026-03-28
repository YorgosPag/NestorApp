/**
 * 📄 OBLIGATION NORMALIZERS — Pure normalization functions
 *
 * Transforms raw Firestore data → typed ObligationDocument / ObligationTransmittal.
 * Extracted from InMemoryObligationsRepository (Google SRP).
 */

import { generateObligationId } from '@/services/enterprise-id.service';
import { normalizeToDate } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import type {
  ObligationDocument,
  ObligationAuditEvent,
  ObligationTransmittal,
  ObligationTransmittalRecipient,
  ObligationDistributionEntry,
  ObligationIssueLogEntry,
  ObligationWorkflowTransition,
} from '@/types/obligations';
import { DEFAULT_TEMPLATE_SECTIONS } from '@/types/obligation-services';

const logger = createModuleLogger('ObligationNormalizers');

// ── Date helpers (ADR-218 Phase 2: delegate to centralised normalizeToDate) ──

export const toDateValue = (value: unknown): Date =>
  normalizeToDate(value) ?? new Date();

export const toOptionalDate = (value: unknown): Date | undefined =>
  normalizeToDate(value) ?? undefined;

// ── Audit helper ──

export const createAuditEvent = (
  action: ObligationAuditEvent['action'],
  actor: string,
  details: string,
): ObligationAuditEvent => ({
  id: generateObligationId(),
  action,
  actor,
  occurredAt: new Date(),
  details,
});

// ── Array-level normalizers ──

export const normalizeDistributionEntries = (
  distribution: ObligationDocument['distribution'],
): ObligationDistributionEntry[] | undefined => {
  if (!distribution || distribution.length === 0) return undefined;

  return distribution.map((entry) => ({
    ...entry,
    deliveredAt: toOptionalDate(entry.deliveredAt),
  }));
};

export const normalizeIssueLogEntries = (
  issueLog: ObligationDocument['issueLog'],
): ObligationIssueLogEntry[] | undefined => {
  if (!issueLog || issueLog.length === 0) return undefined;

  return issueLog.map((entry) => ({
    ...entry,
    issuedAt: toDateValue(entry.issuedAt),
  }));
};

export const normalizeWorkflowTransitions = (
  transitions: ObligationDocument['workflowTransitions'],
): ObligationWorkflowTransition[] | undefined => {
  if (!transitions || transitions.length === 0) return undefined;

  return transitions.map((transition) => ({
    ...transition,
    changedAt: toDateValue(transition.changedAt),
  }));
};

export const normalizeAuditTrail = (
  auditTrail: ObligationDocument['auditTrail'],
): ObligationAuditEvent[] | undefined => {
  if (!auditTrail || auditTrail.length === 0) return undefined;

  return auditTrail.map((entry) => ({
    ...entry,
    occurredAt: toDateValue(entry.occurredAt),
  }));
};

// ── Delivery proof ──

export const toDeliveryProofEntry = (
  recipient: ObligationTransmittalRecipient,
  now: Date,
): ObligationDistributionEntry => {
  const isImmediateDelivery = recipient.channel === 'in-app';

  return {
    recipientName: recipient.recipientName,
    recipientEmail: recipient.recipientEmail,
    role: recipient.role,
    channel: recipient.channel,
    status: isImmediateDelivery ? 'delivered' : 'pending',
    deliveredAt: isImmediateDelivery ? now : undefined,
  };
};

// ── Document-level normalizers ──

export const normalizeTransmittalDocument = (
  id: string,
  data: Partial<ObligationTransmittal>,
): ObligationTransmittal => ({
  id,
  companyId: data.companyId || null,
  obligationId: data.obligationId || '',
  projectId: data.projectId,
  buildingId: data.buildingId,
  docNumber: data.docNumber || '',
  revision: typeof data.revision === 'number' ? data.revision : 1,
  issuedAt: toDateValue(data.issuedAt),
  issuedBy: data.issuedBy || 'system',
  message: data.message,
  recipients: data.recipients || [],
  deliveryProof: (data.deliveryProof || []).map((entry: ObligationDistributionEntry) => ({
    ...entry,
    deliveredAt: toOptionalDate(entry.deliveredAt),
  })),
  issueProof: {
    algorithm: data.issueProof?.algorithm || 'sha256',
    pdfSha256: data.issueProof?.pdfSha256 || '',
    generatedAt: toDateValue(data.issueProof?.generatedAt),
    fileName: data.issueProof?.fileName || '',
    byteSize: data.issueProof?.byteSize || 0,
  },
  createdAt: toDateValue(data.createdAt),
  updatedAt: toDateValue(data.updatedAt),
});

export const normalizeTransmittalDocumentSafe = (
  id: string,
  data: Partial<ObligationTransmittal>,
): ObligationTransmittal | null => {
  try {
    return normalizeTransmittalDocument(id, data);
  } catch (error) {
    logger.error('Error normalizing obligation transmittal document', {
      error,
      transmittalId: id,
    });
    return null;
  }
};

export const normalizeObligationDocument = (
  id: string,
  data: Partial<ObligationDocument>,
): ObligationDocument => {
  return {
    id,
    title: data.title || '',
    projectName: data.projectName || '',
    contractorCompany: data.contractorCompany || process.env.NEXT_PUBLIC_COMPANY_NAME || 'Contractor Company',
    owners: data.owners || [],
    createdAt: toDateValue(data.createdAt),
    updatedAt: toDateValue(data.updatedAt),
    status: data.status || 'draft',
    sections: data.sections || DEFAULT_TEMPLATE_SECTIONS,
    projectDetails: {
      location: data.projectDetails?.location || '',
      address: data.projectDetails?.address || '',
      plotNumber: data.projectDetails?.plotNumber,
      buildingPermitNumber: data.projectDetails?.buildingPermitNumber,
      contractDate: toOptionalDate(data.projectDetails?.contractDate),
      deliveryDate: toOptionalDate(data.projectDetails?.deliveryDate),
      notaryName: data.projectDetails?.notaryName,
    },
    tableOfContents: data.tableOfContents,
    companyId: data.companyId,
    projectId: data.projectId,
    buildingId: data.buildingId,
    companyDetails: data.companyDetails,
    projectInfo: data.projectInfo
      ? {
          ...data.projectInfo,
          startDate: toOptionalDate(data.projectInfo.startDate),
          endDate: toOptionalDate(data.projectInfo.endDate),
        }
      : undefined,
    docNumber: data.docNumber,
    revision: typeof data.revision === 'number' ? data.revision : 1,
    revisionNotes: data.revisionNotes,
    dueDate: toOptionalDate(data.dueDate),
    assigneeId: data.assigneeId,
    assigneeName: data.assigneeName,
    workflowTransitions: normalizeWorkflowTransitions(data.workflowTransitions),
    approvals: data.approvals,
    auditTrail: normalizeAuditTrail(data.auditTrail),
    distribution: normalizeDistributionEntries(data.distribution),
    issueLog: normalizeIssueLogEntries(data.issueLog),
    phaseBinding: data.phaseBinding,
    costBinding: data.costBinding,
  };
};

export const normalizeObligationDocumentSafe = (
  id: string,
  data: Partial<ObligationDocument>,
): ObligationDocument | null => {
  try {
    return normalizeObligationDocument(id, data);
  } catch (error) {
    logger.error('Error normalizing obligation document', {
      error,
      obligationId: id,
    });
    return null;
  }
};
