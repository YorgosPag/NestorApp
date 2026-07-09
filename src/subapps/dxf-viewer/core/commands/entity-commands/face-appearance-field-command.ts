/**
 * @module core/commands/entity-commands/face-appearance-field-command
 * @description Intermediate Template-Method base (SSoT) for the two commands
 * that write the `faceAppearance` field of a structural solid (ADR-539):
 * per-face `SetFaceAppearanceCommand` and entity-level
 * `SetEntityFaceAppearanceMapCommand`.
 *
 * Both read the live `faceAppearance` map, snapshot it, and write a replacement
 * map back — identical field plumbing. This base owns that read/write (over
 * {@link EntityFieldOverrideCommand}); a concrete command supplies only
 * {@link computeNextMap} — how the next map is derived from the previous one
 * (set/clear one face vs. replace the whole map).
 *
 * @see ADR-617 (entity-command SSoT)
 * @see bim/types/face-appearance-types.ts — FaceAppearanceMap
 * @since 2026-07-09
 */

import type { SceneEntity } from '../interfaces';
import type { FaceAppearanceMap } from '../../../bim/types/face-appearance-types';
import { EntityFieldOverrideCommand } from './entity-field-override-command';

export abstract class FaceAppearanceFieldCommand extends EntityFieldOverrideCommand<FaceAppearanceMap> {
  /** Derive the next `faceAppearance` map from the current one (set/clear/replace). */
  protected abstract computeNextMap(prev: FaceAppearanceMap | undefined): FaceAppearanceMap;

  protected snapshotStates(): { prev: FaceAppearanceMap | undefined; next: FaceAppearanceMap | undefined } | null {
    const entity = this.sceneManager.getEntity(this.entityId) as unknown as
      { faceAppearance?: FaceAppearanceMap } | undefined;
    if (!entity) return null;
    const prev = entity.faceAppearance;
    return { prev, next: this.computeNextMap(prev) };
  }

  protected writeValue(faceAppearance: FaceAppearanceMap | undefined): boolean {
    this.sceneManager.updateEntity(this.entityId, { faceAppearance } as unknown as Partial<SceneEntity>);
    return true;
  }
}
