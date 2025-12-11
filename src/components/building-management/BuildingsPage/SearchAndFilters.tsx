
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  Filter,
  X,
} from 'lucide-react';
import { FilterSelect } from './FilterSelect';

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
      <div className="relative flex-1 min-w-[300px]">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Αναζήτηση κτιρίων, διευθύνσεων, περιγραφών..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
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
          placeholder="Όλα τα έργα"
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
          placeholder="Όλες οι καταστάσεις"
        />
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
            <X className="w-3 h-3 mr-1" />
            Καθαρισμός
          </Button>
        )}
      </div>
    </div>
  );
}
