'use client';

/**
 * @fileoverview 🏢 **ΟΙ ΜΟΝΑΔΕΣ ΠΑΝΩ ΣΤΗΝ ΚΑΤΟΨΗ ΤΟΥ ΟΡΟΦΟΥ** — το στρώμα SVG και το δείγμα του υπομνήματος (ADR-907 §11.9).
 * @related ./floor-plate-palette (χρώμα · μοτίβο · περίγραμμα) · lib/listings/floor-plate/floor-plate-view (η γεωμετρία) ·
 *   components/listings/capture-spots/CaptureSpotLayer (η σύμβαση `viewBox`)
 * @module components/listing-detail/media/FloorPlateUnitLayer
 *
 * 🎨 **Μηδέν inline style (N.3)** — σύμβαση `CaptureSpotLayer`: `viewBox` = **φυσικά pixels της εικόνας**, θέσεις σε
 *   γνωρίσματα. Η εικόνα είναι `object-contain` και το SVG έχει το ίδιο `viewBox`, άρα μικραίνουν και κεντράρονται ταυτόσημα.
 * ♿ **Το SVG είναι η ΟΠΤΙΚΗ μορφή και μόνο** (`aria-hidden`): το ίδιο περιεχόμενο —αριθμός, κατάσταση, σύνδεσμος— ζει ως
 *   κείμενο στη λίστα μονάδων κάτω από τη σκηνή. Γι' αυτό οι σύνδεσμοι εδώ είναι `tabIndex={-1}`: ένας χρήστης πληκτρολογίου
 *   δεν περνά δύο φορές από τον ίδιο προορισμό, και τίποτα εστιάσιμο δεν κρύβεται από τον αναγνώστη οθόνης.
 * 🔑 **Το δείγμα του υπομνήματος ζωγραφίζεται με τον ΙΔΙΟ κώδικα** (`FloorPlatePatternDefs` + τις ίδιες κλάσεις): υπόμνημα
 *   φτιαγμένο με ξεχωριστά τετραγωνάκια CSS θα μπορούσε να δείχνει άλλο μοτίβο από το σχέδιο χωρίς να κοκκινίσει τίποτα.
 */

import { useId } from 'react';

import { SPACE_LABEL_CLASS } from '@/components/spatial-tour/viewer/tour-plan-overlay-palette';
import { FLOOR_PLATE_SELF_STATE, FLOOR_PLATE_STATES, type FloorPlateState } from '@/lib/listings/floor-plate/floor-plate-state';
import { inPaintOrder, type FloorPlateImageSize, type FloorPlateShape } from '@/lib/listings/floor-plate/floor-plate-view';
import { listingDetailHref } from '@/lib/listings/listing-routes';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/workspace/navigation';

import {
  FLOOR_PLATE_EDGE_CLASS, FLOOR_PLATE_HALO_CLASS, FLOOR_PLATE_MARK_CLASS, FLOOR_PLATE_PAPER_CLASS, FLOOR_PLATE_PATTERN,
  FLOOR_PLATE_STROKE_PX, FLOOR_PLATE_TINT_CLASS, type FloorPlatePatternKind,
} from './floor-plate-palette';

/** Πλευρά του πλακιδίου μοτίβου, ως κλάσμα της μεγάλης πλευράς της εικόνας — το μοτίβο μεγαλώνει μαζί με το σχέδιο. */
const TILE_FRACTION = 0.014;
/** Ο αριθμός της μονάδας: όσο χωρά στο σχήμα, μέσα σε όρια που διαβάζονται (κλάσματα της μεγάλης πλευράς). */
const LABEL_MIN_FRACTION = 0.016;
const LABEL_MAX_FRACTION = 0.034;
const LABEL_HALO_RATIO = 0.22;

const SWATCH = { width: 28, height: 18, inset: 1, tile: 6 } as const;

/** Το `useId` της React περιέχει χαρακτήρες που δεν ανήκουν σε αναφορά `url(#…)`. */
function useFragmentId(): string {
  return `fp${useId().replace(/[^a-zA-Z0-9_-]/gu, '')}`;
}

function patternId(prefix: string, state: FloorPlateState): string {
  return `${prefix}-${state}`;
}

/** Τα σημάδια ενός πλακιδίου. Οι διαγραμμίσεις ξεκινούν **έξω** από το πλακίδιο, ώστε να ενώνονται χωρίς ραφή. */
function PatternMarks({ kind, tile }: { readonly kind: FloorPlatePatternKind; readonly tile: number }) {
  if (kind === 'dots') return <circle cx={tile / 2} cy={tile / 2} r={tile * 0.13} />;
  const q = tile / 4;
  const rising = `M${-q},${q} l${2 * q},${-2 * q} M0,${tile} l${tile},${-tile} M${tile - q},${tile + q} l${2 * q},${-2 * q}`;
  const falling = `M${-q},${tile - q} l${2 * q},${2 * q} M0,0 l${tile},${tile} M${tile - q},${-q} l${2 * q},${2 * q}`;
  return <path d={kind === 'cross' ? `${rising} ${falling}` : rising} strokeWidth={tile * 0.1} />;
}

/** Τα μοτίβα όλων των καταστάσεων που έχουν μοτίβο — μία δήλωση ανά `<svg>` (σχέδιο ή δείγμα), με δικό της πρόθεμα. */
export function FloorPlatePatternDefs({ prefix, tile }: { readonly prefix: string; readonly tile: number }) {
  return (
    <defs>
      {FLOOR_PLATE_STATES.map((state) => {
        const kind = FLOOR_PLATE_PATTERN[state];
        if (kind === null) return null;
        return (
          <pattern key={state} id={patternId(prefix, state)} width={tile} height={tile} patternUnits="userSpaceOnUse"
            data-floor-plate-pattern={kind}>
            <g className={FLOOR_PLATE_MARK_CLASS[state]}><PatternMarks kind={kind} tile={tile} /></g>
          </pattern>
        );
      })}
    </defs>
  );
}

/** Το δείγμα μιας κατάστασης στο υπόμνημα — ίδια απόχρωση, ίδιο μοτίβο, ίδιο περίγραμμα με το σχέδιο. */
export function FloorPlateSwatch({ state }: { readonly state: FloorPlateState }) {
  const prefix = useFragmentId();
  const self = state === FLOOR_PLATE_SELF_STATE;
  const box = {
    x: SWATCH.inset, y: SWATCH.inset, width: SWATCH.width - 2 * SWATCH.inset, height: SWATCH.height - 2 * SWATCH.inset,
  };
  return (
    <svg viewBox={`0 0 ${SWATCH.width} ${SWATCH.height}`} aria-hidden="true" data-floor-plate-swatch={state}
      className="h-[1.125rem] w-7 shrink-0 rounded-sm">
      <FloorPlatePatternDefs prefix={prefix} tile={SWATCH.tile} />
      <rect width={SWATCH.width} height={SWATCH.height} className={FLOOR_PLATE_PAPER_CLASS} />
      <rect {...box} className={cn(FLOOR_PLATE_TINT_CLASS[state], FLOOR_PLATE_EDGE_CLASS[state])}
        strokeWidth={self ? 2.5 : FLOOR_PLATE_STROKE_PX.neighbour} />
      {FLOOR_PLATE_PATTERN[state] !== null && <rect {...box} fill={`url(#${patternId(prefix, state)})`} />}
    </svg>
  );
}

interface UnitProps {
  readonly shape: FloorPlateShape;
  readonly prefix: string;
  /** Η μεγάλη πλευρά της εικόνας — η βάση κάθε μεγέθους σε μονάδες εικόνας. */
  readonly base: number;
  readonly emphasised: boolean;
  readonly onActive: (unitNumber: number | null) => void;
}

function UnitShape({ shape, prefix, base, emphasised, onActive }: UnitProps) {
  const self = shape.state === FLOOR_PLATE_SELF_STATE;
  const edge = (self ? FLOOR_PLATE_STROKE_PX.self : FLOOR_PLATE_STROKE_PX.neighbour)
    + (emphasised ? FLOOR_PLATE_STROKE_PX.emphasis : 0);
  const fontSize = Math.min(Math.max(shape.clearance * 1.1, base * LABEL_MIN_FRACTION), base * LABEL_MAX_FRACTION);
  const outline = { points: shape.points, strokeLinejoin: 'round', vectorEffect: 'non-scaling-stroke' } as const;

  return (
    <g data-floor-plate-unit={shape.number} data-state={shape.state} data-emphasised={emphasised ? '' : undefined}
      onPointerEnter={() => onActive(shape.number)} onPointerLeave={() => onActive(null)}>
      {self && <polygon {...outline} className={FLOOR_PLATE_HALO_CLASS} strokeWidth={FLOOR_PLATE_STROKE_PX.halo} />}
      <polygon {...outline} className={cn(FLOOR_PLATE_TINT_CLASS[shape.state], FLOOR_PLATE_EDGE_CLASS[shape.state])}
        strokeWidth={edge} />
      {FLOOR_PLATE_PATTERN[shape.state] !== null && (
        <polygon points={shape.points} fill={`url(#${patternId(prefix, shape.state)})`} className="pointer-events-none" />
      )}
      <text x={shape.label.x} y={shape.label.y} fontSize={fontSize} strokeWidth={fontSize * LABEL_HALO_RATIO}
        textAnchor="middle" dominantBaseline="central" className={cn('pointer-events-none select-none', SPACE_LABEL_CLASS)}>
        {shape.number}
      </text>
    </g>
  );
}

/** Γείτονας με δική του δημόσια αγγελία ⇒ το σχήμα του είναι σύνδεσμος προς αυτήν (ίδιος προορισμός με τη γραμμή της λίστας). */
function Unit(props: UnitProps) {
  const { listingId } = props.shape;
  if (listingId === null) return <UnitShape {...props} />;
  return (
    <Link href={listingDetailHref(listingId)} tabIndex={-1} className="cursor-pointer" data-floor-plate-link="">
      <UnitShape {...props} />
    </Link>
  );
}

export interface FloorPlateUnitLayerProps {
  readonly size: FloorPlateImageSize;
  readonly shapes: readonly FloorPlateShape[];
  /** Η μονάδα που τονίζεται — από το ποντίκι πάνω στο σχέδιο **ή** από τη λίστα από κάτω. */
  readonly active: number | null;
  readonly onActive: (unitNumber: number | null) => void;
}

export function FloorPlateUnitLayer({ size, shapes, active, onActive }: FloorPlateUnitLayerProps) {
  const prefix = useFragmentId();
  const base = Math.max(size.width, size.height, 1);
  return (
    <svg viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true" data-floor-plate-layer=""
      className="absolute inset-0 h-full w-full">
      <FloorPlatePatternDefs prefix={prefix} tile={base * TILE_FRACTION} />
      {inPaintOrder(shapes).map((shape) => (
        <Unit key={shape.number} shape={shape} prefix={prefix} base={base} emphasised={shape.number === active}
          onActive={onActive} />
      ))}
    </svg>
  );
}
