import 'server-only';

/**
 * @fileoverview Bank Accounts Server-Side Service
 * @description Admin SDK service for secure bank account CRUD operations.
 * Routes all writes through server-side to enforce tenant isolation and validation.
 *
 * @author Claude Code (Anthropic AI) + Georgios Pagonis
 * @created 2026-03-20
 * @version 1.0.0
 * @see ADR-252 — Comprehensive Security Audit
 * @compliance CLAUDE.md Enterprise Standards
 *
 * Firestore Structure:
 * contacts/{contactId}/bank_accounts/{accountId}
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { generateBankAccountId } from '@/services/enterprise-id.service';
import { cleanIBAN, validateIBAN } from '@/types/contacts/banking';
import {
  validateAccountInput,
  validateAccountUpdate,
} from './bank-account-validation';
import type {
  BankAccountInput,
  BankAccountUpdate,
  CurrencyCode,
} from '@/types/contacts/banking';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';

const logger = createModuleLogger('BankAccountsServerService');

// ============================================================================
// TYPES
// ============================================================================

/** Result type for server operations — discriminated union */
interface SuccessResult<T = void> {
  success: true;
  data: T;
}

interface ErrorResult {
  success: false;
  error: string;
}

type ServiceResult<T = void> = SuccessResult<T> | ErrorResult;

/** Shape of the Firestore contact document for tenant check */
interface ContactDocData {
  companyId?: string;
  [key: string]: unknown;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// SSoT: Collection names from centralized config
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
const CONTACTS_COLLECTION = COLLECTIONS.CONTACTS;
const BANK_ACCOUNTS_SUBCOLLECTION = SUBCOLLECTIONS.BANK_ACCOUNTS;

// ============================================================================
// TENANT VERIFICATION
// ============================================================================

/**
 * Verify that the parent contact belongs to the requesting company.
 * Returns the contact data on success, or an error result.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ADR-742 §7octies — ΔΥΟ ΞΕΧΩΡΙΣΤΑ ΣΦΑΛΜΑΤΑ ΔΙΟΡΘΩΘΗΚΑΝ ΕΔΩ (2026-08-01)
 * ─────────────────────────────────────────────────────────────────────────────
 * **1. Ανοιχτή πόρτα, όχι απλώς μαντείο.** Ο έλεγχος έγραφε:
 *
 * ```ts
 * if (contactData?.companyId && contactData.companyId !== companyId)
 * ```
 *
 * Το πρώτο σκέλος σημαίνει: *«αν η επαφή **δεν έχει** companyId, μη ρωτήσεις
 * καν»*. Επαφή με κενό ή απόν `companyId` περνούσε ως **`success: true`** για
 * **οποιονδήποτε** καλούντα — και από εδώ περνούν και οι τρεις μεταλλάξεις
 * τραπεζικών λογαριασμών (`add`/`update`/`delete`), όχι μόνο αναγνώσεις. Είναι
 * αυτολεξεί το σφάλμα που η §7quinquies είχε ήδη κλείσει στο `rfq-service.ts` —
 * **ζωντανό σε δεύτερο αρχείο**, γιατί κανένα gate δεν συγκρίνει τα δύο.
 * Ρωτά πλέον {@link isPayloadOwnedByCompany}: **το κενό δεν είναι tenant, είναι
 * απουσία tenant** (§4).
 *
 * **2. Μαντείο ύπαρξης σε επίπεδο πόρου.** Η ανυπαρξία επέστρεφε
 * `'Contact not found'` (→ **404**) και η ξένη επαφή `'Access denied'`
 * (→ **403**), μέσω του `errorToStatus` των δύο διαδρομών. Δύο διακριτά σχήματα
 * για το **ίδιο** `contacts/{id}` που οι υπόλοιπες διαδρομές του πόρου
 * μεταμφιέζουν σε ενιαίο 404 ⇒ **μία διαδρομή που αποκλίνει τις ακυρώνει όλες**
 * (§7septies). Επιστρέφει πλέον **το ίδιο** `'Contact not found'` και στις δύο
 * περιπτώσεις· ο χάρτης `errorToStatus` το γυρίζει σε 404 χωρίς να αγγιχτεί.
 *
 * ⚠️ Το `'Access denied'` **δεν** χρησιμοποιείται πια από αυτή τη διαδρομή. Οι
 * δύο χάρτες το κρατούν για συμβατότητα με άλλα σφάλματα της υπηρεσίας.
 */
async function verifyContactTenant(
  contactId: string,
  companyId: string
): Promise<ServiceResult<ContactDocData>> {
  const db = getAdminFirestore();
  const contactSnap = await db.collection(CONTACTS_COLLECTION).doc(contactId).get();

  if (!contactSnap.exists) {
    return { success: false, error: 'Contact not found' };
  }

  const contactData = contactSnap.data() as ContactDocData | undefined;
  if (!isPayloadOwnedByCompany(contactData, companyId)) {
    return { success: false, error: 'Contact not found' };
  }

  return { success: true, data: contactData ?? {} };
}

const ACCOUNT_NOT_FOUND_MESSAGE = 'Bank account not found';

/**
 * Ανοίγει τον λογαριασμό **αν υπάρχει** — αλλιώς την έτοιμη άρνηση.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ (N.18 · CHECK 3.28)
 * ─────────────────────────────────────────────────────────────────────────────
 * Οι `updateAccount` και `deleteAccount` έγραφαν **αυτολεξεί** την ίδια τριάδα
 * «χτίσε τη διαδρομή → διάβασε → 404 αν λείπει» (jscpd: 15 γρ. / 64 tokens,
 * **μέσα στο ίδιο αρχείο**). Το πραγματικό ρίσκο δεν είναι οι γραμμές: είναι ότι
 * η **διαδρομή** `contacts/{id}/bank_accounts/{id}` ήταν γραμμένη δύο φορές, άρα
 * μπορούσε να αποκλίνει — και μια μετάλλαξη που γράφει σε λάθος υπο-συλλογή δεν
 * αποτυγχάνει θορυβωδώς, δημιουργεί έγγραφο.
 *
 * ⚠️ **Δεν** περιλαμβάνει τον έλεγχο μισθωτή: οι δύο καλούντες τον κάνουν σε
 * **διαφορετική σειρά** ως προς την επικύρωση εισόδου (`update` επικυρώνει
 * ανάμεσα, `delete` δεν έχει τι να επικυρώσει). Ενώνοντάς τα εδώ θα άλλαζε ποιο
 * σφάλμα βλέπει ο χρήστης όταν ισχύουν και τα δύο — σιωπηλή αλλαγή συμβολαίου.
 */
async function openExistingAccount(
  contactId: string,
  accountId: string,
): Promise<{ ref: FirebaseFirestore.DocumentReference } | { failure: ErrorResult }> {
  const ref = getAdminFirestore()
    .collection(CONTACTS_COLLECTION)
    .doc(contactId)
    .collection(BANK_ACCOUNTS_SUBCOLLECTION)
    .doc(accountId);

  const snap = await ref.get();
  if (!snap.exists) {
    return { failure: { success: false, error: ACCOUNT_NOT_FOUND_MESSAGE } };
  }

  return { ref };
}

// ============================================================================
// DUPLICATE IBAN CHECK
// ============================================================================

/**
 * Check if a cleaned IBAN already exists in the subcollection.
 * Optionally excludes a specific account ID (for update scenarios).
 */
async function checkDuplicateIBAN(
  contactId: string,
  cleanedIban: string,
  excludeAccountId?: string
): Promise<boolean> {
  const db = getAdminFirestore();
  const accountsRef = db
    .collection(CONTACTS_COLLECTION)
    .doc(contactId)
    .collection(BANK_ACCOUNTS_SUBCOLLECTION);

  const snapshot = await accountsRef.where('iban', '==', cleanedIban).get();

  if (snapshot.empty) {
    return false;
  }

  // If excluding an account (update case), check if match is only the same doc
  if (excludeAccountId) {
    return snapshot.docs.some((doc) => doc.id !== excludeAccountId);
  }

  return true;
}

// ============================================================================
// PRIMARY ACCOUNT MANAGEMENT
// ============================================================================

/**
 * Unset isPrimary for all accounts in a subcollection, except one optional ID.
 */
async function unsetAllPrimary(
  contactId: string,
  exceptAccountId?: string
): Promise<void> {
  const db = getAdminFirestore();
  const accountsRef = db
    .collection(CONTACTS_COLLECTION)
    .doc(contactId)
    .collection(BANK_ACCOUNTS_SUBCOLLECTION);

  const snapshot = await accountsRef.where('isPrimary', '==', true).get();

  if (snapshot.empty) {
    return;
  }

  const batch = db.batch();

  for (const doc of snapshot.docs) {
    if (doc.id !== exceptAccountId) {
      batch.update(doc.ref, {
        isPrimary: false,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  await batch.commit();
}

// ============================================================================
// SERVER SERVICE
// ============================================================================

/**
 * Bank Accounts Server Service
 *
 * All write operations go through Admin SDK with tenant isolation.
 * Called exclusively by API routes, never from client code.
 */
export const BankAccountsServerService = {
  /**
   * Add a new bank account to a contact's subcollection.
   *
   * @param contactId - Parent contact ID
   * @param data - Bank account input data
   * @param companyId - Requesting user's company ID (tenant isolation)
   * @param createdBy - UID of the creating user
   * @returns ServiceResult with the new account ID on success
   */
  async addAccount(
    contactId: string,
    data: BankAccountInput,
    companyId: string,
    createdBy: string,
    options?: { lenientIban?: boolean }
  ): Promise<ServiceResult<{ accountId: string }>> {
    try {
      const lenientIban = options?.lenientIban ?? false;

      // 1. Tenant check
      const tenantResult = await verifyContactTenant(contactId, companyId);
      if (!tenantResult.success) {
        return tenantResult;
      }

      // 2. Input validation (lenient IBAN skips MOD97 for AI-extracted accounts)
      const validationError = validateAccountInput(data, lenientIban);
      if (validationError) {
        return { success: false, error: validationError };
      }

      // 3. If lenient and IBAN checksum failed, flag for UI warning (no hardcoded text in DB)
      const ibanCheck = lenientIban ? validateIBAN(data.iban) : null;
      const ibanChecksumWarning = !!(ibanCheck && !ibanCheck.valid);

      // 4. Duplicate IBAN check
      const cleanedIban = cleanIBAN(data.iban);
      const isDuplicate = await checkDuplicateIBAN(contactId, cleanedIban);
      if (isDuplicate) {
        return { success: false, error: 'This IBAN already exists for this contact' };
      }

      // 5. If setting as primary, unset others first
      if (data.isPrimary) {
        await unsetAllPrimary(contactId);
      }

      // 6. Create document with enterprise ID
      const db = getAdminFirestore();
      const accountId = generateBankAccountId();
      const accountsRef = db
        .collection(CONTACTS_COLLECTION)
        .doc(contactId)
        .collection(BANK_ACCOUNTS_SUBCOLLECTION);

      const baseNotes = data.notes ?? null;
      const docData: Record<string, unknown> = {
        bankName: data.bankName.trim(),
        bankCode: data.bankCode ?? null,
        iban: cleanedIban,
        accountNumber: data.accountNumber ?? null,
        branch: data.branch ?? null,
        accountType: data.accountType,
        currency: data.currency as CurrencyCode,
        isPrimary: data.isPrimary,
        holderName: data.holderName ?? null,
        notes: baseNotes,
        ibanChecksumWarning: ibanChecksumWarning || null,
        isActive: data.isActive,
        createdBy,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      await accountsRef.doc(accountId).set(docData);

      logger.info('Bank account created', { contactId, accountId, createdBy });

      return { success: true, data: { accountId } };
    } catch (error) {
      const msg = getErrorMessage(error, 'Failed to create bank account');
      logger.error('addAccount error', { contactId, error: msg });
      return { success: false, error: msg };
    }
  },

  /**
   * Update an existing bank account.
   *
   * @param contactId - Parent contact ID
   * @param accountId - The bank account document ID
   * @param data - Partial update data
   * @param companyId - Requesting user's company ID (tenant isolation)
   * @returns ServiceResult
   */
  async updateAccount(
    contactId: string,
    accountId: string,
    data: BankAccountUpdate,
    companyId: string
  ): Promise<ServiceResult> {
    try {
      // 1. Tenant check
      const tenantResult = await verifyContactTenant(contactId, companyId);
      if (!tenantResult.success) {
        return tenantResult;
      }

      // 2. Input validation
      const validationError = validateAccountUpdate(data);
      if (validationError) {
        return { success: false, error: validationError };
      }

      // 3. Verify account exists
      const opened = await openExistingAccount(contactId, accountId);
      if ('failure' in opened) {
        return opened.failure;
      }
      const { ref: accountRef } = opened;

      // 4. Duplicate IBAN check (if IBAN is being changed)
      if (data.iban !== undefined) {
        const cleanedIban = cleanIBAN(data.iban);
        const isDuplicate = await checkDuplicateIBAN(contactId, cleanedIban, accountId);
        if (isDuplicate) {
          return { success: false, error: 'This IBAN already exists for this contact' };
        }
      }

      // 5. If setting as primary, unset others
      if (data.isPrimary) {
        await unsetAllPrimary(contactId, accountId);
      }

      // 6. Build update payload — only include defined fields
      const updatePayload: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (data.bankName !== undefined) updatePayload.bankName = data.bankName.trim();
      if (data.bankCode !== undefined) updatePayload.bankCode = data.bankCode ?? null;
      if (data.iban !== undefined) updatePayload.iban = cleanIBAN(data.iban);
      if (data.accountNumber !== undefined) updatePayload.accountNumber = data.accountNumber ?? null;
      if (data.branch !== undefined) updatePayload.branch = data.branch ?? null;
      if (data.accountType !== undefined) updatePayload.accountType = data.accountType;
      if (data.currency !== undefined) updatePayload.currency = data.currency;
      if (data.isPrimary !== undefined) updatePayload.isPrimary = data.isPrimary;
      if (data.holderName !== undefined) updatePayload.holderName = data.holderName ?? null;
      if (data.notes !== undefined) updatePayload.notes = data.notes ?? null;
      if (data.isActive !== undefined) updatePayload.isActive = data.isActive;

      await accountRef.update(updatePayload);

      logger.info('Bank account updated', { contactId, accountId });

      return { success: true, data: undefined };
    } catch (error) {
      const msg = getErrorMessage(error, 'Failed to update bank account');
      logger.error('updateAccount error', { contactId, accountId, error: msg });
      return { success: false, error: msg };
    }
  },

  /**
   * Soft-delete a bank account (set isActive: false).
   *
   * @param contactId - Parent contact ID
   * @param accountId - The bank account document ID
   * @param companyId - Requesting user's company ID (tenant isolation)
   * @returns ServiceResult
   */
  async deleteAccount(
    contactId: string,
    accountId: string,
    companyId: string
  ): Promise<ServiceResult> {
    try {
      // 1. Tenant check
      const tenantResult = await verifyContactTenant(contactId, companyId);
      if (!tenantResult.success) {
        return tenantResult;
      }

      // 2. Verify account exists
      const opened = await openExistingAccount(contactId, accountId);
      if ('failure' in opened) {
        return opened.failure;
      }
      const { ref: accountRef } = opened;

      // 3. Soft delete — set isActive to false
      await accountRef.update({
        isActive: false,
        isPrimary: false,
        updatedAt: FieldValue.serverTimestamp(),
      });

      logger.info('Bank account soft-deleted', { contactId, accountId });

      return { success: true, data: undefined };
    } catch (error) {
      const msg = getErrorMessage(error, 'Failed to delete bank account');
      logger.error('deleteAccount error', { contactId, accountId, error: msg });
      return { success: false, error: msg };
    }
  },
};
