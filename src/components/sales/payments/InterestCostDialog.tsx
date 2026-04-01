'use client';
 
 

/**
 * InterestCostDialog — Full multi-tab dialog for interest cost analysis
 *
 * Tabs:
 *   1. Cash Flow Analysis (per-installment breakdown)
 *   2. Scenario Comparison (Cash / Off-Plan / Loan / Current)
 *   3. Pricing Recommendation (highlighted callout)
 *   4. What-If Simulator
 *   5-11. Financial Intelligence tabs (sensitivity, DSCR, draw schedule, etc.)
 *   12. Settings (discount rate source, bank spread, refresh)
 *
 * Sub-components extracted to:
 *   - interest-cost-types.ts  (shared types)
 *   - interest-cost-tabs.tsx  (CashFlowTab, ScenarioTab, PricingTab, SettingsTab)
 *   - interest-cost-helpers.tsx (formatters, LossBarChart, BankComparisonSection, WhatIfTab, LossAlertBanner)
 *
 * @enterprise ADR-234 Phase 4 - Interest Cost Calculator (SPEC-234E)
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calculator,
  TrendingUp,
  Award,
  Settings,
  BarChart3,
  Loader2,
  SlidersHorizontal,
  Activity,
  ShieldCheck,
  Landmark,
  Dices,
  Wallet,
  TrendingDown,
  Shield,
  Handshake,
} from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import type { CashFlowEntry } from '@/types/interest-calculator';
import type { DiscountRateSource } from '@/types/interest-calculator';

import {
  SensitivityTab,
  DSCRStressTab,
  DrawScheduleTab,
  MonteCarloTab,
  EquityWaterfallDialog,
  ForwardCurveChart,
  HedgingComparisonTable,
  CounterproposalTab,
} from './financial-intelligence';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// Extracted modules
import type { InterestCostDialogProps } from './interest-cost-types';
import { CashFlowTab, ScenarioTab, PricingTab, SettingsTab } from './interest-cost-tabs';
import {
  LossBarChart,
  BankComparisonSection,
  WhatIfTab,
  LossAlertBanner,
} from './interest-cost-helpers';

// Re-exports for backward compatibility
export type { InterestCostDialogProps } from './interest-cost-types';
export { CashFlowTab, ScenarioTab, PricingTab, SettingsTab } from './interest-cost-tabs';
export {
  formatCurrency,
  formatCurrencyFull,
  formatPercent,
  formatDate,
  LossBarChart,
  BankComparisonSection,
  WhatIfTab,
  LossAlertBanner,
} from './interest-cost-helpers';

// =============================================================================
// MAIN DIALOG
// =============================================================================

export function InterestCostDialog({
  open,
  onOpenChange,
  propertyId: _propertyId,
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
  const colors = useSemanticColors();
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
            <Loader2 className={cn("h-6 w-6 animate-spin", colors.text.muted)} />
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
                  <TabsTrigger value="counterproposal" className="text-sm gap-1">
                    <Handshake className="h-4 w-4" />
                    {t('costCalculator.tabs.counterproposal')}
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">{t('costCalculator.tabs.counterproposalTooltip')}</TooltipContent>
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
                  <LossBarChart analysis={result.cashFlowAnalysis} t={t} />
                </div>
              ) : (
                <p className={cn("text-sm text-center py-4", colors.text.muted)}>
                  {t('costCalculator.noData')}
                </p>
              )}
            </TabsContent>

            {/* Tab 2: Scenarios + Bank Comparison */}
            <TabsContent value="scenarios" className="mt-3">
              {comparison ? (
                <div className="space-y-4">
                  <ScenarioTab comparison={comparison} t={t} />
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
                <p className={cn("text-sm text-center py-4", colors.text.muted)}>
                  {t('costCalculator.noData')}
                </p>
              )}
            </TabsContent>

            {/* Tab 3: Pricing */}
            <TabsContent value="pricing" className="mt-3">
              {result ? (
                <PricingTab result={result} salePrice={salePrice} t={t} />
              ) : (
                <p className={cn("text-sm text-center py-4", colors.text.muted)}>
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
                <p className={cn("text-sm text-center py-4", colors.text.muted)}>
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
                <p className={cn("text-sm text-center py-4", colors.text.muted)}>
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

            {/* Tab 11: Counterproposal */}
            <TabsContent value="counterproposal" className="mt-3">
              {result ? (
                <CounterproposalTab
                  input={sensitivityInput}
                  effectiveRate={effectiveDiscountRate}
                  result={result}
                  t={t}
                />
              ) : (
                <p className={cn("text-sm text-center py-4", colors.text.muted)}>
                  {t('costCalculator.noData')}
                </p>
              )}
            </TabsContent>

            {/* Tab 12: Settings */}
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
