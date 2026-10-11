/**
 * ADR-911 Φ4-1 — πώς αποκτά ξενιστή μια πόρτα.
 *
 * Πρακτική Revit/ArchiCAD: ο τοίχος είναι συνεχής και το κούφωμα φιλοξενείται μέσα του. Στο DXF
 * όμως ο τοίχος είναι ζωγραφισμένος ΚΟΜΜΕΝΟΣ στην πόρτα. Μετρημένο στο σχέδιο δοκιμής (6 πόρτες):
 *   · 2 έχουν ομοαξονικό άκρο τοίχου και στις δύο λαμπάδες  ⇒ ΓΕΦΥΡΩΣΗ (οι δύο γίνονται ένας)·
 *   · 2 έχουν ομοαξονικό άκρο μόνο στη μία                  ⇒ ΕΠΕΚΤΑΣΗ ως την άλλη λαμπάδα·
 *   · 2 δεν έχουν κανένα (λαμπάδες = «δόντια» / παρειές)    ⇒ ΝΕΟ ΚΟΜΜΑΤΙ λαμπά–λαμπά.
 *
 * Το σχέδιο εκφράζεται σε ΣΗΜΕΙΑ ΚΟΣΜΟΥ, όχι σε `offsetFromStart`: όταν δύο πόρτες γεφυρώνουν
 * τον ίδιο τοίχο, η αρχή του ενωμένου τοίχου αλλάζει, ενώ τα σημεία όχι. Η μετατροπή σε offset
 * γίνεται τη στιγμή της εγγραφής (`projectPointToWallOffsetMm`).
 */

import type { Point2D } from '../../rendering/types/Types';
import type { WallEntity } from '../types/wall-types';
import { MODEL_FROM_DRAWING_LIMITS as LIMITS } from '../../config/tolerance-config';
import { addPoints, dotProduct, scalePoint, subtractPoints } from '../../rendering/entities/shared/geometry-vector-utils';
import { canMergeWalls, COLLINEAR_SIN_TOL } from '../walls/wall-merge';
import type { DoorJamb, DoorSymbolSolution } from './door-symbol-axis';
import { frameCoords, pointOnFrame, type WallHostFrame } from './wall-host-frame';

export type OpeningHostPlan =
  /** Ο τοίχος υπάρχει ήδη συνεχής πίσω από το σύμβολο. */
  | { readonly kind: 'existing-wall'; readonly wallId: string }
  /** Δύο ομοαξονικοί τοίχοι γίνονται ένας, πάνω από το κενό. */
  | { readonly kind: 'bridge'; readonly wallIds: readonly [string, string] }
  /** Το άκρο ενός τοίχου προχωρά ως την απέναντι λαμπάδα. */
  | { readonly kind: 'extend'; readonly wallId: string; readonly end: 'start' | 'end'; readonly to: Point2D }
  /** Κανένας ομοαξονικός τοίχος: νέο κομμάτι λαμπά–λαμπά, πάχος από την παρειά. */
  | { readonly kind: 'new-piece'; readonly start: Point2D; readonly end: Point2D; readonly thicknessMm: number };

export interface OpeningSpan {
  /** Αρχή του ανοίγματος πάνω στον άξονα του ξενιστή (για πόρτα: η πλευρά του μεντεσέ). */
  readonly start: Point2D;
  readonly end: Point2D;
}

export interface ResolvedDoorHost {
  readonly plan: OpeningHostPlan;
  readonly span: OpeningSpan;
}

export interface HostWalls {
  readonly frames: ReadonlyMap<string, WallHostFrame>;
  readonly walls: ReadonlyMap<string, WallEntity>;
}

/**
 * Ο τοίχος της λαμπάδας, ΑΝ τρέχει κατά μήκος της πόρτας (ομοαξονικό άκρο). Αρκεί η παραλληλία:
 * η ακτίνα φεύγει πάνω στη γραμμή του φύλλου, άρα παράλληλος τοίχος που τη σταματά βρίσκεται
 * αναγκαστικά πάνω στον άξονα της πόρτας — τη χτύπησε με το ΑΚΡΟ του, όχι με την παρειά του.
 */
function coaxialFrame(jamb: DoorJamb, door: DoorSymbolSolution, host: HostWalls): WallHostFrame | null {
  const frame = jamb.obstacle.wallId ? host.frames.get(jamb.obstacle.wallId) : undefined;
  if (!frame) return null;
  const sin = Math.abs(door.u.x * frame.u.y - door.u.y * frame.u.x);
  return sin <= COLLINEAR_SIN_TOL ? frame : null;
}

function spanOnFrame(frame: WallHostFrame, door: DoorSymbolSolution): OpeningSpan {
  return {
    start: pointOnFrame(frame, frameCoords(frame, door.back.point).along),
    end: pointOnFrame(frame, frameCoords(frame, door.front.point).along),
  };
}

function extendPlan(frame: WallHostFrame, own: DoorJamb, door: DoorSymbolSolution): ResolvedDoorHost {
  const span = spanOnFrame(frame, door);
  const far = own === door.back ? span.end : span.start;
  const end = frameCoords(frame, own.point).along < frame.length / 2 ? 'start' : 'end';
  return { plan: { kind: 'extend', wallId: frame.id, end, to: far }, span };
}

/** Έκταση ενός δακτυλίου κάθετα στην πόρτα, μετρημένη από τον μεντεσέ προς το φύλλο. */
function acrossRange(ring: readonly Point2D[], door: DoorSymbolSolution): readonly [number, number] {
  const values = ring.map((v) => dotProduct(subtractPoints(v, door.hinge), door.swing));
  return [Math.min(...values), Math.max(...values)];
}

/** Νέο κομμάτι: πάχος = το κοινό πλάτος των δύο παρειών, άξονας στο μέσο του. */
function newPiecePlan(door: DoorSymbolSolution, scale: number): ResolvedDoorHost | null {
  const [backLo, backHi] = acrossRange(door.back.obstacle.ring, door);
  const [frontLo, frontHi] = acrossRange(door.front.obstacle.ring, door);
  const lo = Math.max(backLo, frontLo);
  const hi = Math.min(backHi, frontHi);
  const thicknessMm = (hi - lo) / scale;
  if (thicknessMm <= 0 || thicknessMm > LIMITS.OPENING_HOST_MAX_THICKNESS_MM) return null;
  const offset = scalePoint(door.swing, (lo + hi) / 2);
  const start = addPoints(door.back.point, offset);
  const end = addPoints(door.front.point, offset);
  return { plan: { kind: 'new-piece', start, end, thicknessMm }, span: { start, end } };
}

/** `null` = ο ξενιστής δεν προκύπτει από το σχέδιο ⇒ «προς απόφαση». */
export function resolveDoorHost(door: DoorSymbolSolution, host: HostWalls, scale: number): ResolvedDoorHost | null {
  const back = coaxialFrame(door.back, door, host);
  const front = coaxialFrame(door.front, door, host);
  if (back && front) {
    const a = host.walls.get(back.id);
    const b = host.walls.get(front.id);
    if (back.id === front.id || !a || !b || !canMergeWalls(a, b).ok) return null;
    return { plan: { kind: 'bridge', wallIds: [back.id, front.id] }, span: spanOnFrame(back, door) };
  }
  if (back) return extendPlan(back, door.back, door);
  if (front) return extendPlan(front, door.front, door);
  return newPiecePlan(door, scale);
}
