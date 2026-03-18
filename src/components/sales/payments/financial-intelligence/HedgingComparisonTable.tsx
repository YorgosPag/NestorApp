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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

  // --- Helpers ---
  const parseInput = (value: string): number => {
    const n = parseFloat(value);
    return isNaN(n) ? 0 : n;
  };

  return (
    <article className="space-y-4">
      {/* Info banner */}
      <aside className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-3">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
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
            <Label className="text-xs">{t('costCalculator.hedging.notional')}</Label>
            <Input
              type="number"
              value={notional}
              onChange={(e) => setNotional(parseInput(e.target.value))}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('costCalculator.hedging.termYears')}</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={termYears}
              onChange={(e) => setTermYears(Math.max(1, Math.min(30, parseInput(e.target.value))))}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('costCalculator.hedging.swapRate')}</Label>
            <Input
              type="number"
              step="0.01"
              value={swapRate}
              onChange={(e) => setSwapRate(parseInput(e.target.value))}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('costCalculator.hedging.scenario')}</Label>
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
            <Label className="text-xs">{t('costCalculator.hedging.capStrike')}</Label>
            <Input
              type="number"
              step="0.01"
              value={capStrike}
              onChange={(e) => setCapStrike(parseInput(e.target.value))}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('costCalculator.hedging.capPremium')}</Label>
            <Input
              type="number"
              value={capPremium}
              onChange={(e) => setCapPremium(parseInput(e.target.value))}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('costCalculator.hedging.collarRange')}</Label>
            <div className="flex gap-1">
              <Input
                type="number"
                step="0.01"
                value={collarFloor}
                onChange={(e) => setCollarFloor(parseInput(e.target.value))}
                className="text-sm"
                placeholder="Floor"
              />
              <Input
                type="number"
                step="0.01"
                value={collarCap}
                onChange={(e) => setCollarCap(parseInput(e.target.value))}
                className="text-sm"
                placeholder="Cap"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('costCalculator.hedging.collarPremium')}</Label>
            <Input
              type="number"
              value={collarPremium}
              onChange={(e) => setCollarPremium(parseInput(e.target.value))}
              className="text-sm"
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
              <TableHead>{t('costCalculator.hedging.strategy')}</TableHead>
              <TableHead className="text-right">{t('costCalculator.hedging.totalCost')}</TableHead>
              <TableHead className="text-right">{t('costCalculator.hedging.avgAnnual')}</TableHead>
              <TableHead className="text-right">{t('costCalculator.hedging.avgRate')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparison.strategies.map((strat, idx) => {
              const isCheapest = idx === comparison.cheapestIndex;
              return (
                <TableRow
                  key={strat.strategy}
                  className={isCheapest ? 'bg-green-50 dark:bg-green-950/20' : undefined}
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
        <aside className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3">
          <Badge variant="outline" className="shrink-0">
            {t('costCalculator.hedging.breakEven')}
          </Badge>
          <p className="text-sm text-amber-800 dark:text-amber-300">
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
