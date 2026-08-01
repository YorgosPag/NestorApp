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
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ADR-742 §4 — οι **τρεις** έλεγχοι ιδιοκτησίας ρωτούν τον SSoT
 * ─────────────────────────────────────────────────────────────────────────────
 * Μέχρι τις 2026-08-01 και οι τρεις έγραφαν σκέτο `!==` πάνω σε
 * `snap.data() as BrokerageAgreement`: **ο τύπος υπόσχεται, η βάση δεν
 * εγγυάται**. Συμφωνητικό αποθηκευμένο χωρίς `companyId` (ή με κενό) και καλών
 * με χαλασμένο token ταίριαζαν. *Το κενό δεν είναι μισθωτής, είναι **απουσία**
 * μισθωτή.* Η πολιτική αποκάλυψης (`'Access denied'` προς το route) είναι
 * **σωστή και δεν άλλαξε** — άλλαξε μόνο η **σύγκριση** (§3.4).
 *
 * @module services/brokerage-server.service
 * @enterprise ADR-252 - Security Audit (server-side write enforcement)
 */
import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
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
} from '@/types/brokerage';
import {
  validateAgreementFields,
  validateCommissionFields,
  validateExclusivityServer,
} from './brokerage-exclusivity.helper';
import { nowISO } from '@/lib/date-local';

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
// ΤΑ ΔΥΟ ΚΟΙΝΑ ΒΗΜΑΤΑ (N.18 / CHECK 3.28)
// ============================================================================
//
// Τα δύο μπλοκ παρακάτω ήταν γραμμένα **δύο φορές** το καθένα. Δεν το είδε
// κανείς όσο ήταν 11-12 γραμμές· φάνηκαν όταν ο έλεγχος ιδιοκτησίας του
// ADR-742 §4 πρόσθεσε **δύο** γραμμές (import + σχόλιο) και τα έσπρωξε πάνω
// από τα 50 tokens του jscpd. Το ADR-742 το έχει ήδη καταγράψει τρεις φορές:
// *η κεντρικοποίηση γεννά κλώνο*. Η απάντηση είναι **εξαγωγή**, ποτέ χαλάρωση
// κατωφλιού — αλλιώς ο επόμενος που αλλάξει τον έναν αδελφό αφήνει τον άλλο.

/** Το αποτέλεσμα του {@link loadOwnedAgreement} — ή έγγραφο, ή άρνηση, ποτέ και τα δύο. */
type AgreementLoad =
  | {
      readonly docRef: FirebaseFirestore.DocumentReference;
      readonly current: BrokerageAgreement;
      readonly refusal?: undefined;
    }
  | {
      readonly refusal: { success: false; error: string };
      readonly docRef?: undefined;
      readonly current?: undefined;
    };

/**
 * Φέρε το συμφωνητικό και **αμέσως** κρίνε το — μία αλυσίδα, δύο καλούντες.
 *
 * 🔴 Ο κίνδυνος δεν ήταν οι γραμμές· ήταν η **σειρά** (ADR-742 §7.1). Αντίγραφο
 * που φορτώνει, δουλεύει, και ρωτά «δικό μου;» στο τέλος απαντά κανονικά — έχει
 * όμως ήδη διαβάσει ξένο έγγραφο, και **κανένα test του φύλακα δεν το πιάνει**,
 * γιατί ο φύλακας *κλήθηκε*, απλώς αργά. Ενωμένα, η σειρά παύει να είναι θέμα
 * προσοχής.
 *
 * ⚠️ Η **πολιτική αποκάλυψης δεν άλλαξε**: τα δύο «όχι» μένουν διακριτά
 * (`'Agreement not found'` vs `'Access denied'`), όπως το δηλώνει ρητά η κεφαλίδα
 * αυτού του module. Εδώ ενοποιείται η **αλυσίδα**, όχι το λεξιλόγιο — αν κάποτε
 * αποφασιστεί μεταμφίεση κατά §3.3, θα αλλάξει **αυτή** η συνάρτηση, μία φορά.
 */
async function loadOwnedAgreement(id: string, companyId: string): Promise<AgreementLoad> {
  const docRef = getDb().collection(COLLECTIONS.BROKERAGE_AGREEMENTS).doc(id);
  const snap = await docRef.get();

  if (!snap.exists) {
    return { refusal: { success: false, error: 'Agreement not found' } };
  }

  const current = { id: snap.id, ...snap.data() } as BrokerageAgreement;

  if (!isPayloadOwnedByCompany(current, companyId)) {
    return { refusal: { success: false, error: 'Access denied' } };
  }

  return { docRef, current };
}

/**
 * Η **μία** μετάφραση «η επικύρωση αποκλειστικότητας είπε όχι» → απάντηση.
 *
 * Επιστρέφει `null` όταν η επικύρωση περνά, ώστε ο καλών να γράφει έναν έλεγχο
 * αντί για δύο. Το `validation` ταξιδεύει **ολόκληρο** προς τα έξω: το UI δείχνει
 * όλα τα ζητήματα, όχι μόνο το πρώτο σφάλμα που μπαίνει στο `error`.
 */
function exclusivityRefusal(
  validation: ExclusivityValidationResult,
): { success: false; error: string; validation: ExclusivityValidationResult } | null {
  if (validation.canProceed) return null;

  const firstError = validation.issues.find((i) => i.severity === 'error');
  return {
    success: false,
    error: firstError?.messageKey ?? 'Exclusivity conflict',
    validation,
  };
}

// Exclusivity validation extracted to brokerage-exclusivity.helper.ts (Google SRP)

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
          propertyId: input.propertyId ?? null,
          scope: input.scope,
          exclusivity: input.exclusivity,
        },
        companyId
      );
      const refusal = exclusivityRefusal(validation);
      if (refusal) return refusal;

      const id = generateBrokerageId();
      const now = nowISO();

      const agreement: BrokerageAgreement = {
        id,
        agentContactId: input.agentContactId,
        agentName: input.agentName,
        scope: input.scope,
        projectId: input.projectId,
        propertyId: input.propertyId ?? null,
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
      'commissionFixedAmount' | 'startDate' | 'endDate' | 'notes' | 'scope' | 'propertyId'
    >>,
    companyId: string,
    updatedBy: string
  ): Promise<{ success: boolean; error?: string; validation?: ExclusivityValidationResult }> {
    try {
      const loaded = await loadOwnedAgreement(id, companyId);
      if (loaded.refusal) return loaded.refusal;
      const { docRef, current } = loaded;

      // If exclusivity, scope, or propertyId change → re-validate
      const needsValidation = updates.exclusivity !== undefined
        || updates.scope !== undefined
        || updates.propertyId !== undefined;

      if (needsValidation) {
        const mergedScope = updates.scope ?? current.scope;
        const mergedPropertyId = updates.propertyId !== undefined ? updates.propertyId : current.propertyId;
        const mergedExclusivity = updates.exclusivity ?? current.exclusivity;

        const validation = await validateExclusivityServer(
          {
            projectId: current.projectId,
            propertyId: mergedPropertyId,
            scope: mergedScope,
            exclusivity: mergedExclusivity,
            excludeAgreementId: id,
          },
          companyId
        );

        const refusal = exclusivityRefusal(validation);
        if (refusal) return refusal;
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

      const now = nowISO();
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
      const loaded = await loadOwnedAgreement(id, companyId);
      if (loaded.refusal) return loaded.refusal;
      const { docRef } = loaded;

      const now = nowISO();
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
      const now = nowISO();

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
        propertyId: input.propertyId,
        projectId: input.projectId,
        primaryBuyerContactId: input.primaryBuyerContactId,
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
      if (!isPayloadOwnedByCompany(current, companyId)) {
        return { success: false, error: 'Access denied' };
      }

      const now = nowISO();
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
