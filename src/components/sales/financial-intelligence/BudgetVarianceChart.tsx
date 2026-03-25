'use client';

/**
 * BudgetVarianceChart — Waterfall chart for budget vs actual
 *
 * Green = under budget, Red = over budget.
 * Includes form for manual data entry per project.
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
  Cell,
  ReferenceLine,
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
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import type {
  BudgetVarianceAnalysis,
  BudgetVarianceEntry,
  ProjectFinancialSummary,
} from '@/types/interest-calculator';

// =============================================================================
// TYPES
// =============================================================================

interface BudgetVarianceChartProps {
  analysis: BudgetVarianceAnalysis | null;
  projects: ProjectFinancialSummary[];
  selectedProjectId: string | null;
  onProjectSelect: (projectId: string) => void;
  onSave: (data: BudgetVarianceSaveData) => Promise<void>;
  t: (key: string) => string;
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

// =============================================================================
// DEFAULT CATEGORIES (Greek construction standard)
// =============================================================================

const DEFAULT_CATEGORIES: { label: string; key: string }[] = [
  { label: 'Land Acquisition', key: 'land' },
  { label: 'Permits & Fees', key: 'permits' },
  { label: 'Foundation', key: 'foundation' },
  { label: 'Structure', key: 'structure' },
  { label: 'Mechanical', key: 'mechanical' },
  { label: 'Finishes', key: 'finishes' },
  { label: 'Marketing', key: 'marketing' },
  { label: 'Legal', key: 'legal' },
  { label: 'Contingency', key: 'contingency' },
];

// =============================================================================
// CHART DATA BUILDER
// =============================================================================

interface WaterfallPoint {
  name: string;
  variance: number;
  fill: string;
  budget: number;
  actual: number;
}

function buildWaterfallData(categories: BudgetVarianceEntry[]): WaterfallPoint[] {
  return categories.map(cat => ({
    name: cat.category,
    variance: cat.variance,
    fill: cat.variance > 0 ? '#ef4444' : '#10b981',
    budget: cat.budgetAmount,
    actual: cat.actualAmount,
  }));
}

// =============================================================================
// FORM
// =============================================================================

function CategoryForm({
  categories,
  onChange,
  onAddRow,
  onRemoveRow,
  t,
}: {
  categories: CategoryInput[];
  onChange: (index: number, field: keyof CategoryInput, value: string | number) => void;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
  t: (key: string) => string;
}) {
  return (
    <section className="space-y-2">
      <header className="grid grid-cols-12 gap-2 text-xs font-medium px-1">
        <span className="col-span-4">{t('variance.category')}</span>
        <span className="col-span-3">{t('variance.budget')}</span>
        <span className="col-span-3">{t('variance.actual')}</span>
        <span className="col-span-2" />
      </header>
      {categories.map((cat, idx) => (
        <fieldset key={idx} className="grid grid-cols-12 gap-2 items-center">
          <Input
            className="col-span-4"
            value={cat.category}
            onChange={e => onChange(idx, 'category', e.target.value)}
            placeholder="Category…"
          />
          <Input
            className="col-span-3"
            type="number"
            value={cat.budgetAmount || ''}
            onChange={e => onChange(idx, 'budgetAmount', Number(e.target.value))}
            placeholder="€ Budget"
          />
          <Input
            className="col-span-3"
            type="number"
            value={cat.actualAmount || ''}
            onChange={e => onChange(idx, 'actualAmount', Number(e.target.value))}
            placeholder="€ Actual"
          />
          <Button
            variant="ghost"
            size="sm"
            className="col-span-2"
            onClick={() => onRemoveRow(idx)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </fieldset>
      ))}
      <Button variant="outline" size="sm" onClick={onAddRow}>
        <Plus className="h-4 w-4 mr-1" />
        {t('variance.addRow')}
      </Button>
    </section>
  );
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
  const colors = useSemanticColors();

  // Form state
  const [categories, setCategories] = useState<CategoryInput[]>(() => {
    if (analysis?.categories) {
      return analysis.categories.map(c => ({
        category: c.category,
        categoryKey: c.categoryKey,
        budgetAmount: c.budgetAmount,
        actualAmount: c.actualAmount,
      }));
    }
    return DEFAULT_CATEGORIES.map(c => ({
      category: c.label,
      categoryKey: c.key,
      budgetAmount: 0,
      actualAmount: 0,
    }));
  });
  const [saving, setSaving] = useState(false);

  // Sync form when analysis changes externally
  React.useEffect(() => {
    if (analysis?.categories) {
      setCategories(analysis.categories.map(c => ({
        category: c.category,
        categoryKey: c.categoryKey,
        budgetAmount: c.budgetAmount,
        actualAmount: c.actualAmount,
      })));
    }
  }, [analysis]);

  const handleChange = useCallback((idx: number, field: keyof CategoryInput, value: string | number) => {
    setCategories(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === 'category') {
        next[idx].categoryKey = String(value).toLowerCase().replace(/\s+/g, '_');
      }
      return next;
    });
  }, []);

  const handleAddRow = useCallback(() => {
    setCategories(prev => [...prev, { category: '', categoryKey: '', budgetAmount: 0, actualAmount: 0 }]);
  }, []);

  const handleRemoveRow = useCallback((idx: number) => {
    setCategories(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleSave = useCallback(async () => {
    const project = projects.find(p => p.projectId === selectedProjectId);
    if (!selectedProjectId || !project) return;
    setSaving(true);
    try {
      await onSave({
        projectId: selectedProjectId,
        projectName: project.projectName,
        categories: categories.filter(c => c.category.trim()),
      });
    } finally {
      setSaving(false);
    }
  }, [selectedProjectId, projects, categories, onSave]);

  const waterfallData = useMemo(() => {
    if (!analysis?.categories) return [];
    return buildWaterfallData(analysis.categories);
  }, [analysis]);

  const euroFormatter = (val: number) => formatCurrencyWhole(val) ?? '';

  return (
    <Card>
      <CardContent className="pt-6">
        <header className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className={cn('text-lg font-semibold', colors.text.primary)}>
            {t('variance.title')}
          </h3>

          <nav className="flex items-center gap-2">
            <Label className="text-sm">{t('variance.project')}</Label>
            <Select
              value={selectedProjectId ?? ''}
              onValueChange={onProjectSelect}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder={t('variance.selectProject')} />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.projectId} value={p.projectId}>
                    {p.projectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </nav>
        </header>

        {/* Chart */}
        {waterfallData.length > 0 && (
          <figure className="h-64 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waterfallData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={euroFormatter} width={100} />
                <RechartsTooltip
                  formatter={(value, _name, item) => {
                    const point = item.payload as WaterfallPoint;
                    return [
                      `Variance: ${euroFormatter(Number(value))} | Budget: ${euroFormatter(point.budget)} | Actual: ${euroFormatter(point.actual)}`,
                      '',
                    ];
                  }}
                />
                <ReferenceLine y={0} stroke="#888" />
                <Bar dataKey="variance" name="Variance">
                  {waterfallData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </figure>
        )}

        {/* Summary row */}
        {analysis && (
          <section className="flex gap-6 mb-6 text-sm flex-wrap">
            <dl className="flex gap-2">
              <dt className={colors.text.muted}>{t('variance.totalBudget')}:</dt>
              <dd className="font-medium">{euroFormatter(analysis.totalBudget)}</dd>
            </dl>
            <dl className="flex gap-2">
              <dt className={colors.text.muted}>{t('variance.totalActual')}:</dt>
              <dd className="font-medium">{euroFormatter(analysis.totalActual)}</dd>
            </dl>
            <dl className="flex gap-2">
              <dt className={colors.text.muted}>{t('variance.totalVariance')}:</dt>
              <dd className="font-medium" style={{ color: analysis.totalVariance > 0 ? '#ef4444' : '#10b981' }}>
                {analysis.totalVariance > 0 ? '+' : ''}{euroFormatter(analysis.totalVariance)} ({analysis.totalVariancePercent}%)
              </dd>
            </dl>
          </section>
        )}

        {/* Form */}
        {selectedProjectId && (
          <section className="space-y-4">
            <CategoryForm
              categories={categories}
              onChange={handleChange}
              onAddRow={handleAddRow}
              onRemoveRow={handleRemoveRow}
              t={t}
            />
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? '…' : t('variance.save')}
            </Button>
          </section>
        )}

        {!selectedProjectId && (
          <p className={cn('text-center py-4 text-sm', colors.text.muted)}>
            {t('variance.selectProjectPrompt')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
