'use client';

/**
 * @fileoverview Accounting Subapp — Tax Installments Card
 * @description Card showing tax installment list with status badges
 * @author Claude Code (Anthropic AI) + Georgios Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-009 Tax Engine
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { TaxInstallment, TaxInstallmentStatus } from '@/subapps/accounting/types';
import { formatCurrency } from '../../utils/format';

// ============================================================================
// TYPES
// ============================================================================

interface InstallmentsCardProps {
  installments: TaxInstallment[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const INSTALLMENT_STATUS_VARIANTS: Record<
  TaxInstallmentStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  upcoming: 'outline',
  due: 'secondary',
  paid: 'default',
  overdue: 'destructive',
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

export function InstallmentsCard({ installments }: InstallmentsCardProps) {
  const { t } = useTranslation('accounting');

  const sortedInstallments = [...installments].sort(
    (a, b) => a.installmentNumber - b.installmentNumber,
  );

  const totalAmount = sortedInstallments.reduce((sum, inst) => sum + inst.amount, 0);
  const paidAmount = sortedInstallments
    .filter((inst) => inst.status === 'paid')
    .reduce((sum, inst) => sum + inst.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span>{t('reports.installments')}</span>
          <span className="text-sm font-normal text-muted-foreground">
            {t('installmentsPaid', {
              paid: formatCurrency(paidAmount),
              total: formatCurrency(totalAmount),
            })}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead className="w-28">{t('reports.dueDate')}</TableHead>
                <TableHead className="text-right">{t('reports.amount')}</TableHead>
                <TableHead className="w-28">{t('reports.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedInstallments.map((inst) => (
                <TableRow key={inst.installmentNumber}>
                  <TableCell className="font-medium">
                    {t('installmentNumber', { number: inst.installmentNumber })}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(inst.dueDate)}
                  </TableCell>
                  <TableCell className="text-right font-medium text-sm">
                    {formatCurrency(inst.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={INSTALLMENT_STATUS_VARIANTS[inst.status]}>
                      {t(`reports.installmentStatuses.${inst.status}`)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
