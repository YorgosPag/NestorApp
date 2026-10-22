'use client';

/**
 * BudgetVarianceChart — budget vs projected cost per cost code, READ from the
 * project's source documents (ADR-917 Φ2 · Φ3γ · Φ4): budget = signed-off BOQ, allowance
 * or soft-cost line; projected = purchase orders + direct costs; invoiced = confirmed expense
 * documents allocated to the project (an invoice against a PO is never counted twice).
 *
 * Nothing on the chart is typed by hand. A code without a source shows NO budget bar
 * (the shell renders `null` as «missing», never as 0 €) and the summary says how
 * complete the picture is. Every bar says its SOURCE (tooltip, data table, dashed
 * outline for an allowance); clicking a bar lists the documents behind it. Budget
 * lines are edited on the project's «Budget» tab (Γ2) — the card links there.
 *
 * The retiring hand-typed form lives collapsed in `LegacyBudgetVarianceEditor`
 * until ADR-917 Φ5.
 *
 * @enterprise SPEC-242C — Portfolio Dashboard
 * @enterprise ADR-710 — Chart card shell
 * @see ADR-917 §4 Δ2/Δ3 · Φ3γ
 */

import { useCallback, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts';
import {
  CHART_BAR_RADIUS,
  ChartCard,
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
import { Link } from '@/lib/workspace/navigation';
import { getProjectTabUrl } from '@/lib/navigation/project-urls';
import { VISIBLE_LINK_CLASS } from '@/lib/ui/link-style';
import type {
  BudgetVarianceAnalysis,
  ProjectFinancialSummary,
} from '@/types/interest-calculator';
import type { ProjectCostLedgerView } from '@/services/project-cost/cost-ledger-view';
import { CostLedgerDrillDown } from './CostLedgerDrillDown';
import { CostLedgerSummary } from './CostLedgerSummary';
import {
  budgetSourceText,
  costCodeLabel,
  isEstimateBar,
  ledgerCategoryText,
  toLedgerPoints,
  type LedgerPoint,
} from './cost-ledger-points';
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

/** What recharts hands a chart-level click: the datum under the pointer. */
interface ChartClickState {
  activePayload?: ReadonlyArray<{ payload?: LedgerPoint }>;
}

// =============================================================================
// PARTS
// =============================================================================

interface ProjectPickerProps {
  projects: ProjectFinancialSummary[];
  selectedProjectId: string | null;
  onSelect: (projectId: string) => void;
  t: Translate;
}

function ProjectPicker({ projects, selectedProjectId, onSelect, t }: ProjectPickerProps) {
  return (
    <nav className="flex items-center gap-2">
      <Label className="text-sm">{t('variance.project')}</Label>
      <Select value={selectedProjectId ?? ''} onValueChange={onSelect}>
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
      {selectedProjectId ? (
        <Link href={getProjectTabUrl(selectedProjectId, 'budget')} className={`text-sm text-[hsl(var(--text-info))] ${VISIBLE_LINK_CLASS}`}>
          {t('variance.source.editBudget')}
        </Link>
      ) : null}
    </nav>
  );
}

interface LedgerBarsProps {
  points: LedgerPoint[];
  series: ChartSeries<LedgerPoint>[];
  formatEuro: (value: number) => string;
  onDrill: (state: ChartClickState | null) => void;
}

/** The budget bar of an allowance is dashed and lighter — an estimate, not a measured figure (Ζ4′). */
function LedgerBars({ points, series, formatEuro, onDrill }: LedgerBarsProps) {
  const budgetColor = seriesColorVar('budget');
  return (
    <BarChart data={points} onClick={onDrill} className="cursor-pointer">
      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
      <XAxis dataKey="label" tickLine={false} axisLine={false} />
      <YAxis tickFormatter={formatEuro} width={100} tickLine={false} axisLine={false} />
      <ChartCard.Tooltip />
      {series.map((entry) => (
        <Bar key={entry.key} dataKey={entry.key} fill={seriesColorVar(entry.key)} radius={CHART_BAR_RADIUS}>
          {entry.key === 'budget'
            ? points.map((point) => (
              <Cell
                key={point.costCode}
                fillOpacity={isEstimateBar(point) ? 0.35 : 1}
                stroke={isEstimateBar(point) ? budgetColor : undefined}
                strokeDasharray={isEstimateBar(point) ? '4 3' : undefined}
                strokeWidth={isEstimateBar(point) ? 2 : undefined}
              />
            ))
            : null}
        </Bar>
      ))}
    </BarChart>
  );
}

function useLedgerChart(ledger: ProjectCostLedgerView | null, t: Translate) {
  const points = useMemo(() => (ledger ? toLedgerPoints(ledger.rows, t) : []), [ledger, t]);
  const series = useMemo<ChartSeries<LedgerPoint>[]>(
    () => [
      { key: 'budget', label: t('variance.source.budgetSeries') },
      { key: 'projected', label: t('variance.source.projectedSeries') },
      { key: 'invoiced', label: t('variance.source.invoicedSeries') },
    ],
    [t],
  );
  /** Tooltip, data table and screen reader say the SOURCE with the code (category key = code). */
  const formatCategory = useCallback((value: unknown) => {
    const point = points.find((candidate) => candidate.costCode === value);
    return point ? ledgerCategoryText(point, t) : String(value ?? '');
  }, [points, t]);
  return { points, series, formatCategory, hasEstimate: points.some(isEstimateBar) };
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
  const { points, series, formatCategory, hasEstimate } = useLedgerChart(ledger, t);
  const drillRow = ledger?.rows.find((row) => row.costCode === drillCode) ?? null;
  const shownLedger = ledger && !ledger.isEmpty ? ledger : null;

  const drillInto = useCallback((state: ChartClickState | null) => {
    const point = state?.activePayload?.[0]?.payload;
    if (point) setDrillCode(point.costCode);
  }, []);
  const selectProject = useCallback((projectId: string) => {
    setDrillCode(null);
    onProjectSelect(projectId);
  }, [onProjectSelect]);

  const emptyMessage = !selectedProjectId
    ? t('variance.source.selectProjectPrompt')
    : ledgerError ? t('variance.source.loadError') : t('variance.source.noSources');

  return (
    <ChartCard series={series} data={points} categoryKey="costCode" categoryLabel={t('variance.category')} formatValue={formatEuro} formatCategory={formatCategory}>
      <ChartCard.Header title={t('variance.title')}>
        <ProjectPicker projects={projects} selectedProjectId={selectedProjectId} onSelect={selectProject} t={t} />
      </ChartCard.Header>
      <ChartCard.Figure caption={t('variance.source.caption')} emptyMessage={emptyMessage}>
        <LedgerBars points={points} series={series} formatEuro={formatEuro} onDrill={drillInto} />
      </ChartCard.Figure>
      {hasEstimate ? <p className="text-xs text-muted-foreground">{t('variance.source.estimateLegend')}</p> : null}
      {shownLedger ? <CostLedgerSummary ledger={shownLedger} format={formatEuro} t={t} /> : null}
      {drillRow ? (
        <CostLedgerDrillDown
          row={drillRow}
          label={costCodeLabel(drillRow.costCode, t)}
          source={budgetSourceText(drillRow.budgetSource, t)}
          onClose={() => setDrillCode(null)}
          t={t}
        />
      ) : shownLedger ? <p className="text-sm text-muted-foreground">{t('variance.drillDown.hint')}</p> : null}
      {selectedProjectId ? (
        <ChartCard.Editor>
          <LegacyBudgetVarianceEditor analysis={legacyAnalysis} projects={projects} selectedProjectId={selectedProjectId} onSave={onLegacySave} t={t} />
        </ChartCard.Editor>
      ) : null}
    </ChartCard>
  );
}
