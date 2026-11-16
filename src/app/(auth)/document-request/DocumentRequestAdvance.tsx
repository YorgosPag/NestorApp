'use client';

/**
 * @fileoverview ADR-943 §5.9 — **το βήμα «Πληρωμή προκαταβολής»** της σελίδας-συνδέσμου, μετά την έγκριση με προκαταβολή.
 * @related useAdvancePayment.ts (η κατάσταση) · DocumentRequestGate.tsx (ο καλών) · IssuanceAdvanceSchedule.tsx (ο πίνακας)
 * @module app/(auth)/document-request/DocumentRequestAdvance
 *
 * 🔑 **Το ρητό αίτημα έναρξης** (Κ-6 · ν.2251/1994 3ι §4 α ii · 3ιβ (α)) είναι **ένα** κουτί με **δύο** δηλώσεις — «ζητώ να
 *    ξεκινήσει μέσα στις 14 ημέρες» **και** «αναγνωρίζω ότι χάνω το δικαίωμα υπαναχώρησης όταν η υπηρεσία παρασχεθεί
 *    πλήρως». Χωρίς αυτό τα κουμπιά πληρωμής μένουν ανενεργά, και ο διακομιστής αρνείται σώμα χωρίς τα δύο `true`.
 * 🔑 Ο πίνακας ακύρωσης σε **ποσά** ξανά, δίπλα στο κουμπί: ό,τι εγκρίθηκε είναι ό,τι πληρώνεται.
 */

import React, { useId, useState } from 'react';

import { DOCUMENT_KIND_LABEL_KEYS } from '@/components/document-registry/document-registry-labels';
import { advanceStateText } from '@/components/document-registry/issuance-advance-labels';
import { IssuanceAdvanceSchedule } from '@/components/document-registry/IssuanceAdvanceSchedule';
import { AuthCardSection } from '@/components/ui/auth-card-section';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatMinor } from '@/lib/money/money';
import type { OnlinePaymentMethod } from '@/subapps/accounting/types/online-payment';
import type { IssuanceAdvanceCheckoutRefusal, IssuanceAdvancePaymentView } from '@/types/issuance-invitation';

import { DocumentRequestFailureState } from './DocumentRequestFailureState';
import { Fact } from './DocumentRequestFact';
import { useAdvancePayment, type AdvancePayment } from './useAdvancePayment';

type Translate = ReturnType<typeof useTranslation>['t'];

function refusalText(t: Translate, reason: IssuanceAdvanceCheckoutRefusal): string {
  switch (reason) {
    case 'not-payable': return t('document-request:advance.refused.notPayable');
    case 'payee-not-ready': return t('document-request:advance.refused.payeeNotReady');
    case 'method-unavailable': return t('document-request:advance.refused.methodUnavailable');
    case 'provider-unavailable': return t('document-request:advance.refused.providerUnavailable');
  }
}

function methodText(t: Translate, method: OnlinePaymentMethod): string {
  switch (method) {
    case 'card': return t('document-request:advance.payCard');
    case 'iris': return t('document-request:advance.payIris');
  }
}

function watchText(t: Translate, watch: AdvancePayment['watch']): string | null {
  switch (watch) {
    case null: return null;
    case 'waiting': return t('document-request:advance.watch.waiting');
    case 'slow': return t('document-request:advance.watch.slow');
    case 'failed': return t('document-request:advance.watch.failed');
    case 'timed-out': return t('document-request:advance.watch.timedOut');
  }
}

function AdvanceFacts({ view }: { readonly view: IssuanceAdvancePaymentView }) {
  const { t } = useTranslation(['document-request']);
  const unnamed = t('document-request:facts.unnamed');
  return (
    <dl className="m-0 grid grid-cols-1 gap-x-4 gap-y-1">
      <Fact term={t('document-request:facts.office')}>{view.officeName ?? unnamed}</Fact>
      <Fact term={t('document-request:facts.property')}>{view.propertyLabel ?? unnamed}</Fact>
      <Fact term={t('document-request:facts.document')}>{t(DOCUMENT_KIND_LABEL_KEYS[view.documentKind])}</Fact>
      <Fact term={t('document-request:facts.professional')}>{view.professionalName ?? unnamed}</Fact>
      <Fact term={t('document-request:advance.amount')}>{formatMinor(view.advance.amountMinor)}</Fact>
    </dl>
  );
}

/** Το ρητό αίτημα έναρξης — ένα κουτί, δύο δηλώσεις (βλ. κεφαλίδα). */
function StartRequest({ checked, onChange, disabled }: { readonly checked: boolean; readonly onChange: (next: boolean) => void; readonly disabled: boolean }) {
  const { t } = useTranslation(['document-request']);
  const id = useId();
  return (
    <section className="flex items-start gap-2" aria-label={t('document-request:advance.consentHeading')}>
      <Checkbox id={id} checked={checked} onCheckedChange={(next) => onChange(next === true)} disabled={disabled} />
      <Label htmlFor={id} className="flex flex-col gap-1 text-sm font-normal">
        <span>{t('document-request:advance.consentStart')}</span>
        <span>{t('document-request:advance.consentWaiver')}</span>
      </Label>
    </section>
  );
}

function PayActions({ payment, consented }: { readonly payment: AdvancePayment; readonly consented: boolean }) {
  const { t } = useTranslation(['document-request']);
  const busy = payment.phase.kind === 'starting' || payment.watch === 'waiting' || payment.watch === 'slow';
  if (payment.view.methods.length === 0) return <p className="m-0 text-sm text-muted-foreground">{t('document-request:advance.refused.methodUnavailable')}</p>;
  return (
    <footer className="flex flex-wrap gap-2">
      {payment.view.methods.map((method, index) => (
        <Button key={method} type="button" variant="outline" className={index === 0 ? COLOR_BRIDGE.action.primary : undefined}
          onClick={() => payment.pay(method)} disabled={!consented || busy}>{methodText(t, method)}</Button>
      ))}
    </footer>
  );
}

function AdvanceStatus({ payment }: { readonly payment: AdvancePayment }) {
  const { t } = useTranslation(['document-request', 'document-registry']);
  const { phase, watch, view } = payment;
  const watching = watchText(t, watch);
  return (
    <>
      {view.state !== 'awaiting-payment' ? <p role="status" className="m-0 text-sm text-card-foreground">{advanceStateText(t, view.state)}</p> : null}
      {view.state === 'awaiting-payment' && !view.payeeReady ? <p className="m-0 text-xs text-muted-foreground">{t('document-request:advance.payeeHint')}</p> : null}
      {watching === null ? null : <p role="status" aria-live="polite" className="m-0 text-sm text-card-foreground">{watching}</p>}
      {phase.kind === 'refused' ? <p role="alert" className={`m-0 text-sm ${COLOR_BRIDGE.text.error}`}>{refusalText(t, phase.reason)}</p> : null}
    </>
  );
}

export function DocumentRequestAdvance({ token, advance, accessCode }: { readonly token: string; readonly advance: IssuanceAdvancePaymentView; readonly accessCode: string | null }) {
  const { t, i18n } = useTranslation(['document-request']);
  const payment = useAdvancePayment(token, advance, accessCode, i18n.language === 'en' ? 'en' : 'el');
  const [consented, setConsented] = useState(false);
  if (payment.phase.kind === 'failed') return <DocumentRequestFailureState failure={payment.phase.failure} />;
  const awaiting = payment.view.state === 'awaiting-payment';
  return (
    <AuthCardSection gap={4}>
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-lg font-semibold text-card-foreground">{t('document-request:advance.heading')}</h1>
        <p className="m-0 text-sm text-card-foreground">{t('document-request:page.for', { name: payment.view.recipientName ?? t('document-request:facts.unnamed') })}</p>
      </header>
      <p className="m-0 text-sm text-card-foreground">{t('document-request:advance.intro')}</p>
      <AdvanceFacts view={payment.view} />
      <IssuanceAdvanceSchedule terms={payment.view.advance} />
      <AdvanceStatus payment={payment} />
      {awaiting ? <StartRequest checked={consented} onChange={setConsented} disabled={payment.phase.kind === 'starting'} /> : null}
      {awaiting ? <PayActions payment={payment} consented={consented} /> : null}
    </AuthCardSection>
  );
}
