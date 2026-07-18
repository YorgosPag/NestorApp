'use client';

import React, { useSyncExternalStore } from 'react';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import {
  isPickBasePointArmed,
  subscribePickBasePoint,
} from '../../systems/block/pick-base-point-store';
import {
  getRealtimeWorldCursor,
  subscribeRealtimeWorldCursor,
} from '../../systems/cursor/ImmediatePositionStore';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';

interface Props {
  transform: ViewTransform;
  viewport: Viewport;
}

/** Μισή πλευρά του τετραγώνου (screen px, σταθερό — σαν AutoCAD base marker). */
const SQUARE_HALF_PX = 6;
/** Μήκος βραχίονα σταυρονήματος πέρα από το τετράγωνο (screen px). */
const CROSS_ARM_PX = 13;
/** Πορτοκαλί «σημείου βάσης» — ξεχωριστό από το snap glyph & το κυανό clearance. */
const MARKER_COLOR = '#f59e0b';
const HALO_COLOR = '#0b0f19';

const getServerArmed = (): boolean => false;
const getServerCursor = (): null => null;

/**
 * ADR-652 M6.1 — «σημείο βάσης» ghost marker. Όσο ο διάλογος «Δημιουργία Block» έχει armed την
 * επιλογή σημείου ({@link isPickBasePointArmed}), ένα πορτοκαλί τετράγωνο + σταυρόνημα ακολουθεί
 * τον κέρσορα στο τελικό **snapped** σημείο — δείχνει ΠΟΥ θα κουμπώσει το base point (AutoCAD
 * «Specify base point» rubber marker).
 *
 * ADR-040: **gate-at-mount** — ο εξωτερικός subscriber ακούει ΜΟΝΟ το low-freq `armed` flag· ο
 * high-freq realtime-cursor subscriber ζει μόνο όσο armed (ο inner unmount-άρει αλλιώς). Read-only,
 * `pointer-events-none`. Mirror του {@link RegionGapMarkersOverlay} (SVG leaf projection).
 */
export function BasePointPickMarkerOverlay({ transform, viewport }: Props) {
  const armed = useSyncExternalStore(subscribePickBasePoint, isPickBasePointArmed, getServerArmed);
  if (!armed) return null;
  return <BasePointPickMarkerInner transform={transform} viewport={viewport} />;
}

const BasePointPickMarkerInner: React.FC<Props> = ({ transform, viewport }) => {
  // Ο realtime channel είναι το FINAL effective **snapped** world (mouse-handler-move) — locked στο
  // crosshair/ghosts (ΟΧΙ ο throttled raw channel). Read-only leaf → επιτρεπτό high-freq sub (ADR-040).
  const world = useSyncExternalStore(subscribeRealtimeWorldCursor, getRealtimeWorldCursor, getServerCursor);
  if (!world) return null;

  const p = CoordinateTransforms.worldToScreen(world, transform, viewport);
  const x = Number(p.x.toFixed(1));
  const y = Number(p.y.toFixed(1));
  const h = SQUARE_HALF_PX;

  return (
    <svg
      className="absolute inset-0 size-full pointer-events-none z-20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g>
        {/* Σκούρο halo για αντίθεση πάνω σε ανοιχτό/σκούρο σχέδιο. */}
        <rect
          x={x - h - 1}
          y={y - h - 1}
          width={2 * h + 2}
          height={2 * h + 2}
          rx="1"
          fill="none"
          stroke={HALO_COLOR}
          strokeWidth="4"
          opacity="0.5"
        />
        <rect
          x={x - h}
          y={y - h}
          width={2 * h}
          height={2 * h}
          rx="1"
          fill="none"
          stroke={MARKER_COLOR}
          strokeWidth="2"
        />
        <line x1={x - CROSS_ARM_PX} y1={y} x2={x - h} y2={y} stroke={MARKER_COLOR} strokeWidth="1.5" />
        <line x1={x + h} y1={y} x2={x + CROSS_ARM_PX} y2={y} stroke={MARKER_COLOR} strokeWidth="1.5" />
        <line x1={x} y1={y - CROSS_ARM_PX} x2={x} y2={y - h} stroke={MARKER_COLOR} strokeWidth="1.5" />
        <line x1={x} y1={y + h} x2={x} y2={y + CROSS_ARM_PX} stroke={MARKER_COLOR} strokeWidth="1.5" />
      </g>
    </svg>
  );
};
