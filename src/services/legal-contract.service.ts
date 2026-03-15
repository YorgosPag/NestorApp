/**
 * =============================================================================
 * LegalContractService — Contract Lifecycle & FSM
 * =============================================================================
 *
 * Core contract lifecycle service: CRUD, FSM transitions, professional
 * snapshots, legalPhase sync στο unit document.
 *
 * Uses Admin SDK — this service is called exclusively from API routes.
 *
 * @module services/legal-contract.service
 * @enterprise ADR-230 - Contract Workflow & Legal Process
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { generateContractId } from '@/services/enterprise-id.service';
import { AssociationService } from '@/services/association.service';
import type {
  LegalContract,
  ContractPhase,
  ContractStatus,
  LegalPhase,
  CreateContractInput,
  UpdateContractInput,
  ContractTransitionInput,
  ProfessionalSnapshot,
  LegalProfessionalRole,
} from '@/types/legal-contracts';
import {
  isValidTransition,
  computeLegalPhase,
  CONTRACT_PHASE_ORDER,
} from '@/types/legal-contracts';

const logger = createModuleLogger('LegalContractService');

// ============================================================================
// ADMIN DB HELPER
// ============================================================================

function getDb() {
  const db = getAdminFirestore();
  if (!db) throw new Error('Admin Firestore unavailable');
  return db;
}

// ============================================================================
// LEGAL CONTRACT SERVICE
// ============================================================================

export class LegalContractService {
  // ==========================================================================
  // CRUD
  // ==========================================================================

  /**
   * Δημιουργία νέου contract.
   * Ελέγχει prerequisites (π.χ. final απαιτεί signed preliminary αν υπάρχει).
   */
  static async createContract(
    input: CreateContractInput,
    createdBy: string
  ): Promise<{ success: boolean; contract?: LegalContract; error?: string }> {
    try {
      // Validate prerequisites
      const prerequisiteError = await this.validatePhasePrerequisite(
        input.unitId,
        input.phase
      );
      if (prerequisiteError) {
        return { success: false, error: prerequisiteError };
      }

      // Check for existing contract in same phase
      const existing = await this.getContractByPhase(input.unitId, input.phase);
      if (existing) {
        return {
          success: false,
          error: `Υπάρχει ήδη ${this.phaseLabel(input.phase)} για αυτή τη μονάδα`,
        };
      }

      // Snapshot professionals from unit associations
      const snapshots = await AssociationService.snapshotProfessionals(input.unitId);
      const sellerLawyer = snapshots.find((s) => s.role === 'seller_lawyer') ?? null;
      const buyerLawyer = snapshots.find((s) => s.role === 'buyer_lawyer') ?? null;
      const notary = snapshots.find((s) => s.role === 'notary') ?? null;

      const id = generateContractId();
      const now = new Date().toISOString();

      const contract: LegalContract = {
        id,
        unitId: input.unitId,
        projectId: input.projectId,
        buildingId: input.buildingId,
        buyerContactId: input.buyerContactId,
        phase: input.phase,
        status: 'draft',
        contractAmount: input.contractAmount ?? null,
        depositAmount: input.depositAmount ?? null,
        depositTerms: input.depositTerms ?? null,
        sellerLawyer,
        buyerLawyer,
        notary,
        fileIds: [],
        notes: input.notes ?? null,
        createdBy,
        createdAt: now,
        updatedAt: now,
        signedAt: null,
        completedAt: null,
      };

      const db = getDb();
      await db.collection(COLLECTIONS.LEGAL_CONTRACTS).doc(id).set(contract);

      // Sync legalPhase to unit
      await this.syncLegalPhase(input.unitId);

      logger.info(
        `[LegalContractService] Created ${input.phase} contract ${id} for unit ${input.unitId}`
      );

      return { success: true, contract };
    } catch (error) {
      logger.error('[LegalContractService] Failed to create contract:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Ανάκτηση contracts ανά unit.
   */
  static async getContractsForUnit(unitId: string): Promise<LegalContract[]> {
    try {
      const db = getDb();
      const snapshot = await db
        .collection(COLLECTIONS.LEGAL_CONTRACTS)
        .where('unitId', '==', unitId)
        .orderBy('createdAt', 'asc')
        .get();
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as LegalContract);
    } catch (error) {
      logger.error('[LegalContractService] Failed to get contracts:', error);
      return [];
    }
  }

  /**
   * Ανάκτηση contract ανά phase.
   */
  static async getContractByPhase(
    unitId: string,
    phase: ContractPhase
  ): Promise<LegalContract | null> {
    try {
      const db = getDb();
      const snapshot = await db
        .collection(COLLECTIONS.LEGAL_CONTRACTS)
        .where('unitId', '==', unitId)
        .where('phase', '==', phase)
        .get();
      if (snapshot.empty) return null;
      const d = snapshot.docs[0];
      return { id: d.id, ...d.data() } as LegalContract;
    } catch (error) {
      logger.error('[LegalContractService] Failed to get contract by phase:', error);
      return null;
    }
  }

  /**
   * Ανάκτηση contract ανά ID.
   */
  static async getContractById(id: string): Promise<LegalContract | null> {
    try {
      const db = getDb();
      const snap = await db.collection(COLLECTIONS.LEGAL_CONTRACTS).doc(id).get();
      if (!snap.exists) return null;
      return { id: snap.id, ...snap.data() } as LegalContract;
    } catch (error) {
      logger.error('[LegalContractService] Failed to get contract:', error);
      return null;
    }
  }

  /**
   * Ενημέρωση πεδίων contract (PATCH).
   */
  static async updateContract(
    id: string,
    input: UpdateContractInput
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updates: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };

      if (input.contractAmount !== undefined) updates.contractAmount = input.contractAmount;
      if (input.depositAmount !== undefined) updates.depositAmount = input.depositAmount;
      if (input.depositTerms !== undefined) updates.depositTerms = input.depositTerms;
      if (input.notes !== undefined) updates.notes = input.notes;
      if (input.fileIds !== undefined) updates.fileIds = input.fileIds;

      const db = getDb();
      await db.collection(COLLECTIONS.LEGAL_CONTRACTS).doc(id).update(updates);

      logger.info(`[LegalContractService] Updated contract ${id}`);
      return { success: true };
    } catch (error) {
      logger.error('[LegalContractService] Failed to update contract:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==========================================================================
  // FSM TRANSITIONS
  // ==========================================================================

  /**
   * Μετάβαση status: draft → pending_signature → signed → completed.
   * Forward-only FSM.
   */
  static async transitionStatus(
    id: string,
    input: ContractTransitionInput
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const contract = await this.getContractById(id);
      if (!contract) {
        return { success: false, error: 'Contract not found' };
      }

      if (!isValidTransition(contract.status, input.targetStatus)) {
        return {
          success: false,
          error: `Μη έγκυρη μετάβαση: ${contract.status} → ${input.targetStatus}`,
        };
      }

      const now = new Date().toISOString();
      const updates: Record<string, unknown> = {
        status: input.targetStatus,
        updatedAt: now,
      };

      // Set timestamps for specific transitions
      if (input.targetStatus === 'signed') {
        updates.signedAt = now;
      }
      if (input.targetStatus === 'completed') {
        updates.completedAt = now;
      }

      const db = getDb();
      await db.collection(COLLECTIONS.LEGAL_CONTRACTS).doc(id).update(updates);

      // Sync legalPhase
      await this.syncLegalPhase(contract.unitId);

      logger.info(
        `[LegalContractService] Transition ${id}: ${contract.status} → ${input.targetStatus}`
      );

      return { success: true };
    } catch (error) {
      logger.error('[LegalContractService] Failed to transition status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==========================================================================
  // PROFESSIONAL OVERRIDE
  // ==========================================================================

  /**
   * Override/update ενός professional snapshot σε contract.
   * Χρησιμοποιείται όταν ο χρήστης θέλει να αλλάξει lawyer/notary σε
   * ένα draft/pending_signature contract.
   */
  static async overrideProfessional(
    contractId: string,
    role: LegalProfessionalRole,
    contactId: string | null
  ): Promise<{ success: boolean; snapshot?: ProfessionalSnapshot | null; error?: string }> {
    try {
      const contract = await this.getContractById(contractId);
      if (!contract) {
        return { success: false, error: 'Contract not found' };
      }

      // Μόνο σε draft/pending_signature
      if (contract.status === 'signed' || contract.status === 'completed') {
        return {
          success: false,
          error: 'Δεν μπορείτε να αλλάξετε επαγγελματία σε υπογεγραμμένο contract',
        };
      }

      let snapshot: ProfessionalSnapshot | null = null;

      if (contactId) {
        // Re-snapshot this specific professional
        const snapshots = await AssociationService.snapshotProfessionals(
          contract.unitId,
          [role]
        );
        snapshot = snapshots.find((s) => s.contactId === contactId) ?? null;

        // If not found via associations, create a minimal snapshot from contact
        if (!snapshot) {
          const db = getDb();
          const contactSnap = await db.collection(COLLECTIONS.CONTACTS).doc(contactId).get();
          if (contactSnap.exists) {
            const data = contactSnap.data() as Record<string, string | null | undefined>;
            snapshot = {
              contactId,
              displayName: [data.firstName, data.lastName].filter(Boolean).join(' ')
                || data.companyName || 'Unknown',
              role,
              phone: data.phone ?? null,
              email: data.email ?? null,
              taxId: data.taxId ?? null,
              roleSpecificData: role === 'notary'
                ? { type: 'notary' as const, notaryRegistryNumber: null, notaryDistrict: null }
                : { type: 'lawyer' as const, barAssociationNumber: null, barAssociation: null },
              snapshotAt: new Date().toISOString(),
            };
          }
        }
      }

      // Map role to field name
      const fieldMap: Record<LegalProfessionalRole, string> = {
        seller_lawyer: 'sellerLawyer',
        buyer_lawyer: 'buyerLawyer',
        notary: 'notary',
      };

      const db = getDb();
      await db.collection(COLLECTIONS.LEGAL_CONTRACTS).doc(contractId).update({
        [fieldMap[role]]: snapshot,
        updatedAt: new Date().toISOString(),
      });

      logger.info(
        `[LegalContractService] Override ${role} in contract ${contractId}: ${contactId ?? 'removed'}`
      );

      return { success: true, snapshot };
    } catch (error) {
      logger.error('[LegalContractService] Failed to override professional:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==========================================================================
  // LEGAL PHASE SYNC
  // ==========================================================================

  /**
   * Υπολογίζει και ενημερώνει τη legalPhase στο unit.commercial.
   * Βρίσκει το "πιο προχωρημένο" contract και παράγει τη φάση.
   */
  static async syncLegalPhase(unitId: string): Promise<LegalPhase> {
    try {
      const contracts = await this.getContractsForUnit(unitId);

      if (contracts.length === 0) {
        await this.updateUnitLegalPhase(unitId, 'none');
        return 'none';
      }

      // Βρες το πιο προχωρημένο contract (βάσει phase order)
      let highestPhase: LegalPhase = 'none';
      let highestPhaseIndex = -1;

      for (const c of contracts) {
        const phaseIndex = CONTRACT_PHASE_ORDER.indexOf(c.phase);
        if (phaseIndex > highestPhaseIndex) {
          highestPhaseIndex = phaseIndex;
          highestPhase = computeLegalPhase(c.phase, c.status);
        } else if (phaseIndex === highestPhaseIndex) {
          // Ίδια φάση — χρησιμοποίησε το πιο "προχωρημένο" status
          const candidate = computeLegalPhase(c.phase, c.status);
          if (candidate > highestPhase) {
            highestPhase = candidate;
          }
        }
      }

      await this.updateUnitLegalPhase(unitId, highestPhase);
      return highestPhase;
    } catch (error) {
      logger.error('[LegalContractService] Failed to sync legal phase:', error);
      return 'none';
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Ελέγχει prerequisites πριν δημιουργηθεί contract σε μια φάση.
   */
  private static async validatePhasePrerequisite(
    unitId: string,
    phase: ContractPhase
  ): Promise<string | null> {
    if (phase === 'preliminary') {
      return null; // Καμία prerequisite
    }

    if (phase === 'final') {
      // Final: αν υπάρχει preliminary, πρέπει να είναι signed
      const preliminary = await this.getContractByPhase(unitId, 'preliminary');
      if (preliminary && preliminary.status !== 'signed' && preliminary.status !== 'completed') {
        return 'Το Προσύμφωνο πρέπει να είναι υπογεγραμμένο πριν δημιουργηθεί Οριστικό';
      }
      return null; // OK — είτε δεν υπάρχει preliminary (είναι optional) είτε είναι signed
    }

    if (phase === 'payoff') {
      // Payoff: απαιτεί signed final
      const finalContract = await this.getContractByPhase(unitId, 'final');
      if (!finalContract) {
        return 'Δεν υπάρχει Οριστικό Συμβόλαιο — δημιουργήστε πρώτα Οριστικό';
      }
      if (finalContract.status !== 'signed' && finalContract.status !== 'completed') {
        return 'Το Οριστικό Συμβόλαιο πρέπει να είναι υπογεγραμμένο πριν δημιουργηθεί Εξοφλητήριο';
      }
      return null;
    }

    return null;
  }

  /**
   * Ενημερώνει unit.commercial.legalPhase στο Firestore.
   */
  private static async updateUnitLegalPhase(
    unitId: string,
    legalPhase: LegalPhase
  ): Promise<void> {
    try {
      const db = getDb();
      await db.collection(COLLECTIONS.UNITS).doc(unitId).update({
        'commercial.legalPhase': legalPhase,
      });
      logger.info(`[LegalContractService] Unit ${unitId} legalPhase → ${legalPhase}`);
    } catch (error) {
      logger.error('[LegalContractService] Failed to update unit legalPhase:', error);
    }
  }

  /**
   * Human-readable label για φάση.
   */
  private static phaseLabel(phase: ContractPhase): string {
    const labels: Record<ContractPhase, string> = {
      preliminary: 'Προσύμφωνο',
      final: 'Οριστικό Συμβόλαιο',
      payoff: 'Εξοφλητήριο',
    };
    return labels[phase];
  }
}

export default LegalContractService;
