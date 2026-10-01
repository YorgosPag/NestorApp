'use client';

/**
 * @fileoverview 📍 **Μια κάτοψη με τα σημεία λήψης της** — η μία απόδοση για lightbox, σελίδα κατόψεων και κάρτα (ADR-897 Φ4).
 * @related lib/listings/listing-capture-spots · components/listings/capture-spots/CaptureSpotLayer (τα σημεία)
 * @module components/listing-detail/media/ListingFloorplanSpotsFigure
 *
 * 🔑 **Λεπτός προσαρμογέας** (ADR-899 §4): η απόδοση ζει στο κοινό `shared/media/FloorplanSpotsFigure` — εδώ μόνο η
 *   μετάφραση `ListingFloorplanSpots` → `FloorplanSpotsEntry` (`toFloorplanSpotsEntry`).
 * 🔑 **Η ΙΔΙΑ εικόνα με κάθε άλλη κάτοψη** (`ListingFloorplanFigure` — εικόνα + βέλος βορρά· `shared/media/FloorplanFigure` — `alt`, `srcSet`, `object-contain`, χωρίς `priority`)·
 *   εδώ προστίθεται **μόνο** το SVG των σημείων από πάνω, με `viewBox` στις διαστάσεις της εικόνας (μηδέν inline style).
 *   Η εικόνα δεν κόβεται ποτέ, άρα τα σημεία κάθονται ακριβώς εκεί που τα έβαλε ο άνθρωπος.
 * ♿ Κάθε σημείο: «Φωτογραφία N από M» — ο αριθμός που βλέπει ο επισκέπτης στο lightbox, όχι εσωτερικός δείκτης.
 */

import { FloorplanSpotsFigure } from '@/components/shared/media/FloorplanSpotsFigure';
import { useListingFloorplanAlt } from '@/components/listing-detail/ListingFloorplanFigure';
import { toFloorplanSpotsEntry, type ListingFloorplanSpots } from '@/lib/listings/listing-capture-spots';

export interface ListingFloorplanSpotsFigureProps {
  readonly entry: ListingFloorplanSpots;
  /** Πόσες φωτογραφίες έχει η αγγελία — για το «N από M». */
  readonly total: number;
  readonly currentImageIndex: number | null;
  readonly onActivate: (imageIndex: number) => void;
  readonly sizes: string;
  readonly className?: string;
}

export function ListingFloorplanSpotsFigure({ entry, ...rest }: ListingFloorplanSpotsFigureProps) {
  const altOf = useListingFloorplanAlt();
  return <FloorplanSpotsFigure entry={toFloorplanSpotsEntry(entry, altOf(entry.floorplan))} {...rest} />;
}
