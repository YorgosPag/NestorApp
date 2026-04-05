'use client';
/* eslint-disable custom/no-hardcoded-strings */
/* eslint-disable design-system/enforce-semantic-colors */

/**
 * interest-cost-pricing-settings.tsx — PricingTab and SettingsTab for InterestCostDialog
 *
 * @enterprise ADR-234 Phase 4 - Interest Cost Calculator (SPEC-234E)
 */

import React, { useState } from 'react';
import {
  Info,
  HelpCircle,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { useNotifications } from '@/providers/NotificationProvider';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { DiscountRateSource } from '@/types/interest-calculator';
import type { PricingTabProps, SettingsTabProps } from './interest-cost-types';
import { formatCurrency, formatPercent, formatDate } from './interest-cost-helpers';
import { InfoLabel } from './financial-intelligence';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// =============================================================================
// TAB 3: PRICING RECOMMENDATION
// =============================================================================

/** Tab 3: Pricing Recommendation */
export function PricingTab({ result, salePrice, t }: PricingTabProps) {
  const colors = useSemanticColors();
  return (
    <article className="space-y-4">
      <section className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-3">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
          {t('costCalculator.pricing.infoBanner')}
        </p>
      </section>

      {/* Hero callout */}
      <section className="rounded-lg border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 p-4 text-center space-y-2">
        <TrendingUp className="h-10 w-10 mx-auto text-emerald-600" />
        <p className={cn("text-sm", colors.text.muted)}>
          {t('costCalculator.pricing.sellAtLeast')}
        </p>
        <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
          {formatCurrency(result.recommendedPrice)}
        </p>
        <p className={cn("text-sm", colors.text.muted)}>
          +{formatCurrency(result.priceAdjustment)} ({formatPercent(result.priceAdjustmentPercentage)})
          {' '}{t('costCalculator.pricing.overNominal')}
        </p>
      </section>

      {/* "What this means" explanation */}
      <section className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3">
        <HelpCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">
            {t('costCalculator.pricing.whatThisMeans')}
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
            {t('costCalculator.pricing.whatThisMeansText', {
              nominal: formatCurrency(salePrice),
              npv: formatCurrency(result.npv),
              recommended: formatCurrency(result.recommendedPrice),
            })}
          </p>
        </div>
      </section>

      {/* Breakdown with tooltips */}
      <dl className="grid grid-cols-2 gap-3 text-base">
        <dt className={colors.text.muted}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help border-b border-dashed border-muted-foreground">
                {t('costCalculator.pricing.nominalPrice')}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{t('costCalculator.pricing.nominalPriceTooltip')}</TooltipContent>
          </Tooltip>
        </dt>
        <dd className="text-right font-medium">{formatCurrency(salePrice)}</dd>

        <dt className={colors.text.muted}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help border-b border-dashed border-muted-foreground">
                {t('costCalculator.cashFlow.npv')} ({formatPercent(result.npvPercentage)})
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{t('costCalculator.cashFlow.npvTooltip')}</TooltipContent>
          </Tooltip>
        </dt>
        <dd className="text-right font-medium">{formatCurrency(result.npv)}</dd>

        <dt className="text-destructive">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help border-b border-dashed border-destructive">
                {t('costCalculator.pricing.timeCost')}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{t('costCalculator.pricing.timeCostTooltip')}</TooltipContent>
          </Tooltip>
        </dt>
        <dd className="text-right font-medium text-destructive">
          -{formatCurrency(result.timeCost)}
        </dd>

        <dt className={colors.text.muted}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help border-b border-dashed border-muted-foreground">
                {t('costCalculator.pricing.wacp')}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{t('costCalculator.pricing.wacpTooltip')}</TooltipContent>
          </Tooltip>
        </dt>
        <dd className="text-right font-medium">
          {result.weightedAverageDays} {t('costCalculator.scenarios.days')}
        </dd>

        <dt className={colors.text.muted}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help border-b border-dashed border-muted-foreground">
                {t('costCalculator.pricing.effectiveRate')}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{t('costCalculator.pricing.effectiveRateTooltip')}</TooltipContent>
          </Tooltip>
        </dt>
        <dd className="text-right font-medium">{formatPercent(result.effectiveRate)}</dd>
      </dl>

      <p className={cn("text-sm text-center leading-relaxed", colors.text.muted)}>
        {t('costCalculator.pricing.disclaimer')}
      </p>
    </article>
  );
}

// =============================================================================
// TAB 4: SETTINGS
// =============================================================================

/** Tab 4: Settings */
export function SettingsTab({
  rates,
  spreads,
  isLoading,
  onRefreshRates,
  onUpdateSpreads,
  onDiscountSourceChange,
  discountSource,
  manualRate,
  onManualRateChange,
  t,
}: SettingsTabProps) {
  const colors = useSemanticColors();
  const { success, error: notifyError } = useNotifications();
  const [localSpread, setLocalSpread] = useState(spreads?.defaultSpread ?? 2.40);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    const res = await onRefreshRates();
    if (res.success) {
      success(t('costCalculator.settings.ratesRefreshed'));
    } else {
      notifyError(res.error ?? 'Failed');
    }
    setRefreshing(false);
  };

  const handleSaveSpread = async () => {
    if (!spreads) return;
    const updated = { ...spreads, defaultSpread: localSpread };
    const res = await onUpdateSpreads(updated);
    if (res.success) {
      success(t('costCalculator.settings.spreadSaved'));
    } else {
      notifyError(res.error ?? 'Failed');
    }
  };

  return (
    <article className="space-y-4">
      {/* Euribor Rates */}
      <section className="space-y-2">
        <header className="flex items-center justify-between">
          <InfoLabel
            label={t('costCalculator.settings.euriborRates')}
            tooltip={t('costCalculator.settings.euriborRatesTooltip')}
            className="text-sm font-semibold"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-sm"
            onClick={handleRefresh}
            disabled={refreshing || isLoading}
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            {t('costCalculator.settings.refresh')}
          </Button>
        </header>

        {rates && (
          <dl className="grid grid-cols-3 gap-2 text-base">
            <dt className={colors.text.muted}>1M</dt>
            <dd>{formatPercent(rates.euribor1M)}</dd>
            <dd />
            <dt className={colors.text.muted}>3M</dt>
            <dd>{formatPercent(rates.euribor3M)}</dd>
            <dd />
            <dt className={colors.text.muted}>6M</dt>
            <dd>{formatPercent(rates.euribor6M)}</dd>
            <dd />
            <dt className={colors.text.muted}>12M</dt>
            <dd>{formatPercent(rates.euribor12M)}</dd>
            <dd />
            <dt className={colors.text.muted}>{t('costCalculator.settings.ecbMainShort')}</dt>
            <dd>{formatPercent(rates.ecbMainRate)}</dd>
            <dd className={colors.text.muted}>{formatDate(rates.rateDate)}</dd>
          </dl>
        )}
      </section>

      {/* Discount Rate Source */}
      <section className="space-y-2">
        <InfoLabel
          htmlFor="discount-source"
          label={t('costCalculator.settings.discountSource')}
          tooltip={t('costCalculator.settings.discountSourceTooltip')}
          className="text-sm font-semibold"
        />
        <Select
          value={discountSource}
          onValueChange={(val) => onDiscountSourceChange(val as DiscountRateSource)}
        >
          <SelectTrigger id="discount-source" className="text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="euribor_1M">{t('costCalculator.settings.euribor1M')}</SelectItem>
            <SelectItem value="euribor_3M">{t('costCalculator.settings.euribor3M')}</SelectItem>
            <SelectItem value="euribor_6M">{t('costCalculator.settings.euribor6M')}</SelectItem>
            <SelectItem value="euribor_12M">{t('costCalculator.settings.euribor12M')}</SelectItem>
            <SelectItem value="ecb_main">{t('costCalculator.settings.ecbMain')}</SelectItem>
            <SelectItem value="manual">{t('costCalculator.settings.manual')}</SelectItem>
          </SelectContent>
        </Select>

        {discountSource === 'manual' && (
          <fieldset className="space-y-1">
            <InfoLabel
              htmlFor="manual-rate"
              label={`${t('costCalculator.settings.manualRate')} (%)`}
              tooltip={t('costCalculator.settings.manualRateTooltip')}
              className="text-sm"
            />
            <Input
              id="manual-rate"
              type="number"
              step="0.01"
              min="0"
              max="50"
              value={manualRate}
              onChange={(e) => onManualRateChange(parseFloat(e.target.value) || 0)}
              className="text-sm"
            />
          </fieldset>
        )}
      </section>

      {/* Bank Spread */}
      <section className="space-y-2">
        <InfoLabel
          htmlFor="bank-spread"
          label={`${t('costCalculator.settings.bankSpread')} (%)`}
          tooltip={t('costCalculator.settings.bankSpreadTooltip')}
          className="text-sm font-semibold"
        />
        <fieldset className="flex items-center gap-2">
          <Input
            id="bank-spread"
            type="number"
            step="0.05"
            min="0"
            max="10"
            value={localSpread}
            onChange={(e) => setLocalSpread(parseFloat(e.target.value) || 0)}
            className="text-sm flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            className="text-sm h-8"
            onClick={handleSaveSpread}
          >
            {t('costCalculator.settings.save')}
          </Button>
        </fieldset>
      </section>
    </article>
  );
}
