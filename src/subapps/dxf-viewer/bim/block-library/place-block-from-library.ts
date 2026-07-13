/**
 * Block Library — τοποθέτηση: {@link InSessionBlockDef} → {@link BlockEntity} σε clicked point.
 *
 * Pure builder (καμία παρενέργεια, καμία εγγραφή στη σκηνή). Το commit στη σκηνή γίνεται
 * από τον καλούντα μέσω του SSoT `appendEntityToScene` (undo + `drawing:entity-created`),
 * ακριβώς όπως κάθε άλλο BIM entity.
 *
 * Το αποτέλεσμα είναι byte-συμβατό με ό,τι παράγει `createBlockInstance` στο import:
 * members σε BLOCK-LOCAL space (base στο origin) + placement transform
 * (`position`/`scale`/`rotation`). Τα member ids ΑΝΑΓΕΝΝΩΝΤΑΙ ώστε κάθε instance να είναι
 * ανεξάρτητο (καμία σύγκρουση id μεταξύ πολλαπλών τοποθετήσεων του ίδιου block).
 *
 * @see systems/block/block-instance.ts — createBlockInstance (ίδιο BlockEntity shape)
 * @see bim/scene/append-entity-to-scene.ts — commit SSoT (undoable)
 */

import type { BlockEntity, Entity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import { generateEntityId } from '../../systems/entity-creation/utils';
import { deepClone } from '../../utils/clone-utils';
import type { InSessionBlockDef } from './block-library-types';

/** Παράμετροι τοποθέτησης ενός block instance. */
export interface BlockPlacementParams {
  readonly position: Point2D;
  /** Ομοιόμορφη/μη-ομοιόμορφη κλίμακα· default `{ x: 1, y: 1 }`. */
  readonly scale?: Point2D;
  /** Γωνία σε μοίρες· default `0`. */
  readonly rotation?: number;
  /** Layer του instance· default `'0'`. */
  readonly layerId?: string;
}

/** Κλωνοποιεί τα BLOCK-LOCAL members με ΦΡΕΣΚΑ ids (ανεξάρτητο instance). */
function cloneLocalMembers(members: readonly Entity[]): Entity[] {
  return members.map(
    (m) => ({ ...deepClone(m), id: generateEntityId(), selected: false }) as Entity,
  );
}

/**
 * Χτίζει ένα {@link BlockEntity} από έναν in-session ορισμό + placement params.
 * Δεν αγγίζει τη σκηνή — ο καλών κάνει το commit.
 */
export function buildBlockEntityFromDef(
  def: InSessionBlockDef,
  params: BlockPlacementParams,
): BlockEntity {
  return {
    id: generateEntityId(),
    type: 'block',
    name: def.name,
    layerId: params.layerId ?? '0',
    position: { x: params.position.x, y: params.position.y },
    scale: params.scale ? { x: params.scale.x, y: params.scale.y } : { x: 1, y: 1 },
    rotation: params.rotation ?? 0,
    entities: cloneLocalMembers(def.localMembers),
    visible: true,
  } as BlockEntity;
}
