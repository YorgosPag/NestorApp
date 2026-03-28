/**
 * 📄 ENTERPRISE OBLIGATIONS REPOSITORY - PRODUCTION READY
 *
 * Firestore-backed repository for obligation documents.
 * Normalizers → obligation-normalizers.ts | Transmittal ops → obligation-transmittal-operations.ts
 */

import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  orderBy,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import { generateObligationId } from '@/services/enterprise-id.service';
import { SYSTEM_IDENTITY } from '@/config/domain-constants';
import { auth, db } from '@/lib/firebase';
import { stripUndefinedDeep } from '@/utils/firestore-sanitize';
import { firestoreQueryService } from '@/services/firestore';
import type {
  ObligationDocument,
  ObligationTemplate,
  ObligationStatus,
  ObligationWorkflowTransition,
  ObligationAuditEvent,
  ObligationIssueRequest,
  ObligationIssueResult,
  ObligationTransmittal,
} from '@/types/obligations';
import { DEFAULT_TEMPLATE_SECTIONS } from '@/types/obligation-services';
import type { IObligationsRepository, SearchFilters, ObligationStats } from './contracts';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { validateObligationStatusTransition } from './workflow-rules';
import {
  createAuditEvent,
  normalizeObligationDocumentSafe,
  normalizeTransmittalDocumentSafe,
} from './obligation-normalizers';
import { executeIssueWithTransmittal } from './obligation-transmittal-operations';

const logger = createModuleLogger('FirestoreObligationsRepository');

export class FirestoreObligationsRepository implements IObligationsRepository {
  // ── READ ──

  async getAll(): Promise<ObligationDocument[]> {
    try {
      const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('OBLIGATIONS', {
        constraints: [orderBy('updatedAt', 'desc')],
      });
      return result.documents
        .map((raw) => normalizeObligationDocumentSafe(raw.id, raw as Partial<ObligationDocument>))
        .filter((document): document is ObligationDocument => document !== null);
    } catch (error) {
      logger.error('Error fetching obligations from Firebase', { error });
      return [];
    }
  }

  async getById(id: string): Promise<ObligationDocument | null> {
    try {
      const raw = await firestoreQueryService.getById<DocumentData & { id: string }>('OBLIGATIONS', id);
      if (!raw) return null;
      return normalizeObligationDocumentSafe(raw.id, raw as Partial<ObligationDocument>);
    } catch (error) {
      logger.error('Error fetching obligation by ID from Firebase', { error });
      return null;
    }
  }

  // ── CREATE ──

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
            changedBy: SYSTEM_IDENTITY.ID,
            reason: 'Initial creation',
          },
        ],
        approvals: data.approvals,
        auditTrail: [createAuditEvent('created', SYSTEM_IDENTITY.ID, 'Obligation created')],
        distribution: data.distribution,
        issueLog: data.issueLog,
        phaseBinding: data.phaseBinding,
        costBinding: data.costBinding,
      };

      // 🏢 ADR-210: Enterprise ID generation — setDoc with pre-generated ID
      const id = generateObligationId();
      const createPayload = stripUndefinedDeep({
        ...newObligation,
        id,
        createdBy: currentUser.uid,
      });
      await setDoc(doc(db, COLLECTIONS.OBLIGATIONS, id), createPayload);

      return { id, ...newObligation };
    } catch (error) {
      logger.error('Error creating obligation in Firebase', {
        error,
        message: getErrorMessage(error),
      });
      throw error;
    }
  }

  // ── UPDATE ──

  async update(id: string, data: Partial<ObligationDocument>): Promise<ObligationDocument | null> {
    try {
      const current = await this.getById(id);
      if (!current) return null;

      const now = new Date();
      const auditTrail = [
        ...(current.auditTrail || []),
        createAuditEvent('updated', SYSTEM_IDENTITY.ID, 'Obligation updated'),
      ];

      const updateData: Partial<ObligationDocument> = {
        ...data,
        updatedAt: now,
        auditTrail,
      };

      const docRef = doc(db, COLLECTIONS.OBLIGATIONS, id);
      await updateDoc(docRef, stripUndefinedDeep(updateData));

      return await this.getById(id);
    } catch (error) {
      logger.error('Error updating obligation in Firebase', { error });
      return null;
    }
  }

  // ── DELETE ──

  async delete(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.OBLIGATIONS, id));
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
        if (success) deletedCount += 1;
      }
      return deletedCount;
    } catch (error) {
      logger.error('Error bulk deleting obligations from Firebase', { error });
      return 0;
    }
  }

  // ── DUPLICATE ──

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
            changedBy: SYSTEM_IDENTITY.ID,
            reason: 'Document duplicated',
          },
        ],
        auditTrail: [createAuditEvent('created', SYSTEM_IDENTITY.ID, `Duplicated from obligation ${original.id}`)],
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

  // ── WORKFLOW ──

  async updateStatus(
    id: string,
    status: ObligationStatus,
    transition?: Pick<ObligationWorkflowTransition, 'changedBy' | 'reason'>,
  ): Promise<boolean> {
    try {
      const current = await this.getById(id);
      if (!current) return false;

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
          `Status changed from ${current.status} to ${status}${transition?.reason ? `: ${transition.reason}` : ''}`,
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

  // ── TRANSMITTAL (delegated to standalone function) ──

  async issueWithTransmittal(request: ObligationIssueRequest): Promise<ObligationIssueResult | null> {
    return executeIssueWithTransmittal(request, {
      getById: (id) => this.getById(id),
    });
  }

  async getTransmittalsForObligation(obligationId: string): Promise<ObligationTransmittal[]> {
    try {
      const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('OBLIGATION_TRANSMITTALS', {
        constraints: [
          where('obligationId', '==', obligationId),
          orderBy('issuedAt', 'desc'),
        ],
      });
      return result.documents
        .map((raw) => normalizeTransmittalDocumentSafe(raw.id, raw as Partial<ObligationTransmittal>))
        .filter((transmittal): transmittal is ObligationTransmittal => transmittal !== null);
    } catch (error) {
      logger.error('Error fetching obligation transmittals from Firebase', { error, obligationId });
      return [];
    }
  }

  // ── TEMPLATES ──

  async getTemplates(): Promise<ObligationTemplate[]> {
    try {
      const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('OBLIGATION_TEMPLATES', {
        constraints: [orderBy('isDefault', 'desc')],
        tenantOverride: 'skip',
      });

      const templates = result.documents as unknown as ObligationTemplate[];

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

  // ── SEARCH ──

  async search(searchText: string, filters?: SearchFilters): Promise<ObligationDocument[]> {
    try {
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

      const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('OBLIGATIONS', {
        constraints,
      });

      let results = result.documents
        .map((raw) => normalizeObligationDocumentSafe(raw.id, raw as Partial<ObligationDocument>))
        .filter((document): document is ObligationDocument => document !== null);

      if (searchText.trim()) {
        const searchTerm = searchText.toLowerCase();
        results = results.filter(
          (obligation) =>
            obligation.title.toLowerCase().includes(searchTerm) ||
            obligation.projectName.toLowerCase().includes(searchTerm) ||
            obligation.contractorCompany.toLowerCase().includes(searchTerm) ||
            obligation.owners.some((owner) => owner.name.toLowerCase().includes(searchTerm)),
        );
      }

      return results;
    } catch (error) {
      logger.error('Error searching obligations in Firebase', { error });
      return [];
    }
  }

  // ── STATISTICS ──

  async getStatistics(): Promise<ObligationStats> {
    try {
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const allObligations = await this.getAll();

      return {
        total: allObligations.length,
        draft: allObligations.filter((o) => o.status === 'draft').length,
        inReview: allObligations.filter((o) => o.status === 'in-review').length,
        returned: allObligations.filter((o) => o.status === 'returned').length,
        approved: allObligations.filter((o) => o.status === 'approved').length,
        issued: allObligations.filter((o) => o.status === 'issued').length,
        superseded: allObligations.filter((o) => o.status === 'superseded').length,
        archived: allObligations.filter((o) => o.status === 'archived').length,
        completed: allObligations.filter((o) => o.status === 'completed').length,
        thisMonth: allObligations.filter((o) => o.createdAt >= thisMonth).length,
      };
    } catch (error) {
      logger.error('Error getting statistics from Firebase', { error });
      return {
        total: 0, draft: 0, inReview: 0, returned: 0,
        approved: 0, issued: 0, superseded: 0, archived: 0,
        completed: 0, thisMonth: 0,
      };
    }
  }

  // ── PDF EXPORT ──

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
