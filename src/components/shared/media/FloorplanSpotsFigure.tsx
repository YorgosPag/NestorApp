'use client';

/**
 * @fileoverview **Μία κάτοψη με τα σημεία λήψης της** — κάθε σημείο κουμπί προς τη φωτογραφία του (ADR-897 · ADR-899 §4).
 * @module components/shared/media/FloorplanSpotsFigure
 * @related FloorplanFigure (η εικόνα, με μετρημένες διαστάσεις) · CaptureSpotLayer (τα σημεία) ·
 *          PhotoFloorplanPanel (πάνελ του lightbox) · listing-detail/media/ListingFloorplanSpotsFigure (προσαρμογέας)
 */

import { CaptureSpotLayer, type CaptureSpotMarker } from '@/components/listings/capture-spots/CaptureSpotLayer';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { FloorplanSpotsEntry } from '@/lib/media/photo-floorplan-spots';

import { FloorplanFigure } from './FloorplanFigure';

export interface FloorplanSpotsFigureProps {
  readonly entry: FloorplanSpotsEntry;
  /** Πόσες φωτογραφίες έχει η συλλογή — για το «Φωτογραφία N από M» κάθε σημείου. */
  readonly total: number;
  /** Η φωτογραφία που βλέπει τώρα ο θεατής — `null` ⇒ καμία τονισμένη. */
  readonly currentImageIndex: number | null;
  readonly onActivate: (imageIndex: number) => void;
  readonly sizes: string;
  readonly className?: string;
}

export function FloorplanSpotsFigure(props: FloorplanSpotsFigureProps) {
  const { entry, total, currentImageIndex, onActivate, sizes, className } = props;
  const { t } = useTranslation(['listing-detail']);
  const label = t('listing-detail:media.capture.planLabel', { index: entry.ordinal });
  const markers: CaptureSpotMarker[] = entry.photos.map(({ imageIndex, spot }) => ({
    key: String(imageIndex),
    label: t('listing-detail:media.capture.markerLabel', { index: imageIndex + 1, total }),
    spot,
  }));

  return (
    <FloorplanFigure source={entry.figure} sizes={sizes} className={className}>
      {(size) => (
        <CaptureSpotLayer image={size} markers={markers}
          currentKey={currentImageIndex === null ? null : String(currentImageIndex)}
          onActivate={(key) => onActivate(Number(key))} ariaLabel={label} />
      )}
    </FloorplanFigure>
  );
}
