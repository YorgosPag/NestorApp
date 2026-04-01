/* eslint-disable design-system/enforce-semantic-colors */
'use client';

/**
 * PaymentReportDialog — Project-level payment report with Excel export
 *
 * Shows summary cards (totals, overdue) + scrollable detail table.
 * "Εξαγωγή Excel" button triggers 2-sheet workbook download.
 *
 * @enterprise ADR-234 Phase 5 — Alerts & Reports
 */

import React, { useEffect } from 'react';
import {
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Download,
} from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { usePaymentReport } from '@/hooks/usePaymentReport';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// =============================================================================
// PROPS
// =============================================================================

interface PaymentReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PaymentReportDialog({
  open,
  onOpenChange,
  projectId,
}: PaymentReportDialogProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation('payments');
  const { report, isLoading, error, fetchReport, exportToExcel } =
    usePaymentReport(projectId);

  // Fetch on open
  useEffect(() => {
    if (open && !report && !isLoading) {
      fetchReport();
    }
  }, [open, report, isLoading, fetchReport]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {t('report.title')}
          </DialogTitle>
        </DialogHeader>

        {/* Loading */}
        {isLoading && (
          <section className="flex items-center justify-center p-12">
            <Loader2 className={cn("h-6 w-6 animate-spin", colors.text.muted)} />
          </section>
        )}

        {/* Error */}
        {error && (
          <section className="p-4 text-center text-sm text-destructive">
            {error}
          </section>
        )}

        {/* Report Content */}
        {report && !isLoading && (
          <section className="flex flex-col gap-4 overflow-hidden">
            {/* Summary Cards */}
            <nav className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryCard
                label={t('report.totalWithPlan')}
                value={String(report.summary.totalPropertiesWithPlan)}
                icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
              />
              <SummaryCard
                label={t('labels.totalAmount')}
                value={formatCurrency(report.summary.totalAmount)}
              />
              <SummaryCard
                label={t('labels.paidAmount')}
                value={formatCurrency(report.summary.totalPaid)}
                subtitle={`${report.summary.paidPercentage}%`}
              />
              <SummaryCard
                label={t('report.totalOverdue')}
                value={String(report.summary.totalOverdueCount)}
                icon={
                  report.summary.totalOverdueCount > 0 ? (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )
                }
                variant={report.summary.totalOverdueCount > 0 ? 'warning' : 'default'}
              />
            </nav>

            {/* Detail Table */}
            <section className="flex-1 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('report.colUnit')}</TableHead>
                    <TableHead>{t('report.colBuilding')}</TableHead>
                    <TableHead>{t('report.colBuyer')}</TableHead>
                    <TableHead className="text-right">
                      {t('labels.totalAmount')}
                    </TableHead>
                    <TableHead className="text-right">
                      {t('labels.paidAmount')}
                    </TableHead>
                    <TableHead className="text-right">
                      {t('labels.remainingAmount')}
                    </TableHead>
                    <TableHead className="text-center">%</TableHead>
                    <TableHead className="text-center">
                      {t('labels.overdueCount')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className={cn("text-center py-8", colors.text.muted)}>
                        {t('report.noData')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.rows.map((row) => (
                      <TableRow
                        key={row.propertyId}
                        className={row.overdueInstallments > 0 ? 'bg-red-50' : undefined}
                      >
                        <TableCell className="font-medium">{row.propertyLabel}</TableCell>
                        <TableCell>{row.buildingName}</TableCell>
                        <TableCell>{row.buyerName}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(row.totalAmount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(row.paidAmount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(row.remainingAmount)}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          {row.paidPercentage}%
                        </TableCell>
                        <TableCell className="text-center">
                          {row.overdueInstallments > 0 ? (
                            <Badge variant="destructive" className="text-xs">
                              {row.overdueInstallments}
                            </Badge>
                          ) : (
                            <span className={colors.text.muted}>0</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </section>

            {/* Footer with export button */}
            <footer className="flex items-center justify-between border-t pt-3">
              <p className={cn("text-xs", colors.text.muted)}>
                {t('report.generatedAt')}:{' '}
                {new Date(report.generatedAt).toLocaleDateString('el-GR')}
              </p>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={exportToExcel}
              >
                <Download className="h-4 w-4" />
                {t('report.exportExcel')}
              </Button>
            </footer>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// SUMMARY CARD (internal)
// =============================================================================

interface SummaryCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'warning';
}

function SummaryCard({ label, value, subtitle, icon, variant = 'default' }: SummaryCardProps) {
  const colors = useSemanticColors();
  return (
    <article
      className={`rounded-lg border p-3 ${
        variant === 'warning' ? 'border-amber-200 bg-amber-50' : 'bg-card'
      }`}
    >
      <header className="flex items-center justify-between">
        <p className={cn("text-xs", colors.text.muted)}>{label}</p>
        {icon}
      </header>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {subtitle && (
        <p className={cn("text-xs", colors.text.muted)}>{subtitle}</p>
      )}
    </article>
  );
}
