/**
 * 📄 ENTERPRISE OBLIGATIONS REPOSITORY - PRODUCTION READY
 *
 * Αντικατέστησε το InMemoryObligationsRepository με επαγγελματικό FirestoreObligationsRepository.
 * Όλα τα δεδομένα προέρχονται από production βάση δεδομένων.
 */

import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  QueryConstraint,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type {
  ObligationDocument,
  ObligationTemplate,
  ObligationStatus,
  ObligationWorkflowTransition,
  ObligationAuditEvent,
  ObligationIssueRequest,
  ObligationIssueResult,
  ObligationTransmittal,
  ObligationTransmittalRecipient,
  ObligationDistributionEntry,
  ObligationIssueLogEntry,
} from '@/types/obligations';
import { DEFAULT_TEMPLATE_SECTIONS } from '@/types/obligation-services';
import type { IObligationsRepository, SearchFilters, ObligationStats } from './contracts';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { validateObligationStatusTransition } from './workflow-rules';
import { exportObligationToPDF } from '@/services/pdf';

const logger = createModuleLogger('FirestoreObligationsRepository');

const toDateValue = (value: unknown): Date => {
  if (value instanceof Date) return value;

  if (value && typeof value === 'object') {
    const candidate = value as {
      toDate?: () => Date;
      toMillis?: () => number;
      seconds?: number;
      nanoseconds?: number;
    };

    try {
      if (typeof candidate.toDate === 'function') {
        return candidate.toDate();
      }

      if (typeof candidate.toMillis === 'function') {
        return new Date(candidate.toMillis());
      }
    } catch {
      // Ignore malformed timestamp shapes and continue with fallbacks.
    }

    if (typeof candidate.seconds === 'number') {
      const millis = candidate.seconds * 1000 + Math.floor((candidate.nanoseconds ?? 0) / 1000000);
      return new Date(millis);
    }
  }

  return new Date();
};

const toOptionalDate = (value: unknown): Date | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  return toDateValue(value);
};

const stripUndefinedDeep = <T>(value: T): T => {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined) as T;
  }

  if (typeof value === 'object') {
    const sanitizedEntries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, stripUndefinedDeep(item)]);

    return Object.fromEntries(sanitizedEntries) as T;
  }

  return value;
};
const createAuditEvent = (
  action: ObligationAuditEvent['action'],
  actor: string,
  details: string
): ObligationAuditEvent => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  action,
  actor,
  occurredAt: new Date(),
  details,
});


const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const sha256Hex = async (payload: Uint8Array): Promise<string> => {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error('CRYPTO_ERROR: Web Crypto API is not available for issue proof generation');
  }

  const digestBuffer = payload.byteOffset === 0 && payload.byteLength === payload.buffer.byteLength
    ? payload.buffer
    : payload.slice().buffer;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', digestBuffer as ArrayBuffer);
  return bytesToHex(new Uint8Array(digest));
};

const buildIssuedPdfFileName = (document: ObligationDocument): string => {
  const docNumber = document.docNumber?.trim() || document.id;
  const revision = document.revision ?? 1;
  const normalizedProjectName = document.projectName.trim().replace(/\s+/g, '-').toLowerCase() || 'project';
  return `${docNumber.toLowerCase()}_r${revision}_${normalizedProjectName}.pdf`;
};

const normalizeDistributionEntries = (
  distribution: ObligationDocument['distribution']
): ObligationDistributionEntry[] | undefined => {
  if (!distribution || distribution.length === 0) {
    return undefined;
  }

  return distribution.map((entry) => ({
    ...entry,
    deliveredAt: toOptionalDate(entry.deliveredAt),
  }));
};

const normalizeIssueLogEntries = (
  issueLog: ObligationDocument['issueLog']
): ObligationIssueLogEntry[] | undefined => {
  if (!issueLog || issueLog.length === 0) {
    return undefined;
  }

  return issueLog.map((entry) => ({
    ...entry,
    issuedAt: toDateValue(entry.issuedAt),
  }));
};

const normalizeTransmittalDocument = (id: string, data: Partial<ObligationTransmittal>): ObligationTransmittal => ({
  id,
  companyId: data.companyId || '',
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

const normalizeTransmittalDocumentSafe = (
  id: string,
  data: Partial<ObligationTransmittal>
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

const toDeliveryProofEntry = (
  recipient: ObligationTransmittalRecipient,
  now: Date
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

const normalizeWorkflowTransitions = (
  transitions: ObligationDocument['workflowTransitions']
): ObligationWorkflowTransition[] | undefined => {
  if (!transitions || transitions.length === 0) {
    return undefined;
  }

  return transitions.map((transition) => ({
    ...transition,
    changedAt: toDateValue(transition.changedAt),
  }));
};

const normalizeAuditTrail = (
  auditTrail: ObligationDocument['auditTrail']
): ObligationAuditEvent[] | undefined => {
  if (!auditTrail || auditTrail.length === 0) {
    return undefined;
  }

  return auditTrail.map((entry) => ({
    ...entry,
    occurredAt: toDateValue(entry.occurredAt),
  }));
};

const normalizeObligationDocument = (id: string, data: Partial<ObligationDocument>): ObligationDocument => ({
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
});

const normalizeObligationDocumentSafe = (
  id: string,
  data: Partial<ObligationDocument>
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

export class FirestoreObligationsRepository implements IObligationsRepository {
  async getAll(): Promise<ObligationDocument[]> {
    try {
      const obligationsQuery = query(
        collection(db, COLLECTIONS.OBLIGATIONS),
        orderBy('updatedAt', 'desc')
      );

      const snapshot = await getDocs(obligationsQuery);
      return snapshot.docs
        .map((document) => normalizeObligationDocumentSafe(document.id, document.data() as Partial<ObligationDocument>))
        .filter((document): document is ObligationDocument => document !== null);
    } catch (error) {
      logger.error('Error fetching obligations from Firebase', { error });
      return [];
    }
  }

  async getById(id: string): Promise<ObligationDocument | null> {
    try {
      const docRef = doc(db, COLLECTIONS.OBLIGATIONS, id);
      const snapshot = await getDoc(docRef);

      if (!snapshot.exists()) {
        return null;
      }

      return normalizeObligationDocumentSafe(snapshot.id, snapshot.data() as Partial<ObligationDocument>);
    } catch (error) {
      logger.error('Error fetching obligation by ID from Firebase', { error });
      return null;
    }
  }

  async create(data: Partial<ObligationDocument>): Promise<ObligationDocument> {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('AUTHENTICATION_ERROR: User must be logged in to create obligations');
      }

      const tokenResult = await currentUser.getIdTokenResult();
      const userCompanyId = tokenResult.claims?.companyId as string | undefined;
      if (!userCompanyId) {
        throw new Error('AUTHORIZATION_ERROR: User is not assigned to a company');
      }

      const now = new Date();
      const newObligation: Omit<ObligationDocument, 'id'> = {
        title: data.title || '',
        projectName: data.projectName || '',
        contractorCompany: data.contractorCompany || process.env.NEXT_PUBLIC_COMPANY_NAME || 'Contractor Company',
        owners: data.owners || [],
        createdAt: now,
        updatedAt: now,
        status: 'draft',
        sections: data.sections || DEFAULT_TEMPLATE_SECTIONS,
        projectDetails: data.projectDetails || { location: '', address: '' },
        tableOfContents: data.tableOfContents,
        companyId: userCompanyId,
        projectId: data.projectId,
        buildingId: data.buildingId,
        companyDetails: data.companyDetails,
        projectInfo: data.projectInfo,
        docNumber: data.docNumber || `OBL-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`,
        revision: 1,
        revisionNotes: data.revisionNotes,
        dueDate: data.dueDate,
        assigneeId: data.assigneeId,
        assigneeName: data.assigneeName,
        workflowTransitions: [
          {
            fromStatus: 'draft',
            toStatus: 'draft',
            changedAt: now,
            changedBy: 'system',
            reason: 'Initial creation',
          },
        ],
        approvals: data.approvals,
        auditTrail: [createAuditEvent('created', 'system', 'Obligation created')],
        distribution: data.distribution,
        issueLog: data.issueLog,
        phaseBinding: data.phaseBinding,
        costBinding: data.costBinding,
      };

      const createPayload = stripUndefinedDeep({
        ...newObligation,
        createdBy: currentUser.uid,
      });
      const docRef = await addDoc(collection(db, COLLECTIONS.OBLIGATIONS), createPayload);

      return {
        id: docRef.id,
        ...newObligation,
      };
    } catch (error) {
      logger.error('Error creating obligation in Firebase', {
        error,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async update(id: string, data: Partial<ObligationDocument>): Promise<ObligationDocument | null> {
    try {
      const current = await this.getById(id);
      if (!current) {
        return null;
      }

      const now = new Date();
      const auditTrail = [
        ...(current.auditTrail || []),
        createAuditEvent('updated', 'system', 'Obligation updated'),
      ];

      const updateData: Partial<ObligationDocument> = {
        ...data,
        updatedAt: now,
        auditTrail,
      };

      const docRef = doc(db, COLLECTIONS.OBLIGATIONS, id);
      const updatePayload = stripUndefinedDeep(updateData);
      await updateDoc(docRef, updatePayload);

      return await this.getById(id);
    } catch (error) {
      logger.error('Error updating obligation in Firebase', { error });
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const docRef = doc(db, COLLECTIONS.OBLIGATIONS, id);
      await deleteDoc(docRef);
      return true;
    } catch (error) {
      logger.error('Error deleting obligation from Firebase', { error });
      return false;
    }
  }

  async bulkDelete(ids: string[]): Promise<number> {
    try {
      let deletedCount = 0;
      for (const id of ids) {
        const success = await this.delete(id);
        if (success) {
          deletedCount += 1;
        }
      }
      return deletedCount;
    } catch (error) {
      logger.error('Error bulk deleting obligations from Firebase', { error });
      return 0;
    }
  }

  async duplicate(id: string): Promise<ObligationDocument | null> {
    try {
      const original = await this.getById(id);
      if (!original) return null;

      const duplicate: Omit<ObligationDocument, 'id'> = {
        ...original,
        title: `${original.title} - Αντίγραφο`,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
        revision: 1,
        revisionNotes: 'Duplicated from source document',
        workflowTransitions: [
          {
            fromStatus: 'draft',
            toStatus: 'draft',
            changedAt: new Date(),
            changedBy: 'system',
            reason: 'Document duplicated',
          },
        ],
        auditTrail: [createAuditEvent('created', 'system', `Duplicated from obligation ${original.id}`)],
        sections: original.sections.map((section) => ({
          ...section,
          id: `${section.id}-copy-${Date.now()}`,
        })),
      };

      return await this.create(duplicate);
    } catch (error) {
      logger.error('Error duplicating obligation in Firebase', { error });
      return null;
    }
  }

  async updateStatus(
    id: string,
    status: ObligationStatus,
    transition?: Pick<ObligationWorkflowTransition, 'changedBy' | 'reason'>
  ): Promise<boolean> {
    try {
      const current = await this.getById(id);
      if (!current) {
        return false;
      }

      const validation = validateObligationStatusTransition(current, status);
      if (!validation.isValid) {
        logger.warn('Rejected invalid obligation status transition', {
          obligationId: id,
          fromStatus: current.status,
          toStatus: status,
          errors: validation.errors,
        });
        return false;
      }

      const now = new Date();
      const workflowTransitions: ObligationWorkflowTransition[] = [
        ...(current.workflowTransitions || []),
        {
          fromStatus: current.status,
          toStatus: status,
          changedAt: now,
          changedBy: transition?.changedBy || 'system',
          reason: transition?.reason,
        },
      ];

      const auditTrail: ObligationAuditEvent[] = [
        ...(current.auditTrail || []),
        createAuditEvent(
          'status-transition',
          transition?.changedBy || 'system',
          `Status changed from ${current.status} to ${status}${transition?.reason ? `: ${transition.reason}` : ''}`
        ),
      ];

      const docRef = doc(db, COLLECTIONS.OBLIGATIONS, id);
      await updateDoc(docRef, {
        status,
        workflowTransitions,
        auditTrail,
        updatedAt: now,
      });
      return true;
    } catch (error) {
      logger.error('Error updating obligation status in Firebase', { error });
      return false;
    }
  }


  async issueWithTransmittal(request: ObligationIssueRequest): Promise<ObligationIssueResult | null> {
    try {
      const current = await this.getById(request.obligationId);
      if (!current) {
        return null;
      }

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

      const recipients = request.recipients.map((recipient: ObligationTransmittalRecipient) => ({ ...recipient }));
      const deliveryProof = recipients.map((recipient: ObligationTransmittalRecipient) => toDeliveryProofEntry(recipient, now));

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

      const transmittalDocRef = await addDoc(
        collection(db, COLLECTIONS.OBLIGATION_TRANSMITTALS),
        stripUndefinedDeep({
          ...transmittalPayload,
          createdBy: currentUser.uid,
        })
      );

      const issueLogEntry: ObligationIssueLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        transmittalId: transmittalDocRef.id,
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
          `Status changed from ${current.status} to issued: Issued via obligation transmittal`
        ),
        createAuditEvent('issued', currentUser.uid, `Issued obligation with transmittal ${transmittalDocRef.id}`),
        createAuditEvent('transmittal-created', currentUser.uid, `Created transmittal ${transmittalDocRef.id}`),
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
        })
      );

      return {
        transmittal: {
          id: transmittalDocRef.id,
          ...transmittalPayload,
        },
        issueLogEntry,
        distribution: deliveryProof,
        pdfData,
      };
    } catch (error) {
      logger.error('Error issuing obligation transmittal', { error, request });
      return null;
    }
  }

  async getTransmittalsForObligation(obligationId: string): Promise<ObligationTransmittal[]> {
    try {
      const transmittalsQuery = query(
        collection(db, COLLECTIONS.OBLIGATION_TRANSMITTALS),
        where('obligationId', '==', obligationId),
        orderBy('issuedAt', 'desc')
      );

      const snapshot = await getDocs(transmittalsQuery);
      return snapshot.docs
        .map((transmittalDoc) => normalizeTransmittalDocumentSafe(transmittalDoc.id, transmittalDoc.data() as Partial<ObligationTransmittal>))
        .filter((transmittal): transmittal is ObligationTransmittal => transmittal !== null);
    } catch (error) {
      logger.error('Error fetching obligation transmittals from Firebase', { error, obligationId });
      return [];
    }
  }

  async getTemplates(): Promise<ObligationTemplate[]> {
    try {
      const templatesQuery = query(
        collection(db, COLLECTIONS.OBLIGATION_TEMPLATES),
        orderBy('isDefault', 'desc')
      );

      const snapshot = await getDocs(templatesQuery);

      const templates = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      })) as ObligationTemplate[];

      if (templates.length === 0) {
        return [
          {
            id: 'default',
            name: `Βασικό Πρότυπο ${process.env.NEXT_PUBLIC_COMPANY_NAME || 'Company'}`,
            description: 'Βασικές ενότητες συγγραφής υποχρεώσεων.',
            sections: DEFAULT_TEMPLATE_SECTIONS,
            isDefault: true,
          },
          {
            id: 'minimal',
            name: 'Ελάχιστο Πρότυπο',
            description: 'Μόνο τα απαραίτητα άρθρα για απλά έργα.',
            sections: DEFAULT_TEMPLATE_SECTIONS.slice(0, 3),
            isDefault: false,
          },
        ];
      }

      return templates;
    } catch (error) {
      logger.error('Error fetching templates from Firebase', { error });
      return [
        {
          id: 'default',
          name: `Βασικό Πρότυπο ${process.env.NEXT_PUBLIC_COMPANY_NAME || 'Company'}`,
          description: 'Βασικές ενότητες συγγραφής υποχρεώσεων.',
          sections: DEFAULT_TEMPLATE_SECTIONS,
          isDefault: true,
        },
      ];
    }
  }

  async search(searchText: string, filters?: SearchFilters): Promise<ObligationDocument[]> {
    try {
      const baseQuery = collection(db, COLLECTIONS.OBLIGATIONS);
      const constraints: QueryConstraint[] = [];

      if (filters?.status && filters.status !== 'all') {
        constraints.push(where('status', '==', filters.status));
      }

      if (filters?.dateFrom) {
        constraints.push(where('createdAt', '>=', filters.dateFrom));
      }
      if (filters?.dateTo) {
        constraints.push(where('createdAt', '<=', filters.dateTo));
      }

      constraints.push(orderBy('updatedAt', 'desc'));

      const searchQuery = query(baseQuery, ...constraints);

      const snapshot = await getDocs(searchQuery);
      let results = snapshot.docs
        .map((document) => normalizeObligationDocumentSafe(document.id, document.data() as Partial<ObligationDocument>))
        .filter((document): document is ObligationDocument => document !== null);

      if (searchText.trim()) {
        const searchTerm = searchText.toLowerCase();
        results = results.filter((obligation) =>
          obligation.title.toLowerCase().includes(searchTerm) ||
          obligation.projectName.toLowerCase().includes(searchTerm) ||
          obligation.contractorCompany.toLowerCase().includes(searchTerm) ||
          obligation.owners.some((owner) => owner.name.toLowerCase().includes(searchTerm))
        );
      }

      return results;
    } catch (error) {
      logger.error('Error searching obligations in Firebase', { error });
      return [];
    }
  }

  async getStatistics(): Promise<ObligationStats> {
    try {
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const allObligations = await this.getAll();

      return {
        total: allObligations.length,
        draft: allObligations.filter((obligation) => obligation.status === 'draft').length,
        inReview: allObligations.filter((obligation) => obligation.status === 'in-review').length,
        returned: allObligations.filter((obligation) => obligation.status === 'returned').length,
        approved: allObligations.filter((obligation) => obligation.status === 'approved').length,
        issued: allObligations.filter((obligation) => obligation.status === 'issued').length,
        superseded: allObligations.filter((obligation) => obligation.status === 'superseded').length,
        archived: allObligations.filter((obligation) => obligation.status === 'archived').length,
        completed: allObligations.filter((obligation) => obligation.status === 'completed').length,
        thisMonth: allObligations.filter((obligation) => obligation.createdAt >= thisMonth).length,
      };
    } catch (error) {
      logger.error('Error getting statistics from Firebase', { error });
      return {
        total: 0,
        draft: 0,
        inReview: 0,
        returned: 0,
        approved: 0,
        issued: 0,
        superseded: 0,
        archived: 0,
        completed: 0,
        thisMonth: 0,
      };
    }
  }

  async exportToPDF(_id: string): Promise<Blob> {
    throw new Error('📝 PDF export not implemented yet - will be added in future update');
  }
}

// 🚨 DEPRECATED: Keep InMemoryObligationsRepository for backward compatibility
export class InMemoryObligationsRepository extends FirestoreObligationsRepository {
  constructor() {
    super();
  }
}






