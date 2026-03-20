/**
 * =============================================================================
 * BrokerageService — Μεσιτικές Συμφωνίες & Προμήθειες (Client)
 * =============================================================================
 *
 * Client-side service: READ operations use Firestore directly,
 * WRITE operations route through server-side API for security.
 *
 * @module services/brokerage.service
 * @enterprise ADR-230 - Contract Workflow (SPEC-230B)
 * @enterprise ADR-252 - Security Audit (server-side write enforcement)
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import type {
  BrokerageAgreement,
  BrokerageStatus,
  CommissionRecord,
  CommissionPaymentStatus,
  CreateBrokerageAgreementInput,
  RecordCommissionInput,
  ExclusivityValidationResult,
  ExclusivityValidationInput,
  ExclusivityValidationIssue,
} from '@/types/brokerage';

const logger = createModuleLogger('BrokerageService');

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

interface ApiSuccessResponse {
  success: true;
  data?: { id: string };
}

interface ApiErrorResponse {
  success: false;
  error: string;
  validation?: ExclusivityValidationResult | null;
}

type ApiResponse = ApiSuccessResponse | ApiErrorResponse;

// ============================================================================
// API HELPER
// ============================================================================

async function callApi(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: Record<string, unknown>
): Promise<ApiResponse> {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await response.json() as ApiResponse;
  return data;
}

// ============================================================================
// BROKERAGE SERVICE
// ============================================================================

export class BrokerageService {
  // ==========================================================================
  // AGREEMENTS — WRITE (via server API)
  // ==========================================================================

  /**
   * Δημιουργία μεσιτικής σύμβασης — routed through server API.
   * Server handles exclusivity validation and ID generation.
   */
  static async createAgreement(
    input: CreateBrokerageAgreementInput,
    _createdBy: string
  ): Promise<{ success: boolean; id?: string; error?: string; validation?: ExclusivityValidationResult }> {
    try {
      const result = await callApi('/api/brokerage/agreements', 'POST', {
        agentContactId: input.agentContactId,
        agentName: input.agentName,
        scope: input.scope,
        projectId: input.projectId,
        unitId: input.unitId ?? null,
        exclusivity: input.exclusivity,
        commissionType: input.commissionType,
        commissionPercentage: input.commissionPercentage ?? null,
        commissionFixedAmount: input.commissionFixedAmount ?? null,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        notes: input.notes ?? null,
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          validation: result.validation ?? undefined,
        };
      }

      return { success: true, id: result.data?.id };
    } catch (error) {
      logger.error('[BrokerageService] Failed to create agreement:', error);
      return {
        success: false,
        error: getErrorMessage(error, 'Failed to create agreement'),
      };
    }
  }

  /**
   * Ενημέρωση μεσιτικής σύμβασης — routed through server API.
   */
  static async updateAgreement(
    id: string,
    updates: Partial<Pick<BrokerageAgreement,
      'exclusivity' | 'commissionType' | 'commissionPercentage' |
      'commissionFixedAmount' | 'startDate' | 'endDate' | 'notes' | 'scope' | 'unitId'
    >>,
    _updatedBy: string
  ): Promise<{ success: boolean; error?: string; validation?: ExclusivityValidationResult }> {
    try {
      const result = await callApi(`/api/brokerage/agreements/${id}`, 'PATCH', updates as Record<string, unknown>);

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          validation: result.validation ?? undefined,
        };
      }

      return { success: true };
    } catch (error) {
      logger.error('[BrokerageService] Failed to update agreement:', error);
      return {
        success: false,
        error: getErrorMessage(error, 'Failed to update agreement'),
      };
    }
  }

  /**
   * Τερματισμός μεσιτικής σύμβασης — routed through server API.
   */
  static async terminateAgreement(
    id: string,
    _updatedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await callApi(`/api/brokerage/agreements/${id}`, 'DELETE');

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return { success: true };
    } catch (error) {
      logger.error('[BrokerageService] Failed to terminate agreement:', error);
      return {
        success: false,
        error: getErrorMessage(error, 'Failed to terminate agreement'),
      };
    }
  }

  // ==========================================================================
  // AGREEMENTS — READ (client-side Firestore)
  // ==========================================================================

  /**
   * Λίστα μεσιτικών συμβάσεων για project/unit.
   */
  static async getAgreements(
    projectId: string,
    unitId?: string | null,
    status?: BrokerageStatus
  ): Promise<BrokerageAgreement[]> {
    try {
      let q = query(
        collection(db, COLLECTIONS.BROKERAGE_AGREEMENTS),
        where('projectId', '==', projectId)
      );

      if (unitId) {
        q = query(q, where('unitId', '==', unitId));
      }

      if (status) {
        q = query(q, where('status', '==', status));
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as BrokerageAgreement);
    } catch (error) {
      logger.error('[BrokerageService] Failed to get agreements:', error);
      return [];
    }
  }

  /**
   * Ανάκτηση μεμονωμένης σύμβασης.
   */
  static async getAgreementById(id: string): Promise<BrokerageAgreement | null> {
    try {
      const snap = await getDoc(doc(db, COLLECTIONS.BROKERAGE_AGREEMENTS, id));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as BrokerageAgreement;
    } catch (error) {
      logger.error('[BrokerageService] Failed to get agreement:', error);
      return null;
    }
  }

  // ==========================================================================
  // EXCLUSIVITY VALIDATION (client-side for UI feedback)
  // ==========================================================================

  /**
   * Ελέγχει κανόνες αποκλειστικότητας (5 Business Rules).
   * Kept client-side for immediate UI feedback.
   * Server ALSO validates on write — this is supplementary.
   *
   * Rule 1: Exclusive unit → BLOCKS everything on that unit
   * Rule 2: Exclusive project → BLOCKS everything on the project
   * Rule 3: Exclusive project + existing non-exclusive units → WARNING (excluded units)
   * Rule 4: Non-exclusive can coexist UNLESS blocked by exclusive
   * Rule 5: Validation runs on CREATE and UPDATE
   */
  static async validateExclusivity(
    input: ExclusivityValidationInput
  ): Promise<ExclusivityValidationResult> {
    try {
      const { projectId, unitId, scope, exclusivity, excludeAgreementId } = input;
      const today = new Date().toISOString().split('T')[0];

      // Fetch ALL agreements for this project
      const allAgreements = await this.getAgreements(projectId);

      // Filter: only active + not expired + not self
      const active = allAgreements.filter((a) => {
        if (a.status !== 'active') return false;
        if (a.endDate && a.endDate.split('T')[0] < today) return false;
        if (excludeAgreementId && a.id === excludeAgreementId) return false;
        return true;
      });

      const issues: ExclusivityValidationIssue[] = [];
      const excludedUnitIds: string[] = [];

      // Separate by type for clarity
      const exclusiveProject = active.filter((a) => a.exclusivity === 'exclusive' && a.scope === 'project');
      const exclusiveUnits = active.filter((a) => a.exclusivity === 'exclusive' && a.scope === 'unit');
      const nonExclusiveUnits = active.filter((a) => a.exclusivity === 'non_exclusive' && a.scope === 'unit');

      // ========================================================================
      // NEW agreement is EXCLUSIVE + PROJECT scope
      // ========================================================================
      if (exclusivity === 'exclusive' && scope === 'project') {
        // Block if another exclusive project exists
        for (const conflict of exclusiveProject) {
          issues.push({
            severity: 'error',
            messageKey: 'sales.legal.exclusivityConflictProjectExclusive',
            messageParams: { agentName: conflict.agentName },
            conflictingAgreementId: conflict.id,
            conflictingAgentName: conflict.agentName,
          });
        }

        // Block if any exclusive unit exists
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

        // Rule 3: WARNING if non-exclusive unit agreements exist
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

      // ========================================================================
      // NEW agreement is EXCLUSIVE + UNIT scope
      // ========================================================================
      if (exclusivity === 'exclusive' && scope === 'unit' && unitId) {
        // Block by project-level exclusive
        for (const conflict of exclusiveProject) {
          issues.push({
            severity: 'error',
            messageKey: 'sales.legal.exclusivityBlockedByProjectExclusive',
            messageParams: { agentName: conflict.agentName },
            conflictingAgreementId: conflict.id,
            conflictingAgentName: conflict.agentName,
          });
        }

        // Block by exclusive on same unit
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

        // Block by non-exclusive on same unit (exclusive requires clearing the unit)
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

      // ========================================================================
      // NEW agreement is NON-EXCLUSIVE + PROJECT scope
      // ========================================================================
      if (exclusivity === 'non_exclusive' && scope === 'project') {
        // Block by project-level exclusive
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

      // ========================================================================
      // NEW agreement is NON-EXCLUSIVE + UNIT scope
      // ========================================================================
      if (exclusivity === 'non_exclusive' && scope === 'unit' && unitId) {
        // Block by project-level exclusive
        for (const conflict of exclusiveProject) {
          issues.push({
            severity: 'error',
            messageKey: 'sales.legal.nonExclusiveBlockedByProjectExclusive',
            messageParams: { agentName: conflict.agentName },
            conflictingAgreementId: conflict.id,
            conflictingAgentName: conflict.agentName,
          });
        }

        // Block by exclusive on same unit
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
        // backward compat
        valid: !hasErrors,
        conflictingAgreementId: firstIssue?.conflictingAgreementId ?? null,
        reason: firstIssue?.messageKey ?? null,
      };
    } catch (error) {
      logger.error('[BrokerageService] Exclusivity validation failed:', error);
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

  // ==========================================================================
  // COMMISSION RECORDS — WRITE (via server API)
  // ==========================================================================

  /**
   * Εγγραφή προμήθειας κατά πώληση — routed through server API.
   * Commission calculation happens ONLY on the server.
   */
  static async recordCommission(
    input: RecordCommissionInput,
    _createdBy: string
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const result = await callApi('/api/brokerage/commissions', 'POST', {
        brokerageAgreementId: input.brokerageAgreementId,
        agentContactId: input.agentContactId,
        agentName: input.agentName,
        unitId: input.unitId,
        projectId: input.projectId,
        buyerContactId: input.buyerContactId,
        salePrice: input.salePrice,
        commissionType: input.commissionType,
        commissionPercentage: input.commissionPercentage,
        commissionFixedAmount: input.commissionFixedAmount,
      });

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return { success: true, id: result.data?.id };
    } catch (error) {
      logger.error('[BrokerageService] Failed to record commission:', error);
      return {
        success: false,
        error: getErrorMessage(error, 'Failed to record commission'),
      };
    }
  }

  // ==========================================================================
  // COMMISSION RECORDS — READ (client-side Firestore)
  // ==========================================================================

  /**
   * Ανάκτηση commission records για unit.
   */
  static async getCommissions(unitId: string): Promise<CommissionRecord[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.COMMISSION_RECORDS),
        where('unitId', '==', unitId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as CommissionRecord);
    } catch (error) {
      logger.error('[BrokerageService] Failed to get commissions:', error);
      return [];
    }
  }

  /**
   * Ενημέρωση κατάστασης πληρωμής — routed through server API.
   */
  static async updateCommissionPayment(
    id: string,
    paymentStatus: CommissionPaymentStatus
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await callApi(`/api/brokerage/commissions/${id}`, 'PATCH', {
        paymentStatus,
      });

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return { success: true };
    } catch (error) {
      logger.error('[BrokerageService] Failed to update commission payment:', error);
      return {
        success: false,
        error: getErrorMessage(error, 'Failed to update commission payment'),
      };
    }
  }

  // ==========================================================================
  // PERSONA GUARD — Protect persona removal when active records exist
  // ==========================================================================

  /**
   * Ελέγχει αν ο μεσίτης (agentContactId) έχει ενεργές συμβάσεις ή εγγραφές
   * προμηθειών. Χρησιμοποιείται για να μπλοκάρει την αφαίρεση persona.
   * Read-only — stays client-side.
   */
  static async hasActiveRecords(
    agentContactId: string
  ): Promise<{ hasAgreements: boolean; hasCommissions: boolean }> {
    try {
      const agreementsQ = query(
        collection(db, COLLECTIONS.BROKERAGE_AGREEMENTS),
        where('agentContactId', '==', agentContactId),
        where('status', '==', 'active')
      );
      const agreementsSnap = await getDocs(agreementsQ);

      const commissionsQ = query(
        collection(db, COLLECTIONS.COMMISSION_RECORDS),
        where('agentContactId', '==', agentContactId),
        where('paymentStatus', '==', 'pending')
      );
      const commissionsSnap = await getDocs(commissionsQ);

      return {
        hasAgreements: !agreementsSnap.empty,
        hasCommissions: !commissionsSnap.empty,
      };
    } catch (error) {
      logger.warn('[BrokerageService] hasActiveRecords check failed — allowing removal:', error);
      // Fail open: if check fails (e.g., permission issues), allow removal
      return { hasAgreements: false, hasCommissions: false };
    }
  }
}

export default BrokerageService;
