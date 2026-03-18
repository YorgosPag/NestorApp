'use client';

/**
 * CounterproposalTab — Discount-for-Speed Analysis
 *
 * Internal builder tool: "How much discount can I offer for faster payment
 * and still come out ahead vs. the current installment plan?"
 *
 * Sections:
 *   1. Info Banner — explains what this tab does
 *   2. Key Insight Card — dynamic sweet spot recommendation
 *   3. Comparison Table — baseline + 3 alternatives
 *   4. Negotiation Slider — interactive upfront % / months
 *   5. Bar Chart — savings / discount / gain per scenario
 *   6. Builder Retain Ratio selector
 *
 * @enterprise ADR-234 — Counterproposal Tab (SPEC-234F)
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Info, Lightbulb, Handshake } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

import { InfoLabel, InfoDt, InfoTableHead } from './InfoLabel';
import { FinancialTooltip } from './FinancialTooltip';
import {
  runCounterproposalAnalysis,
  calculateSliderScenario,
} from '@/lib/counterproposal-engine';
import { calculateFullResult } from '@/lib/npv-engine';
import type {
  CostCalculationInput,
  CostCalculationResult,
  CounterproposalScenario,
  CounterproposalResult,
} from '@/types/interest-calculator';

// =============================================================================
// TYPES
// =============================================================================

interface CounterproposalTabProps {
  input: CostCalculationInput;
  effectiveRate: number;
  result: CostCalculationResult;
  t: (key: string, opts?: Record<string, string>) => string;
}

// =============================================================================
// HELPERS
// =============================================================================

function fmtCurrency(value: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function fmtPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

const RETAIN_OPTIONS = [
  { value: '0.30', label: '30%' },
  { value: '0.35', label: '35%' },
  { value: '0.40', label: '40%' },
  { value: '0.50', label: '50%' },
] as const;

// =============================================================================
// COMPONENT
// =============================================================================

export function CounterproposalTab({
  input,
  effectiveRate,
  result,
  t,
}: CounterproposalTabProps) {
  // --- State ---
  const [builderRetainRatio, setBuilderRetainRatio] = useState(0.35);

  // Derive initial slider values from current plan
  const initialUpfront = useMemo(() => {
    const first = input.cashFlows[0];
    if (!first) return 20;
    return Math.round((first.amount / input.salePrice) * 100);
  }, [input]);

  const initialMonths = useMemo(() => {
    if (input.cashFlows.length <= 1) return 12;
    const last = input.cashFlows[input.cashFlows.length - 1];
    const refMs = new Date(input.referenceDate).getTime();
    const lastMs = new Date(last.date).getTime();
    return Math.max(1, Math.round((lastMs - refMs) / (1000 * 60 * 60 * 24 * 30.44)));
  }, [input]);

  const [sliderUpfront, setSliderUpfront] = useState(initialUpfront);
  const [sliderMonths, setSliderMonths] = useState(initialMonths);

  // --- Analysis ---
  const analysis: CounterproposalResult = useMemo(
    () => runCounterproposalAnalysis(input, effectiveRate, builderRetainRatio),
    [input, effectiveRate, builderRetainRatio]
  );

  const sweetSpot = analysis.alternatives[analysis.sweetSpotIndex];

  // --- Slider scenario ---
  const sliderScenario = useMemo(
    () =>
      calculateSliderScenario(
        input.salePrice,
        input.referenceDate,
        effectiveRate,
        { upfrontPercent: sliderUpfront, remainingMonths: sliderMonths },
        analysis.baseline.timeCost,
        builderRetainRatio
      ),
    [input, effectiveRate, sliderUpfront, sliderMonths, analysis.baseline.timeCost, builderRetainRatio]
  );

  // --- Chart data ---
  const chartData = useMemo(() => {
    const scenarios = [analysis.baseline, ...analysis.alternatives];
    return scenarios.map((s, i) => ({
      name: t(s.nameKey),
      saving: s.timeCostSaved,
      discount: s.suggestedDiscount,
      gain: s.builderNetGain,
      isSweetSpot: i === analysis.sweetSpotIndex + 1, // +1 because baseline is index 0
      isBaseline: i === 0,
    }));
  }, [analysis, t]);

  // --- Handlers ---
  const handleRetainChange = useCallback((value: string) => {
    setBuilderRetainRatio(parseFloat(value));
  }, []);

  const handleUpfrontChange = useCallback((value: number[]) => {
    setSliderUpfront(value[0]);
  }, []);

  const handleMonthsChange = useCallback((value: number[]) => {
    setSliderMonths(value[0]);
  }, []);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <section className="space-y-5">
      {/* 1. Info Banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
        <div className="flex gap-2">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-xs text-blue-800 dark:text-blue-300">
            {t('costCalculator.counterproposal.infoBanner')}
          </p>
        </div>
      </div>

      {/* 2. Key Insight Card */}
      {sweetSpot && sweetSpot.builderNetGain > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/30">
          <div className="flex gap-2">
            <Lightbulb className="h-4 w-4 mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
            <p className="text-xs text-green-800 dark:text-green-300">
              {t('costCalculator.counterproposal.insightCard', {
                upfront: String(sweetSpot.upfrontPercent),
                months: String(sweetSpot.remainingMonths),
                discount: fmtCurrency(sweetSpot.suggestedDiscount),
                discountPercent: fmtPercent(sweetSpot.suggestedDiscountPercent),
                gain: fmtCurrency(sweetSpot.builderNetGain),
              })}
            </p>
          </div>
        </div>
      )}

      {/* 6. Builder Retain Ratio — placed near top for easy access */}
      <div className="flex items-center gap-3">
        <InfoLabel
          label={t('costCalculator.counterproposal.retainRatioLabel')}
          tooltip={t('costCalculator.counterproposal.retainRatioTooltip')}
        />
        <Select value={String(builderRetainRatio)} onValueChange={handleRetainChange}>
          <SelectTrigger className="w-24 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RETAIN_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 3. Comparison Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <InfoTableHead
                label={t('costCalculator.counterproposal.table.scenario')}
                tooltip={t('costCalculator.counterproposal.table.scenarioTooltip')}
              />
              <InfoTableHead
                label={t('costCalculator.counterproposal.table.upfront')}
                tooltip={t('costCalculator.counterproposal.table.upfrontTooltip')}
                className="text-right"
              />
              <InfoTableHead
                label={t('costCalculator.counterproposal.table.npv')}
                tooltip={t('costCalculator.counterproposal.table.npvTooltip')}
                className="text-right"
              />
              <InfoTableHead
                label={t('costCalculator.counterproposal.table.saving')}
                tooltip={t('costCalculator.counterproposal.table.savingTooltip')}
                className="text-right"
              />
              <InfoTableHead
                label={t('costCalculator.counterproposal.table.maxDiscount')}
                tooltip={t('costCalculator.counterproposal.table.maxDiscountTooltip')}
                className="text-right"
              />
              <InfoTableHead
                label={t('costCalculator.counterproposal.table.suggestedDiscount')}
                tooltip={t('costCalculator.counterproposal.table.suggestedDiscountTooltip')}
                className="text-right"
              />
              <InfoTableHead
                label={t('costCalculator.counterproposal.table.finalPrice')}
                tooltip={t('costCalculator.counterproposal.table.finalPriceTooltip')}
                className="text-right"
              />
              <InfoTableHead
                label={t('costCalculator.counterproposal.table.netGain')}
                tooltip={t('costCalculator.counterproposal.table.netGainTooltip')}
                className="text-right"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Baseline row */}
            <ScenarioRow
              scenario={analysis.baseline}
              variant="baseline"
              t={t}
            />
            {/* Alternative rows */}
            {analysis.alternatives.map((alt, i) => (
              <ScenarioRow
                key={i}
                scenario={alt}
                variant={i === analysis.sweetSpotIndex ? 'sweetSpot' : 'default'}
                t={t}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 4. Negotiation Slider */}
      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Handshake className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">
            {t('costCalculator.counterproposal.slider.title')}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Upfront % slider */}
          <div className="space-y-2">
            <InfoLabel
              label={t('costCalculator.counterproposal.slider.upfrontLabel', {
                value: String(sliderUpfront),
              })}
              tooltip={t('costCalculator.counterproposal.slider.upfrontTooltip')}
            />
            <Slider
              value={[sliderUpfront]}
              onValueChange={handleUpfrontChange}
              min={10}
              max={100}
              step={5}
              className="w-full"
            />
          </div>

          {/* Remaining months slider */}
          <div className="space-y-2">
            <InfoLabel
              label={t('costCalculator.counterproposal.slider.monthsLabel', {
                value: String(sliderMonths),
              })}
              tooltip={t('costCalculator.counterproposal.slider.monthsTooltip')}
            />
            <Slider
              value={[sliderMonths]}
              onValueChange={handleMonthsChange}
              min={0}
              max={24}
              step={1}
              className="w-full"
            />
          </div>
        </div>

        {/* Slider results */}
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <InfoDt
              label={t('costCalculator.counterproposal.slider.npv')}
              tooltip={t('costCalculator.counterproposal.slider.npvTooltip')}
              className="text-xs text-muted-foreground"
            />
            <dd className="font-mono font-medium tabular-nums">{fmtCurrency(sliderScenario.npv)}</dd>
          </div>
          <div>
            <InfoDt
              label={t('costCalculator.counterproposal.slider.saving')}
              tooltip={t('costCalculator.counterproposal.slider.savingTooltip')}
              className="text-xs text-muted-foreground"
            />
            <dd className="font-mono font-medium tabular-nums text-green-600 dark:text-green-400">
              {fmtCurrency(sliderScenario.timeCostSaved)}
            </dd>
          </div>
          <div>
            <InfoDt
              label={t('costCalculator.counterproposal.slider.discount')}
              tooltip={t('costCalculator.counterproposal.slider.discountTooltip')}
              className="text-xs text-muted-foreground"
            />
            <dd className="font-mono font-medium tabular-nums text-amber-600 dark:text-amber-400">
              {fmtCurrency(sliderScenario.suggestedDiscount)} ({fmtPercent(sliderScenario.suggestedDiscountPercent)})
            </dd>
          </div>
          <div>
            <InfoDt
              label={t('costCalculator.counterproposal.slider.netGain')}
              tooltip={t('costCalculator.counterproposal.slider.netGainTooltip')}
              className="text-xs text-muted-foreground"
            />
            <dd className="font-mono font-medium tabular-nums text-blue-600 dark:text-blue-400">
              {fmtCurrency(sliderScenario.builderNetGain)}
            </dd>
          </div>
        </dl>
      </div>

      {/* 5. Bar Chart */}
      <div className="rounded-lg border p-4 space-y-2">
        <h3 className="text-sm font-medium">
          {t('costCalculator.counterproposal.chart.title')}
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
                tickFormatter={(v: number) => `€${Math.round(v / 1000)}k`}
              />
              <Tooltip
                content={
                  <FinancialTooltip
                    valueFormatter={(value, name) => [
                      fmtCurrency(Number(value)),
                      name,
                    ]}
                  />
                }
              />
              <Bar
                dataKey="saving"
                name={t('costCalculator.counterproposal.chart.saving')}
                fill="hsl(var(--chart-2))"
                radius={[2, 2, 0, 0]}
              />
              <Bar
                dataKey="discount"
                name={t('costCalculator.counterproposal.chart.discount')}
                fill="hsl(var(--chart-4))"
                radius={[2, 2, 0, 0]}
              />
              <Bar
                dataKey="gain"
                name={t('costCalculator.counterproposal.chart.gain')}
                fill="hsl(var(--chart-1))"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function ScenarioRow({
  scenario,
  variant,
  t,
}: {
  scenario: CounterproposalScenario;
  variant: 'baseline' | 'sweetSpot' | 'default';
  t: (key: string, opts?: Record<string, string>) => string;
}) {
  const rowClass =
    variant === 'sweetSpot'
      ? 'bg-green-50 dark:bg-green-950/20'
      : variant === 'baseline'
        ? 'bg-muted/40'
        : '';

  return (
    <TableRow className={rowClass}>
      <TableCell className="font-medium text-xs">
        <span className="flex items-center gap-1.5">
          {t(scenario.nameKey)}
          {variant === 'sweetSpot' && (
            <Badge variant="outline" className="text-[10px] border-green-500 text-green-700 dark:text-green-400">
              {t('costCalculator.counterproposal.badges.sweetSpot')}
            </Badge>
          )}
          {variant === 'baseline' && (
            <Badge variant="secondary" className="text-[10px]">
              {t('costCalculator.counterproposal.badges.baseline')}
            </Badge>
          )}
        </span>
      </TableCell>
      <TableCell className="text-right text-xs font-mono tabular-nums">
        {scenario.upfrontPercent}%
        {scenario.remainingMonths > 0 && (
          <span className="text-muted-foreground ml-1">
            + {scenario.remainingMonths}{t('costCalculator.counterproposal.table.monthsAbbr')}
          </span>
        )}
      </TableCell>
      <TableCell className="text-right text-xs font-mono tabular-nums">
        {fmtCurrency(scenario.npv)}
      </TableCell>
      <TableCell className="text-right text-xs font-mono tabular-nums text-green-600 dark:text-green-400">
        {scenario.timeCostSaved > 0 ? fmtCurrency(scenario.timeCostSaved) : '—'}
      </TableCell>
      <TableCell className="text-right text-xs font-mono tabular-nums">
        {scenario.maxDiscount > 0
          ? `${fmtCurrency(scenario.maxDiscount)} (${fmtPercent(scenario.maxDiscountPercent)})`
          : '—'}
      </TableCell>
      <TableCell className="text-right text-xs font-mono tabular-nums text-amber-600 dark:text-amber-400">
        {scenario.suggestedDiscount > 0
          ? `${fmtCurrency(scenario.suggestedDiscount)} (${fmtPercent(scenario.suggestedDiscountPercent)})`
          : '—'}
      </TableCell>
      <TableCell className="text-right text-xs font-mono tabular-nums font-medium">
        {fmtCurrency(scenario.finalPrice)}
      </TableCell>
      <TableCell className="text-right text-xs font-mono tabular-nums text-blue-600 dark:text-blue-400 font-medium">
        {scenario.builderNetGain > 0
          ? `${fmtCurrency(scenario.builderNetGain)} (${fmtPercent(scenario.builderNetGainPercent)})`
          : '—'}
      </TableCell>
    </TableRow>
  );
}
