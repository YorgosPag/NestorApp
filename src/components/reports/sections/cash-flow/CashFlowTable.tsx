'use client';

import '@/lib/design-system';

/**
 * @module reports/sections/cash-flow/CashFlowTable
 * @enterprise ADR-268 Phase 8 — Q1: Monthly breakdown table
 */

import { useTranslation } from 'react-i18next';
import { getStatusColor } from '@/lib/design-system';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { CashFlowMonthRow } from '@/services/cash-flow/cash-flow.types';
import { formatCurrencyWhole as formatCurrency } from '@/lib/intl-domain';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CashFlowTableProps {
  rows: CashFlowMonthRow[];
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cellClass(value: number): string {
  if (value < 0) return 'text-destructive font-medium';
  if (value === 0) return 'text-muted-foreground';
  return '';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CashFlowTable({ rows, loading }: CashFlowTableProps) {
  const { t } = useTranslation('cash-flow');

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('table.title', 'Monthly Breakdown')}</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center">
          <p className="text-sm text-muted-foreground">{t('table.loading', 'Loading...')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('table.title', 'Monthly Breakdown')}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background">{t('table.month')}</TableHead>
              <TableHead className="text-right">{t('table.opening', 'Opening')}</TableHead>
              <TableHead className="text-right">{t('table.installmentsDue')}</TableHead>
              <TableHead className="text-right">{t('table.cheqMat', 'Cheques')}</TableHead>
              <TableHead className="text-right font-semibold">{t('table.totalInflow')}</TableHead>
              <TableHead className="text-right">{t('table.purchaseOrders')}</TableHead>
              <TableHead className="text-right">{t('table.invoices')}</TableHead>
              <TableHead className="text-right">{t('table.efka')}</TableHead>
              <TableHead className="text-right">{t('table.recurring')}</TableHead>
              <TableHead className="text-right font-semibold">{t('table.totalOutflow')}</TableHead>
              <TableHead className="text-right font-semibold">{t('table.netCashFlow')}</TableHead>
              <TableHead className="text-right font-semibold">{t('table.closingBalance', 'Closing')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.month}
                className={cn(row.closingBalance < 0 && 'bg-destructive/5')}
              >
                <TableCell className="sticky left-0 bg-background font-medium">
                  {row.label}
                </TableCell>
                <TableCell className={cn('text-right', cellClass(row.openingBalance))}>
                  {formatCurrency(row.openingBalance)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(row.installmentsDue)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(row.chequesMaturingAmount)}
                  {row.chequesMaturingCount > 0 && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({row.chequesMaturingCount})
                    </span>
                  )}
                </TableCell>
                <TableCell className={cn('text-right font-semibold', getStatusColor('active', 'text'))}>
                  {formatCurrency(row.totalInflow)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(row.purchaseOrders)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(row.invoicesDue)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(row.efka)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(row.recurringPayments)}
                </TableCell>
                <TableCell className={cn('text-right font-semibold', getStatusColor('error', 'text'))}>
                  {formatCurrency(row.totalOutflow)}
                </TableCell>
                <TableCell className={cn('text-right font-semibold', cellClass(row.netCashFlow))}>
                  {formatCurrency(row.netCashFlow)}
                </TableCell>
                <TableCell className={cn('text-right font-bold', cellClass(row.closingBalance))}>
                  {formatCurrency(row.closingBalance)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
