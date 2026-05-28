/**
 * Wall-Opening Coordinator — ADR-363 (Revit Transaction Pattern).
 *
 * When a wall axis changes via grip drag, hosted openings reposition
 * proportionally. Wraps `UpdateWallParamsCommand` + N `UpdateOpeningParamsCommand`
 * into one `CompoundCommand` — single atomic undo/redo entry for the user.
 *
 * Ratio-preserving: newOffset = (oldOffset / oldLength) × newLength.
 * Overflow clamp: if wall shrinks and opening overflows → clamp to maxOffset
 * (wall end − opening width). Degenerate walls (length=0) are skipped safely.
 *
 * Curved/polyline walls use the real arc length via `getWallAxisVertices` +
 * `computePolylineLengthMm` — Phase 2 leftover resolved.
 *
 * @see ADR-363-bim-drawing-mode.md §Wall-Grip-Opening-Recompute
 */

import type { ICommand, ISceneManager } from '../../core/commands/interfaces';
import type { WallEntity, WallParams, WallKind } from '../types/wall-types';
import type { OpeningEntity } from '../types/opening-types';
import { getWallAxisVertices, computePolylineLengthMm } from '../geometry/wall-geometry';
import { UpdateWallParamsCommand } from '../../core/commands/entity-commands/UpdateWallParamsCommand';
import { UpdateOpeningParamsCommand } from '../../core/commands/entity-commands/UpdateOpeningParamsCommand';
import { CompoundCommand } from '../../core/commands/CompoundCommand';

/** True arc length in mm for any wall kind — curved/polyline safe. */
function axisLengthMm(params: WallParams, kind: WallKind): number {
  return computePolylineLengthMm(getWallAxisVertices(params, kind));
}

/** Exact coordinate equality (Point3D structural). */
function samePoint(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

/**
 * Wrap `wallCmd` with coordinated opening repositioning commands.
 *
 * Returns `wallCmd` unchanged when:
 *   - wall has no hosted openings
 *   - old wall length is degenerate (≤ 0)
 *   - no opening is affected: offset delta < 0.1 mm AND the host thickness /
 *     flip / axis are all unchanged (nothing the opening geometry depends on)
 *
 * Otherwise returns CompoundCommand([wallCmd, openingCmd × N]) which executes
 * atomically and merges during drag via CompoundCommand.canMergeWith. A
 * thickness/flip/axis change emits a same-params opening command so the cutout
 * geometry (depth = host.thickness) refreshes even without a reposition.
 */
export function coordinateWallUpdate(
  wallCmd: UpdateWallParamsCommand,
  wallId: string,
  oldParams: WallParams,
  newParams: WallParams,
  sceneManager: ISceneManager,
  isDragging: boolean,
): ICommand {
  const rawWall = sceneManager.getEntity(wallId);
  const wallCandidate = rawWall as unknown as Partial<WallEntity>;
  if (wallCandidate.type !== 'wall' || !wallCandidate.hostedOpeningIds?.length) {
    return wallCmd;
  }

  const kind: WallKind = wallCandidate.kind ?? 'straight';
  const oldLen = axisLengthMm(oldParams, kind);
  const newLen = axisLengthMm(newParams, kind);
  if (oldLen <= 0) return wallCmd;

  // Opening geometry is fully host-derived: cut depth = host.thickness
  // (opening-geometry.ts:60), world position = host axis + offset, mirror side =
  // host flip. So a thickness / flip / axis change leaves the opening's own
  // params (offset) untouched yet still requires a geometry refresh — otherwise
  // the cutout keeps the OLD wall depth (Giorgio 2026-05-28: «αλλάζω πάχος
  // τοίχου, το πάχος κουφώματος μένει ίδιο»). Length change additionally
  // repositions the opening along the axis (ratio-preserving).
  const hostGeomChanged =
    oldParams.thickness !== newParams.thickness ||
    (oldParams.flip ?? false) !== (newParams.flip ?? false) ||
    !samePoint(oldParams.start, newParams.start) ||
    !samePoint(oldParams.end, newParams.end);

  const openingCmds: UpdateOpeningParamsCommand[] = [];

  for (const openingId of wallCandidate.hostedOpeningIds) {
    const rawOpening = sceneManager.getEntity(openingId);
    const candidate = rawOpening as unknown as Partial<OpeningEntity>;
    if (candidate.type !== 'opening' || !candidate.params) continue;
    const opening = candidate as OpeningEntity;

    const ratio = opening.params.offsetFromStart / oldLen;
    const rawOffset = ratio * newLen;
    const maxOffset = Math.max(0, newLen - opening.params.width);
    const newOffset = Math.max(0, Math.min(rawOffset, maxOffset));
    const offsetChanged = Math.abs(newOffset - opening.params.offsetFromStart) >= 0.1;

    // Skip only when nothing the opening depends on moved.
    if (!offsetChanged && !hostGeomChanged) continue;

    // Reposition along the axis only when the length changed; otherwise keep the
    // params identical (a same-params command still recomputes geometry against
    // the updated host — refreshing the cut depth on a thickness drag).
    const nextParams = offsetChanged
      ? { ...opening.params, offsetFromStart: newOffset }
      : opening.params;

    openingCmds.push(
      new UpdateOpeningParamsCommand(
        openingId,
        nextParams,
        opening.params,
        sceneManager,
        isDragging,
      ),
    );
  }

  if (openingCmds.length === 0) return wallCmd;

  return new CompoundCommand('Wall + Openings Update', [wallCmd, ...openingCmds]);
}
