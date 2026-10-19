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
 * Τον ζωγράφο τον μοιράζεται με τα ακίνητα (`UnitStatusBadges`).
 *
 * @module components/shared/unit-status/SpaceStatusBadges
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { spaceStatusBadges } from '@/lib/units/unit-status-badges';
import type { SpaceStatusSource } from '@/lib/spaces/space-status-split';
import { UnitStatusBadges } from './UnitStatusBadges';

export interface SpaceStatusBadgesProps {
  readonly space: SpaceStatusSource;
  readonly className?: string;
}

export function SpaceStatusBadges({ space, className }: SpaceStatusBadgesProps) {
  const { t } = useTranslation('properties-enums');
  return <UnitStatusBadges badges={spaceStatusBadges(space, t)} className={className} />;
}
