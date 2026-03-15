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
            {t('report.title', { defaultValue: 'Αναφορά Πληρωμών' })}
          </DialogTitle>
        </DialogHeader>

        {/* Loading */}
        {isLoading && (
          <section className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
                label={t('report.totalWithPlan', { defaultValue: 'Με Πρόγραμμα' })}
                value={String(report.summary.totalUnitsWithPlan)}
                icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
              />
              <SummaryCard
                label={t('labels.totalAmount', { defaultValue: 'Σύνολο' })}
                value={formatCurrency(report.summary.totalAmount)}
              />
              <SummaryCard
                label={t('labels.paidAmount', { defaultValue: 'Πληρωμένο' })}
                value={formatCurrency(report.summary.totalPaid)}
                subtitle={`${report.summary.paidPercentage}%`}
              />
              <SummaryCard
                label={t('report.totalOverdue', { defaultValue: 'Ληξιπρόθεσμες' })}
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
                    <TableHead>{t('report.colUnit', { defaultValue: 'Μονάδα' })}</TableHead>
                    <TableHead>{t('report.colBuilding', { defaultValue: 'Κτίριο' })}</TableHead>
                    <TableHead>{t('report.colBuyer', { defaultValue: 'Αγοραστής' })}</TableHead>
                    <TableHead className="text-right">
                      {t('labels.totalAmount', { defaultValue: 'Σύνολο' })}
                    </TableHead>
                    <TableHead className="text-right">
                      {t('labels.paidAmount', { defaultValue: 'Πληρωμένο' })}
                    </TableHead>
                    <TableHead className="text-right">
                      {t('labels.remainingAmount', { defaultValue: 'Υπόλοιπο' })}
                    </TableHead>
                    <TableHead className="text-center">%</TableHead>
                    <TableHead className="text-center">
                      {t('labels.overdueCount', { defaultValue: 'Ληξ/θεσμες' })}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        {t('report.noData', { defaultValue: 'Δεν υπάρχουν δεδομένα.' })}
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.rows.map((row) => (
                      <TableRow
                        key={row.unitId}
                        className={row.overdueInstallments > 0 ? 'bg-red-50' : undefined}
                      >
                        <TableCell className="font-medium">{row.unitLabel}</TableCell>
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
                            <span className="text-muted-foreground">0</span>
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
              <p className="text-xs text-muted-foreground">
                {t('report.generatedAt', { defaultValue: 'Ημ/νία αναφοράς' })}:{' '}
                {new Date(report.generatedAt).toLocaleDateString('el-GR')}
              </p>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={exportToExcel}
              >
                <Download className="h-4 w-4" />
                {t('report.exportExcel', { defaultValue: 'Εξαγωγή Excel' })}
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
  return (
    <article
      className={`rounded-lg border p-3 ${
        variant === 'warning' ? 'border-amber-200 bg-amber-50' : 'bg-card'
      }`}
    >
      <header className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        {icon}
      </header>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      )}
    </article>
  );
}
