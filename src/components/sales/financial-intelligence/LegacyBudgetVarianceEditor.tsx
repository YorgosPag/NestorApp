'use client';

/**
 * LegacyBudgetVarianceEditor — the old hand-typed budget/actual rows (SPEC-242C §3.2).
 *
 * ⚠️ Retiring (ADR-917 Φ5): since Φ2 the chart reads the cost ledger from source
 * documents and these values feed NOTHING on screen. Kept — collapsed — only until
 * the stored `settings/budget_variance_*` budgets migrate to project budget lines
 * (ADR-917 §4 Ζ3). Do not extend it.
 *
 * @enterprise SPEC-242C — Portfolio Dashboard
 * @see ADR-917 §5 Φ5
 */

import { useCallback } from 'react';
import {
  ChartCardEditor,
  useEntrySubmit,
  useRepeatingRows,
} from '@/components/ui/chart-card';
import { Input } from '@/components/ui/input';
import { NumericField } from '@/components/ui/numeric-field';
import type {
  BudgetVarianceAnalysis,
  BudgetVarianceEntry,
  ProjectFinancialSummary,
} from '@/types/interest-calculator';

// =============================================================================
// TYPES
// =============================================================================

export interface BudgetVarianceSaveData {
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

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface LegacyBudgetVarianceEditorProps {
  analysis: BudgetVarianceAnalysis | null;
  projects: ProjectFinancialSummary[];
  selectedProjectId: string;
  onSave: (data: BudgetVarianceSaveData) => Promise<void>;
  t: Translate;
}

// =============================================================================
// CONSTANTS + DERIVATIONS
// =============================================================================

/** Keys of the retiring hand-typed form — labels are translations. */
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

function toCategoryInput(entry: BudgetVarianceEntry): CategoryInput {
  return {
    category: entry.category,
    categoryKey: entry.categoryKey,
    budgetAmount: entry.budgetAmount,
    actualAmount: entry.actualAmount,
  };
}

/** Stored keys are slugs of the typed label, so a renamed category stays traceable. */
function toCategoryKey(label: string): string {
  return label.toLowerCase().replace(/\s+/g, '_');
}

// =============================================================================
// COMPONENT
// =============================================================================

export function LegacyBudgetVarianceEditor({
  analysis,
  projects,
  selectedProjectId,
  onSave,
  t,
}: LegacyBudgetVarianceEditorProps) {
  const rows = useRepeatingRows<CategoryInput>({
    // Rebuild only when a different project is loaded — never mid-typing.
    seedKey: `${selectedProjectId}:${analysis ? 'stored' : 'blank'}`,
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
      if (!project) return;
      await onSave({
        projectId: selectedProjectId,
        projectName: project.projectName,
        categories: categories.filter((category) => category.category.trim()),
      });
    },
  });

  return (
    <ChartCardEditor.Disclosure triggerLabel={t('variance.legacy.trigger')}>
      {() => (
        <>
          <p className="text-sm text-muted-foreground">{t('variance.legacy.notice')}</p>
          <CategoryRows rows={rows} t={t} />
          <ChartCardEditor.Actions>
            <ChartCardEditor.Submit
              label={t('variance.save')}
              pending={submitting}
              onClick={() => void submit([...rows.rows])}
            />
          </ChartCardEditor.Actions>
        </>
      )}
    </ChartCardEditor.Disclosure>
  );
}

// =============================================================================
// ROW EDITOR — the fields of one budget row, and nothing else
// =============================================================================

interface CategoryRowsProps {
  rows: ReturnType<typeof useRepeatingRows<CategoryInput>>;
  t: Translate;
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
