
'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useSortState } from '@/hooks/useSortState';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EntityListColumn } from '@/core/containers';
import { matchesSearchTerm } from '@/lib/search/search';
import { compareSortValues, type SortableValue } from '@/lib/array-utils';
import type { Building } from './BuildingsPageContent';

import { BuildingsListHeader } from './BuildingsList/BuildingsListHeader';
// [ENTERPRISE] Using centralized domain card
import { BuildingListCard } from '@/domain';
import { ResponsiveCompactToolbar, buildingsConfig } from '@/components/core/CompactToolbar';
import type { SortField } from '@/components/core/CompactToolbar/types';
// [ENTERPRISE] i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { BuildingStatusQuickFilters } from '@/components/shared/SpaceStatusQuickFilters';
import '@/lib/design-system';


interface BuildingsListProps {
  buildings: Building[];
  selectedBuilding: Building | null;
  onSelectBuilding?: (building: Building) => void;
  /** Callback for new building (inline creation) */
  onNewBuilding?: () => void;
  /** Callback for edit building */
  onEditBuilding?: () => void;
  /** Callback for delete building */
  onDeleteBuilding?: () => void;
}

export const BuildingsList = React.memo(function BuildingsList({
  buildings,
  selectedBuilding,
  onSelectBuilding,
  onNewBuilding,
  onEditBuilding,
  onDeleteBuilding,
}: BuildingsListProps) {
  // [ENTERPRISE] i18n hook for translations
  const { t } = useTranslation('building');
  const [favorites, setFavorites] = useState<string[]>(['1']);
  const { sortBy, sortOrder, onSortChange } = useSortState<SortField>('name');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showToolbar, setShowToolbar] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  const toggleFavorite = useCallback((buildingId: string) => {
    setFavorites(prev =>
      prev.includes(buildingId)
        ? prev.filter(id => id !== buildingId)
        : [...prev, buildingId]
    );
  }, []);

  // [ENTERPRISE] Filter buildings using centralized search + status quick filter
  const filteredBuildings = useMemo(() => {
    return buildings.filter(building => {
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(building.status)) {
        return false;
      }
      return matchesSearchTerm(
        [
          building.code,
          building.name,
          building.description,
          building.location,
          building.address,
          building.status,
          building.floors,
          building.units
        ],
        searchTerm
      );
    });
  }, [buildings, searchTerm, selectedStatuses]);

  const sortedBuildings = useMemo(() => {
    // Η τιμή της στήλης ανά κτίριο· η ΣΥΓΚΡΙΣΗ ανήκει στο `compareSortValues` (κενά τελευταία, ελληνική σειρά).
    const sortValueOf = (building: Building): SortableValue => {
      switch (sortBy) {
        case 'name': return building.name;
        case 'progress': return building.progress;
        case 'value': return building.totalValue;
        case 'area': return building.totalArea;
        case 'date': return new Date(building.createdAt || building.id).getTime();
        default: return null;
      }
    };
    return [...filteredBuildings].sort((a, b) => compareSortValues(sortValueOf(a), sortValueOf(b), sortOrder));
  }, [filteredBuildings, sortBy, sortOrder]);

  // [PERF] Stable callback: pass building by id to avoid arrow fn per item
  const handleSelect = useCallback((building: Building) => {
    onSelectBuilding?.(building);
  }, [onSelectBuilding]);

  return (
    <EntityListColumn hasBorder aria-label={t('list.ariaLabel')}>
      <BuildingsListHeader
        buildingCount={sortedBuildings.length}  // [ENTERPRISE] Dynamic count with filtered results
        showToolbar={showToolbar}
        onToolbarToggle={setShowToolbar}
      />

      {/* Πάντα ορατή σε desktop, πίσω από τον διακόπτη σε κινητό — ΜΙΑ φορά τα props */}
      <ResponsiveCompactToolbar
        showOnMobile={showToolbar}
        config={buildingsConfig}
        selectedItems={selectedItems}
        onSelectionChange={setSelectedItems}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        activeFilters={activeFilters}
        onFiltersChange={setActiveFilters}
        sortBy={sortBy}
        onSortChange={onSortChange}
        hasSelectedContact={!!selectedBuilding}
        onNewItem={onNewBuilding ? () => onNewBuilding() : undefined}
        onEditItem={onEditBuilding ? () => onEditBuilding() : undefined}
        onDeleteItems={onDeleteBuilding ? () => onDeleteBuilding() : undefined}
      />

      {/* 🏢 ENTERPRISE: Quick Filters for Building Status */}
      <BuildingStatusQuickFilters
        selectedTypes={selectedStatuses}
        onTypeChange={setSelectedStatuses}
        compact
      />

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {sortedBuildings.map((building) => (
            <BuildingListCard
              key={building.id}
              building={building}
              isSelected={selectedBuilding?.id === building.id}
              isFavorite={favorites.includes(building.id)}
              onSelect={() => handleSelect(building)}
              onToggleFavorite={() => toggleFavorite(building.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </EntityListColumn>
  );
});
