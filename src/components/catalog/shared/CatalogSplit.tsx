'use client';

/**
 * @fileoverview **Λίστα + λεπτομέρειες για τις οθόνες του καταλόγου** — μία σύνθεση των τριών SSoT της εφαρμογής
 *   (`ListDetailsSplit` · `EntityListColumn` · `DetailsContainer`), ώστε οι τέσσερις σελίδες να μην την ξαναγράφουν
 *   (N.18 — κανένα δίδυμο).
 * @module components/catalog/shared/CatalogSplit
 *
 * Desktop: στήλες δίπλα-δίπλα. Κινητό: λίστα **ή** φύλλο λεπτομερειών (ένα αντίτυπο των λεπτομερειών, ποτέ δύο —
 * ο επεξεργαστής κρατά πρόχειρο, και δύο αντίτυπα θα είχαν δύο πρόχειρα).
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';

import { DetailsContainer, EntityListColumn } from '@/core/containers';
import { ListDetailsSplit } from '@/core/layouts';

interface CatalogSplitProps {
  readonly listLabel: string;
  readonly list: React.ReactNode;
  /** Υπάρχει επιλογή (ή φόρμα δημιουργίας); */
  readonly open: boolean;
  readonly title: string;
  readonly details: React.ReactNode;
  readonly onClose: () => void;
  readonly empty: { readonly icon: LucideIcon; readonly title: string; readonly description: string };
}

export function CatalogSplit({ listLabel, list, open, title, details, onClose, empty }: CatalogSplitProps) {
  return (
    <ListDetailsSplit
      list={(
        <EntityListColumn hasBorder>
          <nav aria-label={listLabel} className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">{list}</nav>
        </EntityListColumn>
      )}
      details={(
        <DetailsContainer
          selectedItem={open ? { id: title, name: title } : null}
          emptyStateProps={empty}
          scrollResetToken={title}
          header={<h2 className="m-0 border-b px-4 py-3 text-lg font-semibold text-foreground">{title}</h2>}
        >
          {details}
        </DetailsContainer>
      )}
      sheetOpen={open}
      sheetTitle={title}
      onCloseSheet={onClose}
    />
  );
}
