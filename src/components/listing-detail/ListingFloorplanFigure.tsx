'use client';

/**
 * @fileoverview 🧭 **ΜΙΑ ΚΑΤΟΨΗ ΩΣ ΣΧΕΔΙΟ** — η εικόνα, το βέλος βορρά της όταν δηλώθηκε, και ό,τι κάθεται από πάνω (ADR-897 Φ5.2).
 * @related components/shared/media/FloorplanFigure (η ΜΙΑ απόδοση) · ListingFloorplanWithSpots.tsx · media/ListingFloorplanSpotsFigure.tsx
 * @module components/listing-detail/ListingFloorplanFigure
 *
 * 🔑 **Λεπτός προσαρμογέας** (ADR-899 §8): η εικόνα, το βέλος βορρά και η μέτρηση διαστάσεων ζουν στο κοινό
 *   `FloorplanFigure`· εδώ μένει μόνο η μετάφραση της δημόσιας κάτοψης (`ListingFloorplan`) σε ουδέτερη πηγή.
 * 🏆 Revit / ArchiCAD: στη γωνία του φύλλου, πάνω-δεξιά, χωρίς να στρίβει η κάτοψη (μοντέλο «Project → True North»).
 * ⚠️ Ο βορράς διαβάζεται **μόνο** με `readListingNorthRad` (μέσα στο `listingFloorplanSource`) — σκουπίδι ⇒ κανένα βέλος.
 */

import { useCallback } from 'react';

import { FloorplanFigure } from '@/components/shared/media/FloorplanFigure';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { listingFloorplanSource } from '@/lib/listings/listing-capture-spots';
import type { ListingFloorplan } from '@/types/public-listing';

export interface ListingFloorplanFigureProps {
  readonly floorplan: ListingFloorplan;
  readonly sizes: string;
  readonly className?: string;
}

/**
 * **Το `alt` μιας δημόσιας κάτοψης** — η ΜΙΑ δυναμική κλήση `t(altKey)` για κάθε κάτοψη αγγελίας (δηλωμένη στο
 * `.i18n-shell-slice.json` → `dynamicKeyPolicy` αυτού του αρχείου). Την καλούν και οι προσαρμογείς σημείων/lightbox, ώστε
 * ο τεμαχιστής να βλέπει **ένα** σημείο αντί για τρία.
 */
export function useListingFloorplanAlt(): (floorplan: ListingFloorplan) => string {
  const { t } = useTranslation(['search-results']);
  return useCallback((floorplan: ListingFloorplan) => t(floorplan.value.altKey), [t]);
}

export function ListingFloorplanFigure({ floorplan, sizes, className }: ListingFloorplanFigureProps) {
  const altOf = useListingFloorplanAlt();
  return (
    <FloorplanFigure source={listingFloorplanSource(floorplan, altOf(floorplan))} sizes={sizes} className={className} />
  );
}
