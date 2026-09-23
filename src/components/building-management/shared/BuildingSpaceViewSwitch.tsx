'use client';

/**
 * **Κάρτες | Πίνακας** — ο διακόπτης προβολής των καρτελών χώρων κτιρίου (Μονάδες · Θέσεις · Αποθήκες).
 *
 * Ζούσε αντιγραμμένος σε τρία αρχεία, με το ίδιο ελάττωμα: `variant={x ? 'default' : 'outline'}` ⇒ στο σκοτεινό
 * θέμα η επιλεγμένη προβολή δεν φαινόταν (ADR-770 §19). Πλέον **ένα** `SegmentedControl`: ορατή επιλογή,
 * radio σημασιολογία, βελάκια, και ποτέ «καμία προβολή».
 *
 * @module components/building-management/shared/BuildingSpaceViewSwitch
 */

import React from 'react';
import { Layers, Table as TableIcon } from 'lucide-react';

import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import type { BuildingSpaceViewMode } from './types';

export interface BuildingSpaceViewSwitchProps {
  readonly value: BuildingSpaceViewMode;
  readonly onChange: (next: BuildingSpaceViewMode) => void;
  /** Οι ετικέτες ανήκουν στον καταναλωτή: κάθε καρτέλα έχει το δικό της λεξιλόγιο. */
  readonly cardsLabel: string;
  readonly tableLabel: string;
}

export function BuildingSpaceViewSwitch({ value, onChange, cardsLabel, tableLabel }: BuildingSpaceViewSwitchProps) {
  const { t } = useTranslation(['building']);
  return (
    <SegmentedControl value={value} onValueChange={onChange} aria-label={t('viewMode.label')}>
      <SegmentedControlItem value="cards">
        <Layers className="mr-1 h-4 w-4" aria-hidden="true" /> {cardsLabel}
      </SegmentedControlItem>
      <SegmentedControlItem value="table">
        <TableIcon className="mr-1 h-4 w-4" aria-hidden="true" /> {tableLabel}
      </SegmentedControlItem>
    </SegmentedControl>
  );
}
