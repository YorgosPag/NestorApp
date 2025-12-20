'use client';

import React from 'react';
import { getAllEnhancedStatuses as getAllStatuses, getStatusLabel } from '@/constants/property-statuses-enterprise';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import type { FilterState } from '@/types/property-viewer';

interface FilterControlsProps {
    filters: FilterState;
    onFilterChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
    onRangeChange: (key: 'priceRange' | 'areaRange', subKey: 'min' | 'max', value: string) => void;
}

export function FilterControls({ filters, onFilterChange, onRangeChange }: FilterControlsProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        <div className="flex items-center gap-2">
          <Label htmlFor="search" className="text-xs font-medium shrink-0">Αναζήτηση</Label>
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              aria-label="Αναζήτηση με όνομα ή περιγραφή"
              placeholder="Όνομα, περιγραφή..."
              className="pl-9 h-9"
              value={filters.searchTerm}
              onChange={(e) => onFilterChange('searchTerm', e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium shrink-0">Εύρος Τιμής (€)</Label>
          <Input
            type="number"
            aria-label="Ελάχιστη τιμή"
            placeholder="Από"
            className="h-9"
            value={filters.priceRange.min ?? ''}
            onChange={(e) => onRangeChange('priceRange', 'min', e.target.value)}
          />
          <Input
            type="number"
            aria-label="Μέγιστη τιμή"
            placeholder="Έως"
            className="h-9"
            value={filters.priceRange.max ?? ''}
            onChange={(e) => onRangeChange('priceRange', 'max', e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium shrink-0">Εύρος Εμβαδού (m²)</Label>
          <Input
            type="number"
            aria-label="Ελάχιστο εμβαδόν"
            placeholder="Από"
            className="h-9"
            value={filters.areaRange.min ?? ''}
            onChange={(e) => onRangeChange('areaRange', 'min', e.target.value)}
          />
          <Input
            type="number"
            aria-label="Μέγιστο εμβαδόν"
            placeholder="Έως"
            className="h-9"
            value={filters.areaRange.max ?? ''}
            onChange={(e) => onRangeChange('areaRange', 'max', e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium shrink-0">Κατάσταση</Label>
          <Select
            onValueChange={(value) => onFilterChange('status', value === 'all' ? [] : [value])}
            value={filters.status.length === 1 ? filters.status[0] : 'all'}
          >
            <SelectTrigger className="h-9 w-full" aria-label="Φίλτρο κατάστασης">
              <SelectValue placeholder="Επιλογή κατάστασης..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Όλες οι καταστάσεις</SelectItem>
              {getAllStatuses().map(status => (
                <SelectItem key={status} value={status}>
                  {getStatusLabel(status)}
                </SelectItem>
              ))}
              <SelectItem value="rented">Ενοικιασμένο</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium shrink-0">Έργο</Label>
          <Select><SelectTrigger className="h-9 w-full" aria-label="Φίλτρο έργου"><SelectValue placeholder="Επιλογή Έργου" /></SelectTrigger><SelectContent><SelectItem value="all">Όλα τα έργα</SelectItem></SelectContent></Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium shrink-0">Κτίριο</Label>
          <Select><SelectTrigger className="h-9 w-full" aria-label="Φίλτρο κτιρίου"><SelectValue placeholder="Επιλογή Κτιρίου" /></SelectTrigger><SelectContent><SelectItem value="all">Όλα τα κτίρια</SelectItem></SelectContent></Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium shrink-0">Όροφος</Label>
          <Select><SelectTrigger className="h-9 w-full" aria-label="Φίλτρο ορόφου"><SelectValue placeholder="Επιλογή Ορόφου" /></SelectTrigger><SelectContent><SelectItem value="all">Όλοι οι όροφοι</SelectItem></SelectContent></Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium shrink-0">Τύπος Ακινήτου</Label>
          <Select><SelectTrigger className="h-9 w-full" aria-label="Φίλτρο τύπου ακινήτου"><SelectValue placeholder="Επιλογή Τύπου" /></SelectTrigger><SelectContent><SelectItem value="all">Όλοι οι τύποι</SelectItem></SelectContent></Select>
        </div>
      </div>
    </>
  );
}
