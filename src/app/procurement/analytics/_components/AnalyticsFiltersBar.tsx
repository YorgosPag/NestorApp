'use client';

/**
 * AnalyticsFiltersBar — 5-filter row for the spend analytics page (ADR-331 D2).
 *
 * Filters: date range (from/to) · project · supplier · ATOE category · status.
 * Multi-select fields use the `MultiCombobox` SSoT (Phase B0). Status field
 * exposes preset chips (D12) for `inProgress` / `completed` / `cancelled`.
 * Mobile (<sm) collapses the bar into a "Filters ▼" toggle (D19).
 *
 * @see ADR-331 §2.2, §4 D2, D12, D19, D29
 */

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiCombobox, type MultiComboboxOption } from '@/components/ui/multi-combobox';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useProjectsList } from '@/hooks/useProjectsList';
import { usePOSupplierContacts } from '@/hooks/procurement';
import { useAuth } from '@/auth/contexts/AuthContext';
import type { SpendAnalyticsFilters } from '@/services/procurement/aggregators/spendAnalyticsAggregator';
import { getCurrentQuarterRange } from '@/lib/date/quarter-helpers';

const ATOE_CODES = [
  'OIK-1', 'OIK-2', 'OIK-3', 'OIK-4', 'OIK-5', 'OIK-6',
  'OIK-7', 'OIK-8', 'OIK-9', 'OIK-10', 'OIK-11', 'OIK-12',
] as const;

const STATUS_VALUES = [
  'draft', 'approved', 'ordered', 'partially_delivered',
  'delivered', 'closed', 'cancelled',
] as const;

const STATUS_PRESETS = {
  inProgress: ['draft', 'approved', 'ordered', 'partially_delivered'],
  completed: ['delivered', 'closed'],
  cancelled: ['cancelled'],
} as const satisfies Record<string, readonly string[]>;

type StatusPresetKey = keyof typeof STATUS_PRESETS;

interface AnalyticsFiltersBarProps {
  filters: SpendAnalyticsFilters;
  onChange: (partial: Partial<SpendAnalyticsFilters>) => void;
}

// ============================================================================
// SUB: Date range
// ============================================================================

function DateRangeFields({ filters, onChange }: AnalyticsFiltersBarProps) {
  const { t } = useTranslation('procurement');
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:gap-2">
      <div className="space-y-1">
        <Label htmlFor="analytics-from" className="text-xs">{t('analytics.filters.from')}</Label>
        <Input
          id="analytics-from"
          type="date"
          value={filters.from}
          onChange={(e) => onChange({ from: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="analytics-to" className="text-xs">{t('analytics.filters.to')}</Label>
        <Input
          id="analytics-to"
          type="date"
          value={filters.to}
          onChange={(e) => onChange({ to: e.target.value })}
        />
      </div>
    </div>
  );
}

// ============================================================================
// SUB: Status preset chips
// ============================================================================

interface StatusPresetChipsProps {
  active: readonly string[];
  onApply: (values: readonly string[]) => void;
}

function StatusPresetChips({ active, onApply }: StatusPresetChipsProps) {
  const { t } = useTranslation('procurement');
  const activeSet = useMemo(() => new Set(active), [active]);

  const isPresetActive = (key: StatusPresetKey): boolean => {
    const preset = STATUS_PRESETS[key];
    if (preset.length !== activeSet.size) return false;
    return preset.every((v) => activeSet.has(v));
  };

  return (
    <div role="group" aria-label={t('analytics.filters.statusPresets.label')} className="flex flex-wrap gap-1.5">
      {(Object.keys(STATUS_PRESETS) as StatusPresetKey[]).map((key) => {
        const isActive = isPresetActive(key);
        return (
          <Button
            key={key}
            type="button"
            size="xs"
            variant={isActive ? 'default' : 'outline'}
            onClick={() => onApply(STATUS_PRESETS[key])}
          >
            {t(`analytics.filters.statusPresets.${key}`)}
          </Button>
        );
      })}
    </div>
  );
}

// ============================================================================
// SUB: filter content (shared between desktop + mobile drawer)
// ============================================================================

function FilterFields({ filters, onChange }: AnalyticsFiltersBarProps) {
  const { t } = useTranslation('procurement');
  const { isAuthenticated, loading: authLoading } = useAuth();
  const authReady = !authLoading && isAuthenticated;
  const { projects } = useProjectsList({ enabled: authReady });
  const { suppliers } = usePOSupplierContacts();

  const projectOptions = useMemo<MultiComboboxOption[]>(
    () => projects.map((p) => ({ value: p.id, label: p.name })),
    [projects],
  );
  const supplierOptions = useMemo<MultiComboboxOption[]>(
    () => suppliers.map((s) => ({
      value: s.id,
      label: s.displayName ?? s.companyName ?? s.id,
    })),
    [suppliers],
  );
  const categoryOptions = useMemo<MultiComboboxOption[]>(
    () => ATOE_CODES.map((c) => ({ value: c, label: t(`categories.${c}`) })),
    [t],
  );
  const statusOptions = useMemo<MultiComboboxOption[]>(
    () => STATUS_VALUES.map((s) => ({ value: s, label: t(`status.${s}`) })),
    [t],
  );

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1">
        <Label className="text-xs">{t('analytics.filters.project')}</Label>
        <MultiCombobox
          value={filters.projectId}
          onChange={(v) => onChange({ projectId: v })}
          options={projectOptions}
          placeholder={t('analytics.filters.allProjects')}
          ariaLabel={t('analytics.filters.project')}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('analytics.filters.supplier')}</Label>
        <MultiCombobox
          value={filters.supplierId}
          onChange={(v) => onChange({ supplierId: v })}
          options={supplierOptions}
          placeholder={t('analytics.filters.allSuppliers')}
          ariaLabel={t('analytics.filters.supplier')}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('analytics.filters.category')}</Label>
        <MultiCombobox
          value={filters.categoryCode}
          onChange={(v) => onChange({ categoryCode: v })}
          options={categoryOptions}
          placeholder={t('analytics.filters.allCategories')}
          ariaLabel={t('analytics.filters.category')}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('analytics.filters.status')}</Label>
        <StatusPresetChips active={filters.status} onApply={(v) => onChange({ status: [...v] })} />
        <MultiCombobox
          value={filters.status}
          onChange={(v) => onChange({ status: v })}
          options={statusOptions}
          placeholder={t('analytics.filters.allStatuses')}
          ariaLabel={t('analytics.filters.status')}
        />
      </div>
    </div>
  );
}

// ============================================================================
// MAIN
// ============================================================================

function clearFilters(onChange: AnalyticsFiltersBarProps['onChange']): void {
  const defaults = getCurrentQuarterRange(new Date());
  onChange({
    from: defaults.from,
    to: defaults.to,
    projectId: [],
    supplierId: [],
    categoryCode: [],
    status: [],
  });
}

export function AnalyticsFiltersBar({ filters, onChange }: AnalyticsFiltersBarProps) {
  const { t } = useTranslation('procurement');
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <section aria-label={t('analytics.filters.toggleMobile')} className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between sm:hidden">
        <Button type="button" variant="ghost" size="sm" onClick={() => setMobileOpen((v) => !v)}>
          {t('analytics.filters.toggleMobile')}
          {mobileOpen ? <ChevronUp className="ml-2 h-4 w-4" aria-hidden /> : <ChevronDown className="ml-2 h-4 w-4" aria-hidden />}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => clearFilters(onChange)}>
          <X className="mr-1 h-3.5 w-3.5" aria-hidden />
          {t('analytics.filters.clear')}
        </Button>
      </div>

      <div className={mobileOpen ? 'block sm:block' : 'hidden sm:block'}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <DateRangeFields filters={filters} onChange={onChange} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => clearFilters(onChange)}
            className="hidden sm:inline-flex"
          >
            <X className="mr-1 h-3.5 w-3.5" aria-hidden />
            {t('analytics.filters.clear')}
          </Button>
        </div>
        <div className="mt-3">
          <FilterFields filters={filters} onChange={onChange} />
        </div>
      </div>
    </section>
  );
}
