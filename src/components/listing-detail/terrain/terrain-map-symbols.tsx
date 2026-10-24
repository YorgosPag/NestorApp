'use client';

/**
 * @fileoverview **ΤΑ ΣΥΜΒΟΛΑ ΤΟΥ ΧΑΡΤΗ ΕΔΑΦΟΥΣ** — διαγράμμιση, σημάνσεις, γραμμές· και τα δείγματά τους στο υπόμνημα (ADR-920 Β4.8).
 * @related ./terrain-map-palette (χρώματα · πάχη) · ./TerrainMapSvg (ο χάρτης) · ./TerrainContourMap (το υπόμνημα)
 * @module components/listing-detail/terrain/terrain-map-symbols
 *
 * 🔑 **Το δείγμα του υπομνήματος ζωγραφίζεται με τον ΙΔΙΟ κώδικα με τον χάρτη** (μάθημα `FloorPlateSwatch`, ADR-907): υπόμνημα
 *   φτιαγμένο ξεχωριστά θα μπορούσε να δείχνει άλλο σταυρό, άλλη διαγράμμιση ή άλλη διακεκομμένη από το σχέδιο χωρίς να
 *   κοκκινίσει τίποτα. Εδώ κάθε σύμβολο είναι **μία** συνάρτηση, που την καλούν και τα δύο.
 * ♿ Σχήμα, όχι απόχρωση (CHECK 3.41): σταυρός = αντίφαση · δαχτυλίδι = σύμπτωση · διαγράμμιση = αραιή περιοχή.
 */

import type { ReactNode } from 'react';

import { hatchTilePathData } from '@/lib/geometry/hatch-tile';
import type { TerrainMapMark } from '@/lib/terrain/publication/terrain-map-model';

import {
  TERRAIN_BOUNDARY_CLASS, TERRAIN_CONTOUR_CASING_CLASS, TERRAIN_CONTOUR_MAJOR_CLASS, TERRAIN_CONTOUR_MINOR_CLASS,
  TERRAIN_EXTENT_CLASS, TERRAIN_MARK_CLASS, TERRAIN_PAPER_CLASS, TERRAIN_SPARSE_HATCH_CLASS, TERRAIN_STROKE_PX,
} from './terrain-map-palette';

/** Λεπτότητα γραμμής ανεξάρτητη από την κλίμακα του σχεδίου. */
export const NON_SCALING = { vectorEffect: 'non-scaling-stroke' } as const;

/** Οι γραμμές του χάρτη που έχουν δείγμα στο υπόμνημα. */
export type TerrainLineKind = 'contourMinor' | 'contourMajor' | 'extent' | 'boundary';

const LINE_STYLE: Readonly<Record<TerrainLineKind, { readonly ink: string; readonly width: number; readonly casing?: number }>> = {
  contourMinor: { ink: TERRAIN_CONTOUR_MINOR_CLASS, width: TERRAIN_STROKE_PX.contourMinor, casing: TERRAIN_STROKE_PX.casingMinor },
  contourMajor: { ink: TERRAIN_CONTOUR_MAJOR_CLASS, width: TERRAIN_STROKE_PX.contourMajor, casing: TERRAIN_STROKE_PX.casingMajor },
  extent: { ink: TERRAIN_EXTENT_CLASS, width: TERRAIN_STROKE_PX.extent },
  boundary: { ink: TERRAIN_BOUNDARY_CLASS, width: TERRAIN_STROKE_PX.boundary },
};

/**
 * Μία γραμμή του χάρτη: (περίβλημα) + μελάνι. Το περίβλημα είναι **ξεχωριστό** path κάτω από το μελάνι — σε ένα path
 * με `paint-order` θα κάλυπτε τις διασταυρώσεις της ίδιας γραμμής.
 */
export function TerrainLine({ kind, d }: { readonly kind: TerrainLineKind; readonly d: string }) {
  const style = LINE_STYLE[kind];
  return (
    <g data-terrain-line={kind} strokeLinejoin="round" strokeLinecap="round">
      {style.casing !== undefined && (
        <path d={d} {...NON_SCALING} className={TERRAIN_CONTOUR_CASING_CLASS} strokeWidth={style.casing} />
      )}
      <path d={d} {...NON_SCALING} className={style.ink} strokeWidth={style.width} />
    </g>
  );
}

/** Η διαγράμμιση της αραιής περιοχής: γραμμές 45° σε πλακίδιο `tile` (μονάδες του σχεδίου), χωρίς ραφή στις ενώσεις. */
export function SparseHatchPattern({ id, tile }: { readonly id: string; readonly tile: number }) {
  return (
    <pattern id={id} width={tile} height={tile} patternUnits="userSpaceOnUse" data-terrain-pattern="sparse">
      <path d={hatchTilePathData(tile, 'rising')} className={TERRAIN_SPARSE_HATCH_CLASS} strokeWidth={tile * 0.12} />
    </pattern>
  );
}

/** Σταυρός (αντίφαση) ή δαχτυλίδι (σύμπτωση), ακτίνας `r`, πάνω σε λευκό περίβλημα. */
export function MarkGlyph({ kind, x, y, r }: { readonly kind: TerrainMapMark['kind']; readonly x: number; readonly y: number; readonly r: number }) {
  const shape = kind === 'conflicting'
    ? <path d={`M${x - r},${y - r} L${x + r},${y + r} M${x - r},${y + r} L${x + r},${y - r}`} />
    : <circle cx={x} cy={y} r={r} />;
  return (
    <g data-terrain-mark={kind} strokeLinecap="round">
      <g className={TERRAIN_MARK_CLASS.casing} strokeWidth={TERRAIN_STROKE_PX.markCasing} {...NON_SCALING}>{shape}</g>
      <g className={TERRAIN_MARK_CLASS.ink} strokeWidth={TERRAIN_STROKE_PX.mark} {...NON_SCALING}>{shape}</g>
    </g>
  );
}

const SWATCH = { width: 28, height: 18 } as const;
const MID = SWATCH.height / 2;

/** Το πλαίσιο κάθε δείγματος: το ίδιο λευκό χαρτί με τον χάρτη, ώστε το δείγμα να έχει ΤΟ ΙΔΙΟ φόντο με το σχέδιο. */
function SwatchFrame({ kind, children }: { readonly kind: string; readonly children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${SWATCH.width} ${SWATCH.height}`} aria-hidden="true" data-terrain-swatch={kind}
      className="h-[1.125rem] w-7 shrink-0 rounded-sm border border-border">
      <rect width={SWATCH.width} height={SWATCH.height} className={TERRAIN_PAPER_CLASS} />
      {children}
    </svg>
  );
}

/** Δείγμα γραμμής: ελαφρώς κυματιστή για τις ισοϋψείς (διαβάζεται «ισοϋψής», όχι «διαχωριστικό»), ευθεία για τα όρια. */
export function TerrainLineSwatch({ kind }: { readonly kind: TerrainLineKind }) {
  const contour = kind === 'contourMinor' || kind === 'contourMajor';
  const d = contour ? `M2,${MID + 3} C9,${MID - 5} 19,${MID + 5} 26,${MID - 3}` : `M2,${MID} L26,${MID}`;
  return <SwatchFrame kind={kind}><TerrainLine kind={kind} d={d} /></SwatchFrame>;
}

/** Δείγμα της αραιής περιοχής — ίδιο πλακίδιο, ίδια κλάση. */
export function SparseSwatch({ patternId }: { readonly patternId: string }) {
  return (
    <SwatchFrame kind="sparse">
      <defs><SparseHatchPattern id={patternId} tile={6} /></defs>
      <rect x={1} y={1} width={SWATCH.width - 2} height={SWATCH.height - 2} fill={`url(#${patternId})`} />
    </SwatchFrame>
  );
}

/** Δείγμα σήμανσης — η ΙΔΙΑ `MarkGlyph`. */
export function MarkSwatch({ kind }: { readonly kind: TerrainMapMark['kind'] }) {
  return <SwatchFrame kind={kind}><MarkGlyph kind={kind} x={SWATCH.width / 2} y={MID} r={4.5} /></SwatchFrame>;
}

/** Δείγμα κλάσης κλίσης για τον πίνακα — ίδιο γέμισμα με την περιοχή του χάρτη. */
export function SlopeSwatch({ fillClass, classIndex }: { readonly fillClass: string; readonly classIndex: number }) {
  return (
    <SwatchFrame kind={`slope-${classIndex}`}>
      <rect x={1} y={1} width={SWATCH.width - 2} height={SWATCH.height - 2} className={fillClass} />
    </SwatchFrame>
  );
}
