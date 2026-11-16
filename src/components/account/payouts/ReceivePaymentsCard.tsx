'use client';

/**
 * @fileoverview ADR-943 §5.9 — **«Λήψη πληρωμών»** στο προφίλ: ο μηχανικός γίνεται δικαιούχος του παρόχου (EveryPay
 *   Marketplace) για να δέχεται προκαταβολές με κράτηση.
 * @related usePayoutAccount.ts · lib/payments/payout-account.ts · server/payments/payment-payee-service.ts
 * @module components/account/payouts/ReceivePaymentsCard
 *
 * 🔑 **Πρώτα τρόπος απόδοσης, μετά χρήματα** (Airbnb · Upwork): χωρίς `ready` ο ιδιοκτήτης δεν μπορεί να πληρώσει.
 * 🔑 **Ελάχιστα δεδομένα**: τα στοιχεία περνούν στον πάροχο και **δεν** αποθηκεύονται από εμάς· η ταυτοποίηση γίνεται
 *    στη hosted σελίδα του παρόχου (κουμπί «Συνέχεια στην ταυτοποίηση»).
 * ⚠️ Πίνακας σταθερών κλειδιών, **ποτέ** παρεμβολή (N.11 · CHECK 3.8).
 */

import React, { useId, useState } from 'react';

import { IBANInput } from '@/components/banking/IBANInput';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionFrame } from '@/components/ui/section-frame';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { payoutRegistrationSchema, type PayoutAccountState, type PayoutRegistration } from '@/lib/payments/payout-account';

import { usePayoutAccount } from './usePayoutAccount';

const ACCOUNT_NS = 'common-account';
const K = 'common-account:account.payouts';

const CARD_KEYS = {
  title: `${K}.title`,
  lead: `${K}.lead`,
  loading: `${K}.loading`,
  failed: `${K}.failed`,
  continueKyc: `${K}.continueKyc`,
  consumerToConsumer: `${K}.field.consumerToConsumer`,
  privacy: `${K}.privacy`,
  submit: `${K}.submit`,
} as const;

const STATE_KEYS: Readonly<Record<PayoutAccountState, string>> = {
  unavailable: `${K}.state.unavailable`,
  none: `${K}.state.none`,
  registering: `${K}.state.registering`,
  verifying: `${K}.state.verifying`,
  rejected: `${K}.state.rejected`,
  ready: `${K}.state.ready`,
  blocked: `${K}.state.blocked`,
};

type TextField = Exclude<keyof PayoutRegistration, 'iban' | 'consumerToConsumer'>;

const FIELD_KEYS: Readonly<Record<TextField, string>> = {
  legalName: `${K}.field.legalName`,
  tradeName: `${K}.field.tradeName`,
  taxNumber: `${K}.field.taxNumber`,
  address: `${K}.field.address`,
  ibanBeneficiary: `${K}.field.ibanBeneficiary`,
  phone: `${K}.field.phone`,
  description: `${K}.field.description`,
};

const EMPTY: PayoutRegistration = {
  legalName: '', tradeName: '', taxNumber: '', address: '', iban: '', ibanBeneficiary: '', phone: '', description: '',
  consumerToConsumer: false,
};

function TextInput({ field, form, onChange, disabled }: {
  readonly field: TextField; readonly form: PayoutRegistration; readonly onChange: (next: PayoutRegistration) => void; readonly disabled: boolean;
}) {
  const { t } = useTranslation([ACCOUNT_NS]);
  const id = useId();
  return (
    <>
      <Label htmlFor={id} className="text-sm">{t(FIELD_KEYS[field])}</Label>
      <Input id={id} value={form[field]} onChange={(event) => onChange({ ...form, [field]: event.target.value })} disabled={disabled} />
    </>
  );
}

function RegistrationForm({ onSubmit }: { readonly onSubmit: (form: PayoutRegistration) => Promise<boolean> }) {
  const { t } = useTranslation([ACCOUNT_NS]);
  const [form, setForm] = useState<PayoutRegistration>(EMPTY);
  const [phase, setPhase] = useState<'idle' | 'sending' | 'failed'>('idle');
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
      {(['legalName', 'tradeName', 'taxNumber', 'address', 'phone', 'description', 'ibanBeneficiary'] as const).map((field) => (
        <TextInput key={field} field={field} form={form} onChange={setForm} disabled={sending} />
      ))}
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

export function ReceivePaymentsCard(): React.ReactElement {
  const { t } = useTranslation([ACCOUNT_NS]);
  const { load, register } = usePayoutAccount();
  return (
    <SectionFrame title={t(CARD_KEYS.title)} headingLevel="h2" gap={2}>
      <p className="m-0 text-sm text-muted-foreground">{t(CARD_KEYS.lead)}</p>
      {load.phase === 'loading' ? <p role="status" className="m-0 text-sm text-muted-foreground">{t(CARD_KEYS.loading)}</p> : null}
      {load.phase === 'failed' ? <p role="alert" className="m-0 text-sm text-destructive">{t(CARD_KEYS.failed)}</p> : null}
      {load.phase === 'ready' ? <p role="status" className="m-0 text-sm text-card-foreground">{t(STATE_KEYS[load.account.state])}</p> : null}
      {load.phase === 'ready' && load.account.kycProcessUrl !== null ? (
        <Button asChild variant="outline" className="self-start">
          <a href={load.account.kycProcessUrl} target="_blank" rel="noopener noreferrer">{t(CARD_KEYS.continueKyc)}</a>
        </Button>
      ) : null}
      {load.phase === 'ready' && load.account.state === 'none' ? <RegistrationForm onSubmit={register} /> : null}
    </SectionFrame>
  );
}
