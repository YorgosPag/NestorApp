/**
 * @module components/reports/builder/FilterPanel
 * @enterprise ADR-268 — Filter Chips UI + Add Filter
 *
 * Shows active filters as removable chips.
 * "Add Filter" opens an inline FilterRow form.
 */

'use client';

import '@/lib/design-system';
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FilterRow } from './FilterRow';
import {
  BUILDER_LIMITS,
  type DomainDefinition,
  type ReportBuilderFilter,
} from '@/config/report-builder/report-builder-types';

interface FilterPanelProps {
  filters: ReportBuilderFilter[];
  domainDefinition: DomainDefinition;
  onAdd: (filter: Omit<ReportBuilderFilter, 'id'>) => void;
  onRemove: (filterId: string) => void;
  onUpdate: (filterId: string, updates: Partial<Omit<ReportBuilderFilter, 'id'>>) => void;
  onClear: () => void;
}

export function FilterPanel({
  filters,
  domainDefinition,
  onAdd,
  onRemove,
  onUpdate,
  onClear,
}: FilterPanelProps) {
  const { t } = useTranslation('report-builder');
  const [showAddRow, setShowAddRow] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const canAddMore = filters.length < BUILDER_LIMITS.MAX_ACTIVE_FILTERS;

  const handleAddFilter = useCallback(
    (filter: Omit<ReportBuilderFilter, 'id'>) => {
      onAdd(filter);
      setShowAddRow(false);
    },
    [onAdd],
  );

  const handleCancelAdd = useCallback(() => {
    setShowAddRow(false);
  }, []);

  return (
    <section className="space-y-3" aria-label={t('filters.title')}>
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">{t('filters.title')}</h3>
        {filters.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="ml-auto text-xs"
          >
            {t('filters.clear')}
          </Button>
        )}
      </div>

      {/* Active filter chips */}
      {filters.length > 0 && (
        <div className="flex flex-wrap gap-2" role="list" aria-label={t('filters.active')}>
          {filters.map((filter) => (
            <FilterChip
              key={filter.id}
              filter={filter}
              domainDefinition={domainDefinition}
              onRemove={() => onRemove(filter.id)}
              onClick={() => setEditingId(filter.id === editingId ? null : filter.id)}
            />
          ))}
        </div>
      )}

      {/* Edit existing filter */}
      {editingId && (
        <FilterRow
          domainDefinition={domainDefinition}
          existingFilter={filters.find((f) => f.id === editingId)}
          onConfirm={(updated) => {
            onUpdate(editingId, updated);
            setEditingId(null);
          }}
          onCancel={() => setEditingId(null)}
        />
      )}

      {/* Add new filter */}
      {showAddRow ? (
        <FilterRow
          domainDefinition={domainDefinition}
          onConfirm={handleAddFilter}
          onCancel={handleCancelAdd}
        />
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddRow(true)}
          disabled={!canAddMore}
          className="gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('filters.add')}
          {!canAddMore && (
            <span className="text-xs text-muted-foreground">
              ({t('filters.maxReached')})
            </span>
          )}
        </Button>
      )}
    </section>
  );
}

// ============================================================================
// Filter Chip
// ============================================================================

interface FilterChipProps {
  filter: ReportBuilderFilter;
  domainDefinition: DomainDefinition;
  onRemove: () => void;
  onClick: () => void;
}

function FilterChip({ filter, domainDefinition, onRemove, onClick }: FilterChipProps) {
  const { t: tDomains } = useTranslation('report-builder-domains');
  const { t } = useTranslation('report-builder');
  const field = domainDefinition.fields.find((f) => f.key === filter.fieldKey);
  const label = field ? tDomains(field.labelKey) : filter.fieldKey;
  const operatorLabel = t(`operators.${filter.operator}`);
  const valueDisplay = formatFilterValue(filter.value);

  return (
    <Badge
      variant="secondary"
      className="cursor-pointer gap-1 px-2 py-1"
      role="listitem"
    >
      <button type="button" onClick={onClick} className="flex items-center gap-1 text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{operatorLabel}</span>
        <span>{valueDisplay}</span>
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="ml-1 rounded-full p-0.5 hover:bg-destructive/20"
        aria-label={t('filters.remove')}
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

function formatFilterValue(value: ReportBuilderFilter['value']): string {
  if (Array.isArray(value)) {
    if (value.length === 2 && (typeof value[0] === 'number' || typeof value[0] === 'string')) {
      return `${value[0]} – ${value[1]}`;
    }
    return value.join(', ');
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}
