'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SearchInput } from '@/components/ui/search';
import {
  Filter,
  X,
} from 'lucide-react';
import { FilterSelect } from '../FilterSelect';
import { useIconSizes } from '@/hooks/useIconSizes';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { PROJECT_STATUS_LABELS } from '@/types/project';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface SearchAndFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterCompany: string;
  setFilterCompany: (company: string) => void;
  companies: { id: string; name: string }[];
  filterStatus: string;
  setFilterStatus: (status: string) => void;
}

export function SearchAndFilters({
  searchTerm,
  setSearchTerm,
  filterCompany,
  setFilterCompany,
  companies,
  filterStatus,
  setFilterStatus,
}: SearchAndFiltersProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: Centralized spacing tokens
  const spacing = useSpacingTokens();
  const hasActiveFilters =
    filterCompany !== 'all' ||
    filterStatus !== 'all' ||
    searchTerm !== '';

  const clearFilters = () => {
    setFilterCompany('all');
    setFilterStatus('all');
    setSearchTerm('');
  };

  return (
    <div className="space-y-3">
      {/* Search and basic filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[250px] max-w-[400px]">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={t('search.placeholder')}
            debounceMs={300}
          />
        </div>
        <div className={cn("flex items-center flex-wrap", spacing.gap.sm)}>
          <Filter className={`${iconSizes.sm} text-muted-foreground`} />
          <FilterSelect
            value={filterCompany}
            onChange={setFilterCompany}
            options={companies}
            placeholder={t('search.allCompanies')}
          />
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
              <X className={`${iconSizes.xs} mr-1`} />
              {t('search.clear')}
            </Button>
          )}
        </div>
      </div>

      {/* Status filter tabs */}
      <div>
        <Tabs value={filterStatus} onValueChange={setFilterStatus}>
          <TabsList className="w-auto">
            <TabsTrigger
              value="all"
              className={`text-xs data-[state=active]:bg-orange-500 data-[state=active]:text-white ${INTERACTIVE_PATTERNS.ACCENT_HOVER}`}
            >
              {t('search.allStatuses')}
            </TabsTrigger>
            {Object.entries(PROJECT_STATUS_LABELS).map(([key, label]) => {
              // 🏢 ENTERPRISE: Convert snake_case to camelCase for i18n key
              const i18nKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
              return (
                <TabsTrigger
                  key={key}
                  value={key}
                  className={`text-xs data-[state=active]:bg-orange-500 data-[state=active]:text-white ${INTERACTIVE_PATTERNS.ACCENT_HOVER}`}
                >
                  {t(`status.${i18nKey}`)}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
