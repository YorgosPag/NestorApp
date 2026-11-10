'use client';

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { InvoiceAmounts } from '@/subapps/accounting/utils/invoice-amounts';
import { formatAccountingCurrency } from '../../../utils/format';

import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface InvoicePreviewProps {
  /** Από το `invoiceAmountsOf` — ο ΙΔΙΟΣ υπολογισμός που στέλνεται και που ελέγχει ο διακομιστής (ADR-ACC-003 §22.2). */
  totals: InvoiceAmounts;
}

export function InvoicePreview({ totals }: InvoicePreviewProps) {
  const { t } = useTranslation(['accounting', 'accounting-tax-offices']);
  const colors = useSemanticColors();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('forms.preview')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className={colors.text.muted}>{t('invoices.netAmount')}</span>
            <span className="font-medium">{formatAccountingCurrency(totals.totalNetAmount)}</span>
          </div>

          {totals.vatBreakdown.map(({ vatRate, vatAmount }) => (
            <div key={vatRate} className="flex justify-between text-sm">
              <span className={colors.text.muted}>ΦΠΑ {vatRate}%</span>
              <span className="font-medium">{formatAccountingCurrency(vatAmount)}</span>
            </div>
          ))}

          <Separator />

          <div className="flex justify-between text-sm">
            <span className={colors.text.muted}>{t('forms.totalVat')}</span>
            <span className="font-medium">{formatAccountingCurrency(totals.totalVatAmount)}</span>
          </div>

          <Separator />

          <div className="flex justify-between text-lg font-bold">
            <span>{t('forms.grandTotal')}</span>
            <span>{formatAccountingCurrency(totals.totalGrossAmount)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
