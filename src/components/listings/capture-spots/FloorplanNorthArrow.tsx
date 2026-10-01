'use client';

/**
 * @fileoverview 🧭 **ΤΟ ΒΕΛΟΣ ΒΟΡΡΑ ΤΗΣ ΚΑΤΟΨΗΣ** — ένα σύμβολο για θεατή και επεξεργαστή (ADR-897 Φ5.2).
 * @related lib/listings/floorplan-north · lib/geometry/north-arrow (το ΙΔΙΟ σχήμα με το βέλος του DXF, ADR-656)
 * @module components/listings/capture-spots/FloorplanNorthArrow
 *
 * 🏆 **Revit / ArchiCAD**: η κάτοψη μένει όπως σχεδιάστηκε, στρίβει **μόνο** το βέλος· στη γωνία του φύλλου, εκεί όπου
 *   δεν κρύβει το σχέδιο. Υπόμνημα, όχι στοιχείο του σχεδίου — αλλά **ποτέ μεγαλύτερο από ό,τι σηκώνει το σχέδιο** (`ARROW_BOX_CLASS`).
 * 🖱️ Με `onRotate` (επεξεργαστής) το βέλος **σύρεται** σαν ρόδα πυξίδας (πρότυπο CubiCasa QuickEdit). Η εναλλακτική
 *   χωρίς σύρσιμο (WCAG 2.5.7) είναι ο ρυθμιστής του πάνελ βορρά.
 * 🎨 Μηδέν inline style (N.3): θέση με κλάσεις του καλούντα, στροφή με χαρακτηριστικό SVG `transform`.
 */

import { type PointerEvent, useRef } from 'react';

import { radToDeg } from '@/lib/geometry/angle';
import { northArrowSvgPath } from '@/lib/geometry/north-arrow';
import { headingTowards } from '@/lib/geometry/view-cone';
import { cn } from '@/lib/utils';
import { PLAN_NORTH_CLASS } from '@/components/spatial-tour/viewer/tour-plan-overlay-palette';

const VIEWBOX = 100;
const CENTER = VIEWBOX / 2;
const ARROW_SIZE = 56;
const GLYPH_SIZE = 22;
/**
 * 📐 Μέγεθος = **12% του σχεδίου**, φραγμένο σε 24–56 px (απόλυτο στοιχείο ⇒ το ποσοστό μετριέται στο `<figure>`).
 * Μετρημένο 01/10: σταθερά 56 px σε κάρτα κάτοψης 213 px = **26%** του πλάτους, πάνω σε ολόκληρο δωμάτιο.
 */
const ARROW_BOX_CLASS = 'aspect-square w-[12%] min-w-6 max-w-14';
const ARROW_PATH = northArrowSvgPath(CENTER, CENTER + 6, ARROW_SIZE);

export interface FloorplanNorthArrowProps {
  /** Ο βορράς στον χώρο της εικόνας (0 = πάνω, δεξιόστροφα). */
  readonly northRad: number;
  /** Το γράμμα του βορρά — **ήδη μεταφρασμένο** («Β» / «N»). */
  readonly glyph: string;
  /** Το όνομα για τεχνολογίες υποβοήθησης — **ήδη μεταφρασμένο**, με τη γωνία. */
  readonly label: string;
  /** Μόνο ο επεξεργαστής: νέα γωνία από σύρσιμο. */
  readonly onRotate?: (northRad: number) => void;
  readonly className?: string;
}

/** Η γωνία από το κέντρο του βέλους προς τον δείκτη — 0 = πάνω, δεξιόστροφα, όπως ο βορράς. */
function pointerAngle(svg: SVGSVGElement, event: PointerEvent<SVGSVGElement>): number {
  const box = svg.getBoundingClientRect();
  const center = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  return headingTowards(center, { x: event.clientX, y: event.clientY });
}

export function FloorplanNorthArrow({ northRad, glyph, label, onRotate, className }: FloorplanNorthArrowProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const rotate = (event: PointerEvent<SVGSVGElement>) => {
    if (dragging.current && svgRef.current !== null) onRotate?.(pointerAngle(svgRef.current, event));
  };
  const handlers = onRotate === undefined ? {} : {
    onPointerDown: (event: PointerEvent<SVGSVGElement>) => {
      // ⚠️ Το σύρσιμο του βέλους δεν είναι «τοποθέτησε εδώ» για την επιφάνεια της κάτοψης από κάτω.
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragging.current = true;
      rotate(event);
    },
    onPointerMove: rotate,
    onPointerUp: () => { dragging.current = false; },
    onPointerCancel: () => { dragging.current = false; },
  };

  return (
    <svg ref={svgRef} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} role="img" aria-label={label}
      className={cn(ARROW_BOX_CLASS, onRotate === undefined ? 'pointer-events-none' : 'cursor-grab touch-none', className)}
      {...handlers}>
      <title>{label}</title>
      <g transform={`rotate(${radToDeg(northRad)} ${CENTER} ${CENTER})`} className={PLAN_NORTH_CLASS} strokeWidth={6}
        strokeLinejoin="round">
        <path d={ARROW_PATH} />
        <text x={CENTER} y={GLYPH_SIZE * 0.55} textAnchor="middle" dominantBaseline="middle" fontSize={GLYPH_SIZE}
          fontWeight="bold">
          {glyph}
        </text>
      </g>
    </svg>
  );
}
