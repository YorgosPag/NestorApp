'use client';

/**
 * @fileoverview Accounting Subapp — EFKA Payments List
 * @description List of EFKA monthly payments with status badges
 * @author Claude Code (Anthropic AI) + Georgios Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-006 EFKA Contributions
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { EFKAPayment, EFKAPaymentStatus } from '@/subapps/accounting/types';
import { formatCurrency } from '../../utils/format';

// ============================================================================
// TYPES
// ============================================================================

interface EFKAPaymentsListProps {
  payments: EFKAPayment[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PAYMENT_STATUS_VARIANTS: Record<
  EFKAPaymentStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  upcoming: 'outline',
  due: 'secondary',
  paid: 'default',
  overdue: 'destructive',
  keao: 'destructive',
};

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

// ============================================================================
// COMPONENT
// ============================================================================

export function EFKAPaymentsList({ payments }: EFKAPaymentsListProps) {
  const { t } = useTranslation('accounting');

  const sortedPayments = [...payments].sort((a, b) => a.month - b.month);

  if (sortedPayments.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-muted-foreground">{t('efka.noPayments')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-32">{t('efka.month')}</TableHead>
            <TableHead className="text-right">{t('efka.amount')}</TableHead>
            <TableHead className="w-28">{t('efka.dueDate')}</TableHead>
            <TableHead className="w-28">{t('efka.paidDate')}</TableHead>
            <TableHead className="w-28">{t('efka.status')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedPayments.map((payment) => (
            <TableRow key={payment.paymentId}>
              <TableCell className="font-medium">
                {t(`common.months.${payment.month}`)}
              </TableCell>
              <TableCell className="text-right font-medium text-sm">
                {formatCurrency(payment.amount)}
              </TableCell>
              <TableCell className="text-sm">
                {formatDate(payment.dueDate)}
              </TableCell>
              <TableCell className="text-sm">
                {payment.paidDate ? formatDate(payment.paidDate) : '-'}
              </TableCell>
              <TableCell>
                <Badge variant={PAYMENT_STATUS_VARIANTS[payment.status]}>
                  {t(`efka.paymentStatuses.${payment.status}`)}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
