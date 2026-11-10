'use client';

/**
 * @fileoverview Διάλογος νέου / επεξεργασίας τραπεζικού λογαριασμού της εταιρείας (ADR-ACC-018 §15)
 * @description Επαναχρησιμοποιεί τα κοινά `IBANInput` (ISO 13616 + ανίχνευση ελληνικής τράπεζας) και `BankSelector`
 *   (κατάλογος με BIC). Το IBAN κλειδώνει στην επεξεργασία: άλλο IBAN = άλλος λογαριασμός.
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML, i18n
 */

import { useEffect, useId, useState, type FormEvent } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IBANInput } from '@/components/banking/IBANInput';
import { BankSelector, bankSelection } from '@/components/banking/BankSelector';
import { BANK_ACCOUNT_TYPES, type BankAccountConfig } from '../../types';
import { BankAccountMutationError } from '../../hooks/useCompanyBankAccounts';
import {
  bankAccountErrorOfStatus, bankAccountFormError, bankAccountFormOf, emptyBankAccountForm, isBankAccountType,
  withDetectedBank,
  type BankAccountFormError, type BankAccountFormState,
} from './bank-account-form-state';

interface BankAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` ⇒ νέος λογαριασμός */
  editing: BankAccountConfig | null;
  /** Η επωνυμία της εταιρείας — προτεινόμενος δικαιούχος */
  defaultHolderName: string;
  onSubmit: (form: BankAccountFormState, editing: BankAccountConfig | null) => Promise<void>;
}

/** Κατάσταση + υποβολή της φόρμας: επαναφορά σε κάθε άνοιγμα, έλεγχος, σφάλμα διακομιστή ως κλειδί i18n. */
function useBankAccountForm({ open, onOpenChange, editing, defaultHolderName, onSubmit }: BankAccountDialogProps) {
  const [form, setForm] = useState<BankAccountFormState>(() => emptyBankAccountForm(defaultHolderName));
  const [error, setError] = useState<BankAccountFormError | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(editing ? bankAccountFormOf(editing, defaultHolderName) : emptyBankAccountForm(defaultHolderName));
    setError(null);
  }, [open, editing, defaultHolderName]);

  const patch = (changes: Partial<BankAccountFormState>) => setForm((current) => ({ ...current, ...changes }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const invalid = bankAccountFormError(form, editing === null);
    if (invalid) { setError(invalid); return; }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(form, editing);
      onOpenChange(false);
    } catch (cause) {
      setError(bankAccountErrorOfStatus(cause instanceof BankAccountMutationError ? cause.statusCode : null));
    } finally {
      setSaving(false);
    }
  };

  return { form, patch, error, saving, handleSubmit };
}

export function BankAccountDialog(props: BankAccountDialogProps) {
  const { open, onOpenChange, editing } = props;
  const { t } = useTranslation('accounting');
  const ids = useId();
  const { form, patch, error, saving, handleSubmit } = useBankAccountForm(props);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t(editing ? 'setup.bankAccounts.editTitle' : 'setup.bankAccounts.createTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <BankAccountIdentityFields form={form} locked={editing !== null} ids={ids} onChange={patch} />
          <BankAccountUsageFields form={form} ids={ids} onChange={patch} />
          {error && <p role="alert" className="text-sm text-destructive">{t(`setup.bankAccounts.errors.${error}`)}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {t('setup.bankAccounts.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner size="small" className="mr-2" />}
              {t(editing ? 'setup.bankAccounts.save' : 'setup.bankAccounts.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface FieldsProps {
  form: BankAccountFormState;
  ids: string;
  onChange: (changes: Partial<BankAccountFormState>) => void;
}

/** IBAN · τράπεζα · BIC · δικαιούχος — ό,τι τυπώνεται στο τιμολόγιο (EN 16931 BT-84/86/85). */
function BankAccountIdentityFields({ form, locked, ids, onChange }: FieldsProps & { locked: boolean }) {
  const { t } = useTranslation('accounting');
  return (
    <fieldset className="space-y-3">
      <IBANInput
        value={form.iban}
        onChange={(iban) => onChange(withDetectedBank(form, iban))}
        disabled={locked}
        label={t('setup.bankAccounts.form.iban')}
        required
      />
      {locked && <p className="text-xs text-muted-foreground">{t('setup.bankAccounts.form.ibanLocked')}</p>}
      <BankSelector
        value={form.bankCode}
        onChange={(code, bank) => onChange(bank ? bankSelection(code, bank) : {})}
        label={t('setup.bankAccounts.form.bank')}
      />
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <p className="space-y-1">
          <Label htmlFor={`${ids}-bank-name`}>{t('setup.bankAccounts.form.bankName')}</Label>
          <Input id={`${ids}-bank-name`} value={form.bankName} onChange={(e) => onChange({ bankName: e.target.value })} />
        </p>
        <p className="space-y-1">
          <Label htmlFor={`${ids}-bic`}>{t('setup.bankAccounts.form.bic')}</Label>
          <Input id={`${ids}-bic`} value={form.bankCode} onChange={(e) => onChange({ bankCode: e.target.value.toUpperCase() })} />
        </p>
      </section>
      <p className="space-y-1">
        <Label htmlFor={`${ids}-holder`}>{t('setup.bankAccounts.form.holderName')}</Label>
        <Input id={`${ids}-holder`} value={form.holderName} maxLength={70} onChange={(e) => onChange({ holderName: e.target.value })} />
        <span className="block text-xs text-muted-foreground">{t('setup.bankAccounts.form.holderNameHint')}</span>
      </p>
    </fieldset>
  );
}

/** Ετικέτα · τύπος · εμφάνιση στα τιμολόγια · προεπιλογή · σημειώσεις. */
function BankAccountUsageFields({ form, ids, onChange }: FieldsProps) {
  const { t } = useTranslation('accounting');
  return (
    <fieldset className="space-y-3">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <p className="space-y-1">
          <Label htmlFor={`${ids}-label`}>{t('setup.bankAccounts.form.label')}</Label>
          <Input id={`${ids}-label`} value={form.label} placeholder={t('setup.bankAccounts.form.labelPlaceholder')}
            onChange={(e) => onChange({ label: e.target.value })} />
        </p>
        <p className="space-y-1">
          <Label htmlFor={`${ids}-type`}>{t('setup.bankAccounts.form.type')}</Label>
          <Select value={form.type} onValueChange={(type) => { if (isBankAccountType(type)) onChange({ type }); }}>
            <SelectTrigger id={`${ids}-type`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {BANK_ACCOUNT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>{t(`setup.bankAccounts.types.${type}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </p>
      </section>
      <p className="flex items-center justify-between gap-3">
        <Label htmlFor={`${ids}-show`}>{t('setup.bankAccounts.form.showOnInvoices')}</Label>
        <Switch id={`${ids}-show`} checked={form.showOnInvoices} onCheckedChange={(showOnInvoices) => onChange({ showOnInvoices })} />
      </p>
      <p className="flex items-center justify-between gap-3">
        <Label htmlFor={`${ids}-default`}>{t('setup.bankAccounts.form.isDefaultForInvoices')}</Label>
        <Switch id={`${ids}-default`} checked={form.isDefaultForInvoices} disabled={!form.showOnInvoices}
          onCheckedChange={(isDefaultForInvoices) => onChange({ isDefaultForInvoices })} />
      </p>
      <p className="space-y-1">
        <Label htmlFor={`${ids}-notes`}>{t('setup.bankAccounts.form.notes')}</Label>
        <Input id={`${ids}-notes`} value={form.notes} onChange={(e) => onChange({ notes: e.target.value })} />
      </p>
    </fieldset>
  );
}
