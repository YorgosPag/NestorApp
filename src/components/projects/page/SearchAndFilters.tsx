'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  Filter,
  X,
} from 'lucide-react';
import { FilterSelect } from '../FilterSelect';
import { PROJECT_STATUS_LABELS } from '@/types/project';

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
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[300px]">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Αναζήτηση έργων, τίτλων..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <FilterSelect
          value={filterCompany}
          onChange={(e) => setFilterCompany(e.target.value)}
          options={companies}
          placeholder="Όλες οι εταιρείες"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-9 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="all">Όλες οι καταστάσεις</option>
          {Object.entries(PROJECT_STATUS_LABELS).map(([key, label]) => (
             <option key={key} value={key}>{label}</option>
          ))}
        </select>
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
