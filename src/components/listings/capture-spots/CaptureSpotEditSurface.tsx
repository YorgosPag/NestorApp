'use client';

/**
 * @fileoverview **Η ΚΑΤΟΨΗ ΤΟΥ ΕΠΕΞΕΡΓΑΣΤΗ** — εικόνα, σημεία, και οι λαβές της επιλεγμένης φωτογραφίας (ADR-897 Φ3).
 * @related use-capture-spot-gestures.ts (οι κινήσεις) · CaptureSpotLayer.tsx (`CaptureSpotMarkers` — η ΙΔΙΑ απόδοση με τον θεατή)
 * @module components/listings/capture-spots/CaptureSpotEditSurface
 *
 * 🏆 **Τρεις λαβές, μοντέλο Revit**: η τελεία σύρεται (θέση) · ο **στόχος** μπροστά της σύρεται (κατεύθυνση) · οι δύο
 *   **άκρες** του κώνου σύρονται (πεδίο). Η CubiCasa έχει μόνο θέση + στροφή — εδώ ο άνθρωπος βλέπει και διορθώνει **τι
 *   χωρά** στη φωτογραφία.
 * 🎨 Μηδέν inline style (N.3): `<img>` για τις φυσικές διαστάσεις + SVG από πάνω με `viewBox` = η εικόνα (ιδίωμα `FocalPointSurface`).
 */

import { type PointerEvent, useRef } from 'react';

import { pointAlongHeading, reachInsideBox } from '@/lib/geometry/view-cone';
import type { PhotoCaptureSpot } from '@/lib/listings/photo-capture-spot';
import type { ImageSize } from '@/lib/listings/photo-capture-spot-edit';
import { cn } from '@/lib/utils';
import { SPACE_HANDLE_CLASS } from '@/components/spatial-tour/viewer/tour-plan-overlay-palette';
import { IMAGE_OVERLAY_FRAME_CLASS } from '@/components/listings/image-overlay-frame';

import { CaptureSpotMarkers, type CaptureSpotMarker } from './CaptureSpotLayer';
import { FloorplanNorthArrow } from './FloorplanNorthArrow';
import { captureSpotMetrics, type CaptureSpotMetrics } from './capture-spot-metrics';
import { useCaptureSpotGestures } from './use-capture-spot-gestures';

/** Ο στόχος κάθεται λίγο **πέρα** από την άκρη του κώνου, ώστε να μην πέφτει πάνω στις λαβές του πεδίου. */
const TARGET_REACH = 1.25;

export interface CaptureSpotEditLabels {
  readonly surface: string;
  readonly target: string;
  readonly fovEdge: string;
  /** 🧭 Το γράμμα του βορρά και το όνομα του βέλους (με τη γωνία) — ήδη μεταφρασμένα. */
  readonly northGlyph: string;
  readonly northArrow: string;
}

export interface CaptureSpotEditSurfaceProps {
  readonly src: string;
  readonly alt: string;
  readonly size: ImageSize | null;
  readonly onSize: (size: ImageSize) => void;
  readonly onError: () => void;
  readonly floorplanId: string;
  readonly markers: readonly CaptureSpotMarker[];
  readonly selectedPhotoId: string | null;
  readonly selected: PhotoCaptureSpot | null;
  readonly onSelect: (photoId: string) => void;
  readonly onChange: (next: PhotoCaptureSpot | null) => void;
  readonly labels: CaptureSpotEditLabels;
  readonly initialFovRad?: number;
  /** 🧭 Ο βορράς της κάτοψης στο πρόχειρο (ADR-897 Φ5.2) — `null` ⇒ δεν δηλώθηκε, κανένα βέλος. */
  readonly northRad: number | null;
  readonly onNorth: (northRad: number) => void;
}

interface HandlesProps {
  readonly spot: PhotoCaptureSpot;
  readonly image: ImageSize;
  readonly metrics: CaptureSpotMetrics;
  readonly labels: CaptureSpotEditLabels;
  readonly onHandle: (kind: 'aim' | 'fov') => (event: PointerEvent<SVGElement>) => void;
}

/**
 * ⚠️ Οι λαβές είναι **μόνο για δείκτη** — η ισοδύναμη πράξη πληκτρολογίου ζει στην επιφάνεια (`[` `]` `-` `+`) και στους
 * ρυθμιστές του επιθεωρητή. Το `<title>` δίνει την εξήγηση στο hover (στοιχείο SVG, όχι χαρακτηριστικό HTML — CHECK 3.23).
 */
function SpotHandles({ spot, image, metrics, labels, onHandle }: HandlesProps) {
  const origin = { x: spot.x * image.width, y: spot.y * image.height };
  // ⚠️ Η λαβή κοντεύει, ποτέ δεν βγαίνει από την εικόνα: εκεί το SVG την κόβει ⇒ απρόσιτη στο ποντίκι (ADR-897 §6).
  const along = (headingRad: number, radius: number) =>
    pointAlongHeading(origin, headingRad, Math.min(radius, reachInsideBox(origin, headingRad, image, metrics.handle)));
  const target = along(spot.headingRad, metrics.cone * TARGET_REACH);
  const edges = [-1, 1].map((side) => along(spot.headingRad + (side * spot.fovRad) / 2, metrics.cone));
  return (
    <g aria-hidden>
      <line x1={origin.x} y1={origin.y} x2={target.x} y2={target.y} strokeWidth={metrics.stroke}
        strokeDasharray={`${metrics.stroke * 3} ${metrics.stroke * 2}`} className="stroke-chart-1" aria-hidden />
      {edges.map((edge, index) => (
        <circle key={index} cx={edge.x} cy={edge.y} r={metrics.handle * 0.8} strokeWidth={metrics.stroke}
          className={cn(SPACE_HANDLE_CLASS, 'cursor-ew-resize')} onPointerDown={onHandle('fov')}>
          <title>{labels.fovEdge}</title>
        </circle>
      ))}
      <circle cx={target.x} cy={target.y} r={metrics.handle} strokeWidth={metrics.stroke}
        className={cn(SPACE_HANDLE_CLASS, 'cursor-grab')} onPointerDown={onHandle('aim')}>
        <title>{labels.target}</title>
      </circle>
    </g>
  );
}

export function CaptureSpotEditSurface(props: CaptureSpotEditSurfaceProps) {
  const { src, alt, size, onSize, onError, markers, selectedPhotoId, selected, labels } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const image = size ?? { width: 1, height: 1 };
  const gestures = useCaptureSpotGestures({
    svgRef, image, floorplanId: props.floorplanId, hasSelection: selectedPhotoId !== null,
    selected, initialFovRad: props.initialFovRad, onChange: props.onChange,
  });
  const metrics = captureSpotMetrics(image);
  const onThisPlan = selected !== null && selected.floorplanFileId === props.floorplanId;

  return (
    <figure className={cn(IMAGE_OVERLAY_FRAME_CLASS, 'max-w-full select-none')}>
      <img src={src} alt={alt} draggable={false} onError={onError}
        onLoad={(event) => onSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
        className="block max-h-[70vh] max-w-full rounded-md border border-border bg-white" />
      {size !== null && (
        <svg ref={svgRef} viewBox={`0 0 ${size.width} ${size.height}`} role="application" tabIndex={0}
          aria-label={labels.surface}
          className={cn('absolute inset-0 h-full w-full touch-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring',
            selectedPhotoId !== null && 'cursor-crosshair')}
          onPointerDown={gestures.onSurfacePointerDown} onPointerMove={gestures.onPointerMove}
          onPointerUp={gestures.onPointerUp} onPointerCancel={gestures.onPointerCancel} onKeyDown={gestures.onKeyDown}>
          <CaptureSpotMarkers image={size} markers={markers} currentKey={onThisPlan ? selectedPhotoId : null}
            onActivate={props.onSelect} metrics={metrics} />
          {onThisPlan && (
            <>
              <circle cx={selected.x * size.width} cy={selected.y * size.height} r={metrics.current * 1.6}
                className="cursor-move fill-transparent" onPointerDown={gestures.onHandlePointerDown('position')} aria-hidden />
              <SpotHandles spot={selected} image={size} metrics={metrics} labels={labels}
                onHandle={gestures.onHandlePointerDown} />
            </>
          )}
        </svg>
      )}
      {size !== null && props.northRad !== null && (
        <FloorplanNorthArrow northRad={props.northRad} glyph={labels.northGlyph} label={labels.northArrow}
          onRotate={props.onNorth} className="absolute right-2 top-2" />
      )}
    </figure>
  );
}
