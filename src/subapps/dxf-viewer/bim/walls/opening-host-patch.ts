/**
 * Opening host-patch SSoT — ADR-566 (extracted from WallSplitCommand, ADR-363 §5.6).
 *
 * Re-hosts a single opening onto a (possibly new) host wall: writes the patched
 * `params`, and — when the host wall is present in the scene — recomputes the
 * opening's geometry + validation from that host. Soft-orphan safe: proceeds
 * (params-only) even if the host wall is not yet in the scene, mirroring
 * `UpdateOpeningParamsCommand.applyPatch`.
 *
 * Single source of truth shared by both wall-editing commands that re-parent
 * openings:
 *   - `WallSplitCommand` — partitions one wall's openings onto two new walls.
 *   - `WallMergeCommand` — unions two walls' openings onto one merged wall.
 *
 * @see core/commands/entity-commands/WallSplitCommand.ts
 * @see core/commands/entity-commands/WallMergeCommand.ts
 */

import type { ISceneManager, SceneEntity } from '../../core/commands/interfaces';
import type { WallEntity } from '../types/wall-types';
import type { OpeningGeometry, OpeningParams } from '../types/opening-types';
import { computeOpeningGeometry } from '../geometry/opening-geometry';
import { validateOpeningParams } from '../validators/opening-validator';

/**
 * Patches opening params + recomputes geometry/validation from the host wall
 * named in `params.wallId`. Soft-orphan safe (host may be absent mid-command).
 */
export function applyOpeningHostPatch(
  sceneManager: ISceneManager,
  openingId: string,
  params: OpeningParams,
): void {
  const hostRaw = sceneManager.getEntity(params.wallId);
  const hostCandidate = hostRaw as unknown as Partial<WallEntity>;
  const patch: Record<string, unknown> = { params };

  if (hostCandidate?.type === 'wall' && hostCandidate.params && hostCandidate.geometry) {
    const host = hostCandidate as WallEntity;
    const geometry: OpeningGeometry = computeOpeningGeometry(params, host, host.params.sceneUnits ?? 'mm');
    const validation = validateOpeningParams(params, host).bimValidation;
    patch.geometry = geometry;
    patch.validation = validation;
  }

  sceneManager.updateEntity(openingId, patch as Partial<SceneEntity>);
}
