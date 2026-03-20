/**
 * Opportunities Server Service — Admin SDK operations
 * ADR-252 Security Fix: Server-side validation for opportunity writes
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateOpportunityId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('OpportunitiesServerService');

function getDb() {
  const db = getAdminFirestore();
  if (!db) throw new Error('Admin Firestore unavailable');
  return db;
}

// Valid opportunity stages
const VALID_STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const;

export interface ServerOpportunityCreatePayload {
  name: string;
  leadId?: string | null;
  stage?: string;
  value?: number;
  probability?: number;
  expectedCloseDate?: string;
  assignedTo?: string;
  notes?: string;
}

export interface ServerOpportunityUpdatePayload {
  name?: string;
  stage?: string;
  value?: number;
  probability?: number;
  expectedCloseDate?: string;
  assignedTo?: string;
  notes?: string;
  leadId?: string | null;
}

export class OpportunitiesServerService {
  static async create(
    data: ServerOpportunityCreatePayload,
    companyId: string,
    createdBy: string
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      // Validation
      if (!data.name || data.name.trim().length === 0) {
        return { success: false, error: 'Opportunity name is required' };
      }
      if (data.name.trim().length > 200) {
        return { success: false, error: 'Opportunity name cannot exceed 200 characters' };
      }
      if (data.stage && !VALID_STAGES.includes(data.stage as typeof VALID_STAGES[number])) {
        return { success: false, error: `Invalid stage: ${data.stage}` };
      }
      if (data.value !== undefined && data.value < 0) {
        return { success: false, error: 'Value cannot be negative' };
      }
      if (data.probability !== undefined && (data.probability < 0 || data.probability > 100)) {
        return { success: false, error: 'Probability must be between 0 and 100' };
      }

      const db = getDb();
      const id = generateOpportunityId();
      const now = new Date().toISOString();

      const opportunity: Record<string, unknown> = {
        id,
        name: data.name.trim(),
        leadId: data.leadId ?? null,
        stage: data.stage ?? 'lead',
        value: data.value ?? 0,
        probability: data.probability ?? 0,
        expectedCloseDate: data.expectedCloseDate ?? null,
        assignedTo: data.assignedTo ?? null,
        notes: data.notes ?? null,
        companyId,
        createdBy,
        createdAt: now,
        updatedAt: now,
      };

      await db.collection(COLLECTIONS.OPPORTUNITIES).doc(id).set(opportunity);

      logger.info(`Created opportunity ${id} for company ${companyId}`);
      return { success: true, id };
    } catch (error) {
      logger.error('Failed to create opportunity:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async update(
    id: string,
    data: ServerOpportunityUpdatePayload,
    companyId: string,
    updatedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const db = getDb();
      const docRef = db.collection(COLLECTIONS.OPPORTUNITIES).doc(id);
      const snap = await docRef.get();

      if (!snap.exists) {
        return { success: false, error: 'Opportunity not found' };
      }

      const existing = snap.data() as Record<string, unknown>;
      // Tenant isolation: verify companyId matches
      if (existing.companyId && existing.companyId !== companyId) {
        return { success: false, error: 'Access denied' };
      }

      // Validation
      if (data.name !== undefined && data.name.trim().length === 0) {
        return { success: false, error: 'Opportunity name cannot be empty' };
      }
      if (data.stage && !VALID_STAGES.includes(data.stage as typeof VALID_STAGES[number])) {
        return { success: false, error: `Invalid stage: ${data.stage}` };
      }
      if (data.value !== undefined && data.value < 0) {
        return { success: false, error: 'Value cannot be negative' };
      }
      if (data.probability !== undefined && (data.probability < 0 || data.probability > 100)) {
        return { success: false, error: 'Probability must be between 0 and 100' };
      }

      const updates: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
        updatedBy,
      };

      if (data.name !== undefined) updates.name = data.name.trim();
      if (data.stage !== undefined) updates.stage = data.stage;
      if (data.value !== undefined) updates.value = data.value;
      if (data.probability !== undefined) updates.probability = data.probability;
      if (data.expectedCloseDate !== undefined) updates.expectedCloseDate = data.expectedCloseDate;
      if (data.assignedTo !== undefined) updates.assignedTo = data.assignedTo;
      if (data.notes !== undefined) updates.notes = data.notes;
      if (data.leadId !== undefined) updates.leadId = data.leadId ?? null;

      await docRef.update(updates);

      logger.info(`Updated opportunity ${id}`);
      return { success: true };
    } catch (error) {
      logger.error('Failed to update opportunity:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  static async remove(
    id: string,
    companyId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const db = getDb();
      const docRef = db.collection(COLLECTIONS.OPPORTUNITIES).doc(id);
      const snap = await docRef.get();

      if (!snap.exists) {
        return { success: false, error: 'Opportunity not found' };
      }

      const existing = snap.data() as Record<string, unknown>;
      if (existing.companyId && existing.companyId !== companyId) {
        return { success: false, error: 'Access denied' };
      }

      await docRef.delete();

      logger.info(`Deleted opportunity ${id}`);
      return { success: true };
    } catch (error) {
      logger.error('Failed to delete opportunity:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }
}
