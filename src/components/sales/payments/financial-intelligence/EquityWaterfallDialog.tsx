'use client';

/**
 * EquityWaterfallDialog — LP/GP distribution of sale proceeds through a tier ladder.
 *
 * This file owns the model: the equity figures, the tier ladder being edited, and the
 * computed result. Rendering is split across `equity-waterfall-inputs.tsx` (the form)
 * and `equity-waterfall-results.tsx` (the figures and the chart card), because one
 * render function of ~270 lines is not reviewable and is what N.7.1 exists to stop.
 *
 * @enterprise ADR-242 SPEC-242D — Equity Waterfall Distribution
 * @enterprise ADR-710 — Chart card shell
 */

import { useCallback, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

import { calculateWaterfall, PRESET_STANDARD_80_20 } from '@/lib/waterfall-engine';
import type {
  WaterfallInput,
  WaterfallResult,
  WaterfallTier,
} from '@/types/interest-calculator';
import {
  WaterfallEquityInputs,
  WaterfallPresets,
  WaterfallTierLadder,
  type WaterfallEquityFields,
} from './equity-waterfall-inputs';
import { EquityWaterfallResults } from './equity-waterfall-results';
import '@/lib/design-system';

// =============================================================================
// TYPES
// =============================================================================

interface EquityWaterfallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salePrice: number;
  t: (key: string) => string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Opening figures, expressed against the sale price the dialog was opened with. */
const OPENING_SPLIT = { lp: 0.7, gp: 0.3, proceeds: 1.5, years: 3 } as const;

const NEW_TIER: WaterfallTier = { name: '', hurdleRate: 0, lpShare: 0.5, gpShare: 0.5 };

// =============================================================================
// COMPONENT
// =============================================================================

export function EquityWaterfallDialog({
  open,
  onOpenChange,
  salePrice,
  t,
}: EquityWaterfallDialogProps) {
  const [fields, setFields] = useState<WaterfallEquityFields>(() => ({
    lpEquity: Math.round(salePrice * OPENING_SPLIT.lp),
    gpEquity: Math.round(salePrice * OPENING_SPLIT.gp),
    totalProceeds: Math.round(salePrice * OPENING_SPLIT.proceeds),
    projectYears: OPENING_SPLIT.years,
  }));
  const [lpFirstReturn, setLpFirstReturn] = useState(true);
  const [tiers, setTiers] = useState<WaterfallTier[]>(() => [...PRESET_STANDARD_80_20]);
  const [result, setResult] = useState<WaterfallResult | null>(null);

  const patchFields = useCallback(
    (changes: Partial<WaterfallEquityFields>) =>
      setFields((previous) => ({ ...previous, ...changes })),
    [],
  );

  const handleCalculate = useCallback(() => {
    const input: WaterfallInput = { ...fields, tiers, lpFirstReturn };
    setResult(calculateWaterfall(input));
  }, [fields, tiers, lpFirstReturn]);

  /** A different ladder describes a different deal, so the old result is not kept. */
  const handleLoadPreset = useCallback((preset: WaterfallTier[]) => {
    setTiers(preset.map((tier) => ({ ...tier })));
    setResult(null);
  }, []);

  const handleAddTier = useCallback(() => {
    setTiers((previous) => [...previous, { ...NEW_TIER }]);
  }, []);

  const handleRemoveTier = useCallback((index: number) => {
    setTiers((previous) => previous.filter((_, position) => position !== index));
  }, []);

  const handleTierChange = useCallback(
    (index: number, field: keyof WaterfallTier, value: string | number) => {
      setTiers((previous) =>
        previous.map((tier, position) =>
          position === index ? { ...tier, [field]: value } : tier,
        ),
      );
    },
    [],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('costCalculator.waterfall.title')}</DialogTitle>
        </DialogHeader>

        <article className="mt-4 space-y-6">
          <WaterfallPresets onLoad={handleLoadPreset} t={t} />

          <WaterfallEquityInputs
            fields={fields}
            onChange={patchFields}
            lpFirstReturn={lpFirstReturn}
            onLpFirstReturnChange={setLpFirstReturn}
            t={t}
          />

          <WaterfallTierLadder
            tiers={tiers}
            onTierChange={handleTierChange}
            onAdd={handleAddTier}
            onRemove={handleRemoveTier}
            t={t}
          />

          <Button onClick={handleCalculate} size="sm">
            {t('costCalculator.waterfall.calculate')}
          </Button>

          {result ? <EquityWaterfallResults result={result} t={t} /> : null}
        </article>
      </DialogContent>
    </Dialog>
  );
}
