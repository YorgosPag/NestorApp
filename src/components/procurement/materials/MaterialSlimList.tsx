'use client';

/**
 * MaterialSlimList — Material catalog list panel mirroring Contacts/POs SSoT pattern.
 *
 * Composition: GenericListHeader + CompactToolbar + MaterialStatusQuickFilters
 * + ScrollArea[MaterialListCard | MaterialGridCard].
 *
 * @see ADR-267 §Phase J — Procurement SSoT alignment
 */

import React, { useMemo, useState } from 'react';
import { Layers } from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

import { GenericListHeader } from '@/components/shared/GenericListHeader';
import { CompactToolbar, materialsConfig } from '@/components/core/CompactToolbar';
import { MaterialStatusQuickFilters } from '@/components/shared/TypeQuickFilters';
import { MaterialListCard, MaterialGridCard } from '@/domain';
import { EntityListColumn } from '@/core/containers';

import { useSortState } from '@/hooks/useSortState';
import { matchesSearchTerm } from '@/lib/search/search';
import { makeMaterialPredicate, type MaterialFilter } from '@/subapps/procurement/utils/quick-filter-predicates';

import type { Material } from '@/subapps/procurement/types/material';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

interface MaterialSlimListProps {
  materials: Material[];
  loading: boolean;
  selectedMaterialId: string | undefined;
  onSelectMaterial: (material: Material) => void;
  onCreateNew?: () => void;
  onEditMaterial?: (id: string) => void;
  onDeleteMaterial?: (id: string) => void;
  viewMode?: 'list' | 'grid';
}

export function MaterialSlimList({
  materials,
  loading,
  selectedMaterialId,
  onSelectMaterial,
  onCreateNew,
  onEditMaterial,
  onDeleteMaterial,
  viewMode = 'list',
}: MaterialSlimListProps) {
  const { t } = useTranslation('procurement');
  const colors = useSemanticColors();

  const { sortBy, sortOrder, onSortChange } = useSortState<'name' | 'number' | 'value' | 'date'>('name');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showToolbar, setShowToolbar] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const filterValue = (selectedFilter[0] ?? '') as MaterialFilter;
    const predicate = makeMaterialPredicate(filterValue);
    return materials.filter((m) => {
      if (!predicate(m)) return false;
      if (searchTerm) return matchesSearchTerm([m.name, m.code], searchTerm);
      return true;
    });
  }, [materials, selectedFilter, searchTerm]);

  const sorted = useMemo(() => {
    const dir = sortOrder === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'number':
          return a.code.localeCompare(b.code) * dir;
        case 'value':
          return ((a.lastPrice ?? 0) - (b.lastPrice ?? 0)) * dir;
        case 'date': {
          const aTs = a.lastPurchaseDate?.toMillis?.() ?? 0;
          const bTs = b.lastPurchaseDate?.toMillis?.() ?? 0;
          return (aTs - bTs) * dir;
        }
        case 'name':
        default:
          return a.name.localeCompare(b.name) * dir;
      }
    });
  }, [filtered, sortBy, sortOrder]);

  const renderSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    if (newSortBy === 'name' || newSortBy === 'number' || newSortBy === 'value' || newSortBy === 'date') {
      onSortChange(newSortBy, newSortOrder);
    }
  };

  const handleEditItem = () => { if (selectedMaterialId && onEditMaterial) onEditMaterial(selectedMaterialId); };
  const handleDeleteItems = () => { if (selectedMaterialId && onDeleteMaterial) onDeleteMaterial(selectedMaterialId); };

  return (
    <EntityListColumn hasBorder aria-label={t('hub.materialCatalog.title')}>
      <div>
        <GenericListHeader
          icon={Layers}
          entityName={t('hub.materialCatalog.title')}
          itemCount={sorted.length}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder={t('hub.materialCatalog.searchPlaceholder')}
          showToolbar={showToolbar}
          onToolbarToggle={setShowToolbar}
          hideSearch
        />
        <div className="hidden md:block">
          <CompactToolbar
            config={materialsConfig}
            selectedItems={selectedItems}
            onSelectionChange={setSelectedItems}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            activeFilters={activeFilters}
            onFiltersChange={setActiveFilters}
            sortBy={sortBy}
            onSortChange={renderSortChange}
            hasSelectedContact={!!selectedMaterialId}
            onNewItem={onCreateNew}
            onEditItem={handleEditItem}
            onDeleteItems={handleDeleteItems}
          />
        </div>
        <div className="md:hidden">
          {showToolbar && (
            <CompactToolbar
              config={materialsConfig}
              selectedItems={selectedItems}
              onSelectionChange={setSelectedItems}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              activeFilters={activeFilters}
              onFiltersChange={setActiveFilters}
              sortBy={sortBy}
              onSortChange={renderSortChange}
              hasSelectedContact={!!selectedMaterialId}
              onNewItem={onCreateNew}
              onEditItem={handleEditItem}
              onDeleteItems={handleDeleteItems}
            />
          )}
        </div>
      </div>

      <MaterialStatusQuickFilters
        selectedTypes={selectedFilter}
        onTypeChange={setSelectedFilter}
        compact
      />

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex flex-col gap-2 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-md" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className={cn('flex flex-col items-center gap-2 py-12 px-4 text-center', colors.text.muted)}>
            <Layers className="h-8 w-8 opacity-40" aria-hidden />
            <p className="text-sm">
              {searchTerm || selectedFilter.length > 0
                ? t('hub.materialCatalog.emptySearch')
                : t('hub.materialCatalog.noMaterialsYet')}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
            {sorted.map((m) => (
              <MaterialGridCard
                key={m.id}
                material={m}
                isSelected={m.id === selectedMaterialId}
                onSelect={() => onSelectMaterial(m)}
              />
            ))}
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {sorted.map((m) => (
              <MaterialListCard
                key={m.id}
                material={m}
                isSelected={m.id === selectedMaterialId}
                onSelect={() => onSelectMaterial(m)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </EntityListColumn>
  );
}
