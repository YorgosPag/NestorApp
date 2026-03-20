/**
 * =============================================================================
 * BrokerageServerService — Server-Side Brokerage Operations (Admin SDK)
 * =============================================================================
 *
 * Server-side service for brokerage agreement and commission operations.
 * Uses Firebase Admin SDK — called exclusively from API routes.
 *
 * Replicates exclusivity validation from the client service to ensure
 * server-side enforcement (never trust client validation alone).
 *
 * @module services/brokerage-server.service
 * @enterprise ADR-252 - Security Audit (server-side write enforcement)
 */
import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { generateBrokerageId, generateCommissionId } from '@/services/enterprise-id.service';
import { calculateCommission } from '@/types/brokerage';
import type {
  BrokerageAgreement,
  CommissionRecord,
  CommissionPaymentStatus,
  CreateBrokerageAgreementInput,
  RecordCommissionInput,
  ExclusivityValidationResult,
  ExclusivityValidationInput,
  ExclusivityValidationIssue,
} from '@/types/brokerage';

const logger = createModuleLogger('BrokerageServerService');

// ============================================================================
// ADMIN DB HELPER
// ============================================================================

function getDb() {
  const db = getAdminFirestore();
  if (!db) throw new Error('Admin Firestore unavailable');
  return db;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

interface AgreementFieldValidation {
  valid: boolean;
  error?: string;
}

function validateAgreementFields(input: CreateBrokerageAgreementInput): AgreementFieldValidation {
  if (!input.agentContactId || typeof input.agentContactId !== 'string') {
    return { valid: false, error: 'agentContactId is required and must be a string' };
  }
  if (!input.projectId || typeof input.projectId !== 'string') {
    return { valid: false, error: 'projectId is required and must be a string' };
  }
  if (input.scope !== 'project' && input.scope !== 'unit') {
    return { valid: false, error: 'scope must be "project" or "unit"' };
  }
  if (input.exclusivity !== 'exclusive' && input.exclusivity !== 'non_exclusive') {
    return { valid: false, error: 'exclusivity must be "exclusive" or "non_exclusive"' };
  }
  if (input.commissionType !== 'percentage' && input.commissionType !== 'fixed') {
    return { valid: false, error: 'commissionType must be "percentage" or "fixed"' };
  }
  if (input.commissionType === 'percentage') {
    if (
      input.commissionPercentage === null ||
      input.commissionPercentage === undefined ||
      typeof input.commissionPercentage !== 'number' ||
      input.commissionPercentage < 0 ||
      input.commissionPercentage > 100
    ) {
      return { valid: false, error: 'commissionPercentage must be a number between 0 and 100 for percentage type' };
    }
  }
  if (!input.startDate || typeof input.startDate !== 'string') {
    return { valid: false, error: 'startDate is required' };
  }
  return { valid: true };
}

interface CommissionFieldValidation {
  valid: boolean;
  error?: string;
}

function validateCommissionFields(input: RecordCommissionInput): CommissionFieldValidation {
  if (!input.brokerageAgreementId || typeof input.brokerageAgreementId !== 'string') {
    return { valid: false, error: 'brokerageAgreementId is required and must be a string' };
  }
  if (typeof input.salePrice !== 'number' || input.salePrice <= 0) {
    return { valid: false, error: 'salePrice must be a positive number' };
  }
  return { valid: true };
}

// ============================================================================
// SERVER-SIDE EXCLUSIVITY VALIDATION
// ============================================================================

/**
 * Server-side exclusivity validation — mirrors client logic exactly.
 * This MUST run on the server even if the client already validated,
 * because we cannot trust client-side validation alone.
 *
 * Rule 1: Exclusive unit → BLOCKS everything on that unit
 * Rule 2: Exclusive project → BLOCKS everything on the project
 * Rule 3: Exclusive project + existing non-exclusive units → WARNING
 * Rule 4: Non-exclusive can coexist UNLESS blocked by exclusive
 * Rule 5: Validation runs on CREATE and UPDATE
 */
async function validateExclusivityServer(
  input: ExclusivityValidationInput,
  companyId: string
): Promise<ExclusivityValidationResult> {
  try {
    const { projectId, unitId, scope, exclusivity, excludeAgreementId } = input;
    const today = new Date().toISOString().split('T')[0];

    const db = getDb();
    const snapshot = await db
      .collection(COLLECTIONS.BROKERAGE_AGREEMENTS)
      .where('projectId', '==', projectId)
      .where('companyId', '==', companyId)
      .get();

    const allAgreements = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as BrokerageAgreement);

    // Filter: only active + not expired + not self
    const active = allAgreements.filter((a) => {
      if (a.status !== 'active') return false;
      if (a.endDate && a.endDate.split('T')[0] < today) return false;
      if (excludeAgreementId && a.id === excludeAgreementId) return false;
      return true;
    });

    const issues: ExclusivityValidationIssue[] = [];
    const excludedUnitIds: string[] = [];

    const exclusiveProject = active.filter((a) => a.exclusivity === 'exclusive' && a.scope === 'project');
    const exclusiveUnits = active.filter((a) => a.exclusivity === 'exclusive' && a.scope === 'unit');
    const nonExclusiveUnits = active.filter((a) => a.exclusivity === 'non_exclusive' && a.scope === 'unit');

    // NEW agreement is EXCLUSIVE + PROJECT scope
    if (exclusivity === 'exclusive' && scope === 'project') {
      for (const conflict of exclusiveProject) {
        issues.push({
          severity: 'error',
          messageKey: 'sales.legal.exclusivityConflictProjectExclusive',
          messageParams: { agentName: conflict.agentName },
          conflictingAgreementId: conflict.id,
          conflictingAgentName: conflict.agentName,
        });
      }
      for (const conflict of exclusiveUnits) {
        issues.push({
          severity: 'error',
          messageKey: 'sales.legal.exclusivityConflictUnitExclusive',
          messageParams: {
            agentName: conflict.agentName,
            unitName: conflict.unitId ?? '',
          },
          conflictingAgreementId: conflict.id,
          conflictingAgentName: conflict.agentName,
        });
      }
      for (const existing of nonExclusiveUnits) {
        if (existing.unitId) {
          excludedUnitIds.push(existing.unitId);
        }
      }
      if (excludedUnitIds.length > 0) {
        const unitNames = excludedUnitIds.join(', ');
        issues.push({
          severity: 'warning',
          messageKey: 'sales.legal.exclusivityWarningExcludedUnits',
          messageParams: { unitNames },
          conflictingAgreementId: null,
          conflictingAgentName: null,
        });
      }
    }

    // NEW agreement is EXCLUSIVE + UNIT scope
    if (exclusivity === 'exclusive' && scope === 'unit' && unitId) {
      for (const conflict of exclusiveProject) {
        issues.push({
          severity: 'error',
          messageKey: 'sales.legal.exclusivityBlockedByProjectExclusive',
          messageParams: { agentName: conflict.agentName },
          conflictingAgreementId: conflict.id,
          conflictingAgentName: conflict.agentName,
        });
      }
      const sameUnitExclusive = exclusiveUnits.filter((a) => a.unitId === unitId);
      for (const conflict of sameUnitExclusive) {
        issues.push({
          severity: 'error',
          messageKey: 'sales.legal.exclusivityConflictSameUnit',
          messageParams: {
            agentName: conflict.agentName,
            unitName: unitId,
          },
          conflictingAgreementId: conflict.id,
          conflictingAgentName: conflict.agentName,
        });
      }
      const sameUnitNonExclusive = nonExclusiveUnits.filter((a) => a.unitId === unitId);
      for (const conflict of sameUnitNonExclusive) {
        issues.push({
          severity: 'error',
          messageKey: 'sales.legal.exclusivityBlockedByExistingUnit',
          messageParams: {
            agentName: conflict.agentName,
            unitName: unitId,
          },
          conflictingAgreementId: conflict.id,
          conflictingAgentName: conflict.agentName,
        });
      }
    }

    // NEW agreement is NON-EXCLUSIVE + PROJECT scope
    if (exclusivity === 'non_exclusive' && scope === 'project') {
      for (const conflict of exclusiveProject) {
        issues.push({
          severity: 'error',
          messageKey: 'sales.legal.nonExclusiveBlockedByProjectExclusive',
          messageParams: { agentName: conflict.agentName },
          conflictingAgreementId: conflict.id,
          conflictingAgentName: conflict.agentName,
        });
      }
    }

    // NEW agreement is NON-EXCLUSIVE + UNIT scope
    if (exclusivity === 'non_exclusive' && scope === 'unit' && unitId) {
      for (const conflict of exclusiveProject) {
        issues.push({
          severity: 'error',
          messageKey: 'sales.legal.nonExclusiveBlockedByProjectExclusive',
          messageParams: { agentName: conflict.agentName },
          conflictingAgreementId: conflict.id,
          conflictingAgentName: conflict.agentName,
        });
      }
      const sameUnitExclusive = exclusiveUnits.filter((a) => a.unitId === unitId);
      for (const conflict of sameUnitExclusive) {
        issues.push({
          severity: 'error',
          messageKey: 'sales.legal.nonExclusiveBlockedByUnitExclusive',
          messageParams: {
            agentName: conflict.agentName,
            unitName: unitId,
          },
          conflictingAgreementId: conflict.id,
          conflictingAgentName: conflict.agentName,
        });
      }
    }

    const hasErrors = issues.some((i) => i.severity === 'error');
    const firstIssue = issues[0] ?? null;

    return {
      canProceed: !hasErrors,
      issues,
      excludedUnitIds,
      valid: !hasErrors,
      conflictingAgreementId: firstIssue?.conflictingAgreementId ?? null,
      reason: firstIssue?.messageKey ?? null,
    };
  } catch (error) {
    logger.error('[BrokerageServerService] Exclusivity validation failed:', error);
    return {
      canProceed: false,
      issues: [{
        severity: 'error',
        messageKey: 'sales.legal.saveError',
        messageParams: {},
        conflictingAgreementId: null,
        conflictingAgentName: null,
      }],
      excludedUnitIds: [],
      valid: false,
      conflictingAgreementId: null,
      reason: 'sales.legal.saveError',
    };
  }
}

// ============================================================================
// BROKERAGE SERVER SERVICE
// ============================================================================

export class BrokerageServerService {
  // ==========================================================================
  // AGREEMENTS
  // ==========================================================================

  /**
   * Create a brokerage agreement with server-side exclusivity validation.
   */
  static async createAgreement(
    input: CreateBrokerageAgreementInput,
    companyId: string,
    createdBy: string
  ): Promise<{ success: boolean; id?: string; error?: string; validation?: ExclusivityValidationResult }> {
    try {
      // Server-side field validation
      const fieldCheck = validateAgreementFields(input);
      if (!fieldCheck.valid) {
        return { success: false, error: fieldCheck.error };
      }

      // Server-side exclusivity validation (never trust client)
      const validation = await validateExclusivityServer(
        {
          projectId: input.projectId,
          unitId: input.unitId ?? null,
          scope: input.scope,
          exclusivity: input.exclusivity,
        },
        companyId
      );
      if (!validation.canProceed) {
        const firstError = validation.issues.find((i) => i.severity === 'error');
        return {
          success: false,
          error: firstError?.messageKey ?? 'Exclusivity conflict',
          validation,
        };
      }

      const id = generateBrokerageId();
      const now = new Date().toISOString();

      const agreement: BrokerageAgreement = {
        id,
        agentContactId: input.agentContactId,
        agentName: input.agentName,
        scope: input.scope,
        projectId: input.projectId,
        unitId: input.unitId ?? null,
        exclusivity: input.exclusivity,
        commissionType: input.commissionType,
        commissionPercentage: input.commissionPercentage ?? null,
        commissionFixedAmount: input.commissionFixedAmount ?? null,
        status: 'active',
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        terminatedAt: null,
        companyId,
        notes: input.notes ?? null,
        createdBy,
        createdAt: now,
        updatedAt: now,
      };

      const db = getDb();
      await db.collection(COLLECTIONS.BROKERAGE_AGREEMENTS).doc(id).set(agreement);

      logger.info(`[BrokerageServerService] Created agreement ${id} for agent ${input.agentContactId}`);
      return { success: true, id };
    } catch (error) {
      logger.error('[BrokerageServerService] Failed to create agreement:', error);
      return {
        success: false,
        error: getErrorMessage(error, 'Failed to create brokerage agreement'),
      };
    }
  }

  /**
   * Update a brokerage agreement with tenant check + exclusivity re-validation.
   */
  static async updateAgreement(
    id: string,
    updates: Partial<Pick<BrokerageAgreement,
      'exclusivity' | 'commissionType' | 'commissionPercentage' |
      'commissionFixedAmount' | 'startDate' | 'endDate' | 'notes' | 'scope' | 'unitId'
    >>,
    companyId: string,
    updatedBy: string
  ): Promise<{ success: boolean; error?: string; validation?: ExclusivityValidationResult }> {
    try {
      const db = getDb();
      const docRef = db.collection(COLLECTIONS.BROKERAGE_AGREEMENTS).doc(id);
      const snap = await docRef.get();

      if (!snap.exists) {
        return { success: false, error: 'Agreement not found' };
      }

      const current = { id: snap.id, ...snap.data() } as BrokerageAgreement;

      // Tenant isolation check
      if (current.companyId !== companyId) {
        return { success: false, error: 'Access denied' };
      }

      // If exclusivity, scope, or unitId change → re-validate
      const needsValidation = updates.exclusivity !== undefined
        || updates.scope !== undefined
        || updates.unitId !== undefined;

      if (needsValidation) {
        const mergedScope = updates.scope ?? current.scope;
        const mergedUnitId = updates.unitId !== undefined ? updates.unitId : current.unitId;
        const mergedExclusivity = updates.exclusivity ?? current.exclusivity;

        const validation = await validateExclusivityServer(
          {
            projectId: current.projectId,
            unitId: mergedUnitId,
            scope: mergedScope,
            exclusivity: mergedExclusivity,
            excludeAgreementId: id,
          },
          companyId
        );

        if (!validation.canProceed) {
          const firstError = validation.issues.find((i) => i.severity === 'error');
          return {
            success: false,
            error: firstError?.messageKey ?? 'Exclusivity conflict',
            validation,
          };
        }
      }

      // Validate commission percentage if being updated
      if (
        updates.commissionType === 'percentage' ||
        (updates.commissionPercentage !== undefined && current.commissionType === 'percentage')
      ) {
        const pct = updates.commissionPercentage ?? current.commissionPercentage;
        if (pct === null || pct === undefined || pct < 0 || pct > 100) {
          return { success: false, error: 'commissionPercentage must be between 0 and 100' };
        }
      }

      const now = new Date().toISOString();
      await docRef.update({
        ...updates,
        updatedAt: now,
      });

      logger.info(`[BrokerageServerService] Updated agreement ${id}`);
      return { success: true };
    } catch (error) {
      logger.error('[BrokerageServerService] Failed to update agreement:', error);
      return {
        success: false,
        error: getErrorMessage(error, 'Failed to update brokerage agreement'),
      };
    }
  }

  /**
   * Terminate a brokerage agreement with tenant check.
   */
  static async terminateAgreement(
    id: string,
    companyId: string,
    terminatedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const db = getDb();
      const docRef = db.collection(COLLECTIONS.BROKERAGE_AGREEMENTS).doc(id);
      const snap = await docRef.get();

      if (!snap.exists) {
        return { success: false, error: 'Agreement not found' };
      }

      const current = snap.data() as BrokerageAgreement;

      // Tenant isolation check
      if (current.companyId !== companyId) {
        return { success: false, error: 'Access denied' };
      }

      const now = new Date().toISOString();
      await docRef.update({
        status: 'terminated',
        terminatedAt: now,
        updatedAt: now,
      });

      logger.info(`[BrokerageServerService] Terminated agreement ${id} by ${terminatedBy}`);
      return { success: true };
    } catch (error) {
      logger.error('[BrokerageServerService] Failed to terminate agreement:', error);
      return {
        success: false,
        error: getErrorMessage(error, 'Failed to terminate brokerage agreement'),
      };
    }
  }

  // ==========================================================================
  // COMMISSION RECORDS
  // ==========================================================================

  /**
   * Record a commission — calculation happens ONLY on server.
   */
  static async recordCommission(
    input: RecordCommissionInput,
    companyId: string,
    createdBy: string
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      // Server-side field validation
      const fieldCheck = validateCommissionFields(input);
      if (!fieldCheck.valid) {
        return { success: false, error: fieldCheck.error };
      }

      const id = generateCommissionId();
      const now = new Date().toISOString();

      // Commission calculation — server-side ONLY
      const commissionAmount = calculateCommission({
        commissionType: input.commissionType,
        salePrice: input.salePrice,
        commissionPercentage: input.commissionPercentage,
        commissionFixedAmount: input.commissionFixedAmount,
      });

      const record: CommissionRecord = {
        id,
        brokerageAgreementId: input.brokerageAgreementId,
        agentContactId: input.agentContactId,
        agentName: input.agentName,
        unitId: input.unitId,
        projectId: input.projectId,
        buyerContactId: input.buyerContactId,
        salePrice: input.salePrice,
        commissionAmount,
        commissionType: input.commissionType,
        commissionPercentage: input.commissionPercentage,
        paymentStatus: 'pending',
        paidAt: null,
        companyId,
        createdBy,
        createdAt: now,
        updatedAt: now,
      };

      const db = getDb();
      await db.collection(COLLECTIONS.COMMISSION_RECORDS).doc(id).set(record);

      logger.info(
        `[BrokerageServerService] Recorded commission ${id}: ${commissionAmount}€ for agent ${input.agentContactId}`
      );
      return { success: true, id };
    } catch (error) {
      logger.error('[BrokerageServerService] Failed to record commission:', error);
      return {
        success: false,
        error: getErrorMessage(error, 'Failed to record commission'),
      };
    }
  }

  /**
   * Update commission payment status with tenant check.
   */
  static async updateCommissionPayment(
    id: string,
    paymentStatus: CommissionPaymentStatus,
    companyId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate paymentStatus
      const validStatuses: CommissionPaymentStatus[] = ['pending', 'paid', 'cancelled'];
      if (!validStatuses.includes(paymentStatus)) {
        return { success: false, error: 'Invalid payment status' };
      }

      const db = getDb();
      const docRef = db.collection(COLLECTIONS.COMMISSION_RECORDS).doc(id);
      const snap = await docRef.get();

      if (!snap.exists) {
        return { success: false, error: 'Commission record not found' };
      }

      const current = snap.data() as CommissionRecord;

      // Tenant isolation check
      if (current.companyId !== companyId) {
        return { success: false, error: 'Access denied' };
      }

      const now = new Date().toISOString();
      const updateData: Record<string, string | null> = {
        paymentStatus,
        updatedAt: now,
      };

      if (paymentStatus === 'paid') {
        updateData.paidAt = now;
      }

      await docRef.update(updateData);

      logger.info(`[BrokerageServerService] Commission ${id} → ${paymentStatus}`);
      return { success: true };
    } catch (error) {
      logger.error('[BrokerageServerService] Failed to update commission payment:', error);
      return {
        success: false,
        error: getErrorMessage(error, 'Failed to update commission payment'),
      };
    }
  }
}

export default BrokerageServerService;
