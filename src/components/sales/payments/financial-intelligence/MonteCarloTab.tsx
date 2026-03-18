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

import React, { useState, useCallback } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';
import { Info, Play, Dices, BookOpen, Lightbulb, ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InfoLabel, InfoDt } from './InfoLabel';
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
import { FinancialTooltip } from './FinancialTooltip';
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

/** Metric keys that map to help panel dynamic explanations */
type HelpMetricKey = 'meanNpv' | 'p10' | 'p50' | 'p90' | 'stdDev' | 'minMax' | 'probPositive' | 'executionTime';

/** Hovered item — either a result metric or a config variable field */
type HoveredItem =
  | { source: 'metric'; key: HelpMetricKey }
  | { source: 'config'; variable: SensitivityVariable; field: 'main' | 'stdDev' | 'min' | 'max'; value: string };

function StatisticsCard({
  mcResult,
  t,
  onHover,
}: {
  mcResult: MonteCarloResult;
  t: MonteCarloTabProps['t'];
  onHover: (item: HoveredItem | null) => void;
}) {
  const fmt = (v: number) => formatCurrencyWhole(v) ?? '';

  const cardClass =
    'rounded-lg border p-3 space-y-1 transition-colors hover:border-blue-400 hover:bg-blue-50/50 dark:hover:border-blue-600 dark:hover:bg-blue-950/30 cursor-help';

  const enter = (key: HelpMetricKey) => () => onHover({ source: 'metric', key });
  const leave = () => onHover(null);

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <dl className={cardClass} onMouseEnter={enter('meanNpv')} onMouseLeave={leave}>
        <InfoDt label={t('costCalculator.monteCarlo.meanNpv')} tooltip={t('costCalculator.monteCarlo.meanNpvTooltip')} className="text-xs text-muted-foreground" />
        <dd className="text-lg font-bold">{fmt(mcResult.meanNPV)}</dd>
      </dl>
      <dl className={cardClass} onMouseEnter={enter('p10')} onMouseLeave={leave}>
        <InfoDt label={t('costCalculator.monteCarlo.p10')} tooltip={t('costCalculator.monteCarlo.p10Tooltip')} className="text-xs text-muted-foreground" />
        <dd className="text-lg font-bold">{fmt(mcResult.p10)}</dd>
      </dl>
      <dl className={cardClass} onMouseEnter={enter('p50')} onMouseLeave={leave}>
        <InfoDt label={t('costCalculator.monteCarlo.p50')} tooltip={t('costCalculator.monteCarlo.p50Tooltip')} className="text-xs text-muted-foreground" />
        <dd className="text-lg font-bold">{fmt(mcResult.p50)}</dd>
      </dl>
      <dl className={cardClass} onMouseEnter={enter('p90')} onMouseLeave={leave}>
        <InfoDt label={t('costCalculator.monteCarlo.p90')} tooltip={t('costCalculator.monteCarlo.p90Tooltip')} className="text-xs text-muted-foreground" />
        <dd className="text-lg font-bold">{fmt(mcResult.p90)}</dd>
      </dl>
      <dl className={cardClass} onMouseEnter={enter('stdDev')} onMouseLeave={leave}>
        <InfoDt label={t('costCalculator.monteCarlo.stdDevNpv')} tooltip={t('costCalculator.monteCarlo.stdDevNpvTooltip')} className="text-xs text-muted-foreground" />
        <dd className="text-sm font-medium">{fmt(mcResult.stdDevNPV)}</dd>
      </dl>
      <dl className={cardClass} onMouseEnter={enter('minMax')} onMouseLeave={leave}>
        <InfoDt label={t('costCalculator.monteCarlo.minMax')} tooltip={t('costCalculator.monteCarlo.minMaxTooltip')} className="text-xs text-muted-foreground" />
        <dd className="text-sm font-medium">{fmt(mcResult.minNPV)} — {fmt(mcResult.maxNPV)}</dd>
      </dl>
      <dl className={cardClass} onMouseEnter={enter('probPositive')} onMouseLeave={leave}>
        <InfoDt label={t('costCalculator.monteCarlo.probPositive')} tooltip={t('costCalculator.monteCarlo.probPositiveTooltip')} className="text-xs text-muted-foreground" />
        <dd className="text-sm font-medium">{mcResult.probPositive}%</dd>
      </dl>
      <dl className={cardClass} onMouseEnter={enter('executionTime')} onMouseLeave={leave}>
        <InfoDt label={t('costCalculator.monteCarlo.executionTime')} tooltip={t('costCalculator.monteCarlo.executionTimeTooltip')} className="text-xs text-muted-foreground" />
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
          <Tooltip
            content={
              <FinancialTooltip valueFormatter={(value, name) => [fmt(value as number), name]} />
            }
          />
          <Area type="monotone" dataKey="p90" stackId="band" stroke="none" fill="hsl(142, 71%, 45%)" fillOpacity={0.12} name="P90" />
          <Area type="monotone" dataKey="p75" stackId="band2" stroke="none" fill="hsl(142, 71%, 45%)" fillOpacity={0.18} name="P75" />
          <Area type="monotone" dataKey="p50" stackId="band3" stroke="hsl(200, 98%, 39%)" fill="hsl(200, 98%, 39%)" fillOpacity={0.25} strokeWidth={2} name="P50" />
          <Area type="monotone" dataKey="p25" stackId="band4" stroke="none" fill="hsl(25, 95%, 53%)" fillOpacity={0.18} name="P25" />
          <Area type="monotone" dataKey="p10" stackId="band5" stroke="none" fill="hsl(0, 72%, 51%)" fillOpacity={0.12} name="P10" />
        </AreaChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground text-center leading-relaxed">
        {t('costCalculator.monteCarlo.fanChartLegend')}
      </p>
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
          <Tooltip
            content={
              <FinancialTooltip
                labelFormatter={(label) => fmt(label as number)}
                valueFormatter={(value, name) => [
                  `${((value as number) * 100).toFixed(1)}%`,
                  name === 'frequency'
                    ? t('costCalculator.monteCarlo.frequency')
                    : t('costCalculator.monteCarlo.cdf'),
                ]}
              />
            }
          />
          <Bar yAxisId="freq" dataKey="frequency" fill="hsl(200, 98%, 39%)" opacity={0.7} name="frequency" />
          <Line yAxisId="cdf" type="monotone" dataKey="cumulativeFrequency" stroke="hsl(25, 95%, 53%)" strokeWidth={2} dot={false} name="cdf" />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground text-center leading-relaxed">
        {t('costCalculator.monteCarlo.histogramLegend')}
      </p>
    </section>
  );
}

// =============================================================================
// HELP PANEL
// =============================================================================

/** Map metric keys to i18n dynamic explanation keys */
const METRIC_I18N_MAP: Record<HelpMetricKey, string> = {
  meanNpv: 'dynamicMeanNpv',
  p10: 'dynamicP10',
  p50: 'dynamicP50',
  p90: 'dynamicP90',
  stdDev: 'dynamicStdDev',
  minMax: 'dynamicMinMax',
  probPositive: 'dynamicProbPositive',
  executionTime: 'dynamicExecutionTime',
};

/** Map metric keys to display label keys */
const METRIC_LABEL_MAP: Record<HelpMetricKey, string> = {
  meanNpv: 'meanNpv',
  p10: 'p10',
  p50: 'p50',
  p90: 'p90',
  stdDev: 'stdDevNpv',
  minMax: 'minMax',
  probPositive: 'probPositive',
  executionTime: 'executionTime',
};

type RiskLevel = 'low' | 'medium' | 'high';

function assessRisk(mcResult: MonteCarloResult): RiskLevel {
  if (mcResult.p10 > 0 && mcResult.probPositive >= 90) return 'low';
  if (mcResult.meanNPV > 0 && mcResult.probPositive >= 70) return 'medium';
  return 'high';
}

const RISK_ICONS: Record<RiskLevel, React.ReactNode> = {
  low: <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />,
  medium: <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
  high: <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />,
};

const RISK_BORDER: Record<RiskLevel, string> = {
  low: 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/30',
  medium: 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30',
  high: 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30',
};

const RISK_I18N: Record<RiskLevel, string> = {
  low: 'recommendationLowRisk',
  medium: 'recommendationMediumRisk',
  high: 'recommendationHighRisk',
};

/** Config variable i18n key mapping */
const CONFIG_I18N_MAP: Record<SensitivityVariable, string> = {
  discountRate: 'configDiscountRate',
  bankSpread: 'configBankSpread',
  salePrice: 'configSalePrice',
  upfrontPercent: 'configUpfrontPercent',
  paymentMonths: 'configPaymentMonths',
  certaintyMix: 'configCertaintyMix',
};

const CONFIG_FIELD_I18N: Record<string, string> = {
  stdDev: 'configStdDev',
  min: 'configMin',
  max: 'configMax',
};

/** Center panel: dynamic explanation + example + recommendation */
function DynamicHelpPanel({
  hoveredItem,
  mcResult,
  input,
  effectiveRate,
  t,
}: {
  hoveredItem: HoveredItem | null;
  mcResult: MonteCarloResult;
  input: CostCalculationInput;
  effectiveRate: number;
  t: MonteCarloTabProps['t'];
}) {
  const h = (key: string, opts?: Record<string, string>) => t(`costCalculator.monteCarlo.help.${key}`, opts);
  const fmt = (v: number) => formatCurrencyWhole(v) ?? '';
  const riskLevel = assessRisk(mcResult);
  const salePrice = input.salePrice;

  const getMetricValue = (key: HelpMetricKey): string => {
    switch (key) {
      case 'meanNpv': return fmt(mcResult.meanNPV);
      case 'p10': return fmt(mcResult.p10);
      case 'p50': return fmt(mcResult.p50);
      case 'p90': return fmt(mcResult.p90);
      case 'stdDev': return fmt(mcResult.stdDevNPV);
      case 'minMax': return `${fmt(mcResult.minNPV)} — ${fmt(mcResult.maxNPV)}`;
      case 'probPositive': return `${mcResult.probPositive}%`;
      case 'executionTime': return `${mcResult.executionTimeMs}ms`;
    }
  };

  /** Build example text for a metric */
  const getMetricExample = (key: HelpMetricKey): string => {
    const loss = salePrice - mcResult.meanNPV;
    const lossPercent = salePrice > 0 ? ((loss / salePrice) * 100).toFixed(1) : '0';
    const spread = mcResult.maxNPV - mcResult.minNPV;
    const cv = mcResult.meanNPV !== 0
      ? ((mcResult.stdDevNPV / Math.abs(mcResult.meanNPV)) * 100).toFixed(1)
      : '0';
    const positiveCount = Math.round(mcResult.scenarioCount * mcResult.probPositive / 100);
    const negativeCount = mcResult.scenarioCount - positiveCount;

    switch (key) {
      case 'meanNpv':
        return h('exMeanNpv', {
          salePrice: fmt(salePrice),
          meanNpv: fmt(mcResult.meanNPV),
          loss: fmt(loss),
          lossPercent,
        });
      case 'p10':
        return h('exP10', {
          p10: fmt(mcResult.p10),
          loss: fmt(salePrice - mcResult.p10),
        });
      case 'p50':
        return h('exP50', { p50: fmt(mcResult.p50) });
      case 'p90':
        return h('exP90', {
          p90: fmt(mcResult.p90),
          loss: fmt(salePrice - mcResult.p90),
        });
      case 'stdDev':
        return h('exStdDev', {
          stdDev: fmt(mcResult.stdDevNPV),
          meanNpv: fmt(mcResult.meanNPV),
          cv,
        });
      case 'minMax':
        return h('exMinMax', {
          min: fmt(mcResult.minNPV),
          max: fmt(mcResult.maxNPV),
          spread: fmt(spread),
          spreadPercent: salePrice > 0 ? ((spread / salePrice) * 100).toFixed(1) : '0',
        });
      case 'probPositive':
        return h('exProbPositive', {
          scenarios: String(mcResult.scenarioCount),
          positiveCount: String(positiveCount),
          negativeCount: String(negativeCount),
        });
      case 'executionTime':
        return h('exExecutionTime', {
          scenarios: String(mcResult.scenarioCount),
          time: String(mcResult.executionTimeMs),
          perScenario: mcResult.scenarioCount > 0
            ? ((mcResult.executionTimeMs * 1000) / mcResult.scenarioCount).toFixed(1)
            : '0',
        });
    }
  };

  /** Build recommendation for a metric */
  const getMetricRecommendation = (key: HelpMetricKey): string => {
    const lossPercent = salePrice > 0
      ? ((salePrice - mcResult.meanNPV) / salePrice) * 100
      : 0;

    switch (key) {
      case 'meanNpv':
        if (lossPercent < 3) return h('recMeanLow');
        if (lossPercent < 8) return h('recMeanMedium');
        return h('recMeanHigh');
      case 'p10':
        return mcResult.p10 > 0
          ? h('recP10Safe')
          : h('recP10Risky', { p10: fmt(mcResult.p10) });
      case 'p50':
        return mcResult.p50 > salePrice * 0.9
          ? h('recP50Above', { p50: fmt(mcResult.p50) })
          : h('recP50Below');
      case 'p90':
        return h('recP90Warning');
      case 'stdDev': {
        const cv = mcResult.meanNPV !== 0
          ? (mcResult.stdDevNPV / Math.abs(mcResult.meanNPV)) * 100
          : 0;
        return cv < 15 ? h('recStdDevLow') : h('recStdDevHigh');
      }
      case 'minMax':
        return lossPercent < 5 ? h('recMeanLow') : h('recMeanMedium');
      case 'probPositive':
        if (mcResult.probPositive >= 95) return h('recProbHigh');
        if (mcResult.probPositive >= 80) return h('recProbMedium');
        return h('recProbLow');
      case 'executionTime':
        return h('recStdDevLow'); // generic — execution time has no financial recommendation
    }
  };

  /** Build example for a config variable */
  const getConfigExample = (variable: SensitivityVariable, value: string): string => {
    const npv = mcResult.meanNPV;
    const loss = salePrice - npv;
    const lossPercent = salePrice > 0 ? ((loss / salePrice) * 100).toFixed(1) : '0';

    switch (variable) {
      case 'discountRate': {
        const monthlyCost = salePrice * (Number(value) / 100) / 12;
        return h('exConfigDiscountRate', {
          value,
          salePrice: fmt(salePrice),
          monthlyCost: fmt(monthlyCost),
        });
      }
      case 'bankSpread':
        return h('exConfigBankSpread', {
          value,
          effectiveRate: effectiveRate.toFixed(2),
        });
      case 'salePrice':
        return h('exConfigSalePrice', {
          value: fmt(Number(value)),
          npv: fmt(npv),
          loss: fmt(loss),
          lossPercent,
        });
      case 'upfrontPercent': {
        const upfrontAmount = salePrice * (Number(value) / 100);
        return h('exConfigUpfrontPercent', {
          value,
          upfrontAmount: fmt(upfrontAmount),
        });
      }
      case 'paymentMonths':
        return h('exConfigPaymentMonths', { value });
      case 'certaintyMix': {
        const certainPercent = (Number(value) * 100).toFixed(0);
        const uncertainPercent = ((1 - Number(value)) * 100).toFixed(0);
        return h('exConfigCertaintyMix', { value, certainPercent, uncertainPercent });
      }
    }
  };

  /** Build recommendation for a config variable */
  const getConfigRecommendation = (variable: SensitivityVariable): string => {
    switch (variable) {
      case 'discountRate': {
        const saving = salePrice * 0.005 * 0.5; // rough approximation
        return h('recConfigDiscountRate', { saving: fmt(saving) });
      }
      case 'bankSpread':
        return h('recConfigBankSpread');
      case 'salePrice':
        return h('recConfigSalePrice');
      case 'upfrontPercent':
        return h('recConfigUpfrontPercent');
      case 'paymentMonths': {
        const saving = salePrice * (effectiveRate / 100) * (6 / 12);
        return h('recConfigPaymentMonths', { saving: fmt(saving) });
      }
      case 'certaintyMix':
        return h('recConfigCertaintyMix');
    }
  };

  /** Render the 3-section dynamic content */
  const renderDynamicContent = () => {
    if (!hoveredItem) {
      return (
        <p className="text-xs text-muted-foreground italic">
          {h('hoverHint')}
        </p>
      );
    }

    if (hoveredItem.source === 'metric') {
      const { key } = hoveredItem;
      return (
        <article className="space-y-3">
          {/* Section 1: Τι σημαίνει */}
          <section className="space-y-1">
            <p className="text-sm font-medium">
              {t(`costCalculator.monteCarlo.${METRIC_LABEL_MAP[key]}`)}: {getMetricValue(key)}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {h(METRIC_I18N_MAP[key])}
            </p>
          </section>

          {/* Section 2: Παράδειγμα */}
          <section className="space-y-1 border-t border-dashed pt-2">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              {h('exampleTitle')}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {getMetricExample(key)}
            </p>
          </section>

          {/* Section 3: Τι σου προτείνουμε */}
          <section className="space-y-1 border-t border-dashed pt-2">
            <p className="text-xs font-semibold text-green-600 dark:text-green-400">
              {h('recommendTitle')}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {getMetricRecommendation(key)}
            </p>
          </section>
        </article>
      );
    }

    // source === 'config'
    const i18nKey = hoveredItem.field === 'main'
      ? CONFIG_I18N_MAP[hoveredItem.variable]
      : CONFIG_FIELD_I18N[hoveredItem.field];

    return (
      <article className="space-y-3">
        {/* Section 1: Τι σημαίνει */}
        <section className="space-y-1">
          <p className="text-sm font-medium">
            {getVariableLabel(hoveredItem.variable, t)}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {h(i18nKey).replace('{{value}}', hoveredItem.value)}
          </p>
        </section>

        {/* Section 2: Παράδειγμα */}
        {hoveredItem.field === 'main' && (
          <section className="space-y-1 border-t border-dashed pt-2">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              {h('exampleTitle')}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {getConfigExample(hoveredItem.variable, hoveredItem.value)}
            </p>
          </section>
        )}

        {/* Section 3: Τι σου προτείνουμε */}
        {hoveredItem.field === 'main' && (
          <section className="space-y-1 border-t border-dashed pt-2">
            <p className="text-xs font-semibold text-green-600 dark:text-green-400">
              {h('recommendTitle')}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {getConfigRecommendation(hoveredItem.variable)}
            </p>
          </section>
        )}
      </article>
    );
  };

  return (
    <aside className="sticky top-4 space-y-4">
      {/* Dynamic explanation with 3 sections */}
      <section
        className={`rounded-lg border p-4 space-y-3 transition-all duration-200 ${
          hoveredItem ? 'opacity-100' : 'opacity-40'
        }`}
      >
        <header className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <h4 className="text-sm font-semibold">{h('dynamicTitle')}</h4>
        </header>
        {renderDynamicContent()}
      </section>

      {/* Risk recommendation */}
      <section className={`rounded-lg border p-4 space-y-2 ${RISK_BORDER[riskLevel]}`}>
        <header className="flex items-center gap-2">
          {RISK_ICONS[riskLevel]}
          <h4 className="text-sm font-semibold">
            {h(RISK_I18N[riskLevel]).split(':')[0]}
          </h4>
        </header>
        <p className="text-xs leading-relaxed">
          {h(RISK_I18N[riskLevel]).split(':').slice(1).join(':').trim()}
        </p>
      </section>
    </aside>
  );
}

/** Right panel: glossary (always visible) */
function GlossaryPanel({ t }: { t: MonteCarloTabProps['t'] }) {
  const h = (key: string) => t(`costCalculator.monteCarlo.help.${key}`);

  return (
    <aside className="sticky top-4">
      <section className="rounded-lg border p-4 space-y-3">
        <header className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">{h('glossaryTitle')}</h4>
        </header>
        <dl className="space-y-2 text-xs text-muted-foreground leading-relaxed">
          <dd>{h('glossaryDiscountRate')}</dd>
          <dd>{h('glossaryBankSpread')}</dd>
          <dd>{h('glossarySalePrice')}</dd>
          <dd>{h('glossaryUpfrontPercent')}</dd>
          <dd>{h('glossaryPaymentMonths')}</dd>
          <dd>{h('glossaryCertaintyMix')}</dd>
        </dl>
        <hr className="border-dashed" />
        <dl className="space-y-2 text-xs text-muted-foreground leading-relaxed">
          <dd>{h('glossaryNormal')}</dd>
          <dd>{h('glossaryTriangular')}</dd>
          <dd>{h('glossaryUniform')}</dd>
        </dl>
      </section>
    </aside>
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
  const [hoveredItem, setHoveredItem] = useState<HoveredItem | null>(null);

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
            <InfoLabel label={t('costCalculator.monteCarlo.scenarios')} tooltip={t('costCalculator.monteCarlo.scenariosTooltip')} />
            <Input
              type="number"
              value={scenarioCount}
              onChange={e => setScenarioCount(Math.max(100, Math.min(50000, Number(e.target.value))))}
              className="w-28 h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <InfoLabel label={t('costCalculator.monteCarlo.seed')} tooltip={t('costCalculator.monteCarlo.seedTooltip')} />
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
              <li
                key={variable.key}
                className="flex items-center gap-3 flex-wrap rounded p-1 transition-colors hover:bg-muted/30 cursor-help"
                onMouseEnter={() => setHoveredItem({
                  source: 'config',
                  variable: variable.key,
                  field: 'main',
                  value: String(variable.mean),
                })}
                onMouseLeave={() => setHoveredItem(null)}
              >
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
                      <fieldset
                        className="flex gap-2 items-center"
                        onMouseEnter={(e) => {
                          e.stopPropagation();
                          setHoveredItem({
                            source: 'config',
                            variable: variable.key,
                            field: 'stdDev',
                            value: String(variable.stdDev),
                          });
                        }}
                      >
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
                        <span
                          className="flex gap-2 items-center"
                          onMouseEnter={(e) => {
                            e.stopPropagation();
                            setHoveredItem({
                              source: 'config',
                              variable: variable.key,
                              field: 'min',
                              value: String(variable.min),
                            });
                          }}
                        >
                          <Label className="text-xs">{t('costCalculator.monteCarlo.min')}</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={variable.min}
                            onChange={e => handleVariableFieldChange(variable.key, 'min', Number(e.target.value))}
                            className="w-20 h-7 text-xs"
                          />
                        </span>
                        <span
                          className="flex gap-2 items-center"
                          onMouseEnter={(e) => {
                            e.stopPropagation();
                            setHoveredItem({
                              source: 'config',
                              variable: variable.key,
                              field: 'max',
                              value: String(variable.max),
                            });
                          }}
                        >
                          <Label className="text-xs">{t('costCalculator.monteCarlo.max')}</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={variable.max}
                            onChange={e => handleVariableFieldChange(variable.key, 'max', Number(e.target.value))}
                            className="w-20 h-7 text-xs"
                          />
                        </span>
                      </fieldset>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      </section>

      {/* Results — 3-column: results | dynamic+risk | glossary */}
      {mcResult && (
        <section className="grid lg:grid-cols-4 gap-6">
          {/* Left: statistics + charts */}
          <section className="lg:col-span-2 space-y-6">
            <header className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{t('costCalculator.monteCarlo.resultsTitle')}</h3>
              <Badge variant="secondary">{mcResult.scenarioCount.toLocaleString()} scenarios</Badge>
            </header>
            <StatisticsCard mcResult={mcResult} t={t} onHover={setHoveredItem} />
            <FanChart mcResult={mcResult} t={t} />
            <HistogramChart mcResult={mcResult} t={t} />
          </section>

          {/* Center: dynamic explanation + example + recommendation */}
          <DynamicHelpPanel hoveredItem={hoveredItem} mcResult={mcResult} input={input} effectiveRate={effectiveRate} t={t} />

          {/* Right: glossary */}
          <GlossaryPanel t={t} />
        </section>
      )}
    </article>
  );
}
