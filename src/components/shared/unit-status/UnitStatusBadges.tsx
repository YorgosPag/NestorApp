'use client';

/**
 * =============================================================================
 * UnitStatusBadges — ο ΕΝΑΣ ζωγράφος των σημάτων κατάστασης μιας μονάδας (ADR-777 §8.60.20)
 * =============================================================================
 *
 * Παίρνει **έτοιμα** σήματα από τον επιλυτή (`spaceStatusBadges` · `propertyStatusBadges`) και τα
 * ζωγραφίζει με το κεντρικό `Badge` — του οποίου τα συμπαγή γεμίσματα έχουν **μετρημένο** μελάνι
 * και στα δύο θέματα (`SOLID_FILL_INK`, ADR-854 §3 · ADR-915 §11.4). Καμία επιφάνεια δεν κρατά
 * δικό της χάρτη «κατάσταση → χρώμα»: ως τις 2026-10-19 η καρτέλα «Μονάδες» του κτιρίου είχε,
 * με `text-primary` πάνω σε κάρτα — **αόρατο** στο σκοτεινό θέμα (ADR-770).
 *
 * Η κατάσταση διαβάζεται **χωρίς χρώμα** (WCAG 1.4.1 · ADR-771): το κανάλι ταυτότητας είναι η
 * **ετικέτα**, ποτέ η απόχρωση — δύο καταστάσεις με ίδια απόχρωση (πωλήθηκε · ενοικιάστηκε)
 * λένε διαφορετική λέξη.
 *
 * @module components/shared/unit-status/UnitStatusBadges
 */

import { Badge } from '@/components/ui/badge';
import type { GridCardBadge } from '@/design-system/components/GridCard/GridCard.types';

export interface UnitStatusBadgesProps {
  readonly badges: readonly GridCardBadge[];
  readonly className?: string;
}

export function UnitStatusBadges({ badges, className }: UnitStatusBadgesProps) {
  if (badges.length === 0) return <span aria-hidden="true">—</span>;
  return (
    // `span`: το `Badge` είναι `<span>` (ADR-867 Β9) ⇒ το περιτύλιγμα μένει έγκυρο και μέσα σε
    // `<p>`/`<header>` κάρτας, όχι μόνο σε κελί πίνακα.
    <span className={className ?? 'inline-flex flex-wrap gap-1'}>
      {badges.map((badge) => (
        <Badge key={badge.label} variant={badge.variant} className="text-xs font-medium">
          {badge.label}
        </Badge>
      ))}
    </span>
  );
}
