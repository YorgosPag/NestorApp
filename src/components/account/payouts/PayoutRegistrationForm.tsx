'use client';

/**
 * @fileoverview ADR-943 §5.9 — η **φόρμα εγγραφής δικαιούχου** της «Λήψης πληρωμών» (πρώτη ενεργοποίηση).
 * @related ReceivePaymentsCard.tsx (ο ορχηστρωτής) · payout-labels.ts · lib/payments/payout-account.ts (το σχήμα)
 * @module components/account/payouts/PayoutRegistrationForm
 *
 * 🔑 Το ΑΦΜ **προσυμπληρώνεται** από το προφίλ (`useAuth().vatNumber` — ο ΕΝΑΣ γραφέας του είναι το
 *    `updateVatNumber`), μόνο σε κενό πεδίο, και μένει επεξεργάσιμο: ο δικαιούχος μπορεί να είναι νομικό πρόσωπο με άλλο ΑΦΜ.
 */

import React, { useEffect, useId, useState } from 'react';

import { useAuth } from '@/auth';
import { IBANInput } from '@/components/banking/IBANInput';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { HintedField } from '@/components/ui/hinted-field';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { payoutRegistrationSchema, type PayoutRegistration } from '@/lib/payments/payout-account';

import { CARD_KEYS, FIELD_KEYS, PAYOUT_NS, type PayoutTextField } from './payout-labels';

const EMPTY: PayoutRegistration = {
  legalName: '', tradeName: '', taxNumber: '', address: '', iban: '', ibanBeneficiary: '', phone: '', description: '',
  consumerToConsumer: false,
};

const TEXT_FIELDS: readonly PayoutTextField[] = ['legalName', 'tradeName', 'taxNumber', 'address', 'phone', 'description', 'ibanBeneficiary'];

function TextInput({ field, form, onChange, disabled }: {
  readonly field: PayoutTextField; readonly form: PayoutRegistration; readonly onChange: (next: PayoutRegistration) => void; readonly disabled: boolean;
}) {
  const { t } = useTranslation([PAYOUT_NS]);
  const id = useId();
  return <HintedField id={id} label={t(FIELD_KEYS[field])} hint="" value={form[field]} onChange={(value) => onChange({ ...form, [field]: value })} disabled={disabled} />;
}

export function PayoutRegistrationForm({ onSubmit }: { readonly onSubmit: (form: PayoutRegistration) => Promise<boolean> }): React.ReactElement {
  const { t } = useTranslation([PAYOUT_NS]);
  const { vatNumber } = useAuth();
  const [form, setForm] = useState<PayoutRegistration>(EMPTY);
  const [phase, setPhase] = useState<'idle' | 'sending' | 'failed'>('idle');
  useEffect(() => {
    if (vatNumber) setForm((current) => (current.taxNumber === '' ? { ...current, taxNumber: vatNumber } : current));
  }, [vatNumber]);
  const c2cId = useId();
  const valid = payoutRegistrationSchema.safeParse(form).success;
  const sending = phase === 'sending';
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPhase('sending');
    setPhase(await onSubmit(form) ? 'idle' : 'failed');
  };
  return (
    <form className="flex flex-col gap-2" onSubmit={(event) => { void submit(event); }}>
      {TEXT_FIELDS.map((field) => <TextInput key={field} field={field} form={form} onChange={setForm} disabled={sending} />)}
      <IBANInput value={form.iban} onChange={(iban) => setForm({ ...form, iban })} disabled={sending} required />
      <section className="flex items-center gap-2">
        <Checkbox id={c2cId} checked={form.consumerToConsumer} onCheckedChange={(next) => setForm({ ...form, consumerToConsumer: next === true })} disabled={sending} />
        <Label htmlFor={c2cId} className="text-sm font-normal">{t(CARD_KEYS.consumerToConsumer)}</Label>
      </section>
      <p className="m-0 text-xs text-muted-foreground">{t(CARD_KEYS.privacy)}</p>
      {phase === 'failed' ? <p role="alert" className="m-0 text-sm text-destructive">{t(CARD_KEYS.failed)}</p> : null}
      <Button type="submit" className="self-start" disabled={!valid || sending}>{t(CARD_KEYS.submit)}</Button>
    </form>
  );
}
