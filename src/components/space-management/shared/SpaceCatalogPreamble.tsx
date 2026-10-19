'use client';

/**
 * SpaceCatalogPreamble — ό,τι κάθεται ΠΑΝΩ από τη λίστα θέσεων ή αποθηκών (σελίδες `/spaces/*`):
 * τα φίλτρα του desktop · η μπάρα κάδου (ADR-281, μόνο στην προβολή κάδου) · η ειδοποίηση του βαθέος
 * συνδέσμου (ADR-777 §8.31 — ο σύνδεσμος απαντά, ακόμη κι όταν η απάντηση είναι «όχι»).
 *
 * Ήταν γραμμένο δύο φορές (`ParkingPageContent` / `StoragePageContent`)· το `jscpd:diff` (CHECK 3.28, ADR-584)
 * τα έπιασε ως δίδυμα όταν η ADR-912 §12.19 άγγιξε και τις δύο σελίδες. Κάθε σελίδα κρατά ό,τι είναι δικό της:
 * τη ρύθμιση φίλτρων, τους χειριστές επαναφοράς/διαγραφής, την επιλογή και τα κείμενα.
 *
 * @module components/space-management/shared/SpaceCatalogPreamble
 */

import {
  AdvancedFiltersPanel,
  type FilterPanelConfig,
  type GenericFilterState,
} from '@/components/core/AdvancedFilters';
import { TrashActionsBar } from '@/components/shared/trash/TrashActionsBar';
import { DeepLinkNotice } from '@/components/shared/deep-link/DeepLinkNotice';
import type { EntitySelection, SelectableEntity } from '@/hooks/entity-selection-state';

interface SpaceFiltersBindings<F extends GenericFilterState> {
  /** Ήδη μεταφρασμένο — το όνομα της περιοχής φίλτρων για τις υποστηρικτικές τεχνολογίες. */
  readonly label: string;
  readonly config: FilterPanelConfig;
  readonly value: F;
  readonly onChange: (filters: F) => void;
}

interface SpaceTrashBarBindings {
  /** Η μπάρα αποδίδεται μόνο στην προβολή κάδου και αφού φορτώσει. */
  readonly visible: boolean;
  /** Το στοιχείο του πάνελ λεπτομερειών — ο στόχος της επαναφοράς/διαγραφής. */
  readonly activeId: string | null | undefined;
  readonly count: number;
  readonly onBack: () => void;
  readonly onRestore: (ids: string[]) => void;
  readonly onPermanentDelete: (ids: string[]) => void;
}

interface SpaceCatalogPreambleProps<F extends GenericFilterState, T extends SelectableEntity> {
  readonly filters: SpaceFiltersBindings<F>;
  readonly trash: SpaceTrashBarBindings;
  readonly selection: EntitySelection<T>;
}

export function SpaceCatalogPreamble<F extends GenericFilterState, T extends SelectableEntity>({
  filters,
  trash,
  selection,
}: SpaceCatalogPreambleProps<F, T>) {
  return (
    <>
      <aside className="hidden md:block" role="complementary" aria-label={filters.label}>
        <AdvancedFiltersPanel config={filters.config} filters={filters.value} onFiltersChange={filters.onChange} />
      </aside>
      {trash.visible && (
        <TrashActionsBar
          selectedIds={trash.activeId ? [trash.activeId] : []}
          onBack={trash.onBack}
          onRestore={trash.onRestore}
          onPermanentDelete={trash.onPermanentDelete}
          trashCount={trash.count}
        />
      )}
      <DeepLinkNotice selection={selection} className="mb-2" />
    </>
  );
}
