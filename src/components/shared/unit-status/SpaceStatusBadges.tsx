'use client';

/**
 * =============================================================================
 * SpaceStatusBadges — η κατάσταση ενός χώρου σε πίνακα ή δέντρο (ADR-777 §8.60.20)
 * =============================================================================
 *
 * **Ένα** component για κάθε επιφάνεια που δεν είναι κάρτα (πίνακες κτιρίου · δέντρο έργου ·
 * σελίδα αποθήκης). Ως τις 2026-09-18 καθεμιά είχε δικό της `<span>` με δικό της χάρτη χρωμάτων
 * πάνω στο παλιό ανάμεικτο `status`. Τώρα ζωγραφίζει τα σήματα του **ΕΝΟΣ** SSoT
 * (`spaceStatusBadges`): διάθεση από το `commercialStatus` + λειτουργική εξαίρεση.
 *
 * @module components/shared/unit-status/SpaceStatusBadges
 */

import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { spaceStatusBadges } from '@/lib/units/unit-status-badges';
import type { SpaceStatusSource } from '@/lib/spaces/space-status-split';

export interface SpaceStatusBadgesProps {
  readonly space: SpaceStatusSource;
  readonly className?: string;
}

export function SpaceStatusBadges({ space, className }: SpaceStatusBadgesProps) {
  const { t } = useTranslation('properties-enums');
  const badges = spaceStatusBadges(space, t);
  if (badges.length === 0) return <span aria-hidden="true">—</span>;
  return (
    // `div`: το `Badge` είναι μπλοκ στοιχείο — μέσα σε `span` θα ήταν άκυρο HTML.
    <div className={className ?? 'inline-flex flex-wrap gap-1'}>
      {badges.map((badge) => (
        <Badge key={badge.label} variant={badge.variant} className="text-xs font-medium">
          {badge.label}
        </Badge>
      ))}
    </div>
  );
}
