'use client';

/**
 * # Η ΕΠΙΦΑΝΕΙΑ ΣΧΕΔΙΑΣΗΣ ΠΑΝΩ ΣΤΟΝ ΧΑΡΤΗ (ADR-885)
 *
 * Διάφανη στρώση που **πιάνει** τον δείκτη όσο διαρκεί η σχεδίαση. Παιδί του χάρτη (όπως οι
 * πινακίδες τιμής), γιατί χρειάζεται την **προβολή** του (`unproject`) — όχι χειριστήριο.
 *
 * 🔑 **Pointer Events + `setPointerCapture` + `touch-action: none`** — ένας κώδικας για
 * ποντίκι, πένα και **ένα δάχτυλο**. Εκεί ακριβώς αποτυγχάνει το terra-draw (freehand
 * «not supported» στην αφή) και εκεί δουλεύει το app της Zillow.
 *
 * 🔒 **Το pan κλειδώνει ΔΟΜΙΚΑ, όχι με σημαία**: η στρώση είναι πάνω από τον καμβά, άρα ο
 * χάρτης δεν βλέπει ποτέ το σύρσιμο. Κανένα `dragPan.disable()` που θα ξεχνούσε κάποιος
 * να ξανανοίξει σε ένα μονοπάτι σφάλματος.
 *
 * ⚡ **Η ζωντανή γραμμή δεν περνά από το React**: κάθε κίνηση γράφει το `points` του
 * `<polyline>` απευθείας (ADR-040 — κανένα setState στα 60 fps). Το React μαθαίνει μόνο
 * το **τέλος** της χειρονομίας.
 *
 * 🔑 **Σύρσιμο ή πάτημα;** — πάνω από {@link DRAG_THRESHOLD_PX} κίνησης είναι ελεύθερη
 * χειρονομία· κάτω, είναι κορυφή. Πάτημα κοντά στην **πρώτη** κορυφή κλείνει το σχήμα
 * (σύμβαση Funda/Figma pen).
 */

import React, { useCallback, useRef } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useMap } from '@/lib/maps/maplibre';
import { metersToPixels } from '@/lib/maps/metric-size';
import type { GeoPoint } from '@/types/geo/coordinates';

interface DrawAreaSurfaceProps {
  readonly trace: readonly GeoPoint[];
  readonly onStroke: (stroke: readonly GeoPoint[], toleranceM: number) => void;
  readonly onVertex: (point: GeoPoint) => void;
  readonly onCloseTrace: () => void;
}

/** Κάτω από αυτό, η κίνηση είναι τρέμουλο πατήματος — όχι σύρσιμο. */
const DRAG_THRESHOLD_PX = 6;
/** Πυκνότητα δειγματοληψίας της γραμμής — πυκνότερα δεν βλέπει το μάτι. */
const SAMPLE_SPACING_PX = 3;
/** Πόσο κοντά στην πρώτη κορυφή «κουμπώνει» το κλείσιμο — στόχος αφής, WCAG 2.5.8. */
const CLOSE_SNAP_PX = 16;
/** Η απλοποίηση απέχει από τη γραμμή το πολύ τόσα pixel — κάτω από το πάχος της. */
const FREEHAND_TOLERANCE_PX = 2;

type Pixel = readonly [number, number];

function pixelDistance(a: Pixel, b: Pixel): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function DrawAreaSurface({ trace, onStroke, onVertex, onCloseTrace }: DrawAreaSurfaceProps) {
  const { t } = useTranslation(['search-region']);
  const { current: mapRef } = useMap();
  const lineRef = useRef<SVGPolylineElement>(null);
  const pixelsRef = useRef<Pixel[]>([]);
  const draggingRef = useRef(false);

  const localPixel = useCallback((event: React.PointerEvent<SVGSVGElement>): Pixel => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  }, []);

  const toGeo = useCallback(
    (pixel: Pixel): GeoPoint | null => {
      if (!mapRef) return null;
      const { lng, lat } = mapRef.unproject([pixel[0], pixel[1]]);
      return { lat, lng };
    },
    [mapRef]
  );

  const paintLine = (pixels: readonly Pixel[]): void => {
    lineRef.current?.setAttribute('points', pixels.map(([x, y]) => `${x},${y}`).join(' '));
  };

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>): void => {
    if (!event.isPrimary || event.button > 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pixelsRef.current = [localPixel(event)];
    draggingRef.current = false;
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>): void => {
    const pixels = pixelsRef.current;
    if (!event.isPrimary || pixels.length === 0) return;
    const pixel = localPixel(event);
    if (!draggingRef.current && pixelDistance(pixel, pixels[0]) < DRAG_THRESHOLD_PX) return;
    draggingRef.current = true;
    if (pixelDistance(pixel, pixels[pixels.length - 1]) < SAMPLE_SPACING_PX) return;
    pixels.push(pixel);
    paintLine(pixels);
  };

  const finishStroke = (pixels: readonly Pixel[]): void => {
    if (!mapRef) return;
    const stroke = pixels.map(toGeo).filter((point): point is GeoPoint => point !== null);
    const center = mapRef.getCenter();
    const toleranceM = FREEHAND_TOLERANCE_PX / metersToPixels(1, mapRef.getZoom(), center.lat);
    onStroke(stroke, toleranceM);
  };

  const finishTap = (pixel: Pixel): void => {
    const first = trace.length >= 3 && mapRef ? mapRef.project([trace[0].lng, trace[0].lat]) : null;
    if (first !== null && pixelDistance(pixel, [first.x, first.y]) <= CLOSE_SNAP_PX) {
      onCloseTrace();
      return;
    }
    const point = toGeo(pixel);
    if (point !== null) onVertex(point);
  };

  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>): void => {
    const pixels = pixelsRef.current;
    if (!event.isPrimary || pixels.length === 0) return;
    pixelsRef.current = [];
    paintLine([]);
    if (draggingRef.current) finishStroke(pixels);
    else finishTap(pixels[0]);
  };

  const onPointerCancel = (): void => {
    pixelsRef.current = [];
    draggingRef.current = false;
    paintLine([]);
  };

  return (
    <svg
      role="application"
      aria-label={t('search-region:draw.surface')}
      className="absolute inset-0 z-10 h-full w-full cursor-crosshair touch-none bg-background/20"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <polyline
        ref={lineRef}
        points=""
        fill="none"
        className="stroke-foreground"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
