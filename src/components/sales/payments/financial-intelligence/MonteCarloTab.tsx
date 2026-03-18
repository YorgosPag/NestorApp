'use client';

/**
 * MonteCarloTab — Monte Carlo NPV simulation with fan chart & histogram
 *
 * Config panel for variables/distributions, then visualizes:
 * - Fan chart (P10-P90 confidence bands over time)
 * - Histogram (NPV distribution + CDF overlay)
 * - Statistics card (percentiles, probabilities)
 *
 * @enterprise ADR-242 SPEC-242D — Monte Carlo Simulation
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';
import { Info, Play, Dices } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { runMonteCarloSimulation } from '@/lib/monte-carlo-engine';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import type {
  CostCalculationInput,
  CostCalculationResult,
  MonteCarloConfig,
  MonteCarloVariable,
  MonteCarloDistribution,
  MonteCarloResult,
  SensitivityVariable,
} from '@/types/interest-calculator';

// =============================================================================
// TYPES
// =============================================================================

interface MonteCarloTabProps {
  input: CostCalculationInput;
  effectiveRate: number;
  result: CostCalculationResult;
  t: (key: string, opts?: Record<string, string>) => string;
}

// =============================================================================
// VARIABLE DEFINITIONS
// =============================================================================

const VARIABLE_KEYS: SensitivityVariable[] = [
  'discountRate',
  'bankSpread',
  'salePrice',
  'upfrontPercent',
  'paymentMonths',
  'certaintyMix',
];

function getVariableLabel(key: SensitivityVariable, t: MonteCarloTabProps['t']): string {
  const labels: Record<SensitivityVariable, string> = {
    discountRate: 'costCalculator.sensitivity.varDiscountRate',
    bankSpread: 'costCalculator.sensitivity.varBankSpread',
    salePrice: 'costCalculator.sensitivity.varSalePrice',
    upfrontPercent: 'costCalculator.sensitivity.varUpfrontPercent',
    paymentMonths: 'costCalculator.sensitivity.varPaymentMonths',
    certaintyMix: 'costCalculator.sensitivity.varCertaintyMix',
  };
  return t(labels[key]);
}

function getBaseValue(key: SensitivityVariable, input: CostCalculationInput, rate: number): number {
  switch (key) {
    case 'discountRate': return rate;
    case 'bankSpread': return input.bankSpread;
    case 'salePrice': return input.salePrice;
    case 'upfrontPercent': {
      if (input.cashFlows.length === 0 || input.salePrice === 0) return 0;
      return (input.cashFlows[0].amount / input.salePrice) * 100;
    }
    case 'paymentMonths': {
      if (input.cashFlows.length <= 1) return 0;
      const refMs = new Date(input.referenceDate).getTime();
      const lastCf = input.cashFlows[input.cashFlows.length - 1];
      const lastMs = new Date(lastCf.date).getTime();
      return Math.round((lastMs - refMs) / (1000 * 60 * 60 * 24 * 30.44));
    }
    case 'certaintyMix': return 1.0;
  }
}

function createDefaultVariables(input: CostCalculationInput, rate: number): MonteCarloVariable[] {
  return VARIABLE_KEYS.map(key => {
    const base = getBaseValue(key, input, rate);
    const spread = base * 0.2; // ±20%
    return {
      key,
      enabled: key === 'discountRate' || key === 'salePrice',
      distribution: 'normal' as MonteCarloDistribution,
      mean: base,
      stdDev: spread > 0 ? spread : 1,
      min: base - spread,
      max: base + spread,
    };
  });
}

// =============================================================================
// STATISTICS CARD
// =============================================================================

function StatisticsCard({
  mcResult,
  t,
}: {
  mcResult: MonteCarloResult;
  t: MonteCarloTabProps['t'];
}) {
  const fmt = (v: number) => formatCurrencyWhole(v) ?? '';

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <dl className="rounded-lg border p-3 space-y-1">
        <dt className="text-xs text-muted-foreground">{t('costCalculator.monteCarlo.meanNpv')}</dt>
        <dd className="text-lg font-bold">{fmt(mcResult.meanNPV)}</dd>
      </dl>
      <dl className="rounded-lg border p-3 space-y-1">
        <dt className="text-xs text-muted-foreground">{t('costCalculator.monteCarlo.p10')}</dt>
        <dd className="text-lg font-bold">{fmt(mcResult.p10)}</dd>
      </dl>
      <dl className="rounded-lg border p-3 space-y-1">
        <dt className="text-xs text-muted-foreground">{t('costCalculator.monteCarlo.p50')}</dt>
        <dd className="text-lg font-bold">{fmt(mcResult.p50)}</dd>
      </dl>
      <dl className="rounded-lg border p-3 space-y-1">
        <dt className="text-xs text-muted-foreground">{t('costCalculator.monteCarlo.p90')}</dt>
        <dd className="text-lg font-bold">{fmt(mcResult.p90)}</dd>
      </dl>
      <dl className="rounded-lg border p-3 space-y-1">
        <dt className="text-xs text-muted-foreground">{t('costCalculator.monteCarlo.stdDevNpv')}</dt>
        <dd className="text-sm font-medium">{fmt(mcResult.stdDevNPV)}</dd>
      </dl>
      <dl className="rounded-lg border p-3 space-y-1">
        <dt className="text-xs text-muted-foreground">{t('costCalculator.monteCarlo.minMax')}</dt>
        <dd className="text-sm font-medium">{fmt(mcResult.minNPV)} — {fmt(mcResult.maxNPV)}</dd>
      </dl>
      <dl className="rounded-lg border p-3 space-y-1">
        <dt className="text-xs text-muted-foreground">{t('costCalculator.monteCarlo.probPositive')}</dt>
        <dd className="text-sm font-medium">{mcResult.probPositive}%</dd>
      </dl>
      <dl className="rounded-lg border p-3 space-y-1">
        <dt className="text-xs text-muted-foreground">{t('costCalculator.monteCarlo.executionTime')}</dt>
        <dd className="text-sm font-medium">{mcResult.executionTimeMs}ms</dd>
      </dl>
    </section>
  );
}

// =============================================================================
// FAN CHART
// =============================================================================

function FanChart({
  mcResult,
  t,
}: {
  mcResult: MonteCarloResult;
  t: MonteCarloTabProps['t'];
}) {
  const fmt = (v: number) => formatCurrencyWhole(v) ?? '';

  if (mcResult.fanChart.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{t('costCalculator.monteCarlo.fanChartTitle')}</h3>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={mcResult.fanChart} margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="month"
            label={{ value: 'Month', position: 'insideBottomRight', offset: -5 }}
          />
          <YAxis tickFormatter={(v: number) => fmt(v)} />
          <RechartsTooltip
            formatter={(value: number, name: string) => [fmt(value), name]}
          />
          <Area type="monotone" dataKey="p90" stackId="band" stroke="none" fill="hsl(var(--chart-1))" fillOpacity={0.15} name="P90" />
          <Area type="monotone" dataKey="p75" stackId="band2" stroke="none" fill="hsl(var(--chart-1))" fillOpacity={0.2} name="P75" />
          <Area type="monotone" dataKey="p50" stackId="band3" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.3} strokeWidth={2} name="P50" />
          <Area type="monotone" dataKey="p25" stackId="band4" stroke="none" fill="hsl(var(--chart-2))" fillOpacity={0.2} name="P25" />
          <Area type="monotone" dataKey="p10" stackId="band5" stroke="none" fill="hsl(var(--chart-2))" fillOpacity={0.15} name="P10" />
        </AreaChart>
      </ResponsiveContainer>
    </section>
  );
}

// =============================================================================
// HISTOGRAM + CDF
// =============================================================================

function HistogramChart({
  mcResult,
  t,
}: {
  mcResult: MonteCarloResult;
  t: MonteCarloTabProps['t'];
}) {
  const fmt = (v: number) => formatCurrencyWhole(v) ?? '';

  if (mcResult.histogram.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{t('costCalculator.monteCarlo.histogramTitle')}</h3>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={mcResult.histogram} margin={{ top: 5, right: 50, left: 60, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="midpoint"
            tickFormatter={(v: number) => fmt(v)}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            yAxisId="freq"
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            label={{ value: t('costCalculator.monteCarlo.frequency'), angle: -90, position: 'insideLeft' }}
          />
          <YAxis
            yAxisId="cdf"
            orientation="right"
            tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            label={{ value: t('costCalculator.monteCarlo.cdf'), angle: 90, position: 'insideRight' }}
          />
          <RechartsTooltip
            formatter={(value: number, name: string) => [
              name === 'frequency' ? `${(value * 100).toFixed(1)}%` : `${(value * 100).toFixed(1)}%`,
              name === 'frequency' ? t('costCalculator.monteCarlo.frequency') : t('costCalculator.monteCarlo.cdf'),
            ]}
            labelFormatter={(label: number) => fmt(label)}
          />
          <Bar yAxisId="freq" dataKey="frequency" fill="hsl(var(--chart-1))" opacity={0.7} name="frequency" />
          <Line yAxisId="cdf" type="monotone" dataKey="cumulativeFrequency" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} name="cdf" />
        </ComposedChart>
      </ResponsiveContainer>
    </section>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function MonteCarloTab({ input, effectiveRate, result, t }: MonteCarloTabProps) {
  const [variables, setVariables] = useState<MonteCarloVariable[]>(() =>
    createDefaultVariables(input, effectiveRate)
  );
  const [scenarioCount, setScenarioCount] = useState(10000);
  const [seed, setSeed] = useState(42);
  const [mcResult, setMcResult] = useState<MonteCarloResult | null>(null);
  const [running, setRunning] = useState(false);

  const handleToggleVariable = useCallback((key: SensitivityVariable) => {
    setVariables(prev => prev.map(v =>
      v.key === key ? { ...v, enabled: !v.enabled } : v
    ));
  }, []);

  const handleDistributionChange = useCallback((key: SensitivityVariable, dist: MonteCarloDistribution) => {
    setVariables(prev => prev.map(v =>
      v.key === key ? { ...v, distribution: dist } : v
    ));
  }, []);

  const handleVariableFieldChange = useCallback((key: SensitivityVariable, field: 'stdDev' | 'min' | 'max', value: number) => {
    setVariables(prev => prev.map(v =>
      v.key === key ? { ...v, [field]: value } : v
    ));
  }, []);

  const handleRun = useCallback(() => {
    setRunning(true);
    // Use setTimeout to let the UI update before heavy computation
    setTimeout(() => {
      const config: MonteCarloConfig = {
        scenarioCount,
        seed,
        variables,
      };
      const result = runMonteCarloSimulation(input, effectiveRate, config);
      setMcResult(result);
      setRunning(false);
    }, 10);
  }, [input, effectiveRate, scenarioCount, seed, variables]);

  return (
    <article className="space-y-6">
      {/* Info banner */}
      <section className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-3">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
          {t('costCalculator.monteCarlo.infoBanner')}
        </p>
      </section>

      {/* Config panel */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold">{t('costCalculator.monteCarlo.configTitle')}</h3>

        <fieldset className="flex gap-4 items-end">
          <div className="space-y-1">
            <Label className="text-xs">{t('costCalculator.monteCarlo.scenarios')}</Label>
            <Input
              type="number"
              value={scenarioCount}
              onChange={e => setScenarioCount(Math.max(100, Math.min(50000, Number(e.target.value))))}
              className="w-28 h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('costCalculator.monteCarlo.seed')}</Label>
            <Input
              type="number"
              value={seed}
              onChange={e => setSeed(Number(e.target.value))}
              className="w-24 h-8 text-xs"
            />
          </div>
          <Button onClick={handleRun} disabled={running} size="sm" className="gap-1">
            {running ? <Dices className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {running ? t('costCalculator.monteCarlo.running') : t('costCalculator.monteCarlo.runSimulation')}
          </Button>
        </fieldset>

        {/* Variable config */}
        <section className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">{t('costCalculator.monteCarlo.variablesTitle')}</h4>
          <ul className="space-y-2">
            {variables.map(variable => (
              <li key={variable.key} className="flex items-center gap-3 flex-wrap">
                <Checkbox
                  checked={variable.enabled}
                  onCheckedChange={() => handleToggleVariable(variable.key)}
                  id={`mc-${variable.key}`}
                />
                <label htmlFor={`mc-${variable.key}`} className="text-xs font-medium w-32 cursor-pointer">
                  {getVariableLabel(variable.key, t)}
                </label>
                {variable.enabled && (
                  <>
                    <Select
                      value={variable.distribution}
                      onValueChange={(v) => handleDistributionChange(variable.key, v as MonteCarloDistribution)}
                    >
                      <SelectTrigger className="h-7 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal" className="text-xs">{t('costCalculator.monteCarlo.normal')}</SelectItem>
                        <SelectItem value="triangular" className="text-xs">{t('costCalculator.monteCarlo.triangular')}</SelectItem>
                        <SelectItem value="uniform" className="text-xs">{t('costCalculator.monteCarlo.uniform')}</SelectItem>
                      </SelectContent>
                    </Select>
                    {variable.distribution === 'normal' && (
                      <fieldset className="flex gap-2 items-center">
                        <Label className="text-xs">{t('costCalculator.monteCarlo.stdDev')}</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={variable.stdDev}
                          onChange={e => handleVariableFieldChange(variable.key, 'stdDev', Number(e.target.value))}
                          className="w-20 h-7 text-xs"
                        />
                      </fieldset>
                    )}
                    {(variable.distribution === 'triangular' || variable.distribution === 'uniform') && (
                      <fieldset className="flex gap-2 items-center">
                        <Label className="text-xs">{t('costCalculator.monteCarlo.min')}</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={variable.min}
                          onChange={e => handleVariableFieldChange(variable.key, 'min', Number(e.target.value))}
                          className="w-20 h-7 text-xs"
                        />
                        <Label className="text-xs">{t('costCalculator.monteCarlo.max')}</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={variable.max}
                          onChange={e => handleVariableFieldChange(variable.key, 'max', Number(e.target.value))}
                          className="w-20 h-7 text-xs"
                        />
                      </fieldset>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      </section>

      {/* Results */}
      {mcResult && (
        <section className="space-y-6">
          <header className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{t('costCalculator.monteCarlo.resultsTitle')}</h3>
            <Badge variant="secondary">{mcResult.scenarioCount.toLocaleString()} scenarios</Badge>
          </header>
          <StatisticsCard mcResult={mcResult} t={t} />
          <FanChart mcResult={mcResult} t={t} />
          <HistogramChart mcResult={mcResult} t={t} />
        </section>
      )}
    </article>
  );
}
