/**
 * ADR-423 — Stage 0 MEP source recognizer (Tier 1, pilot-light).
 *
 * Recognizes existing network-origin equipment (manifold/boiler/electrical panel)
 * as `RecognizedSource`s — the routing anchors Stage 2/3 grow networks from. The
 * CONTRACT is complete (meter/AHU reserved in `MepSourceKind`); the implementation
 * is intentionally thin at pilot — real auto-placement of sources is Stage 2.
 *
 * Reuses the SSoT entity guards (no new source logic).
 *
 * @see ../../../types/entities.ts (isMepManifoldEntity, isMepBoilerEntity, isElectricalPanelEntity)
 */

import type { Entity } from '../../../types/entities';
import {
  isMepManifoldEntity,
  isMepBoilerEntity,
  isMepWaterHeaterEntity,
  isElectricalPanelEntity,
} from '../../../types/entities';
import type { Point3D } from '../../../bim/types/bim-base';
import type {
  RecognitionContext,
  Recognizer,
} from '../recognition-types';
import type { MepSourceKind, RecognizedSource } from './mep-recognized-types';

/** Map an entity to its source kind, or `null` if it is not a source. */
function sourceKindOf(entity: Entity): MepSourceKind | null {
  if (isMepManifoldEntity(entity)) return 'manifold';
  if (isMepBoilerEntity(entity)) return 'boiler';
  if (isMepWaterHeaterEntity(entity)) return 'water-heater';
  if (isElectricalPanelEntity(entity)) return 'panel';
  return null;
}

/** Plan position of a source entity (all source params carry `position`). */
function sourcePosition(entity: Entity): Point3D | null {
  if (isMepManifoldEntity(entity)) return entity.params.position;
  if (isMepBoilerEntity(entity)) return entity.params.position;
  if (isMepWaterHeaterEntity(entity)) return entity.params.position;
  if (isElectricalPanelEntity(entity)) return entity.params.position;
  return null;
}

function buildSource(
  entity: Entity,
  kind: MepSourceKind,
  position: Point3D,
  storeyId: string,
): RecognizedSource {
  return {
    elementId: `src:${entity.id}`,
    category: 'mep-source',
    position: { x: position.x, y: position.y },
    tier: 'bim-entity',
    confidence: 1,
    storeyId,
    sourceKind: kind,
  };
}

/** Tier-1 recognizer: scene manifolds/boilers/panels → recognized sources. */
export const mepSourceRecognizer: Recognizer<RecognizedSource> = {
  id: 'mep-source-bim',
  category: 'mep-source',
  tier: 'bim-entity',
  recognize(ctx: RecognitionContext): readonly RecognizedSource[] {
    const out: RecognizedSource[] = [];
    for (const e of ctx.entities) {
      const kind = sourceKindOf(e);
      const position = kind ? sourcePosition(e) : null;
      if (kind && position) out.push(buildSource(e, kind, position, ctx.storeyId));
    }
    return out;
  },
};
