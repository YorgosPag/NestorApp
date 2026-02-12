/**
 * BOQFilterBar — Filter controls for BOQ items
 *
 * Uses Radix Select (ADR-001) for dropdowns, Input for search.
 *
 * @module components/building-management/tabs/MeasurementsTabContent/BOQFilterBar
 * @see ADR-175 §4.4.3 (Filter Bar)
 */

'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { BOQUIFilters } from '@/hooks/useBOQItems';
import type { MasterBOQCategory } from '@/config/boq-categories';
import { Search } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface BOQFilterBarProps {
  filters: BOQUIFilters;
  onFiltersChange: (filters: Partial<BOQUIFilters>) => void;
  categories: readonly MasterBOQCategory[];
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BOQFilterBar({ filters, onFiltersChange, categories }: BOQFilterBarProps) {
  const { t } = useTranslation('building');

  return (
    <nav
      aria-label={t('tabs.measurements.filters.scope')}
      className="flex flex-wrap items-center gap-3"
    >
      {/* Scope filter */}
      <Select
        value={filters.scope}
        onValueChange={(value) =>
          onFiltersChange({ scope: value as BOQUIFilters['scope'] })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder={t('tabs.measurements.filters.scope')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('tabs.measurements.filters.scopeAll')}</SelectItem>
          <SelectItem value="building">{t('tabs.measurements.filters.scopeBuilding')}</SelectItem>
          <SelectItem value="unit">{t('tabs.measurements.filters.scopeUnit')}</SelectItem>
        </SelectContent>
      </Select>

      {/* Status filter */}
      <Select
        value={filters.status}
        onValueChange={(value) =>
          onFiltersChange({ status: value as BOQUIFilters['status'] })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder={t('tabs.measurements.filters.status')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('tabs.measurements.filters.statusAll')}</SelectItem>
          <SelectItem value="draft">{t('tabs.measurements.status.draft')}</SelectItem>
          <SelectItem value="submitted">{t('tabs.measurements.status.submitted')}</SelectItem>
          <SelectItem value="approved">{t('tabs.measurements.status.approved')}</SelectItem>
          <SelectItem value="certified">{t('tabs.measurements.status.certified')}</SelectItem>
          <SelectItem value="locked">{t('tabs.measurements.status.locked')}</SelectItem>
        </SelectContent>
      </Select>

      {/* Category filter */}
      <Select
        value={filters.categoryCode || 'all'}
        onValueChange={(value) =>
          onFiltersChange({ categoryCode: value === 'all' ? '' : value })
        }
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder={t('tabs.measurements.filters.category')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('tabs.measurements.filters.categoryAll')}</SelectItem>
          {categories.map((cat) => (
            <SelectItem key={cat.code} value={cat.code}>
              {cat.code} — {cat.nameEL}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Search */}
      <fieldset className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={filters.searchQuery}
          onChange={(e) => onFiltersChange({ searchQuery: e.target.value })}
          placeholder={t('tabs.measurements.filters.search')}
          className="pl-9"
        />
      </fieldset>
    </nav>
  );
}
