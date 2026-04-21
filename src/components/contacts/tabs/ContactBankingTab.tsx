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

import React, { useState, useEffect, useCallback, useId } from 'react';
import { useRegisterEditFocus } from '@/components/contacts/details/contact-details/ContactEditFocusContext';
import { useTranslation } from 'react-i18next';
import '@/lib/design-system';
import type { Contact } from '@/types/contacts';
import { getContactDisplayName } from '@/types/contacts/helpers';
import type { BankAccount, BankAccountInput } from '@/types/contacts/banking';
import { BankAccountsService } from '@/services/banking';
import {
  addBankAccountWithPolicy,
  deleteBankAccountWithPolicy,
  setPrimaryBankAccountWithPolicy,
  updateBankAccountWithPolicy,
} from '@/services/banking/bank-account-mutation-gateway';
import { BankAccountCard } from '@/components/banking/BankAccountCard';
import { BankAccountForm } from '@/components/banking/BankAccountForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Plus, Building2, CreditCard } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useNotifications } from '@/providers/NotificationProvider';
import { createModuleLogger } from '@/lib/telemetry';
import { groupByKey } from '@/utils/collection-utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { createStaleCache } from '@/lib/stale-cache';
import {
  buildDeleteDescription,
  buildSensitiveEditDescription,
  buildSetPrimaryDescription,
} from './contact-banking-descriptions';

const logger = createModuleLogger('ContactBankingTab');

// ADR-300: module-level cache keyed by contactId
const bankAccountsCache = createStaleCache<BankAccount[]>('contact-banking');

interface ContactBankingTabProps {
  data: Contact;
  additionalData?: {
    disabled?: boolean;
  };
}

function hasSensitiveBankingChanges(existing: BankAccount, next: BankAccountInput): boolean {
  return (
    existing.bankName !== next.bankName
    || existing.bankCode !== next.bankCode
    || existing.iban !== next.iban
    || existing.holderName !== next.holderName
    || existing.isPrimary !== next.isPrimary
  );
}

export function ContactBankingTab({
  data,
  additionalData,
}: ContactBankingTabProps) {
  const { t } = useTranslation(['contacts', 'contacts-banking', 'contacts-core', 'contacts-form', 'contacts-lifecycle', 'contacts-relationships']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const { success, error: notifyError, info } = useNotifications();
  const { confirm, dialogProps } = useConfirmDialog();
  const disabled = additionalData?.disabled ?? false;

  const contactId = data.id;

  const [accounts, setAccounts] = useState<BankAccount[]>(bankAccountsCache.get(contactId) ?? []);
  const [loading, setLoading] = useState(!bankAccountsCache.hasLoaded(contactId));
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | undefined>();
  const [deletingAccount, setDeletingAccount] = useState<BankAccount | null>(null);
  const [primaryAccountCandidate, setPrimaryAccountCandidate] = useState<BankAccount | null>(null);
  const activeAccountsCount = accounts.filter((account) => account.isActive).length;

  // ADR-317: DOM form id so the adaptive header Save can trigger requestSubmit().
  const bankingFormId = useId();

  const loadAccounts = useCallback(async () => {
    if (!contactId) {
      setLoading(false);
      return;
    }

    try {
      if (!bankAccountsCache.hasLoaded(contactId)) setLoading(true);
      setError(null);
      const loadedAccounts = await BankAccountsService.getAccounts(contactId);
      bankAccountsCache.set(loadedAccounts, contactId);
      setAccounts(loadedAccounts);
    } catch (err) {
      logger.error('[ContactBankingTab] Error loading accounts:', { error: err });
      setError(t('bankingTab.errors.loadError'));
    } finally {
      setLoading(false);
    }
  }, [contactId, t]);

  useEffect(() => {
    if (!contactId) return;

    const unsubscribe = BankAccountsService.subscribeToAccounts(
      contactId,
      (updatedAccounts) => {
        bankAccountsCache.set(updatedAccounts, contactId);
        setAccounts(updatedAccounts);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [contactId]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const handleAdd = () => {
    setEditingAccount(undefined);
    setIsFormOpen(true);
  };

  const handleEdit = (account: BankAccount) => {
    setEditingAccount(account);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (account: BankAccount) => {
    setDeletingAccount(account);
  };

  const handleDeleteConfirm = async () => {
    if (!contactId || !deletingAccount) return;

    try {
      setActionLoading(true);
      await deleteBankAccountWithPolicy({ contactId, accountId: deletingAccount.id });
      success(t('bankingTab.toasts.deleted', { bankName: deletingAccount.bankName }));
      info(
        t(
          deletingAccount.isPrimary
            ? 'bankingTab.impact.primaryDeleted'
            : 'bankingTab.impact.deleted',
        ),
      );
    } catch (err) {
      logger.error('[ContactBankingTab] Error deleting account:', { error: err });
      notifyError(t('bankingTab.toasts.deleteError'));
    } finally {
      setActionLoading(false);
      setDeletingAccount(null);
    }
  };

  const handleSetPrimaryClick = (account: BankAccount) => {
    setPrimaryAccountCandidate(account);
  };

  const handleSetPrimaryConfirm = async () => {
    if (!contactId || !primaryAccountCandidate) return;

    try {
      setActionLoading(true);
      await setPrimaryBankAccountWithPolicy({
        contactId,
        accountId: primaryAccountCandidate.id,
      });
      success(t('bankingTab.toasts.setPrimary', { bankName: primaryAccountCandidate.bankName }));
      info(t('bankingTab.impact.primaryApplied'));
    } catch (err) {
      logger.error('[ContactBankingTab] Error setting primary:', { error: err });
      notifyError(t('bankingTab.toasts.setPrimaryError'));
    } finally {
      setActionLoading(false);
      setPrimaryAccountCandidate(null);
    }
  };

  const handleFormSubmit = async (formData: BankAccountInput) => {
    if (!contactId) return;

    const isSensitiveEdit = editingAccount
      ? hasSensitiveBankingChanges(editingAccount, formData)
      : false;
    const becomesPrimary = editingAccount
      ? !editingAccount.isPrimary && formData.isPrimary
      : formData.isPrimary;

    if (editingAccount && (isSensitiveEdit || becomesPrimary)) {
      const shouldProceed = await confirm({
        title: t('bankingTab.editImpact.title'),
        description: buildSensitiveEditDescription(isSensitiveEdit, becomesPrimary, t, colors.text.muted),
        variant: becomesPrimary ? 'warning' : 'default',
        confirmText: t('bankingTab.editImpact.confirm'),
        cancelText: t('bankingTab.deleteAccount.cancel'),
      });

      if (!shouldProceed) {
        return;
      }
    }

    try {
      setActionLoading(true);

      if (editingAccount) {
        await updateBankAccountWithPolicy({
          contactId,
          accountId: editingAccount.id,
          updates: formData,
        });
        success(t('bankingTab.toasts.updated', { bankName: formData.bankName }));

        if (becomesPrimary) {
          info(t('bankingTab.impact.primaryApplied'));
        } else if (isSensitiveEdit) {
          info(t('bankingTab.impact.updatedSensitive'));
        }
      } else {
        await addBankAccountWithPolicy({ contactId, account: formData });
        success(t('bankingTab.toasts.created', { bankName: formData.bankName }));

        if (formData.isPrimary) {
          info(t('bankingTab.impact.createdPrimary'));
        }
      }

      setIsFormOpen(false);
      setEditingAccount(undefined);
    } catch (err) {
      // BankAccountForm surfaces the message to the user via errors.submit;
      // no need to log this as an application error (avoids Next.js error overlay for user-correctable validation).
      logger.warn('[ContactBankingTab] Account save rejected', { error: err });
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const handleFormCancel = useCallback(() => {
    setIsFormOpen(false);
    setEditingAccount(undefined);
  }, []);

  // ADR-317: Register as the active edit focus while the inline form is open.
  // The adaptive header owns Save/Cancel and delegates to this form.
  const submitBankingForm = useCallback(() => {
    const formEl = typeof document !== 'undefined' ? document.getElementById(bankingFormId) : null;
    if (formEl instanceof HTMLFormElement) {
      formEl.requestSubmit();
    }
  }, [bankingFormId]);

  useRegisterEditFocus(
    isFormOpen
      ? {
          id: `banking-form-${contactId}`,
          label: editingAccount ? t('bankingTab.editAccount.title') : t('bankingTab.newAccount.title'),
          submit: submitBankingForm,
          cancel: handleFormCancel,
          loading: actionLoading,
        }
      : null,
  );

  const accountsByBank = groupByKey(accounts, (account) => account.bankName);
  const deletingIsLastActive = deletingAccount?.isActive === true && activeAccountsCount === 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={() => void loadAccounts()} className="mt-2">
          {t('bankingTab.retry')}
        </Button>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="space-y-2">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCard
              size={iconSizes.numeric.xl}
              className={cn('mb-2', colors.text.muted)}
            />
            <h3 className="text-lg font-medium mb-2">
              {t('bankingTab.empty.title')}
            </h3>
            <p className={cn('text-center mb-2 max-w-md', colors.text.muted)}>
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

        {isFormOpen && (
          <Card>
            <CardContent className="pt-2">
              <header className="mb-2">
                <h3 className="text-lg font-medium">{t('bankingTab.newAccount.title')}</h3>
                <p className={cn('text-sm', colors.text.muted)}>
                  {t('bankingTab.newAccount.description')}
                </p>
              </header>
              <BankAccountForm
                onSubmit={handleFormSubmit}
                onCancel={handleFormCancel}
                loading={actionLoading}
                contactName={getContactDisplayName(data)}
                formId={bankingFormId}
                hideActions
              />
            </CardContent>
          </Card>
        )}

        <ConfirmDialog {...dialogProps} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
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

      <div className="space-y-2">
        {Object.entries(accountsByBank).map(([bankName, bankAccounts]) => (
          <div key={bankName} className="space-y-2">
            {Object.keys(accountsByBank).length > 1 && (
              <h4 className={cn('text-sm font-medium flex items-center gap-2', colors.text.muted)}>
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
                  onSetPrimary={handleSetPrimaryClick}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {isFormOpen && (
        <Card className="border-primary/30">
          <CardContent className="pt-2">
            <header className="mb-2">
              <h3 className="text-lg font-medium">
                {editingAccount ? t('bankingTab.editAccount.title') : t('bankingTab.newAccount.title')}
              </h3>
              <p className={cn('text-sm', colors.text.muted)}>
                {editingAccount
                  ? t('bankingTab.editAccount.description')
                  : t('bankingTab.newAccount.description')}
              </p>
            </header>
            <BankAccountForm
              account={editingAccount}
              onSubmit={handleFormSubmit}
              onCancel={handleFormCancel}
              contactName={getContactDisplayName(data)}
              loading={actionLoading}
              formId={bankingFormId}
              hideActions
            />
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={!!deletingAccount}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingAccount(null);
          }
        }}
        title={t('bankingTab.deleteAccount.title')}
        description={buildDeleteDescription(deletingAccount, deletingIsLastActive, t, colors.text.muted)}
        onConfirm={handleDeleteConfirm}
        confirmText={t('bankingTab.deleteAccount.delete')}
        cancelText={t('bankingTab.deleteAccount.cancel')}
        variant="destructive"
        loading={actionLoading}
      />

      <ConfirmDialog
        open={!!primaryAccountCandidate}
        onOpenChange={(open) => {
          if (!open) {
            setPrimaryAccountCandidate(null);
          }
        }}
        title={t('bankingTab.setPrimaryDialog.title')}
        description={buildSetPrimaryDescription(primaryAccountCandidate, t, colors.text.muted)}
        onConfirm={handleSetPrimaryConfirm}
        confirmText={t('bankingTab.setPrimaryDialog.confirm')}
        cancelText={t('bankingTab.setPrimaryDialog.cancel')}
        variant="warning"
        loading={actionLoading}
      />

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}

export default ContactBankingTab;
