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
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      // Validate exclusivity
      if (input.exclusivity === 'exclusive') {
        const validation = await this.validateExclusivity(
          input.projectId,
          input.unitId ?? null,
          input.scope
        );
        if (!validation.valid) {
          return {
            success: false,
            error: validation.reason ?? 'Exclusivity conflict',
          };
        }
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
  ): Promise<{ success: boolean; error?: string }> {
    try {
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
   * Ελέγχει αν μπορεί να δημιουργηθεί exclusive σύμβαση.
   *
   * Κανόνες:
   * 1. Exclusive project-level: Δεν πρέπει να υπάρχει άλλη exclusive (project ή unit) στο ίδιο project
   * 2. Exclusive unit-level: Δεν πρέπει να υπάρχει exclusive project-level ΚΑΙ exclusive unit-level στο ίδιο unit
   */
  static async validateExclusivity(
    projectId: string,
    unitId: string | null,
    scope: 'project' | 'unit'
  ): Promise<ExclusivityValidationResult> {
    try {
      // Βρες active exclusive agreements στο project
      const activeExclusives = await this.getAgreements(projectId);
      const exclusives = activeExclusives.filter(
        (a) => a.status === 'active' && a.exclusivity === 'exclusive'
      );

      if (scope === 'project') {
        // Project-level exclusive: δεν πρέπει να υπάρχει ΚΑΜΙΑ exclusive
        const conflict = exclusives[0];
        if (conflict) {
          return {
            valid: false,
            conflictingAgreementId: conflict.id,
            reason: `Υπάρχει ήδη αποκλειστική σύμβαση (${conflict.agentName})`,
          };
        }
      }

      if (scope === 'unit' && unitId) {
        // Unit-level exclusive: έλεγξε project-level exclusive + unit-level exclusive
        const projectConflict = exclusives.find((a) => a.scope === 'project');
        if (projectConflict) {
          return {
            valid: false,
            conflictingAgreementId: projectConflict.id,
            reason: `Υπάρχει αποκλειστική σύμβαση σε επίπεδο έργου (${projectConflict.agentName})`,
          };
        }

        const unitConflict = exclusives.find(
          (a) => a.scope === 'unit' && a.unitId === unitId
        );
        if (unitConflict) {
          return {
            valid: false,
            conflictingAgreementId: unitConflict.id,
            reason: `Υπάρχει ήδη αποκλειστική σύμβαση στη μονάδα (${unitConflict.agentName})`,
          };
        }
      }

      return { valid: true, conflictingAgreementId: null, reason: null };
    } catch (error) {
      logger.error('[BrokerageService] Exclusivity validation failed:', error);
      return {
        valid: false,
        conflictingAgreementId: null,
        reason: 'Σφάλμα κατά τον έλεγχο αποκλειστικότητας',
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
