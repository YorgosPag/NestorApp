/**
 * «Πληρωμή τώρα» — ο πελάτης διαλέγει τρόπο και ακολουθεί **ξεχωριστή ροή ανά τρόπο** (ADR-ACC-030 §5):
 *
 * - **Κάρτα** (Visa / Mastercard, και Apple Pay / Google Pay όπου υποστηρίζονται) → ασφαλής σελίδα του παρόχου.
 * - **IRIS** → ασφαλής σελίδα του παρόχου, όπου επιλέγει τράπεζα ή σαρώνει QR. Τα λογότυπα τραπεζών είναι **του
 *   παρόχου** — η σελίδα μας δεν δείχνει ούτε συνδέει ποτέ σε τράπεζες (εμπορικά σήματα · όψη phishing).
 * - **Τραπεζική μεταφορά** → οι υπάρχουσες οδηγίες με EPC QR (ADR-ACC-018 §15–16), αμετάβλητες.
 *
 * Ποιοι τρόποι εμφανίζονται το αποφασίζει ο διακομιστής (`view.onlineMethods`, `view.payment`). Το ποσό δεν το
 * στέλνει ποτέ η σελίδα.
 *
 * @module components/shared/pages/invoice-payment/InvoicePayNowSection
 */

'use client';

import React from 'react';
import { CreditCard, Landmark, ShieldCheck, Zap, type LucideIcon } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import type { InvoicePublicView } from '@/subapps/accounting/types/invoice-public-view';
import type { OnlinePaymentMethod } from '@/subapps/accounting/types/online-payment';
import { formatAccountingCurrency } from '@/subapps/accounting/utils/format';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { InvoicePublicPaymentSection } from './InvoicePublicPaymentSection';
import { INVOICE_PUBLIC_PAYMENT_NS } from './invoice-payment-primitives';
import { useInvoiceCheckout, type InvoiceCheckoutState } from './useInvoiceCheckout';

type PayTab = OnlinePaymentMethod | 'transfer';

const METHOD_ICON: Readonly<Record<PayTab, LucideIcon>> = {
  card: CreditCard,
  iris: Zap,
  transfer: Landmark,
};

interface OnlineMethodPanelProps {
  readonly method: OnlinePaymentMethod;
  readonly amountDue: number;
  readonly checkout: InvoiceCheckoutState;
  readonly onStart: (method: OnlinePaymentMethod) => void;
}

function OnlineMethodPanel({ method, amountDue, checkout, onStart }: OnlineMethodPanelProps): React.ReactElement {
  const { t } = useTranslation(INVOICE_PUBLIC_PAYMENT_NS);
  const colors = useSemanticColors();
  const starting = checkout.kind === 'starting' && checkout.method === method;
  return (
    <article className="space-y-3">
      <p className="text-sm">{t(method === 'card' ? 'payNow.cardHint' : 'payNow.irisHint')}</p>
      <Button type="button" size="lg" className="w-full sm:w-auto" disabled={checkout.kind === 'starting'} onClick={() => onStart(method)}>
        {starting
          ? <><Spinner size="small" />{t('payNow.starting')}</>
          : t('payNow.continue', { amount: formatAccountingCurrency(amountDue) })}
      </Button>
      <p className={cn('flex items-center gap-1 text-xs', colors.text.muted)}>
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />{t('payNow.secureNote')}
      </p>
    </article>
  );
}

function CheckoutRefusal({ checkout }: { readonly checkout: InvoiceCheckoutState }): React.ReactElement | null {
  const { t } = useTranslation(INVOICE_PUBLIC_PAYMENT_NS);
  if (checkout.kind !== 'refused') return null;
  const known = ['method-unavailable', 'provider-unavailable', 'not-payable'].includes(checkout.reason);
  return (
    <Alert variant="destructive" role="alert">
      <AlertDescription>{t(`payNow.errors.${known ? checkout.reason : 'generic'}`)}</AlertDescription>
    </Alert>
  );
}

interface InvoicePayNowSectionProps {
  readonly view: InvoicePublicView;
  readonly shareId: string;
  /** Η πληρωμή άνοιξε σε άλλη καρτέλα ⇒ η σελίδα αρχίζει να παρακολουθεί **αυτή** την απόπειρα. */
  readonly onLaunched: (checkoutId: string) => void;
}

export function InvoicePayNowSection({ view, shareId, onLaunched }: InvoicePayNowSectionProps): React.ReactElement {
  const { t, i18n } = useTranslation(INVOICE_PUBLIC_PAYMENT_NS);
  const { state: checkout, start } = useInvoiceCheckout(shareId, i18n.language === 'en' ? 'en' : 'el');
  const launchedId = checkout.kind === 'launched' ? checkout.checkoutId : null;
  React.useEffect(() => { if (launchedId !== null) onLaunched(launchedId); }, [launchedId, onLaunched]);

  const tabs: PayTab[] = [...view.onlineMethods, ...(view.payment ? ['transfer' as const] : [])];
  if (tabs.length === 0) return <p className="rounded-lg border p-4 text-sm">{t('payNow.noMethodBody')}</p>;
  if (tabs.length === 1 && view.payment) return <InvoicePublicPaymentSection payment={view.payment} amountDue={view.amountDue} />;

  return (
    <section aria-labelledby="invoice-pay-now-title" className="space-y-4 rounded-lg border p-4 print:hidden">
      <h2 id="invoice-pay-now-title" className="text-base font-semibold">{t('payNow.title')}</h2>
      <Tabs defaultValue={tabs[0]}>
        <TabsList aria-label={t('payNow.methodsLabel')} className="flex-wrap">
          {tabs.map((tab) => {
            const Icon = METHOD_ICON[tab];
            return (
              <TabsTrigger key={tab} value={tab} className="gap-2">
                <Icon className="h-4 w-4" aria-hidden="true" />{t(`payNow.${tab}`)}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {view.onlineMethods.map((method) => (
          <TabsContent key={method} value={method}>
            <OnlineMethodPanel method={method} amountDue={view.amountDue} checkout={checkout} onStart={start} />
          </TabsContent>
        ))}
        {view.payment && (
          <TabsContent value="transfer">
            <InvoicePublicPaymentSection payment={view.payment} amountDue={view.amountDue} />
          </TabsContent>
        )}
      </Tabs>
      <CheckoutRefusal checkout={checkout} />
      <p className="sr-only" aria-live="polite">
        {checkout.kind === 'starting' ? t('payNow.starting') : ''}
      </p>
    </section>
  );
}
