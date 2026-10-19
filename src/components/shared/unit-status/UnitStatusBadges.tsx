'use client';

/**
 * =============================================================================
 * UnitStatusBadges — τα σήματα κατάστασης μιας μονάδας σε πίνακα, δέντρο ή κεφαλίδα (ADR-777 §8.60.20)
 * =============================================================================
 *
 * Παίρνει **έτοιμα** σήματα από τον επιλυτή (`spaceStatusBadges` · `propertyStatusBadges`) και τα
 * δίνει στον **ΕΝΑ** ζωγράφο σημάτων της εφαρμογής, το `CardBadges` — τον ίδιο που ζωγραφίζει τις
 * κάρτες. Άρα πίνακας και κάρτα **δεν μπορούν** να αποκλίνουν: ίδιο `Badge`, ίδιο μετρημένο μελάνι
 * (`SOLID_FILL_INK`, ADR-854 §3 · ADR-915 §11.4), ίδιο εικονίδιο-σχήμα.
 *
 * Ως τις 2026-10-19 η καρτέλα «Μονάδες» του κτιρίου είχε δικό της χάρτη «κατάσταση → χρώμα», με
 * `text-primary` πάνω σε κάρτα — **αόρατο** στο σκοτεινό θέμα (1,00:1, ADR-770).
 *
 * Η κατάσταση διαβάζεται **χωρίς χρώμα** (WCAG 1.4.1 · ADR-771) από **δύο** κανάλια: την ετικέτα
 * και το σχήμα του εικονιδίου (μοναδικό ανά κατάσταση).
 *
 * @module components/shared/unit-status/UnitStatusBadges
 */

import { CardBadges } from '@/design-system/primitives/Card';
import type { GridCardBadge } from '@/design-system/components/GridCard/GridCard.types';

export interface UnitStatusBadgesProps {
  readonly badges: readonly GridCardBadge[];
  readonly className?: string;
}

export function UnitStatusBadges({ badges, className }: UnitStatusBadgesProps) {
  if (badges.length === 0) return <span aria-hidden="true">—</span>;
  return (
    // `span`: το `Badge` είναι `<span>` (ADR-867 Β9) ⇒ το περιτύλιγμα μένει έγκυρο και μέσα σε
    // `<p>`/`<header>` κάρτας, όχι μόνο σε κελί πίνακα. Τα σήματα μιας μονάδας είναι ≤ 2 ⇒ καμία αποκοπή.
    <span className={className ?? 'inline-flex flex-wrap gap-1'}>
      <CardBadges badges={badges} max={badges.length} badgeClassName="text-xs font-medium" />
    </span>
  );
}
