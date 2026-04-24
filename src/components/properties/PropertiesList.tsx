'use client';

import React, { useState, useMemo } from 'react';
import { useSortState } from '@/hooks/useSortState';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PropertiesListHeader } from './list/PropertiesListHeader';
// 🏢 ENTERPRISE: Using centralized domain card
import { PropertyListCard } from '@/domain';
import { CompactToolbar, propertiesConfig, type SortField } from '@/components/core/CompactToolbar';
import { PropertyTypeQuickFilters } from './PropertyTypeQuickFilters';
import type { Property } from '@/types/property-viewer';
import { EntityListColumn } from '@/core/containers';
import { matchesSearchTerm } from '@/lib/search/search';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

interface PropertiesListProps {
  units: Property[];
  selectedPropertyIds: string[];
  onSelectProperty: (propertyId: string, isShift: boolean) => void;
  onAssignmentSuccess: () => void;
  /** Callback for creating a new property (inline) */
  onNewProperty?: () => void;
  /** Callback for editing the selected property */
  onEditProperty?: () => void;
  /** Callback for deleting the selected property */
  onDeleteProperty?: () => void;
}

export function PropertiesList({
  units,
  selectedPropertyIds,
  onSelectProperty,
  onAssignmentSuccess: _onAssignmentSuccess,
  onNewProperty,
  onEditProperty,
  onDeleteProperty,
}: PropertiesListProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);
  // 🏢 ENTERPRISE: Centralized spacing tokens
  const spacing = useSpacingTokens();
  const [favorites, setFavorites] = useState<string[]>(['prop-1']);
  const { sortBy, sortOrder, onSortChange } = useSortState<SortField>('name');

  // CompactToolbar state
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showToolbar, setShowToolbar] = useState(false);

  // 🏢 ENTERPRISE: Quick filter state for unit types (local_4.log - list-scoped filtering)
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  const toggleFavorite = (propertyId: string) => {
    setFavorites(prev => 
      prev.includes(propertyId) 
        ? prev.filter(id => id !== propertyId)
        : [...prev, propertyId]
    );
  };

  // 🏢 ENTERPRISE: Filter units using centralized search
  const filteredUnits = useMemo(() => {
    return units.filter(unit => {
      // Type filter (quick filters - list-scoped)
      if (selectedTypes.length > 0) {
        const propertyType = (unit.type || '').toLowerCase();

        // 🏢 ENTERPRISE: Studio filter includes both Studio and Γκαρσονιέρα
        const matchesType = selectedTypes.some(filterType => {
          const filter = filterType.toLowerCase();

          // Special case: "studio" matches both studio and γκαρσονιέρα
          if (filter === 'studio') {
            return propertyType.includes('studio') ||
                   propertyType.includes('στούντιο') ||
                   propertyType.includes('στουντιο') ||
                   propertyType.includes('γκαρσονιέρα') ||
                   propertyType.includes('γκαρσονιερα');
          }

          // Standard matching
          return propertyType.includes(filter);
        });

        if (!matchesType) {
          return false;
        }
      }

      // Search filter using enterprise search
      return matchesSearchTerm(
        [
          unit.name,
          unit.description,
          unit.type,
          unit.status,
          unit.floor,     // number OK
          unit.area,      // number OK
          unit.price      // number OK
        ],
        searchTerm
      );
    });
  }, [units, selectedTypes, searchTerm]);

  const sortedUnits = [...filteredUnits].sort((a, b) => {
    let aValue, bValue;

    switch (sortBy) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      // ❌ REMOVED: Price sorting (commercial data - domain separation)
      // case 'price': aValue = a.price || 0; bValue = b.price || 0; break;
      // Migration: PR1 - Units List Cleanup
      case 'area':
        aValue = a.area || 0;
        bValue = b.area || 0;
        break;
      default:
        return 0;
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    } else {
      return sortOrder === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    }
  });

  const _handleSelectAll = (checked: boolean) => {
    if (checked) {
        onSelectProperty('__all__', false);
    } else {
        onSelectProperty('__none__', false);
    }
  };

  // ❌ REMOVED: Sales data calculations (commercial data - domain separation)
  // const availableCount = units.filter(u => u.status === 'for-sale' || u.status === 'for-rent').length;
  // const totalValue = units.reduce((sum, u) => sum + (u.price || 0), 0);
  // Migration: PR1 - Units List Cleanup - These belong to SalesAsset aggregations

  return (
    <EntityListColumn hasBorder aria-label={t('list.ariaLabel')}>
      <PropertiesListHeader
        propertyCount={sortedUnits.length}  // 🏢 ENTERPRISE: Δυναμικό count με filtered results
        showToolbar={showToolbar}
        onToolbarToggle={setShowToolbar}
      />

      {/* CompactToolbar - Always visible on Desktop, Toggleable on Mobile */}
      <div className="hidden md:block">
        <CompactToolbar
          config={propertiesConfig}
          selectedItems={selectedItems}
          onSelectionChange={setSelectedItems}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          activeFilters={activeFilters}
          onFiltersChange={setActiveFilters}
          sortBy={sortBy}
          onSortChange={onSortChange}
          hasSelectedContact={selectedPropertyIds.length > 0}
          onNewItem={() => onNewProperty?.()}
          onEditItem={() => onEditProperty?.()}
          onDeleteItems={() => onDeleteProperty?.()}
          onExport={() => {}}
          onRefresh={() => {}}
          onSettings={() => {}}
        />
      </div>

      {/* CompactToolbar - Toggleable on Mobile */}
      <div className="md:hidden">
        {showToolbar && (
          <CompactToolbar
            config={propertiesConfig}
            selectedItems={selectedItems}
            onSelectionChange={setSelectedItems}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            activeFilters={activeFilters}
            onFiltersChange={setActiveFilters}
            sortBy={sortBy}
            onSortChange={onSortChange}
            hasSelectedContact={selectedPropertyIds.length > 0}
            onNewItem={() => onNewProperty?.()}
            onEditItem={() => onEditProperty?.()}
            onDeleteItems={() => onDeleteProperty?.()}
            onExport={() => {}}
            onRefresh={() => {}}
            onSettings={() => {}}
          />
        )}
      </div>

      {/* 🏢 ENTERPRISE: Quick Filters for Unit Types (local_4.log architecture) */}
      {/* List-scoped filtering - NOT global filter panel */}
      <PropertyTypeQuickFilters
        selectedTypes={selectedTypes}
        onTypeChange={setSelectedTypes}
        compact
      />

      <ScrollArea className="flex-1">
        <div className={`${spacing.padding.sm} ${spacing.spaceBetween.sm}`}>
          {sortedUnits.map((unit) => (
            <PropertyListCard
              key={unit.id}
              property={unit}
              isSelected={selectedPropertyIds.includes(unit.id)}
              isFavorite={favorites.includes(unit.id)}
              onSelect={(isShift) => onSelectProperty(unit.id, isShift ?? false)}
              onToggleFavorite={() => toggleFavorite(unit.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </EntityListColumn>
  );
}
