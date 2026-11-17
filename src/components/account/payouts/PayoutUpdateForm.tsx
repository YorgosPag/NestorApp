'use client';

/**
 * @fileoverview ADR-943 §5.14 — **αλλαγή στοιχείων** της «Λήψης πληρωμών» (EveryPay `PUT /sellers/{id}`).
 * @related ReceivePaymentsCard.tsx · usePayoutAccount.ts (`update`) · identity-confirmation/* (η ΜΙΑ επαν-πιστοποίηση)
 * @module components/account/payouts/PayoutUpdateForm
 *
 * 🔑 **Κατ' απαίτηση, όχι προληπτικά** (ίδιο ιδίωμα με το `useIdentityConfirmation`): στέλνουμε την αλλαγή· αν ο server
 *    πει `reauthentication-required` («sudo mode» — η σύνδεση δεν είναι πρόσφατη), ανοίγει η επιβεβαίωση ταυτότητας και
 *    μετά η **ίδια** αλλαγή ξαναστέλνεται μόνη της.
 * 🔑 Στέλνεται **μόνο η διαφορά** από τα δηλωμένα στοιχεία. Το ΑΦΜ δεν αλλάζει (το λέει η κάρτα, δεν δίνεται πεδίο).
 */

import React, { useId, useState } from 'react';

import { IdentityConfirmationStep } from '@/components/account/identity-confirmation/IdentityConfirmationStep';
import { useIdentityConfirmation } from '@/components/account/identity-confirmation/useIdentityConfirmation';
import { IBANInput } from '@/components/banking/IBANInput';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { HintedField } from '@/components/ui/hinted-field';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { payoutUpdateSchema, type PayoutAccountDetails, type PayoutUpdate } from '@/lib/payments/payout-account';

import { DETAIL_KEYS, EDIT_KEYS, FIELD_KEYS, PAYOUT_NS } from './payout-labels';
import type { PayoutUpdateResult } from './usePayoutAccount';

interface Draft {
  readonly legalName: string;
  readonly tradeName: string;
  readonly address: string;
  readonly changeBank: boolean;
  readonly iban: string;
  readonly beneficiary: string;
}

type DraftText = 'legalName' | 'tradeName' | 'address' | 'beneficiary';

function draftOf(details: PayoutAccountDetails | null): Draft {
  return {
    legalName: details?.legalName ?? '', tradeName: details?.tradeName ?? '', address: details?.address ?? '',
    changeBank: false, iban: '', beneficiary: details?.ibanBeneficiary ?? '',
  };
}

/** Μόνο ό,τι άλλαξε· ο λογαριασμός πίστωσης μόνο όταν ζητήθηκε ρητά. */
function changeOf(draft: Draft, details: PayoutAccountDetails | null): PayoutUpdate {
  const changed = (value: string, current: string | null | undefined) => (value.trim() !== (current ?? '') ? value.trim() : undefined);
  return {
    legalName: changed(draft.legalName, details?.legalName),
    tradeName: changed(draft.tradeName, details?.tradeName),
    address: changed(draft.address, details?.address),
    bankAccount: draft.changeBank ? { iban: draft.iban, beneficiary: draft.beneficiary.trim() } : undefined,
  };
}

function DraftInput({ field, label, draft, onChange, disabled }: {
  readonly field: DraftText; readonly label: string; readonly draft: Draft; readonly onChange: (next: Draft) => void; readonly disabled: boolean;
}) {
  const id = useId();
  return <HintedField id={id} label={label} hint="" value={draft[field]} onChange={(value) => onChange({ ...draft, [field]: value })} disabled={disabled} />;
}

function BankFields({ draft, onChange, disabled }: { readonly draft: Draft; readonly onChange: (next: Draft) => void; readonly disabled: boolean }) {
  const { t } = useTranslation([PAYOUT_NS]);
  const bankId = useId();
  return (
    <>
      <section className="flex items-center gap-2">
        <Checkbox id={bankId} checked={draft.changeBank} onCheckedChange={(next) => onChange({ ...draft, changeBank: next === true })} disabled={disabled} />
        <Label htmlFor={bankId} className="text-sm font-normal">{t(EDIT_KEYS.changeBank)}</Label>
      </section>
      {draft.changeBank ? (
        <>
          <IBANInput value={draft.iban} onChange={(iban) => onChange({ ...draft, iban })} disabled={disabled} required />
          <DraftInput field="beneficiary" label={t(FIELD_KEYS.ibanBeneficiary)} draft={draft} onChange={onChange} disabled={disabled} />
          <p className="m-0 text-xs text-muted-foreground">{t(EDIT_KEYS.bankNotice)}</p>
        </>
      ) : null}
    </>
  );
}

export function PayoutUpdateForm({ details, onUpdate, onClose }: {
  readonly details: PayoutAccountDetails | null;
  readonly onUpdate: (change: PayoutUpdate) => Promise<PayoutUpdateResult>;
  readonly onClose: (saved: boolean) => void;
}): React.ReactElement {
  const { t } = useTranslation([PAYOUT_NS]);
  const identity = useIdentityConfirmation();
  const [draft, setDraft] = useState<Draft>(() => draftOf(details));
  const [phase, setPhase] = useState<'idle' | 'sending' | 'failed'>('idle');
  const change = changeOf(draft, details);
  const valid = payoutUpdateSchema.safeParse(change).success;
  const sending = phase === 'sending';
  const send = async (): Promise<void> => {
    setPhase('sending');
    const result = await onUpdate(change);
    if (result === 'reauthentication-required') identity.request();
    if (result === 'updated') onClose(true);
    setPhase(result === 'failed' ? 'failed' : 'idle');
  };
  if (identity.prompt.kind === 'open') {
    const confirmAndRetry = async (password: string) => { if (await identity.submit(password)) await send(); };
    return <IdentityConfirmationStep prompt={identity.prompt} busy={identity.busy || sending} onSubmit={confirmAndRetry} onCancel={identity.cancel} />;
  }
  return (
    <form className="flex flex-col gap-2" onSubmit={(event) => { event.preventDefault(); void send(); }}>
      <DraftInput field="legalName" label={t(FIELD_KEYS.legalName)} draft={draft} onChange={setDraft} disabled={sending} />
      <DraftInput field="tradeName" label={t(FIELD_KEYS.tradeName)} draft={draft} onChange={setDraft} disabled={sending} />
      <DraftInput field="address" label={t(FIELD_KEYS.address)} draft={draft} onChange={setDraft} disabled={sending} />
      <p className="m-0 text-xs text-muted-foreground">{t(DETAIL_KEYS.taxNumberLocked)}</p>
      <BankFields draft={draft} onChange={setDraft} disabled={sending} />
      {phase === 'failed' ? <p role="alert" className="m-0 text-sm text-destructive">{t(EDIT_KEYS.failed)}</p> : null}
      <nav className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => onClose(false)} disabled={sending}>{t(EDIT_KEYS.cancel)}</Button>
        <Button type="submit" disabled={!valid || sending}>{t(EDIT_KEYS.save)}</Button>
      </nav>
    </form>
  );
}
