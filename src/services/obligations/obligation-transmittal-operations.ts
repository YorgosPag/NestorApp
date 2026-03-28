/**
 * 📄 OBLIGATION TRANSMITTAL OPERATIONS — Issue + delivery proof
 *
 * Standalone function for the issueWithTransmittal workflow.
 * Extracted from FirestoreObligationsRepository (Google SRP).
 */

import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { generateObligationId, generateTransmittalId } from '@/services/enterprise-id.service';
import { auth, db } from '@/lib/firebase';
import { stripUndefinedDeep } from '@/utils/firestore-sanitize';
import { createModuleLogger } from '@/lib/telemetry';
import { COLLECTIONS } from '@/config/firestore-collections';
import { validateObligationStatusTransition } from './workflow-rules';
import { exportObligationToPDF } from '@/services/pdf';
import { createAuditEvent, toDeliveryProofEntry } from './obligation-normalizers';
import type {
  ObligationDocument,
  ObligationIssueRequest,
  ObligationIssueResult,
  ObligationTransmittal,
  ObligationTransmittalRecipient,
  ObligationDistributionEntry,
  ObligationIssueLogEntry,
  ObligationWorkflowTransition,
  ObligationAuditEvent,
} from '@/types/obligations';

const logger = createModuleLogger('ObligationTransmittalOperations');

// ── Crypto helpers ──

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

const sha256Hex = async (payload: Uint8Array): Promise<string> => {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error('CRYPTO_ERROR: Web Crypto API is not available for issue proof generation');
  }

  const digestBuffer =
    payload.byteOffset === 0 && payload.byteLength === payload.buffer.byteLength
      ? payload.buffer
      : payload.slice().buffer;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', digestBuffer as ArrayBuffer);
  return bytesToHex(new Uint8Array(digest));
};

// ── PDF filename builder ──

const buildIssuedPdfFileName = (document: ObligationDocument): string => {
  const docNumber = document.docNumber?.trim() || document.id;
  const revision = document.revision ?? 1;
  const normalizedProjectName =
    document.projectName.trim().replace(/\s+/g, '-').toLowerCase() || 'project';
  return `${docNumber.toLowerCase()}_r${revision}_${normalizedProjectName}.pdf`;
};

// ── Dependencies interface (Dependency Injection) ──

interface TransmittalDeps {
  getById: (id: string) => Promise<ObligationDocument | null>;
}

// ── Main operation ──

export async function executeIssueWithTransmittal(
  request: ObligationIssueRequest,
  deps: TransmittalDeps,
): Promise<ObligationIssueResult | null> {
  try {
    const current = await deps.getById(request.obligationId);
    if (!current) return null;

    if (!request.recipients || request.recipients.length === 0) {
      throw new Error('VALIDATION_ERROR: At least one recipient is required to issue a transmittal');
    }

    const transitionValidation = validateObligationStatusTransition(current, 'issued');
    if (!transitionValidation.isValid) {
      throw new Error(`INVALID_STATUS_TRANSITION: ${transitionValidation.errors.join(' | ')}`);
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('AUTHENTICATION_ERROR: User must be logged in to issue obligations');
    }

    const tokenResult = await currentUser.getIdTokenResult();
    const userCompanyId = tokenResult.claims?.companyId as string | undefined;
    const companyId = current.companyId || userCompanyId;

    if (!companyId) {
      throw new Error('AUTHORIZATION_ERROR: Missing companyId for transmittal issuance');
    }

    const now = new Date();
    const pdfData = await exportObligationToPDF(current);
    const pdfHash = await sha256Hex(pdfData);
    const fileName = buildIssuedPdfFileName(current);

    const recipients = request.recipients.map(
      (recipient: ObligationTransmittalRecipient) => ({ ...recipient }),
    );
    const deliveryProof = recipients.map(
      (recipient: ObligationTransmittalRecipient) => toDeliveryProofEntry(recipient, now),
    );

    const transmittalPayload: Omit<ObligationTransmittal, 'id'> = {
      companyId,
      obligationId: current.id,
      projectId: current.projectId !== undefined ? String(current.projectId) : undefined,
      buildingId: current.buildingId,
      docNumber: current.docNumber || current.id,
      revision: current.revision ?? 1,
      issuedAt: now,
      issuedBy: currentUser.uid,
      message: request.message,
      recipients,
      deliveryProof,
      issueProof: {
        algorithm: 'sha256',
        pdfSha256: pdfHash,
        generatedAt: now,
        fileName,
        byteSize: pdfData.byteLength,
      },
      createdAt: now,
      updatedAt: now,
    };

    // 🏢 ADR-210: Enterprise ID generation — setDoc with pre-generated ID
    const transmittalId = generateTransmittalId();
    await setDoc(
      doc(db, COLLECTIONS.OBLIGATION_TRANSMITTALS, transmittalId),
      stripUndefinedDeep({
        ...transmittalPayload,
        id: transmittalId,
        createdBy: currentUser.uid,
      }),
    );

    const issueLogEntry: ObligationIssueLogEntry = {
      id: generateObligationId(),
      transmittalId,
      issuedAt: now,
      issuedBy: currentUser.uid,
      revision: current.revision ?? 1,
      docNumber: current.docNumber || current.id,
      recipientCount: recipients.length,
      proofHash: pdfHash,
    };

    const workflowTransitions: ObligationWorkflowTransition[] = [
      ...(current.workflowTransitions || []),
      {
        fromStatus: current.status,
        toStatus: 'issued',
        changedAt: now,
        changedBy: currentUser.uid,
        reason: 'Issued via obligation transmittal',
      },
    ];

    const auditTrail: ObligationAuditEvent[] = [
      ...(current.auditTrail || []),
      createAuditEvent(
        'status-transition',
        currentUser.uid,
        `Status changed from ${current.status} to issued: Issued via obligation transmittal`,
      ),
      createAuditEvent('issued', currentUser.uid, `Issued obligation with transmittal ${transmittalId}`),
      createAuditEvent('transmittal-created', currentUser.uid, `Created transmittal ${transmittalId}`),
    ];

    const nextDistribution: ObligationDistributionEntry[] = [
      ...(current.distribution || []),
      ...deliveryProof,
    ];

    const nextIssueLog: ObligationIssueLogEntry[] = [
      ...(current.issueLog || []),
      issueLogEntry,
    ];

    const obligationRef = doc(db, COLLECTIONS.OBLIGATIONS, current.id);
    await updateDoc(
      obligationRef,
      stripUndefinedDeep({
        status: 'issued',
        workflowTransitions,
        auditTrail,
        distribution: nextDistribution,
        issueLog: nextIssueLog,
        updatedAt: now,
      }),
    );

    return {
      transmittal: { id: transmittalId, ...transmittalPayload },
      issueLogEntry,
      distribution: deliveryProof,
      pdfData,
    };
  } catch (error) {
    logger.error('Error issuing obligation transmittal', { error, request });
    return null;
  }
}
