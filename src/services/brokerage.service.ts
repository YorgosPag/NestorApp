/**
 * =============================================================================
 * BrokerageService — Μεσιτικές Συμφωνίες & Προμήθειες
 * =============================================================================
 *
 * CRUD + validation + commission recording για μεσιτικές συμβάσεις.
 * Ελληνική αγορά ακινήτων — ΓΕ.ΜΗ. αδειοδοτημένοι μεσίτες.
 *
 * @module services/brokerage.service
 * @enterprise ADR-230 - Contract Workflow (SPEC-230B)
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { generateBrokerageId, generateCommissionId } from '@/services/enterprise-id.service';
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
import { calculateCommission } from '@/types/brokerage';
import { getCompanyId } from '@/config/tenant';

const logger = createModuleLogger('BrokerageService');

// ============================================================================
// ID GENERATION — delegated to enterprise-id.service.ts
// ============================================================================

// ============================================================================
// BROKERAGE SERVICE
// ============================================================================

export class BrokerageService {
  // ==========================================================================
  // AGREEMENTS — CRUD
  // ==========================================================================

  /**
   * Δημιουργία μεσιτικής σύμβασης.
   * Ελέγχει exclusivity πριν τη δημιουργία.
   */
  static async createAgreement(
    input: CreateBrokerageAgreementInput,
    createdBy: string
  ): Promise<{ success: boolean; id?: string; error?: string; validation?: ExclusivityValidationResult }> {
    try {
      // ALWAYS validate exclusivity (both exclusive AND non-exclusive)
      const validation = await this.validateExclusivity({
        projectId: input.projectId,
        unitId: input.unitId ?? null,
        scope: input.scope,
        exclusivity: input.exclusivity,
      });
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
        companyId: getCompanyId(),
        notes: input.notes ?? null,
        createdBy,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db, COLLECTIONS.BROKERAGE_AGREEMENTS, id), agreement);

      logger.info(`[BrokerageService] Created agreement ${id} for agent ${input.agentContactId}`);
      return { success: true, id };
    } catch (error) {
      logger.error('[BrokerageService] Failed to create agreement:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

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

  /**
   * Τερματισμός μεσιτικής σύμβασης.
   */
  static async terminateAgreement(
    id: string,
    updatedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, COLLECTIONS.BROKERAGE_AGREEMENTS, id), {
        status: 'terminated',
        terminatedAt: now,
        updatedAt: now,
      });

      logger.info(`[BrokerageService] Terminated agreement ${id}`);
      return { success: true };
    } catch (error) {
      logger.error('[BrokerageService] Failed to terminate agreement:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Ενημέρωση μεσιτικής σύμβασης.
   */
  static async updateAgreement(
    id: string,
    updates: Partial<Pick<BrokerageAgreement,
      'exclusivity' | 'commissionType' | 'commissionPercentage' |
      'commissionFixedAmount' | 'startDate' | 'endDate' | 'notes' | 'scope' | 'unitId'
    >>,
    updatedBy: string
  ): Promise<{ success: boolean; error?: string; validation?: ExclusivityValidationResult }> {
    try {
      // If exclusivity, scope, or unitId change → re-validate
      const needsValidation = updates.exclusivity !== undefined
        || updates.scope !== undefined
        || updates.unitId !== undefined;

      if (needsValidation) {
        // Fetch current agreement to merge with updates
        const current = await this.getAgreementById(id);
        if (!current) {
          return { success: false, error: 'Agreement not found' };
        }

        const mergedScope = updates.scope ?? current.scope;
        const mergedUnitId = updates.unitId !== undefined ? updates.unitId : current.unitId;
        const mergedExclusivity = updates.exclusivity ?? current.exclusivity;

        const validation = await this.validateExclusivity({
          projectId: current.projectId,
          unitId: mergedUnitId,
          scope: mergedScope,
          exclusivity: mergedExclusivity,
          excludeAgreementId: id, // exclude self
        });

        if (!validation.canProceed) {
          const firstError = validation.issues.find((i) => i.severity === 'error');
          return {
            success: false,
            error: firstError?.messageKey ?? 'Exclusivity conflict',
            validation,
          };
        }
      }

      const now = new Date().toISOString();
      await updateDoc(doc(db, COLLECTIONS.BROKERAGE_AGREEMENTS, id), {
        ...updates,
        updatedAt: now,
      });

      logger.info(`[BrokerageService] Updated agreement ${id}`);
      return { success: true };
    } catch (error) {
      logger.error('[BrokerageService] Failed to update agreement:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==========================================================================
  // EXCLUSIVITY VALIDATION
  // ==========================================================================

  /**
   * Ελέγχει κανόνες αποκλειστικότητας (5 Business Rules).
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
  // COMMISSION RECORDS
  // ==========================================================================

  /**
   * Εγγραφή προμήθειας κατά πώληση.
   * Fire-and-forget — καλείται από SellDialog.
   */
  static async recordCommission(
    input: RecordCommissionInput,
    createdBy: string
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const id = generateCommissionId();
      const now = new Date().toISOString();

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
        companyId: getCompanyId(),
        createdBy,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db, COLLECTIONS.COMMISSION_RECORDS, id), record);

      logger.info(
        `[BrokerageService] Recorded commission ${id}: ${commissionAmount}€ for agent ${input.agentContactId}`
      );
      return { success: true, id };
    } catch (error) {
      logger.error('[BrokerageService] Failed to record commission:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

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
   * Ενημέρωση κατάστασης πληρωμής.
   */
  static async updateCommissionPayment(
    id: string,
    paymentStatus: CommissionPaymentStatus
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const now = new Date().toISOString();
      const updates: Record<string, string | null> = {
        paymentStatus,
        updatedAt: now,
      };

      if (paymentStatus === 'paid') {
        updates.paidAt = now;
      }

      await updateDoc(doc(db, COLLECTIONS.COMMISSION_RECORDS, id), updates);

      logger.info(`[BrokerageService] Commission ${id} → ${paymentStatus}`);
      return { success: true };
    } catch (error) {
      logger.error('[BrokerageService] Failed to update commission payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  // ==========================================================================
  // PERSONA GUARD — Protect persona removal when active records exist
  // ==========================================================================

  /**
   * Ελέγχει αν ο μεσίτης (agentContactId) έχει ενεργές συμβάσεις ή εγγραφές
   * προμηθειών. Χρησιμοποιείται για να μπλοκάρει την αφαίρεση persona.
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
