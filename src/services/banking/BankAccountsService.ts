'use client';

/**
 * @fileoverview Bank Accounts Service
 * @description Enterprise-grade CRUD service for bank accounts subcollection
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-01
 * @version 1.0.0
 * @compliance CLAUDE.md Enterprise Standards
 *
 * Firestore Structure:
 * contacts/{contactId}/bankAccounts/{accountId}
 *
 * @see BankAccount type in @/types/contacts/banking
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
  serverTimestamp,
  onSnapshot,
  type Unsubscribe,
  type DocumentData,
  type QueryDocumentSnapshot
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type {
  BankAccount,
  BankAccountInput,
  BankAccountUpdate
} from '@/types/contacts/banking';
import { validateIBAN, cleanIBAN } from '@/types/contacts/banking';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('BankAccountsService');

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Firestore subcollection name for bank accounts
 */
const BANK_ACCOUNTS_SUBCOLLECTION = 'bankAccounts';

/**
 * Main contacts collection name
 */
const CONTACTS_COLLECTION = 'contacts';

// ============================================================================
// FIRESTORE CONVERTERS
// ============================================================================

/**
 * Convert Firestore document to BankAccount
 */
function docToBankAccount(
  docSnapshot: QueryDocumentSnapshot<DocumentData>
): BankAccount {
  const data = docSnapshot.data();
  return {
    id: docSnapshot.id,
    bankName: data.bankName ?? '',
    bankCode: data.bankCode,
    iban: data.iban ?? '',
    accountNumber: data.accountNumber,
    accountType: data.accountType ?? 'checking',
    currency: data.currency ?? 'EUR',
    isPrimary: data.isPrimary ?? false,
    holderName: data.holderName,
    notes: data.notes,
    isActive: data.isActive ?? true,
    createdAt: data.createdAt?.toDate() ?? new Date(),
    updatedAt: data.updatedAt?.toDate() ?? new Date()
  };
}

/**
 * Convert BankAccountInput to Firestore data
 */
function bankAccountToDoc(
  account: BankAccountInput
): Record<string, unknown> {
  return {
    bankName: account.bankName,
    bankCode: account.bankCode ?? null,
    iban: cleanIBAN(account.iban),
    accountNumber: account.accountNumber ?? null,
    accountType: account.accountType,
    currency: account.currency,
    isPrimary: account.isPrimary,
    holderName: account.holderName ?? null,
    notes: account.notes ?? null,
    isActive: account.isActive
  };
}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

/**
 * Bank Accounts Service
 *
 * Manages bank account CRUD operations for contacts.
 * Uses Firestore subcollections for data isolation.
 *
 * @example
 * ```typescript
 * // Get all accounts for a contact
 * const accounts = await BankAccountsService.getAccounts('contact123');
 *
 * // Add a new account
 * const accountId = await BankAccountsService.addAccount('contact123', {
 *   bankName: 'Εθνική Τράπεζα',
 *   iban: 'GR1601101250000000012300695',
 *   accountType: 'checking',
 *   currency: 'EUR',
 *   isPrimary: true,
 *   isActive: true
 * });
 * ```
 */
export class BankAccountsService {
  /**
   * Get the subcollection reference for a contact's bank accounts
   */
  private static getAccountsCollection(contactId: string) {
    return collection(db, CONTACTS_COLLECTION, contactId, BANK_ACCOUNTS_SUBCOLLECTION);
  }

  /**
   * Get a specific account document reference
   */
  private static getAccountDoc(contactId: string, accountId: string) {
    return doc(db, CONTACTS_COLLECTION, contactId, BANK_ACCOUNTS_SUBCOLLECTION, accountId);
  }

  // ==========================================================================
  // READ OPERATIONS
  // ==========================================================================

  /**
   * Get all bank accounts for a contact
   *
   * @param contactId - The contact ID
   * @param includeInactive - Whether to include inactive accounts (default: false)
   * @returns Array of bank accounts sorted by isPrimary desc, then createdAt desc
   */
  static async getAccounts(
    contactId: string,
    includeInactive = false
  ): Promise<BankAccount[]> {
    try {
      const accountsRef = this.getAccountsCollection(contactId);

      let q;
      if (includeInactive) {
        q = query(accountsRef, orderBy('createdAt', 'desc'));
      } else {
        q = query(
          accountsRef,
          where('isActive', '==', true),
          orderBy('createdAt', 'desc')
        );
      }

      const snapshot = await getDocs(q);
      const accounts = snapshot.docs.map(docToBankAccount);

      // Sort: primary first, then by creation date
      return accounts.sort((a, b) => {
        if (a.isPrimary && !b.isPrimary) return -1;
        if (!a.isPrimary && b.isPrimary) return 1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
    } catch (error) {
      logger.error('[BankAccountsService] Error getting accounts:', error);
      throw error;
    }
  }

  /**
   * Get a single bank account by ID
   *
   * @param contactId - The contact ID
   * @param accountId - The account ID
   * @returns The bank account or null if not found
   */
  static async getAccount(
    contactId: string,
    accountId: string
  ): Promise<BankAccount | null> {
    try {
      const docRef = this.getAccountDoc(contactId, accountId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return docToBankAccount(docSnap as QueryDocumentSnapshot<DocumentData>);
    } catch (error) {
      logger.error('[BankAccountsService] Error getting account:', error);
      throw error;
    }
  }

  /**
   * Get the primary bank account for a contact
   *
   * @param contactId - The contact ID
   * @returns The primary bank account or null if none exists
   */
  static async getPrimaryAccount(contactId: string): Promise<BankAccount | null> {
    try {
      const accountsRef = this.getAccountsCollection(contactId);
      const q = query(
        accountsRef,
        where('isPrimary', '==', true),
        where('isActive', '==', true)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return null;
      }

      return docToBankAccount(snapshot.docs[0]);
    } catch (error) {
      logger.error('[BankAccountsService] Error getting primary account:', error);
      throw error;
    }
  }

  // ==========================================================================
  // CREATE OPERATIONS
  // ==========================================================================

  /**
   * Add a new bank account for a contact
   *
   * @param contactId - The contact ID
   * @param account - The account data
   * @returns The new account ID
   * @throws Error if IBAN validation fails
   */
  static async addAccount(
    contactId: string,
    account: BankAccountInput
  ): Promise<string> {
    try {
      // Validate IBAN
      const ibanValidation = validateIBAN(account.iban);
      if (!ibanValidation.valid) {
        throw new Error(ibanValidation.error || 'Invalid IBAN');
      }

      const accountsRef = this.getAccountsCollection(contactId);

      // If this is set as primary, unset other primary accounts first
      if (account.isPrimary) {
        await this.unsetAllPrimary(contactId);
      }

      // Check for duplicate IBAN
      const cleanedIban = cleanIBAN(account.iban);
      const existingAccounts = await this.getAccounts(contactId, true);
      const duplicateIban = existingAccounts.find(
        acc => cleanIBAN(acc.iban) === cleanedIban
      );

      if (duplicateIban) {
        throw new Error('Αυτό το IBAN υπάρχει ήδη για αυτή την επαφή');
      }

      // Create the document
      const docData = {
        ...bankAccountToDoc(account),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(accountsRef, docData);

      logger.info(`[BankAccountsService] Created account ${docRef.id} for contact ${contactId}`);

      return docRef.id;
    } catch (error) {
      logger.error('[BankAccountsService] Error adding account:', error);
      throw error;
    }
  }

  // ==========================================================================
  // UPDATE OPERATIONS
  // ==========================================================================

  /**
   * Update an existing bank account
   *
   * @param contactId - The contact ID
   * @param accountId - The account ID
   * @param updates - Partial account data to update
   */
  static async updateAccount(
    contactId: string,
    accountId: string,
    updates: BankAccountUpdate
  ): Promise<void> {
    try {
      // Validate IBAN if it's being updated
      if (updates.iban) {
        const ibanValidation = validateIBAN(updates.iban);
        if (!ibanValidation.valid) {
          throw new Error(ibanValidation.error || 'Invalid IBAN');
        }

        // Check for duplicate IBAN (excluding current account)
        const cleanedIban = cleanIBAN(updates.iban);
        const existingAccounts = await this.getAccounts(contactId, true);
        const duplicateIban = existingAccounts.find(
          acc => acc.id !== accountId && cleanIBAN(acc.iban) === cleanedIban
        );

        if (duplicateIban) {
          throw new Error('Αυτό το IBAN υπάρχει ήδη για αυτή την επαφή');
        }
      }

      const docRef = this.getAccountDoc(contactId, accountId);

      // If setting as primary, unset other primary accounts first
      if (updates.isPrimary) {
        await this.unsetAllPrimary(contactId, accountId);
      }

      // Build update data
      const updateData: Record<string, unknown> = {
        updatedAt: serverTimestamp()
      };

      // Add non-undefined fields
      if (updates.bankName !== undefined) updateData.bankName = updates.bankName;
      if (updates.bankCode !== undefined) updateData.bankCode = updates.bankCode ?? null;
      if (updates.iban !== undefined) updateData.iban = cleanIBAN(updates.iban);
      if (updates.accountNumber !== undefined) updateData.accountNumber = updates.accountNumber ?? null;
      if (updates.accountType !== undefined) updateData.accountType = updates.accountType;
      if (updates.currency !== undefined) updateData.currency = updates.currency;
      if (updates.isPrimary !== undefined) updateData.isPrimary = updates.isPrimary;
      if (updates.holderName !== undefined) updateData.holderName = updates.holderName ?? null;
      if (updates.notes !== undefined) updateData.notes = updates.notes ?? null;
      if (updates.isActive !== undefined) updateData.isActive = updates.isActive;

      await updateDoc(docRef, updateData);

      logger.info(`[BankAccountsService] Updated account ${accountId} for contact ${contactId}`);
    } catch (error) {
      logger.error('[BankAccountsService] Error updating account:', error);
      throw error;
    }
  }

  /**
   * Set a specific account as the primary account
   *
   * @param contactId - The contact ID
   * @param accountId - The account ID to set as primary
   */
  static async setPrimaryAccount(
    contactId: string,
    accountId: string
  ): Promise<void> {
    try {
      // Unset all other primary accounts
      await this.unsetAllPrimary(contactId, accountId);

      // Set this account as primary
      const docRef = this.getAccountDoc(contactId, accountId);
      await updateDoc(docRef, {
        isPrimary: true,
        updatedAt: serverTimestamp()
      });

      logger.info(`[BankAccountsService] Set account ${accountId} as primary for contact ${contactId}`);
    } catch (error) {
      logger.error('[BankAccountsService] Error setting primary account:', error);
      throw error;
    }
  }

  /**
   * Toggle account active status
   *
   * @param contactId - The contact ID
   * @param accountId - The account ID
   * @param isActive - The new active status
   */
  static async toggleAccountActive(
    contactId: string,
    accountId: string,
    isActive: boolean
  ): Promise<void> {
    try {
      const docRef = this.getAccountDoc(contactId, accountId);
      await updateDoc(docRef, {
        isActive,
        updatedAt: serverTimestamp()
      });

      logger.info(`[BankAccountsService] Set account ${accountId} active=${isActive} for contact ${contactId}`);
    } catch (error) {
      logger.error('[BankAccountsService] Error toggling account active:', error);
      throw error;
    }
  }

  // ==========================================================================
  // DELETE OPERATIONS
  // ==========================================================================

  /**
   * Delete a bank account
   *
   * @param contactId - The contact ID
   * @param accountId - The account ID to delete
   */
  static async deleteAccount(
    contactId: string,
    accountId: string
  ): Promise<void> {
    try {
      const docRef = this.getAccountDoc(contactId, accountId);
      await deleteDoc(docRef);

      logger.info(`[BankAccountsService] Deleted account ${accountId} for contact ${contactId}`);
    } catch (error) {
      logger.error('[BankAccountsService] Error deleting account:', error);
      throw error;
    }
  }

  /**
   * Delete all bank accounts for a contact
   * Used when deleting a contact
   *
   * @param contactId - The contact ID
   */
  static async deleteAllAccounts(contactId: string): Promise<void> {
    try {
      const accounts = await this.getAccounts(contactId, true);

      if (accounts.length === 0) {
        return;
      }

      const batch = writeBatch(db);

      for (const account of accounts) {
        const docRef = this.getAccountDoc(contactId, account.id);
        batch.delete(docRef);
      }

      await batch.commit();

      logger.info(`[BankAccountsService] Deleted ${accounts.length} accounts for contact ${contactId}`);
    } catch (error) {
      logger.error('[BankAccountsService] Error deleting all accounts:', error);
      throw error;
    }
  }

  // ==========================================================================
  // REAL-TIME SUBSCRIPTIONS
  // ==========================================================================

  /**
   * Subscribe to bank accounts changes for a contact
   *
   * @param contactId - The contact ID
   * @param callback - Callback function called with updated accounts
   * @returns Unsubscribe function
   */
  static subscribeToAccounts(
    contactId: string,
    callback: (accounts: BankAccount[]) => void
  ): Unsubscribe {
    const accountsRef = this.getAccountsCollection(contactId);
    const q = query(
      accountsRef,
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const accounts = snapshot.docs.map(docToBankAccount);

      // Sort: primary first, then by creation date
      const sortedAccounts = accounts.sort((a, b) => {
        if (a.isPrimary && !b.isPrimary) return -1;
        if (!a.isPrimary && b.isPrimary) return 1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      callback(sortedAccounts);
    }, (error) => {
      logger.error('[BankAccountsService] Subscription error:', error);
    });
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Unset isPrimary for all accounts except the specified one
   */
  private static async unsetAllPrimary(
    contactId: string,
    exceptAccountId?: string
  ): Promise<void> {
    const accountsRef = this.getAccountsCollection(contactId);
    const q = query(accountsRef, where('isPrimary', '==', true));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return;
    }

    const batch = writeBatch(db);

    for (const docSnap of snapshot.docs) {
      if (docSnap.id !== exceptAccountId) {
        batch.update(docSnap.ref, {
          isPrimary: false,
          updatedAt: serverTimestamp()
        });
      }
    }

    await batch.commit();
  }
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default BankAccountsService;
