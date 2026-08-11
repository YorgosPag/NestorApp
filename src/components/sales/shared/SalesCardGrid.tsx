'use client';

/**
 * =============================================================================
 * SALES CARD GRID — SSoT για την προβολή πλέγματος των σελίδων πωλήσεων
 * =============================================================================
 *
 * Το `<section>` του πλέγματος + το κενό αποτέλεσμα ήταν αντιγραμμένα στις 4
 * σελίδες πωλήσεων (properties / sold / parking / storage). Εδώ ζει ΜΟΝΟ ο
 * καμβάς: responsive columns, spacing, scrolling, empty state. Η κάρτα ανά
 * αντικείμενο μένει στη σελίδα — είναι το μόνο που πραγματικά διαφέρει.
 *
 * @module components/sales/shared/SalesCardGrid
 * @see SalesGridCard.tsx — η κοινή κάρτα (parking/storage/sold)
 * @see sales-list-page-shell.tsx — ο σκελετός που φιλοξενεί αυτό το πλέγμα
 */

import { SalesGridEmpty } from './SalesGridCard';
import { gridPatterns } from '@/styles/design-tokens';

interface SalesCardGridProps<T> {
  items: readonly T[];
  /** Ήδη μεταφρασμένο (N.11 — τα κλειδιά ζουν στα locales). */
  ariaLabel: string;
  /** Ήδη μεταφρασμένο — εμφανίζεται όταν δεν υπάρχουν αποτελέσματα. */
  emptyMessage: string;
  renderCard: (item: T) => React.ReactNode;
}

export function SalesCardGrid<T>({
  items,
  ariaLabel,
  emptyMessage,
  renderCard,
}: SalesCardGridProps<T>) {
  return (
    <section
      className={`flex-1 gap-2 p-2 overflow-y-auto grid ${gridPatterns.cards.tile}`}
      aria-label={ariaLabel}
    >
      {items.map(renderCard)}

      {items.length === 0 && <SalesGridEmpty message={emptyMessage} />}
    </section>
  );
}
