'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import type { ParkingFilters } from '@/types/parking';
import { PARKING_TYPE_LABELS, PARKING_STATUS_LABELS } from '@/types/parking';

interface ParkingFilterPanelProps {
    filters: ParkingFilters;
    onFiltersChange: (filters: Partial<ParkingFilters>) => void;
}

export function ParkingFilterPanel({ filters, onFiltersChange }: ParkingFilterPanelProps) {
    const iconSizes = useIconSizes();
    const { quick } = useBorderTokens();
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 p-4 bg-card ${quick.card}">
          <div className="lg:col-span-2 space-y-2">
            <Label htmlFor="search" className="text-xs font-medium flex items-center gap-1">
              <Search className={iconSizes.xs} />
              Αναζήτηση
            </Label>
            <Input
              id="search"
              placeholder="Κωδικός, ιδιοκτήτης, ακίνητο..."
              value={filters.searchTerm}
              onChange={(e) => onFiltersChange({ searchTerm: e.target.value })}
              className="h-9"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type-filter" className="text-xs font-medium flex items-center gap-1">
              <Filter className={iconSizes.xs} />
              Τύπος
            </Label>
            <Select value={filters.type} onValueChange={(value) => onFiltersChange({ type: value })}>
              <SelectTrigger id="type-filter" className="h-9">
                <SelectValue placeholder="Όλοι οι τύποι" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Όλοι οι τύποι</SelectItem>
                {Object.entries(PARKING_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status-filter" className="text-xs font-medium">Κατάσταση</Label>
            <Select value={filters.status} onValueChange={(value) => onFiltersChange({ status: value })}>
              <SelectTrigger id="status-filter" className="h-9">
                <SelectValue placeholder="Όλες οι καταστάσεις" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Όλες οι καταστάσεις</SelectItem>
                {Object.entries(PARKING_STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="level-filter" className="text-xs font-medium">Επίπεδο</Label>
            <Select value={filters.level} onValueChange={(value) => onFiltersChange({ level: value })}>
              <SelectTrigger id="level-filter" className="h-9">
                <SelectValue placeholder="Όλα τα επίπεδα" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Όλα τα επίπεδα</SelectItem>
                <SelectItem value="basement">Υπόγειο</SelectItem>
                <SelectItem value="ground">Ισόγειο</SelectItem>
                <SelectItem value="first">1ος Όροφος</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="owner-filter" className="text-xs font-medium">Ιδιοκτήτης</Label>
            <Input
              id="owner-filter"
              placeholder="Φίλτρο ιδιοκτήτη..."
              value={filters.owner}
              onChange={(e) => onFiltersChange({ owner: e.target.value })}
              className="h-9"
            />
          </div>
        </div>
    );
}
