'use client';

/**
 * BudgetVarianceChart — variance of actual against budget, per cost category.
 *
 * Renders through the ADR-710 chart card shell. Everything this file used to own
 * about *being a card* — the Card/CardContent frame, the header, the sized figure,
 * the recharts responsive wrapper, the empty state, the row editor chrome, the
 * saving flag — now comes from `@/components/ui/chart-card`. What remains here is
 * what is genuinely about budget variance: the categories, the waterfall points,
 * and the fields of one budget row.
 *
 * @enterprise SPEC-242C — Portfolio Dashboard
 * @enterprise ADR-710 — Chart card shell
 */

import { useCallback, useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CHART_BAR_RADIUS,
  ChartCard,
  ChartCardEditor,
  chartPolarityColor,
  chartPolarityTone,
  useEntrySubmit,
  useRepeatingRows,
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
import { formatCurrencyWhole } from '@/lib/intl-utils';
import type {
  BudgetVarianceAnalysis,
  BudgetVarianceEntry,
  ProjectFinancialSummary,
} from '@/types/interest-calculator';
import '@/lib/design-system';

// =============================================================================
// TYPES
// =============================================================================

interface BudgetVarianceChartProps {
  analysis: BudgetVarianceAnalysis | null;
  projects: ProjectFinancialSummary[];
  selectedProjectId: string | null;
  onProjectSelect: (projectId: string) => void;
  onSave: (data: BudgetVarianceSaveData) => Promise<void>;
  t: (key: string, options?: Record<string, unknown>) => string;
}

interface BudgetVarianceSaveData {
  projectId: string;
  projectName: string;
  categories: CategoryInput[];
}

interface CategoryInput {
  category: string;
  categoryKey: string;
  budgetAmount: number;
  actualAmount: number;
}

interface WaterfallPoint {
  name: string;
  variance: number;
  budget: number;
  actual: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Cost breakdown of a Greek construction project. Keys only — the labels are
 * translations, so a locale change does not rewrite stored `categoryKey` values.
 */
const DEFAULT_CATEGORY_KEYS = [
  'land',
  'permits',
  'foundation',
  'structure',
  'mechanical',
  'finishes',
  'marketing',
  'legal',
  'contingency',
] as const;

/** Spending above plan is the bad direction — see `chartPolarityTone`. */
const VARIANCE_POLARITY = 'lower-is-better' as const;

// =============================================================================
// DERIVATIONS
// =============================================================================

function toCategoryInput(entry: BudgetVarianceEntry): CategoryInput {
  return {
    category: entry.category,
    categoryKey: entry.categoryKey,
    budgetAmount: entry.budgetAmount,
    actualAmount: entry.actualAmount,
  };
}

function buildWaterfallData(categories: BudgetVarianceEntry[]): WaterfallPoint[] {
  return categories.map((category) => ({
    name: category.category,
    variance: category.variance,
    budget: category.budgetAmount,
    actual: category.actualAmount,
  }));
}

/** Stored keys are slugs of the typed label, so a renamed category stays traceable. */
function toCategoryKey(label: string): string {
  return label.toLowerCase().replace(/\s+/g, '_');
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function BudgetVarianceChart({
  analysis,
  projects,
  selectedProjectId,
  onProjectSelect,
  onSave,
  t,
}: BudgetVarianceChartProps) {
  const formatEuro = useCallback((value: number) => formatCurrencyWhole(value) ?? '', []);

  const waterfallData = useMemo(
    () => (analysis?.categories ? buildWaterfallData(analysis.categories) : []),
    [analysis],
  );

  const series = useMemo<ChartSeries<WaterfallPoint>[]>(
    () => [{ key: 'variance', label: t('variance.totalVariance') }],
    [t],
  );

  const rows = useRepeatingRows<CategoryInput>({
    // Rebuild only when a different project is loaded — never mid-typing.
    seedKey: selectedProjectId ?? '',
    seed: () =>
      analysis?.categories?.length
        ? analysis.categories.map(toCategoryInput)
        : DEFAULT_CATEGORY_KEYS.map((key) => ({
            category: t(`variance.defaultCategories.${key}`),
            categoryKey: key,
            budgetAmount: 0,
            actualAmount: 0,
          })),
    createRow: () => ({ category: '', categoryKey: '', budgetAmount: 0, actualAmount: 0 }),
  });

  const { submitting, submit } = useEntrySubmit<CategoryInput[]>({
    isValid: () => Boolean(selectedProjectId),
    onSubmit: async (categories) => {
      const project = projects.find((entry) => entry.projectId === selectedProjectId);
      if (!selectedProjectId || !project) return;
      await onSave({
        projectId: selectedProjectId,
        projectName: project.projectName,
        categories: categories.filter((category) => category.category.trim()),
      });
    },
  });

  return (
    <ChartCard
      series={series}
      data={waterfallData}
      categoryKey="name"
      categoryLabel={t('variance.category')}
      formatValue={formatEuro}
    >
      <ChartCard.Header title={t('variance.title')}>
        <nav className="flex items-center gap-2">
          <Label className="text-sm">{t('variance.project')}</Label>
          <Select value={selectedProjectId ?? ''} onValueChange={onProjectSelect}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t('variance.selectProject')} />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.projectId} value={project.projectId}>
                  {project.projectName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </nav>
      </ChartCard.Header>

      <ChartCard.Figure
        caption={t('variance.caption')}
        emptyMessage={t('variance.emptyState')}
      >
        <BarChart data={waterfallData}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} />
          <YAxis tickFormatter={formatEuro} width={100} tickLine={false} axisLine={false} />
          <ChartCard.Tooltip />
          <ReferenceLine y={0} stroke="hsl(var(--border))" />
          <Bar dataKey="variance" radius={CHART_BAR_RADIUS}>
            {waterfallData.map((point) => (
              <Cell
                key={point.name}
                fill={chartPolarityColor(point.variance, VARIANCE_POLARITY)}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartCard.Figure>

      {analysis ? (
        <ChartCard.Summary>
          <ChartCard.SummaryItem
            label={t('variance.totalBudget')}
            value={formatEuro(analysis.totalBudget)}
          />
          <ChartCard.SummaryItem
            label={t('variance.totalActual')}
            value={formatEuro(analysis.totalActual)}
          />
          <ChartCard.SummaryItem
            label={t('variance.totalVariance')}
            value={`${analysis.totalVariance > 0 ? '+' : ''}${formatEuro(analysis.totalVariance)} (${analysis.totalVariancePercent}%)`}
            tone={chartPolarityTone(analysis.totalVariance, VARIANCE_POLARITY)}
          />
        </ChartCard.Summary>
      ) : null}

      {selectedProjectId ? (
        <ChartCard.Editor>
          <CategoryRows rows={rows} t={t} />
          <ChartCardEditor.Actions>
            <ChartCardEditor.Submit
              label={t('variance.save')}
              pending={submitting}
              onClick={() => void submit([...rows.rows])}
            />
          </ChartCardEditor.Actions>
        </ChartCard.Editor>
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {t('variance.selectProjectPrompt')}
        </p>
      )}
    </ChartCard>
  );
}

// =============================================================================
// ROW EDITOR — the fields of one budget row, and nothing else
// =============================================================================

interface CategoryRowsProps {
  rows: ReturnType<typeof useRepeatingRows<CategoryInput>>;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function CategoryRows({ rows, t }: CategoryRowsProps) {
  const { rows: categories, updateRow, addRow, removeRow } = rows;

  const renameCategory = useCallback(
    (index: number, label: string) =>
      updateRow(index, { category: label, categoryKey: toCategoryKey(label) }),
    [updateRow],
  );

  return (
    <ChartCardEditor.Rows>
      <ChartCardEditor.RowHeader>
        <span className="col-span-4">{t('variance.category')}</span>
        <span className="col-span-3">{t('variance.budget')}</span>
        <span className="col-span-3">{t('variance.actual')}</span>
        <span className="col-span-2" />
      </ChartCardEditor.RowHeader>

      {categories.map((category, index) => (
        <ChartCardEditor.Row key={`${category.categoryKey}-${index}`}>
          {/* The column headers above name these cells — hence aria-label, not a
              placeholder repeated on every row. */}
          <Input
            className="col-span-4"
            value={category.category}
            onChange={(event) => renameCategory(index, event.target.value)}
            aria-label={t('variance.category')}
          />
          <NumericField
            className="col-span-3"
            value={category.budgetAmount}
            onValueChange={(budgetAmount) => updateRow(index, { budgetAmount })}
            blankValue={0}
            min={0}
            step={0.01}
            aria-label={t('variance.budget')}
          />
          <NumericField
            className="col-span-3"
            value={category.actualAmount}
            onValueChange={(actualAmount) => updateRow(index, { actualAmount })}
            blankValue={0}
            min={0}
            step={0.01}
            aria-label={t('variance.actual')}
          />
          <ChartCardEditor.Remove
            className="col-span-2"
            label={t('variance.removeRow')}
            onClick={() => removeRow(index)}
          />
        </ChartCardEditor.Row>
      ))}

      <ChartCardEditor.AddRow label={t('variance.addRow')} onClick={addRow} />
    </ChartCardEditor.Rows>
  );
}
