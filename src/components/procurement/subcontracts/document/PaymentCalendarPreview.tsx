/**
 * Το ημερολόγιο πληρωμών (εκτίμηση) — πίνακας από το `projectPaymentSchedule` (ADR-928 §5.4.1 · §5.17).
 * Τα κείμενα από την ίδια πόρτα με το έγγραφο (`DocumentLocale`), στη γλώσσα που ζητά ο καλών.
 */

import { AlertTriangle } from 'lucide-react';
import { Table } from '@/components/ui/table';
import type { DocumentLocale } from '@/subapps/procurement/subcontracts/document/document-locale';
import type { ProjectedPayment } from '@/subapps/procurement/subcontracts/document/payment-schedule-projection';
import { describeShares } from '@/subapps/procurement/subcontracts/document/describe-payment-plan';

const COLUMNS = ['date', 'kind', 'gross', 'retention', 'withholding', 'net', 'instruments'] as const;

function kindLabel(payment: ProjectedPayment, locale: DocumentLocale): string {
  if (payment.kind === 'periodic') return locale.phrase('calendar.kind.periodic', { number: payment.sequence });
  if (payment.kind === 'retention_release') return locale.phrase('calendar.kind.retentionRelease');
  if (payment.kind === 'advance') return locale.phrase('calendar.kind.advance');
  return locale.phrase('calendar.kind.final');
}

function PaymentRow({ payment, locale, cashLimit }: { payment: ProjectedPayment; locale: DocumentLocale; cashLimit: number }) {
  return (
    <tr className="border-b align-top">
      <td className="py-1.5 pr-2 tabular-nums">{payment.date ? locale.day(payment.date) : locale.phrase('calendar.onEvent')}</td>
      <td className="py-1.5 pr-2">{kindLabel(payment, locale)}</td>
      <td className="py-1.5 pr-2 text-right tabular-nums">{locale.money(payment.gross)}</td>
      <td className="py-1.5 pr-2 text-right tabular-nums">{locale.money(payment.retention)}</td>
      <td className="py-1.5 pr-2 text-right tabular-nums">{locale.money(payment.withholding)}</td>
      <td className="py-1.5 pr-2 text-right font-medium tabular-nums">{locale.money(payment.net)}</td>
      <td className="py-1.5">
        {describeShares(payment.shares, locale)}
        {payment.cashOverLimit && (
          <p role="alert" className="mt-1 flex items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
            {locale.phrase('calendar.cashOverLimit', { amount: locale.money(payment.cash), limit: locale.money(cashLimit) })}
          </p>
        )}
      </td>
    </tr>
  );
}

interface PaymentCalendarPreviewProps {
  readonly payments: readonly ProjectedPayment[];
  readonly locale: DocumentLocale;
  readonly cashLimit: number;
  readonly hasValue: boolean;
}

export function PaymentCalendarPreview({ payments, locale, cashLimit, hasValue }: PaymentCalendarPreviewProps) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{locale.phrase('calendar.title')}</h3>
      {!hasValue ? (
        <p className="text-sm text-muted-foreground">{locale.phrase('calendar.noValue')}</p>
      ) : (
        <Table className="text-xs">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              {COLUMNS.map((column) => <th key={column} scope="col" className="py-1 pr-2">{locale.phrase(`calendar.columns.${column}`)}</th>)}
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => <PaymentRow key={`${payment.kind}-${payment.sequence}`} payment={payment} locale={locale} cashLimit={cashLimit} />)}
          </tbody>
        </Table>
      )}
      <p className="text-xs text-muted-foreground">{locale.phrase('calendar.estimateNote')}</p>
    </section>
  );
}
