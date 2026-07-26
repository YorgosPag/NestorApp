'use client';

/**
 * CounterproposalTab — discount-for-speed analysis.
 *
 * "How much discount can I offer for faster payment and still come out ahead of the
 * current installment plan?" The tab owns the model — retain ratio, slider position,
 * the analysis — and composes four pieces: the two banners, the scenario table, the
 * negotiation panel (`counterproposal-negotiation.tsx`) and the savings chart
 * (`counterproposal-chart.tsx`), which goes through the ADR-710 card shell.
 *
 * @enterprise ADR-234 SPEC-234F — Counterproposal Tab
 * @enterprise ADR-710 — Chart card shell
 */

import { useState, useMemo, useCallback } from 'react';
import { Info, Lightbulb } from 'lucide-react';
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
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { InfoLabel, InfoTableHead } from '@/components/ui/InfoLabel';
import { ScenarioRow } from './CounterproposalScenarioRow';
import { CounterproposalNegotiation } from './counterproposal-negotiation';
import {
  CounterproposalChart,
  type CounterproposalScenarioPoint,
} from './counterproposal-chart';
import {
  runCounterproposalAnalysis,
  calculateSliderScenario,
} from '@/lib/counterproposal-engine';
import { formatCurrencyWhole, formatPercentage } from '@/lib/intl-utils';
import type {
  CostCalculationInput,
  CostCalculationResult,
  CounterproposalResult,
} from '@/types/interest-calculator';
import '@/lib/design-system';

// =============================================================================
// TYPES
// =============================================================================

type TranslateFn = (key: string, opts?: Record<string, string>) => string;

interface CounterproposalTabProps {
  input: CostCalculationInput;
  effectiveRate: number;
  result: CostCalculationResult;
  t: TranslateFn;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const RETAIN_OPTIONS = ['0.30', '0.35', '0.40', '0.50'] as const;

const DEFAULT_RETAIN_RATIO = 0.35;

/** Columns of the comparison table, in render order — label key implies tooltip key. */
const TABLE_COLUMNS = [
  'scenario',
  'upfront',
  'npv',
  'saving',
  'maxDiscount',
  'suggestedDiscount',
  'finalPrice',
  'netGain',
] as const;

const MS_PER_AVERAGE_MONTH = 1000 * 60 * 60 * 24 * 30.44;

const FALLBACK_UPFRONT_PERCENT = 20;
const FALLBACK_MONTHS = 12;

// =============================================================================
// DERIVATIONS
// =============================================================================

/** The upfront share the current plan already asks for. */
function readCurrentUpfront(input: CostCalculationInput): number {
  const first = input.cashFlows[0];
  if (!first) return FALLBACK_UPFRONT_PERCENT;
  return Math.round((first.amount / input.salePrice) * 100);
}

/** How long the current plan runs, in months from the reference date. */
function readCurrentMonths(input: CostCalculationInput): number {
  if (input.cashFlows.length <= 1) return FALLBACK_MONTHS;
  const last = input.cashFlows[input.cashFlows.length - 1];
  const elapsed = new Date(last.date).getTime() - new Date(input.referenceDate).getTime();
  return Math.max(1, Math.round(elapsed / MS_PER_AVERAGE_MONTH));
}

function buildChartData(
  analysis: CounterproposalResult,
  t: TranslateFn,
): CounterproposalScenarioPoint[] {
  return [analysis.baseline, ...analysis.alternatives].map((scenario) => ({
    name: t(scenario.nameKey),
    saving: scenario.timeCostSaved,
    discount: scenario.suggestedDiscount,
    gain: scenario.builderNetGain,
  }));
}

// =============================================================================
// COMPONENT
// =============================================================================

export function CounterproposalTab({
  input,
  effectiveRate,
  result: _result,
  t,
}: CounterproposalTabProps) {
  const [builderRetainRatio, setBuilderRetainRatio] = useState(DEFAULT_RETAIN_RATIO);
  const [sliderUpfront, setSliderUpfront] = useState(() => readCurrentUpfront(input));
  const [sliderMonths, setSliderMonths] = useState(() => readCurrentMonths(input));

  const analysis: CounterproposalResult = useMemo(
    () => runCounterproposalAnalysis(input, effectiveRate, builderRetainRatio),
    [input, effectiveRate, builderRetainRatio],
  );

  const sweetSpot = analysis.alternatives[analysis.sweetSpotIndex];

  const sliderScenario = useMemo(
    () =>
      calculateSliderScenario(
        input.salePrice,
        input.referenceDate,
        effectiveRate,
        { upfrontPercent: sliderUpfront, remainingMonths: sliderMonths },
        analysis.baseline.timeCost,
        builderRetainRatio,
      ),
    [
      input,
      effectiveRate,
      sliderUpfront,
      sliderMonths,
      analysis.baseline.timeCost,
      builderRetainRatio,
    ],
  );

  const chartData = useMemo(() => buildChartData(analysis, t), [analysis, t]);

  const handleRetainChange = useCallback((value: string) => {
    setBuilderRetainRatio(parseFloat(value));
  }, []);

  return (
    <section className="space-y-5">
      <aside className="flex gap-2 rounded-lg border border-primary/30 bg-[hsl(var(--bg-info))]/20 p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-xs text-foreground">
          {t('costCalculator.counterproposal.infoBanner')}
        </p>
      </aside>

      {sweetSpot && sweetSpot.builderNetGain > 0 ? (
        <aside className="flex gap-2 rounded-lg border border-border bg-[hsl(var(--bg-success))]/10 p-3">
          <Lightbulb
            className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--text-success))]"
            aria-hidden="true"
          />
          <p className="text-xs text-foreground">
            {t('costCalculator.counterproposal.insightCard', {
              upfront: String(sweetSpot.upfrontPercent),
              months: String(sweetSpot.remainingMonths),
              discount: formatCurrencyWhole(sweetSpot.suggestedDiscount),
              discountPercent: formatPercentage(sweetSpot.suggestedDiscountPercent),
              gain: formatCurrencyWhole(sweetSpot.builderNetGain),
            })}
          </p>
        </aside>
      ) : null}

      <fieldset className="flex items-center gap-3">
        <InfoLabel
          label={t('costCalculator.counterproposal.retainRatioLabel')}
          tooltip={t('costCalculator.counterproposal.retainRatioTooltip')}
        />
        <Select value={String(builderRetainRatio)} onValueChange={handleRetainChange}>
          <SelectTrigger className="h-8 w-24 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RETAIN_OPTIONS.map((option) => (
              <SelectItem key={option} value={option} className="text-xs">
                {formatPercentage(parseFloat(option) * 100)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </fieldset>

      <section className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {TABLE_COLUMNS.map((column, index) => (
                <InfoTableHead
                  key={column}
                  label={t(`costCalculator.counterproposal.table.${column}`)}
                  tooltip={t(`costCalculator.counterproposal.table.${column}Tooltip`)}
                  className={index === 0 ? undefined : 'text-right'}
                />
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <ScenarioRow scenario={analysis.baseline} variant="baseline" t={t} />
            {analysis.alternatives.map((alternative, index) => (
              <ScenarioRow
                key={alternative.nameKey}
                scenario={alternative}
                variant={index === analysis.sweetSpotIndex ? 'sweetSpot' : 'default'}
                t={t}
              />
            ))}
          </TableBody>
        </Table>
      </section>

      <CounterproposalNegotiation
        upfrontPercent={sliderUpfront}
        onUpfrontChange={setSliderUpfront}
        remainingMonths={sliderMonths}
        onMonthsChange={setSliderMonths}
        scenario={sliderScenario}
        t={t}
      />

      <CounterproposalChart data={chartData} t={t} />
    </section>
  );
}
