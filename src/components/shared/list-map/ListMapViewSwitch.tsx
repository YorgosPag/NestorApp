'use client';

/**
 * **Ο διακόπτης Λίστα | Χάρτης** κάθε οθόνης λίστα ‖ χάρτης (ADR-777 §8.71 · ADR-896).
 *
 * 🔑 Radix `Tabs` (`ui/tabs`), όπως το `LandingModeSwitch`: πλήρες WAI-ARIA tablist (βέλη,
 * roving tabindex, Home/End) αντί για χειροποίητα κουμπιά. Η ρίζα `<Tabs>` ζει στο
 * `ListMapSplit`· εδώ μόνο η λίστα καρτελών.
 *
 * 🔑 **Οι ετικέτες έρχονται από τον καταναλωτή, ήδη μεταφρασμένες**: «Προβολή ακινήτων» και
 * «Προβολή επαγγελματιών» είναι διαφορετικές προτάσεις σε διαφορετικά namespaces. Ο διακόπτης
 * ξέρει μόνο **ποιες** προβολές υπάρχουν, όχι **τι** δείχνουν.
 */

import React from 'react';
import { List, Map as MapIcon } from 'lucide-react';

import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LIST_MAP_VIEWS, type ListMapView } from '@/lib/list-map/list-map-view';

const VIEW_ICON: Record<ListMapView, typeof List> = { list: List, map: MapIcon };

/**
 * Μόνο η ενεργή καρτέλα δηλώνει `aria-controls`: ο Radix αποδίδει **μόνο** το ενεργό πάνελ, και
 * ένα `aria-controls` προς πάνελ που δεν υπάρχει είναι σπασμένη αναφορά (ίδιο με `LandingModeSwitch`).
 */
const SUPPRESS_ARIA_CONTROLS = { 'aria-controls': undefined } as const;

/** Οι μεταφρασμένες ετικέτες: η ομάδα καρτελών + μία ανά προβολή. */
export type ListMapViewLabels = Readonly<Record<ListMapView | 'label', string>>;

export function ListMapViewSwitch({
  value,
  labels,
}: {
  readonly value: ListMapView;
  readonly labels: ListMapViewLabels;
}): React.ReactElement {
  return (
    <TabsList aria-label={labels.label} className="self-start">
      {LIST_MAP_VIEWS.map((view) => {
        const Icon = VIEW_ICON[view];
        return (
          <TabsTrigger
            key={view}
            value={view}
            className="gap-1.5"
            {...(view === value ? {} : SUPPRESS_ARIA_CONTROLS)}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            {labels[view]}
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}
