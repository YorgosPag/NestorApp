'use client';

/**
 * @fileoverview Accounting Subapp — VAT Report Card
 * @description Card showing annual VAT summary (output VAT, input VAT, payable)
 * @author Claude Code (Anthropic AI) + Georgios Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-004 VAT Engine
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { useVATSummary } from '../../hooks/useVATSummary';
import type { VATAnnualSummary } from '@/subapps/accounting/types';

// ============================================================================
// TYPES
// ============================================================================

interface VATReportCardProps {
  fiscalYear: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(amount);
}

function isAnnualSummary(data: unknown): data is VATAnnualSummary {
  return (
    typeof data === 'object' &&
    data !== null &&
    'annualOutputVat' in data &&
    'annualDeductibleInputVat' in data
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function VATReportCard({ fiscalYear }: VATReportCardProps) {
  const { t } = useTranslation('accounting');

  const { summary, loading, error } = useVATSummary({ fiscalYear });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('reports.vatReport')}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="medium" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive text-center py-4">{error}</p>
        ) : !summary || !isAnnualSummary(summary) ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('reports.noVATData')}
          </p>
        ) : (
          <dl className="space-y-3">
            {/* Output VAT */}
            <div className="flex items-center justify-between">
              <dt className="text-sm text-muted-foreground">{t('reports.outputVAT')}</dt>
              <dd className="font-medium text-sm">
                {formatCurrency(summary.annualOutputVat)}
              </dd>
            </div>

            {/* Deductible Input VAT */}
            <div className="flex items-center justify-between">
              <dt className="text-sm text-muted-foreground">{t('reports.inputVAT')}</dt>
              <dd className="font-medium text-sm">
                {formatCurrency(summary.annualDeductibleInputVat)}
              </dd>
            </div>

            <Separator />

            {/* VAT Payable */}
            <div className="flex items-center justify-between">
              <dt className="text-sm font-semibold text-foreground">{t('reports.vatPayable')}</dt>
              <dd
                className={`text-lg font-bold ${
                  summary.annualVatPayable > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {formatCurrency(summary.annualVatPayable)}
              </dd>
            </div>

            {/* VAT Credit (if any) */}
            {summary.annualVatCredit > 0 && (
              <div className="flex items-center justify-between">
                <dt className="text-sm text-muted-foreground">{t('reports.vatCredit')}</dt>
                <dd className="font-medium text-sm text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(summary.annualVatCredit)}
                </dd>
              </div>
            )}

            {/* Already Paid */}
            <div className="flex items-center justify-between">
              <dt className="text-sm text-muted-foreground">{t('reports.vatPaid')}</dt>
              <dd className="font-medium text-sm">
                {formatCurrency(summary.totalVatPaid)}
              </dd>
            </div>

            {/* Settlement */}
            <div className="flex items-center justify-between">
              <dt className="text-sm text-muted-foreground">{t('reports.vatSettlement')}</dt>
              <dd
                className={`font-semibold text-sm ${
                  summary.settlementAmount > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {formatCurrency(summary.settlementAmount)}
              </dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
