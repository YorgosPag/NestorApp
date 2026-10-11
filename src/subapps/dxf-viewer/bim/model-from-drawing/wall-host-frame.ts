/**
 * ADR-911 Φ4-1 — το πλαίσιο αναφοράς ενός τοίχου-ξενιστή: άξονας, μήκος, μισό πάχος, όλα σε
 * μονάδες σκηνής. Χτίζεται ΠΑΝΩ στο `wallAxis` του `wall-merge` (ένας ορισμός άξονα τοίχου).
 */

import type { Point2D } from '../../rendering/types/Types';
import type { WallEntity } from '../types/wall-types';
import { addPoints, dotProduct, scalePoint, subtractPoints } from '../../rendering/entities/shared/geometry-vector-utils';
import { wallAxis } from '../walls/wall-merge';

export interface WallHostFrame {
  readonly id: string;
  readonly origin: Point2D;
  readonly u: Point2D;
  readonly length: number;
  readonly halfThickness: number;
}

export interface FrameCoords {
  /** Θέση κατά μήκος του άξονα από την αρχή του τοίχου. */
  readonly along: number;
  /** ΠΡΟΣΗΜΑΣΜΕΝΗ κάθετη απόσταση (θετική = αριστερά της φοράς). */
  readonly across: number;
}

/** Το αριστερό κάθετο μοναδιαίο ενός μοναδιαίου διανύσματος. */
export const leftNormal = (u: Point2D): Point2D => ({ x: -u.y, y: u.x });

export function wallHostFrame(wall: WallEntity, scale: number): WallHostFrame | null {
  const axis = wallAxis(wall);
  if (!axis) return null;
  return { id: wall.id, ...axis, halfThickness: (wall.params.thickness * scale) / 2 };
}

export function frameCoords(frame: WallHostFrame, p: Point2D): FrameCoords {
  const rel = subtractPoints(p, frame.origin);
  return { along: dotProduct(rel, frame.u), across: dotProduct(rel, leftNormal(frame.u)) };
}

/** Το σημείο του άξονα σε θέση `along` από την αρχή. */
export function pointOnFrame(frame: WallHostFrame, along: number): Point2D {
  return addPoints(frame.origin, scalePoint(frame.u, along));
}

/** Βρίσκεται το σημείο μέσα στη λωρίδα του τοίχου (πάχος + μήκος), με ανοχή; */
export function isInsideFrameBand(frame: WallHostFrame, p: Point2D, tol: number): boolean {
  const { along, across } = frameCoords(frame, p);
  return Math.abs(across) <= frame.halfThickness + tol && along >= -tol && along <= frame.length + tol;
}
