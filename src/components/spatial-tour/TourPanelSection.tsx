'use client';

/**
 * @fileoverview **ΤΟ ΠΛΑΙΣΙΟ ΜΙΑΣ ΥΠΟΕΝΟΤΗΤΑΣ ΤΟΥ ΠΑΝΕΛ «ΠΕΡΙΗΓΗΣΗ 360°»** — ένα πλαίσιο, μία επικεφαλίδα, μία ευθύνη.
 * @related ADR-777 §8.87.4 · §8.87.10 · ADR-884 §4.5 · `SpatialTourPanel.tsx` · `ui/section-frame.tsx`
 * @module components/spatial-tour/TourPanelSection
 *
 * 🔑 **Το πλαίσιο το φορά η ΥΠΟΕΝΟΤΗΤΑ, όχι το πάνελ.** Οι υποενότητες φορτώνουν ανεξάρτητα και κάποιες επιστρέφουν
 * `null` όσο δεν ξέρουν τι να δείξουν (ρυθμίσεις)· αν τις τύλιγε το πάνελ, θα ζωγράφιζε **άδειο πλαίσιο** γύρω από το
 * τίποτα. Έτσι ό,τι δεν αποδίδεται δεν αφήνει ίχνος.
 * 🔑 Το πλαίσιο **είναι** το `SectionFrame` του συστήματος (που γεννήθηκε από εδώ, §8.87.10)· αυτό το αρχείο κρατά μόνο
 * τις **σταθερές του πάνελ**: επίπεδο επικεφαλίδας `h3`, μέγεθος τίτλου, κενό — ώστε οι υποενότητες να μην τις επαναλαμβάνουν.
 */

import type { ReactNode } from 'react';

import { SectionFrame } from '@/components/ui/section-frame';

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
    <SectionFrame headingId={headingId} title={title} headingLevel="h3" gap={3} actions={actions ?? undefined}>
      {children}
    </SectionFrame>
  );
}
