'use client';

/**
 * =============================================================================
 * WorkerStampsTable — Enterprise table for per-worker stamps & contributions
 * =============================================================================
 *
 * Displays workers with insurance class, stamps, and contribution breakdowns.
 * Includes totals row and warning indicators for incomplete data.
 *
 * @module components/projects/ika/components/WorkerStampsTable
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System (Phase 3)
 */

import React from 'react';
import { Settings2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
import { InsuranceClassBadge } from './InsuranceClassBadge';
import type { StampsMonthSummary, WorkerStampsSummary } from '../contracts';

interface WorkerStampsTableProps {
  /** Monthly stamps summary */
  summary: StampsMonthSummary;
  /** Callback when user clicks edit for a worker */
  onEditWorker: (worker: WorkerStampsSummary) => void;
}

/**
 * Formats a number as Euro currency (Greek locale).
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function WorkerStampsTable({ summary, onEditWorker }: WorkerStampsTableProps) {
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const typography = useTypography();
  const spacing = useSpacingTokens();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('ika.stampsTab.columns.worker')}</TableHead>
          <TableHead>{t('ika.stampsTab.columns.insuranceClass')}</TableHead>
          <TableHead className="text-right">{t('ika.stampsTab.columns.imputedWage')}</TableHead>
          <TableHead className="text-right">{t('ika.stampsTab.columns.stamps')}</TableHead>
          <TableHead className="text-right">{t('ika.stampsTab.columns.employerContrib')}</TableHead>
          <TableHead className="text-right">{t('ika.stampsTab.columns.employeeContrib')}</TableHead>
          <TableHead className="text-right">{t('ika.stampsTab.columns.total')}</TableHead>
          <TableHead className="text-center">{t('ika.stampsTab.columns.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {summary.workerSummaries.map((ws) => (
          <TableRow key={ws.contactId} className={ws.hasIssues ? colors.bg.warning : undefined}>
            <TableCell>
              <div>
                <p className={typography.label.sm}>{ws.workerName}</p>
                {ws.companyName && (
                  <p className={cn(typography.body.xs, 'text-muted-foreground')}>
                    {ws.companyName}
                  </p>
                )}
              </div>
            </TableCell>
            <TableCell>
              <InsuranceClassBadge classNumber={ws.insuranceClassNumber} />
            </TableCell>
            <TableCell className="text-right">
              {ws.imputedDailyWage !== null
                ? `€${ws.imputedDailyWage.toFixed(2)}`
                : '—'}
            </TableCell>
            <TableCell className="text-right">
              {ws.stampsCount > 0 ? ws.stampsCount : '—'}
            </TableCell>
            <TableCell className="text-right">
              {ws.employerContribution > 0
                ? formatCurrency(ws.employerContribution)
                : '—'}
            </TableCell>
            <TableCell className="text-right">
              {ws.employeeContribution > 0
                ? formatCurrency(ws.employeeContribution)
                : '—'}
            </TableCell>
            <TableCell className="text-right">
              {ws.totalContribution > 0
                ? formatCurrency(ws.totalContribution)
                : '—'}
            </TableCell>
            <TableCell className="text-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEditWorker(ws)}
                aria-label={t('ika.stampsTab.dialog.title')}
              >
                <Settings2 className={iconSizes.sm} />
              </Button>
            </TableCell>
          </TableRow>
        ))}
        {summary.workerSummaries.length === 0 && (
          <TableRow>
            <TableCell colSpan={8} className={cn('text-center', spacing.padding.lg, 'text-muted-foreground')}>
              {t('ika.stampsTab.noWorkers')}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
      {summary.workerSummaries.length > 0 && (
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3} className={cn(typography.label.sm, 'font-bold')}>
              {t('ika.stampsTab.totalsRow')}
            </TableCell>
            <TableCell className={cn('text-right', typography.label.sm, 'font-bold')}>
              {summary.totalStamps}
            </TableCell>
            <TableCell className={cn('text-right', typography.label.sm, 'font-bold')}>
              {formatCurrency(summary.totalEmployerContribution)}
            </TableCell>
            <TableCell className={cn('text-right', typography.label.sm, 'font-bold')}>
              {formatCurrency(summary.totalEmployeeContribution)}
            </TableCell>
            <TableCell className={cn('text-right', typography.label.sm, 'font-bold', colors.text.success)}>
              {formatCurrency(summary.totalContribution)}
            </TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      )}
    </Table>
  );
}
