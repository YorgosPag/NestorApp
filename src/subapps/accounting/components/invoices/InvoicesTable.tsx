'use client';

import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Invoice } from '@/subapps/accounting/types';
import { InvoiceRow } from './InvoiceRow';

interface InvoicesTableProps {
  invoices: Invoice[];
  onRefresh: () => Promise<void>;
}

export function InvoicesTable({ invoices, onRefresh }: InvoicesTableProps) {
  const { t } = useTranslation('accounting');

  return (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-32">{t('invoices.seriesNumber')}</TableHead>
            <TableHead className="w-28">{t('invoices.issueDate')}</TableHead>
            <TableHead>{t('invoices.customer')}</TableHead>
            <TableHead className="w-44">{t('invoices.type')}</TableHead>
            <TableHead className="w-28 text-right">{t('invoices.grossAmount')}</TableHead>
            <TableHead className="w-28">{t('invoices.paymentStatus')}</TableHead>
            <TableHead className="w-28">{t('invoices.mydataStatus')}</TableHead>
            <TableHead className="w-20">{t('invoices.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <InvoiceRow key={invoice.invoiceId} invoice={invoice} onRefresh={onRefresh} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
