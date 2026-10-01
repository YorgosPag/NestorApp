'use client';

/**
 * @fileoverview 📍 **Μια κάτοψη με τα σημεία λήψης της** — η μία απόδοση για lightbox, σελίδα κατόψεων και κάρτα (ADR-897 Φ4).
 * @related lib/listings/listing-capture-spots · components/listings/capture-spots/CaptureSpotLayer (τα σημεία)
 * @module components/listing-detail/media/ListingFloorplanSpotsFigure
 *
 * 🔑 **Η ΙΔΙΑ εικόνα με κάθε άλλη κάτοψη** (`ListingFloorplanFigure` — εικόνα + βέλος βορρά· `ListingFloorplanImage` — `alt`, `srcSet`, `object-contain`, χωρίς `priority`)·
 *   εδώ προστίθεται **μόνο** το SVG των σημείων από πάνω, με `viewBox` στις διαστάσεις της εικόνας (μηδέν inline style).
 *   Η εικόνα δεν κόβεται ποτέ, άρα τα σημεία κάθονται ακριβώς εκεί που τα έβαλε ο άνθρωπος.
 * ♿ Κάθε σημείο: «Φωτογραφία N από M» — ο αριθμός που βλέπει ο επισκέπτης στο lightbox, όχι εσωτερικός δείκτης.
 */

import { CaptureSpotLayer, type CaptureSpotMarker } from '@/components/listings/capture-spots/CaptureSpotLayer';
import { ListingFloorplanFigure } from '@/components/listing-detail/ListingFloorplanFigure';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ListingFloorplanSpots } from '@/lib/listings/listing-capture-spots';

export interface ListingFloorplanSpotsFigureProps {
  readonly entry: ListingFloorplanSpots;
  /** Πόσες φωτογραφίες έχει η αγγελία — για το «N από M». */
  readonly total: number;
  readonly currentImageIndex: number | null;
  readonly onActivate: (imageIndex: number) => void;
  readonly sizes: string;
  readonly className?: string;
}

export function ListingFloorplanSpotsFigure(props: ListingFloorplanSpotsFigureProps) {
  const { entry, total, currentImageIndex, onActivate, sizes, className } = props;
  const { t } = useTranslation(['listing-detail']);
  const label = t('listing-detail:media.capture.planLabel', { index: entry.ordinal });
  const markers: CaptureSpotMarker[] = entry.photos.map(({ imageIndex, spot }) => ({
    key: String(imageIndex),
    label: t('listing-detail:media.capture.markerLabel', { index: imageIndex + 1, total }),
    spot,
  }));

  return (
    <ListingFloorplanFigure floorplan={entry.floorplan} sizes={sizes} className={className}>
      <CaptureSpotLayer image={entry.floorplan.value} markers={markers}
        currentKey={currentImageIndex === null ? null : String(currentImageIndex)}
        onActivate={(key) => onActivate(Number(key))} ariaLabel={label} />
    </ListingFloorplanFigure>
  );
}
