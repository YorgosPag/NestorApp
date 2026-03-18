'use client';

/**
 * DSCRStressTab — DSCR Gauge + Rate Stress Test Table
 *
 * Calculates Debt Service Coverage Ratio and shows how
 * rising interest rates affect the buyer's ability to service debt.
 *
 * @enterprise ADR-242 SPEC-242A - DSCR Stress Testing
 */

import React, { useState, useMemo } from 'react';
import { Info, HelpCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { calculateDSCR, runStressTest } from '@/lib/dscr-engine';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import type { DSCRInput } from '@/types/interest-calculator';

// =============================================================================
// TYPES
// =============================================================================

interface DSCRStressTabProps {
  salePrice: number;
  effectiveRate: number;
  t: (key: string, opts?: Record<string, string>) => string;
}

// =============================================================================
// HELPERS
// =============================================================================

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  safe: 'default',
  adequate: 'secondary',
  warning: 'outline',
  danger: 'destructive',
};

// =============================================================================
// SVG GAUGE
// =============================================================================

function DSCRGauge({ dscr, status, t }: { dscr: number; status: string; t: DSCRStressTabProps['t'] }) {
  // Semicircle gauge: 180° arc
  const cx = 120;
  const cy = 110;
  const r = 90;
  const strokeWidth = 18;

  // DSCR range 0-3 mapped to 0-180°
  const clampedDSCR = Math.max(0, Math.min(3, dscr));
  const needleAngle = (clampedDSCR / 3) * 180;

  // Arc helper
  const describeArc = (startAngle: number, endAngle: number): string => {
    const startRad = ((180 - startAngle) * Math.PI) / 180;
    const endRad = ((180 - endAngle) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy - r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy - r * Math.sin(endRad);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 0 ${x2} ${y2}`;
  };

  // Color zones: danger (0-60°), warning (60-72°), adequate (72-84°), safe (84-180°)
  const zones = [
    { start: 0, end: 60, color: 'hsl(0, 72%, 51%)' },     // red — <1.0
    { start: 60, end: 72, color: 'hsl(45, 93%, 47%)' },    // amber — 1.0-1.2
    { start: 72, end: 84, color: 'hsl(217, 91%, 60%)' },   // blue — 1.2-1.4
    { start: 84, end: 180, color: 'hsl(142, 71%, 45%)' },  // green — >1.4
  ];

  // Needle position
  const needleRad = ((180 - needleAngle) * Math.PI) / 180;
  const needleX = cx + (r - 10) * Math.cos(needleRad);
  const needleY = cy - (r - 10) * Math.sin(needleRad);

  const statusColorClass = `dscr-${status}`;

  return (
    <figure className="flex flex-col items-center">
      <svg width="240" height="140" viewBox="0 0 240 140" role="img" aria-label={`DSCR: ${dscr}`}>
        {/* Background arc */}
        <path
          d={describeArc(0, 180)}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Color zone arcs */}
        {zones.map((zone, i) => (
          <path
            key={i}
            d={describeArc(zone.start, zone.end)}
            fill="none"
            stroke={zone.color}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
            opacity={0.85}
          />
        ))}
        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke="hsl(var(--foreground))"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={4} fill="hsl(var(--foreground))" />
        {/* DSCR value text */}
        <text x={cx} y={cy - 20} textAnchor="middle" className="text-2xl font-bold fill-current">
          {dscr.toFixed(2)}
        </text>
      </svg>
      <p className={`text-sm font-semibold mt-1 ${statusColorClass}`}>
        {t(`costCalculator.dscr.${status}`)}
      </p>
    </figure>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DSCRStressTab({ salePrice, effectiveRate, t }: DSCRStressTabProps) {
  // Default values: assume 70% loan, buyer income = 5% of sale price
  const defaultLoanAmount = Math.round(salePrice * 0.7);
  const defaultNOI = Math.round(salePrice * 0.05);

  const [annualNOI, setAnnualNOI] = useState(defaultNOI);
  const [loanAmount, setLoanAmount] = useState(defaultLoanAmount);
  const [annualRate, setAnnualRate] = useState(effectiveRate);
  const [loanTermYears, setLoanTermYears] = useState(25);

  const dscrInput: DSCRInput = useMemo(
    () => ({ annualNOI, loanAmount, annualRate, loanTermYears }),
    [annualNOI, loanAmount, annualRate, loanTermYears]
  );

  const stressResult = useMemo(
    () => runStressTest(dscrInput),
    [dscrInput]
  );

  const { baseResult, rows, maxRateForDSCR1 } = stressResult;

  return (
    <article className="space-y-5">
      {/* Info banner */}
      <section className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-3">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
          {t('costCalculator.dscr.infoBanner')}
        </p>
      </section>

      {/* Input form + Gauge side by side */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Input form */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold mb-2">
            {t('costCalculator.dscr.title')}
          </legend>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor="dscr-noi" className="text-xs">
                {t('costCalculator.dscr.annualNOI')}
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  {t('costCalculator.dscr.noiTooltip')}
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="dscr-noi"
              type="number"
              value={annualNOI}
              onChange={(e) => setAnnualNOI(Number(e.target.value))}
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dscr-loan" className="text-xs">
              {t('costCalculator.dscr.loanAmount')}
            </Label>
            <Input
              id="dscr-loan"
              type="number"
              value={loanAmount}
              onChange={(e) => setLoanAmount(Number(e.target.value))}
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dscr-rate" className="text-xs">
              {t('costCalculator.dscr.annualRate')}
            </Label>
            <Input
              id="dscr-rate"
              type="number"
              step="0.01"
              value={annualRate}
              onChange={(e) => setAnnualRate(Number(e.target.value))}
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dscr-term" className="text-xs">
              {t('costCalculator.dscr.loanTermYears')}
            </Label>
            <Input
              id="dscr-term"
              type="number"
              value={loanTermYears}
              onChange={(e) => setLoanTermYears(Number(e.target.value))}
              className="h-8 text-sm"
            />
          </div>

          {/* Key metrics */}
          <dl className="grid grid-cols-2 gap-2 pt-2 border-t">
            <div>
              <dt className="text-xs text-muted-foreground">
                {t('costCalculator.dscr.annualDebtService')}
              </dt>
              <dd className="text-sm font-semibold">
                {formatCurrencyWhole(baseResult.annualDebtService)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {t('costCalculator.dscr.monthlyPayment')}
              </dt>
              <dd className="text-sm font-semibold">
                {formatCurrencyWhole(baseResult.monthlyPayment)}
              </dd>
            </div>
          </dl>
        </fieldset>

        {/* Gauge */}
        <div className="flex flex-col items-center justify-center">
          <DSCRGauge dscr={baseResult.dscr} status={baseResult.status} t={t} />
        </div>
      </section>

      {/* Stress test table */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">
          {t('costCalculator.dscr.stressTitle')}
        </h3>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">{t('costCalculator.dscr.shockBps')}</TableHead>
              <TableHead className="text-xs text-right">{t('costCalculator.dscr.stressedRate')}</TableHead>
              <TableHead className="text-xs text-right">{t('costCalculator.dscr.dscrLabel')}</TableHead>
              <TableHead className="text-xs text-center">{t('costCalculator.dscr.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Base case row */}
            <TableRow className="bg-muted/30">
              <TableCell className="text-xs font-medium">
                {t('costCalculator.dscr.baseCase')}
              </TableCell>
              <TableCell className="text-xs text-right font-mono">
                {annualRate.toFixed(2)}%
              </TableCell>
              <TableCell className={`text-xs text-right font-mono font-bold dscr-${baseResult.status}`}>
                {baseResult.dscr.toFixed(2)}
              </TableCell>
              <TableCell className="text-center">
                <Badge variant={STATUS_BADGE_VARIANT[baseResult.status]}>
                  {t(`costCalculator.dscr.${baseResult.status}`)}
                </Badge>
              </TableCell>
            </TableRow>
            {/* Stress rows */}
            {rows.map((row) => (
              <TableRow key={row.shockBps}>
                <TableCell className="text-xs font-mono">+{row.shockBps} bps</TableCell>
                <TableCell className="text-xs text-right font-mono">
                  {row.stressedRate.toFixed(2)}%
                </TableCell>
                <TableCell className={`text-xs text-right font-mono font-bold dscr-${row.status}`}>
                  {row.dscr.toFixed(2)}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={STATUS_BADGE_VARIANT[row.status]}>
                    {t(`costCalculator.dscr.${row.status}`)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Max sustainable rate */}
        <section className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3">
          <p className="text-sm">
            <span className="font-semibold">{t('costCalculator.dscr.maxRateLabel')}:</span>{' '}
            <span className="font-mono font-bold">{maxRateForDSCR1.toFixed(2)}%</span>
          </p>
        </section>
      </section>
    </article>
  );
}
