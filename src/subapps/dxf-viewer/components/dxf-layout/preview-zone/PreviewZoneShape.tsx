'use client';

import React from 'react';
import { largestBodyPieceIndex } from '../../../bim/walls/wall-painted-body';
import {
  PREVIEW_ZONE_LABEL,
  PREVIEW_ZONE_STYLE,
  type PreviewZoneTone,
} from '../../../systems/region-preview/preview-zone-style';
import type { Point2D, ViewTransform, Viewport } from '../../../rendering/types/Types';
import { pointsCentroid, screenPointsToSvgPath, worldRingToScreen } from './world-ring-path';

export interface PreviewZoneShapeProps {
  /**
   * Τα πολύγωνα (κόσμος) ΕΝΟΣ πράγματος — ένας τοίχος που τον χωρίζει κολώνα είναι δύο κομμάτια,
   * αλλά μία ζώνη και μία ετικέτα. Κομμάτι με λιγότερες από 3 κορυφές αγνοείται.
   */
  readonly pieces: readonly (readonly Point2D[])[];
  readonly tone: PreviewZoneTone;
  /** Ένα κείμενο ανά ζώνη· μπαίνει στο ΜΕΓΑΛΥΤΕΡΟ κομμάτι. Κενό ⇒ καμία ετικέτα. */
  readonly label?: string;
  /** Κείμενο hover (native SVG `<title>`) — π.χ. ο λόγος απόρριψης. */
  readonly title?: string;
  /** Έμφαση («αυτήν κοιτάω»): παχύτερη γραμμή. Δεν αλλάζει τόνο — άλλη ερώτηση. */
  readonly focused?: boolean;
  readonly transform: ViewTransform;
  readonly viewport: Viewport;
  readonly testId?: string;
}

/** Πόσο παχαίνει η γραμμή της εστιασμένης ζώνης (CSS px). */
const FOCUS_EXTRA_WIDTH = 2;

/**
 * ADR-911 Φ3β — ο ΜΟΝΟΣ ζωγράφος ζώνης προεπισκόπησης. Παιδί ενός `<svg>`: δεν συνδρομείται
 * πουθενά (ADR-040 — το transform το διαβάζει το φύλλο-γονέας και το περνά), άρα μπορεί να
 * ζωγραφιστεί εκατοντάδες φορές χωρίς εκατοντάδες συνδρομές.
 *
 * Όψη αποκλειστικά από το `preview-zone-style.ts`: χρώμα ΚΑΙ μοτίβο γραμμής ανά τόνο.
 */
export function PreviewZoneShape({
  pieces,
  tone,
  label = '',
  title,
  focused = false,
  transform,
  viewport,
  testId,
}: PreviewZoneShapeProps): React.ReactElement | null {
  const drawable = pieces.filter((piece) => piece.length >= 3);
  if (drawable.length === 0) return null;

  const style = PREVIEW_ZONE_STYLE[tone];
  const screenPieces = drawable.map((piece) => worldRingToScreen(piece, transform, viewport));
  const labelAt = label ? pointsCentroid(screenPieces[largestBodyPieceIndex(drawable)] ?? []) : null;

  return (
    <g data-testid={testId} data-tone={tone}>
      {screenPieces.map((points, i) => (
        <path
          key={i}
          d={screenPointsToSvgPath(points, true)}
          fill={style.fillOpacity > 0 ? style.stroke : 'none'}
          fillOpacity={style.fillOpacity > 0 ? style.fillOpacity : undefined}
          stroke={style.stroke}
          strokeWidth={style.strokeWidth + (focused ? FOCUS_EXTRA_WIDTH : 0)}
          strokeDasharray={style.dash ?? undefined}
          strokeLinejoin="round"
        >
          {title ? <title>{title}</title> : null}
        </path>
      ))}
      {labelAt ? (
        <text
          x={labelAt.x}
          y={labelAt.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={PREVIEW_ZONE_LABEL.fontSize}
          fontWeight={PREVIEW_ZONE_LABEL.fontWeight}
          fill={style.stroke}
          stroke={PREVIEW_ZONE_LABEL.casing}
          strokeWidth={PREVIEW_ZONE_LABEL.casingWidth}
          paintOrder="stroke"
        >
          {label}
        </text>
      ) : null}
    </g>
  );
}
