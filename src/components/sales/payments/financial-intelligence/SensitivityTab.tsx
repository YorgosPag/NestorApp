'use client';

/**
 * SensitivityTab — tornado chart and a two-variable heat map.
 *
 * Which inputs move NPV the most, and what NPV looks like across a grid of two of
 * them. The tornado renders through the ADR-710 chart card shell; the heat map is an
 * HTML table with bucketed cell classes, not a plot, so it stays as it is.
 *
 * The literal red/green pair the bars used to carry is now `chartPolarityColor`: the
 * sign of a delta is the meaning, and the shell owns the mapping from meaning to ink.
 *
 * @enterprise ADR-242 SPEC-242A — Sensitivity Analysis
 * @enterprise ADR-710 — Chart card shell
 */

import { useCallback, useMemo, useState } from 'react';
import { BarChart, Bar, ReferenceLine, Cell } from 'recharts';
import { Info, HelpCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Tooltip as RadixTooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CHART_POLARITY_COLORS,
  ChartCard,
  chartPolarityColor,
  chartPolarityTone,
  type ChartSeries,
} from '@/components/ui/chart-card';

import { runTornadoAnalysis, buildHeatMap } from '@/lib/sensitivity-engine';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import { financialAxisFrame } from './financial-chart-axes';
import type {
  CostCalculationInput,
  CostCalculationResult,
  SensitivityVariable,
} from '@/types/interest-calculator';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// =============================================================================
// TYPES
// =============================================================================

interface SensitivityTabProps {
  input: CostCalculationInput;
  effectiveRate: number;
  result: CostCalculationResult;
  t: (key: string, opts?: Record<string, string>) => string;
}

// =============================================================================
// HELPERS
// =============================================================================

const VARIABLE_OPTIONS: SensitivityVariable[] = [
  'discountRate',
  'bankSpread',
  'salePrice',
  'upfrontPercent',
  'paymentMonths',
  'certaintyMix',
];

function getVariableLabel(variable: SensitivityVariable, t: SensitivityTabProps['t']): string {
  const keyMap: Record<SensitivityVariable, string> = {
    discountRate: 'costCalculator.sensitivity.varDiscountRate',
    bankSpread: 'costCalculator.sensitivity.varBankSpread',
    salePrice: 'costCalculator.sensitivity.varSalePrice',
    upfrontPercent: 'costCalculator.sensitivity.varUpfrontPercent',
    paymentMonths: 'costCalculator.sensitivity.varPaymentMonths',
    certaintyMix: 'costCalculator.sensitivity.varCertaintyMix',
  };
  return t(keyMap[variable]);
}

// =============================================================================
// TORNADO CHART
// =============================================================================

interface TornadoChartData {
  variable: string;
  lowDelta: number;
  highDelta: number;
}

/** More NPV is the good outcome, so a positive delta is the good sign. */
const NPV_POLARITY = 'higher-is-better';

function TornadoChart({
  input,
  effectiveRate,
  t,
}: {
  input: CostCalculationInput;
  effectiveRate: number;
  t: SensitivityTabProps['t'];
}) {
  const colors = useSemanticColors();
  const analysis = useMemo(
    () => runTornadoAnalysis(input, effectiveRate),
    [input, effectiveRate]
  );

  const chartData = useMemo<TornadoChartData[]>(
    () =>
      analysis.entries.map((entry) => ({
        variable: t(entry.label),
        lowDelta: entry.lowNPV - analysis.baseNPV,
        highDelta: entry.highNPV - analysis.baseNPV,
      })),
    [analysis, t],
  );

  const series = useMemo<ChartSeries<TornadoChartData>[]>(
    () => [
      { key: 'lowDelta', label: t('costCalculator.sensitivity.low') },
      { key: 'highDelta', label: t('costCalculator.sensitivity.high') },
    ],
    [t],
  );

  /** A delta reads as a movement, so it keeps its sign in both directions. */
  const formatDelta = useCallback(
    (value: number) => `${value > 0 ? '+' : ''}${formatCurrencyWhole(value)}`,
    [],
  );

  return (
    <ChartCard
      series={series}
      data={chartData}
      categoryKey="variable"
      categoryLabel={t('costCalculator.sensitivity.variable')}
      categoryDescription={t('costCalculator.sensitivity.variableTooltip')}
      formatValue={formatDelta}
    >
      <ChartCard.Header title={t('costCalculator.sensitivity.tornadoTitle')}>
        <RadixTooltip>
          <TooltipTrigger asChild>
            <HelpCircle className={cn('h-3.5 w-3.5 cursor-help', colors.text.muted)} />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            {t('costCalculator.sensitivity.tornadoTitleTooltip')}
          </TooltipContent>
        </RadixTooltip>
      </ChartCard.Header>

      <ChartCard.Summary>
        <ChartCard.SummaryItem
          label={t('costCalculator.sensitivity.baseNpv')}
          value={formatCurrencyWhole(analysis.baseNPV)}
          tone={chartPolarityTone(analysis.baseNPV, NPV_POLARITY)}
        />
      </ChartCard.Summary>

      <ChartCard.Figure
        caption={t('costCalculator.sensitivity.tornadoCaption')}
        emptyMessage={t('costCalculator.sensitivity.tornadoEmptyState')}
        size="lg"
      >
        <BarChart layout="vertical" data={chartData} margin={{ left: 100 }}>
          {financialAxisFrame({
            categoryKey: 'variable',
            layout: 'vertical',
            formatValueTick: formatDelta,
          })}
          <ReferenceLine
            x={0}
            stroke={CHART_POLARITY_COLORS.neutral}
            strokeDasharray="3 3"
          />
          <Bar dataKey="lowDelta" stackId="delta">
            {chartData.map((entry) => (
              <Cell
                key={`low-${entry.variable}`}
                fill={chartPolarityColor(entry.lowDelta, NPV_POLARITY)}
              />
            ))}
          </Bar>
          <Bar dataKey="highDelta" stackId="delta">
            {chartData.map((entry) => (
              <Cell
                key={`high-${entry.variable}`}
                fill={chartPolarityColor(entry.highDelta, NPV_POLARITY)}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartCard.Figure>
    </ChartCard>
  );
}

// =============================================================================
// HEAT MAP
// =============================================================================

/**
 * One axis of the heat map. The two axes are the same control with a different label
 * and a different variable withheld — the one already taken by the other axis, which
 * is why `excluded` is a parameter and not a filter each call-site repeats.
 */
function VariablePicker({
  labelKey,
  value,
  onChange,
  excluded,
  t,
}: {
  readonly labelKey: 'rowVariable' | 'colVariable';
  readonly value: SensitivityVariable;
  readonly onChange: (next: SensitivityVariable) => void;
  readonly excluded: SensitivityVariable;
  readonly t: SensitivityTabProps['t'];
}) {
  const colors = useSemanticColors();

  return (
    <div className="flex-1 space-y-1">
      <span className="inline-flex items-center gap-1">
        <Label className="text-xs">{t(`costCalculator.sensitivity.${labelKey}`)}</Label>
        <RadixTooltip>
          <TooltipTrigger asChild>
            <HelpCircle className={cn('h-3 w-3 cursor-help', colors.text.muted)} />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            {t(`costCalculator.sensitivity.${labelKey}Tooltip`)}
          </TooltipContent>
        </RadixTooltip>
      </span>
      <Select value={value} onValueChange={(next) => onChange(next as SensitivityVariable)}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {VARIABLE_OPTIONS.filter((option) => option !== excluded).map((option) => (
            <SelectItem key={option} value={option} className="text-xs">
              {getVariableLabel(option, t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function HeatMap({
  input,
  effectiveRate,
  t,
}: {
  input: CostCalculationInput;
  effectiveRate: number;
  t: SensitivityTabProps['t'];
}) {
  const colors = useSemanticColors();
  const [rowVar, setRowVar] = useState<SensitivityVariable>('discountRate');
  const [colVar, setColVar] = useState<SensitivityVariable>('salePrice');

  const heatMapData = useMemo(
    () => buildHeatMap(input, effectiveRate, rowVar, colVar, 5),
    [input, effectiveRate, rowVar, colVar]
  );

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold inline-flex items-center gap-1">
        {t('costCalculator.sensitivity.heatMapTitle')}
        <RadixTooltip>
          <TooltipTrigger asChild>
            <HelpCircle className={cn("h-3.5 w-3.5 cursor-help", colors.text.muted)} />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            {t('costCalculator.sensitivity.heatMapTitleTooltip')}
          </TooltipContent>
        </RadixTooltip>
      </h3>

      {/* Variable selectors — the two axes of the grid, same control both times. */}
      <fieldset className="flex gap-4">
        <VariablePicker
          labelKey="rowVariable"
          value={rowVar}
          onChange={setRowVar}
          excluded={colVar}
          t={t}
        />
        <VariablePicker
          labelKey="colVariable"
          value={colVar}
          onChange={setColVar}
          excluded={rowVar}
          t={t}
        />
      </fieldset>

      {/* Heat map table */}
      <figure className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className={cn("p-1.5 text-left font-medium border border-border", colors.text.muted)}>
                {getVariableLabel(rowVar, t)} \ {getVariableLabel(colVar, t)}
              </th>
              {heatMapData.colValues.map((cv, ci) => (
                <th key={ci} className={cn("p-1.5 text-center font-medium border border-border", colors.text.muted)}>
                  {cv.toFixed(1)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatMapData.cells.map((row, ri) => (
              <tr key={ri}>
                <th className={cn("p-1.5 text-left font-medium border border-border", colors.text.muted)}>
                  {heatMapData.rowValues[ri].toFixed(1)}
                </th>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`p-1.5 text-center font-mono border border-border heatmap-cell-${cell.bucket}`}
                  >
                    {formatCurrencyWhole(cell.npv)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </figure>
    </section>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function SensitivityTab({ input, effectiveRate, result: _result, t }: SensitivityTabProps) {
  return (
    <article className="space-y-6">
      {/* Info banner */}
      <section className="flex gap-2 rounded-lg border border-primary/30 bg-[hsl(var(--bg-info))]/20 p-3">
        <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm text-foreground leading-relaxed">
          {t('costCalculator.sensitivity.infoBanner')}
        </p>
      </section>

      {/* Tornado chart */}
      <TornadoChart input={input} effectiveRate={effectiveRate} t={t} />

      {/* Heat map */}
      <HeatMap input={input} effectiveRate={effectiveRate} t={t} />
    </article>
  );
}
