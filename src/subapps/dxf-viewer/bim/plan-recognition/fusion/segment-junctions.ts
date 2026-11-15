/**
 * ADR-929 §6.21.8 (Ε1) — οι **κόμβοι** των συνορθωμένων τμημάτων: η συνόρθωση κινεί **ευθείες**, όχι τμήματα.
 *
 * 🔑 **Η τοπολογία από την παρατήρηση, η θέση από τη συνόρθωση.** Ποιο άκρο ακουμπά ποιο τμήμα κρίνεται στην **αρχική**
 * γεωμετρία (αυτό είδε το σχέδιο)· πού βρίσκεται ο κόμβος κρίνεται **μετά** τη συνόρθωση, ως τομή των δύο μετακινημένων
 * ευθειών — όπως ο κόμβος ενός δικτύου τοπογραφίας είναι παράγωγο των συνορθωμένων στοιχείων του, και όπως το wall join
 * του Revit/ArchiCAD κόβει τους δύο τοίχους στην τομή των γραμμών τους.
 * 🔑 **Τομή με το ΤΜΗΜΑ του γείτονα, όχι με την ευθεία του δικτύου.** Τα δύο άκρα μιας γωνίας γίνονται τότε η τομή των
 * **ίδιων** δύο ευθειών ⇒ το **ίδιο** σημείο: η γωνία κλείνει ακριβώς, όχι «σχεδόν» (το υπόλοιπο του τμήματος ως προς την
 * ευθεία του δικτύου θα άφηνε κενό κλάσματος pixel).
 * 🔑 **Κάθε κόμβος κλείνει** (απόφαση Giorgio 2026-11-15, επιλογή α): και όταν δ = 0. Ένας κόμβος είναι ένα σημείο.
 * ⚠️ Μόνο παρειές (τα τμήματα του πλαισίου): μια γραμμή διάστασης ή επέκτασης **δεν** γίνεται ποτέ γείτονας τοίχου.
 * ⚠️ Σχεδόν παράλληλα (κάτω από `junctionMinAngleDeg`) δεν δένονται: η τομή τους είναι κακώς ορισμένη (το άκρο θα έφευγε
 * κατά δ / sin θ).
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/fusion/segment-junctions
 */

import { applyHomography, type Homography, type PlanePoint } from '@/lib/geometry/homography';
import { intersectLines } from '@/lib/geometry/planar-polygon';
import type { SegmentEnd } from '@/lib/geometry/linked-segment-chains';
import type { RasterSegment } from '../plan-recognition-types';
import { familyNormal, type FusionFrame } from './fusion-frame';

export type { SegmentEnd };

/** Το άκρο `end` του τμήματος `segmentId` ακουμπά (στην αρχική γεωμετρία) το τμήμα `neighbourId`. */
export interface SegmentJunction {
  readonly segmentId: string;
  readonly end: SegmentEnd;
  readonly neighbourId: string;
}

export interface JunctionAlignment {
  readonly originalToAligned: Homography;
  readonly alignedToOriginal: Homography;
}

/** Μια παρειά στο ευθυγραμμισμένο πλαίσιο: τα παρατηρημένα άκρα, η διεύθυνση και η μετατόπιση `n·δ` της συνόρθωσης. */
interface AlignedFace {
  readonly id: string;
  readonly familyId: number;
  readonly start: PlanePoint;
  readonly end: PlanePoint;
  /** Μοναδιαία διεύθυνση από το `start` στο `end`. */
  readonly u: PlanePoint;
  readonly lengthPx: number;
  readonly shift: PlanePoint;
}

function alignedFace(s: RasterSegment, frame: FusionFrame, offsets: ReadonlyMap<string, number>, toAligned: Homography): AlignedFace | null {
  const line = frame.lineById.get(frame.lineOfSegment.get(s.id) ?? '');
  if (line === undefined) return null;
  const start = applyHomography(toAligned, s.start.x, s.start.y);
  const end = applyHomography(toAligned, s.end.x, s.end.y);
  const lengthPx = Math.hypot(end.x - start.x, end.y - start.y);
  if (lengthPx === 0) return null;
  const n = familyNormal(frame.families[line.familyId]);
  const d = (offsets.get(line.id) ?? line.offsetPx) - line.offsetPx;
  return {
    id: s.id, familyId: line.familyId, start, end, lengthPx,
    u: { x: (end.x - start.x) / lengthPx, y: (end.y - start.y) / lengthPx },
    shift: { x: n.x * d, y: n.y * d },
  };
}

/** Απόσταση του σημείου από την ευθεία του `b`, ή `null` όταν η προβολή του πέφτει έξω από το τμήμα (± `tol`). */
function reach(p: PlanePoint, b: AlignedFace, tol: number): number | null {
  const rx = p.x - b.start.x;
  const ry = p.y - b.start.y;
  const t = rx * b.u.x + ry * b.u.y;
  if (t < -tol || t > b.lengthPx + tol) return null;
  const dist = Math.abs(rx * -b.u.y + ry * b.u.x);
  return dist <= tol ? dist : null;
}

/** Ο πλησιέστερος μη παράλληλος γείτονας του άκρου· ισοπαλία ⇒ το μικρότερο id (τα `faces` είναι ταξινομημένα). */
function nearestNeighbour(a: AlignedFace, p: PlanePoint, faces: readonly AlignedFace[], tol: number, minSin: number): string | null {
  let best: { readonly id: string; readonly dist: number } | null = null;
  for (const b of faces) {
    if (b.id === a.id || b.familyId === a.familyId) continue;
    if (Math.abs(a.u.x * b.u.y - a.u.y * b.u.x) < minSin) continue;
    const dist = reach(p, b, tol);
    if (dist !== null && (best === null || dist < best.dist)) best = { id: b.id, dist };
  }
  return best?.id ?? null;
}

function alignedFaces(
  segments: readonly RasterSegment[], frame: FusionFrame, offsets: ReadonlyMap<string, number>, toAligned: Homography,
): AlignedFace[] {
  return segments
    .map((s) => alignedFace(s, frame, offsets, toAligned))
    .filter((f): f is AlignedFace => f !== null)
    .sort((p, q) => (p.id < q.id ? -1 : p.id > q.id ? 1 : 0));
}

/**
 * Οι κόμβοι των παρειών, στην **αρχική** γεωμετρία: ένα άκρο δένεται στο πλησιέστερο μη παράλληλο τμήμα-παρειά όταν απέχει
 * από την ευθεία του έως `frame.collinearTolPx` (η ΜΙΑ ανοχή «πάνω στη γραμμή») και η προβολή του πέφτει μέσα στο τμήμα
 * (± την ίδια ανοχή) — γωνία L και διακλάδωση T. Ντετερμινιστικό.
 */
export function findSegmentJunctions(
  segments: readonly RasterSegment[], frame: FusionFrame, toAligned: Homography, minAngleDeg: number,
): SegmentJunction[] {
  const faces = alignedFaces(segments, frame, new Map(), toAligned);
  const minSin = Math.sin((minAngleDeg * Math.PI) / 180);
  const out: SegmentJunction[] = [];
  for (const a of faces) {
    for (const end of ['start', 'end'] as const) {
      const neighbourId = nearestNeighbour(a, a[end], faces, frame.collinearTolPx, minSin);
      if (neighbourId !== null) out.push({ segmentId: a.id, end, neighbourId });
    }
  }
  return out;
}

const plus = (p: PlanePoint, q: PlanePoint): PlanePoint => ({ x: p.x + q.x, y: p.y + q.y });

/** Ο κόμβος μετά τη συνόρθωση: η τομή των δύο **μετακινημένων** ευθειών, στα αρχικά px· `null` όταν δεν ορίζεται. */
function junctionPoint(a: AlignedFace, b: AlignedFace, toOriginal: Homography): PlanePoint | null {
  const p = intersectLines(plus(a.start, a.shift), a.u, plus(b.start, b.shift), b.u);
  return p === null ? null : applyHomography(toOriginal, p.x, p.y);
}

/**
 * Κλείνει τους κόμβους των ήδη μετακινημένων τμημάτων (`shifted`, ίδια σειρά και ids με τα `observed`). Οι κόμβοι
 * (`junctions`) είναι του `findSegmentJunctions` πάνω στα `observed`, υπολογισμένοι **μία** φορά από τον καλούντα
 * (§6.21.9: η ίδια τοπολογία ταξιδεύει και στην επικάλυψη)· όποιο άκρο δεν είναι κόμβος μένει όπως το άφησε η μετακίνηση.
 */
export function closeSegmentJunctions(
  observed: readonly RasterSegment[],
  shifted: readonly RasterSegment[],
  frame: FusionFrame,
  offsets: ReadonlyMap<string, number>,
  alignment: JunctionAlignment,
  junctions: readonly SegmentJunction[],
): RasterSegment[] {
  const faces = new Map(alignedFaces(observed, frame, offsets, alignment.originalToAligned).map((f) => [f.id, f]));
  const moved = new Map<string, { start?: PlanePoint; end?: PlanePoint }>();
  for (const j of junctions) {
    const a = faces.get(j.segmentId);
    const b = faces.get(j.neighbourId);
    const p = a && b ? junctionPoint(a, b, alignment.alignedToOriginal) : null;
    if (p !== null) moved.set(j.segmentId, { ...moved.get(j.segmentId), [j.end]: p });
  }
  return shifted.map((s) => {
    const m = moved.get(s.id);
    return m === undefined ? s : { ...s, start: m.start ?? s.start, end: m.end ?? s.end };
  });
}

/** Μια γωνία L: δύο άκρα που δένονται **αμοιβαία** — μετά τη συνόρθωση είναι το ίδιο σημείο (η τομή των δύο ευθειών). */
export interface SegmentCorner {
  readonly a: { readonly segmentId: string; readonly end: SegmentEnd };
  readonly b: { readonly segmentId: string; readonly end: SegmentEnd };
}

/**
 * ADR-929 §6.21.9 (Ε2) — οι **γωνίες** ανάμεσα στους κόμβους: το `A.x→B` μαζί με το `B.y→A`. Μια διακλάδωση T δεν είναι
 * γωνία (δένεται μόνο το ένα άκρο) και μένει απόληξη. Μία φορά ανά ζεύγος, κατά σειρά των `junctions`.
 */
export function segmentCorners(junctions: readonly SegmentJunction[]): SegmentCorner[] {
  const endTowards = new Map<string, SegmentEnd>();
  for (const j of junctions) endTowards.set(`${j.segmentId}→${j.neighbourId}`, j.end);
  const out: SegmentCorner[] = [];
  for (const j of junctions) {
    const back = endTowards.get(`${j.neighbourId}→${j.segmentId}`);
    if (back !== undefined && j.segmentId < j.neighbourId) {
      out.push({ a: { segmentId: j.segmentId, end: j.end }, b: { segmentId: j.neighbourId, end: back } });
    }
  }
  return out;
}
