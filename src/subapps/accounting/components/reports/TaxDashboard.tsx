'use client';

/**
 * @fileoverview Accounting Subapp — Tax Dashboard
 * @description Tax brackets visualization, progressive tax scale, and installments
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
import type { TaxResult, TaxInstallment } from '@/subapps/accounting/types';
import { TaxBracketsVisual } from './TaxBracketsVisual';
import { InstallmentsCard } from './InstallmentsCard';

// ============================================================================
// TYPES
// ============================================================================

interface TaxDashboardProps {
  fiscalYear: number;
}

interface TaxDashboardData {
  taxResult: TaxResult | null;
  installments: TaxInstallment[];
}

// ============================================================================
// HELPERS
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(amount);
}

// ============================================================================
// COMPONENT
// ============================================================================

export function TaxDashboard({ fiscalYear }: TaxDashboardProps) {
  const { t } = useTranslation('accounting');
  const { user } = useAuth();
  const colors = useSemanticColors();

  const [data, setData] = useState<TaxDashboardData>({ taxResult: null, installments: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const token = await user.getIdToken();
      const params = new URLSearchParams();
      params.set('fiscalYear', String(fiscalYear));

      const response = await fetch(`/api/accounting/tax/dashboard?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData: { error?: string } = await response.json();
        throw new Error(errorData.error ?? `HTTP ${response.status}`);
      }

      const result: TaxDashboardData = await response.json();
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'accounting.errors.taxDashboardLoadFailed';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user, fiscalYear]);

  useEffect(() => {
    if (user) {
      fetchDashboard();
    }
  }, [user, fetchDashboard]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner size="large" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-6" aria-label={t('reports.taxDashboard')}>
      {/* Tax Result Summary */}
      {data.taxResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('reports.taxDashboard')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Key Figures */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <article className="space-y-1">
                <p className="text-xs text-muted-foreground">{t('reports.grossIncome')}</p>
                <p className="text-lg font-bold text-foreground">
                  {formatCurrency(data.taxResult.grossIncome)}
                </p>
              </article>
              <article className="space-y-1">
                <p className="text-xs text-muted-foreground">{t('reports.deductibleExpenses')}</p>
                <p className="text-lg font-bold text-foreground">
                  {formatCurrency(data.taxResult.deductibleExpenses)}
                </p>
              </article>
              <article className="space-y-1">
                <p className="text-xs text-muted-foreground">{t('reports.taxableIncome')}</p>
                <p className="text-lg font-bold text-foreground">
                  {formatCurrency(data.taxResult.taxableIncome)}
                </p>
              </article>
              <article className="space-y-1">
                <p className="text-xs text-muted-foreground">{t('reports.finalAmount')}</p>
                <p
                  className={`text-lg font-bold ${
                    data.taxResult.finalAmount > 0
                      ? colors.text.error
                      : colors.text.success
                  }`}
                >
                  {formatCurrency(data.taxResult.finalAmount)}
                </p>
              </article>
            </div>

            <Separator />

            {/* Tax Brackets Visual */}
            <TaxBracketsVisual
              bracketBreakdown={data.taxResult.bracketBreakdown}
              taxableIncome={data.taxResult.taxableIncome}
            />
          </CardContent>
        </Card>
      )}

      {/* Installments */}
      {data.installments.length > 0 && (
        <InstallmentsCard installments={data.installments} />
      )}
    </section>
  );
}

