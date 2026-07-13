'use client';

/**
 * ADR-652 M4 — Το preview μιας κάρτας block: inline SVG, theme-correct, μηδέν raster.
 *
 * **ΕΝΑΣ renderer για τις δύο πηγές**: το `thumbnail` της εγγραφής έρχεται είτε ζωντανά από
 * τη γεωμετρία ενός session block είτε έτοιμο μέσα στο cloud doc — μέχρι εδώ είναι το ίδιο
 * `d` (βλ. `block-palette-entries`). Δεν υπάρχει «cloud preview» και «session preview».
 *
 * **Fallback**: block χωρίς γραμμική γεωμετρία (π.χ. μόνο κείμενο) ή doc γραμμένο ΠΡΙΝ το M4
 * → το ορθογώνιο αποτύπωμα των `boundsMm` (η συμπεριφορά των M2/M3, μηδέν κενή κάρτα).
 *
 * `stroke="currentColor"` (N.3) ⇒ σωστό σε light/dark + hover, χωρίς ψημένο χρώμα·
 * `vectorEffect="non-scaling-stroke"` ⇒ σταθερό πάχος γραμμής ανεξάρτητα από την κλίμακα του
 * viewBox (αλλιώς ένα μεγάλο block θα είχε γραμμή-τρίχα).
 *
 * @see ../../../bim/block-library/block-thumbnail.ts — ο builder (και το γιατί vector, όχι PNG)
 */

import React from 'react';
import { BLOCK_THUMBNAIL_VIEWBOX } from '../../../bim/block-library/block-thumbnail';
import type {
  BlockBoundsMm,
  BlockThumbnailVector,
} from '../../../bim/block-library/block-library-types';

export interface BlockThumbnailPreviewProps {
  readonly thumbnail: BlockThumbnailVector | null;
  readonly bounds: BlockBoundsMm | null;
}

/** Αποτύπωμα από τα bounds — ό,τι έδειχνε το palette πριν το M4 (fallback). */
const FootprintOutline: React.FC<{ bounds: BlockBoundsMm }> = ({ bounds }) => {
  const w = Math.max(bounds.maxX - bounds.minX, 1e-6);
  const h = Math.max(bounds.maxY - bounds.minY, 1e-6);
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-full w-full text-muted-foreground"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <rect
        x={0}
        y={0}
        width={w}
        height={h}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

export const BlockThumbnailPreview: React.FC<BlockThumbnailPreviewProps> = ({
  thumbnail,
  bounds,
}) => {
  if (thumbnail && thumbnail.d) {
    return (
      <svg
        viewBox={`0 0 ${BLOCK_THUMBNAIL_VIEWBOX} ${BLOCK_THUMBNAIL_VIEWBOX}`}
        className="h-full w-full text-foreground"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <path
          d={thumbnail.d}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  }

  if (bounds) return <FootprintOutline bounds={bounds} />;
  return <span className="text-xs text-muted-foreground">—</span>;
};
