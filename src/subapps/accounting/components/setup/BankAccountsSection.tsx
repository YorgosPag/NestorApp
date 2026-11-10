'use client';

/**
 * @fileoverview Ρυθμίσεις — Τραπεζικοί λογαριασμοί της εταιρείας (ADR-ACC-008 §2 · ADR-ACC-018 §15)
 * @description Το ΕΝΑ μητρώο λογαριασμών: συμφωνία τράπεζας + οδηγίες πληρωμής τιμολογίων. Όσοι σημειωθούν
 *   «Στα τιμολόγια» τυπώνονται (ο προεπιλεγμένος πρώτος, έως 3) σε τιμολόγια που πληρώνονται με μεταφορά.
 *   Αποθηκεύεται **αμέσως** ανά λογαριασμό (όχι με το «Αποθήκευση» του προφίλ) — κάθε αλλαγή αφήνει ίχνος.
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML, i18n
 */

import { useCallback, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HeaderBar } from '@/components/ui/header-bar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Landmark, Pencil, Plus, Ban } from 'lucide-react';
import { formatIBAN } from '@/types/contacts/banking';
import type { BankAccountConfig } from '../../types';
import { useCompanyBankAccounts, type UseCompanyBankAccountsReturn } from '../../hooks/useCompanyBankAccounts';
import { BankAccountDialog } from './BankAccountDialog';
import { createInputOf, updateInputOf, type BankAccountFormState } from './bank-account-form-state';

interface BankAccountsSectionProps {
  /** Η επωνυμία της εταιρείας — προτεινόμενος δικαιούχος για νέο λογαριασμό */
  defaultHolderName: string;
}

/** Ο διάλογος νέου / επεξεργασίας: ποιος λογαριασμός, ανοιχτός ή όχι, και η αποστολή στο σωστό ρήμα. */
function useBankAccountEditor(
  createAccount: UseCompanyBankAccountsReturn['createAccount'],
  updateAccount: UseCompanyBankAccountsReturn['updateAccount'],
) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccountConfig | null>(null);

  const openDialog = (account: BankAccountConfig | null) => {
    setEditing(account);
    setDialogOpen(true);
  };

  const handleSubmit = useCallback(async (form: BankAccountFormState, target: BankAccountConfig | null) => {
    if (target) await updateAccount(target.accountId, updateInputOf(form));
    else await createAccount(createInputOf(form));
  }, [createAccount, updateAccount]);

  return { dialogOpen, setDialogOpen, editing, openDialog, handleSubmit };
}

export function BankAccountsSection({ defaultHolderName }: BankAccountsSectionProps) {
  const { t } = useTranslation('accounting');
  const { accounts, loading, loadFailed, refetch, createAccount, updateAccount, deactivateAccount } =
    useCompanyBankAccounts();
  const { dialogOpen, setDialogOpen, editing, openDialog, handleSubmit } = useBankAccountEditor(createAccount, updateAccount);
  const [retiring, setRetiring] = useState<BankAccountConfig | null>(null);

  return (
    <Card>
      <CardHeader>
        <HeaderBar
          actions={
            <Button type="button" size="sm" onClick={() => openDialog(null)}>
              <Plus className="mr-1 size-4" />
              {t('setup.bankAccounts.addNew')}
            </Button>
          }
        >
          <CardTitle className="flex items-center gap-2">
            <Landmark className="size-5" />
            {t('setup.bankAccounts.title')}
          </CardTitle>
        </HeaderBar>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('setup.bankAccounts.description')}</p>
        <BankAccountsList
          accounts={accounts} loading={loading} loadFailed={loadFailed} onRetry={refetch}
          onEdit={openDialog} onRetire={setRetiring}
        />
      </CardContent>
      <BankAccountDialog
        open={dialogOpen} onOpenChange={setDialogOpen} editing={editing}
        defaultHolderName={defaultHolderName} onSubmit={handleSubmit}
      />
      <BankAccountRetireDialog account={retiring} onClose={() => setRetiring(null)} deactivate={deactivateAccount} />
    </Card>
  );
}

interface BankAccountRetireDialogProps {
  /** `null` ⇒ κλειστό */
  account: BankAccountConfig | null;
  onClose: () => void;
  deactivate: (accountId: string) => Promise<BankAccountConfig>;
}

/** Επιβεβαίωση απενεργοποίησης — μένει ανοιχτή ώσπου να απαντήσει ο διακομιστής· αποτυχία ⇒ μήνυμα, όχι κλείσιμο. */
function BankAccountRetireDialog({ account, onClose, deactivate }: BankAccountRetireDialogProps) {
  const { t } = useTranslation('accounting');
  const [failed, setFailed] = useState(false);

  const handleConfirm = async () => {
    if (!account) return;
    try {
      await deactivate(account.accountId);
      setFailed(false);
      onClose();
    } catch {
      setFailed(true);
    }
  };

  return (
    <ConfirmDialog
      open={account !== null}
      onOpenChange={(open) => { if (!open) { setFailed(false); onClose(); } }}
      title={t('setup.bankAccounts.deactivateTitle')}
      description={t('setup.bankAccounts.deactivateDescription', { iban: account ? formatIBAN(account.iban) : '' })}
      confirmText={t('setup.bankAccounts.deactivateConfirm')}
      variant="destructive"
      keepOpenWhilePending
      onConfirm={handleConfirm}
    >
      {failed && <p role="alert" className="text-sm text-destructive">{t('setup.bankAccounts.errors.deactivateFailed')}</p>}
    </ConfirmDialog>
  );
}

interface BankAccountsListProps {
  accounts: BankAccountConfig[];
  loading: boolean;
  loadFailed: boolean;
  onRetry: () => Promise<void>;
  onEdit: (account: BankAccountConfig) => void;
  onRetire: (account: BankAccountConfig) => void;
}

function BankAccountsList({ accounts, loading, loadFailed, onRetry, onEdit, onRetire }: BankAccountsListProps) {
  const { t } = useTranslation('accounting');
  if (loading && accounts.length === 0) return <Spinner size="small" />;
  if (loadFailed) {
    return (
      <p role="alert" className="flex items-center gap-3 text-sm text-destructive">
        {t('setup.bankAccounts.loadFailed')}
        <Button type="button" variant="outline" size="sm" onClick={() => void onRetry()}>{t('setup.bankAccounts.retry')}</Button>
      </p>
    );
  }
  if (accounts.length === 0) return <p className="text-sm text-muted-foreground">{t('setup.bankAccounts.empty')}</p>;
  return (
    <ul className="divide-y rounded-md border" aria-label={t('setup.bankAccounts.listAriaLabel')}>
      {accounts.map((account) => (
        <BankAccountRow key={account.accountId} account={account} onEdit={onEdit} onRetire={onRetire} />
      ))}
    </ul>
  );
}

interface BankAccountRowProps {
  account: BankAccountConfig;
  onEdit: (account: BankAccountConfig) => void;
  onRetire: (account: BankAccountConfig) => void;
}

function BankAccountRow({ account, onEdit, onRetire }: BankAccountRowProps) {
  const { t } = useTranslation('accounting');
  const iban = formatIBAN(account.iban);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-3">
      <article className="min-w-0 space-y-1">
        <h4 className="font-medium">{account.label || account.bankName}</h4>
        <p className="font-mono text-sm">{iban}</p>
        <p className="text-xs text-muted-foreground">
          {[account.bankName, account.bankCode, account.holderName].filter(Boolean).join(' · ')}
        </p>
        <p className="flex flex-wrap gap-1">
          {account.showOnInvoices && <Badge variant="secondary">{t('setup.bankAccounts.badges.onInvoices')}</Badge>}
          {account.isDefaultForInvoices && <Badge>{t('setup.bankAccounts.badges.default')}</Badge>}
          {!account.isActive && <Badge variant="outline">{t('setup.bankAccounts.badges.inactive')}</Badge>}
        </p>
      </article>
      {account.isActive && (
        <nav className="flex gap-1">
          <Button type="button" variant="ghost" size="icon" onClick={() => onEdit(account)}
            aria-label={t('setup.bankAccounts.editAriaLabel', { iban })}>
            <Pencil className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => onRetire(account)}
            aria-label={t('setup.bankAccounts.deactivateAriaLabel', { iban })}>
            <Ban className="size-4" />
          </Button>
        </nav>
      )}
    </li>
  );
}
