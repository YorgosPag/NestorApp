'use client';

/**
 * @fileoverview ADR-943 §5.14 — **η κατάσταση** της «Λήψης πληρωμών» όπως το Stripe Connect dashboard: δύο ικανότητες
 *   (πληρωμές · αποδόσεις), τι εκκρεμεί στην ταυτοποίηση, ο σύνδεσμος του παρόχου, τα δηλωμένα στοιχεία (IBAN μασκαρισμένο).
 * @related ReceivePaymentsCard.tsx (ο ορχηστρωτής) · payout-labels.ts · server/payments/payment-payee-capabilities.ts (ο κριτής)
 * @module components/account/payouts/PayoutStatusPanel
 *
 * 🔑 Καμία κρίση εδώ: ό,τι δείχνει το έκρινε ο server (`PayoutAccountView`). Η κάρτα μόνο αποδίδει.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PayoutAccountDetails, PayoutAccountView } from '@/lib/payments/payout-account';

import { CAPABILITY_KEYS, CARD_KEYS, DETAIL_KEYS, DUE_KEYS, FIELD_KEYS, PAYOUT_NS, REQUIREMENT_KEYS, STATE_KEYS } from './payout-labels';

/** Χωρίς δικαιούχο οι ενδείξεις ικανοτήτων δεν λένε τίποτα — μόνο η πρόταση κατάστασης. */
const STATES_WITH_CAPABILITIES: ReadonlySet<PayoutAccountView['state']> = new Set(['action-required', 'verifying', 'rejected', 'ready', 'blocked']);

function CapabilityLines({ account }: { readonly account: PayoutAccountView }) {
  const { t } = useTranslation([PAYOUT_NS]);
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
      <li className={account.charges ? 'text-card-foreground' : 'text-muted-foreground'}>{t(account.charges ? CAPABILITY_KEYS.chargesOn : CAPABILITY_KEYS.chargesOff)}</li>
      <li className={account.payouts ? 'text-card-foreground' : 'text-muted-foreground'}>{t(account.payouts ? CAPABILITY_KEYS.payoutsOn : CAPABILITY_KEYS.payoutsOff)}</li>
    </ul>
  );
}

function VerificationSteps({ account }: { readonly account: PayoutAccountView }) {
  const { t } = useTranslation([PAYOUT_NS]);
  const actionable = account.state === 'action-required' || account.state === 'rejected';
  if (!actionable && account.dueRequirements.length === 0) return null;
  return (
    <section className="flex flex-col gap-2" aria-label={t(DUE_KEYS.title)}>
      {account.dueRequirements.length > 0 ? (
        <>
          <p className="m-0 text-sm font-medium text-card-foreground">{t(DUE_KEYS.title)}</p>
          <ul className="m-0 list-disc pl-5 text-sm text-card-foreground">
            {account.dueRequirements.map((requirement) => <li key={requirement}>{t(REQUIREMENT_KEYS[requirement])}</li>)}
          </ul>
        </>
      ) : null}
      {account.kycProcessUrl !== null ? (
        <Button asChild variant="outline" className="self-start">
          <a href={account.kycProcessUrl} target="_blank" rel="noopener noreferrer">{t(CARD_KEYS.continueKyc)}</a>
        </Button>
      ) : actionable ? <p className="m-0 text-xs text-muted-foreground">{t(DUE_KEYS.linkPending)}</p> : null}
    </section>
  );
}

function DetailRow({ label, value }: { readonly label: string; readonly value: string | null }) {
  if (value === null) return null;
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="m-0 text-card-foreground">{value}</dd>
    </>
  );
}

function ProviderDetails({ details }: { readonly details: PayoutAccountDetails }) {
  const { t } = useTranslation([PAYOUT_NS]);
  const iban = details.ibanLast4 === null ? null : t(DETAIL_KEYS.ibanMasked, { last4: details.ibanLast4 });
  const taxNumber = details.taxNumberTail === null ? null : t(DETAIL_KEYS.taxNumberMasked, { tail: details.taxNumberTail });
  return (
    <section className="flex flex-col gap-1" aria-label={t(DETAIL_KEYS.title)}>
      <p className="m-0 text-sm font-medium text-card-foreground">{t(DETAIL_KEYS.title)}</p>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <DetailRow label={t(FIELD_KEYS.legalName)} value={details.legalName} />
        <DetailRow label={t(FIELD_KEYS.tradeName)} value={details.tradeName} />
        <DetailRow label={t(FIELD_KEYS.taxNumber)} value={taxNumber} />
        <DetailRow label={t(FIELD_KEYS.address)} value={details.address} />
        <DetailRow label={t(DETAIL_KEYS.iban)} value={iban === null ? null : [iban, details.bankName].filter(Boolean).join(' · ')} />
        <DetailRow label={t(FIELD_KEYS.ibanBeneficiary)} value={details.ibanBeneficiary} />
      </dl>
    </section>
  );
}

export function PayoutStatusPanel({ account }: { readonly account: PayoutAccountView }): React.ReactElement {
  const { t } = useTranslation([PAYOUT_NS]);
  return (
    <>
      <p role="status" className="m-0 text-sm text-card-foreground">{t(STATE_KEYS[account.state])}</p>
      {STATES_WITH_CAPABILITIES.has(account.state) ? <CapabilityLines account={account} /> : null}
      <VerificationSteps account={account} />
      {account.details !== null ? <ProviderDetails details={account.details} /> : null}
    </>
  );
}
