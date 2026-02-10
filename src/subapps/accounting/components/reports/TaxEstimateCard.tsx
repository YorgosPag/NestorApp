'use client';

/**
 * @fileoverview Accounting Subapp — Tax Estimate Card
 * @description Card showing estimated annual tax (income, expenses, taxable, estimated tax, rate)
 * @author Claude Code (Anthropic AI) + Georgios Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-009 Tax Engine
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/hooks/useAuth';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { TaxEstimate } from '@/subapps/accounting/types';

// ============================================================================
// TYPES
// ============================================================================

interface TaxEstimateCardProps {
  fiscalYear: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(amount);
}

function formatPercent(rate: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(rate / 100);
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TaxEstimateCard({ fiscalYear }: TaxEstimateCardProps) {
  const { t } = useTranslation('accounting');
  const { user } = useAuth();
  const colors = useSemanticColors();

  const [estimate, setEstimate] = useState<TaxEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEstimate = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const token = await user.getIdToken();
      const params = new URLSearchParams();
      params.set('fiscalYear', String(fiscalYear));

      const response = await fetch(`/api/accounting/tax/estimate?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData: { error?: string } = await response.json();
        throw new Error(errorData.error ?? `HTTP ${response.status}`);
      }

      const data: { success: boolean; data: TaxEstimate } = await response.json();
      setEstimate(data.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'accounting.errors.taxEstimateLoadFailed';
      setError(message);
      setEstimate(null);
    } finally {
      setLoading(false);
    }
  }, [user, fiscalYear]);

  useEffect(() => {
    if (user) {
      fetchEstimate();
    }
  }, [user, fetchEstimate]);

  // Calculate effective tax rate
  const effectiveRate =
    estimate && estimate.projectedAnnualIncome > 0
      ? (estimate.projectedAnnualTax / estimate.projectedAnnualIncome) * 100
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('reports.taxEstimate')}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="medium" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive text-center py-4">{error}</p>
        ) : !estimate ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('reports.noTaxData')}
          </p>
        ) : (
          <dl className="space-y-3">
            {/* Projected Income */}
            <div className="flex items-center justify-between">
              <dt className="text-sm text-muted-foreground">{t('reports.projectedIncome')}</dt>
              <dd className={`font-medium text-sm ${colors.text.success}`}>
                {formatCurrency(estimate.projectedAnnualIncome)}
              </dd>
            </div>

            {/* Projected Expenses */}
            <div className="flex items-center justify-between">
              <dt className="text-sm text-muted-foreground">{t('reports.projectedExpenses')}</dt>
              <dd className={`font-medium text-sm ${colors.text.error}`}>
                {formatCurrency(estimate.projectedAnnualExpenses)}
              </dd>
            </div>

            <Separator />

            {/* Taxable Income */}
            <div className="flex items-center justify-between">
              <dt className="text-sm font-semibold text-foreground">{t('reports.taxableIncome')}</dt>
              <dd className="font-bold text-sm">
                {formatCurrency(
                  estimate.projectedAnnualIncome - estimate.projectedAnnualExpenses,
                )}
              </dd>
            </div>

            {/* Estimated Tax */}
            <div className="flex items-center justify-between">
              <dt className="text-sm font-semibold text-foreground">{t('reports.estimatedTax')}</dt>
              <dd className={`text-lg font-bold ${colors.text.error}`}>
                {formatCurrency(estimate.projectedAnnualTax)}
              </dd>
            </div>

            {/* Effective Rate */}
            <div className="flex items-center justify-between">
              <dt className="text-sm text-muted-foreground">{t('reports.effectiveRate')}</dt>
              <dd className="font-medium text-sm">{formatPercent(effectiveRate)}</dd>
            </div>

            <Separator />

            {/* Final Amount (after withholdings/prepayments) */}
            <div className="flex items-center justify-between">
              <dt className="text-sm font-semibold text-foreground">{t('reports.projectedFinal')}</dt>
              <dd
                className={`text-lg font-bold ${
                  estimate.projectedFinalAmount > 0
                    ? colors.text.error
                    : colors.text.success
                }`}
              >
                {formatCurrency(estimate.projectedFinalAmount)}
              </dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

