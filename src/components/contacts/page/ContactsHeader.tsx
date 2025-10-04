'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users,
  Search,
  Filter,
  LayoutGrid,
  List,
  Plus,
  BarChart3,
  X,
  Hash,
  Ruler
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { UnitsCountFilter, AreaFilter, ContactTypeFilter, ViewMode } from '@/hooks/useContactsState';


interface ContactsHeaderProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterType: ContactTypeFilter;
  setFilterType: (type: ContactTypeFilter) => void;
  showOnlyOwners: boolean;
  onShowOnlyOwnersChange: (checked: boolean) => void;
  unitsCountFilter: UnitsCountFilter;
  setUnitsCountFilter: (filter: UnitsCountFilter) => void;
  areaFilter: AreaFilter;
  setAreaFilter: (filter: AreaFilter) => void;
}

export function ContactsHeader({
  viewMode,
  setViewMode,
  showDashboard,
  setShowDashboard,
  searchTerm,
  setSearchTerm,
  filterType,
  setFilterType,
  showOnlyOwners,
  onShowOnlyOwnersChange,
  unitsCountFilter,
  setUnitsCountFilter,
  areaFilter,
  setAreaFilter,
}: ContactsHeaderProps) {
    const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);

    // Debounce search term
    useEffect(() => {
        const handler = setTimeout(() => {
            setSearchTerm(localSearchTerm);
        }, 250);

        return () => {
            clearTimeout(handler);
        };
    }, [localSearchTerm, setSearchTerm]);

    // Update local search term when the global one changes (e.g., on clear)
    useEffect(() => {
        setLocalSearchTerm(searchTerm);
    }, [searchTerm]);

    const hasActiveFilters = searchTerm !== '' || filterType !== 'all' || showOnlyOwners || unitsCountFilter !== 'all' || areaFilter !== 'all';

    const clearFilters = useCallback(() => {
        setLocalSearchTerm('');
        setSearchTerm('');
        setFilterType('all');
        onShowOnlyOwnersChange(false);
        setUnitsCountFilter('all');
        setAreaFilter('all');
    }, [setSearchTerm, setFilterType, onShowOnlyOwnersChange, setUnitsCountFilter, setAreaFilter]);

    const toggleDashboard = useCallback(() => setShowDashboard(v => !v), [setShowDashboard]);
    const switchToList = useCallback(() => setViewMode('list'), [setViewMode]);
    const switchToGrid = useCallback(() => setViewMode('grid'), [setViewMode]);
    
  return (
    <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Διαχείριση Επαφών</h1>
              <p className="text-sm text-muted-foreground">
                Κεντρικό ευρετήριο όλων των επαφών σας
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showDashboard ? 'default' : 'outline'}
                  size="sm"
                  onClick={toggleDashboard}
                  aria-label="Εναλλαγή Dashboard"
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
              </TooltipTrigger>
              <TooltipContent>Εμφάνιση/Απόκρυψη Dashboard</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={switchToList}
                  aria-label="Προβολή Λίστας"
                >
                  <List className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Προβολή Λίστας</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={switchToGrid}
                  aria-label="Προβολή Πλέγματος"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Προβολή Πλέγματος</TooltipContent>
            </Tooltip>
            <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              Νέα Επαφή
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[300px]">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      aria-label="Αναζήτηση επαφών"
                      placeholder="Αναζήτηση επαφών..."
                      value={localSearchTerm}
                      onChange={(e) => setLocalSearchTerm(e.target.value)}
                      className="pl-10 h-9"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as ContactTypeFilter)}
                        className="h-9 px-3 rounded-md border border-input bg-background text-sm"
                        >
                        <option value="all">Όλοι οι τύποι</option>
                        <option value="individual">Φυσικά Πρόσωπα</option>
                        <option value="company">Νομικά Πρόσωπα</option>
                        <option value="service">Υπηρεσίες</option>
                    </select>
                    {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-9">
                        <X className="w-3 h-3 mr-1" />
                        Καθαρισμός
                    </Button>
                    )}
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
                 <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="show-owners-only" 
                    checked={showOnlyOwners}
                    onCheckedChange={(checked) => onShowOnlyOwnersChange(!!checked)}
                  />
                  <Label htmlFor="show-owners-only" className="text-sm font-medium whitespace-nowrap">
                    Μόνο με ιδιοκτησίες
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-muted-foreground" />
                    <Select value={unitsCountFilter} onValueChange={setUnitsCountFilter}>
                        <SelectTrigger className="h-9 text-sm w-[180px]">
                            <SelectValue placeholder="Πλήθος μονάδων" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Όλες οι μονάδες</SelectItem>
                            <SelectItem value="1-2">1-2 μονάδες</SelectItem>
                            <SelectItem value="3-5">3-5 μονάδες</SelectItem>
                            <SelectItem value="6+">6+ μονάδες</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-muted-foreground" />
                    <Select value={areaFilter} onValueChange={setAreaFilter}>
                        <SelectTrigger className="h-9 text-sm w-[180px]">
                            <SelectValue placeholder="Συνολικό εμβαδόν" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Όλα τα εμβαδά</SelectItem>
                            <SelectItem value="0-100">Έως 100 τ.μ.</SelectItem>
                            <SelectItem value="101-300">101 - 300 τ.μ.</SelectItem>
                            <SelectItem value="301+">301+ τ.μ.</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    </div>
  );
}
