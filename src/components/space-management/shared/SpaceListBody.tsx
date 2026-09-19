'use client';

/**
 * SpaceListBody — το ΣΩΜΑ της λίστας θέσεων ή αποθηκών (σελίδες `/spaces/*`)
 *
 * Εργαλειοθήκη → γρήγορες επιλογές **διάθεσης** → κάρτες σε ενότητες ανά μονάδα τιμής → κενή
 * κατάσταση. Ήταν γραμμένο δύο φορές (`ParkingsList` / `StoragesList`)· όταν η ADR-777 §8.60.20 έδωσε και στις
 * δύο λίστες τις ΙΔΙΕΣ γρήγορες επιλογές, το `jscpd:diff` (CHECK 3.28) τα έπιασε ως δίδυμα. Κάθε
 * λίστα κρατά ό,τι είναι δικό της: κεφαλίδα, ρυθμίσεις εργαλειοθήκης, κάρτα, κείμενα.
 *
 * @module components/space-management/shared/SpaceListBody
 */

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { SpaceAvailabilityQuickFilters } from '@/components/shared/SpaceStatusQuickFilters';
import { PriceClassSectionedList } from '@/components/shared/price-sections/PriceClassSectionedList';
import { ResponsiveCompactToolbar } from '@/components/core/CompactToolbar';
import type { CompactToolbarConfig, SortField } from '@/components/core/CompactToolbar/types';
import type { EntityListToolbarBindings } from '@/hooks/useEntityListState';
import type { PriceClassSections } from '@/lib/properties/price-class-sections';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('SpaceListBody');

/** Η εργαλειοθήκη της λίστας — οι ενέργειες που δεν έχουν ακόμη υλοποίηση καταγράφονται. */
export interface SpaceListToolbar {
  readonly bindings: EntityListToolbarBindings<SortField>;
  readonly config: CompactToolbarConfig;
  readonly onNewItem?: () => void;
  /** Για τα logs («parking» · «storages»). */
  readonly logLabel: string;
}

export interface SpaceListBodyProps<T> {
  readonly toolbar: SpaceListToolbar;
  /** Οι επιλεγμένοι κουβάδες διάθεσης (κενό ⇒ όλοι). */
  readonly selectedStatuses: string[];
  readonly onStatusesChange: (statuses: string[]) => void;
  readonly sections: PriceClassSections<T>;
  readonly idPrefix: string;
  readonly getKey: (item: T) => string;
  readonly renderItem: (item: T) => ReactNode;
  /** Κενή κατάσταση — τα κείμενα ήδη μεταφρασμένα· το δεύτερο μόνο όταν υπάρχει αναζήτηση. */
  readonly empty: { readonly shown: boolean; readonly icon: LucideIcon; readonly text: string; readonly termText?: string };
}

export function SpaceListBody<T>({
  toolbar,
  selectedStatuses,
  onStatusesChange,
  sections,
  idPrefix,
  getKey,
  renderItem,
  empty,
}: SpaceListBodyProps<T>) {
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const EmptyIcon = empty.icon;

  return (
    <>
      {/* Πάντα ορατή σε desktop, πίσω από τον διακόπτη σε κινητό — ΜΙΑ φορά τα props */}
      <ResponsiveCompactToolbar
        {...toolbar.bindings}
        config={toolbar.config}
        onNewItem={() => toolbar.onNewItem?.()}
        onEditItem={(id) => logger.info(`Edit ${toolbar.logLabel}`, { id })}
        onDeleteItems={(ids) => logger.info(`Delete ${toolbar.logLabel}`, { ids })}
        onExport={() => logger.info(`Export ${toolbar.logLabel}`)}
        onRefresh={() => logger.info(`Refresh ${toolbar.logLabel}`)}
      />

      <SpaceAvailabilityQuickFilters selectedTypes={selectedStatuses} onTypeChange={onStatusesChange} compact />

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          <PriceClassSectionedList sections={sections} idPrefix={idPrefix} getKey={getKey} renderItem={renderItem} />

          {empty.shown && (
            <div className={cn('text-center py-8', colors.text.muted)}>
              <EmptyIcon className={`${iconSizes.xl3} mx-auto mb-2 opacity-50`} />
              <p>{empty.text}</p>
              {empty.termText && <p className="text-sm">{empty.termText}</p>}
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  );
}
