'use client';

/**
 * @fileoverview **Μια λίστα καρτών ως ΤΜΗΜΑΤΑ ΑΝΑ ΜΟΝΑΔΑ ΤΙΜΗΣ** — για τις εσωτερικές λίστες.
 * @related ADR-777 §8.60.14.14 · lib/properties/price-class-sections.ts · ./PriceClassSection.tsx
 * @module components/shared/price-sections/PriceClassSectionedList
 *
 * 🔑 Ζωγραφίζει ό,τι αποφάσισε η μηχανή (`partitionByPriceClass` / `unsectioned`) — **καμία**
 * κρίση εδώ: ούτε κλάσεις, ούτε σειρά. Οι λίστες θέσεων και αποθηκών τη μοιράζονται· δύο
 * αντίγραφα του ίδιου βρόχου θα ήταν δίδυμο (N.18).
 */

import type { ReactNode } from 'react';
import type { PriceClassSections } from '@/lib/properties/price-class-sections';
import { PriceClassSection } from './PriceClassSection';

interface PriceClassSectionedListProps<T> {
  readonly sections: PriceClassSections<T>;
  /** Πρόθεμα μοναδικό στη σελίδα για τα `id` των επιγραφών. */
  readonly idPrefix: string;
  readonly getKey: (item: T) => string;
  readonly renderItem: (item: T) => ReactNode;
}

export function PriceClassSectionedList<T>({ sections, idPrefix, getKey, renderItem }: PriceClassSectionedListProps<T>) {
  return (
    <>
      {sections.map((section) => (
        <PriceClassSection
          key={section.heading ?? 'all'}
          heading={section.heading}
          count={section.items.length}
          idPrefix={idPrefix}
          // ⚠️ Οι τίτλοι των καρτών είναι `<h3>` (CardTitleBlock) ⇒ η κλάση **πάνω** τους.
          level="h2"
        >
          <ul className="space-y-2">
            {section.items.map((item) => (
              <li key={getKey(item)}>{renderItem(item)}</li>
            ))}
          </ul>
        </PriceClassSection>
      ))}
    </>
  );
}
