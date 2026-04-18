'use client';
/* eslint-disable custom/no-hardcoded-strings */
/* eslint-disable design-system/enforce-semantic-colors */

/**
 * interest-cost-helpers.tsx — Helper utilities and visual components for InterestCostDialog
 *
 * Contains: formatCurrency, formatCurrencyFull, formatPercent, formatDate,
 *           LossBarChart, BankComparisonSection, WhatIfTab, LossAlertBanner
 *
 * @enterprise ADR-234 Phase 4 - Interest Cost Calculator (SPEC-234E)
 */

import React, { useState, useMemo } from 'react';
import {
  Info,
  TrendingUp,
  AlertTriangle,
  Banknote,
} from 'lucide-react';
import { calculateFullResult } from '@/lib/npv-engine';
import type { CostCalculationInput, CashFlowEntry } from '@/types/interest-calculator';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';

import type {
  LossBarChartProps,
  BankComparisonSectionProps,
  WhatIfTabProps,
  LossAlertBannerProps,
} from './interest-cost-types';
import { InfoLabel, InfoDt } from './financial-intelligence';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { nowISO } from '@/lib/date-local';

// =============================================================================
// FORMATTING UTILITIES
// =============================================================================

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// =============================================================================
// VISUAL LOSS BAR CHART (CSS-based, no dependency)
// =============================================================================

export function LossBarChart({ analysis, t }: LossBarChartProps) {
  const colors = useSemanticColors();
  const entries = analysis.map((cf) => ({
    label: cf.label,
    loss: cf.amount - cf.presentValue,
    lossPercent: cf.amount > 0 ? ((cf.amount - cf.presentValue) / cf.amount) * 100 : 0,
    amount: cf.amount,
    presentValue: cf.presentValue,
    discountFactor: cf.discountFactor,
    daysDelta: cf.daysDelta,
    date: cf.date,
  }));
  const maxLoss = Math.max(...entries.map((e) => e.loss), 1);

  return (
    <section className="space-y-2 pt-2">
      <h4 className={cn("text-sm font-semibold", colors.text.muted)}>
        {t('costCalculator.chart.lossPerInstallment')}
      </h4>
      <div className="space-y-1.5">
        {entries.map((item, idx) => {
          const widthPercent = maxLoss > 0 ? (item.loss / maxLoss) * 100 : 0;
          return (
            <Tooltip key={idx}>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 cursor-help rounded p-0.5 transition-colors hover:bg-muted/40">
                  <span className={cn("text-sm w-28 truncate shrink-0", colors.text.muted)}>
                    {item.label}
                  </span>
                  <div className="flex-1 h-4 rounded bg-muted/30 overflow-hidden">
                    <div
                      className="h-full rounded bg-gradient-to-r from-amber-400 to-red-500 transition-all duration-500"
                      style={{ width: `${Math.max(widthPercent, widthPercent > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-destructive w-16 text-right shrink-0">
                    {item.loss > 0 ? `-${formatCurrencyFull(item.loss)}` : '\u2014'}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs p-3 space-y-1.5">
                <p className="font-semibold text-sm">{item.label}</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                  <dt className={colors.text.muted}>{t('costCalculator.chart.barTooltipAmount')}:</dt>
                  <dd className="text-right font-medium">{formatCurrencyFull(item.amount)}</dd>
                  <dt className={colors.text.muted}>{t('costCalculator.chart.barTooltipPresentValue')}:</dt>
                  <dd className="text-right font-medium">{formatCurrencyFull(item.presentValue)}</dd>
                  <dt className={colors.text.muted}>{t('costCalculator.chart.barTooltipLoss')}:</dt>
                  <dd className="text-right font-medium text-destructive">
                    {item.loss > 0 ? `-${formatCurrencyFull(item.loss)}` : '\u2014'}
                  </dd>
                  <dt className={colors.text.muted}>{t('costCalculator.chart.barTooltipLossPercent')}:</dt>
                  <dd className="text-right font-medium">{item.lossPercent.toFixed(2)}%</dd>
                  <dt className={colors.text.muted}>{t('costCalculator.chart.barTooltipDate')}:</dt>
                  <dd className="text-right">{formatDate(item.date)}</dd>
                  <dt className={colors.text.muted}>{t('costCalculator.chart.barTooltipDays')}:</dt>
                  <dd className="text-right">{item.daysDelta}</dd>
                  <dt className={colors.text.muted}>{t('costCalculator.chart.barTooltipDiscountFactor')}:</dt>
                  <dd className="text-right">{item.discountFactor.toFixed(4)}</dd>
                </dl>
                <p className={cn("text-xs leading-relaxed pt-1 border-t border-dashed", colors.text.muted)}>
                  {t('costCalculator.chart.barTooltipExplanation')}
                </p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <p className={cn("text-sm text-right", colors.text.muted)}>
        {t('costCalculator.chart.maxLoss')}: {formatCurrencyFull(maxLoss)}
      </p>
    </section>
  );
}

// =============================================================================
// BANK COST COMPARISON
// =============================================================================

export function BankComparisonSection({
  salePrice,
  npv,
  weightedDays,
  discountRate,
  t,
}: BankComparisonSectionProps) {
  const outstandingAmount = salePrice - npv > 0 ? salePrice - npv : salePrice * 0.5;
  const bankRate = discountRate + 2.40;
  const bankInterest = outstandingAmount * (bankRate / 100) * (weightedDays / 365);

  return (
    <section className="flex gap-2 rounded-lg border border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/30 p-3">
      <Banknote className="h-5 w-5 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-violet-800 dark:text-violet-300">
          {t('costCalculator.scenarios.bankComparison')}
        </p>
        <p className="text-sm text-violet-700 dark:text-violet-400 leading-relaxed">
          {t('costCalculator.scenarios.bankComparisonText', {
            amount: formatCurrency(outstandingAmount),
            days: String(weightedDays),
            rate: formatPercent(bankRate),
            interest: formatCurrency(bankInterest),
          })}
        </p>
      </div>
    </section>
  );
}

// =============================================================================
// WHAT-IF SIMULATOR TAB
// =============================================================================

export function WhatIfTab({
  salePrice,
  currentResult,
  discountRate,
  t,
}: WhatIfTabProps) {
  const colors = useSemanticColors();
  const [upfrontPercent, setUpfrontPercent] = useState(30);
  const [months, setMonths] = useState(12);

  const whatIfResult = useMemo(() => {
    const referenceDate = nowISO().split('T')[0];
    const upfrontAmount = salePrice * (upfrontPercent / 100);
    const remainingAmount = salePrice - upfrontAmount;
    const refDate = new Date(referenceDate);

    const cashFlows: CashFlowEntry[] = [
      {
        label: '\u03A0\u03C1\u03BF\u03BA\u03B1\u03C4\u03B1\u03B2\u03BF\u03BB\u03AE',
        amount: upfrontAmount,
        date: referenceDate,
        certainty: 'certain' as const,
      },
    ];

    if (remainingAmount > 0 && months > 0) {
      const monthlyAmount = remainingAmount / months;
      for (let i = 1; i <= months; i++) {
        const d = new Date(refDate);
        d.setMonth(d.getMonth() + i);
        cashFlows.push({
          label: `\u0394\u03CC\u03C3\u03B7 ${i}`,
          amount: monthlyAmount,
          date: d.toISOString().split('T')[0],
          certainty: i <= 3 ? 'certain' as const : i <= 9 ? 'probable' as const : 'uncertain' as const,
        });
      }
    }

    const input: CostCalculationInput = {
      salePrice,
      referenceDate,
      cashFlows,
      discountRateSource: 'manual',
      bankSpread: 0,
    };

    return calculateFullResult(input, discountRate);
  }, [salePrice, upfrontPercent, months, discountRate]);

  const currentNpv = currentResult?.npv ?? salePrice;
  const diff = whatIfResult.npv - currentNpv;

  return (
    <article className="space-y-4">
      <section className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-3">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
          {t('costCalculator.whatIf.infoBanner')}
        </p>
      </section>

      {/* Sliders */}
      <section className="space-y-4">
        <fieldset className="space-y-2">
          <div className="flex items-center justify-between">
            <InfoLabel
              label={t('costCalculator.whatIf.upfrontLabel')}
              tooltip={t('costCalculator.whatIf.upfrontTooltip')}
              className="text-sm font-semibold"
            />
            <Badge variant="outline" className="text-sm font-bold">
              {upfrontPercent}% \u2014 {formatCurrency(salePrice * upfrontPercent / 100)}
            </Badge>
          </div>
          <Slider
            value={[upfrontPercent]}
            onValueChange={([val]) => setUpfrontPercent(val)}
            min={0}
            max={100}
            step={5}
          />
          <div className={cn("flex justify-between text-sm", colors.text.muted)}>
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <div className="flex items-center justify-between">
            <InfoLabel
              label={t('costCalculator.whatIf.monthsLabel')}
              tooltip={t('costCalculator.whatIf.monthsTooltip')}
              className="text-sm font-semibold"
            />
            <Badge variant="outline" className="text-sm font-bold">
              {months} {t('costCalculator.scenarios.days') === '\u03B7\u03BC\u03AD\u03C1\u03B5\u03C2' ? '\u03BC\u03AE\u03BD\u03B5\u03C2' : 'months'}
            </Badge>
          </div>
          <Slider
            value={[months]}
            onValueChange={([val]) => setMonths(val)}
            min={1}
            max={36}
            step={1}
          />
          <div className={cn("flex justify-between text-sm", colors.text.muted)}>
            <span>1</span>
            <span>12</span>
            <span>24</span>
            <span>36</span>
          </div>
        </fieldset>
      </section>

      {/* Results */}
      <section className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
        <dl className="grid grid-cols-2 gap-2 text-base">
          <InfoDt label={t('costCalculator.whatIf.resultNpv')} tooltip={t('costCalculator.whatIf.resultNpvTooltip')} />
          <dd className="text-right font-semibold">{formatCurrency(whatIfResult.npv)}</dd>

          <InfoDt label={t('costCalculator.whatIf.resultLoss')} tooltip={t('costCalculator.whatIf.resultLossTooltip')} className="text-destructive" />
          <dd className="text-right font-semibold text-destructive">
            -{formatCurrency(whatIfResult.timeCost)} ({formatPercent(whatIfResult.timeCostPercentage)})
          </dd>

          <InfoDt label={t('costCalculator.whatIf.resultRecommended')} tooltip={t('costCalculator.whatIf.resultRecommendedTooltip')} />
          <dd className="text-right font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(whatIfResult.recommendedPrice)}
          </dd>

          <InfoDt label={t('costCalculator.whatIf.resultWacp')} tooltip={t('costCalculator.whatIf.resultWacpTooltip')} />
          <dd className="text-right font-medium">
            {whatIfResult.weightedAverageDays} {t('costCalculator.scenarios.days')}
          </dd>
        </dl>
      </section>

      {/* Comparison with current */}
      {currentResult && (
        <section className={`flex gap-2 rounded-lg border p-3 ${
          diff > 0
            ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
            : diff < 0
              ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
              : 'border-muted bg-muted/30'
        }`}>
          <TrendingUp className={`h-4 w-4 shrink-0 mt-0.5 ${
            diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : colors.text.muted
          }`} />
          <div>
            <p className="text-sm font-semibold">{t('costCalculator.whatIf.comparedToCurrent')}</p>
            <p className={`text-sm font-medium ${
              diff > 0 ? 'text-emerald-700 dark:text-emerald-400' : diff < 0 ? 'text-red-700 dark:text-red-400' : colors.text.muted
            }`}>
              {diff > 0
                ? t('costCalculator.whatIf.betterBy', { amount: formatCurrency(Math.abs(diff)) })
                : diff < 0
                  ? t('costCalculator.whatIf.worseBy', { amount: formatCurrency(Math.abs(diff)) })
                  : t('costCalculator.whatIf.same')}
            </p>
          </div>
        </section>
      )}
    </article>
  );
}

// =============================================================================
// ALERT THRESHOLD BANNER
// =============================================================================

export function LossAlertBanner({ lossPercent, threshold, t }: LossAlertBannerProps) {
  if (lossPercent <= threshold) return null;

  return (
    <section className="flex gap-2 rounded-lg border-2 border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-3">
      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
      <p className="text-sm font-medium text-red-800 dark:text-red-300 leading-relaxed">
        {t('costCalculator.alert.highLoss', { threshold: formatPercent(threshold) })}
      </p>
    </section>
  );
}
