/**
 * =============================================================================
 * Η ΔΗΜΟΣΙΑ ΣΕΛΙΔΑ ΠΛΗΡΩΜΗΣ ΤΙΜΟΛΟΓΙΟΥ — `/shared/[token]`, είδος `invoice_payment` (ADR-ACC-018 §16)
 * =============================================================================
 *
 * Πρότυπο Stripe Hosted Invoice Page: πρώτα **τι οφείλεται και ως πότε**, μετά **πώς πληρώνεται** («Πληρωμή τώρα»:
 * κάρτα / IRIS / μεταφορά — ADR-ACC-030), μετά το έγγραφο. Μετά από online πληρωμή η σελίδα περιμένει την
 * επιβεβαίωση του παρόχου (ξαναδιαβάζει σιωπηλά την όψη) ώσπου να πει «Εξοφλήθηκε».
 * Η σελίδα δεν κρίνει τίποτα μόνη της. Κατάσταση, ποσό, λογαριασμοί και QR έρχονται έτοιμα από τη συνεδρία
 * προβολής του διακομιστή (`invoice-public-session.ts`).
 *
 * Η σελίδα **δεν** εμφανίζεται ποτέ για ποσό που δεν οφείλεται: εξοφλημένο ⇒ «Εξοφλήθηκε», ακυρωμένο ⇒
 * «Ακυρώθηκε», χωρίς οδηγίες πληρωμής. Το πρόχειρο δείχνει ρητή ταινία «Προσχέδιο».
 *
 * @module components/shared/pages/invoice-payment/SharedInvoicePaymentPageContent
 */

'use client';

import React from 'react';
import { AlertTriangle, Download, Printer } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatOperatorDate } from '@/lib/operator-time-format';
import { cn } from '@/lib/utils';
import type { InvoicePublicView } from '@/subapps/accounting/types/invoice-public-view';
import type { InvoicePaymentShareResolvedData } from '@/services/sharing/resolvers/invoice-payment.resolver';
import { formatAccountingCurrency } from '@/subapps/accounting/utils/format';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { InvoiceIssuerContact } from './InvoiceIssuerContact';
import { InvoiceIssuerMessages } from './InvoiceIssuerMessages';
import { InvoicePublicBody, InvoicePublicParties } from './InvoicePublicDocument';
import { InvoicePayNowSection } from './InvoicePayNowSection';
import { INVOICE_PUBLIC_PAYMENT_NS } from './invoice-payment-primitives';
import { invoicePublicPdfUrl, useInvoicePublicView } from './useInvoicePublicView';
import { usePaymentConfirmationWatch } from './usePaymentConfirmationWatch';

type BadgeVariant = 'warning' | 'error' | 'success' | 'muted';

/** Κατάσταση → (κλειδί, χρώμα σήματος). Το κείμενο φέρει πάντα το νόημα, όχι μόνο το χρώμα. */
function standingBadge(view: InvoicePublicView): { readonly key: string; readonly variant: BadgeVariant } {
  if (view.standing === 'paid') return { key: 'standing.paid', variant: 'success' };
  if (view.standing === 'cancelled') return { key: 'standing.cancelled', variant: 'muted' };
  if (view.standing === 'not-payable') return { key: 'standing.notPayable', variant: 'muted' };
  return view.overdue ? { key: 'standing.overdue', variant: 'error' } : { key: 'standing.payable', variant: 'warning' };
}

function DocumentHeader({ view }: { readonly view: InvoicePublicView }): React.ReactElement {
  const { t, i18n } = useTranslation(INVOICE_PUBLIC_PAYMENT_NS);
  const colors = useSemanticColors();
  const badge = standingBadge(view);
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <hgroup className="min-w-0">
        <h1 className="text-xl font-semibold">{t(`documentType.${view.type}`)}</h1>
        <p className={cn('text-sm', colors.text.muted)}>
          {t('page.documentNumber', { number: `${view.series}-${view.number}` })}
          {' · '}
          {t('page.issueDate')} {formatOperatorDate(view.issueDate, i18n.language)}
          {view.mark && <>{' · '}{t('page.mark')} {view.mark}</>}
        </p>
      </hgroup>
      <Badge variant={badge.variant}>{t(badge.key)}</Badge>
    </header>
  );
}

function AmountSummary({ view }: { readonly view: InvoicePublicView }): React.ReactElement {
  const { t, i18n } = useTranslation(INVOICE_PUBLIC_PAYMENT_NS);
  const colors = useSemanticColors();
  if (view.standing !== 'payable') {
    const key = view.standing === 'paid' ? 'amount.paidBody' : view.standing === 'cancelled' ? 'amount.cancelledBody' : 'amount.notPayableBody';
    return <p className="rounded-lg border p-4 text-sm">{t(key)}</p>;
  }
  return (
    <section aria-labelledby="invoice-amount-title" className="rounded-lg border p-4">
      <h2 id="invoice-amount-title" className={cn('text-sm', colors.text.muted)}>{t('amount.due')}</h2>
      <p className="text-3xl font-semibold tabular-nums">{formatAccountingCurrency(view.amountDue)}</p>
      {view.dueDate && (
        <p className={cn('text-sm', view.overdue ? 'text-destructive' : colors.text.muted)}>
          {t('amount.dueBy', { date: formatOperatorDate(view.dueDate, i18n.language) })}
        </p>
      )}
    </section>
  );
}

function DocumentActions({ shareId }: { readonly shareId: string }): React.ReactElement {
  const { t } = useTranslation(INVOICE_PUBLIC_PAYMENT_NS);
  return (
    <nav className="flex flex-wrap gap-2 print:hidden" aria-label={t('actions.downloadPdf')}>
      <Button asChild variant="outline">
        <a href={invoicePublicPdfUrl(shareId)} download>
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />{t('actions.downloadPdf')}
        </a>
      </Button>
      <Button type="button" variant="outline" onClick={() => window.print()}>
        <Printer className="mr-2 h-4 w-4" aria-hidden="true" />{t('actions.print')}
      </Button>
    </nav>
  );
}

/** Επιστροφή από τον πάροχο (`?payment=pchk_…`, ADR-ACC-030): η σελίδα ξεκινά περιμένοντας επιβεβαίωση. */
function returnedFromPayment(): boolean {
  return typeof window !== 'undefined' && /^pchk_/.test(new URLSearchParams(window.location.search).get('payment') ?? '');
}

function PaymentProcessing({ slow }: { readonly slow: boolean }): React.ReactElement {
  const { t } = useTranslation(INVOICE_PUBLIC_PAYMENT_NS);
  return (
    <Alert role="status">
      <Spinner size="small" />
      <AlertTitle>{t('payNow.processingTitle')}</AlertTitle>
      <AlertDescription>{t(slow ? 'payNow.processingSlow' : 'payNow.processingBody')}</AlertDescription>
    </Alert>
  );
}

interface InvoiceViewProps {
  readonly view: InvoicePublicView;
  readonly shareId: string;
  readonly refresh: () => Promise<void>;
}

function InvoiceView({ view, shareId, refresh }: InvoiceViewProps): React.ReactElement {
  const { t } = useTranslation(INVOICE_PUBLIC_PAYMENT_NS);
  const colors = useSemanticColors();
  const [awaiting, setAwaiting] = React.useState(returnedFromPayment);
  const markLaunched = React.useCallback(() => setAwaiting(true), []);
  const confirming = awaiting && view.standing === 'payable';
  const { slow } = usePaymentConfirmationWatch(confirming, refresh);
  const isDraft = view.documentStatus === 'draft' || view.documentStatus === 'rejected';
  return (
    <article className="space-y-6">
      <DocumentHeader view={view} />
      {isDraft && (
        <Alert>
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>{t('draft.title')}</AlertTitle>
          <AlertDescription>{t('draft.body')}</AlertDescription>
        </Alert>
      )}
      <AmountSummary view={view} />
      {confirming && <PaymentProcessing slow={slow} />}
      {view.standing === 'payable' && <InvoicePayNowSection view={view} shareId={shareId} onLaunched={markLaunched} />}
      <DocumentActions shareId={shareId} />
      <InvoicePublicParties view={view} />
      <InvoicePublicBody view={view} />
      <InvoiceIssuerContact view={view} />
      <InvoiceIssuerMessages shareId={shareId} reference={`${view.series}-${view.number}`} />
      <footer className={cn('border-t pt-4 text-xs', colors.text.muted)}>{t('page.privateLink')}</footer>
    </article>
  );
}

function Unavailable({ failed, onRetry }: { readonly failed: boolean; readonly onRetry: () => void }): React.ReactElement {
  const { t } = useTranslation(INVOICE_PUBLIC_PAYMENT_NS);
  const colors = useSemanticColors();
  return (
    <section role="alert" className="space-y-3 py-8 text-center">
      <AlertTriangle className="mx-auto h-10 w-10 text-destructive" aria-hidden="true" />
      <h1 className="text-lg font-semibold">{t('refused.title')}</h1>
      <p className={cn('text-sm', colors.text.muted)}>{t(failed ? 'refused.loadFailed' : 'refused.body')}</p>
      <Button type="button" variant="outline" onClick={onRetry}>{t('refused.retry')}</Button>
    </section>
  );
}

export function SharedInvoicePaymentPageContent(
  { data }: { readonly data: InvoicePaymentShareResolvedData },
): React.ReactElement {
  const { t } = useTranslation(INVOICE_PUBLIC_PAYMENT_NS);
  const { state, retry, refresh } = useInvoicePublicView(data.shareId);
  // Άρνηση = ο σύνδεσμος ή το κουπόνι επίσκεψης δεν ισχύουν πια ⇒ νέα επίλυση του token (ανανέωση σελίδας).
  const reload = () => window.location.reload();
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8" aria-busy={state.kind === 'loading'}>
      {state.kind === 'loading' && (
        <p className="flex items-center justify-center gap-2 py-8 text-sm"><Spinner size="small" />{t('page.loading')}</p>
      )}
      {state.kind === 'ready' && <InvoiceView view={state.view} shareId={data.shareId} refresh={refresh} />}
      {state.kind === 'refused' && <Unavailable failed={false} onRetry={reload} />}
      {state.kind === 'failed' && <Unavailable failed onRetry={retry} />}
    </main>
  );
}
