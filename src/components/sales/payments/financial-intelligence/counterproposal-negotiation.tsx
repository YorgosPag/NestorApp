'use client';

/**
 * Counterproposal negotiation panel — the two sliders and what they produce.
 *
 * Split out of `CounterproposalTab` so neither render function runs past the length
 * N.7.1 allows. The tab owns the slider values; this file renders them and the
 * scenario they compute to.
 *
 * @enterprise ADR-234 SPEC-234F — Counterproposal Tab
 */

import { Handshake } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { CounterproposalScenario } from '@/types/interest-calculator';
import { InfoLabel, InfoDt } from '@/components/ui/InfoLabel';
import { formatCurrencyWhole, formatPercentage } from '@/lib/intl-utils';
import '@/lib/design-system';

// =============================================================================
// TYPES
// =============================================================================

type TranslateFn = (key: string, opts?: Record<string, string>) => string;

interface NegotiationPanelProps {
  readonly upfrontPercent: number;
  readonly onUpfrontChange: (value: number) => void;
  readonly remainingMonths: number;
  readonly onMonthsChange: (value: number) => void;
  readonly scenario: CounterproposalScenario;
  readonly t: TranslateFn;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const UPFRONT_RANGE = { min: 10, max: 100, step: 5 } as const;
const MONTHS_RANGE = { min: 0, max: 24, step: 1 } as const;

// =============================================================================
// COMPONENT
// =============================================================================

export function CounterproposalNegotiation({
  upfrontPercent,
  onUpfrontChange,
  remainingMonths,
  onMonthsChange,
  scenario,
  t,
}: NegotiationPanelProps) {
  const colors = useSemanticColors();
  const key = (name: string) => `costCalculator.counterproposal.slider.${name}`;

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <header className="flex items-center gap-2">
        <Handshake className={cn('h-4 w-4', colors.text.muted)} aria-hidden="true" />
        <h3 className="text-sm font-medium">{t(key('title'))}</h3>
      </header>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <InfoLabel
            label={t(key('upfrontLabel'), { value: String(upfrontPercent) })}
            tooltip={t(key('upfrontTooltip'))}
          />
          <Slider
            value={[upfrontPercent]}
            onValueChange={([value]) => onUpfrontChange(value)}
            min={UPFRONT_RANGE.min}
            max={UPFRONT_RANGE.max}
            step={UPFRONT_RANGE.step}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <InfoLabel
            label={t(key('monthsLabel'), { value: String(remainingMonths) })}
            tooltip={t(key('monthsTooltip'))}
          />
          <Slider
            value={[remainingMonths]}
            onValueChange={([value]) => onMonthsChange(value)}
            min={MONTHS_RANGE.min}
            max={MONTHS_RANGE.max}
            step={MONTHS_RANGE.step}
            className="w-full"
          />
        </div>
      </fieldset>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <NegotiationFigure
          label={t(key('npv'))}
          tooltip={t(key('npvTooltip'))}
          value={formatCurrencyWhole(scenario.npv)}
        />
        <NegotiationFigure
          label={t(key('saving'))}
          tooltip={t(key('savingTooltip'))}
          value={formatCurrencyWhole(scenario.timeCostSaved)}
          emphasis="text-[hsl(var(--text-success))]"
        />
        <NegotiationFigure
          label={t(key('discount'))}
          tooltip={t(key('discountTooltip'))}
          value={`${formatCurrencyWhole(scenario.suggestedDiscount)} (${formatPercentage(scenario.suggestedDiscountPercent)})`}
          emphasis="text-[hsl(var(--text-warning))]"
        />
        <NegotiationFigure
          label={t(key('netGain'))}
          tooltip={t(key('netGainTooltip'))}
          value={formatCurrencyWhole(scenario.builderNetGain)}
          emphasis="text-primary"
        />
      </dl>
    </section>
  );
}

/** One computed figure of the slider scenario, with the sentence that explains it. */
function NegotiationFigure({
  label,
  tooltip,
  value,
  emphasis,
}: {
  readonly label: string;
  readonly tooltip: string;
  readonly value: string;
  readonly emphasis?: string;
}) {
  const colors = useSemanticColors();
  return (
    <div>
      <InfoDt label={label} tooltip={tooltip} className={cn('text-xs', colors.text.muted)} />
      <dd className={cn('font-mono font-medium tabular-nums', emphasis)}>{value}</dd>
    </div>
  );
}
