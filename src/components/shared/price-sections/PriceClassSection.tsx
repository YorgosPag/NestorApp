'use client';

/**
 * @fileoverview **ΕΝΑ ΤΜΗΜΑ ΜΙΑΣ ΛΙΣΤΑΣ ΚΑΡΤΩΝ «ΚΑΤΑ ΤΙΜΗ»** — μία κλάση (μονάδα), με ή χωρίς επιγραφή.
 * @related ADR-777 §8.60.14 · §8.60.14.14 · lib/properties/price-class-sections.ts
 * @module components/shared/price-sections/PriceClassSection
 *
 * 🔑 **Κοινό για τη δημόσια λίστα αποτελεσμάτων ΚΑΙ τις εσωτερικές λίστες** (θέσεις, αποθήκες):
 * δύο αντίγραφα της ίδιας επικεφαλίδας θα ήταν δίδυμο (N.18) — και δύο γνώμες για το πώς
 * δηλώνεται μια κλάση.
 *
 * ⚠️ **ΜΙΑ ΚΛΑΣΗ, ΚΑΜΙΑ ΠΕΡΙΤΥΛΙΞΗ**: `heading === null` ⇒ τα παιδιά αυτούσια, ούτε `<section>`
 * ούτε επιγραφή — η οθόνη μένει χαρακτήρα προς χαρακτήρα η σημερινή.
 *
 * ⚠️ **`<section>` με επιγραφή, ποτέ `<div>` με έντονο κείμενο** (N.4): ο αναγνώστης οθόνης
 * οφείλει να **πηδά** από κλάση σε κλάση. Το **επίπεδο** της επιγραφής το λέει ο καλών: πρέπει
 * να είναι **πάνω** από τον τίτλο κάθε κάρτας, αλλιώς «Πώληση» και «Διαμέρισμα» γίνονται αδέλφια.
 *
 * 🔑 **`sticky`**: ό,τι κάνει το Revit όταν επαναλαμβάνει την επικεφαλίδα ομάδας σε κάθε
 * σελίδα — η κλάση δεν χάνεται όταν κυλήσει έξω.
 */

import type { ReactNode } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { priceSectionLabel } from '@/lib/listings/listing-price-label';
import type { PriceClass } from '@/lib/properties/price-resolver';

interface PriceClassSectionProps {
  /** Η κλάση του τμήματος — `null` ⇔ μία μόνο κλάση (καμία επιγραφή). */
  readonly heading: PriceClass | null;
  /** Πόσα στοιχεία περιέχει — ζει **μέσα** στην επιγραφή. */
  readonly count: number;
  /** Πρόθεμα μοναδικό στη σελίδα· το `id` της επιγραφής = `${idPrefix}-${heading}`. */
  readonly idPrefix: string;
  /** Το επίπεδο της επιγραφής — ένα πάνω από τον τίτλο των καρτών. */
  readonly level: 'h2' | 'h3';
  readonly children: ReactNode;
}

export function PriceClassSection({ heading, count, idPrefix, level: Heading, children }: PriceClassSectionProps) {
  const { t } = useTranslation(['common']);

  if (heading === null) return <>{children}</>;

  const headingId = `${idPrefix}-${heading}`;
  return (
    <section aria-labelledby={headingId}>
      <Heading
        id={headingId}
        className="sticky top-0 z-10 bg-background/95 px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur"
      >
        {priceSectionLabel(t, heading, count)}
      </Heading>
      {children}
    </section>
  );
}
