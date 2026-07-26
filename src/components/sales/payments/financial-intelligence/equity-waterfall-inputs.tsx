'use client';

/**
 * Equity waterfall inputs — presets, the four equity figures, and the tier ladder.
 *
 * Split out of `EquityWaterfallDialog` so that neither file has a render function
 * running past the size a reviewer can hold in their head (N.7.1). The dialog owns the
 * state; this file only renders it and reports edits back.
 *
 * @enterprise ADR-242 SPEC-242D — Equity Waterfall Distribution
 */

import { Plus, Trash2, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumericField } from '@/components/ui/numeric-field';
import {
  Tooltip as RadixTooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  PRESET_STANDARD_80_20,
  PRESET_JV_CATCH_UP,
  PRESET_SIMPLE_SPLIT,
} from '@/lib/waterfall-engine';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { WaterfallTier } from '@/types/interest-calculator';
import { InfoLabel } from '@/components/ui/InfoLabel';
import '@/lib/design-system';

// =============================================================================
// TYPES
// =============================================================================

type TranslateFn = (key: string) => string;

/** The four figures the ladder is applied to. */
export interface WaterfallEquityFields {
  lpEquity: number;
  gpEquity: number;
  totalProceeds: number;
  projectYears: number;
}

interface HelpProps {
  readonly text: string;
}

// =============================================================================
// SHARED
// =============================================================================

/** The question-mark affordance, so the three call-sites below cannot drift apart. */
function Help({ text }: HelpProps) {
  const colors = useSemanticColors();
  return (
    <RadixTooltip>
      <TooltipTrigger asChild>
        <HelpCircle className={cn('h-3 w-3 cursor-help', colors.text.muted)} />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        {text}
      </TooltipContent>
    </RadixTooltip>
  );
}

// =============================================================================
// PRESETS
// =============================================================================

export function WaterfallPresets({
  onLoad,
  t,
}: {
  readonly onLoad: (preset: WaterfallTier[]) => void;
  readonly t: TranslateFn;
}) {
  const colors = useSemanticColors();
  const presets = [
    { labelKey: 'presetStandard', tiers: PRESET_STANDARD_80_20 },
    { labelKey: 'presetJV', tiers: PRESET_JV_CATCH_UP },
    { labelKey: 'presetSimple', tiers: PRESET_SIMPLE_SPLIT },
  ];

  return (
    <section className="flex flex-wrap gap-2">
      <Label className={cn('self-center text-xs', colors.text.muted)}>
        {t('costCalculator.waterfall.presetsTitle')}
      </Label>
      {presets.map((preset) => (
        <Button
          key={preset.labelKey}
          variant="outline"
          size="sm"
          onClick={() => onLoad([...preset.tiers])}
        >
          {t(`costCalculator.waterfall.${preset.labelKey}`)}
        </Button>
      ))}
    </section>
  );
}

// =============================================================================
// EQUITY FIGURES
// =============================================================================

export function WaterfallEquityInputs({
  fields,
  onChange,
  lpFirstReturn,
  onLpFirstReturnChange,
  t,
}: {
  readonly fields: WaterfallEquityFields;
  readonly onChange: (changes: Partial<WaterfallEquityFields>) => void;
  readonly lpFirstReturn: boolean;
  readonly onLpFirstReturnChange: (value: boolean) => void;
  readonly t: TranslateFn;
}) {
  const label = (name: string) => t(`costCalculator.waterfall.${name}`);

  return (
    <>
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <fieldset className="space-y-1">
          <InfoLabel label={label('lpEquity')} tooltip={label('lpEquityTooltip')} />
          <NumericField
            min={0}
            step={0.01}
            value={fields.lpEquity}
            onValueChange={(lpEquity) => onChange({ lpEquity })}
            aria-label={label('lpEquity')}
          />
        </fieldset>
        <fieldset className="space-y-1">
          <InfoLabel label={label('gpEquity')} tooltip={label('gpEquityTooltip')} />
          <NumericField
            min={0}
            step={0.01}
            value={fields.gpEquity}
            onValueChange={(gpEquity) => onChange({ gpEquity })}
            aria-label={label('gpEquity')}
          />
        </fieldset>
        <fieldset className="space-y-1">
          <InfoLabel label={label('totalProceeds')} tooltip={label('totalProceedsTooltip')} />
          <NumericField
            min={0}
            step={0.01}
            value={fields.totalProceeds}
            onValueChange={(totalProceeds) => onChange({ totalProceeds })}
            aria-label={label('totalProceeds')}
          />
        </fieldset>
        <fieldset className="space-y-1">
          <InfoLabel label={label('projectYears')} tooltip={label('projectYearsTooltip')} />
          {/* The floor is applied here, not left to `min`: the field syncs the model
              live while typing and only clamps on commit, so a bare `min` would let a
              transient 0 reach the IRR maths. */}
          <NumericField
            min={0.5}
            step={0.5}
            value={fields.projectYears}
            onValueChange={(years) => onChange({ projectYears: Math.max(0.5, years) })}
            aria-label={label('projectYears')}
          />
        </fieldset>
      </section>

      <fieldset className="flex items-center gap-2">
        <Checkbox
          id="lp-first"
          checked={lpFirstReturn}
          onCheckedChange={(checked) => onLpFirstReturnChange(checked === true)}
        />
        <label htmlFor="lp-first" className="inline-flex cursor-pointer items-center gap-1 text-sm">
          {label('lpFirstReturn')}
          <Help text={label('lpFirstReturnTooltip')} />
        </label>
      </fieldset>
    </>
  );
}

// =============================================================================
// TIER LADDER
// =============================================================================

/** The four columns of the ladder, in render order. */
const TIER_COLUMNS = [
  { labelKey: 'tierName', span: 'col-span-3' },
  { labelKey: 'hurdleRate', span: 'col-span-2', tooltipKey: 'hurdleRateTooltip' },
  { labelKey: 'lpShare', span: 'col-span-2', tooltipKey: 'lpShareTooltip' },
  { labelKey: 'gpShare', span: 'col-span-2', tooltipKey: 'gpShareTooltip' },
] as const;

export function WaterfallTierLadder({
  tiers,
  onTierChange,
  onAdd,
  onRemove,
  t,
}: {
  readonly tiers: readonly WaterfallTier[];
  readonly onTierChange: (index: number, field: keyof WaterfallTier, value: string | number) => void;
  readonly onAdd: () => void;
  readonly onRemove: (index: number) => void;
  readonly t: TranslateFn;
}) {
  const label = (name: string) => t(`costCalculator.waterfall.${name}`);

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{label('tiersTitle')}</h3>

      <header className="grid grid-cols-12 gap-2 px-1 text-xs font-medium">
        {TIER_COLUMNS.map((column) => (
          <span key={column.labelKey} className={cn('inline-flex items-center gap-1', column.span)}>
            {label(column.labelKey)}
            {'tooltipKey' in column ? <Help text={label(column.tooltipKey)} /> : null}
          </span>
        ))}
        <span className="col-span-3" />
      </header>

      {tiers.map((tier, index) => (
        <fieldset key={`${tier.name}-${index}`} className="grid grid-cols-12 items-center gap-2">
          <Input
            className="col-span-3 h-8 text-xs"
            value={tier.name}
            onChange={(event) => onTierChange(index, 'name', event.target.value)}
            aria-label={label('tierName')}
          />
          <NumericField
            className="col-span-2 h-8 text-xs"
            step={0.5}
            min={0}
            value={tier.hurdleRate}
            onValueChange={(value) => onTierChange(index, 'hurdleRate', value)}
            aria-label={label('hurdleRate')}
          />
          <NumericField
            className="col-span-2 h-8 text-xs"
            step={0.05}
            min={0}
            max={1}
            value={tier.lpShare}
            onValueChange={(value) => onTierChange(index, 'lpShare', value)}
            aria-label={label('lpShare')}
          />
          <NumericField
            className="col-span-2 h-8 text-xs"
            step={0.05}
            min={0}
            max={1}
            value={tier.gpShare}
            onValueChange={(value) => onTierChange(index, 'gpShare', value)}
            aria-label={label('gpShare')}
          />
          <span className="col-span-3 flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(index)}
              aria-label={label('removeTier')}
            >
              <Trash2 className="h-3 w-3" aria-hidden="true" />
            </Button>
          </span>
        </fieldset>
      ))}

      <Button variant="outline" size="sm" onClick={onAdd} className="gap-1">
        <Plus className="h-4 w-4" aria-hidden="true" />
        {label('addTier')}
      </Button>
    </section>
  );
}
