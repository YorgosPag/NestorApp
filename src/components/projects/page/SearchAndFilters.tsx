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
import { PROJECT_STATUS_LABELS } from '@/types/project';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';

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
  const iconSizes = useIconSizes();
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
            placeholder="Αναζήτηση έργων, τίτλων..."
            debounceMs={300}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className={`${iconSizes.sm} text-muted-foreground`} />
          <FilterSelect
            value={filterCompany}
            onChange={setFilterCompany}
            options={companies}
            placeholder="Όλες οι εταιρείες"
          />
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
              <X className={`${iconSizes.xs} mr-1`} />
              Καθαρισμός
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
              Όλες οι καταστάσεις
            </TabsTrigger>
            {Object.entries(PROJECT_STATUS_LABELS).map(([key, label]) => (
              <TabsTrigger
                key={key}
                value={key}
                className={`text-xs data-[state=active]:bg-orange-500 data-[state=active]:text-white ${INTERACTIVE_PATTERNS.ACCENT_HOVER}`}
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
