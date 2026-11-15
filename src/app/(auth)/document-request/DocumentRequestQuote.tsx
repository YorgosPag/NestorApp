'use client';

/**
 * @fileoverview ADR-915 §42 — **η προσφορά στη σελίδα-σύνδεσμο**: ο φάκελος του ακινήτου για τον επαγγελματία, και η
 *   προσφορά όπως τη βλέπει ο υπεύθυνος πριν αποφασίσει.
 * @related DocumentRequestCard.tsx (ο γονέας) · components/document-registry/IssuanceQuoteFields.tsx (τα πεδία)
 * @module app/(auth)/document-request/DocumentRequestQuote
 *
 * 🔒 Ο φάκελος είναι **κλειστή λίστα** του server· η σελίδα λέει ρητά ότι ιδιοκτήτης και διεύθυνση δίνονται **μετά**.
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';

import { basisText, scopeText } from '@/components/document-registry/issuance-quote-labels';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { conveyanceToday } from '@/lib/conveyance/conveyance-calendar';
import { deliveryDueFromApproval, deliveryMissesSigning } from '@/lib/document-validity/issuance-delivery-due';
import { quoteTotalsOf } from '@/lib/document-validity/issuance-quote';
import { formatDate } from '@/lib/intl-formatting';
import { formatMinor } from '@/lib/money/money';
import type { IssuanceQuoteBrief, IssuanceQuoteView } from '@/types/issuance-invitation';

import { Fact } from './DocumentRequestFact';

function energyText(t: ReturnType<typeof useTranslation>['t'], brief: IssuanceQuoteBrief): string {
  if (brief.energyClass === null) return t('document-request:brief.unknown');
  return brief.energyValidUntil === null
    ? t('document-request:brief.energyClassOnly', { grade: brief.energyClass })
    : t('document-request:brief.energyValue', { grade: brief.energyClass, date: formatDate(brief.energyValidUntil) });
}

/** Ο φάκελος προσφοράς — κάθε πεδίο που λείπει λέγεται «δεν έχει δηλωθεί», ποτέ δεν μαντεύεται. */
export function QuoteBriefFacts({ brief }: { readonly brief: IssuanceQuoteBrief }) {
  const { t } = useTranslation(['document-request']);
  const unknown = t('document-request:brief.unknown');
  return (
    <section className="flex flex-col gap-2" aria-label={t('document-request:brief.heading')}>
      <h2 className="m-0 text-base font-semibold text-card-foreground">{t('document-request:brief.heading')}</h2>
      <dl className="m-0 grid grid-cols-1 gap-x-4 gap-y-1">
        <Fact term={t('document-request:brief.area')}>
          {brief.grossAreaSqm === null ? unknown : t('document-request:brief.areaValue', { area: String(brief.grossAreaSqm) })}
        </Fact>
        <Fact term={t('document-request:brief.floor')}>{brief.floor === null ? unknown : String(brief.floor)}</Fact>
        <Fact term={t('document-request:brief.year')}>{brief.constructionYear === null ? unknown : String(brief.constructionYear)}</Fact>
        <Fact term={t('document-request:brief.energy')}>{energyText(t, brief)}</Fact>
      </dl>
      <p className="m-0 text-xs text-muted-foreground">{t('document-request:brief.privacy')}</p>
    </section>
  );
}

/**
 * §45 Φ2 — ο χρόνος είναι μέρος αυτού που εγκρίνεται: «Παράδοση σε N εργάσιμες — έως <ημ.>, αν εγκριθεί σήμερα».
 * §45 Φ3 — και, αν η παράδοση πέφτει **μετά** την ημέρα που τη χρειάζεται η υπογραφή, το λέει πριν από την έγκριση (Α4).
 */
function QuoteDeliveryFact({ quote }: { readonly quote: IssuanceQuoteView }) {
  const { t } = useTranslation(['document-request', 'document-registry']);
  if (quote.deliveryBusinessDays === null) return null;
  const dueOn = deliveryDueFromApproval(conveyanceToday(), quote);
  if (dueOn === null) return null;
  return (
    <Fact term={t('document-request:facts.quoteDelivery')}>
      <span>{t('document-registry:issuance.delivery.ifApprovedToday', { count: quote.deliveryBusinessDays, date: formatDate(dueOn) })}</span>
      {quote.signingDay !== null && deliveryMissesSigning(dueOn, quote.signingDay) ? (
        <span className="mt-1 flex items-center gap-1 text-xs text-destructive">
          <AlertTriangle className="size-3" aria-hidden="true" />
          {t('document-registry:issuance.delivery.missesSigning', { due: formatDate(dueOn), signing: formatDate(quote.signingDay) })}
        </span>
      ) : null}
    </Fact>
  );
}

/** Η προσφορά για τον υπεύθυνο: σύνολα · είδος · ισχύς · τι περιλαμβάνει · και η αρχική, αν αναθεωρήθηκε. */
export function QuoteFacts({ quote }: { readonly quote: IssuanceQuoteView }) {
  const { t } = useTranslation(['document-request', 'document-registry']);
  const totals = quoteTotalsOf(quote);
  return (
    <>
      <Fact term={t('document-request:facts.quote')}>
        <span>{t('document-registry:issuance.quoteForm.totals', { net: formatMinor(totals.netMinor), vat: formatMinor(totals.vatMinor), total: formatMinor(totals.totalMinor) })}</span>
        <span className="ml-2 text-xs text-muted-foreground">{basisText(t, quote.basis)}</span>
      </Fact>
      {quote.previousTotalMinor === null ? null : (
        <Fact term={t('document-request:facts.quote')}>{t('document-request:facts.quoteRevised', { previous: formatMinor(quote.previousTotalMinor) })}</Fact>
      )}
      <Fact term={t('document-request:facts.quoteValid')}>{formatDate(quote.validUntil)}</Fact>
      <QuoteDeliveryFact quote={quote} />
      <Fact term={t('document-request:facts.quoteScope')}>{quote.scope.map((item) => scopeText(t, item)).join(' · ')}</Fact>
      {quote.note === null ? null : <Fact term={t('document-request:facts.quoteNote')}>{quote.note}</Fact>}
    </>
  );
}
