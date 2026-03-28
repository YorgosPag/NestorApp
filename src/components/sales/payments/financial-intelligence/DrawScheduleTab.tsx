/* eslint-disable design-system/enforce-semantic-colors */
'use client';

/**
 * DrawScheduleTab — Construction Loan Draw Schedule & Interest Reserve
 *
 * Master tab for SPEC-242B: models staged construction loan disbursements,
 * interest accrual, reserve depletion, and total cost of capital.
 *
 * @enterprise ADR-242 SPEC-242B - Construction Loan Draw Schedule
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Info, Plus, FileSpreadsheet, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { InfoLabel, InfoDt } from './InfoLabel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

import { analyzeDrawSchedule, getGreekConstructionTemplate } from '@/lib/draw-schedule-engine';
import { DrawTimelineChart } from './DrawTimelineChart';
import { InterestReserveChart } from './InterestReserveChart';

import { formatCurrencyWhole } from '@/lib/intl-utils';
import type {
  DrawScheduleEntry,
  LoanTerms,
  DrawPhaseType,
  InterestAccrualMethod,
} from '@/types/interest-calculator';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// =============================================================================
// TYPES
// =============================================================================

interface DrawScheduleTabProps {
  salePrice: number;
  effectiveRate: number;
  t: (key: string, opts?: Record<string, string>) => string;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function addMonthsISO(isoDate: string, months: number): string {
  const d = new Date(isoDate);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

const PHASE_OPTIONS: DrawPhaseType[] = [
  'land_acquisition',
  'permits',
  'foundation',
  'structure',
  'masonry',
  'mechanical',
  'finishes',
  'landscaping',
  'custom',
];

// =============================================================================
// COMPONENT
// =============================================================================

export function DrawScheduleTab({ salePrice, effectiveRate, t }: DrawScheduleTabProps) {
  const colors = useSemanticColors();
  // ── Loan Terms State ──
  const closingDateDefault = todayISO();
  const maturityDefault = addMonthsISO(closingDateDefault, 24);

  const [loanTerms, setLoanTerms] = useState<LoanTerms>({
    totalCommitment: Math.round(salePrice * 0.7), // 70% LTV default
    annualRate: effectiveRate > 0 ? effectiveRate : 5.0,
    interestReserve: Math.round(salePrice * 0.05), // 5% of sale price
    maturityDate: maturityDefault,
    originationFee: 1.0,
    interestAccrual: 'simple',
    closingDate: closingDateDefault,
  });

  // ── Draw Entries State ──
  const [draws, setDraws] = useState<DrawScheduleEntry[]>([]);

  // ── Loan Terms Handlers ──
  const updateLoanTerm = useCallback(
    <K extends keyof LoanTerms>(key: K, value: LoanTerms[K]) => {
      setLoanTerms((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleNumericChange = useCallback(
    (key: keyof LoanTerms, rawValue: string) => {
      const parsed = parseFloat(rawValue);
      if (!isNaN(parsed)) {
        updateLoanTerm(key, parsed as LoanTerms[keyof LoanTerms]);
      }
    },
    [updateLoanTerm]
  );

  // ── Draw Entry Handlers ──
  const loadTemplate = useCallback(() => {
    const template = getGreekConstructionTemplate(
      loanTerms.totalCommitment,
      loanTerms.closingDate
    );
    setDraws(template);
  }, [loanTerms.totalCommitment, loanTerms.closingDate]);

  const addDraw = useCallback(() => {
    const lastDate = draws.length > 0
      ? draws[draws.length - 1].drawDate
      : loanTerms.closingDate;
    const newDraw: DrawScheduleEntry = {
      phase: 'custom',
      label: '',
      drawAmount: 0,
      drawDate: addMonthsISO(lastDate, 2),
      completionPercent: 0,
    };
    setDraws((prev) => [...prev, newDraw]);
  }, [draws, loanTerms.closingDate]);

  const updateDraw = useCallback(
    (index: number, field: keyof DrawScheduleEntry, value: string | number) => {
      setDraws((prev) =>
        prev.map((d, i) => (i === index ? { ...d, [field]: value } : d))
      );
    },
    []
  );

  const removeDraw = useCallback((index: number) => {
    setDraws((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Analysis ──
  const result = useMemo(() => {
    if (draws.length === 0) return null;
    const validDraws = draws.filter((d) => d.drawAmount > 0 && d.drawDate);
    if (validDraws.length === 0) return null;
    return analyzeDrawSchedule(validDraws, loanTerms);
  }, [draws, loanTerms]);

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <article className="space-y-5">
      {/* ── Info Banner ── */}
      <section className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-3">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
          {t('costCalculator.drawSchedule.infoBanner')}
        </p>
      </section>

      {/* ── Loan Terms Form ── */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">
          {t('costCalculator.drawSchedule.loanTermsTitle')}
        </legend>
        <div className="grid grid-cols-3 gap-3">
          {/* Total Commitment */}
          <div className="space-y-1">
            <InfoLabel htmlFor="ds-commitment" label={t('costCalculator.drawSchedule.totalCommitment')} tooltip={t('costCalculator.drawSchedule.totalCommitmentTooltip')} />
            <Input
              id="ds-commitment"
              type="number"
              value={loanTerms.totalCommitment}
              onChange={(e) => handleNumericChange('totalCommitment', e.target.value)}
            />
          </div>

          {/* Annual Rate */}
          <div className="space-y-1">
            <InfoLabel htmlFor="ds-rate" label={t('costCalculator.drawSchedule.annualRate')} tooltip={t('costCalculator.drawSchedule.annualRateTooltip')} />
            <Input
              id="ds-rate"
              type="number"
              step="0.1"
              value={loanTerms.annualRate}
              onChange={(e) => handleNumericChange('annualRate', e.target.value)}
            />
          </div>

          {/* Interest Reserve */}
          <div className="space-y-1">
            <InfoLabel htmlFor="ds-reserve" label={t('costCalculator.drawSchedule.interestReserve')} tooltip={t('costCalculator.drawSchedule.interestReserveTooltip')} />
            <Input
              id="ds-reserve"
              type="number"
              value={loanTerms.interestReserve}
              onChange={(e) => handleNumericChange('interestReserve', e.target.value)}
            />
          </div>

          {/* Closing Date */}
          <div className="space-y-1">
            <InfoLabel htmlFor="ds-closing" label={t('costCalculator.drawSchedule.closingDate')} tooltip={t('costCalculator.drawSchedule.closingDateTooltip')} />
            <Input
              id="ds-closing"
              type="date"
              value={loanTerms.closingDate}
              onChange={(e) => updateLoanTerm('closingDate', e.target.value)}
            />
          </div>

          {/* Maturity Date */}
          <div className="space-y-1">
            <InfoLabel htmlFor="ds-maturity" label={t('costCalculator.drawSchedule.maturityDate')} tooltip={t('costCalculator.drawSchedule.maturityDateTooltip')} />
            <Input
              id="ds-maturity"
              type="date"
              value={loanTerms.maturityDate}
              onChange={(e) => updateLoanTerm('maturityDate', e.target.value)}
            />
          </div>

          {/* Origination Fee */}
          <div className="space-y-1">
            <InfoLabel htmlFor="ds-origination" label={t('costCalculator.drawSchedule.originationFee')} tooltip={t('costCalculator.drawSchedule.originationFeeTooltip')} />
            <Input
              id="ds-origination"
              type="number"
              step="0.1"
              value={loanTerms.originationFee}
              onChange={(e) => handleNumericChange('originationFee', e.target.value)}
            />
          </div>
        </div>

        {/* Interest Accrual Method — separate row */}
        <div className="max-w-xs space-y-1">
          <InfoLabel htmlFor="ds-accrual" label={t('costCalculator.drawSchedule.interestAccrual')} tooltip={t('costCalculator.drawSchedule.interestAccrualTooltip')} />
          <Select
            value={loanTerms.interestAccrual}
            onValueChange={(v) => updateLoanTerm('interestAccrual', v as InterestAccrualMethod)}
          >
            <SelectTrigger id="ds-accrual">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="simple">
                {t('costCalculator.drawSchedule.accrualSimple')}
              </SelectItem>
              <SelectItem value="compound">
                {t('costCalculator.drawSchedule.accrualCompound')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </fieldset>

      {/* ── Draw Entries ── */}
      <section className="space-y-3">
        <header className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">
            {t('costCalculator.drawSchedule.drawsTitle')}
          </h4>
          <nav className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadTemplate}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              {t('costCalculator.drawSchedule.loadTemplate')}
            </Button>
            <Button variant="outline" size="sm" onClick={addDraw}>
              <Plus className="h-4 w-4 mr-1" />
              {t('costCalculator.drawSchedule.addDraw')}
            </Button>
          </nav>
        </header>

        {draws.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">{t('costCalculator.drawSchedule.phase')}</TableHead>
                <TableHead className="text-xs">{t('costCalculator.drawSchedule.label')}</TableHead>
                <TableHead className="text-xs text-right">{t('costCalculator.drawSchedule.drawAmount')}</TableHead>
                <TableHead className="text-xs">{t('costCalculator.drawSchedule.drawDate')}</TableHead>
                <TableHead className="text-xs text-right">{t('costCalculator.drawSchedule.completion')}</TableHead>
                <TableHead className="text-xs w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {draws.map((draw, idx) => (
                <TableRow key={idx}>
                  <TableCell className="p-1">
                    <Select
                      value={draw.phase}
                      onValueChange={(v) => updateDraw(idx, 'phase', v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PHASE_OPTIONS.map((p) => (
                          <SelectItem key={p} value={p} className="text-xs">
                            {t(`costCalculator.drawSchedule.phases.${p}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      className="h-8 text-xs"
                      value={draw.label}
                      onChange={(e) => updateDraw(idx, 'label', e.target.value)}
                      placeholder={t(`costCalculator.drawSchedule.phases.${draw.phase}`)}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      className="h-8 text-xs text-right"
                      type="number"
                      value={draw.drawAmount || ''}
                      onChange={(e) => updateDraw(idx, 'drawAmount', parseFloat(e.target.value) || 0)}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      className="h-8 text-xs"
                      type="date"
                      value={draw.drawDate}
                      onChange={(e) => updateDraw(idx, 'drawDate', e.target.value)}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      className="h-8 text-xs text-right"
                      type="number"
                      min={0}
                      max={100}
                      value={draw.completionPercent || ''}
                      onChange={(e) => updateDraw(idx, 'completionPercent', parseFloat(e.target.value) || 0)}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => removeDraw(idx)}
                      aria-label={t('costCalculator.drawSchedule.removeDraw')}
                    >
                      <Trash2 className={cn("h-3.5 w-3.5", colors.text.muted)} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {draws.length === 0 && (
          <p className={cn("text-sm text-center py-6", colors.text.muted)}>
            {t('costCalculator.drawSchedule.emptyState')}
          </p>
        )}
      </section>

      {/* ── Charts ── */}
      {result && (
        <>
          <DrawTimelineChart periods={result.periods} t={t} />
          <InterestReserveChart
            periods={result.periods}
            reserveStatus={result.reserveStatus}
            t={t}
          />
        </>
      )}

      {/* ── Summary ── */}
      {result && (
        <section className="space-y-3 border-t pt-4">
          <h4 className="text-sm font-semibold">
            {t('costCalculator.drawSchedule.summaryTitle')}
          </h4>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <InfoDt label={t('costCalculator.drawSchedule.totalDrawn')} tooltip={t('costCalculator.drawSchedule.totalDrawnTooltip')} />
            <dd className="text-right font-medium">{formatCurrencyWhole(result.totalDrawn)}</dd>

            <InfoDt label={t('costCalculator.drawSchedule.totalInterest')} tooltip={t('costCalculator.drawSchedule.totalInterestTooltip')} />
            <dd className="text-right font-medium">{formatCurrencyWhole(result.totalInterest)}</dd>

            <InfoDt label={t('costCalculator.drawSchedule.originationFeeLabel')} tooltip={t('costCalculator.drawSchedule.originationFeeLabelTooltip')} />
            <dd className="text-right font-medium">{formatCurrencyWhole(result.originationFeeAmount)}</dd>

            <InfoDt label={t('costCalculator.drawSchedule.totalCostOfCapital')} tooltip={t('costCalculator.drawSchedule.totalCostOfCapitalTooltip')} className={cn("font-semibold", colors.text.muted)} />
            <dd className="text-right font-bold">{formatCurrencyWhole(result.totalCostOfCapital)}</dd>

            <InfoDt label={t('costCalculator.drawSchedule.costPercent')} tooltip={t('costCalculator.drawSchedule.costPercentTooltip')} />
            <dd className="text-right font-medium">{formatPercent(result.costOfCapitalPercent)}</dd>

            <InfoDt label={t('costCalculator.drawSchedule.waob')} tooltip={t('costCalculator.drawSchedule.waobTooltip')} />
            <dd className="text-right font-medium">{formatCurrencyWhole(result.weightedAverageBalance)}</dd>

            <dt className={colors.text.muted}>
              {t('costCalculator.drawSchedule.reserveStatusLabel')}
            </dt>
            <dd className="text-right">
              {result.reserveStatus.sufficient ? (
                <Badge variant="default">
                  {t('costCalculator.drawSchedule.reserveSufficient')}
                </Badge>
              ) : (
                <Badge variant="destructive">
                  {t('costCalculator.drawSchedule.reserveInsufficient')}
                </Badge>
              )}
            </dd>
          </dl>
        </section>
      )}
    </article>
  );
}
