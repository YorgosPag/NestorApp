'use client';

/**
 * BudgetVarianceChart — budget vs projected cost per cost code, READ from the
 * project's source documents (ADR-917 Φ2): budget = BOQ, cost = purchase orders.
 *
 * Nothing on the chart is typed by hand. A code without BOQ shows NO budget bar
 * (the shell renders `null` as «missing», never as 0 €) and the summary says how
 * complete the picture is. Clicking a bar lists the documents behind it.
 *
 * The retiring hand-typed form lives collapsed in `LegacyBudgetVarianceEditor`
 * until ADR-917 Φ5.
 *
 * @enterprise SPEC-242C — Portfolio Dashboard
 * @enterprise ADR-710 — Chart card shell
 * @see ADR-917 §4 Δ2/Δ3
 */

import { useCallback, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  CHART_BAR_RADIUS,
  ChartCard,
  chartPolarityTone,
  seriesColorVar,
  type ChartSeries,
} from '@/components/ui/chart-card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import { costCodeLabelKey } from '@/config/cost-taxonomy';
import type {
  BudgetVarianceAnalysis,
  ProjectFinancialSummary,
} from '@/types/interest-calculator';
import type { CostLedgerViewRow, ProjectCostLedgerView } from '@/services/project-cost/cost-ledger-view';
import { CostLedgerDrillDown } from './CostLedgerDrillDown';
import { LegacyBudgetVarianceEditor, type BudgetVarianceSaveData } from './LegacyBudgetVarianceEditor';
import '@/lib/design-system';

// =============================================================================
// TYPES
// =============================================================================

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface BudgetVarianceChartProps {
  ledger: ProjectCostLedgerView | null;
  ledgerError: boolean;
  /** Retiring hand-typed values — feed only the collapsed legacy editor */
  legacyAnalysis: BudgetVarianceAnalysis | null;
  projects: ProjectFinancialSummary[];
  selectedProjectId: string | null;
  onProjectSelect: (projectId: string) => void;
  onLegacySave: (data: BudgetVarianceSaveData) => Promise<void>;
  t: Translate;
}

interface LedgerPoint {
  costCode: string;
  label: string;
  budget: number | null;
  projected: number;
}

/** What recharts hands a chart-level click: the datum under the pointer. */
interface ChartClickState {
  activePayload?: ReadonlyArray<{ payload?: LedgerPoint }>;
}

/** Spending above plan is the bad direction — see `chartPolarityTone`. */
const VARIANCE_POLARITY = 'lower-is-better' as const;

// =============================================================================
// DERIVATIONS
// =============================================================================

function costCodeLabel(costCode: string, t: Translate): string {
  return t(costCodeLabelKey(costCode));
}

function toPoints(rows: readonly CostLedgerViewRow[], t: Translate): LedgerPoint[] {
  return rows.map((row) => ({
    costCode: row.costCode,
    label: costCodeLabel(row.costCode, t),
    budget: row.budget,
    projected: row.projected,
  }));
}

function formatSigned(value: number, format: (value: number) => string): string {
  return `${value > 0 ? '+' : ''}${format(value)}`;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function BudgetVarianceChart({
  ledger,
  ledgerError,
  legacyAnalysis,
  projects,
  selectedProjectId,
  onProjectSelect,
  onLegacySave,
  t,
}: BudgetVarianceChartProps) {
  const formatEuro = useCallback((value: number) => formatCurrencyWhole(value) ?? '', []);
  const [drillCode, setDrillCode] = useState<string | null>(null);

  const points = useMemo(() => (ledger ? toPoints(ledger.rows, t) : []), [ledger, t]);
  const drillRow = ledger?.rows.find((row) => row.costCode === drillCode) ?? null;

  const series = useMemo<ChartSeries<LedgerPoint>[]>(
    () => [
      { key: 'budget', label: t('variance.source.budgetSeries') },
      { key: 'projected', label: t('variance.source.projectedSeries') },
    ],
    [t],
  );

  const drillInto = useCallback((state: ChartClickState | null) => {
    const point = state?.activePayload?.[0]?.payload;
    if (point) setDrillCode(point.costCode);
  }, []);

  const selectProject = useCallback(
    (projectId: string) => {
      setDrillCode(null);
      onProjectSelect(projectId);
    },
    [onProjectSelect],
  );

  const emptyMessage = !selectedProjectId
    ? t('variance.source.selectProjectPrompt')
    : ledgerError
      ? t('variance.source.loadError')
      : t('variance.source.noSources');

  return (
    <ChartCard
      series={series}
      data={points}
      categoryKey="label"
      categoryLabel={t('variance.category')}
      formatValue={formatEuro}
    >
      <ChartCard.Header title={t('variance.title')}>
        <nav className="flex items-center gap-2">
          <Label className="text-sm">{t('variance.project')}</Label>
          <Select value={selectedProjectId ?? ''} onValueChange={selectProject}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t('variance.selectProject')} />
            </SelectTrigger>
            <SelectContent width="content">
              {projects.map((project) => (
                <SelectItem key={project.projectId} value={project.projectId}>
                  {project.projectName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </nav>
      </ChartCard.Header>

      <ChartCard.Figure caption={t('variance.source.caption')} emptyMessage={emptyMessage}>
        <BarChart data={points} onClick={drillInto} className="cursor-pointer">
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis tickFormatter={formatEuro} width={100} tickLine={false} axisLine={false} />
          <ChartCard.Tooltip />
          {series.map((entry) => (
            <Bar
              key={entry.key}
              dataKey={entry.key}
              fill={seriesColorVar(entry.key)}
              radius={CHART_BAR_RADIUS}
            />
          ))}
        </BarChart>
      </ChartCard.Figure>

      {ledger && !ledger.isEmpty ? <LedgerSummary ledger={ledger} format={formatEuro} t={t} /> : null}

      {drillRow ? (
        <CostLedgerDrillDown
          row={drillRow}
          label={costCodeLabel(drillRow.costCode, t)}
          onClose={() => setDrillCode(null)}
          t={t}
        />
      ) : ledger && !ledger.isEmpty ? (
        <p className="text-sm text-muted-foreground">{t('variance.drillDown.hint')}</p>
      ) : null}

      {selectedProjectId ? (
        <ChartCard.Editor>
          <LegacyBudgetVarianceEditor
            analysis={legacyAnalysis}
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSave={onLegacySave}
            t={t}
          />
        </ChartCard.Editor>
      ) : null}
    </ChartCard>
  );
}

// =============================================================================
// SUMMARY — totals compare like with like; completeness is always stated
// =============================================================================

interface LedgerSummaryProps {
  ledger: ProjectCostLedgerView;
  format: (value: number) => string;
  t: Translate;
}

function LedgerSummary({ ledger, format, t }: LedgerSummaryProps) {
  const { totals, completeness } = ledger;
  const coverage = completeness.coveragePct === null
    ? t('variance.source.noBoq')
    : `${completeness.coveragePct}%`;

  return (
    <ChartCard.Summary>
      <ChartCard.SummaryItem
        label={t('variance.totalBudget')}
        value={totals.budget === null ? t('variance.source.noBudget') : format(totals.budget)}
      />
      <ChartCard.SummaryItem label={t('variance.source.projected')} value={format(totals.projected)} />
      {totals.variance !== null ? (
        <ChartCard.SummaryItem
          label={t('variance.totalVariance')}
          value={formatSigned(totals.variance, format)}
          tone={chartPolarityTone(totals.variance, VARIANCE_POLARITY)}
        />
      ) : null}
      {totals.unbudgetedProjected > 0 ? (
        <ChartCard.SummaryItem
          label={t('variance.source.unbudgeted')}
          value={`${format(totals.unbudgetedProjected)} · ${t('variance.source.codesWithoutBudget', { count: completeness.codesWithoutBudget })}`}
          tone="bad"
        />
      ) : null}
      {completeness.unpricedBoqItemCount > 0 ? (
        <ChartCard.SummaryItem
          label={t('variance.source.unpricedLabel')}
          value={t('variance.source.unpriced', { count: completeness.unpricedBoqItemCount })}
          tone="bad"
        />
      ) : null}
      <ChartCard.SummaryItem label={t('variance.source.coverage')} value={coverage} />
    </ChartCard.Summary>
  );
}
