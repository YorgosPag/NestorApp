/**
 * ADR-920 Β4.8 Β3.3 — test fixtures that write breaklines the way PRODUCTION does: a `createBreakline` record through
 * the undoable `SetTopoBreaklinesCommand`. The store no longer has a one-way add/remove (it was the second door the
 * command closed), so every suite that needs a breakline in place seeds it through the one real writer — a test can
 * then never pass on a path the app does not take.
 */

import { createBreakline } from '../TopoPointStore';
import { SetTopoBreaklinesCommand } from '../../../core/commands/entity-commands/SetTopoBreaklinesCommand';
import type { BreaklineElevationSource, TopoPoint3D, TopoSurfaceId } from '../topo-types';

/** Append one breakline (same arguments as the retired `addBreakline`) and return its minted id. */
export function seedBreakline(
  vertices: readonly TopoPoint3D[],
  closed = false,
  sourceEntityId?: string,
  surfaceId: TopoSurfaceId = 'existing',
  elevationSource?: BreaklineElevationSource,
): string {
  const breakline = createBreakline(vertices, closed, sourceEntityId, elevationSource);
  if (!breakline) throw new Error('seedBreakline: a breakline needs at least 2 vertices');
  SetTopoBreaklinesCommand.add(surfaceId, [breakline])?.execute();
  return breakline.id;
}

/** Remove one breakline by id through the same command. */
export function unseedBreakline(breaklineId: string, surfaceId: TopoSurfaceId = 'existing'): void {
  SetTopoBreaklinesCommand.remove(surfaceId, [breaklineId])?.execute();
}
