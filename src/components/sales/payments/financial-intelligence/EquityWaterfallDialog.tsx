'use client';

/**
 * EquityWaterfallDialog — LP/GP equity distribution modeling
 *
 * Dialog with:
 * - Input form: equity amounts + dynamic tier configuration
 * - Stacked horizontal bar: LP vs GP per tier
 * - Summary table: totals, multiples, IRR
 * - 3 preset buttons
 *
 * @enterprise ADR-242 SPEC-242D — Equity Waterfall Distribution
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Plus, Trash2, HelpCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

import {
  calculateWaterfall,
  PRESET_STANDARD_80_20,
  PRESET_JV_CATCH_UP,
  PRESET_SIMPLE_SPLIT,
} from '@/lib/waterfall-engine';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import { InfoLabel, InfoDt } from './InfoLabel';
import type {
  WaterfallInput,
  WaterfallResult,
  WaterfallTier,
} from '@/types/interest-calculator';
import { FinancialTooltip } from './FinancialTooltip';

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
// CHART DATA
// =============================================================================

interface WaterfallChartData {
  name: string;
  lp: number;
  gp: number;
}

function buildChartData(result: WaterfallResult): WaterfallChartData[] {
  return result.tiers
    .filter(tier => tier.totalAmount > 0)
    .map(tier => ({
      name: tier.name,
      lp: tier.lpAmount,
      gp: tier.gpAmount,
    }));
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function EquityWaterfallDialog({
  open,
  onOpenChange,
  salePrice,
  t,
}: EquityWaterfallDialogProps) {
  // Form state
  const [lpEquity, setLpEquity] = useState(Math.round(salePrice * 0.7));
  const [gpEquity, setGpEquity] = useState(Math.round(salePrice * 0.3));
  const [totalProceeds, setTotalProceeds] = useState(Math.round(salePrice * 1.5));
  const [projectYears, setProjectYears] = useState(3);
  const [lpFirstReturn, setLpFirstReturn] = useState(true);
  const [tiers, setTiers] = useState<WaterfallTier[]>(() => [...PRESET_STANDARD_80_20]);

  // Result
  const [result, setResult] = useState<WaterfallResult | null>(null);

  const handleCalculate = useCallback(() => {
    const input: WaterfallInput = {
      lpEquity,
      gpEquity,
      totalProceeds,
      projectYears,
      tiers,
      lpFirstReturn,
    };
    setResult(calculateWaterfall(input));
  }, [lpEquity, gpEquity, totalProceeds, projectYears, tiers, lpFirstReturn]);

  const handleLoadPreset = useCallback((preset: WaterfallTier[]) => {
    setTiers(preset.map(t => ({ ...t })));
    setResult(null);
  }, []);

  const handleAddTier = useCallback(() => {
    setTiers(prev => [...prev, { name: '', hurdleRate: 0, lpShare: 0.5, gpShare: 0.5 }]);
  }, []);

  const handleRemoveTier = useCallback((idx: number) => {
    setTiers(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleTierChange = useCallback((idx: number, field: keyof WaterfallTier, value: string | number) => {
    setTiers(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }, []);

  const chartData = useMemo(() => result ? buildChartData(result) : [], [result]);
  const fmt = (v: number) => formatCurrencyWhole(v) ?? '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('costCalculator.waterfall.title')}</DialogTitle>
        </DialogHeader>

        <article className="space-y-6 mt-4">
          {/* Preset buttons */}
          <section className="flex gap-2 flex-wrap">
            <Label className="text-xs text-muted-foreground self-center">{t('costCalculator.waterfall.presetsTitle')}:</Label>
            <Button variant="outline" size="sm" onClick={() => handleLoadPreset(PRESET_STANDARD_80_20)}>
              {t('costCalculator.waterfall.presetStandard')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleLoadPreset(PRESET_JV_CATCH_UP)}>
              {t('costCalculator.waterfall.presetJV')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleLoadPreset(PRESET_SIMPLE_SPLIT)}>
              {t('costCalculator.waterfall.presetSimple')}
            </Button>
          </section>

          {/* Input form */}
          <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <fieldset className="space-y-1">
              <InfoLabel label={t('costCalculator.waterfall.lpEquity')} tooltip={t('costCalculator.waterfall.lpEquityTooltip')} />
              <Input
                type="number"
                value={lpEquity}
                onChange={e => setLpEquity(Number(e.target.value))}
              />
            </fieldset>
            <fieldset className="space-y-1">
              <InfoLabel label={t('costCalculator.waterfall.gpEquity')} tooltip={t('costCalculator.waterfall.gpEquityTooltip')} />
              <Input
                type="number"
                value={gpEquity}
                onChange={e => setGpEquity(Number(e.target.value))}
              />
            </fieldset>
            <fieldset className="space-y-1">
              <InfoLabel label={t('costCalculator.waterfall.totalProceeds')} tooltip={t('costCalculator.waterfall.totalProceedsTooltip')} />
              <Input
                type="number"
                value={totalProceeds}
                onChange={e => setTotalProceeds(Number(e.target.value))}
              />
            </fieldset>
            <fieldset className="space-y-1">
              <InfoLabel label={t('costCalculator.waterfall.projectYears')} tooltip={t('costCalculator.waterfall.projectYearsTooltip')} />
              <Input
                type="number"
                value={projectYears}
                onChange={e => setProjectYears(Math.max(0.5, Number(e.target.value)))}
              />
            </fieldset>
          </section>

          <fieldset className="flex items-center gap-2">
            <Checkbox
              checked={lpFirstReturn}
              onCheckedChange={(checked) => setLpFirstReturn(checked === true)}
              id="lp-first"
            />
            <label htmlFor="lp-first" className="text-sm cursor-pointer inline-flex items-center gap-1">
              {t('costCalculator.waterfall.lpFirstReturn')}
              <HelpCircle className="h-3 w-3 text-muted-foreground" title={t('costCalculator.waterfall.lpFirstReturnTooltip')} />
            </label>
          </fieldset>

          {/* Tier configuration */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{t('costCalculator.waterfall.tiersTitle')}</h3>
            <header className="grid grid-cols-12 gap-2 text-xs font-medium px-1">
              <span className="col-span-3">{t('costCalculator.waterfall.tierName')}</span>
              <span className="col-span-2 inline-flex items-center gap-1">
                {t('costCalculator.waterfall.hurdleRate')}
                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" title={t('costCalculator.waterfall.hurdleRateTooltip')} />
              </span>
              <span className="col-span-2 inline-flex items-center gap-1">
                {t('costCalculator.waterfall.lpShare')}
                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" title={t('costCalculator.waterfall.lpShareTooltip')} />
              </span>
              <span className="col-span-2 inline-flex items-center gap-1">
                {t('costCalculator.waterfall.gpShare')}
                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" title={t('costCalculator.waterfall.gpShareTooltip')} />
              </span>
              <span className="col-span-3" />
            </header>
            {tiers.map((tier, idx) => (
              <fieldset key={idx} className="grid grid-cols-12 gap-2 items-center">
                <Input
                  className="col-span-3 h-8 text-xs"
                  value={tier.name}
                  onChange={e => handleTierChange(idx, 'name', e.target.value)}
                  placeholder="Tier name…"
                />
                <Input
                  className="col-span-2 h-8 text-xs"
                  type="number"
                  step="0.5"
                  value={tier.hurdleRate}
                  onChange={e => handleTierChange(idx, 'hurdleRate', Number(e.target.value))}
                />
                <Input
                  className="col-span-2 h-8 text-xs"
                  type="number"
                  step="0.05"
                  min={0}
                  max={1}
                  value={tier.lpShare}
                  onChange={e => handleTierChange(idx, 'lpShare', Number(e.target.value))}
                />
                <Input
                  className="col-span-2 h-8 text-xs"
                  type="number"
                  step="0.05"
                  min={0}
                  max={1}
                  value={tier.gpShare}
                  onChange={e => handleTierChange(idx, 'gpShare', Number(e.target.value))}
                />
                <span className="col-span-3 flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleRemoveTier(idx)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </span>
              </fieldset>
            ))}
            <Button variant="outline" size="sm" onClick={handleAddTier} className="gap-1">
              <Plus className="h-4 w-4" />
              {t('costCalculator.waterfall.addTier')}
            </Button>
          </section>

          {/* Calculate button */}
          <Button onClick={handleCalculate} size="sm">
            {t('costCalculator.waterfall.calculate')}
          </Button>

          {/* Results */}
          {result && (
            <section className="space-y-6">
              <h3 className="text-sm font-semibold">{t('costCalculator.waterfall.resultsTitle')}</h3>

              {/* Summary cards */}
              <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <dl className="rounded-lg border p-3 space-y-1">
                  <InfoDt label={t('costCalculator.waterfall.lpTotal')} tooltip={t('costCalculator.waterfall.lpTotalTooltip')} className="text-xs text-muted-foreground" />
                  <dd className="text-lg font-bold text-blue-600">{fmt(result.totalLP)}</dd>
                </dl>
                <dl className="rounded-lg border p-3 space-y-1">
                  <InfoDt label={t('costCalculator.waterfall.gpTotal')} tooltip={t('costCalculator.waterfall.gpTotalTooltip')} className="text-xs text-muted-foreground" />
                  <dd className="text-lg font-bold text-emerald-600">{fmt(result.totalGP)}</dd>
                </dl>
                <dl className="rounded-lg border p-3 space-y-1">
                  <InfoDt label={t('costCalculator.waterfall.lpMultiple')} tooltip={t('costCalculator.waterfall.lpMultipleTooltip')} className="text-xs text-muted-foreground" />
                  <dd className="text-lg font-bold">{result.lpMultiple}x</dd>
                </dl>
                <dl className="rounded-lg border p-3 space-y-1">
                  <InfoDt label={t('costCalculator.waterfall.gpMultiple')} tooltip={t('costCalculator.waterfall.gpMultipleTooltip')} className="text-xs text-muted-foreground" />
                  <dd className="text-lg font-bold">{result.gpMultiple}x</dd>
                </dl>
                <dl className="rounded-lg border p-3 space-y-1">
                  <InfoDt label={t('costCalculator.waterfall.lpIrr')} tooltip={t('costCalculator.waterfall.lpIrrTooltip')} className="text-xs text-muted-foreground" />
                  <dd className="text-sm font-medium">{result.lpIRR}%</dd>
                </dl>
                <dl className="rounded-lg border p-3 space-y-1">
                  <InfoDt label={t('costCalculator.waterfall.gpIrr')} tooltip={t('costCalculator.waterfall.gpIrrTooltip')} className="text-xs text-muted-foreground" />
                  <dd className="text-sm font-medium">{result.gpIRR}%</dd>
                </dl>
                {result.remainder > 0 && (
                  <dl className="rounded-lg border border-amber-300 p-3 space-y-1">
                    <InfoDt label={t('costCalculator.waterfall.remainder')} tooltip={t('costCalculator.waterfall.remainderTooltip')} className="text-xs text-muted-foreground" />
                    <dd className="text-sm font-medium text-amber-600">{fmt(result.remainder)}</dd>
                  </dl>
                )}
              </section>

              {/* Stacked bar chart */}
              {chartData.length > 0 && (
                <figure className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={chartData} margin={{ top: 5, right: 30, left: 120, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis type="number" tickFormatter={(v: number) => fmt(v)} />
                      <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                      <Tooltip
                        content={
                          <FinancialTooltip
                            valueFormatter={(value, name) => [fmt(value as number), name === 'lp' ? 'LP' : 'GP']}
                          />
                        }
                      />
                      <Legend />
                      <Bar dataKey="lp" stackId="stack" fill="#3b82f6" name="LP" />
                      <Bar dataKey="gp" stackId="stack" fill="#10b981" name="GP" />
                    </BarChart>
                  </ResponsiveContainer>
                </figure>
              )}

              {/* Tier breakdown table */}
              <section>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">{t('costCalculator.waterfall.tierBreakdown')}</h4>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="p-2 text-left border border-border font-medium">Tier</th>
                      <th className="p-2 text-right border border-border font-medium text-blue-600">LP</th>
                      <th className="p-2 text-right border border-border font-medium text-emerald-600">GP</th>
                      <th className="p-2 text-right border border-border font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.tiers.map((tier, idx) => (
                      <tr key={idx}>
                        <td className="p-2 border border-border">{tier.name}</td>
                        <td className="p-2 text-right border border-border font-mono">{fmt(tier.lpAmount)}</td>
                        <td className="p-2 text-right border border-border font-mono">{fmt(tier.gpAmount)}</td>
                        <td className="p-2 text-right border border-border font-mono font-medium">{fmt(tier.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td className="p-2 border border-border">Total</td>
                      <td className="p-2 text-right border border-border text-blue-600">{fmt(result.totalLP)}</td>
                      <td className="p-2 text-right border border-border text-emerald-600">{fmt(result.totalGP)}</td>
                      <td className="p-2 text-right border border-border">{fmt(result.totalLP + result.totalGP)}</td>
                    </tr>
                  </tfoot>
                </table>
              </section>
            </section>
          )}
        </article>
      </DialogContent>
    </Dialog>
  );
}
