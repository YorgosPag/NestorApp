/**
 * ADR-662 Φάση 2β (Δρόμος Γ) — useTopoSurfaceEntity hook (interactive producer).
 *
 * Ο παραγωγός του `TopoSurfaceEntity`: διαβάζει τη μνημονευμένη επιφάνεια
 * (`getTopoSurface`), χτίζει το footprint στο display frame μέσω του SSoT builder
 * (`buildTopoSurfaceEntity`), εξασφαλίζει το TOPO-SURFACE layer, και κάνει commit το
 * ΕΝΑ footprint entity — ώστε η επιφάνεια να γίνεται first-class selectable (κλικ μέσα
 * → επιλογή → contextual tab + object-bound Properties, Stage C).
 *
 * Idempotent-replace (N.7.2): σταθερό deterministic id ανά surface· το re-generate
 * ΑΝΤΙΚΑΘΙΣΤΑ το προηγούμενο footprint σε ΕΝΑ ατομικό `CompoundCommand` (delete-old +
 * create → ΕΝΑ undo), ποτέ δεν στοιβάζει διπλότυπα. Ο durable back-seat (rebuild στο
 * load/level-switch/geo-ref) ζει στο `regenerate-topo` — ίδιο pattern με τις ισοϋψείς.
 *
 * Derived entity: πάει απευθείας μέσω `CreateEntityCommand` (το SSoT create του
 * ADR-057) αντί για `completeEntities`, ώστε να ΜΗΝ κληρονομεί quick-style /
 * tool-persistence / overlay-persistence side effects που ισχύουν για user-drawn
 * σχήματα — το footprint ξαναχτίζεται από το `getTopoSurface`, δεν είναι ζωγραφιά.
 *
 * @see ./topo-surface-entity.ts — buildTopoSurfaceEntity (SSoT builder, ίδιο και στο regenerate)
 * @see ./useTopoContours.ts — το δίδυμο interactive generate μονοπάτι
 */

import { useCallback } from 'react';
import { useLevels } from '../levels';
import { createLevelSceneManagerAdapter } from '../entity-creation/LevelSceneManagerAdapter';
import { getGlobalCommandHistory } from '../../core/commands/CommandHistory';
import { CreateEntityCommand } from '../../core/commands/entity-commands/CreateEntityCommand';
import { DeleteEntityCommand } from '../../core/commands/entity-commands/DeleteEntityCommand';
import { CompoundCommand } from '../../core/commands/CompoundCommand';
import type { ICommand, SceneEntity } from '../../core/commands/interfaces';
import { ensureTopoLayer } from './ensure-topo-layer';
import {
  buildTopoSurfaceEntity, topoSurfaceEntityId,
  TOPO_SURFACE_LAYER_NAME, TOPO_SURFACE_COLOR,
} from './topo-surface-entity';
import type { TopoSurfaceId } from './topo-types';

export interface GenerateTopoSurfaceOutcome {
  readonly ok: boolean;
  /** True when an existing footprint was replaced (vs a first-time create). */
  readonly replaced: boolean;
  /** Reason when `ok` is false. */
  readonly reason?: 'no-layers' | 'no-surface';
}

const EMPTY: GenerateTopoSurfaceOutcome = { ok: false, replaced: false };

export interface UseTopoSurfaceEntity {
  readonly generate: (surfaceId?: TopoSurfaceId) => GenerateTopoSurfaceOutcome;
}

export function useTopoSurfaceEntity(): UseTopoSurfaceEntity {
  const { currentLevelId, getLevelScene, setLevelScene } = useLevels();

  const generate = useCallback(
    (surfaceId: TopoSurfaceId = 'existing'): GenerateTopoSurfaceOutcome => {
      const levelId = currentLevelId || '0';

      const layerId = ensureTopoLayer(
        getLevelScene, setLevelScene, levelId, TOPO_SURFACE_LAYER_NAME, TOPO_SURFACE_COLOR,
      );
      if (!layerId) return { ...EMPTY, reason: 'no-layers' };

      const entity = buildTopoSurfaceEntity(surfaceId, layerId);
      if (!entity) return { ...EMPTY, reason: 'no-surface' };

      const adapter = createLevelSceneManagerAdapter(getLevelScene, setLevelScene, levelId);
      const id = topoSurfaceEntityId(surfaceId);
      const { id: _id, ...entityWithoutId } = entity;

      // Idempotent replace: drop the previous footprint (same stable id) FIRST so re-generate
      // never stacks duplicates — one atomic undo covers both the delete and the fresh create.
      const replaced = getLevelScene(levelId)?.entities.some((e) => e.id === id) ?? false;
      const commands: ICommand[] = [];
      if (replaced) commands.push(new DeleteEntityCommand(id, adapter));
      commands.push(
        new CreateEntityCommand(
          entityWithoutId as unknown as Omit<SceneEntity, 'id'>,
          adapter,
          { existingId: id, layerId, color: TOPO_SURFACE_COLOR },
        ),
      );

      getGlobalCommandHistory().execute(
        commands.length > 1 ? new CompoundCommand('topo-surface generate', commands) : commands[0],
      );

      return { ok: true, replaced };
    },
    [currentLevelId, getLevelScene, setLevelScene],
  );

  return { generate };
}
