'use client';

/**
 * @fileoverview 🧭 **ΜΙΑ ΚΑΤΟΨΗ ΩΣ ΣΧΕΔΙΟ** — η εικόνα, το βέλος βορρά της όταν δηλώθηκε, και ό,τι κάθεται από πάνω (ADR-897 Φ5.2).
 * @related ListingFloorplanImage.tsx (η εικόνα) · ListingFloorplanWithSpots.tsx · media/ListingFloorplanSpotsFigure.tsx
 * @module components/listing-detail/ListingFloorplanFigure
 *
 * 🔑 **Ένας τόπος για το βέλος βορρά**: κάρτα, σελίδα κατόψεων και πάνελ του lightbox περνούν **όλα** από εδώ, άρα
 *   ο επισκέπτης βλέπει τον βορρά σε **κάθε** κάτοψη που τον έχει — με ή χωρίς σημεία λήψης.
 * 🏆 Revit / ArchiCAD: στη γωνία του φύλλου, πάνω-δεξιά, χωρίς να στρίβει η κάτοψη (μοντέλο «Project → True North»).
 * ⚠️ Ο βορράς διαβάζεται **μόνο** με `readListingNorthRad` — σκουπίδι ⇒ κανένα βέλος, ποτέ βέλος σε λάθος μεριά.
 */

import type { ReactNode } from 'react';

import { FloorplanNorthArrow } from '@/components/listings/capture-spots/FloorplanNorthArrow';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { radToDeg } from '@/lib/geometry/angle';
import { readListingNorthRad } from '@/lib/listings/floorplan-north';
import { cn } from '@/lib/utils';
import type { ListingFloorplan } from '@/types/public-listing';

import { ListingFloorplanImage } from './ListingFloorplanImage';

export interface ListingFloorplanFigureProps {
  readonly floorplan: ListingFloorplan;
  readonly sizes: string;
  /** Ό,τι κάθεται **πάνω** στην εικόνα (τα σημεία λήψης) — στο ίδιο πλαίσιο, κάτω από το βέλος. */
  readonly children?: ReactNode;
  readonly className?: string;
}

export function ListingFloorplanFigure({ floorplan, sizes, children, className }: ListingFloorplanFigureProps) {
  const { t } = useTranslation(['listing-detail']);
  const north = readListingNorthRad(floorplan.value.northRad);

  return (
    <figure className={cn('relative m-0', className)}>
      <ListingFloorplanImage floorplan={floorplan} sizes={sizes} />
      {children}
      {north !== null && (
        <FloorplanNorthArrow northRad={north} glyph={t('listing-detail:media.capture.northGlyph')}
          label={t('listing-detail:media.capture.northLabel', { degrees: Math.round(radToDeg(north)) % 360 })}
          className="absolute right-2 top-2" />
      )}
    </figure>
  );
}
