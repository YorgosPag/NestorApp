'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Filter,
  X,
} from 'lucide-react';
import { FilterSelect } from '../FilterSelect';
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
        <div className="relative flex-1 min-w-[250px] max-w-[400px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Αναζήτηση έργων, τίτλων..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <FilterSelect
            value={filterCompany}
            onChange={setFilterCompany}
            options={companies}
            placeholder="Όλες οι εταιρείες"
          />
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
              <X className="w-3 h-3 mr-1" />
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
