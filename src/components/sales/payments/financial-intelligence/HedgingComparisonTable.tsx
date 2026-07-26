/* eslint-disable design-system/enforce-semantic-colors */
'use client';

/**
 * HedgingComparisonTable — Interest Rate Hedging Strategy Comparison
 *
 * Config panel for notional/term/rates, rate scenario presets,
 * and side-by-side comparison of Floating, Swap, Cap, Collar strategies.
 *
 * @enterprise ADR-242 SPEC-242E - Hedging Simulator
 */

import React, { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { NumericField } from '@/components/ui/numeric-field';
import { InfoLabel, InfoTableHead } from '@/components/ui/InfoLabel';
import {
  Tooltip as RadixTooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
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

import { formatCurrencyWhole } from '@/lib/intl-utils';
import {
  compareHedgingStrategies,
  risingScenario,
  flatScenario,
  decliningScenario,
} from '@/lib/hedging-engine';
import type { HedgingInput, HedgingStrategy } from '@/types/interest-calculator';
import '@/lib/design-system';

// =============================================================================
// TYPES
// =============================================================================

interface HedgingComparisonTableProps {
  salePrice: number;
  effectiveRate: number;
  t: (key: string, opts?: Record<string, string>) => string;
}

type ScenarioPreset = 'rising' | 'flat' | 'declining';

// =============================================================================
// CONSTANTS
// =============================================================================

const STRATEGY_KEYS: HedgingStrategy[] = ['floating', 'swap', 'cap', 'collar'];

const STRATEGY_BADGE_VARIANT: Record<HedgingStrategy, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  floating: 'destructive',
  swap: 'default',
  cap: 'secondary',
  collar: 'outline',
};

// =============================================================================
// COMPONENT
// =============================================================================

export function HedgingComparisonTable({ salePrice, effectiveRate, t }: HedgingComparisonTableProps) {
  // --- Config state ---
  const [notional, setNotional] = useState(Math.round(salePrice * 0.7));
  const [termYears, setTermYears] = useState(5);
  const [swapRate, setSwapRate] = useState(Math.round((effectiveRate + 0.5) * 100) / 100);
  const [capStrike, setCapStrike] = useState(Math.round((effectiveRate + 1.0) * 100) / 100);
  const [capPremium, setCapPremium] = useState(Math.round(notional * 0.005));
  const [collarCap, setCollarCap] = useState(Math.round((effectiveRate + 1.5) * 100) / 100);
  const [collarFloor, setCollarFloor] = useState(Math.round((effectiveRate - 0.5) * 100) / 100);
  const [collarPremium, setCollarPremium] = useState(Math.round(notional * 0.002));
  const [scenarioPreset, setScenarioPreset] = useState<ScenarioPreset>('rising');

  // --- Build rate scenario from preset ---
  const rateScenario = useMemo(() => {
    switch (scenarioPreset) {
      case 'rising':
        return risingScenario(effectiveRate, termYears, 50);
      case 'flat':
        return flatScenario(effectiveRate, termYears);
      case 'declining':
        return decliningScenario(effectiveRate, termYears, 30);
    }
  }, [scenarioPreset, effectiveRate, termYears]);

  // --- Build input & compare ---
  const hedgingInput: HedgingInput = useMemo(() => ({
    notional,
    termYears,
    currentFloatingRate: effectiveRate,
    swapRate,
    capStrike,
    capPremium,
    collarCap,
    collarFloor,
    collarPremium,
    rateScenario,
  }), [notional, termYears, effectiveRate, swapRate, capStrike, capPremium, collarCap, collarFloor, collarPremium, rateScenario]);

  const comparison = useMemo(
    () => compareHedgingStrategies(hedgingInput),
    [hedgingInput]
  );

  // ADR-706 — the local `parseInput` helper is gone: parsing is the numeric
  // SSoT's job now, and it delegates to the locale-number SSoT (ADR-576).

  return (
    <article className="space-y-4">
      {/* Info banner */}
      <aside className="flex gap-2 rounded-lg border border-primary/30 bg-[hsl(var(--bg-info))]/20 p-3">
        <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-foreground leading-relaxed">
          {t('costCalculator.hedging.infoBanner')}
        </p>
      </aside>

      {/* Config panel */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">
          {t('costCalculator.hedging.configTitle')}
        </h3>

        <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <InfoLabel label={t('costCalculator.hedging.notional')} tooltip={t('costCalculator.hedging.notionalTooltip')} />
            <NumericField
              min={0}
              step={0.01}
              value={notional}
              onValueChange={setNotional}
              className="text-sm"
              aria-label={t('costCalculator.hedging.notional')}
            />
          </div>
          <div className="space-y-1">
            <InfoLabel label={t('costCalculator.hedging.termYears')} tooltip={t('costCalculator.hedging.termYearsTooltip')} />
            {/* The bounds are applied here too, not only via min/max: the field
                syncs live while typing and clamps on commit, and a transient 0
                would divide through the swap maths. */}
            <NumericField
              min={1}
              max={30}
              step={1}
              value={termYears}
              onValueChange={(years) => setTermYears(Math.max(1, Math.min(30, years)))}
              className="text-sm"
              aria-label={t('costCalculator.hedging.termYears')}
            />
          </div>
          <div className="space-y-1">
            <InfoLabel label={t('costCalculator.hedging.swapRate')} tooltip={t('costCalculator.hedging.swapRateTooltip')} />
            <NumericField
              step={0.01}
              min={0}
              value={swapRate}
              onValueChange={setSwapRate}
              className="text-sm"
              aria-label={t('costCalculator.hedging.swapRate')}
            />
          </div>
          <div className="space-y-1">
            <InfoLabel label={t('costCalculator.hedging.scenario')} tooltip={t('costCalculator.hedging.scenarioTooltip')} />
            <Select value={scenarioPreset} onValueChange={(v) => setScenarioPreset(v as ScenarioPreset)}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rising">{t('costCalculator.hedging.scenarioRising')}</SelectItem>
                <SelectItem value="flat">{t('costCalculator.hedging.scenarioFlat')}</SelectItem>
                <SelectItem value="declining">{t('costCalculator.hedging.scenarioDeclining')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </fieldset>

        <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <InfoLabel label={t('costCalculator.hedging.capStrike')} tooltip={t('costCalculator.hedging.capStrikeTooltip')} />
            <NumericField
              step={0.01}
              min={0}
              value={capStrike}
              onValueChange={setCapStrike}
              className="text-sm"
              aria-label={t('costCalculator.hedging.capStrike')}
            />
          </div>
          <div className="space-y-1">
            <InfoLabel label={t('costCalculator.hedging.capPremium')} tooltip={t('costCalculator.hedging.capPremiumTooltip')} />
            <NumericField
              min={0}
              step={0.01}
              value={capPremium}
              onValueChange={setCapPremium}
              className="text-sm"
              aria-label={t('costCalculator.hedging.capPremium')}
            />
          </div>
          <div className="space-y-1">
            <InfoLabel label={t('costCalculator.hedging.collarRange')} tooltip={t('costCalculator.hedging.collarRangeTooltip')} />
            <div className="flex gap-1">
              <NumericField
                step={0.01}
                min={0}
                value={collarFloor}
                onValueChange={setCollarFloor}
                className="text-sm"
                aria-label={t('costCalculator.hedging.collarFloor')}
              />
              <NumericField
                step={0.01}
                min={0}
                value={collarCap}
                onValueChange={setCollarCap}
                className="text-sm"
                aria-label={t('costCalculator.hedging.collarCap')}
              />
            </div>
          </div>
          <div className="space-y-1">
            <InfoLabel label={t('costCalculator.hedging.collarPremium')} tooltip={t('costCalculator.hedging.collarPremiumTooltip')} />
            <NumericField
              min={0}
              step={0.01}
              value={collarPremium}
              onValueChange={setCollarPremium}
              className="text-sm"
              aria-label={t('costCalculator.hedging.collarPremium')}
            />
          </div>
        </fieldset>
      </section>

      {/* Comparison table */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">
          {t('costCalculator.hedging.resultsTitle')}
        </h3>

        <Table>
          <TableHeader>
            <TableRow>
              <InfoTableHead label={t('costCalculator.hedging.strategy')} tooltip={t('costCalculator.hedging.strategyTooltip')} />
              <InfoTableHead className="text-right" label={t('costCalculator.hedging.totalCost')} tooltip={t('costCalculator.hedging.totalCostTooltip')} />
              <InfoTableHead className="text-right" label={t('costCalculator.hedging.avgAnnual')} tooltip={t('costCalculator.hedging.avgAnnualTooltip')} />
              <InfoTableHead className="text-right" label={t('costCalculator.hedging.avgRate')} tooltip={t('costCalculator.hedging.avgRateTooltip')} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparison.strategies.map((strat, idx) => {
              const isCheapest = idx === comparison.cheapestIndex;
              return (
                <TableRow
                  key={strat.strategy}
                  className={isCheapest ? 'bg-[hsl(var(--bg-success))]/10' : undefined}
                >
                  <TableCell className="flex items-center gap-2">
                    <Badge variant={STRATEGY_BADGE_VARIANT[strat.strategy]}>
                      {t(`costCalculator.hedging.strategyName.${strat.strategy}`)}
                    </Badge>
                    {isCheapest && (
                      <Badge variant="default" className="text-xs">
                        {t('costCalculator.hedging.cheapest')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrencyWhole(strat.totalCost)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrencyWhole(strat.averageAnnualCost)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {strat.effectiveAverageRate.toFixed(2)}%
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Break-even callout */}
        <aside className="flex items-center gap-2 rounded-lg border border-border bg-[hsl(var(--bg-warning))]/40 p-3">
          <RadixTooltip>
            <TooltipTrigger asChild>
              <span>
                <Badge variant="outline" className="shrink-0 cursor-help">
                  {t('costCalculator.hedging.breakEven')}
                </Badge>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {t('costCalculator.hedging.breakEvenTooltip')}
            </TooltipContent>
          </RadixTooltip>
          <p className="text-sm text-foreground">
            {t('costCalculator.hedging.breakEvenText', {
              rate: comparison.breakEvenRate.toFixed(2),
            })}
          </p>
        </aside>
      </section>

      {/* Annual breakdown */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">
          {t('costCalculator.hedging.annualTitle')}
        </h3>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('costCalculator.hedging.year')}</TableHead>
              <TableHead className="text-right">{t('costCalculator.hedging.scenarioRate')}</TableHead>
              {STRATEGY_KEYS.map((sk) => (
                <TableHead key={sk} className="text-right">
                  {t(`costCalculator.hedging.strategyName.${sk}`)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: termYears }, (_, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{i + 1}</TableCell>
                <TableCell className="text-right font-mono">
                  {rateScenario[i].toFixed(2)}%
                </TableCell>
                {comparison.strategies.map((strat) => (
                  <TableCell key={strat.strategy} className="text-right font-mono">
                    {formatCurrencyWhole(strat.annualBreakdown[i].totalCost)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </article>
  );
}
