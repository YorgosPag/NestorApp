'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/hooks/useAuth';
import type { Invoice } from '@/subapps/accounting/types';
import { InvoiceSummaryCard } from './InvoiceSummaryCard';
import { InvoiceActionsMenu } from './InvoiceActionsMenu';

interface InvoiceDetailsProps {
  invoiceId: string;
  onBack: () => void;
}

export function InvoiceDetails({ invoiceId, onBack }: InvoiceDetailsProps) {
  const { t } = useTranslation('accounting');
  const { user } = useAuth();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchInvoice = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/accounting/invoices/${invoiceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setInvoice(json.data ?? null);
      }
    } catch {
      // Error handled by empty state
    } finally {
      setLoading(false);
    }
  }, [user, invoiceId]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="large" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Invoice not found</p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold">
              {invoice.series}-{invoice.number}
            </h2>
            <p className="text-sm text-muted-foreground">{t(`invoices.types.${invoice.type}`)}</p>
          </div>
        </div>
        <InvoiceActionsMenu invoice={invoice} onRefresh={fetchInvoice} />
      </header>

      <InvoiceSummaryCard invoice={invoice} />

      {/* Line Items */}
      <section className="border border-border rounded-lg p-4">
        <h3 className="font-medium mb-3">{t('invoices.type')}</h3>
        <div className="space-y-2">
          {invoice.lineItems.map((item) => (
            <div
              key={item.lineNumber}
              className="flex items-center justify-between py-2 border-b border-border last:border-0"
            >
              <div className="flex-1">
                <p className="text-sm font-medium">{item.description}</p>
                <p className="text-xs text-muted-foreground">
                  {item.quantity} × {item.unit} @ €{item.unitPrice.toFixed(2)} | ΦΠΑ {item.vatRate}%
                </p>
              </div>
              <span className="font-medium">
                €{item.netAmount.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
