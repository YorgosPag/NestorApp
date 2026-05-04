'use client';

/**
 * AgreementSlimList — Framework agreements list panel mirroring SSoT pattern.
 *
 * Composition: GenericListHeader + CompactToolbar + AgreementStatusQuickFilters
 * + ScrollArea[AgreementListCard | AgreementGridCard].
 *
 * @see ADR-267 §Phase J — Procurement SSoT alignment
 */

import React, { useMemo, useState } from 'react';
import { ScrollText } from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

import { GenericListHeader } from '@/components/shared/GenericListHeader';
import { CompactToolbar, agreementsConfig } from '@/components/core/CompactToolbar';
import { AgreementStatusQuickFilters } from '@/components/shared/TypeQuickFilters';
import { AgreementListCard, AgreementGridCard } from '@/domain';
import { EntityListColumn } from '@/core/containers';

import { useSortState } from '@/hooks/useSortState';
import { matchesSearchTerm } from '@/lib/search/search';
import { makeAgreementPredicate, type AgreementFilter } from '@/subapps/procurement/utils/quick-filter-predicates';

import type { FrameworkAgreement } from '@/subapps/procurement/types/framework-agreement';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

interface AgreementSlimListProps {
  agreements: FrameworkAgreement[];
  vendorNamesById: Map<string, string>;
  loading: boolean;
  selectedAgreementId: string | undefined;
  onSelectAgreement: (agreement: FrameworkAgreement) => void;
  onCreateNew?: () => void;
  onEditAgreement?: (id: string) => void;
  onDeleteAgreement?: (id: string) => void;
  viewMode?: 'list' | 'grid';
}

export function AgreementSlimList({
  agreements,
  vendorNamesById,
  loading,
  selectedAgreementId,
  onSelectAgreement,
  onCreateNew,
  onEditAgreement,
  onDeleteAgreement,
  viewMode = 'list',
}: AgreementSlimListProps) {
  const { t } = useTranslation('procurement');
  const colors = useSemanticColors();

  const { sortBy, sortOrder, onSortChange } = useSortState<'name' | 'number' | 'status' | 'date'>('name');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showToolbar, setShowToolbar] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const filterValue = (selectedFilter[0] ?? '') as AgreementFilter;
    const predicate = makeAgreementPredicate(filterValue);
    return agreements.filter((a) => {
      if (!predicate(a)) return false;
      if (searchTerm) return matchesSearchTerm([a.title, a.agreementNumber], searchTerm);
      return true;
    });
  }, [agreements, selectedFilter, searchTerm]);

  const sorted = useMemo(() => {
    const dir = sortOrder === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'number':
          return a.agreementNumber.localeCompare(b.agreementNumber) * dir;
        case 'status':
          return a.status.localeCompare(b.status) * dir;
        case 'date':
          return ((a.validUntil?.toMillis?.() ?? 0) - (b.validUntil?.toMillis?.() ?? 0)) * dir;
        case 'name':
        default:
          return a.title.localeCompare(b.title) * dir;
      }
    });
  }, [filtered, sortBy, sortOrder]);

  const renderSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    if (newSortBy === 'name' || newSortBy === 'number' || newSortBy === 'status' || newSortBy === 'date') {
      onSortChange(newSortBy, newSortOrder);
    }
  };

  const handleEditItem = () => { if (selectedAgreementId && onEditAgreement) onEditAgreement(selectedAgreementId); };
  const handleDeleteItems = () => { if (selectedAgreementId && onDeleteAgreement) onDeleteAgreement(selectedAgreementId); };

  return (
    <EntityListColumn hasBorder aria-label={t('hub.frameworkAgreements.title')}>
      <div>
        <GenericListHeader
          icon={ScrollText}
          entityName={t('hub.frameworkAgreements.title')}
          itemCount={sorted.length}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder={t('hub.frameworkAgreements.searchPlaceholder')}
          showToolbar={showToolbar}
          onToolbarToggle={setShowToolbar}
          hideSearch
        />
        <div className="hidden md:block">
          <CompactToolbar
            config={agreementsConfig}
            selectedItems={selectedItems}
            onSelectionChange={setSelectedItems}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            activeFilters={activeFilters}
            onFiltersChange={setActiveFilters}
            sortBy={sortBy}
            onSortChange={renderSortChange}
            hasSelectedContact={!!selectedAgreementId}
            onNewItem={onCreateNew}
            onEditItem={handleEditItem}
            onDeleteItems={handleDeleteItems}
          />
        </div>
        <div className="md:hidden">
          {showToolbar && (
            <CompactToolbar
              config={agreementsConfig}
              selectedItems={selectedItems}
              onSelectionChange={setSelectedItems}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              activeFilters={activeFilters}
              onFiltersChange={setActiveFilters}
              sortBy={sortBy}
              onSortChange={renderSortChange}
              hasSelectedContact={!!selectedAgreementId}
              onNewItem={onCreateNew}
              onEditItem={handleEditItem}
              onDeleteItems={handleDeleteItems}
            />
          )}
        </div>
      </div>

      <AgreementStatusQuickFilters
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
            <ScrollText className="h-8 w-8 opacity-40" aria-hidden />
            <p className="text-sm">
              {searchTerm || selectedFilter.length > 0
                ? t('hub.frameworkAgreements.emptySearch')
                : t('hub.frameworkAgreements.noAgreementsYet')}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
            {sorted.map((a) => (
              <AgreementGridCard
                key={a.id}
                agreement={a}
                vendorName={vendorNamesById.get(a.vendorContactId) ?? null}
                isSelected={a.id === selectedAgreementId}
                onSelect={() => onSelectAgreement(a)}
              />
            ))}
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {sorted.map((a) => (
              <AgreementListCard
                key={a.id}
                agreement={a}
                vendorName={vendorNamesById.get(a.vendorContactId) ?? null}
                isSelected={a.id === selectedAgreementId}
                onSelect={() => onSelectAgreement(a)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </EntityListColumn>
  );
}
