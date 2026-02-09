'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Invoice } from '@/subapps/accounting/types';

interface InvoiceRowProps {
  invoice: Invoice;
  onRefresh: () => Promise<void>;
}

const PAYMENT_STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  paid: 'default',
  partial: 'secondary',
  unpaid: 'destructive',
};

const MYDATA_STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  accepted: 'default',
  sent: 'secondary',
  draft: 'outline',
  rejected: 'destructive',
  cancelled: 'destructive',
};

export function InvoiceRow({ invoice }: InvoiceRowProps) {
  const { t } = useTranslation('accounting');
  const router = useRouter();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(amount);

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
      new Date(iso)
    );

  return (
    <TableRow className="cursor-pointer hover:bg-muted/50">
      <TableCell className="font-medium">
        {invoice.series}-{invoice.number}
      </TableCell>
      <TableCell>{formatDate(invoice.issueDate)}</TableCell>
      <TableCell className="max-w-[200px] truncate">{invoice.customer.name}</TableCell>
      <TableCell className="text-sm">{t(`invoices.types.${invoice.type}`)}</TableCell>
      <TableCell className="text-right font-medium">
        {formatCurrency(invoice.totalGrossAmount)}
      </TableCell>
      <TableCell>
        <Badge variant={PAYMENT_STATUS_VARIANTS[invoice.paymentStatus] ?? 'outline'}>
          {t(`invoices.paymentStatuses.${invoice.paymentStatus}`)}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={MYDATA_STATUS_VARIANTS[invoice.mydata.status] ?? 'outline'}>
          {t(`invoices.mydataStatuses.${invoice.mydata.status}`)}
        </Badge>
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/accounting/invoices?view=${invoice.invoiceId}`)}
          aria-label={t('invoices.invoiceDetails')}
        >
          <Eye className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
