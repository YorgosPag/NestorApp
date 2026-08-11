'use client';

/**
 * MaterialSlimList — Material catalog list panel mirroring Contacts/POs SSoT pattern.
 *
 * Composition: GenericListHeader + CompactToolbar + MaterialStatusQuickFilters
 * + ScrollArea[MaterialListCard | MaterialGridCard].
 *
 * @see ADR-267 §Phase J — Procurement SSoT alignment
 */

import React, { useMemo } from 'react';
import { Layers } from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';

import { GenericListHeader } from '@/components/shared/GenericListHeader';
// ADR-784 §10.4 / CHECK 3.28 — ο SSoT της ζεύξης desktop/mobile ΥΠΗΡΧΕ ήδη· εδώ ήταν γραμμένη με το χέρι.
import { ResponsiveCompactToolbar, materialsConfig } from '@/components/core/CompactToolbar';
import { MaterialStatusQuickFilters } from '@/components/shared/TypeQuickFilters';
import { MaterialListCard, MaterialGridCard } from '@/domain';
import { EntityListColumn } from '@/core/containers';

// ADR-784 §10.4 / CHECK 3.28 — κατάσταση, ταξινόμηση και σώμα λίστας ζουν σε ΕΝΑ σημείο.
import { useSlimListState } from '../shared/use-slim-list-state';
import { useSortedRows } from '../shared/use-sorted-rows';
import { SlimListBody } from '../shared/SlimListBody';
import { matchesSearchTerm } from '@/lib/search/search';
import { makeMaterialPredicate, type MaterialFilter } from '@/subapps/procurement/utils/quick-filter-predicates';

import type { Material } from '@/subapps/procurement/types/material';
import { useTranslation } from '@/i18n/hooks/useTranslation';

/** Το κλειστό λεξιλόγιο ταξινόμησης — δηλώνεται ΜΙΑ φορά και είναι ΚΑΙ ο φύλακας του toolbar. */
const MATERIAL_SORT_KEYS = ['name', 'number', 'value', 'date'] as const;

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

  const {
    sortBy, sortOrder, onSortChange,
    selectedItems, setSelectedItems,
    searchTerm, setSearchTerm,
    activeFilters, setActiveFilters,
    showToolbar, setShowToolbar,
    selectedFilter, setSelectedFilter,
  } = useSlimListState(MATERIAL_SORT_KEYS, 'name');

  const filtered = useMemo(() => {
    const filterValue = (selectedFilter[0] ?? '') as MaterialFilter;
    const predicate = makeMaterialPredicate(filterValue);
    return materials.filter((m) => {
      if (!predicate(m)) return false;
      if (searchTerm) return matchesSearchTerm([m.name, m.code], searchTerm);
      return true;
    });
  }, [materials, selectedFilter, searchTerm]);

  const sorted = useSortedRows(filtered, sortBy, sortOrder, {
    name: (a, b) => a.name.localeCompare(b.name),
    number: (a, b) => a.code.localeCompare(b.code),
    value: (a, b) => (a.lastPrice ?? 0) - (b.lastPrice ?? 0),
    date: (a, b) => (a.lastPurchaseDate?.toMillis?.() ?? 0) - (b.lastPurchaseDate?.toMillis?.() ?? 0),
  });


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
        <ResponsiveCompactToolbar
          showOnMobile={showToolbar}
          config={materialsConfig}
          selectedItems={selectedItems}
          onSelectionChange={setSelectedItems}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          activeFilters={activeFilters}
          onFiltersChange={setActiveFilters}
          sortBy={sortBy}
          onSortChange={onSortChange}
          hasSelectedContact={!!selectedMaterialId}
          onNewItem={onCreateNew}
          onEditItem={handleEditItem}
          onDeleteItems={handleDeleteItems}
        />
      </div>

      <MaterialStatusQuickFilters
        selectedTypes={selectedFilter}
        onTypeChange={setSelectedFilter}
        compact
      />

      <ScrollArea className="flex-1">
        <SlimListBody
          loading={loading}
          items={sorted}
          viewMode={viewMode}
          emptyIcon={Layers}
          emptyMessage={searchTerm || selectedFilter.length > 0
            ? t('hub.materialCatalog.emptySearch')
            : t('hub.materialCatalog.noMaterialsYet')}
          keyOf={(m) => m.id}
          renderItem={(m, mode) => {
            const Card = mode === 'grid' ? MaterialGridCard : MaterialListCard;
            return (
              <Card
                material={m}
                isSelected={m.id === selectedMaterialId}
                onSelect={() => onSelectMaterial(m)}
              />
            );
          }}
        />
      </ScrollArea>
    </EntityListColumn>
  );
}
