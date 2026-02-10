/**
 * @fileoverview VAT Summary Card — Ετήσια σύνοψη ΦΠΑ
 * @description Κάρτα με ετήσια σύνολα: output VAT, deductible input VAT, payable, settlement
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-004 VAT Engine
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

'use client';

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { VATAnnualSummary } from '@/subapps/accounting/types';
import { formatCurrency } from '@/subapps/accounting/utils/format';

// ============================================================================
// TYPES
// ============================================================================

interface VATSummaryCardProps {
  summary: VATAnnualSummary;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function VATSummaryCard({ summary }: VATSummaryCardProps) {
  const { t } = useTranslation('accounting');
  const colors = useSemanticColors();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('vat.annualSummary')} {summary.fiscalYear}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3">
          {/* Output VAT */}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('vat.outputVat')}</dt>
            <dd className="font-medium">{formatCurrency(summary.annualOutputVat)}</dd>
          </div>

          {/* Deductible Input VAT */}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('vat.deductibleVat')}</dt>
            <dd className="font-medium">{formatCurrency(summary.annualDeductibleInputVat)}</dd>
          </div>

          <Separator />

          {/* Annual VAT Payable */}
          <div className="flex justify-between">
            <dt className="font-medium">{t('vat.vatPayable')}</dt>
            <dd className={`text-lg font-bold ${summary.annualVatPayable >= 0 ? colors.text.error : colors.text.success}`}>
              {formatCurrency(summary.annualVatPayable)}
            </dd>
          </div>

          {/* Credit if applicable */}
          {summary.annualVatCredit > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('vat.vatCredit')}</dt>
              <dd className={`font-medium ${colors.text.success}`}>{formatCurrency(summary.annualVatCredit)}</dd>
            </div>
          )}

          <Separator />

          {/* Settlement details */}
          <div className="flex justify-between text-sm">
            <dt className="text-muted-foreground">
              {t('vat.vatPayable')} ({t('vat.quarterlyReturns')})
            </dt>
            <dd>{formatCurrency(summary.totalVatPaid)}</dd>
          </div>

          <div className="flex justify-between">
            <dt className="font-medium">
              {summary.settlementAmount >= 0 ? t('vat.vatPayable') : t('vat.vatCredit')}
              {' ('}
              {t('vat.annualSummary')}
              )
            </dt>
            <dd className={`text-lg font-bold ${summary.settlementAmount >= 0 ? colors.text.error : colors.text.success}`}>
              {formatCurrency(Math.abs(summary.settlementAmount))}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

