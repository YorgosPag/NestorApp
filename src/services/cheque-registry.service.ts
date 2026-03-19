/**
 * =============================================================================
 * ChequeRegistryService — Cheque Lifecycle Management (ADR-234 Phase 3)
 * =============================================================================
 *
 * Enterprise cheque registry: CRUD, FSM transitions, endorsement, bounce,
 * replacement, and auto PaymentRecord creation on clearing.
 *
 * Uses Admin SDK — called exclusively from API routes.
 * Firestore: top-level `cheques/{chequeId}` collection.
 *
 * @module services/cheque-registry.service
 * @enterprise ADR-234 Phase 3 — SPEC-234A
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { generateChequeId, generatePaymentRecordId } from '@/services/enterprise-id.service';
import type { PaymentRecord } from '@/types/payment-plan';
import type {
  ChequeRecord,
  ChequeStatus,
  CreateChequeInput,
  UpdateChequeInput,
  ChequeTransitionInput,
  EndorseInput,
  BounceInput,
} from '@/types/cheque-registry';
import {
  createDefaultChequeRecord,
  isValidChequeTransition,
  isTerminalChequeStatus,
} from '@/types/cheque-registry';

const logger = createModuleLogger('ChequeRegistryService');

// ============================================================================
// HELPERS
// ============================================================================

function getDb() {
  const db = getAdminFirestore();
  if (!db) throw new Error('Admin Firestore unavailable');
  return db;
}

function chequeCollectionPath(): string {
  return COLLECTIONS.CHEQUES;
}

function paymentCollectionPath(unitId: string): string {
  return `${COLLECTIONS.UNITS}/${unitId}/${SUBCOLLECTIONS.UNIT_PAYMENTS}`;
}

// ============================================================================
// RESULT TYPES
// ============================================================================

interface ServiceResult {
  success: boolean;
  error?: string;
}

interface ChequeResult extends ServiceResult {
  cheque?: ChequeRecord;
}

interface ChequesResult extends ServiceResult {
  cheques?: ChequeRecord[];
}

// ============================================================================
// VALIDATION CONSTANTS
// ============================================================================

const MAX_CHEQUE_AMOUNT = 500_000;

// ============================================================================
// CHEQUE REGISTRY SERVICE
// ============================================================================

export class ChequeRegistryService {

  // ==========================================================================
  // READ
  // ==========================================================================

  /** Get all cheques for a unit (query top-level cheques by context.unitId) */
  static async getChequesByUnit(unitId: string): Promise<ChequesResult> {
    try {
      const db = getDb();
      const snapshot = await db
        .collection(chequeCollectionPath())
        .where('context.unitId', '==', unitId)
        .orderBy(FIELDS.CREATED_AT, 'desc')
        .get();

      const cheques = snapshot.docs.map(doc => doc.data() as ChequeRecord);
      return { success: true, cheques };
    } catch (error) {
      logger.error('[ChequeRegistryService] Failed to get cheques:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  /** Get single cheque by ID */
  static async getCheque(chequeId: string): Promise<ChequeResult> {
    try {
      const db = getDb();
      const doc = await db.collection(chequeCollectionPath()).doc(chequeId).get();

      if (!doc.exists) {
        return { success: false, error: `Cheque ${chequeId} not found` };
      }

      return { success: true, cheque: doc.data() as ChequeRecord };
    } catch (error) {
      logger.error('[ChequeRegistryService] Failed to get cheque:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  // ==========================================================================
  // CREATE
  // ==========================================================================

  /** Create a new cheque */
  static async createCheque(
    unitId: string,
    input: CreateChequeInput,
    createdBy: string
  ): Promise<ChequeResult> {
    try {
      // V-CHQ-001: chequeNumber required
      if (!input.chequeNumber?.trim()) {
        return { success: false, error: 'Ο αριθμός επιταγής είναι υποχρεωτικός' };
      }

      // V-CHQ-002: amount > 0, max €500,000
      if (!input.amount || input.amount <= 0) {
        return { success: false, error: 'Το ποσό πρέπει να είναι θετικό' };
      }
      if (input.amount > MAX_CHEQUE_AMOUNT) {
        return { success: false, error: `Το ποσό δεν μπορεί να υπερβαίνει τα €${MAX_CHEQUE_AMOUNT.toLocaleString('el-GR')}` };
      }

      // V-CHQ-003: maturityDate ≥ issueDate
      if (input.maturityDate < input.issueDate) {
        return { success: false, error: 'Η ημερομηνία λήξης πρέπει να είναι μετά ή ίση με την ημερομηνία έκδοσης' };
      }

      // Required fields
      if (!input.bankName?.trim()) {
        return { success: false, error: 'Η τράπεζα είναι υποχρεωτική' };
      }
      if (!input.drawerName?.trim()) {
        return { success: false, error: 'Ο εκδότης είναι υποχρεωτικός' };
      }

      const chequeId = generateChequeId();
      const cheque = createDefaultChequeRecord(chequeId, input, unitId, createdBy);

      const db = getDb();
      await db.collection(chequeCollectionPath()).doc(chequeId).set(cheque);

      logger.info(`[ChequeRegistryService] Created cheque ${chequeId} (${input.chequeNumber}) for unit ${unitId}`);
      return { success: true, cheque };
    } catch (error) {
      logger.error('[ChequeRegistryService] Failed to create cheque:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  /** Update mutable fields (non-terminal only) */
  static async updateCheque(
    chequeId: string,
    input: UpdateChequeInput,
    updatedBy: string
  ): Promise<ServiceResult> {
    try {
      const db = getDb();
      const docRef = db.collection(chequeCollectionPath()).doc(chequeId);
      const doc = await docRef.get();

      if (!doc.exists) return { success: false, error: `Cheque ${chequeId} not found` };

      const cheque = doc.data() as ChequeRecord;

      if (isTerminalChequeStatus(cheque.status)) {
        return { success: false, error: 'Δεν μπορεί να τροποποιηθεί επιταγή σε τερματική κατάσταση' };
      }

      const now = new Date().toISOString();
      const updates: Record<string, string | boolean | null> = {
        updatedAt: now,
        updatedBy,
      };

      if (input.bankBranch !== undefined) updates.bankBranch = input.bankBranch ?? null;
      if (input.drawerTaxId !== undefined) updates.drawerTaxId = input.drawerTaxId ?? null;
      if (input.accountNumber !== undefined) updates.accountNumber = input.accountNumber ?? null;
      if (input.crossedCheque !== undefined) updates.crossedCheque = input.crossedCheque;
      if (input.notes !== undefined) updates.notes = input.notes ?? null;
      if (input.depositBankName !== undefined) updates.depositBankName = input.depositBankName ?? null;
      if (input.depositAccountNumber !== undefined) updates.depositAccountNumber = input.depositAccountNumber ?? null;

      await docRef.update(updates);

      logger.info(`[ChequeRegistryService] Updated cheque ${chequeId}`);
      return { success: true };
    } catch (error) {
      logger.error('[ChequeRegistryService] Failed to update cheque:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  // ==========================================================================
  // FSM TRANSITION
  // ==========================================================================

  /** Transition cheque status with FSM validation + auto-dates */
  static async transitionStatus(
    chequeId: string,
    input: ChequeTransitionInput,
    updatedBy: string
  ): Promise<ServiceResult> {
    try {
      const db = getDb();
      const docRef = db.collection(chequeCollectionPath()).doc(chequeId);
      const doc = await docRef.get();

      if (!doc.exists) return { success: false, error: `Cheque ${chequeId} not found` };

      const cheque = doc.data() as ChequeRecord;

      // FSM validation
      if (!isValidChequeTransition(cheque.status, input.targetStatus)) {
        return {
          success: false,
          error: `Μη έγκυρη μετάβαση: ${cheque.status} → ${input.targetStatus}`,
        };
      }

      const now = new Date().toISOString();
      const updates: Record<string, string | null> = {
        status: input.targetStatus,
        updatedAt: now,
        updatedBy,
      };

      if (input.notes !== undefined) updates.notes = input.notes ?? null;

      // Auto-populate dates based on target status
      switch (input.targetStatus) {
        case 'deposited':
          // V-CHQ-004: depositDate ≤ today
          updates.depositDate = input.depositDate ?? now.split('T')[0];
          if (input.depositBankName) updates.depositBankName = input.depositBankName;
          if (input.depositAccountNumber) updates.depositAccountNumber = input.depositAccountNumber;
          break;

        case 'cleared':
          updates.clearingDate = input.clearingDate ?? now.split('T')[0];
          break;
      }

      // If cleared → auto-create PaymentRecord
      if (input.targetStatus === 'cleared' && cheque.context.unitId) {
        const paymentId = generatePaymentRecordId();
        updates.paymentId = paymentId;

        const paymentRecord: PaymentRecord = {
          id: paymentId,
          paymentPlanId: cheque.context.paymentPlanId ?? '',
          installmentIndex: 0,
          amount: cheque.amount,
          method: cheque.chequeType,
          paymentDate: input.clearingDate ?? now.split('T')[0],
          methodDetails: {
            method: cheque.chequeType,
            chequeNumber: cheque.chequeNumber,
            bankName: cheque.bankName,
            issueDate: cheque.issueDate,
            maturityDate: cheque.maturityDate,
            drawerName: cheque.drawerName,
          },
          splitAllocations: [{ installmentIndex: 0, amount: cheque.amount }],
          overpaymentAmount: 0,
          invoiceId: null,
          transactionChainId: null,
          notes: `Εκκαθάριση επιταγής ${cheque.chequeNumber}`,
          createdAt: now,
          createdBy: updatedBy,
          updatedAt: now,
        };

        // Batch: update cheque + create payment
        const batch = db.batch();
        batch.update(docRef, updates);
        batch.set(
          db.collection(paymentCollectionPath(cheque.context.unitId)).doc(paymentId),
          paymentRecord
        );
        await batch.commit();

        logger.info(`[ChequeRegistryService] Cheque ${chequeId} cleared → PaymentRecord ${paymentId} created`);
        return { success: true };
      }

      await docRef.update(updates);

      logger.info(`[ChequeRegistryService] Cheque ${chequeId}: ${cheque.status} → ${input.targetStatus}`);
      return { success: true };
    } catch (error) {
      logger.error('[ChequeRegistryService] Failed to transition cheque:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  // ==========================================================================
  // ENDORSE
  // ==========================================================================

  /** Endorse cheque (append to endorsement chain) */
  static async endorseCheque(
    chequeId: string,
    input: EndorseInput,
    updatedBy: string
  ): Promise<ServiceResult> {
    try {
      // V-CHQ-007: endorser ≠ endorsee
      if (input.endorserName.trim().toLowerCase() === input.endorseeName.trim().toLowerCase()) {
        return { success: false, error: 'Ο οπισθογράφος δεν μπορεί να είναι ίδιος με τον αποδέκτη' };
      }

      const db = getDb();
      const docRef = db.collection(chequeCollectionPath()).doc(chequeId);
      const doc = await docRef.get();

      if (!doc.exists) return { success: false, error: `Cheque ${chequeId} not found` };

      const cheque = doc.data() as ChequeRecord;

      // Only received or in_custody can be endorsed
      if (!isValidChequeTransition(cheque.status, 'endorsed')) {
        return { success: false, error: `Δεν μπορεί να οπισθογραφηθεί σε κατάσταση: ${cheque.status}` };
      }

      const now = new Date().toISOString();
      const newEntry: EndorsementEntry = {
        order: cheque.endorsementChain.length + 1,
        endorserName: input.endorserName.trim(),
        endorseeName: input.endorseeName.trim(),
        endorsementDate: input.endorsementDate,
        notes: input.notes ?? null,
      };

      await docRef.update({
        status: 'endorsed',
        endorsementChain: [...cheque.endorsementChain, newEntry],
        updatedAt: now,
        updatedBy,
      });

      logger.info(`[ChequeRegistryService] Cheque ${chequeId} endorsed to ${input.endorseeName}`);
      return { success: true };
    } catch (error) {
      logger.error('[ChequeRegistryService] Failed to endorse cheque:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  // ==========================================================================
  // BOUNCE
  // ==========================================================================

  /** Mark cheque as bounced */
  static async bounceCheque(
    chequeId: string,
    input: BounceInput,
    updatedBy: string
  ): Promise<ServiceResult> {
    try {
      // V-CHQ-006: bouncedReason required
      if (!input.bouncedReason) {
        return { success: false, error: 'Ο λόγος σφράγισης είναι υποχρεωτικός' };
      }

      const db = getDb();
      const docRef = db.collection(chequeCollectionPath()).doc(chequeId);
      const doc = await docRef.get();

      if (!doc.exists) return { success: false, error: `Cheque ${chequeId} not found` };

      const cheque = doc.data() as ChequeRecord;

      if (!isValidChequeTransition(cheque.status, 'bounced')) {
        return { success: false, error: `Δεν μπορεί να σφραγιστεί σε κατάσταση: ${cheque.status}` };
      }

      const now = new Date().toISOString();

      await docRef.update({
        status: 'bounced',
        bouncedDate: input.bouncedDate ?? now.split('T')[0],
        bouncedReason: input.bouncedReason,
        bouncedNotes: input.bouncedNotes ?? null,
        teiresiasFiled: input.teiresiasFiled ?? false,
        teiresiasFiledDate: input.teiresiasFiledDate ?? null,
        policeCaseFiled: input.policeCaseFiled ?? false,
        policeCaseFiledDate: input.policeCaseFiledDate ?? null,
        policeCaseReference: input.policeCaseReference ?? null,
        updatedAt: now,
        updatedBy,
      });

      logger.info(`[ChequeRegistryService] Cheque ${chequeId} bounced: ${input.bouncedReason}`);
      return { success: true };
    } catch (error) {
      logger.error('[ChequeRegistryService] Failed to bounce cheque:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  // ==========================================================================
  // REPLACE BOUNCED
  // ==========================================================================

  /** Replace a bounced cheque with a new one */
  static async replaceBounced(
    chequeId: string,
    replacementInput: CreateChequeInput,
    unitId: string,
    createdBy: string
  ): Promise<ChequeResult> {
    try {
      const db = getDb();
      const oldDocRef = db.collection(chequeCollectionPath()).doc(chequeId);
      const oldDoc = await oldDocRef.get();

      if (!oldDoc.exists) return { success: false, error: `Cheque ${chequeId} not found` };

      const oldCheque = oldDoc.data() as ChequeRecord;

      if (oldCheque.status !== 'bounced' && oldCheque.status !== 'expired') {
        return { success: false, error: 'Μόνο σφραγισμένες ή ληγμένες επιταγές μπορούν να αντικατασταθούν' };
      }

      // V-CHQ-008: replacement amount ≥ bounced amount
      if (replacementInput.amount < oldCheque.amount) {
        return { success: false, error: `Το ποσό αντικατάστασης (€${replacementInput.amount}) πρέπει να είναι ≥ €${oldCheque.amount}` };
      }

      // Create new cheque
      const newChequeId = generateChequeId();
      const newCheque = createDefaultChequeRecord(newChequeId, replacementInput, unitId, createdBy);
      newCheque.replacesChequeId = chequeId;

      const now = new Date().toISOString();

      // Batch: create new + mark old as replaced
      const batch = db.batch();
      batch.set(db.collection(chequeCollectionPath()).doc(newChequeId), newCheque);
      batch.update(oldDocRef, {
        status: 'replaced',
        replacedByChequeId: newChequeId,
        updatedAt: now,
        updatedBy: createdBy,
      });
      await batch.commit();

      logger.info(`[ChequeRegistryService] Cheque ${chequeId} replaced by ${newChequeId}`);
      return { success: true, cheque: newCheque };
    } catch (error) {
      logger.error('[ChequeRegistryService] Failed to replace cheque:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  }
}

export default ChequeRegistryService;
