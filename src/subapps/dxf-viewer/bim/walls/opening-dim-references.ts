/**
 * opening-dim-references — pure SSoT computing the reference offsets for the Revit
 * temporary/listening dimensions of a dragged opening (ADR-363 Φ1G.5 Slice 2f).
 *
 * Along the host wall axis an opening occupies `[offsetFromStart, offsetFromStart +
 * width]` (mm). On each side the temporary dimension measures to the nearest
 * reference: the closest sibling jamb on that side, or — when no sibling lies that
 * way — the wall end. The maths is pure mm arithmetic on `OpeningParams`; the
 * world-space points are derived later by the 3D overlay (no geometry needed here).
 */

import type { OpeningEntity, OpeningParams } from '../types/opening-types';
import type { WallEntity } from '../types/wall-types';
import { resolveJunctionFaceInsetMm } from './opening-junction-refs';

export interface OpeningDimReferences {
  /** Offset (mm from wall start) of the opening's start (near-wall-start) jamb. */
  readonly startJambOffsetMm: number;
  /** Offset (mm) of the opening's end (near-wall-end) jamb. */
  readonly endJambOffsetMm: number;
  /** Reference offset on the wall-start side (nearest sibling end, else 0). */
  readonly prevRefOffsetMm: number;
  /** Reference offset on the wall-end side (nearest sibling start, else wall length). */
  readonly nextRefOffsetMm: number;
  /** Distance start-jamb → prev reference (mm, ≥ 0). */
  readonly leftDistMm: number;
  /** Distance end-jamb → next reference (mm, ≥ 0). */
  readonly rightDistMm: number;
  /** True when the prev reference is the wall start (no sibling on that side). */
  readonly prevIsWallEnd: boolean;
  /** True when the next reference is the wall end (no sibling on that side). */
  readonly nextIsWallEnd: boolean;
}

/**
 * Resolve the left/right reference offsets + distances for `resolvedParams` on
 * `host`, against the sibling openings already on that wall.
 *
 * When a side has NO sibling its reference is the wall end. If `candidateWalls`
 * supplies the scene's walls and a TRANSVERSE wall meets the host at that end
 * (L/T junction), the reference is inset to that wall's near FACE (Revit's default
 * for openings) — `resolveJunctionFaceInsetMm`. A free end stays at the wall end.
 */
export function resolveOpeningDimReferences(
  resolvedParams: OpeningParams,
  host: WallEntity,
  siblings: readonly OpeningEntity[],
  candidateWalls: readonly WallEntity[] = [],
): OpeningDimReferences {
  const startJambOffsetMm = resolvedParams.offsetFromStart;
  const endJambOffsetMm = startJambOffsetMm + resolvedParams.width;
  const wallLengthMm = host.geometry.length * 1000;

  let prevRefOffsetMm = 0; // wall start
  let prevIsWallEnd = true;
  let nextRefOffsetMm = wallLengthMm; // wall end
  let nextIsWallEnd = true;

  for (const s of siblings) {
    const sibStart = s.params.offsetFromStart;
    const sibEnd = sibStart + s.params.width;
    // Nearest sibling end on the wall-start side (the largest end ≤ our start jamb).
    if (sibEnd <= startJambOffsetMm && sibEnd > prevRefOffsetMm) {
      prevRefOffsetMm = sibEnd;
      prevIsWallEnd = false;
    }
    // Nearest sibling start on the wall-end side (the smallest start ≥ our end jamb).
    if (sibStart >= endJambOffsetMm && sibStart < nextRefOffsetMm) {
      nextRefOffsetMm = sibStart;
      nextIsWallEnd = false;
    }
  }

  // Junction-aware: a wall-END reference is inset to the transverse wall's near face
  // (the reference is still the wall end — now at the face, not the centreline).
  if (prevIsWallEnd) {
    const inset = resolveJunctionFaceInsetMm(host, 'start', candidateWalls);
    if (inset !== null) prevRefOffsetMm = inset;
  }
  if (nextIsWallEnd) {
    const inset = resolveJunctionFaceInsetMm(host, 'end', candidateWalls);
    if (inset !== null) nextRefOffsetMm = wallLengthMm - inset;
  }

  return {
    startJambOffsetMm,
    endJambOffsetMm,
    prevRefOffsetMm,
    nextRefOffsetMm,
    leftDistMm: Math.max(0, startJambOffsetMm - prevRefOffsetMm),
    rightDistMm: Math.max(0, nextRefOffsetMm - endJambOffsetMm),
    prevIsWallEnd,
    nextIsWallEnd,
  };
}
