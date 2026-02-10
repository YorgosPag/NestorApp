'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/hooks/useAuth';
import { PaymentMethodSelector } from '../../shared/PaymentMethodSelector';
import { CustomerSelector } from './CustomerSelector';
import { LineItemsEditor } from './LineItemsEditor';
import { InvoicePreview } from './InvoicePreview';
import { useServicePresets } from '@/subapps/accounting/hooks';
import type {
  InvoiceType,
  InvoiceLineItem,
  InvoiceCustomer,
  PaymentMethod,
  MyDataIncomeType,
} from '@/subapps/accounting/types';

interface InvoiceFormProps {
  onSuccess: (invoiceId: string) => void;
  onCancel: () => void;
}

interface InvoiceFormState {
  type: InvoiceType;
  series: string;
  issueDate: string;
  dueDate: string;
  customer: InvoiceCustomer;
  lineItems: InvoiceLineItem[];
  paymentMethod: PaymentMethod;
  notes: string;
}

const DEFAULT_CUSTOMER: InvoiceCustomer = {
  contactId: null,
  name: '',
  vatNumber: null,
  taxOffice: null,
  address: null,
  city: null,
  postalCode: null,
  country: 'GR',
  email: null,
};

function calculateTotals(lineItems: InvoiceLineItem[]) {
  let totalNet = 0;
  let totalVat = 0;

  for (const item of lineItems) {
    const net = item.quantity * item.unitPrice;
    const vat = Math.round(net * (item.vatRate / 100) * 100) / 100;
    totalNet += net;
    totalVat += vat;
  }

  return {
    totalNetAmount: Math.round(totalNet * 100) / 100,
    totalVatAmount: Math.round(totalVat * 100) / 100,
    totalGrossAmount: Math.round((totalNet + totalVat) * 100) / 100,
  };
}

export function InvoiceForm({ onSuccess, onCancel }: InvoiceFormProps) {
  const { t } = useTranslation('accounting');
  const { user } = useAuth();
  const { presets } = useServicePresets();

  const DEFAULT_LINE_ITEM: InvoiceLineItem = {
    lineNumber: 1,
    description: '',
    quantity: 1,
    unit: t('units.pieces'),
    unitPrice: 0,
    vatRate: 24,
    netAmount: 0,
    mydataCode: 'category1_3' as MyDataIncomeType,
  };

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<InvoiceFormState>({
    type: 'service_invoice',
    series: 'A',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    customer: { ...DEFAULT_CUSTOMER },
    lineItems: [{ ...DEFAULT_LINE_ITEM }],
    paymentMethod: 'bank_transfer',
    notes: '',
  });

  const updateField = useCallback(<K extends keyof InvoiceFormState>(
    key: K,
    value: InvoiceFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleLineItemsChange = useCallback((items: InvoiceLineItem[]) => {
    setForm((prev) => ({ ...prev, lineItems: items }));
  }, []);

  const handleCustomerChange = useCallback((customer: InvoiceCustomer) => {
    setForm((prev) => ({ ...prev, customer }));
  }, []);

  const totals = calculateTotals(form.lineItems);

  const handleSubmit = useCallback(async () => {
    if (!user) return;
    if (!form.customer.name) {
      setError(t('forms.validation.required'));
      return;
    }
    if (form.lineItems.length === 0) {
      setError(t('forms.validation.minOneLineItem'));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const today = new Date().toISOString().split('T')[0];
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const quarter = currentMonth <= 3 ? 1 : currentMonth <= 6 ? 2 : currentMonth <= 9 ? 3 : 4;

      // Build vatBreakdown from line items
      const vatMap = new Map<number, { netAmount: number; vatAmount: number }>();
      for (const item of form.lineItems) {
        const net = item.quantity * item.unitPrice;
        const vat = Math.round(net * (item.vatRate / 100) * 100) / 100;
        const existing = vatMap.get(item.vatRate) ?? { netAmount: 0, vatAmount: 0 };
        vatMap.set(item.vatRate, {
          netAmount: existing.netAmount + net,
          vatAmount: existing.vatAmount + vat,
        });
      }

      const vatBreakdown = Array.from(vatMap.entries()).map(([vatRate, amounts]) => ({
        vatRate,
        netAmount: Math.round(amounts.netAmount * 100) / 100,
        vatAmount: Math.round(amounts.vatAmount * 100) / 100,
      }));

      // Recalculate line items with proper netAmount
      const processedLineItems = form.lineItems.map((item, idx) => ({
        ...item,
        lineNumber: idx + 1,
        netAmount: Math.round(item.quantity * item.unitPrice * 100) / 100,
      }));

      const body = {
        type: form.type,
        series: form.series,
        issueDate: form.issueDate || today,
        dueDate: form.dueDate || null,
        issuer: {
          name: 'Παγώνης Κατασκευαστική',
          vatNumber: '',
          taxOffice: '',
          address: '',
          city: '',
          postalCode: '',
          phone: null,
          email: null,
          profession: 'Μηχανικός',
        },
        customer: form.customer,
        lineItems: processedLineItems,
        currency: 'EUR',
        totalNetAmount: totals.totalNetAmount,
        totalVatAmount: totals.totalVatAmount,
        totalGrossAmount: totals.totalGrossAmount,
        vatBreakdown,
        paymentMethod: form.paymentMethod,
        paymentStatus: 'unpaid' as const,
        payments: [],
        totalPaid: 0,
        balanceDue: totals.totalGrossAmount,
        mydata: {
          status: 'draft' as const,
          mark: null,
          uid: null,
          authCode: null,
          submittedAt: null,
          respondedAt: null,
          errorMessage: null,
        },
        projectId: null,
        relatedInvoiceId: null,
        journalEntryId: null,
        notes: form.notes || null,
        fiscalYear: currentYear,
      };

      const res = await fetch('/api/accounting/invoices', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error ?? `HTTP ${res.status}`);
      }

      const result = await res.json();
      onSuccess(result.data?.id ?? result.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  }, [user, form, totals, t, onSuccess]);

  return (
    <div className="space-y-6">
      {/* Invoice Type & Series */}
      <Card>
        <CardHeader>
          <CardTitle>{t('invoices.type')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <fieldset>
              <Label htmlFor="invoiceType">{t('invoices.type')}</Label>
              <Select
                value={form.type}
                onValueChange={(v) => updateField('type', v as InvoiceType)}
              >
                <SelectTrigger id="invoiceType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="service_invoice">{t('invoices.types.service_invoice')}</SelectItem>
                  <SelectItem value="sales_invoice">{t('invoices.types.sales_invoice')}</SelectItem>
                  <SelectItem value="retail_receipt">{t('invoices.types.retail_receipt')}</SelectItem>
                  <SelectItem value="service_receipt">{t('invoices.types.service_receipt')}</SelectItem>
                  <SelectItem value="credit_invoice">{t('invoices.types.credit_invoice')}</SelectItem>
                </SelectContent>
              </Select>
            </fieldset>

            <fieldset>
              <Label htmlFor="series">{t('invoices.series')}</Label>
              <Input
                id="series"
                value={form.series}
                onChange={(e) => updateField('series', e.target.value)}
                maxLength={5}
              />
            </fieldset>

            <fieldset>
              <Label htmlFor="issueDate">{t('invoices.issueDate')}</Label>
              <Input
                id="issueDate"
                type="date"
                value={form.issueDate}
                onChange={(e) => updateField('issueDate', e.target.value)}
              />
            </fieldset>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <fieldset>
              <Label htmlFor="dueDate">{t('invoices.dueDate')}</Label>
              <Input
                id="dueDate"
                type="date"
                value={form.dueDate}
                onChange={(e) => updateField('dueDate', e.target.value)}
              />
            </fieldset>

            <fieldset>
              <Label>{t('invoices.paymentStatus')}</Label>
              <PaymentMethodSelector
                value={form.paymentMethod}
                onValueChange={(v) => updateField('paymentMethod', v)}
              />
            </fieldset>
          </div>
        </CardContent>
      </Card>

      {/* Customer */}
      <Card>
        <CardHeader>
          <CardTitle>{t('invoices.customer')}</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerSelector
            customer={form.customer}
            onCustomerChange={handleCustomerChange}
          />
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>{t('forms.addLineItem')}</CardTitle>
        </CardHeader>
        <CardContent>
          <LineItemsEditor
            lineItems={form.lineItems}
            onLineItemsChange={handleLineItemsChange}
            presets={presets}
          />
        </CardContent>
      </Card>

      {/* Preview & Totals */}
      <InvoicePreview totals={totals} lineItems={form.lineItems} />

      {/* Notes */}
      <Card>
        <CardContent className="pt-6">
          <Label htmlFor="notes">{t('forms.notes')}</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            rows={3}
            className="mt-1"
          />
        </CardContent>
      </Card>

      {/* Actions */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <footer className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          {t('forms.cancel')}
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? <Spinner size="small" className="mr-2" /> : null}
          {t('forms.create')}
        </Button>
      </footer>
    </div>
  );
}
