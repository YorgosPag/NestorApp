'use client';

/**
 * InterestCostSection — Compact summary card for cost-of-money calculator
 *
 * Embedded in PaymentTabContent. Auto-calculates NPV when installments exist.
 *
 * @enterprise ADR-234 Phase 4 - Interest Cost Calculator (SPEC-234E)
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Calculator, TrendingDown, ChevronRight } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useInterestCalculator } from '@/hooks/useInterestCalculator';
import { InterestCostDialog } from '@/components/sales/payments/InterestCostDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Installment } from '@/types/payment-plan';
import type { CostCalculationInput } from '@/types/interest-calculator';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// =============================================================================
// TYPES
// =============================================================================

interface InterestCostSectionProps {
  propertyId: string;
  planInstallments?: Installment[];
  salePrice: number;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function InterestCostSection({
  propertyId,
  planInstallments,
  salePrice,
}: InterestCostSectionProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation('payments');
  const {
    rates,
    spreads,
    result,
    comparison,
    isLoading,
    error,
    calculate,
    compare,
    refreshRates,
    updateSpreads,
  } = useInterestCalculator();

  const [dialogOpen, setDialogOpen] = useState(false);

  // --- Auto-calculate when rates + installments are ready ---
  const autoCalculate = useCallback(async () => {
    if (!rates || !planInstallments || planInstallments.length === 0 || salePrice <= 0) return;

    const referenceDate = new Date().toISOString().split('T')[0];
    const bankSpread = spreads?.defaultSpread ?? 2.40;

    const input: CostCalculationInput = {
      salePrice,
      referenceDate,
      cashFlows: planInstallments.map((inst) => ({
        label: inst.label,
        amount: inst.amount,
        date: inst.dueDate,
        certainty: inst.status === 'paid' ? 'certain' as const : 'uncertain' as const,
      })),
      discountRateSource: 'euribor_3M',
      bankSpread,
    };

    await calculate(input);
  }, [rates, planInstallments, salePrice, spreads, calculate]);

  useEffect(() => {
    autoCalculate();
  }, [autoCalculate]);

  // No installments → don't show
  if (!planInstallments || planInstallments.length === 0) return null;

  const effectiveRate = result?.effectiveRate ?? 0;
  const euriborLabel = rates
    ? `Euribor 3M: ${formatPercent(rates.euribor3M)}`
    : t('costCalculator.loadingRates');

  return (
    <>
      <section className="rounded-lg border p-3 space-y-3">
        {/* Header */}
        <header className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Calculator className={cn("h-4 w-4", colors.text.muted)} />
            <h3 className="text-sm font-semibold">
              {t('costCalculator.title')}
            </h3>
          </span>
          {rates?.source === 'ecb_api' && (
            <Badge variant="outline" className="text-[10px]">
              {t('costCalculator.settings.ecbLive')}
            </Badge>
          )}
        </header>

        {/* Rate info */}
        <article className={cn("flex items-center gap-2 text-xs", colors.text.muted)}>
          <span>{euriborLabel}</span>
          {rates && spreads && (
            <>
              <span>+</span>
              <span>{t('costCalculator.settings.spread')} {formatPercent(spreads.defaultSpread)}</span>
              <span>=</span>
              <span className="font-medium text-foreground">
                {formatPercent(effectiveRate)}
              </span>
            </>
          )}
        </article>

        {/* NPV Summary */}
        {result && (
          <article className="grid grid-cols-3 gap-2 text-center">
            <figure className="rounded-md bg-muted/50 p-2">
              <figcaption className={cn("text-[10px]", colors.text.muted)}>{t('costCalculator.cashFlow.npv')}</figcaption>
              <p className="text-sm font-semibold">{formatCurrency(result.npv)}</p>
            </figure>
            <figure className="rounded-md bg-muted/50 p-2">
              <figcaption className={cn("text-[10px] flex items-center justify-center gap-1", colors.text.muted)}>
                <TrendingDown className="h-3 w-3" />
                {t('costCalculator.timeCost')}
              </figcaption>
              <p className="text-sm font-semibold text-destructive">
                {formatCurrency(result.timeCost)} ({formatPercent(result.timeCostPercentage)})
              </p>
            </figure>
            <figure className="rounded-md bg-muted/50 p-2">
              <figcaption className={cn("text-[10px]", colors.text.muted)}>
                {t('costCalculator.recommended')}
              </figcaption>
              <p className="text-sm font-semibold text-emerald-600">
                {formatCurrency(result.recommendedPrice)}
              </p>
            </figure>
          </article>
        )}

        {/* Error */}
        {error && (
          <p className="text-xs text-destructive text-center">{error}</p>
        )}

        {/* Detail button */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full gap-1 text-xs"
          onClick={() => setDialogOpen(true)}
          disabled={isLoading}
        >
          {t('costCalculator.detailAnalysis')}
          <ChevronRight className="h-3 w-3" />
        </Button>
      </section>

      {/* Full dialog */}
      <InterestCostDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        propertyId={propertyId}
        salePrice={salePrice}
        installments={planInstallments}
        rates={rates}
        spreads={spreads}
        result={result}
        comparison={comparison}
        isLoading={isLoading}
        onRefreshRates={refreshRates}
        onCompare={compare}
        onUpdateSpreads={updateSpreads}
      />
    </>
  );
}
