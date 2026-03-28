'use client';
/* eslint-disable custom/no-hardcoded-strings */
/* eslint-disable design-system/no-hardcoded-colors */

/**
 * DebtMaturityWall — Stacked bar chart of debt maturing per year
 *
 * @enterprise SPEC-242C — Portfolio Dashboard
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import type {
  DebtMaturityEntry,
  MaturityWallYear,
  LoanType,
  HealthStatus,
} from '@/types/interest-calculator';
import '@/lib/design-system';

// =============================================================================
// TYPES
// =============================================================================

interface DebtMaturityWallProps {
  entries: DebtMaturityEntry[];
  onAdd: (data: DebtMaturityFormData) => Promise<void>;
  onRemove: (loanId: string) => Promise<void>;
  t: (key: string) => string;
}

export interface DebtMaturityFormData {
  projectName: string;
  loanType: LoanType;
  outstandingBalance: number;
  currentRate: number;
  maturityDate: string;
  estimatedRefiRate: number;
  ltvAtMaturity: number;
  currentDSCR: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const LOAN_TYPE_COLORS: Record<LoanType, string> = {
  construction: '#3b82f6',
  mortgage: '#10b981',
  bridge: '#f59e0b',
  mezzanine: '#ef4444',
};

const LOAN_TYPE_OPTIONS: { value: LoanType; label: string }[] = [
  { value: 'construction', label: 'Construction' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'bridge', label: 'Bridge' },
  { value: 'mezzanine', label: 'Mezzanine' },
];

const RISK_BADGE: Record<HealthStatus, 'success' | 'info' | 'warning' | 'destructive'> = {
  excellent: 'success',
  good: 'info',
  warning: 'warning',
  critical: 'destructive',
};

// =============================================================================
// HELPERS
// =============================================================================

function buildYearData(entries: DebtMaturityEntry[]): MaturityWallYear[] {
  const yearMap = new Map<number, DebtMaturityEntry[]>();

  for (const entry of entries) {
    const year = new Date(entry.maturityDate).getFullYear();
    const existing = yearMap.get(year) ?? [];
    existing.push(entry);
    yearMap.set(year, existing);
  }

  const years = Array.from(yearMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, yearEntries]) => {
      const totalMaturing = yearEntries.reduce((s, e) => s + e.outstandingBalance, 0);
      const avgRefiGapBps = yearEntries.length > 0
        ? yearEntries.reduce((s, e) => s + (e.estimatedRefiRate - e.currentRate) * 100, 0) / yearEntries.length
        : 0;

      return {
        year,
        totalMaturing: Math.round(totalMaturing),
        entries: yearEntries,
        avgRefiGapBps: Math.round(avgRefiGapBps),
      };
    });

  return years;
}

interface ChartDataPoint {
  year: number;
  construction: number;
  mortgage: number;
  bridge: number;
  mezzanine: number;
  total: number;
}

function buildChartData(yearData: MaturityWallYear[]): ChartDataPoint[] {
  return yearData.map(yd => {
    const byType: Record<LoanType, number> = { construction: 0, mortgage: 0, bridge: 0, mezzanine: 0 };
    for (const entry of yd.entries) {
      byType[entry.loanType] += entry.outstandingBalance;
    }
    return {
      year: yd.year,
      construction: Math.round(byType.construction),
      mortgage: Math.round(byType.mortgage),
      bridge: Math.round(byType.bridge),
      mezzanine: Math.round(byType.mezzanine),
      total: yd.totalMaturing,
    };
  });
}

// =============================================================================
// FORM COMPONENT
// =============================================================================

const INITIAL_FORM: DebtMaturityFormData = {
  projectName: '',
  loanType: 'construction',
  outstandingBalance: 0,
  currentRate: 0,
  maturityDate: '',
  estimatedRefiRate: 0,
  ltvAtMaturity: 0,
  currentDSCR: 0,
};

function AddEntryForm({ onAdd, t }: { onAdd: (d: DebtMaturityFormData) => Promise<void>; t: (k: string) => string }) {
  const [form, setForm] = useState<DebtMaturityFormData>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!form.projectName || !form.maturityDate || form.outstandingBalance <= 0) return;
    setSubmitting(true);
    try {
      await onAdd(form);
      setForm(INITIAL_FORM);
      setExpanded(false);
    } finally {
      setSubmitting(false);
    }
  }, [form, onAdd]);

  if (!expanded) {
    return (
      <Button variant="outline" size="sm" onClick={() => setExpanded(true)}>
        <Plus className="h-4 w-4 mr-1" />
        {t('maturity.addEntry')}
      </Button>
    );
  }

  return (
    <section className="grid grid-cols-2 gap-3 p-4 border rounded-lg md:grid-cols-4">
      <fieldset className="space-y-1">
        <Label>{t('maturity.projectName')}</Label>
        <Input
          value={form.projectName}
          onChange={e => setForm(prev => ({ ...prev, projectName: e.target.value }))}
          placeholder="Project…"
        />
      </fieldset>

      <fieldset className="space-y-1">
        <Label>{t('maturity.loanType')}</Label>
        <Select
          value={form.loanType}
          onValueChange={(v: string) => setForm(prev => ({ ...prev, loanType: v as LoanType }))}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {LOAN_TYPE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </fieldset>

      <fieldset className="space-y-1">
        <Label>{t('maturity.balance')}</Label>
        <Input
          type="number"
          value={form.outstandingBalance || ''}
          onChange={e => setForm(prev => ({ ...prev, outstandingBalance: Number(e.target.value) }))}
          placeholder="€"
        />
      </fieldset>

      <fieldset className="space-y-1">
        <Label>{t('maturity.rate')}</Label>
        <Input
          type="number"
          step="0.01"
          value={form.currentRate || ''}
          onChange={e => setForm(prev => ({ ...prev, currentRate: Number(e.target.value) }))}
          placeholder="%"
        />
      </fieldset>

      <fieldset className="space-y-1">
        <Label>{t('maturity.maturityDate')}</Label>
        <Input
          type="date"
          value={form.maturityDate}
          onChange={e => setForm(prev => ({ ...prev, maturityDate: e.target.value }))}
        />
      </fieldset>

      <fieldset className="space-y-1">
        <Label>{t('maturity.refiRate')}</Label>
        <Input
          type="number"
          step="0.01"
          value={form.estimatedRefiRate || ''}
          onChange={e => setForm(prev => ({ ...prev, estimatedRefiRate: Number(e.target.value) }))}
          placeholder="%"
        />
      </fieldset>

      <fieldset className="space-y-1">
        <Label>{t('maturity.ltv')}</Label>
        <Input
          type="number"
          value={form.ltvAtMaturity || ''}
          onChange={e => setForm(prev => ({ ...prev, ltvAtMaturity: Number(e.target.value) }))}
          placeholder="%"
        />
      </fieldset>

      <fieldset className="space-y-1">
        <Label>{t('maturity.dscr')}</Label>
        <Input
          type="number"
          step="0.01"
          value={form.currentDSCR || ''}
          onChange={e => setForm(prev => ({ ...prev, currentDSCR: Number(e.target.value) }))}
          placeholder="1.25"
        />
      </fieldset>

      <fieldset className="col-span-2 flex gap-2 items-end md:col-span-4">
        <Button onClick={handleSubmit} disabled={submitting} size="sm">
          {submitting ? '…' : t('maturity.save')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setExpanded(false)}>
          {t('maturity.cancel')}
        </Button>
      </fieldset>
    </section>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DebtMaturityWall({ entries, onAdd, onRemove, t }: DebtMaturityWallProps) {
  const colors = useSemanticColors();
  const yearData = useMemo(() => buildYearData(entries), [entries]);
  const chartData = useMemo(() => buildChartData(yearData), [yearData]);

  const euroFormatter = (val: number) => formatCurrencyWhole(val) ?? '';

  return (
    <Card>
      <CardContent className="pt-6">
        <header className="flex items-center justify-between mb-4">
          <h3 className={cn('text-lg font-semibold', colors.text.primary)}>
            {t('maturity.title')}
          </h3>
          <AddEntryForm onAdd={onAdd} t={t} />
        </header>

        {chartData.length > 0 ? (
          <figure className="h-72 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={euroFormatter} width={100} />
                <RechartsTooltip
                  formatter={(value: number, name: string) => [euroFormatter(value), name]}
                />
                <Legend />
                <Bar dataKey="construction" stackId="stack" fill={LOAN_TYPE_COLORS.construction} name="Construction" />
                <Bar dataKey="mortgage" stackId="stack" fill={LOAN_TYPE_COLORS.mortgage} name="Mortgage" />
                <Bar dataKey="bridge" stackId="stack" fill={LOAN_TYPE_COLORS.bridge} name="Bridge" />
                <Bar dataKey="mezzanine" stackId="stack" fill={LOAN_TYPE_COLORS.mezzanine} name="Mezzanine" />
              </BarChart>
            </ResponsiveContainer>
          </figure>
        ) : (
          <p className={cn('text-center py-8 text-sm', colors.text.muted)}>
            {t('maturity.emptyState')}
          </p>
        )}

        {entries.length > 0 && (
          <section>
            <h4 className={cn('text-sm font-medium mb-2', colors.text.muted)}>
              {t('maturity.entriesTitle')} ({entries.length})
            </h4>
            <ul className="space-y-2">
              {entries.map(entry => (
                <li
                  key={entry.loanId}
                  className="flex items-center justify-between p-3 border rounded-md"
                >
                  <span className="flex items-center gap-3">
                    <Badge variant={RISK_BADGE[entry.riskLevel]}>
                      {entry.loanType}
                    </Badge>
                    <span className="text-sm font-medium">{entry.projectName}</span>
                    <span className={cn('text-sm', colors.text.muted)}>
                      {euroFormatter(entry.outstandingBalance)} · {entry.currentRate}% · {entry.monthsToMaturity}mo
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(entry.loanId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
