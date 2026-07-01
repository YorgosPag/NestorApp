/**
 * BUILD ENTITY CLONE COMMAND — SSoT for "clone selected entities at a displacement"
 *
 * Single source of truth shared by:
 *   - Ctrl+V paste in place ({@link useEntityClipboard}) — `delta = {0,0}`
 *   - Ctrl+drag body copy ({@link EntityBodyDragStore} commit) — real drag delta
 *
 * Splits the sources into BIM vs DXF and clones each with the right strategy:
 *   - BIM entities → `buildClonesFromEntities` (kind-specific enterprise IDs +
 *     host rewire + fresh IFC GlobalId), wrapped so their Firestore docs are
 *     broadcast by {@link PasteEntitiesCommand}.
 *   - DXF raw geometry → id-swap clone (fresh `generateEntityId`); persisted by
 *     the scene autosave (ADR-420).
 *
 * Returns `null` when nothing clonable is produced (caller no-ops).
 *
 * @see bim/transforms/bim-copy-builder.ts — buildClonesFromEntities (BIM clone SSoT)
 * @see core/commands/entity-commands/PasteEntitiesCommand.ts — undoable commit
 */

import { buildClonesFromEntities } from './bim-copy-builder';
import { PasteEntitiesCommand } from '../../core/commands/entity-commands/PasteEntitiesCommand';
import { generateEntityId } from '../../systems/entity-creation/utils';
// Same translate SSoT the ghost uses (`useEntityBodyDragPreview`) → preview ≡ commit
// for every DXF type (line / polyline / rect / circle / text / …).
import { applyEntityPreview, makeTranslationPreview } from '../../rendering/ghost';
import { isBimEntity } from '../../types/entities';
import type { Entity } from '../../types/entities';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ISceneManager, SceneEntity } from '../../core/commands/interfaces';
import type { Point2D } from '../../rendering/types/Types';

export interface EntityCloneCommandResult {
  /** Undoable command that adds the clones to the current scene. */
  readonly command: PasteEntitiesCommand;
  /** IDs of every clone created (BIM + DXF) — for post-commit re-selection. */
  readonly cloneIds: string[];
}

/**
 * Build the undoable clone command for `sources` translated by `delta`.
 * Returns `null` when no clone is produced (empty / unsupported selection).
 */
export function buildEntityCloneCommand(
  sources: readonly SceneEntity[],
  delta: Point2D,
  sceneManager: ISceneManager,
): EntityCloneCommandResult | null {
  const bimSources = sources.filter((e) => isBimEntity(e as unknown as Entity));
  const dxfSources = sources.filter((e) => !isBimEntity(e as unknown as Entity));

  const bimResult = buildClonesFromEntities(bimSources, { kind: 'translate', delta });
  // DXF raw geometry: translate by `delta` (ghost SSoT — handles every DXF type)
  // then id-swap. Zero delta (Ctrl+V paste-in-place) → geometry unchanged.
  const dxfClones: SceneEntity[] = dxfSources.map((e) => {
    const transformed = applyEntityPreview(
      e as unknown as DxfEntityUnion,
      makeTranslationPreview(e.id, delta),
    );
    return { ...(transformed as unknown as SceneEntity), id: generateEntityId() } as SceneEntity;
  });

  const allCloneIds = [...bimResult.clones, ...dxfClones].map((c) => c.id);
  if (allCloneIds.length === 0) return null;

  const command = new PasteEntitiesCommand(bimResult.clones, dxfClones, sceneManager);
  return { command, cloneIds: allCloneIds };
}
