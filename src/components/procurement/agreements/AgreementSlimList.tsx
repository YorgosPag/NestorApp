'use client';

/**
 * AgreementSlimList — Framework agreements list panel mirroring SSoT pattern.
 *
 * Composition: GenericListHeader + CompactToolbar + AgreementStatusQuickFilters
 * + ScrollArea[AgreementListCard | AgreementGridCard].
 *
 * @see ADR-267 §Phase J — Procurement SSoT alignment
 */

import React, { useMemo } from 'react';
import { ScrollText } from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';

import { GenericListHeader } from '@/components/shared/GenericListHeader';
// ADR-784 §10.4 / CHECK 3.28 — ο SSoT της ζεύξης desktop/mobile ΥΠΗΡΧΕ ήδη· εδώ ήταν γραμμένη με το χέρι.
import { ResponsiveCompactToolbar, agreementsConfig } from '@/components/core/CompactToolbar';
import { AgreementStatusQuickFilters } from '@/components/shared/TypeQuickFilters';
import { AgreementListCard, AgreementGridCard } from '@/domain';
import { EntityListColumn } from '@/core/containers';

// ADR-784 §10.4 / CHECK 3.28 — κατάσταση, ταξινόμηση και σώμα λίστας ζουν σε ΕΝΑ σημείο.
import { useSlimListState } from '../shared/use-slim-list-state';
import { useSortedRows } from '../shared/use-sorted-rows';
import { SlimListBody } from '../shared/SlimListBody';
import { matchesSearchTerm } from '@/lib/search/search';
import { makeAgreementPredicate, type AgreementFilter } from '@/subapps/procurement/utils/quick-filter-predicates';

import type { FrameworkAgreement } from '@/subapps/procurement/types/framework-agreement';
import { useTranslation } from '@/i18n/hooks/useTranslation';

/** Το κλειστό λεξιλόγιο ταξινόμησης — δηλώνεται ΜΙΑ φορά και είναι ΚΑΙ ο φύλακας του toolbar. */
const AGREEMENT_SORT_KEYS = ['name', 'number', 'status', 'date'] as const;

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

  const {
    sortBy, sortOrder, onSortChange,
    selectedItems, setSelectedItems,
    searchTerm, setSearchTerm,
    activeFilters, setActiveFilters,
    showToolbar, setShowToolbar,
    selectedFilter, setSelectedFilter,
  } = useSlimListState(AGREEMENT_SORT_KEYS, 'name');

  const filtered = useMemo(() => {
    const filterValue = (selectedFilter[0] ?? '') as AgreementFilter;
    const predicate = makeAgreementPredicate(filterValue);
    return agreements.filter((a) => {
      if (!predicate(a)) return false;
      if (searchTerm) return matchesSearchTerm([a.title, a.agreementNumber], searchTerm);
      return true;
    });
  }, [agreements, selectedFilter, searchTerm]);

  const sorted = useSortedRows(filtered, sortBy, sortOrder, {
    name: (a, b) => a.title.localeCompare(b.title),
    number: (a, b) => a.agreementNumber.localeCompare(b.agreementNumber),
    status: (a, b) => a.status.localeCompare(b.status),
    date: (a, b) => (a.validUntil?.toMillis?.() ?? 0) - (b.validUntil?.toMillis?.() ?? 0),
  });

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
        <ResponsiveCompactToolbar
          showOnMobile={showToolbar}
          config={agreementsConfig}
          selectedItems={selectedItems}
          onSelectionChange={setSelectedItems}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          activeFilters={activeFilters}
          onFiltersChange={setActiveFilters}
          sortBy={sortBy}
          onSortChange={onSortChange}
          hasSelectedContact={!!selectedAgreementId}
          onNewItem={onCreateNew}
          onEditItem={handleEditItem}
          onDeleteItems={handleDeleteItems}
        />
      </div>

      <AgreementStatusQuickFilters
        selectedTypes={selectedFilter}
        onTypeChange={setSelectedFilter}
        compact
      />

      <ScrollArea className="flex-1">
        <SlimListBody
          loading={loading}
          items={sorted}
          viewMode={viewMode}
          emptyIcon={ScrollText}
          emptyMessage={searchTerm || selectedFilter.length > 0
            ? t('hub.frameworkAgreements.emptySearch')
            : t('hub.frameworkAgreements.noAgreementsYet')}
          keyOf={(a) => a.id}
          renderItem={(a, mode) => {
            const Card = mode === 'grid' ? AgreementGridCard : AgreementListCard;
            return (
              <Card
                agreement={a}
                vendorName={vendorNamesById.get(a.vendorContactId) ?? null}
                isSelected={a.id === selectedAgreementId}
                onSelect={() => onSelectAgreement(a)}
              />
            );
          }}
        />
      </ScrollArea>
    </EntityListColumn>
  );
}
