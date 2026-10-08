'use client';

/**
 * @fileoverview **ΤΟ ΠΛΑΙΣΙΟ ΜΙΑΣ ΥΠΟΕΝΟΤΗΤΑΣ ΤΟΥ ΠΑΝΕΛ «ΠΕΡΙΗΓΗΣΗ 360°»** — ένα πλαίσιο, μία επικεφαλίδα, μία ευθύνη.
 * @related ADR-777 §8.87.4 · ADR-884 §4.5 · `SpatialTourPanel.tsx`
 * @module components/spatial-tour/TourPanelSection
 *
 * 🔑 **Το πλαίσιο το φορά η ΥΠΟΕΝΟΤΗΤΑ, όχι το πάνελ.** Οι υποενότητες φορτώνουν ανεξάρτητα και κάποιες επιστρέφουν
 * `null` όσο δεν ξέρουν τι να δείξουν (ρυθμίσεις)· αν τις τύλιγε το πάνελ, θα ζωγράφιζε **άδειο πλαίσιο** γύρω από το
 * τίποτα. Έτσι ό,τι δεν αποδίδεται δεν αφήνει ίχνος.
 * 🔑 Το πλαίσιο **είναι** το `Card` του συστήματος — καμία δεύτερη συνταγή ορίου/φόντου. Το `<section aria-labelledby>`
 * μένει απ' έξω: η υποενότητα είναι **ορόσημο με όνομα** για τον αναγνώστη οθόνης, όπως ήταν.
 */

import type { ReactNode } from 'react';

import { Card } from '@/components/ui/card';

interface TourPanelSectionProps {
  /** Σταθερό `id` της επικεφαλίδας — το όνομα του ορόσημου. */
  readonly headingId: string;
  readonly title: string;
  /** Ενέργεια της υποενότητας, στην ίδια γραμμή με τον τίτλο (π.χ. άνοιγμα συντάκτη). */
  readonly actions?: ReactNode;
  readonly children: ReactNode;
}

export function TourPanelSection({ headingId, title, actions, children }: TourPanelSectionProps) {
  return (
    <section aria-labelledby={headingId}>
      <Card className="space-y-3 p-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={headingId} className="text-base font-semibold">{title}</h3>
          {actions}
        </header>
        {children}
      </Card>
    </section>
  );
}
