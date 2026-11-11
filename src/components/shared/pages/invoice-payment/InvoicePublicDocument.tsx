/**
 * Το σώμα του παραστατικού στη δημόσια σελίδα πληρωμής (ADR-ACC-018 §16): μέρη, γραμμές, σύνολα, σημειώσεις.
 * Ίδια σειρά με το PDF, ώστε ο πελάτης να αναγνωρίζει το ίδιο έγγραφο.
 *
 * @module components/shared/pages/invoice-payment/InvoicePublicDocument
 */

'use client';

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import { cn } from '@/lib/utils';
import type { InvoicePublicParty, InvoicePublicView } from '@/subapps/accounting/types/invoice-public-view';
import { formatAccountingCurrency } from '@/subapps/accounting/utils/format';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { INVOICE_PUBLIC_PAYMENT_NS } from './invoice-payment-primitives';

function PartyBlock({ title, party }: { readonly title: string; readonly party: InvoicePublicParty }): React.ReactElement {
  const { t } = useTranslation(INVOICE_PUBLIC_PAYMENT_NS);
  const colors = useSemanticColors();
  const place = [party.postalCode, party.city].filter(Boolean).join(' ');
  return (
    <section className="min-w-0">
      <h2 className={cn('text-xs uppercase tracking-wide', colors.text.muted)}>{title}</h2>
      <address className="not-italic text-sm">
        <strong className="block font-semibold">{party.name}</strong>
        {party.address && <span className="block">{party.address}</span>}
        {place && <span className="block">{place}</span>}
        {party.vatNumber && <span className="block">{t('page.vatNumber', { value: party.vatNumber })}</span>}
        {party.taxOffice && <span className="block">{t('page.taxOffice', { value: party.taxOffice })}</span>}
      </address>
    </section>
  );
}

export function InvoicePublicParties({ view }: { readonly view: InvoicePublicView }): React.ReactElement {
  const { t } = useTranslation(INVOICE_PUBLIC_PAYMENT_NS);
  return (
    <section className="grid gap-4 sm:grid-cols-2">
      <PartyBlock title={t('page.issuedBy')} party={view.issuer} />
      <PartyBlock title={t('page.billedTo')} party={view.customer} />
    </section>
  );
}

function LinesTable({ view }: { readonly view: InvoicePublicView }): React.ReactElement {
  const { t, i18n } = useTranslation(INVOICE_PUBLIC_PAYMENT_NS);
  const colors = useSemanticColors();
  const language = resolveHumanLanguage(i18n.language);
  return (
    <section aria-labelledby="invoice-lines-title" className="space-y-2">
      <h2 id="invoice-lines-title" className="text-base font-semibold">{t('lines.title')}</h2>
      <figure className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={cn('text-left text-xs', colors.text.muted)}>
            <tr>
              <th scope="col" className="py-2 pr-2 font-medium">{t('lines.description')}</th>
              <th scope="col" className="py-2 px-2 text-right font-medium">{t('lines.quantity')}</th>
              <th scope="col" className="py-2 px-2 text-right font-medium">{t('lines.unitPrice')}</th>
              <th scope="col" className="py-2 px-2 text-right font-medium">{t('lines.vat')}</th>
              <th scope="col" className="py-2 pl-2 text-right font-medium">{t('lines.net')}</th>
            </tr>
          </thead>
          <tbody>
            {view.lines.map((line) => (
              <tr key={line.lineNumber} className="border-t align-top">
                <td className="py-2 pr-2">{line.description}</td>
                <td className="py-2 px-2 text-right tabular-nums">{line.quantity} {line.unitLabel[language]}</td>
                <td className="py-2 px-2 text-right tabular-nums">{formatAccountingCurrency(line.unitPrice)}</td>
                <td className="py-2 px-2 text-right tabular-nums">{line.vatRate}%</td>
                <td className="py-2 pl-2 text-right tabular-nums">{formatAccountingCurrency(line.netAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figure>
    </section>
  );
}

function TotalRow({ label, amount, strong = false }: { readonly label: string; readonly amount: number; readonly strong?: boolean }) {
  return (
    <>
      <dt className={cn(strong && 'font-semibold')}>{label}</dt>
      <dd className={cn('text-right tabular-nums', strong && 'font-semibold')}>{formatAccountingCurrency(amount)}</dd>
    </>
  );
}

function TotalsList({ view }: { readonly view: InvoicePublicView }): React.ReactElement {
  const { t } = useTranslation(INVOICE_PUBLIC_PAYMENT_NS);
  return (
    <section aria-label={t('totals.title')} className="flex justify-end">
      <dl className="grid w-full max-w-xs grid-cols-2 gap-y-1 text-sm">
        <TotalRow label={t('totals.net')} amount={view.totalNetAmount} />
        {view.vatBreakdown.map((row) => (
          <TotalRow key={row.vatRate} label={t('totals.vat', { rate: row.vatRate })} amount={row.vatAmount} />
        ))}
        <TotalRow label={t('totals.gross')} amount={view.totalGrossAmount} />
        <TotalRow label={t('totals.payable')} amount={view.payableAmount} strong />
      </dl>
    </section>
  );
}

export function InvoicePublicBody({ view }: { readonly view: InvoicePublicView }): React.ReactElement {
  const { t } = useTranslation(INVOICE_PUBLIC_PAYMENT_NS);
  const colors = useSemanticColors();
  return (
    <>
      <LinesTable view={view} />
      <TotalsList view={view} />
      {view.notes && (
        <section aria-labelledby="invoice-notes-title" className="space-y-1">
          <h2 id="invoice-notes-title" className="text-sm font-semibold">{t('notes.title')}</h2>
          <p className={cn('whitespace-pre-line text-sm', colors.text.muted)}>{view.notes}</p>
        </section>
      )}
    </>
  );
}
