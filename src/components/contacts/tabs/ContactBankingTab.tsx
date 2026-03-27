'use client';

/**
 * @fileoverview Contact Banking Tab Component
 * @description Tab for managing contact bank accounts
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-01
 * @version 1.0.0
 * @compliance CLAUDE.md Enterprise Standards
 *
 * @see BankAccountsService for CRUD operations
 * @see BankAccount type in @/types/contacts/banking
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import '@/lib/design-system';
import type { Contact } from '@/types/contacts';
import { getContactDisplayName } from '@/types/contacts/helpers';
import type { BankAccount, BankAccountInput } from '@/types/contacts/banking';
import { BankAccountsService } from '@/services/banking';
import { BankAccountCard } from '@/components/banking/BankAccountCard';
import { BankAccountForm } from '@/components/banking/BankAccountForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Plus, Building2, CreditCard } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useNotifications } from '@/providers/NotificationProvider';
import { createModuleLogger } from '@/lib/telemetry';
import { groupByKey } from '@/utils/collection-utils';
const logger = createModuleLogger('ContactBankingTab');

// ============================================================================
// TYPES
// ============================================================================

interface ContactBankingTabProps {
  /** The contact data */
  data: Contact;
  /** Additional data passed by UniversalTabsRenderer */
  additionalData?: {
    disabled?: boolean;
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Contact Banking Tab Component
 *
 * Features:
 * - List all bank accounts for a contact
 * - Add new bank accounts
 * - Edit existing accounts
 * - Delete accounts with confirmation
 * - Set primary account
 * - Real-time sync with Firestore
 *
 * @example
 * ```tsx
 * <ContactBankingTab
 *   data={contact}
 *   additionalData={{ disabled: false }}
 * />
 * ```
 */
export function ContactBankingTab({
  data,
  additionalData
}: ContactBankingTabProps) {
  const { t } = useTranslation('contacts');
  const iconSizes = useIconSizes();
  const { success, error: notifyError } = useNotifications();
  const disabled = additionalData?.disabled ?? false;

  // State
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | undefined>();
  const [deletingAccount, setDeletingAccount] = useState<BankAccount | null>(null);

  // Contact ID check
  const contactId = data.id;

  // Load accounts
  const loadAccounts = useCallback(async () => {
    if (!contactId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const loadedAccounts = await BankAccountsService.getAccounts(contactId);
      setAccounts(loadedAccounts);
    } catch (err) {
      logger.error('[ContactBankingTab] Error loading accounts:', { error: err });
      setError('Σφάλμα φόρτωσης λογαριασμών');
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!contactId) return;

    const unsubscribe = BankAccountsService.subscribeToAccounts(
      contactId,
      (updatedAccounts) => {
        setAccounts(updatedAccounts);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [contactId]);

  // Initial load
  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Handle add account
  const handleAdd = () => {
    setEditingAccount(undefined);
    setIsFormOpen(true);
  };

  // Handle edit account
  const handleEdit = (account: BankAccount) => {
    setEditingAccount(account);
    setIsFormOpen(true);
  };

  // Handle delete confirmation
  const handleDeleteClick = (account: BankAccount) => {
    setDeletingAccount(account);
  };

  // Handle actual delete
  const handleDeleteConfirm = async () => {
    if (!contactId || !deletingAccount) return;

    try {
      setActionLoading(true);
      await BankAccountsService.deleteAccount(contactId, deletingAccount.id);
      success(`Ο λογαριασμός ${deletingAccount.bankName} διαγράφηκε επιτυχώς.`);
    } catch (err) {
      logger.error('[ContactBankingTab] Error deleting account:', { error: err });
      notifyError('Δεν ήταν δυνατή η διαγραφή του λογαριασμού.');
    } finally {
      setActionLoading(false);
      setDeletingAccount(null);
    }
  };

  // Handle set primary
  const handleSetPrimary = async (account: BankAccount) => {
    if (!contactId) return;

    try {
      setActionLoading(true);
      await BankAccountsService.setPrimaryAccount(contactId, account.id);
      success(`Ο λογαριασμός ${account.bankName} ορίστηκε ως κύριος.`);
    } catch (err) {
      logger.error('[ContactBankingTab] Error setting primary:', { error: err });
      notifyError('Δεν ήταν δυνατός ο ορισμός κύριου λογαριασμού.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle form submit
  const handleFormSubmit = async (formData: BankAccountInput) => {
    if (!contactId) return;

    try {
      setActionLoading(true);

      if (editingAccount) {
        // Update existing
        await BankAccountsService.updateAccount(contactId, editingAccount.id, formData);
        success(`Ο λογαριασμός ${formData.bankName} ενημερώθηκε επιτυχώς.`);
      } else {
        // Create new
        await BankAccountsService.addAccount(contactId, formData);
        success(`Ο λογαριασμός ${formData.bankName} προστέθηκε επιτυχώς.`);
      }

      setIsFormOpen(false);
      setEditingAccount(undefined);
    } catch (err) {
      logger.error('[ContactBankingTab] Error saving account:', { error: err });
      throw err; // Let form handle error display
    } finally {
      setActionLoading(false);
    }
  };

  // Handle form cancel
  const handleFormCancel = () => {
    setIsFormOpen(false);
    setEditingAccount(undefined);
  };

  // Group accounts by bank — ADR-207
  const accountsByBank = groupByKey(accounts, account => account.bankName);

  // Render loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="large" />
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={loadAccounts} className="mt-2">
          {t('bankingTab.retry')}
        </Button>
      </div>
    );
  }

  // Render empty state
  if (accounts.length === 0) {
    return (
      <div className="space-y-2">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCard
              size={iconSizes.numeric.xl}
              className="text-muted-foreground mb-2"
            />
            <h3 className="text-lg font-medium mb-2">
              {t('bankingTab.empty.title')}
            </h3>
            <p className="text-muted-foreground text-center mb-2 max-w-md">
              {t('bankingTab.empty.description')}
            </p>
            {!disabled && (
              <Button onClick={handleAdd}>
                <Plus size={iconSizes.numeric.sm} className="mr-2" />
                {t('bankingTab.addAccount')}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Inline Form */}
        {isFormOpen && (
          <Card>
            <CardContent className="pt-2">
              <header className="mb-2">
                <h3 className="text-lg font-medium">{t('bankingTab.newAccount.title')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('bankingTab.newAccount.description')}
                </p>
              </header>
              <BankAccountForm
                onSubmit={handleFormSubmit}
                onCancel={handleFormCancel}
                loading={actionLoading}
                contactName={getContactDisplayName(data)}
              />
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Render accounts
  return (
    <div className="space-y-2">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 size={iconSizes.numeric.md} className="text-primary" />
          <h3 className="text-lg font-medium">
            {t('bankingTab.accountsTitle')} ({accounts.length})
          </h3>
        </div>
        {!disabled && (
          <Button onClick={handleAdd}>
            <Plus size={iconSizes.numeric.sm} className="mr-2" />
            {t('bankingTab.add')}
          </Button>
        )}
      </div>

      {/* Accounts grouped by bank */}
      <div className="space-y-2">
        {Object.entries(accountsByBank).map(([bankName, bankAccounts]) => (
          <div key={bankName} className="space-y-2">
            {Object.keys(accountsByBank).length > 1 && (
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building2 size={iconSizes.numeric.sm} />
                {bankName}
              </h4>
            )}
            <div className="space-y-2">
              {bankAccounts.map((account) => (
                <BankAccountCard
                  key={account.id}
                  account={account}
                  editable={!disabled}
                  onEdit={handleEdit}
                  onDelete={handleDeleteClick}
                  onSetPrimary={handleSetPrimary}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Inline Form */}
      {isFormOpen && (
        <Card className="border-primary/30">
          <CardContent className="pt-2">
            <header className="mb-2">
              <h3 className="text-lg font-medium">
                {editingAccount ? 'Επεξεργασία Λογαριασμού' : 'Νέος Λογαριασμός'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {editingAccount
                  ? 'Τροποποιήστε τα στοιχεία του τραπεζικού λογαριασμού.'
                  : 'Προσθέστε τα στοιχεία του τραπεζικού λογαριασμού.'}
              </p>
            </header>
            <BankAccountForm
              account={editingAccount}
              onSubmit={handleFormSubmit}
              onCancel={handleFormCancel}
              contactName={getContactDisplayName(data)}
              loading={actionLoading}
            />
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingAccount}
        onOpenChange={(open) => !open && setDeletingAccount(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('bankingTab.deleteAccount.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('bankingTab.deleteAccount.confirmation')}{' '}
              <strong>{deletingAccount?.bankName}</strong> {t('bankingTab.deleteAccount.withIban')}{' '}
              <code className="text-xs">{deletingAccount?.iban}</code>;
              <br />
              <br />
              {t('bankingTab.deleteAccount.irreversible')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>{t('bankingTab.deleteAccount.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? (
                <Spinner size="small" color="inherit" className="mr-2" />
              ) : null}
              {t('bankingTab.deleteAccount.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ContactBankingTab;
