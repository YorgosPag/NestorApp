'use client';

/**
 * DebtMaturityWall — outstanding balance maturing per year, stacked by loan type.
 *
 * Renders through the ADR-710 chart card shell. The four loan-type hexes this file
 * used to carry are gone: series colors are positional and come from `--chart-1..5`,
 * so the chart is finally correct in dark mode, where the hardcoded light-ramp values
 * were being drawn regardless of theme.
 *
 * @enterprise SPEC-242C — Portfolio Dashboard
 * @enterprise ADR-710 — Chart card shell
 */

import { useCallback, useMemo, useState } from 'react';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  CHART_BAR_RADIUS,
  CHART_STACK_SPACER,
  ChartCard,
  ChartCardEditor,
  seriesColorVar,
  useEntrySubmit,
  type ChartSeries,
} from '@/components/ui/chart-card';
import { Input } from '@/components/ui/input';
import { NumericField } from '@/components/ui/numeric-field';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
  t: (key: string, options?: Record<string, unknown>) => string;
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

interface MaturityYearPoint {
  year: number;
  construction: number;
  mortgage: number;
  bridge: number;
  mezzanine: number;
  total: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Stack order. It is also the color order: `chartSeriesColor` assigns `--chart-1..4`
 * by position, so this list is the only place the identity of a loan type is fixed.
 */
const LOAN_TYPES: readonly LoanType[] = ['construction', 'mortgage', 'bridge', 'mezzanine'];

const RISK_BADGE: Record<HealthStatus, 'success' | 'info' | 'warning' | 'destructive'> = {
  excellent: 'success',
  good: 'info',
  warning: 'warning',
  critical: 'destructive',
};

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

// =============================================================================
// DERIVATIONS
// =============================================================================

function buildYearData(entries: DebtMaturityEntry[]): MaturityWallYear[] {
  const yearMap = new Map<number, DebtMaturityEntry[]>();

  for (const entry of entries) {
    const year = new Date(entry.maturityDate).getFullYear();
    const existing = yearMap.get(year) ?? [];
    existing.push(entry);
    yearMap.set(year, existing);
  }

  return Array.from(yearMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, yearEntries]) => {
      const totalMaturing = yearEntries.reduce((sum, e) => sum + e.outstandingBalance, 0);
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
}

function buildChartData(yearData: MaturityWallYear[]): MaturityYearPoint[] {
  return yearData.map((yearEntry) => {
    const byType: Record<LoanType, number> = {
      construction: 0, mortgage: 0, bridge: 0, mezzanine: 0,
    };
    for (const entry of yearEntry.entries) {
      byType[entry.loanType] += entry.outstandingBalance;
    }
    return {
      year: yearEntry.year,
      construction: Math.round(byType.construction),
      mortgage: Math.round(byType.mortgage),
      bridge: Math.round(byType.bridge),
      mezzanine: Math.round(byType.mezzanine),
      total: yearEntry.totalMaturing,
    };
  });
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DebtMaturityWall({ entries, onAdd, onRemove, t }: DebtMaturityWallProps) {
  const formatEuro = useCallback((value: number) => formatCurrencyWhole(value) ?? '', []);

  const chartData = useMemo(
    () => buildChartData(buildYearData(entries)),
    [entries],
  );

  const series = useMemo<ChartSeries<MaturityYearPoint>[]>(
    () => LOAN_TYPES.map((type) => ({ key: type, label: t(`maturity.types.${type}`) })),
    [t],
  );

  return (
    <ChartCard
      series={series}
      data={chartData}
      categoryKey="year"
      categoryLabel={t('maturity.year')}
      formatValue={formatEuro}
    >
      <ChartCard.Header title={t('maturity.title')}>
        <ChartCardEditor.Disclosure triggerLabel={t('maturity.addEntry')}>
          {(close) => <AddEntryForm onAdd={onAdd} onDone={close} t={t} />}
        </ChartCardEditor.Disclosure>
      </ChartCard.Header>

      <ChartCard.Figure
        caption={t('maturity.caption')}
        emptyMessage={t('maturity.emptyState')}
        size="lg"
      >
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="year" tickLine={false} axisLine={false} />
          <YAxis tickFormatter={formatEuro} width={100} tickLine={false} axisLine={false} />
          <ChartCard.Tooltip />
          {LOAN_TYPES.map((type, index) => (
            <Bar
              key={type}
              dataKey={type}
              stackId="maturity"
              fill={seriesColorVar(type)}
              // Surface gap between touching fills — the secondary encoding the
              // measured CVD separation requires (ADR-710 §4).
              {...CHART_STACK_SPACER}
              radius={index === LOAN_TYPES.length - 1 ? CHART_BAR_RADIUS : undefined}
            />
          ))}
        </BarChart>
      </ChartCard.Figure>

      {entries.length > 0 ? <EntryList entries={entries} onRemove={onRemove} t={t} /> : null}
    </ChartCard>
  );
}

// =============================================================================
// ENTRY LIST
// =============================================================================

interface EntryListProps {
  entries: DebtMaturityEntry[];
  onRemove: (loanId: string) => Promise<void>;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function EntryList({ entries, onRemove, t }: EntryListProps) {
  return (
    <section>
      <h4 className="mb-2 text-sm font-medium text-muted-foreground">
        {t('maturity.entriesTitle')} ({entries.length})
      </h4>
      <ul className="space-y-2">
        {entries.map((entry) => (
          <li
            key={entry.loanId}
            className="flex items-center justify-between rounded-md border p-3"
          >
            <span className="flex items-center gap-3">
              <Badge variant={RISK_BADGE[entry.riskLevel]}>
                {t(`maturity.types.${entry.loanType}`)}
              </Badge>
              <span className="text-sm font-medium">{entry.projectName}</span>
              <span className="text-sm text-muted-foreground">
                {formatCurrencyWhole(entry.outstandingBalance) ?? ''} · {entry.currentRate}%
                {' · '}
                {t('maturity.monthsToMaturity', { count: entry.monthsToMaturity })}
              </span>
            </span>
            <ChartCardEditor.Remove
              label={t('maturity.removeEntry')}
              onClick={() => void onRemove(entry.loanId)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

// =============================================================================
// ADD-ENTRY FORM — the fields of one loan, and nothing else
// =============================================================================

interface AddEntryFormProps {
  onAdd: (data: DebtMaturityFormData) => Promise<void>;
  /** Collapses the disclosure. Called only after the write resolves. */
  onDone: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function AddEntryForm({ onAdd, onDone, t }: AddEntryFormProps) {
  const [form, setForm] = useState<DebtMaturityFormData>(INITIAL_FORM);

  const { submitting, submit } = useEntrySubmit<DebtMaturityFormData>({
    onSubmit: onAdd,
    isValid: (value) =>
      Boolean(value.projectName) && Boolean(value.maturityDate) && value.outstandingBalance > 0,
    onSubmitted: () => {
      setForm(INITIAL_FORM);
      onDone();
    },
  });

  const patch = useCallback(
    (changes: Partial<DebtMaturityFormData>) =>
      setForm((previous) => ({ ...previous, ...changes })),
    [],
  );

  return (
    <ChartCardEditor.Grid>
      <ChartCardEditor.Field>
        <Label htmlFor="maturity-project">{t('maturity.projectName')}</Label>
        <Input
          id="maturity-project"
          value={form.projectName}
          onChange={(event) => patch({ projectName: event.target.value })}
        />
      </ChartCardEditor.Field>

      <ChartCardEditor.Field>
        <Label htmlFor="maturity-type">{t('maturity.loanType')}</Label>
        <Select
          value={form.loanType}
          onValueChange={(value: string) => patch({ loanType: value as LoanType })}
        >
          <SelectTrigger id="maturity-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOAN_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {t(`maturity.types.${type}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ChartCardEditor.Field>

      <ChartCardEditor.Field>
        <NumericField
          id="maturity-balance"
          label={t('maturity.balance')}
          value={form.outstandingBalance}
          onValueChange={(outstandingBalance) => patch({ outstandingBalance })}
          blankValue={0}
          step={0.01}
        />
      </ChartCardEditor.Field>

      <ChartCardEditor.Field>
        <NumericField
          id="maturity-rate"
          label={t('maturity.rate')}
          value={form.currentRate}
          onValueChange={(currentRate) => patch({ currentRate })}
          blankValue={0}
          step={0.01}
        />
      </ChartCardEditor.Field>

      <ChartCardEditor.Field>
        <Label htmlFor="maturity-date">{t('maturity.maturityDate')}</Label>
        <Input
          id="maturity-date"
          type="date"
          value={form.maturityDate}
          onChange={(event) => patch({ maturityDate: event.target.value })}
        />
      </ChartCardEditor.Field>

      <ChartCardEditor.Field>
        <NumericField
          id="maturity-refi-rate"
          label={t('maturity.refiRate')}
          value={form.estimatedRefiRate}
          onValueChange={(estimatedRefiRate) => patch({ estimatedRefiRate })}
          blankValue={0}
          step={0.01}
        />
      </ChartCardEditor.Field>

      <ChartCardEditor.Field>
        <NumericField
          id="maturity-ltv"
          label={t('maturity.ltv')}
          value={form.ltvAtMaturity}
          onValueChange={(ltvAtMaturity) => patch({ ltvAtMaturity })}
          blankValue={0}
          step={0.01}
        />
      </ChartCardEditor.Field>

      <ChartCardEditor.Field>
        <NumericField
          id="maturity-dscr"
          label={t('maturity.dscr')}
          value={form.currentDSCR}
          onValueChange={(currentDSCR) => patch({ currentDSCR })}
          blankValue={0}
          step={0.01}
        />
      </ChartCardEditor.Field>

      <ChartCardEditor.Actions className="col-span-2 md:col-span-4">
        <ChartCardEditor.Submit
          label={t('maturity.save')}
          pending={submitting}
          onClick={() => void submit(form)}
        />
        <ChartCardEditor.Cancel label={t('maturity.cancel')} onClick={onDone} />
      </ChartCardEditor.Actions>
    </ChartCardEditor.Grid>
  );
}
