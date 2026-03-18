'use client';

/**
 * InterestCostDialog — Full 4-tab dialog for interest cost analysis
 *
 * Tabs:
 *   1. Cash Flow Analysis (per-installment breakdown)
 *   2. Scenario Comparison (Cash / Off-Plan / Loan / Current)
 *   3. Pricing Recommendation (highlighted callout)
 *   4. Settings (discount rate source, bank spread, refresh)
 *
 * @enterprise ADR-234 Phase 4 - Interest Cost Calculator (SPEC-234E)
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Calculator,
  RefreshCw,
  TrendingUp,
  Award,
  Settings,
  BarChart3,
  Loader2,
  Info,
  HelpCircle,
  AlertTriangle,
  SlidersHorizontal,
  Download,
  Banknote,
  Activity,
  ShieldCheck,
  Landmark,
  Dices,
  Wallet,
  TrendingDown,
  Shield,
} from 'lucide-react';
import { calculateFullResult } from '@/lib/npv-engine';
import type { CostCalculationInput, CashFlowEntry } from '@/types/interest-calculator';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { Installment } from '@/types/payment-plan';
import type {
  EuriborRatesCache,
  BankSpreadConfig,
  CostCalculationResult,
  ScenarioComparison,
  DiscountRateSource,
  CashFlowAnalysisEntry,
} from '@/types/interest-calculator';

import {
  SensitivityTab,
  DSCRStressTab,
  DrawScheduleTab,
  MonteCarloTab,
  EquityWaterfallDialog,
  ForwardCurveChart,
  HedgingComparisonTable,
  InfoLabel,
  InfoDt,
} from './financial-intelligence';

// =============================================================================
// TYPES
// =============================================================================

interface InterestCostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unitId: string;
  salePrice: number;
  installments?: Installment[];
  rates: EuriborRatesCache | null;
  spreads: BankSpreadConfig | null;
  result: CostCalculationResult | null;
  comparison: ScenarioComparison | null;
  isLoading: boolean;
  onRefreshRates: () => Promise<{ success: boolean; error?: string }>;
  onCompare: (salePrice: number, referenceDate: string, installments?: Installment[]) => Promise<void>;
  onUpdateSpreads: (config: BankSpreadConfig) => Promise<{ success: boolean; error?: string }>;
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

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/** Tab 1: Cash Flow Analysis */
function CashFlowTab({
  analysis,
  salePrice,
  t,
}: {
  analysis: CashFlowAnalysisEntry[];
  salePrice: number;
  t: (key: string, opts?: Record<string, string>) => string;
}) {
  const totalPV = analysis.reduce((sum, cf) => sum + cf.presentValue, 0);
  const totalLoss = salePrice - totalPV;
  const lossPercent = salePrice > 0 ? (totalLoss / salePrice) * 100 : 0;

  return (
    <article className="space-y-3">
      {/* Educational info banner */}
      <section className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-3">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
          {t('costCalculator.cashFlow.infoBanner')}
        </p>
      </section>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-sm">{t('costCalculator.cashFlow.label')}</TableHead>
            <TableHead className="text-sm text-right">{t('costCalculator.cashFlow.amount')}</TableHead>
            <TableHead className="text-sm text-right">{t('costCalculator.cashFlow.date')}</TableHead>
            <TableHead className="text-sm text-right">{t('costCalculator.cashFlow.days')}</TableHead>
            <TableHead className="text-sm text-right">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help border-b border-dashed border-muted-foreground">
                    {t('costCalculator.cashFlow.df')}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  {t('costCalculator.cashFlow.dfTooltip')}
                </TooltipContent>
              </Tooltip>
            </TableHead>
            <TableHead className="text-sm text-right">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help border-b border-dashed border-muted-foreground">
                    {t('costCalculator.cashFlow.pv')}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  {t('costCalculator.cashFlow.pvTooltip')}
                </TooltipContent>
              </Tooltip>
            </TableHead>
            <TableHead className="text-sm text-right">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help border-b border-dashed border-muted-foreground">
                    {t('costCalculator.cashFlow.loss')}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  {t('costCalculator.cashFlow.lossTooltip')}
                </TooltipContent>
              </Tooltip>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {analysis.map((cf, idx) => {
            const loss = cf.amount - cf.presentValue;
            const lossRatio = cf.amount > 0 ? loss / cf.amount : 0;
            // Color coding: green = no loss, yellow = small loss (<1%), orange = medium (<2%), red = high (>2%)
            const lossColor = lossRatio === 0
              ? ''
              : lossRatio < 0.01
                ? 'bg-yellow-50/50 dark:bg-yellow-950/10'
                : lossRatio < 0.02
                  ? 'bg-orange-50/50 dark:bg-orange-950/10'
                  : 'bg-red-50/50 dark:bg-red-950/10';

            const rowTooltipText = cf.daysDelta === 0
              ? t('costCalculator.cashFlow.rowTooltipToday', { label: cf.label })
              : t('costCalculator.cashFlow.rowTooltip', {
                  label: cf.label,
                  days: String(cf.daysDelta),
                  pv: formatCurrencyFull(cf.presentValue),
                  amount: formatCurrencyFull(cf.amount),
                  loss: formatCurrencyFull(loss),
                });

            return (
              <Tooltip key={idx}>
                <TooltipTrigger asChild>
                  <TableRow className={`cursor-help ${lossColor}`}>
                    <TableCell className="text-sm font-medium">{cf.label}</TableCell>
                    <TableCell className="text-sm text-right">{formatCurrencyFull(cf.amount)}</TableCell>
                    <TableCell className="text-sm text-right">{formatDate(cf.date)}</TableCell>
                    <TableCell className="text-sm text-right">{cf.daysDelta}</TableCell>
                    <TableCell className="text-sm text-right">{cf.discountFactor.toFixed(4)}</TableCell>
                    <TableCell className="text-sm text-right font-medium">{formatCurrencyFull(cf.presentValue)}</TableCell>
                    <TableCell className="text-sm text-right font-medium text-destructive">
                      {loss > 0 ? `-${formatCurrencyFull(loss)}` : '—'}
                    </TableCell>
                  </TableRow>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm text-sm">
                  {rowTooltipText}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TableBody>
      </Table>

      {/* Summary with insight */}
      <footer className="space-y-2 pt-2 border-t">
        <div className="flex justify-between items-center text-sm">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-muted-foreground cursor-help">
                {t('costCalculator.cashFlow.nominalTotal')}: {formatCurrency(salePrice)}
              </span>
            </TooltipTrigger>
            <TooltipContent>{t('costCalculator.cashFlow.nominalTotalTooltip')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-semibold cursor-help border-b border-dashed border-muted-foreground">
                {t('costCalculator.cashFlow.npv')}: {formatCurrency(totalPV)}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{t('costCalculator.cashFlow.npvTooltip')}</TooltipContent>
          </Tooltip>
        </div>

        {/* Loss insight callout */}
        {totalLoss > 0 ? (
          <section className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
              {t('costCalculator.cashFlow.summaryLoss', {
                loss: formatCurrency(totalLoss),
                percent: formatPercent(lossPercent),
              })}
            </p>
          </section>
        ) : (
          <section className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30 p-3">
            <Info className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-800 dark:text-emerald-300 leading-relaxed">
              {t('costCalculator.cashFlow.summaryNoLoss')}
            </p>
          </section>
        )}
      </footer>
    </article>
  );
}

/** Tab 2: Scenario Comparison */
function ScenarioTab({
  comparison,
  t,
}: {
  comparison: ScenarioComparison;
  t: (key: string, opts?: Record<string, string>) => string;
}) {
  // Find cash scenario NPV for comparison
  const cashNpv = comparison.scenarios[0]?.result.npv ?? 0;

  // Map scenario index to tooltip key
  const scenarioTooltipKeys = [
    'costCalculator.scenarios.rowTooltipCash',
    'costCalculator.scenarios.rowTooltipOffPlan',
    'costCalculator.scenarios.rowTooltipLoan',
    'costCalculator.scenarios.rowTooltipCurrent',
  ];

  return (
    <article className="space-y-3">
      {/* Educational info banner */}
      <section className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-3">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
          {t('costCalculator.scenarios.infoBanner')}
        </p>
      </section>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-sm">{t('costCalculator.scenarios.scenario')}</TableHead>
            <TableHead className="text-sm text-right">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help border-b border-dashed border-muted-foreground">
                    {t('costCalculator.scenarios.npv')}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  {t('costCalculator.scenarios.npvTooltip')}
                </TooltipContent>
              </Tooltip>
            </TableHead>
            <TableHead className="text-sm text-right">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help border-b border-dashed border-muted-foreground">
                    {t('costCalculator.scenarios.cost')}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  {t('costCalculator.scenarios.costTooltip')}
                </TooltipContent>
              </Tooltip>
            </TableHead>
            <TableHead className="text-sm text-right">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help border-b border-dashed border-muted-foreground">
                    {t('costCalculator.scenarios.wacp')}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  {t('costCalculator.scenarios.wacpTooltip')}
                </TooltipContent>
              </Tooltip>
            </TableHead>
            <TableHead className="text-sm text-center" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {comparison.scenarios.map((s, idx) => {
            const isBest = idx === comparison.bestScenarioIndex;
            const diffFromCash = cashNpv - s.result.npv;
            const tooltipKey = scenarioTooltipKeys[idx] ?? scenarioTooltipKeys[3];

            return (
              <Tooltip key={idx}>
                <TooltipTrigger asChild>
                  <TableRow className={`cursor-help ${isBest ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''}`}>
                    <TableCell className="text-sm">
                      <span className="font-medium">{t(s.name)}</span>
                      <br />
                      <span className="text-muted-foreground">{t(s.description, s.descriptionParams)}</span>
                    </TableCell>
                    <TableCell className="text-sm text-right font-medium">
                      {formatCurrency(s.result.npv)}
                      <br />
                      <span className="text-muted-foreground">{formatPercent(s.result.npvPercentage)}</span>
                    </TableCell>
                    <TableCell className="text-sm text-right text-destructive">
                      {formatCurrency(s.result.timeCost)}
                      <br />
                      <span>{formatPercent(s.result.timeCostPercentage)}</span>
                    </TableCell>
                    <TableCell className="text-sm text-right">
                      {s.result.weightedAverageDays} {t('costCalculator.scenarios.days')}
                    </TableCell>
                    <TableCell className="text-center">
                      {isBest ? (
                        <Badge variant="default" className="text-sm">
                          <Award className="h-4 w-4 mr-1" />
                          {t('costCalculator.scenarios.best')}
                        </Badge>
                      ) : diffFromCash > 0 ? (
                        <span className="text-sm text-muted-foreground">
                          {t('costCalculator.scenarios.vsCash', { diff: formatCurrency(diffFromCash) })}
                        </span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm text-sm">
                  {t(tooltipKey, { cost: formatCurrency(s.result.timeCost) })}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TableBody>
      </Table>

      <footer className="text-sm text-muted-foreground text-center">
        {t('costCalculator.scenarios.discountRate')}: {formatPercent(comparison.discountRate)}
      </footer>
    </article>
  );
}

/** Tab 3: Pricing Recommendation */
function PricingTab({
  result,
  salePrice,
  t,
}: {
  result: CostCalculationResult;
  salePrice: number;
  t: (key: string, opts?: Record<string, string>) => string;
}) {
  return (
    <article className="space-y-4">
      {/* Educational info banner */}
      <section className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-3">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
          {t('costCalculator.pricing.infoBanner')}
        </p>
      </section>

      {/* Hero callout */}
      <section className="rounded-lg border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 p-4 text-center space-y-2">
        <TrendingUp className="h-10 w-10 mx-auto text-emerald-600" />
        <p className="text-sm text-muted-foreground">
          {t('costCalculator.pricing.sellAtLeast')}
        </p>
        <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
          {formatCurrency(result.recommendedPrice)}
        </p>
        <p className="text-sm text-muted-foreground">
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
        <dt className="text-muted-foreground">
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

        <dt className="text-muted-foreground">
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

        <dt className="text-muted-foreground">
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

        <dt className="text-muted-foreground">
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

      <p className="text-sm text-muted-foreground text-center leading-relaxed">
        {t('costCalculator.pricing.disclaimer')}
      </p>
    </article>
  );
}

/** Tab 4: Settings */
function SettingsTab({
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
}: {
  rates: EuriborRatesCache | null;
  spreads: BankSpreadConfig | null;
  isLoading: boolean;
  onRefreshRates: () => Promise<{ success: boolean; error?: string }>;
  onUpdateSpreads: (config: BankSpreadConfig) => Promise<{ success: boolean; error?: string }>;
  onDiscountSourceChange: (source: DiscountRateSource) => void;
  discountSource: DiscountRateSource;
  manualRate: number;
  onManualRateChange: (rate: number) => void;
  t: (key: string, opts?: Record<string, string>) => string;
}) {
  const [localSpread, setLocalSpread] = useState(spreads?.defaultSpread ?? 2.40);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    const res = await onRefreshRates();
    if (res.success) {
      toast.success(t('costCalculator.settings.ratesRefreshed'));
    } else {
      toast.error(res.error ?? 'Failed');
    }
    setRefreshing(false);
  };

  const handleSaveSpread = async () => {
    if (!spreads) return;
    const updated = { ...spreads, defaultSpread: localSpread };
    const res = await onUpdateSpreads(updated);
    if (res.success) {
      toast.success(t('costCalculator.settings.spreadSaved'));
    } else {
      toast.error(res.error ?? 'Failed');
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
            <dt className="text-muted-foreground">1M</dt>
            <dd>{formatPercent(rates.euribor1M)}</dd>
            <dd />
            <dt className="text-muted-foreground">3M</dt>
            <dd>{formatPercent(rates.euribor3M)}</dd>
            <dd />
            <dt className="text-muted-foreground">6M</dt>
            <dd>{formatPercent(rates.euribor6M)}</dd>
            <dd />
            <dt className="text-muted-foreground">12M</dt>
            <dd>{formatPercent(rates.euribor12M)}</dd>
            <dd />
            <dt className="text-muted-foreground">{t('costCalculator.settings.ecbMainShort')}</dt>
            <dd>{formatPercent(rates.ecbMainRate)}</dd>
            <dd className="text-muted-foreground">{formatDate(rates.rateDate)}</dd>
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

// =============================================================================
// VISUAL LOSS BAR CHART (CSS-based, no dependency)
// =============================================================================

function LossBarChart({
  analysis,
  t,
}: {
  analysis: CashFlowAnalysisEntry[];
  t: (key: string, opts?: Record<string, string>) => string;
}) {
  const losses = analysis.map((cf) => ({
    label: cf.label,
    loss: cf.amount - cf.presentValue,
    amount: cf.amount,
  }));
  const maxLoss = Math.max(...losses.map((l) => l.loss), 1);

  return (
    <section className="space-y-2 pt-2">
      <h4 className="text-sm font-semibold text-muted-foreground">
        {t('costCalculator.chart.lossPerInstallment')}
      </h4>
      <div className="space-y-1.5">
        {losses.map((item, idx) => {
          const widthPercent = maxLoss > 0 ? (item.loss / maxLoss) * 100 : 0;
          return (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-28 truncate shrink-0">
                {item.label}
              </span>
              <div className="flex-1 h-4 rounded bg-muted/30 overflow-hidden">
                <div
                  className="h-full rounded bg-gradient-to-r from-amber-400 to-red-500 transition-all duration-500"
                  style={{ width: `${Math.max(widthPercent, widthPercent > 0 ? 2 : 0)}%` }}
                />
              </div>
              <span className="text-sm font-medium text-destructive w-16 text-right shrink-0">
                {item.loss > 0 ? `-${formatCurrencyFull(item.loss)}` : '—'}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground text-right">
        {t('costCalculator.chart.maxLoss')}: {formatCurrencyFull(maxLoss)}
      </p>
    </section>
  );
}

// =============================================================================
// BANK COST COMPARISON
// =============================================================================

function BankComparisonSection({
  salePrice,
  npv,
  weightedDays,
  discountRate,
  t,
}: {
  salePrice: number;
  npv: number;
  weightedDays: number;
  discountRate: number;
  t: (key: string, opts?: Record<string, string>) => string;
}) {
  // Simple interest calculation: I = P × r × (d/365)
  const outstandingAmount = salePrice - npv > 0 ? salePrice - npv : salePrice * 0.5;
  const bankRate = discountRate + 2.40; // Euribor + typical Greek bank spread
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

function WhatIfTab({
  salePrice,
  currentResult,
  discountRate,
  t,
}: {
  salePrice: number;
  currentResult: CostCalculationResult | null;
  discountRate: number;
  t: (key: string, opts?: Record<string, string>) => string;
}) {
  const [upfrontPercent, setUpfrontPercent] = useState(30);
  const [months, setMonths] = useState(12);

  const whatIfResult = useMemo(() => {
    const referenceDate = new Date().toISOString().split('T')[0];
    const upfrontAmount = salePrice * (upfrontPercent / 100);
    const remainingAmount = salePrice - upfrontAmount;
    const refDate = new Date(referenceDate);

    const cashFlows: CashFlowEntry[] = [
      {
        label: 'Προκαταβολή',
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
          label: `Δόση ${i}`,
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
      {/* Info banner */}
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
              {upfrontPercent}% — {formatCurrency(salePrice * upfrontPercent / 100)}
            </Badge>
          </div>
          <Slider
            value={[upfrontPercent]}
            onValueChange={([val]) => setUpfrontPercent(val)}
            min={0}
            max={100}
            step={5}
          />
          <div className="flex justify-between text-sm text-muted-foreground">
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
              {months} {t('costCalculator.scenarios.days') === 'ημέρες' ? 'μήνες' : 'months'}
            </Badge>
          </div>
          <Slider
            value={[months]}
            onValueChange={([val]) => setMonths(val)}
            min={1}
            max={36}
            step={1}
          />
          <div className="flex justify-between text-sm text-muted-foreground">
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
            diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-muted-foreground'
          }`} />
          <div>
            <p className="text-sm font-semibold">{t('costCalculator.whatIf.comparedToCurrent')}</p>
            <p className={`text-sm font-medium ${
              diff > 0 ? 'text-emerald-700 dark:text-emerald-400' : diff < 0 ? 'text-red-700 dark:text-red-400' : 'text-muted-foreground'
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
// ALERT THRESHOLD
// =============================================================================

function LossAlertBanner({
  lossPercent,
  threshold,
  t,
}: {
  lossPercent: number;
  threshold: number;
  t: (key: string, opts?: Record<string, string>) => string;
}) {
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

// =============================================================================
// MAIN DIALOG
// =============================================================================

export function InterestCostDialog({
  open,
  onOpenChange,
  unitId,
  salePrice,
  installments,
  rates,
  spreads,
  result,
  comparison,
  isLoading,
  onRefreshRates,
  onCompare,
  onUpdateSpreads,
}: InterestCostDialogProps) {
  const { t } = useTranslation('payments');
  const [discountSource, setDiscountSource] = useState<DiscountRateSource>('euribor_3M');
  const [manualRate, setManualRate] = useState(5);
  const [waterfallOpen, setWaterfallOpen] = useState(false);

  // Load comparison when dialog opens
  useEffect(() => {
    if (open && !comparison && salePrice > 0) {
      const referenceDate = new Date().toISOString().split('T')[0];
      onCompare(salePrice, referenceDate, installments);
    }
  }, [open, comparison, salePrice, installments, onCompare]);

  // Calculate loss percentage for alert threshold
  const lossPercent = result?.timeCostPercentage ?? 0;
  const effectiveDiscountRate = comparison?.discountRate ?? 5;

  // Build CostCalculationInput for Sensitivity tab
  const sensitivityInput = useMemo(() => {
    const referenceDate = new Date().toISOString().split('T')[0];
    const cashFlows: CashFlowEntry[] = installments && installments.length > 0
      ? installments.map((inst) => ({
          label: inst.label,
          amount: inst.amount,
          date: inst.dueDate,
          certainty: (inst.status === 'paid' ? 'certain' : inst.status === 'due' || inst.status === 'partial' ? 'probable' : 'uncertain') as 'certain' | 'probable' | 'uncertain',
        }))
      : [{ label: 'Cash', amount: salePrice, date: referenceDate, certainty: 'certain' as const }];

    return {
      salePrice,
      referenceDate,
      cashFlows,
      discountRateSource: 'manual' as const,
      bankSpread: spreads?.defaultSpread ?? 2.4,
    };
  }, [salePrice, installments, spreads]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="fullscreen" className="overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Calculator className="h-6 w-6" />
            {t('costCalculator.dialogTitle')}
          </DialogTitle>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 ml-auto"
            onClick={() => setWaterfallOpen(true)}
          >
            <Wallet className="h-4 w-4" />
            {t('costCalculator.waterfall.title')}
          </Button>
        </DialogHeader>

        {/* Equity Waterfall Dialog */}
        <EquityWaterfallDialog
          open={waterfallOpen}
          onOpenChange={setWaterfallOpen}
          salePrice={salePrice}
          t={t}
        />

        {/* Alert threshold — shows when loss > 3% */}
        {!isLoading && result && (
          <LossAlertBanner lossPercent={lossPercent} threshold={3} t={t} />
        )}

        {isLoading && (
          <section className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </section>
        )}

        {!isLoading && (
          <Tabs defaultValue="cashflow" className="mt-2">
            <TabsList className="text-sm">
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="cashflow" className="text-sm gap-1">
                    <BarChart3 className="h-4 w-4" />
                    {t('costCalculator.tabs.cashFlow')}
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">{t('costCalculator.tabs.cashFlowTooltip')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="scenarios" className="text-sm gap-1">
                    <Award className="h-4 w-4" />
                    {t('costCalculator.tabs.scenarios')}
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">{t('costCalculator.tabs.scenariosTooltip')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="pricing" className="text-sm gap-1">
                    <TrendingUp className="h-4 w-4" />
                    {t('costCalculator.tabs.pricing')}
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">{t('costCalculator.tabs.pricingTooltip')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="whatif" className="text-sm gap-1">
                    <SlidersHorizontal className="h-4 w-4" />
                    {t('costCalculator.tabs.whatIf')}
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">{t('costCalculator.tabs.whatIfTooltip')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="sensitivity" className="text-sm gap-1">
                    <Activity className="h-4 w-4" />
                    {t('costCalculator.tabs.sensitivity')}
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">{t('costCalculator.tabs.sensitivityTooltip')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="dscr" className="text-sm gap-1">
                    <ShieldCheck className="h-4 w-4" />
                    {t('costCalculator.tabs.dscr')}
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">{t('costCalculator.tabs.dscrTooltip')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="drawschedule" className="text-sm gap-1">
                    <Landmark className="h-4 w-4" />
                    {t('costCalculator.tabs.drawSchedule')}
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">{t('costCalculator.tabs.drawScheduleTooltip')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="montecarlo" className="text-sm gap-1">
                    <Dices className="h-4 w-4" />
                    {t('costCalculator.tabs.monteCarlo')}
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">{t('costCalculator.tabs.monteCarloTooltip')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="forwardcurve" className="text-sm gap-1">
                    <TrendingDown className="h-4 w-4" />
                    {t('costCalculator.tabs.forwardCurve')}
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">{t('costCalculator.tabs.forwardCurveTooltip')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="hedging" className="text-sm gap-1">
                    <Shield className="h-4 w-4" />
                    {t('costCalculator.tabs.hedging')}
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">{t('costCalculator.tabs.hedgingTooltip')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger value="settings" className="text-sm gap-1">
                    <Settings className="h-4 w-4" />
                    {t('costCalculator.tabs.settings')}
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">{t('costCalculator.tabs.settingsTooltip')}</TooltipContent>
              </Tooltip>
            </TabsList>

            {/* Tab 1: Cash Flow + Visual Bar Chart */}
            <TabsContent value="cashflow" className="mt-3">
              {result?.cashFlowAnalysis && result.cashFlowAnalysis.length > 0 ? (
                <div className="space-y-4">
                  <CashFlowTab
                    analysis={result.cashFlowAnalysis}
                    salePrice={salePrice}
                    t={t}
                  />
                  {/* Visual loss bar chart */}
                  <LossBarChart analysis={result.cashFlowAnalysis} t={t} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t('costCalculator.noData')}
                </p>
              )}
            </TabsContent>

            {/* Tab 2: Scenarios + Bank Comparison */}
            <TabsContent value="scenarios" className="mt-3">
              {comparison ? (
                <div className="space-y-4">
                  <ScenarioTab comparison={comparison} t={t} />
                  {/* Bank cost comparison */}
                  {result && (
                    <BankComparisonSection
                      salePrice={salePrice}
                      npv={result.npv}
                      weightedDays={result.weightedAverageDays}
                      discountRate={effectiveDiscountRate}
                      t={t}
                    />
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t('costCalculator.noData')}
                </p>
              )}
            </TabsContent>

            {/* Tab 3: Pricing */}
            <TabsContent value="pricing" className="mt-3">
              {result ? (
                <PricingTab result={result} salePrice={salePrice} t={t} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t('costCalculator.noData')}
                </p>
              )}
            </TabsContent>

            {/* Tab 4: What-If Simulator */}
            <TabsContent value="whatif" className="mt-3">
              <WhatIfTab
                salePrice={salePrice}
                currentResult={result}
                discountRate={effectiveDiscountRate}
                t={t}
              />
            </TabsContent>

            {/* Tab 5: Sensitivity Analysis */}
            <TabsContent value="sensitivity" className="mt-3">
              {result ? (
                <SensitivityTab
                  input={sensitivityInput}
                  effectiveRate={effectiveDiscountRate}
                  result={result}
                  t={t}
                />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t('costCalculator.noData')}
                </p>
              )}
            </TabsContent>

            {/* Tab 6: DSCR Stress Test */}
            <TabsContent value="dscr" className="mt-3">
              <DSCRStressTab
                salePrice={salePrice}
                effectiveRate={effectiveDiscountRate}
                t={t}
              />
            </TabsContent>

            {/* Tab 7: Draw Schedule */}
            <TabsContent value="drawschedule" className="mt-3">
              <DrawScheduleTab
                salePrice={salePrice}
                effectiveRate={effectiveDiscountRate}
                t={t}
              />
            </TabsContent>

            {/* Tab 8: Monte Carlo Simulation */}
            <TabsContent value="montecarlo" className="mt-3">
              {result ? (
                <MonteCarloTab
                  input={sensitivityInput}
                  effectiveRate={effectiveDiscountRate}
                  result={result}
                  t={t}
                />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t('costCalculator.noData')}
                </p>
              )}
            </TabsContent>

            {/* Tab 9: Forward Curves */}
            <TabsContent value="forwardcurve" className="mt-3">
              <ForwardCurveChart t={t} />
            </TabsContent>

            {/* Tab 10: Hedging Simulator */}
            <TabsContent value="hedging" className="mt-3">
              <HedgingComparisonTable
                salePrice={salePrice}
                effectiveRate={effectiveDiscountRate}
                t={t}
              />
            </TabsContent>

            {/* Tab 11: Settings */}
            <TabsContent value="settings" className="mt-3">
              <SettingsTab
                rates={rates}
                spreads={spreads}
                isLoading={isLoading}
                onRefreshRates={onRefreshRates}
                onUpdateSpreads={onUpdateSpreads}
                onDiscountSourceChange={setDiscountSource}
                discountSource={discountSource}
                manualRate={manualRate}
                onManualRateChange={setManualRate}
                t={t}
              />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
