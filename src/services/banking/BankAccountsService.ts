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
 * contacts/{contactId}/bank_accounts/{accountId}
 *
 * @see BankAccount type in @/types/contacts/banking
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  type Unsubscribe,
  type DocumentData,
  type QueryDocumentSnapshot
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { normalizeToDate } from '@/lib/date-local';
import type {
  BankAccount,
  BankAccountInput,
  BankAccountUpdate,
  CurrencyCode,
} from '@/types/contacts/banking';
import { isCurrencyCode } from '@/types/contacts/banking';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('BankAccountsService');

// ============================================================================
// CONSTANTS
// ============================================================================

// SSoT: Collection names from centralized config
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
const BANK_ACCOUNTS_SUBCOLLECTION = SUBCOLLECTIONS.BANK_ACCOUNTS;
const CONTACTS_COLLECTION = COLLECTIONS.CONTACTS;

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
    branch: data.branch,
    accountType: data.accountType ?? 'checking',
    currency: data.currency ?? 'EUR',
    isPrimary: data.isPrimary ?? false,
    holderName: data.holderName,
    notes: data.notes,
    isActive: data.isActive ?? true,
    createdAt: normalizeToDate(data.createdAt) ?? new Date(),
    updatedAt: normalizeToDate(data.updatedAt) ?? new Date()
  };
}

/**
 * Convert flat record (from firestoreQueryService) to BankAccount
 */
function recordToBankAccount(data: Record<string, unknown>): BankAccount {
  return {
    id: (data.id as string) ?? '',
    bankName: (data.bankName as string) ?? '',
    bankCode: data.bankCode as string | undefined,
    iban: (data.iban as string) ?? '',
    accountNumber: data.accountNumber as string | undefined,
    branch: data.branch as string | undefined,
    accountType: (data.accountType as BankAccount['accountType']) ?? 'checking',
    currency: isCurrencyCode(data.currency as string) ? (data.currency as CurrencyCode) : 'EUR',
    isPrimary: (data.isPrimary as boolean) ?? false,
    holderName: data.holderName as string | undefined,
    notes: data.notes as string | undefined,
    isActive: (data.isActive as boolean) ?? true,
    createdAt: normalizeToDate(data.createdAt) ?? new Date(),
    updatedAt: normalizeToDate(data.updatedAt) ?? new Date()
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

      // 🔒 companyId: N/A — subcollection contacts/{contactId}/bank_accounts,
      // tenant-isolated via path + Firestore rule `canAccessParentContact()`
      // (rules line ~1465). BankAccount schema has no companyId field.
      let q;
      if (includeInactive) {
        q = query(
          // 🔒 companyId: N/A — path-scoped subcollection, see block comment above.
          accountsRef,
          orderBy('createdAt', 'desc')
        );
      } else {
        q = query(
          // 🔒 companyId: N/A — path-scoped subcollection, see block comment above.
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
        // 🔒 companyId: N/A — subcollection contacts/{contactId}/bank_accounts,
        // tenant-isolated via path + Firestore rule `canAccessParentContact()`
        // (rules line ~1465). BankAccount schema has no companyId field.
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
  // CREATE OPERATIONS (routed through server-side API — ADR-252)
  // ==========================================================================

  /**
   * Add a new bank account for a contact via server-side API.
   *
   * @param contactId - The contact ID
   * @param account - The account data
   * @returns The new account ID
   * @throws Error if validation or API call fails
   */
  static async addAccount(
    contactId: string,
    account: BankAccountInput
  ): Promise<string> {
    try {
      const response = await fetch(`/api/contacts/${contactId}/bank-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(account),
      });

      const result: unknown = await response.json();
      const data = result as { success: boolean; accountId?: string; error?: string };

      if (!response.ok || !data.success) {
        const err = new Error(data.error ?? 'Failed to create bank account') as Error & { status?: number };
        err.status = response.status;
        throw err;
      }

      const accountId = data.accountId;
      if (!accountId) {
        throw new Error('Server did not return an account ID');
      }

      logger.info(`[BankAccountsService] Created account ${accountId} for contact ${contactId}`);
      return accountId;
    } catch (error) {
      const msg = getErrorMessage(error, 'Failed to create bank account');
      const status = (error as { status?: number } | null)?.status ?? 0;
      // 4xx = user-correctable validation → warn (kept out of Next.js error overlay).
      // Everything else (network, 5xx) → error.
      if (status >= 400 && status < 500) {
        logger.warn('[BankAccountsService] Account add rejected by server', { msg, status });
      } else {
        logger.error('[BankAccountsService] Error adding account:', msg);
      }
      throw new Error(msg);
    }
  }

  // ==========================================================================
  // UPDATE OPERATIONS
  // ==========================================================================

  /**
   * Update an existing bank account via server-side API.
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
      const response = await fetch(
        `/api/contacts/${contactId}/bank-accounts/${accountId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        }
      );

      const result: unknown = await response.json();
      const data = result as { success: boolean; error?: string };

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? 'Failed to update bank account');
      }

      logger.info(`[BankAccountsService] Updated account ${accountId} for contact ${contactId}`);
    } catch (error) {
      const msg = getErrorMessage(error, 'Failed to update bank account');
      logger.error('[BankAccountsService] Error updating account:', msg);
      throw new Error(msg);
    }
  }

  /**
   * Set a specific account as the primary account via server-side API.
   *
   * @param contactId - The contact ID
   * @param accountId - The account ID to set as primary
   */
  static async setPrimaryAccount(
    contactId: string,
    accountId: string
  ): Promise<void> {
    await this.updateAccount(contactId, accountId, { isPrimary: true });
    logger.info(`[BankAccountsService] Set account ${accountId} as primary for contact ${contactId}`);
  }

  /**
   * Toggle account active status via server-side API.
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
    await this.updateAccount(contactId, accountId, { isActive });
    logger.info(`[BankAccountsService] Set account ${accountId} active=${isActive} for contact ${contactId}`);
  }

  // ==========================================================================
  // DELETE OPERATIONS
  // ==========================================================================

  /**
   * Soft-delete a bank account via server-side API (sets isActive: false).
   *
   * @param contactId - The contact ID
   * @param accountId - The account ID to soft-delete
   */
  static async deleteAccount(
    contactId: string,
    accountId: string
  ): Promise<void> {
    try {
      const response = await fetch(
        `/api/contacts/${contactId}/bank-accounts/${accountId}`,
        {
          method: 'DELETE',
        }
      );

      const result: unknown = await response.json();
      const data = result as { success: boolean; error?: string };

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? 'Failed to delete bank account');
      }

      logger.info(`[BankAccountsService] Soft-deleted account ${accountId} for contact ${contactId}`);
    } catch (error) {
      const msg = getErrorMessage(error, 'Failed to delete bank account');
      logger.error('[BankAccountsService] Error deleting account:', msg);
      throw new Error(msg);
    }
  }

  /**
   * Delete all bank accounts for a contact.
   * Iterates and soft-deletes each account via the server-side API.
   *
   * @param contactId - The contact ID
   */
  static async deleteAllAccounts(contactId: string): Promise<void> {
    try {
      const accounts = await this.getAccounts(contactId, true);

      if (accounts.length === 0) {
        return;
      }

      // Soft-delete each account sequentially via API
      for (const account of accounts) {
        await this.deleteAccount(contactId, account.id);
      }

      logger.info(`[BankAccountsService] Soft-deleted ${accounts.length} accounts for contact ${contactId}`);
    } catch (error) {
      const msg = getErrorMessage(error, 'Failed to delete all bank accounts');
      logger.error('[BankAccountsService] Error deleting all accounts:', msg);
      throw new Error(msg);
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
    return firestoreQueryService.subscribeSubcollection<DocumentData>(
      'CONTACTS',
      contactId,
      'bank_accounts',
      (result) => {
        const accounts = result.documents.map(d => recordToBankAccount(d as Record<string, unknown>));

        // Sort: primary first, then by creation date
        const sortedAccounts = accounts.sort((a, b) => {
          if (a.isPrimary && !b.isPrimary) return -1;
          if (!a.isPrimary && b.isPrimary) return 1;
          return b.createdAt.getTime() - a.createdAt.getTime();
        });

        callback(sortedAccounts);
      },
      (error) => {
        logger.error('[BankAccountsService] Subscription error:', error);
      },
      {
        constraints: [where('isActive', '==', true), orderBy('createdAt', 'desc')],
      }
    );
  }

}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default BankAccountsService;
