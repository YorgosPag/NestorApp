'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { CommonBadge } from "@/core/badges";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff } from "lucide-react";
import { PROPERTY_STATUS_CONFIG } from "@/lib/property-utils";
import { useIconSizes } from '@/hooks/useIconSizes';

interface LayerManagerHeaderProps {
  propertyCount: number;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterType: string;
  setFilterType: (type: string) => void;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  uniqueTypes: string[];
  uniqueStatuses: string[];
  onShowAll: () => void;
  onHideAll: () => void;
}

export function LayerManagerHeader({
  iconSizes = useIconSizes(),
  propertyCount,
  searchQuery,
  setSearchQuery,
  filterType,
  setFilterType,
  filterStatus,
  setFilterStatus,
  uniqueTypes,
  uniqueStatuses,
  onShowAll,
  onHideAll,
}: LayerManagerHeaderProps) {
  return (
    <div className="p-4 border-b space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Layers Διαχείρισης</h3>
        <CommonBadge
          status="property"
          customLabel={`${propertyCount} στοιχεία`}
          variant="secondary"
          className="text-xs"
        />
      </div>
      <Input
        placeholder="Αναζήτηση layer..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="h-8 text-xs"
        aria-label="Αναζήτηση Layer"
      />
      <div className="grid grid-cols-2 gap-2">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-8 text-xs" aria-label="Φίλτρο τύπου">
            <SelectValue placeholder="Τύπος" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Όλοι οι τύποι</SelectItem>
            {uniqueTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-xs" aria-label="Φίλτρο κατάστασης">
            <SelectValue placeholder="Κατάσταση" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Όλες</SelectItem>
            {uniqueStatuses.map(status => (
              <SelectItem key={status} value={status}>{PROPERTY_STATUS_CONFIG[status]?.label || status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs flex-1" onClick={onShowAll}>
          <Eye className={`${iconSizes.xs} mr-1`} /> Εμφάνιση Όλων
        </Button>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs flex-1" onClick={onHideAll}>
          <EyeOff className={`${iconSizes.xs} mr-1`} /> Απόκρυψη Όλων
        </Button>
      </div>
    </div>
  );
}
