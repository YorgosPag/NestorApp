'use client';

/**
 * @fileoverview Accounting Subapp — EFKA Monthly Breakdown Table
 * @description Table showing 12-month EFKA contribution breakdown by branch
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
import type { EFKAMonthlyBreakdown as EFKAMonthlyBreakdownType } from '@/subapps/accounting/types';
import { formatCurrency } from '../../utils/format';

// ============================================================================
// TYPES
// ============================================================================

interface EFKAMonthlyBreakdownProps {
  breakdown: EFKAMonthlyBreakdownType[];
}

// ============================================================================
// HELPERS
// ============================================================================

// ============================================================================
// COMPONENT
// ============================================================================

export function EFKAMonthlyBreakdown({ breakdown }: EFKAMonthlyBreakdownProps) {
  const { t } = useTranslation('accounting');

  const sortedBreakdown = [...breakdown].sort((a, b) => a.month - b.month);

  const totals = sortedBreakdown.reduce(
    (acc, row) => ({
      mainPension: acc.mainPension + row.mainPensionAmount,
      health: acc.health + row.healthAmount,
      supplementary: acc.supplementary + row.supplementaryAmount,
      lumpSum: acc.lumpSum + row.lumpSumAmount,
      total: acc.total + row.totalMonthly,
    }),
    { mainPension: 0, health: 0, supplementary: 0, lumpSum: 0, total: 0 },
  );

  return (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-32">{t('efka.month')}</TableHead>
            <TableHead className="text-right">{t('efka.mainPension')}</TableHead>
            <TableHead className="text-right">{t('efka.healthcare')}</TableHead>
            <TableHead className="text-right">{t('efka.supplementary')}</TableHead>
            <TableHead className="text-right">{t('efka.lumpSum')}</TableHead>
            <TableHead className="text-right font-semibold">{t('efka.totalMonthly')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedBreakdown.map((row) => (
            <TableRow key={row.month}>
              <TableCell className="font-medium">
                {t(`common.months.${row.month}`)}
              </TableCell>
              <TableCell className="text-right text-sm">
                {formatCurrency(row.mainPensionAmount)}
              </TableCell>
              <TableCell className="text-right text-sm">
                {formatCurrency(row.healthAmount)}
              </TableCell>
              <TableCell className="text-right text-sm">
                {formatCurrency(row.supplementaryAmount)}
              </TableCell>
              <TableCell className="text-right text-sm">
                {formatCurrency(row.lumpSumAmount)}
              </TableCell>
              <TableCell className="text-right font-semibold text-sm">
                {formatCurrency(row.totalMonthly)}
              </TableCell>
            </TableRow>
          ))}

          {/* Totals Row */}
          <TableRow className="bg-muted/50 font-semibold">
            <TableCell>{t('efka.annualTotal')}</TableCell>
            <TableCell className="text-right">{formatCurrency(totals.mainPension)}</TableCell>
            <TableCell className="text-right">{formatCurrency(totals.health)}</TableCell>
            <TableCell className="text-right">{formatCurrency(totals.supplementary)}</TableCell>
            <TableCell className="text-right">{formatCurrency(totals.lumpSum)}</TableCell>
            <TableCell className="text-right">{formatCurrency(totals.total)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
