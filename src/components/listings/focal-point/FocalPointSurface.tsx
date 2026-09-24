'use client';

/**
 * **Η επιφάνεια του επιλογέα** — το πρωτότυπο, τα ορατά ορθογώνια κάθε πλαισίου και το σταυρόνημα (ADR-880).
 *
 * 🏆 **Όλα τα πλαίσια ΠΑΝΩ στο πρωτότυπο**, όχι μόνο μια μικρογραφία στο πλάι: ο άνθρωπος βλέπει **τι μένει
 * έξω**, και το βλέπει όπως θα το κόψει η κάρτα **μετά την κβάντιση** (`renderedPhotoPosition`).
 *
 * ⚠️ **Μηδέν inline style (N.3)**: η επικάλυψη είναι SVG με `viewBox="0 0 100 100"` και
 * `preserveAspectRatio="none"` — οι θέσεις ζουν σε **χαρακτηριστικά** (`x`, `y`, `width`, …), και το
 * `vector-effect="non-scaling-stroke"` κρατά τις γραμμές λεπτές όσο κι αν τεντωθεί το σχήμα.
 * ⚠️ **Διπλή γραμμή `background` + `foreground`**: ορατή πάνω σε **οποιαδήποτε** φωτογραφία, σε **δύο** θέματα.
 */

import React from 'react';

import {
  coverVisibleRect,
  type PhotoFocalPoint,
  type VisibleRect,
} from '@/lib/listings/photo-focal-point';
import {
  LISTING_PHOTO_FRAMES,
  renderedPhotoPosition,
} from '@/components/search-results/listing-photo-position-class';
import type { FocalPointSurfaceHandlers } from './use-focal-point-picker';

export interface ImageSize {
  readonly width: number;
  readonly height: number;
}

interface FocalPointSurfaceProps {
  readonly src: string;
  readonly alt: string;
  readonly point: PhotoFocalPoint;
  /** Το αυτόματο σημείο — διακεκομμένο, μόνο όταν διαφέρει από το τρέχον. */
  readonly suggestion: PhotoFocalPoint | null;
  readonly size: ImageSize | null;
  readonly surfaceLabel: string;
  readonly valueText: string;
  readonly handlers: FocalPointSurfaceHandlers;
  readonly onSize: (size: ImageSize) => void;
  readonly onError: () => void;
}

const pct = (value: number): number => value * 100;

/** Όλο το κάδρο **εκτός** του ορατού ορθογωνίου — `evenodd`, μία διαδρομή. */
function outsidePath(rect: VisibleRect): string {
  const [x, y, w, h] = [pct(rect.x), pct(rect.y), pct(rect.w), pct(rect.h)];
  return `M0 0H100V100H0Z M${x} ${y}H${x + w}V${y + h}H${x}Z`;
}

function Crosshair({ point, dashed }: { readonly point: PhotoFocalPoint; readonly dashed: boolean }) {
  const [cx, cy] = [pct(point.x), pct(point.y)];
  const dash = dashed ? '3 3' : undefined;
  return (
    <g>
      {(['stroke-background', 'stroke-foreground'] as const).map((tone, layer) => (
        <g key={tone} className={tone} strokeWidth={layer === 0 ? 4 : 2} strokeDasharray={dash}>
          <line x1={cx - 6} y1={cy} x2={cx + 6} y2={cy} vectorEffect="non-scaling-stroke" />
          <line x1={cx} y1={cy - 6} x2={cx} y2={cy + 6} vectorEffect="non-scaling-stroke" />
        </g>
      ))}
    </g>
  );
}

function FrameOverlay({ size, point }: { readonly size: ImageSize; readonly point: PhotoFocalPoint }) {
  return (
    <>
      {LISTING_PHOTO_FRAMES.map((frame) => {
        const rect = coverVisibleRect(size, frame.aspect, renderedPhotoPosition(size, frame.aspect, point));
        return (
          <g key={frame.id}>
            <path d={outsidePath(rect)} fillRule="evenodd" className="fill-background opacity-60" />
            <rect
              x={pct(rect.x)}
              y={pct(rect.y)}
              width={pct(rect.w)}
              height={pct(rect.h)}
              className="fill-none stroke-foreground"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
    </>
  );
}

export function FocalPointSurface(props: FocalPointSurfaceProps): React.ReactElement {
  const { src, alt, point, suggestion, size, handlers } = props;
  const showSuggestion = suggestion !== null && (suggestion.x !== point.x || suggestion.y !== point.y);

  return (
    // ⚠️ `self-start`: ως grid item το figure τεντωνόταν στο ύψος της στήλης προεπισκόπησης όταν η φωτογραφία
    //    ήταν χαμηλή (μετρημένο 24/09, 889×365) — το SVG και το κουμπί κλικ (`inset-0`) κάλυπταν το ΤΕΝΤΩΜΕΝΟ κουτί
    //    ⇒ ορθογώνιο κάτω από την εικόνα και κλικ σε λάθος y. Το κουτί πρέπει να είναι ΑΚΡΙΒΩΣ η εικόνα.
    <figure className="relative m-0 mx-auto w-fit self-start touch-none select-none">
      {/* eslint-disable-next-line @next/next/no-img-element -- ιδιωτικό πρωτότυπο, εκτός optimizer */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        onLoad={(event) => props.onSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
        onError={props.onError}
        className="block max-h-[60vh] max-w-full"
      />
      {size !== null && (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
          <FrameOverlay size={size} point={point} />
          {showSuggestion && <Crosshair point={suggestion} dashed />}
          <Crosshair point={point} dashed={false} />
        </svg>
      )}
      <button
        type="button"
        aria-label={props.surfaceLabel}
        className="absolute inset-0 cursor-crosshair rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        {...handlers}
      >
        <span className="sr-only" aria-live="polite">{props.valueText}</span>
      </button>
    </figure>
  );
}
