/**
 * ADR-652 M4 — `Entity` → πολυγραμμές (backend-neutral SSoT).
 *
 * ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ: η εφαρμογή είχε ΟΛΑ τα κομμάτια της tessellation (arc / bulge /
 * ellipse / spline / rectangle) ως SSoT modules, αλλά ΚΑΝΕΝΑΝ ουδέτερο συνθέτη «δώσε μου
 * τη γεωμετρία αυτής της οντότητας ως σημεία». Κάθε backend είχε τον δικό του πλήρη
 * διαδρομητή: ο Canvas2D renderer ζωγραφίζει με `ctx.*`, ο DXF writer γράφει group codes,
 * ο vector-PDF emitter (`print/vector/scene-vector-emitter.ts`) καλεί jsPDF primitives.
 * Κανένας από τους τρεις ΔΕΝ επιστρέφει σημεία — δεν μπορούν να επαναχρησιμοποιηθούν από
 * έναν καταναλωτή που θέλει απλώς **σχήμα** (π.χ. ένα preview).
 *
 * Αυτό το module είναι ΑΚΡΙΒΩΣ αυτός ο συνθέτης — και **μηδέν νέα μαθηματικά καμπύλης**:
 * κάθε τύπος delegate-άρει στον υπάρχοντα SSoT του (βλ. imports). Ό,τι δεν έχει γραμμική
 * αναπαράσταση (κείμενο, διαστάσεις, hatch fills, BIM composites) επιστρέφει `[]` — ο
 * καλών αποφασίζει τι κάνει με αυτό.
 *
 * ΓΙΑΤΙ ΔΕΝ ΞΑΝΑΓΡΑΦΤΗΚΑΝ ΟΙ ΤΡΕΙΣ BACKENDS ΠΑΝΩ ΤΟΥ (ρητή απόφαση, N.18): ο καθένας
 * χρειάζεται ΠΕΡΙΣΣΟΤΕΡΑ από σχήμα (χρώμα/πάχος ανά entity, γεμίσματα, κείμενο, native arcs
 * για ακρίβεια εκτύπωσης). Ένας κοινός flattener θα ισοπέδωνε ό,τι τους διαφοροποιεί. Αυτός
 * εδώ σερβίρει τους καταναλωτές που θέλουν ΜΟΝΟ σχήμα — σήμερα το thumbnail της βιβλιοθήκης.
 *
 * Pure module (μηδέν DOM, μηδέν React) — τρέχει σε browser, σε Node (seed) και σε tests.
 *
 * @see ./geometry-bulge-utils.ts — bulged segment → τόξο (DXF 42)
 * @see ./geometry-arc-utils.ts — `tessellateArcDegrees` (arc SSoT)
 * @see ./geometry-ellipse-utils.ts — `tessellateEllipseArc` (ellipse SSoT)
 * @see ./geometry-spline-utils.ts — `tessellateSplinePoints` (spline SSoT)
 * @see ./geometry-utils.ts — `rectangleEntityVertices` (rectangle SSoT)
 */

import type { Point2D } from '../../types/Types';
import type { Entity } from '../../../types/entities';
import { expandBlockInstance } from '../../../systems/block/block-expander';
import { bulgeToPolyline, isStraightSegment } from './geometry-bulge-utils';
import { tessellateArcDegrees } from './geometry-arc-utils';
import { tessellateEllipseArc } from './geometry-ellipse-utils';
import { tessellateSplinePoints } from './geometry-spline-utils';
import { rectangleEntityVertices } from './geometry-utils';

/** Μια ανοιχτή ή κλειστή πολυγραμμή σε ΤΟ ΙΔΙΟ χώρο συντεταγμένων με την οντότητα. */
export interface EntityPolyline {
  readonly points: readonly Point2D[];
  readonly closed: boolean;
}

/** Πυκνότητα tessellation — πόσες μοίρες τόξου ανά τμήμα (mirror του DXF/PDF writer). */
export interface EntityPolylineOptions {
  /** Μοίρες ανά τμήμα τόξου/κύκλου/έλλειψης. Μικρότερο = πιο λείο (και πιο βαρύ). */
  readonly arcSegmentDeg?: number;
  /** Τμήματα ανά spline. */
  readonly splineSegments?: number;
}

const DEFAULT_ARC_SEGMENT_DEG = 12;
const DEFAULT_SPLINE_SEGMENTS = 32;
const FULL_TURN_DEG = 360;

/** Πλήθος τμημάτων για ένα τόξο δεδομένου ανοίγματος (τουλάχιστον 2 — ποτέ εκφυλισμένο). */
function segmentsForSweep(sweepDeg: number, arcSegmentDeg: number): number {
  return Math.max(2, Math.ceil(Math.abs(sweepDeg) / arcSegmentDeg));
}

/** Κλειστό ⇒ επανάληψη του πρώτου σημείου στο τέλος (για μονοπάτια που χρειάζονται ρητό κλείσιμο). */
function open(points: readonly Point2D[]): EntityPolyline {
  return { points, closed: false };
}

/**
 * Πολυγραμμή με προαιρετικά bulges (DXF 42) → σημεία. Τα ευθύγραμμα τμήματα περνούν ως έχουν,
 * τα τοξωτά περνούν από τον SSoT `bulgeToPolyline` — καμία δεύτερη bulge math.
 */
function polylineVerticesToPoints(
  vertices: readonly Point2D[],
  bulges: readonly number[] | undefined,
  closed: boolean,
  arcSegmentDeg: number,
): readonly Point2D[] {
  if (vertices.length < 2) return vertices;
  if (!bulges || bulges.length === 0) return vertices;

  const out: Point2D[] = [];
  const last = closed ? vertices.length : vertices.length - 1;

  for (let i = 0; i < last; i++) {
    const p0 = vertices[i];
    const p1 = vertices[(i + 1) % vertices.length];
    const bulge = bulges[i];

    if (isStraightSegment(bulge)) {
      out.push(p0);
      continue;
    }
    // Ο SSoT επιστρέφει ΚΑΙ τα δύο άκρα· κρατάμε το τελευταίο για το επόμενο τμήμα.
    const arc = bulgeToPolyline(p0, p1, bulge, arcSegmentDeg);
    out.push(...arc.slice(0, -1));
  }

  if (!closed) out.push(vertices[vertices.length - 1]);
  return out;
}

/** Κύκλος → κλειστή πολυγραμμή (πλήρες τόξο μέσω του arc SSoT — όχι δεύτερος βρόχος ημιτόνων). */
function circleToPolyline(
  center: Point2D,
  radius: number,
  arcSegmentDeg: number,
): readonly EntityPolyline[] {
  if (!(radius > 0)) return [];
  const n = segmentsForSweep(FULL_TURN_DEG, arcSegmentDeg);
  const pts = tessellateArcDegrees({ center, radius, startAngle: 0, endAngle: FULL_TURN_DEG }, n);
  // Ο tessellator επιστρέφει και τα δύο άκρα (0° == 360°) → πετάμε το διπλό, το `closed` το κλείνει.
  return [{ points: pts.slice(0, -1), closed: true }];
}

/**
 * Η γεωμετρία μιας οντότητας ως πολυγραμμές, στο ΙΔΙΟ σύστημα συντεταγμένων με την είσοδο.
 * Οντότητες χωρίς γραμμική αναπαράσταση (text/mtext/dimension/hatch/BIM) → `[]`.
 */
export function entityToPolylines(
  entity: Entity,
  options: EntityPolylineOptions = {},
): readonly EntityPolyline[] {
  const arcDeg = options.arcSegmentDeg ?? DEFAULT_ARC_SEGMENT_DEG;
  const splineSegments = options.splineSegments ?? DEFAULT_SPLINE_SEGMENTS;

  switch (entity.type) {
    case 'line':
      return [open([entity.start, entity.end])];

    case 'polyline':
    case 'lwpolyline': {
      const closed = entity.closed === true;
      const points = polylineVerticesToPoints(entity.vertices, entity.bulges, closed, arcDeg);
      return points.length >= 2 ? [{ points, closed }] : [];
    }

    case 'rectangle':
    case 'rect': {
      const verts = rectangleEntityVertices(entity);
      const finite = verts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
      return finite && verts.length >= 3 ? [{ points: verts, closed: true }] : [];
    }

    case 'circle':
      return circleToPolyline(entity.center, entity.radius, arcDeg);

    case 'arc': {
      if (!(entity.radius > 0)) return [];
      const sweep = Math.abs(entity.endAngle - entity.startAngle) || FULL_TURN_DEG;
      const pts = tessellateArcDegrees(entity, segmentsForSweep(sweep, arcDeg));
      return pts.length >= 2 ? [open(pts)] : [];
    }

    case 'ellipse': {
      const full = entity.startParam === undefined && entity.endParam === undefined;
      const pts = tessellateEllipseArc(entity, segmentsForSweep(FULL_TURN_DEG, arcDeg));
      if (pts.length < 2) return [];
      return full ? [{ points: pts.slice(0, -1), closed: true }] : [open(pts)];
    }

    case 'spline': {
      const pts = tessellateSplinePoints(
        entity.controlPoints,
        entity.closed === true,
        splineSegments,
      );
      return pts.length >= 2 ? [{ points: pts, closed: entity.closed === true }] : [];
    }

    // Φωλιασμένο block: τα members του μπαίνουν στον ΙΔΙΟ χώρο μέσω του placement SSoT
    // (scale→rotate→translate) — καμία χειρόγραφη επανάληψη του transform.
    case 'block':
      return expandBlockInstance(entity).flatMap((member) => entityToPolylines(member, options));

    default:
      return [];
  }
}

/** Οι πολυγραμμές ΟΛΩΝ των οντοτήτων μιας λίστας (ίδιος χώρος συντεταγμένων). */
export function entitiesToPolylines(
  entities: readonly Entity[],
  options: EntityPolylineOptions = {},
): readonly EntityPolyline[] {
  return entities.flatMap((entity) => entityToPolylines(entity, options));
}
