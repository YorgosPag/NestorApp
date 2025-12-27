
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search';
import {
  Filter,
  X,
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { FilterSelect } from './FilterSelect';
import { PROPERTY_FILTER_LABELS } from '@/constants/property-statuses-enterprise';

interface SearchAndFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterCompany: string;
  setFilterCompany: (company: string) => void;
  companies: { id: string; name: string }[];
  filterProject: string;
  setFilterProject: (project: string) => void;
  projects: { id: string; name: string }[];
  filterStatus: string;
  setFilterStatus: (status: string) => void;
}

export function SearchAndFilters({
  searchTerm,
  setSearchTerm,
  filterCompany,
  setFilterCompany,
  companies,
  filterProject,
  setFilterProject,
  projects,
  filterStatus,
  setFilterStatus,
}: SearchAndFiltersProps) {
  const iconSizes = useIconSizes();
  const hasActiveFilters =
    filterCompany !== 'all' ||
    filterProject !== 'all' ||
    filterStatus !== 'all' ||
    searchTerm !== '';

  const clearFilters = () => {
    setFilterCompany('all');
    setFilterProject('all');
    setFilterStatus('all');
    setSearchTerm('');
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex-1 min-w-[300px]">
        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Αναζήτηση κτιρίων, διευθύνσεων, περιγραφών..."
          debounceMs={300}
        />
      </div>
      <div className="flex items-center gap-2">
        <Filter className={`${iconSizes.sm} text-muted-foreground`} />
        <FilterSelect
          value={filterCompany}
          onChange={setFilterCompany}
          options={companies}
          placeholder="Όλες οι εταιρείες"
        />
        <FilterSelect
          value={filterProject}
          onChange={setFilterProject}
          options={projects}
          placeholder={PROPERTY_FILTER_LABELS.ALL_PROJECTS}
        />
        <FilterSelect
          value={filterStatus}
          onChange={setFilterStatus}
          options={[
            { id: 'active', name: 'active' },
            { id: 'construction', name: 'construction' },
            { id: 'planned', name: 'planned' },
            { id: 'completed', name: 'completed' }
          ]}
          placeholder={PROPERTY_FILTER_LABELS.ALL_STATUSES}
        />
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
            <X className={`${iconSizes.xs} mr-1`} />
            Καθαρισμός
          </Button>
        )}
      </div>
    </div>
  );
}
