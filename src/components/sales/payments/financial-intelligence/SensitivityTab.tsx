'use client';

/**
 * SensitivityTab — Tornado Chart & 2-Variable Heat Map
 *
 * Shows which variables have the most impact on NPV,
 * plus a 2D heat map for interactive exploration.
 *
 * @enterprise ADR-242 SPEC-242A - Sensitivity Analysis
 */

import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import { Info } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

import { runTornadoAnalysis, buildHeatMap } from '@/lib/sensitivity-engine';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import { FinancialTooltip } from './FinancialTooltip';
import type {
  CostCalculationInput,
  CostCalculationResult,
  SensitivityVariable,
} from '@/types/interest-calculator';

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
  lowNPV: number;
  highNPV: number;
}

function TornadoChart({
  input,
  effectiveRate,
  t,
}: {
  input: CostCalculationInput;
  effectiveRate: number;
  t: SensitivityTabProps['t'];
}) {
  const analysis = useMemo(
    () => runTornadoAnalysis(input, effectiveRate),
    [input, effectiveRate]
  );

  const chartData: TornadoChartData[] = analysis.entries.map((entry) => ({
    variable: t(entry.label),
    lowDelta: entry.lowNPV - analysis.baseNPV,
    highDelta: entry.highNPV - analysis.baseNPV,
    lowNPV: entry.lowNPV,
    highNPV: entry.highNPV,
  }));

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">
        {t('costCalculator.sensitivity.tornadoTitle')}
      </h3>
      <p className="text-xs text-muted-foreground">
        {t('costCalculator.sensitivity.baseNpv')}: {formatCurrencyWhole(analysis.baseNPV)}
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            tickFormatter={(v: number) => `${v >= 0 ? '+' : ''}${formatCurrencyWhole(v)}`}
          />
          <YAxis
            type="category"
            dataKey="variable"
            width={110}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            content={
              <FinancialTooltip
                valueFormatter={(value, name) => [
                  formatCurrencyWhole(value as number),
                  name === 'lowDelta'
                    ? t('costCalculator.sensitivity.low')
                    : t('costCalculator.sensitivity.high'),
                ]}
              />
            }
          />
          <ReferenceLine x={0} stroke="#666" strokeDasharray="3 3" />
          <Bar dataKey="lowDelta" stackId="a" name="lowDelta">
            {chartData.map((entry, i) => (
              <Cell
                key={`low-${i}`}
                fill={entry.lowDelta < 0 ? 'hsl(0, 72%, 51%)' : 'hsl(142, 71%, 45%)'}
              />
            ))}
          </Bar>
          <Bar dataKey="highDelta" stackId="a" name="highDelta">
            {chartData.map((entry, i) => (
              <Cell
                key={`high-${i}`}
                fill={entry.highDelta < 0 ? 'hsl(0, 72%, 51%)' : 'hsl(142, 71%, 45%)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}

// =============================================================================
// HEAT MAP
// =============================================================================

function HeatMap({
  input,
  effectiveRate,
  t,
}: {
  input: CostCalculationInput;
  effectiveRate: number;
  t: SensitivityTabProps['t'];
}) {
  const [rowVar, setRowVar] = useState<SensitivityVariable>('discountRate');
  const [colVar, setColVar] = useState<SensitivityVariable>('salePrice');

  const heatMapData = useMemo(
    () => buildHeatMap(input, effectiveRate, rowVar, colVar, 5),
    [input, effectiveRate, rowVar, colVar]
  );

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">
        {t('costCalculator.sensitivity.heatMapTitle')}
      </h3>

      {/* Variable selectors */}
      <fieldset className="flex gap-4">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">
            {t('costCalculator.sensitivity.rowVariable')}
          </Label>
          <Select value={rowVar} onValueChange={(v) => setRowVar(v as SensitivityVariable)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VARIABLE_OPTIONS.filter((v) => v !== colVar).map((v) => (
                <SelectItem key={v} value={v} className="text-xs">
                  {getVariableLabel(v, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1">
          <Label className="text-xs">
            {t('costCalculator.sensitivity.colVariable')}
          </Label>
          <Select value={colVar} onValueChange={(v) => setColVar(v as SensitivityVariable)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VARIABLE_OPTIONS.filter((v) => v !== rowVar).map((v) => (
                <SelectItem key={v} value={v} className="text-xs">
                  {getVariableLabel(v, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </fieldset>

      {/* Heat map table */}
      <figure className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="p-1.5 text-left font-medium text-muted-foreground border border-border">
                {getVariableLabel(rowVar, t)} \ {getVariableLabel(colVar, t)}
              </th>
              {heatMapData.colValues.map((cv, ci) => (
                <th key={ci} className="p-1.5 text-center font-medium text-muted-foreground border border-border">
                  {cv.toFixed(1)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatMapData.cells.map((row, ri) => (
              <tr key={ri}>
                <th className="p-1.5 text-left font-medium text-muted-foreground border border-border">
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

export function SensitivityTab({ input, effectiveRate, result, t }: SensitivityTabProps) {
  return (
    <article className="space-y-6">
      {/* Info banner */}
      <section className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-3">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
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
