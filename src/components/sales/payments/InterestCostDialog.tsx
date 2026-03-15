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

import React, { useState, useCallback, useEffect } from 'react';
import {
  Calculator,
  RefreshCw,
  TrendingUp,
  Award,
  Settings,
  BarChart3,
  Loader2,
} from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

  return (
    <article className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">{t('costCalculator.cashFlow.label')}</TableHead>
            <TableHead className="text-xs text-right">{t('costCalculator.cashFlow.amount')}</TableHead>
            <TableHead className="text-xs text-right">{t('costCalculator.cashFlow.date')}</TableHead>
            <TableHead className="text-xs text-right">{t('costCalculator.cashFlow.days')}</TableHead>
            <TableHead className="text-xs text-right">DF</TableHead>
            <TableHead className="text-xs text-right">PV</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {analysis.map((cf, idx) => (
            <TableRow key={idx}>
              <TableCell className="text-xs font-medium">{cf.label}</TableCell>
              <TableCell className="text-xs text-right">{formatCurrencyFull(cf.amount)}</TableCell>
              <TableCell className="text-xs text-right">{formatDate(cf.date)}</TableCell>
              <TableCell className="text-xs text-right">{cf.daysDelta}</TableCell>
              <TableCell className="text-xs text-right">{cf.discountFactor.toFixed(4)}</TableCell>
              <TableCell className="text-xs text-right font-medium">{formatCurrencyFull(cf.presentValue)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <footer className="flex justify-between items-center pt-2 border-t text-xs">
        <span className="text-muted-foreground">
          {t('costCalculator.cashFlow.nominalTotal')}: {formatCurrency(salePrice)}
        </span>
        <span className="font-semibold">
          NPV: {formatCurrency(totalPV)}
        </span>
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
  return (
    <article className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">{t('costCalculator.scenarios.scenario')}</TableHead>
            <TableHead className="text-xs text-right">NPV</TableHead>
            <TableHead className="text-xs text-right">{t('costCalculator.scenarios.cost')}</TableHead>
            <TableHead className="text-xs text-right">WACP</TableHead>
            <TableHead className="text-xs text-center" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {comparison.scenarios.map((s, idx) => {
            const isBest = idx === comparison.bestScenarioIndex;
            return (
              <TableRow key={idx} className={isBest ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''}>
                <TableCell className="text-xs">
                  <span className="font-medium">{s.name}</span>
                  <br />
                  <span className="text-muted-foreground">{s.description}</span>
                </TableCell>
                <TableCell className="text-xs text-right font-medium">
                  {formatCurrency(s.result.npv)}
                  <br />
                  <span className="text-muted-foreground">{formatPercent(s.result.npvPercentage)}</span>
                </TableCell>
                <TableCell className="text-xs text-right text-destructive">
                  {formatCurrency(s.result.timeCost)}
                  <br />
                  <span>{formatPercent(s.result.timeCostPercentage)}</span>
                </TableCell>
                <TableCell className="text-xs text-right">
                  {s.result.weightedAverageDays} {t('costCalculator.scenarios.days')}
                </TableCell>
                <TableCell className="text-center">
                  {isBest && (
                    <Badge variant="default" className="text-[10px]">
                      <Award className="h-3 w-3 mr-1" />
                      Best
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <footer className="text-[10px] text-muted-foreground text-center">
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
      {/* Hero callout */}
      <section className="rounded-lg border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 p-4 text-center space-y-2">
        <TrendingUp className="h-8 w-8 mx-auto text-emerald-600" />
        <p className="text-xs text-muted-foreground">
          {t('costCalculator.pricing.sellAtLeast')}
        </p>
        <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
          {formatCurrency(result.recommendedPrice)}
        </p>
        <p className="text-xs text-muted-foreground">
          +{formatCurrency(result.priceAdjustment)} ({formatPercent(result.priceAdjustmentPercentage)})
          {' '}{t('costCalculator.pricing.overNominal')}
        </p>
      </section>

      {/* Breakdown */}
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <dt className="text-muted-foreground">{t('costCalculator.pricing.nominalPrice')}</dt>
        <dd className="text-right font-medium">{formatCurrency(salePrice)}</dd>

        <dt className="text-muted-foreground">NPV ({formatPercent(result.npvPercentage)})</dt>
        <dd className="text-right font-medium">{formatCurrency(result.npv)}</dd>

        <dt className="text-muted-foreground text-destructive">
          {t('costCalculator.pricing.timeCost')}
        </dt>
        <dd className="text-right font-medium text-destructive">
          -{formatCurrency(result.timeCost)}
        </dd>

        <dt className="text-muted-foreground">{t('costCalculator.pricing.wacp')}</dt>
        <dd className="text-right font-medium">
          {result.weightedAverageDays} {t('costCalculator.scenarios.days')}
        </dd>

        <dt className="text-muted-foreground">{t('costCalculator.pricing.effectiveRate')}</dt>
        <dd className="text-right font-medium">{formatPercent(result.effectiveRate)}</dd>
      </dl>

      <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
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
          <Label className="text-xs font-semibold">
            {t('costCalculator.settings.euriborRates')}
          </Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={handleRefresh}
            disabled={refreshing || isLoading}
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            {t('costCalculator.settings.refresh')}
          </Button>
        </header>

        {rates && (
          <dl className="grid grid-cols-3 gap-2 text-xs">
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
            <dt className="text-muted-foreground">ECB Main</dt>
            <dd>{formatPercent(rates.ecbMainRate)}</dd>
            <dd className="text-muted-foreground">{formatDate(rates.rateDate)}</dd>
          </dl>
        )}
      </section>

      {/* Discount Rate Source */}
      <section className="space-y-2">
        <Label className="text-xs font-semibold" htmlFor="discount-source">
          {t('costCalculator.settings.discountSource')}
        </Label>
        <Select
          value={discountSource}
          onValueChange={(val) => onDiscountSourceChange(val as DiscountRateSource)}
        >
          <SelectTrigger id="discount-source" className="text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="euribor_1M">Euribor 1M + Spread</SelectItem>
            <SelectItem value="euribor_3M">Euribor 3M + Spread</SelectItem>
            <SelectItem value="euribor_6M">Euribor 6M + Spread</SelectItem>
            <SelectItem value="euribor_12M">Euribor 12M + Spread</SelectItem>
            <SelectItem value="ecb_main">ECB Main Rate + Spread</SelectItem>
            <SelectItem value="manual">{t('costCalculator.settings.manual')}</SelectItem>
          </SelectContent>
        </Select>

        {discountSource === 'manual' && (
          <fieldset className="space-y-1">
            <Label className="text-xs" htmlFor="manual-rate">
              {t('costCalculator.settings.manualRate')} (%)
            </Label>
            <Input
              id="manual-rate"
              type="number"
              step="0.01"
              min="0"
              max="50"
              value={manualRate}
              onChange={(e) => onManualRateChange(parseFloat(e.target.value) || 0)}
              className="text-xs"
            />
          </fieldset>
        )}
      </section>

      {/* Bank Spread */}
      <section className="space-y-2">
        <Label className="text-xs font-semibold" htmlFor="bank-spread">
          {t('costCalculator.settings.bankSpread')} (%)
        </Label>
        <fieldset className="flex items-center gap-2">
          <Input
            id="bank-spread"
            type="number"
            step="0.05"
            min="0"
            max="10"
            value={localSpread}
            onChange={(e) => setLocalSpread(parseFloat(e.target.value) || 0)}
            className="text-xs flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8"
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

  // Load comparison when dialog opens
  useEffect(() => {
    if (open && !comparison && salePrice > 0) {
      const referenceDate = new Date().toISOString().split('T')[0];
      onCompare(salePrice, referenceDate, installments);
    }
  }, [open, comparison, salePrice, installments, onCompare]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Calculator className="h-5 w-5" />
            {t('costCalculator.dialogTitle', { defaultValue: 'Ανάλυση Κόστους Χρήματος' })}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <section className="flex items-center justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </section>
        )}

        {!isLoading && (
          <Tabs defaultValue="cashflow" className="mt-2">
            <TabsList className="grid grid-cols-4 text-xs">
              <TabsTrigger value="cashflow" className="text-xs gap-1">
                <BarChart3 className="h-3 w-3" />
                {t('costCalculator.tabs.cashFlow', { defaultValue: 'Cash Flow' })}
              </TabsTrigger>
              <TabsTrigger value="scenarios" className="text-xs gap-1">
                <Award className="h-3 w-3" />
                {t('costCalculator.tabs.scenarios', { defaultValue: 'Σενάρια' })}
              </TabsTrigger>
              <TabsTrigger value="pricing" className="text-xs gap-1">
                <TrendingUp className="h-3 w-3" />
                {t('costCalculator.tabs.pricing', { defaultValue: 'Τιμολόγηση' })}
              </TabsTrigger>
              <TabsTrigger value="settings" className="text-xs gap-1">
                <Settings className="h-3 w-3" />
                {t('costCalculator.tabs.settings', { defaultValue: 'Ρυθμίσεις' })}
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Cash Flow */}
            <TabsContent value="cashflow" className="mt-3">
              {result?.cashFlowAnalysis && result.cashFlowAnalysis.length > 0 ? (
                <CashFlowTab
                  analysis={result.cashFlowAnalysis}
                  salePrice={salePrice}
                  t={t}
                />
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {t('costCalculator.noData', { defaultValue: 'Δεν υπάρχουν δεδομένα.' })}
                </p>
              )}
            </TabsContent>

            {/* Tab 2: Scenarios */}
            <TabsContent value="scenarios" className="mt-3">
              {comparison ? (
                <ScenarioTab comparison={comparison} t={t} />
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {t('costCalculator.noData', { defaultValue: 'Δεν υπάρχουν δεδομένα.' })}
                </p>
              )}
            </TabsContent>

            {/* Tab 3: Pricing */}
            <TabsContent value="pricing" className="mt-3">
              {result ? (
                <PricingTab result={result} salePrice={salePrice} t={t} />
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {t('costCalculator.noData', { defaultValue: 'Δεν υπάρχουν δεδομένα.' })}
                </p>
              )}
            </TabsContent>

            {/* Tab 4: Settings */}
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
