'use client';

/**
 * @fileoverview Ρυθμίσεις — Τραπεζικοί λογαριασμοί της εταιρείας (ADR-ACC-008 §2 · ADR-ACC-018 §15)
 * @description Το ΕΝΑ μητρώο λογαριασμών: συμφωνία τράπεζας + οδηγίες πληρωμής τιμολογίων. Όσοι σημειωθούν
 *   «Στα τιμολόγια» τυπώνονται (ο προεπιλεγμένος πρώτος, έως 3) σε τιμολόγια που πληρώνονται με μεταφορά.
 *   Αποθηκεύεται **αμέσως** ανά λογαριασμό (όχι με το «Αποθήκευση» του προφίλ) — κάθε αλλαγή αφήνει ίχνος.
 *   Οι ανενεργοί μένουν ορατοί σε ξεχωριστή, συμπτυγμένη ομάδα (πρακτική Xero «Archived»), με επανενεργοποίηση.
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Landmark, Pencil, Plus, Ban, RotateCcw, ChevronDown } from 'lucide-react';
import { formatIBAN } from '@/types/contacts/banking';
import type { BankAccountConfig } from '../../types';
import {
  BankAccountMutationError, useCompanyBankAccounts, type UseCompanyBankAccountsReturn,
} from '../../hooks/useCompanyBankAccounts';
import { BankAccountDialog } from './BankAccountDialog';
import { createInputOf, updateInputOf, type BankAccountFormState } from './bank-account-form-state';

interface BankAccountsSectionProps {
  /** Η επωνυμία της εταιρείας — προτεινόμενος δικαιούχος για νέο λογαριασμό */
  defaultHolderName: string;
}

/** Ποιος λογαριασμός αλλάζει κατάσταση, και προς τα πού. */
interface StatusChange {
  account: BankAccountConfig;
  kind: 'deactivate' | 'reactivate';
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
  const { accounts, loading, loadFailed, refetch, createAccount, updateAccount, deactivateAccount, reactivateAccount } =
    useCompanyBankAccounts();
  const { dialogOpen, setDialogOpen, editing, openDialog, handleSubmit } = useBankAccountEditor(createAccount, updateAccount);
  const [statusChange, setStatusChange] = useState<StatusChange | null>(null);

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
          onEdit={openDialog} onStatusChange={setStatusChange}
        />
      </CardContent>
      <BankAccountDialog
        open={dialogOpen} onOpenChange={setDialogOpen} editing={editing}
        defaultHolderName={defaultHolderName} onSubmit={handleSubmit}
      />
      <BankAccountStatusDialog
        change={statusChange} onClose={() => setStatusChange(null)}
        deactivate={deactivateAccount} reactivate={reactivateAccount}
      />
    </Card>
  );
}

/** Τα κείμενα κάθε μετάβασης — ΕΝΑΣ διάλογος, δύο κατευθύνσεις (όχι δίδυμα συστατικά). */
const STATUS_COPY = {
  deactivate: {
    title: 'setup.bankAccounts.deactivateTitle',
    description: 'setup.bankAccounts.deactivateDescription',
    confirm: 'setup.bankAccounts.deactivateConfirm',
    failed: 'setup.bankAccounts.errors.deactivateFailed',
    conflict: 'setup.bankAccounts.errors.deactivateFailed',
    variant: 'destructive',
  },
  reactivate: {
    title: 'setup.bankAccounts.reactivateTitle',
    description: 'setup.bankAccounts.reactivateDescription',
    confirm: 'setup.bankAccounts.reactivateConfirm',
    failed: 'setup.bankAccounts.errors.reactivateFailed',
    conflict: 'setup.bankAccounts.errors.reactivateDuplicate',
    variant: 'default',
  },
} as const;

interface BankAccountStatusDialogProps {
  /** `null` ⇒ κλειστό */
  change: StatusChange | null;
  onClose: () => void;
  deactivate: (accountId: string) => Promise<BankAccountConfig>;
  reactivate: (accountId: string) => Promise<BankAccountConfig>;
}

/** Επιβεβαίωση αλλαγής κατάστασης — μένει ανοιχτή ώσπου να απαντήσει ο διακομιστής· αποτυχία ⇒ μήνυμα, όχι κλείσιμο. */
function BankAccountStatusDialog({ change, onClose, deactivate, reactivate }: BankAccountStatusDialogProps) {
  const { t } = useTranslation('accounting');
  const [failure, setFailure] = useState<'failed' | 'conflict' | null>(null);
  const copy = STATUS_COPY[change?.kind ?? 'deactivate'];

  const handleConfirm = async () => {
    if (!change) return;
    try {
      await (change.kind === 'deactivate' ? deactivate : reactivate)(change.account.accountId);
      setFailure(null);
      onClose();
    } catch (error) {
      setFailure(error instanceof BankAccountMutationError && error.statusCode === 409 ? 'conflict' : 'failed');
    }
  };

  return (
    <ConfirmDialog
      open={change !== null}
      onOpenChange={(open) => { if (!open) { setFailure(null); onClose(); } }}
      title={t(copy.title)}
      description={t(copy.description, { iban: change ? formatIBAN(change.account.iban) : '' })}
      confirmText={t(copy.confirm)}
      variant={copy.variant}
      keepOpenWhilePending
      onConfirm={handleConfirm}
    >
      {failure && <p role="alert" className="text-sm text-destructive">{t(copy[failure])}</p>}
    </ConfirmDialog>
  );
}

interface BankAccountRowsProps {
  onEdit: (account: BankAccountConfig) => void;
  onStatusChange: (change: StatusChange) => void;
}

interface BankAccountsListProps extends BankAccountRowsProps {
  accounts: BankAccountConfig[];
  loading: boolean;
  loadFailed: boolean;
  onRetry: () => Promise<void>;
}

function BankAccountsList({ accounts, loading, loadFailed, onRetry, onEdit, onStatusChange }: BankAccountsListProps) {
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
  const active = accounts.filter((a) => a.isActive);
  const inactive = accounts.filter((a) => !a.isActive);
  return (
    <>
      {active.length === 0
        ? <p className="text-sm text-muted-foreground">{t('setup.bankAccounts.empty')}</p>
        : (
          <ul className="divide-y rounded-md border" aria-label={t('setup.bankAccounts.listAriaLabel')}>
            {active.map((account) => (
              <BankAccountRow key={account.accountId} account={account} onEdit={onEdit} onStatusChange={onStatusChange} />
            ))}
          </ul>
        )}
      {inactive.length > 0 && <InactiveBankAccounts accounts={inactive} onEdit={onEdit} onStatusChange={onStatusChange} />}
    </>
  );
}

interface InactiveBankAccountsProps extends BankAccountRowsProps {
  accounts: BankAccountConfig[];
}

/** Οι ανενεργοί — συμπτυγμένοι εξ ορισμού: ιστορικό, όχι θόρυβος δίπλα στους λογαριασμούς που πληρώνονται. */
function InactiveBankAccounts({ accounts, onEdit, onStatusChange }: InactiveBankAccountsProps) {
  const { t } = useTranslation('accounting');
  const label = t('setup.bankAccounts.inactiveGroup', { count: accounts.length });
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="group gap-1 text-muted-foreground">
          <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
          {label}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-2 divide-y rounded-md border border-dashed" aria-label={label}>
          {accounts.map((account) => (
            <BankAccountRow key={account.accountId} account={account} onEdit={onEdit} onStatusChange={onStatusChange} />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface BankAccountRowProps extends BankAccountRowsProps {
  account: BankAccountConfig;
}

function BankAccountRow({ account, onEdit, onStatusChange }: BankAccountRowProps) {
  const { t } = useTranslation('accounting');
  const iban = formatIBAN(account.iban);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-3">
      <article className={account.isActive ? 'min-w-0 space-y-1' : 'min-w-0 space-y-1 text-muted-foreground'}>
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
      <nav className="flex gap-1">
        {account.isActive ? (
          <>
            <Button type="button" variant="ghost" size="icon" onClick={() => onEdit(account)}
              aria-label={t('setup.bankAccounts.editAriaLabel', { iban })}>
              <Pencil className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => onStatusChange({ account, kind: 'deactivate' })}
              aria-label={t('setup.bankAccounts.deactivateAriaLabel', { iban })}>
              <Ban className="size-4" />
            </Button>
          </>
        ) : (
          <Button type="button" variant="ghost" size="icon" onClick={() => onStatusChange({ account, kind: 'reactivate' })}
            aria-label={t('setup.bankAccounts.reactivateAriaLabel', { iban })}>
            <RotateCcw className="size-4" />
          </Button>
        )}
      </nav>
    </li>
  );
}
