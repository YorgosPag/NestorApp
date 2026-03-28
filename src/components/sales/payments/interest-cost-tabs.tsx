'use client';
/* eslint-disable custom/no-hardcoded-strings */
/* eslint-disable design-system/enforce-semantic-colors */

/**
 * interest-cost-tabs.tsx — Core tab components for InterestCostDialog
 *
 * Contains: CashFlowTab, ScenarioTab
 * PricingTab and SettingsTab are in interest-cost-pricing-settings.tsx
 *
 * @enterprise ADR-234 Phase 4 - Interest Cost Calculator (SPEC-234E)
 */

import React from 'react';
import {
  Info,
  AlertTriangle,
  Award,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type {
  CashFlowTabProps,
  ScenarioTabProps,
} from './interest-cost-types';
import { formatCurrency, formatCurrencyFull, formatPercent, formatDate } from './interest-cost-helpers';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// =============================================================================
// TAB 1: CASH FLOW ANALYSIS
// =============================================================================

/** Tab 1: Cash Flow Analysis */
export function CashFlowTab({ analysis, salePrice, t }: CashFlowTabProps) {
  const colors = useSemanticColors();
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
                      {loss > 0 ? `-${formatCurrencyFull(loss)}` : '\u2014'}
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
              <span className={cn("cursor-help", colors.text.muted)}>
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

// =============================================================================
// TAB 2: SCENARIO COMPARISON
// =============================================================================

/** Tab 2: Scenario Comparison */
export function ScenarioTab({ comparison, t }: ScenarioTabProps) {
  const colors = useSemanticColors();
  const cashNpv = comparison.scenarios[0]?.result.npv ?? 0;

  const scenarioTooltipKeys = [
    'costCalculator.scenarios.rowTooltipCash',
    'costCalculator.scenarios.rowTooltipOffPlan',
    'costCalculator.scenarios.rowTooltipLoan',
    'costCalculator.scenarios.rowTooltipCurrent',
  ];

  return (
    <article className="space-y-3">
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
                      <span className={colors.text.muted}>{t(s.description, s.descriptionParams)}</span>
                    </TableCell>
                    <TableCell className="text-sm text-right font-medium">
                      {formatCurrency(s.result.npv)}
                      <br />
                      <span className={colors.text.muted}>{formatPercent(s.result.npvPercentage)}</span>
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
                        <span className={cn("text-sm", colors.text.muted)}>
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

      <footer className={cn("text-sm text-center", colors.text.muted)}>
        {t('costCalculator.scenarios.discountRate')}: {formatPercent(comparison.discountRate)}
      </footer>
    </article>
  );
}

// Re-export PricingTab and SettingsTab for backward compatibility
export { PricingTab, SettingsTab } from './interest-cost-pricing-settings';
