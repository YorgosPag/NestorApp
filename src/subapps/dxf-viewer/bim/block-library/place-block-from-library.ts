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
import type { SceneUnits } from '../../utils/scene-units';
import { generateEntityId } from '../../systems/entity-creation/utils';
import { deepClone } from '../../utils/clone-utils';
import type { InSessionBlockDef, BlockLibraryParamOverrides } from './block-library-types';

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

/**
 * ADR-652 §M7 — ΚΟΙΝΟΣ mapper cursor+ribbon overrides → {@link BlockPlacementParams}: το χρησιμοποιεί
 * ΚΑΙ το commit path (`useBlockLibraryTool.buildParams`) ΚΑΙ το ghost path
 * (`generateBlockLibraryPreview`) — preview ≡ commit, μηδέν διπλότυπο μαπαρίσματος (N.18).
 *
 * M5 — X/Y κλίμακα (αρνητικό = mirror): όταν ΚΑΝΕΝΑ από τα δύο δεν ήρθε (`scaleX`/`scaleY` both
 * absent) → `undefined` ⇒ ο assembler βάζει το default `{x:1,y:1}` (bridge έχει ήδη συγχρονίσει τους
 * δύο άξονες όταν το «Ομοιόμορφη» lock είναι ON).
 *
 * `sceneUnits` δεν καταναλώνεται ακόμα — τα blocks είναι αυτο-συνεπή στις scene units, καμία mm→scene
 * μετατροπή (βλ. σχόλιο `BlockSceneUnits` στο `useBlockLibraryTool`). Κρατιέται στην υπογραφή για
 * parity με τους υπόλοιπους `buildDefault*Params` builders (mm→scene conversion) + μελλοντική χρήση.
 */
export function buildBlockPlacementParams(
  cursor: Readonly<Point2D>,
  overrides: BlockLibraryParamOverrides,
  sceneUnits: SceneUnits,
): BlockPlacementParams {
  void sceneUnits;
  return {
    position: { x: cursor.x, y: cursor.y },
    scale:
      overrides.scaleX != null || overrides.scaleY != null
        ? { x: overrides.scaleX ?? 1, y: overrides.scaleY ?? 1 }
        : undefined,
    rotation: overrides.rotation,
    layerId: '0',
  };
}

/** Κλωνοποιεί τα BLOCK-LOCAL members με ΦΡΕΣΚΑ ids (ανεξάρτητο instance). */
function cloneLocalMembers(members: readonly Entity[]): Entity[] {
  return members.map(
    (m) => ({ ...deepClone(m), id: generateEntityId(), selected: false }) as Entity,
  );
}

/**
 * Το ΚΟΙΝΟ shape ενός {@link BlockEntity} από def + placement — byte-συμβατό με
 * `createBlockInstance` (base baked στο origin + placement transform). Ο μόνος διαφοροποιητής
 * μεταξύ commit και ghost είναι τα `entities` (κλωνοποιημένα vs raw) και το `id`, ώστε να
 * υπάρχει ΜΙΑ πηγή για τη δομή (όχι sibling clone — N.18).
 */
function assembleBlockEntity(
  def: InSessionBlockDef,
  params: BlockPlacementParams,
  entities: readonly Entity[],
  id: string,
): BlockEntity {
  return {
    id,
    type: 'block',
    name: def.name,
    layerId: params.layerId ?? '0',
    position: { x: params.position.x, y: params.position.y },
    scale: params.scale ? { x: params.scale.x, y: params.scale.y } : { x: 1, y: 1 },
    rotation: params.rotation ?? 0,
    entities: entities as Entity[],
    visible: true,
  } as BlockEntity;
}

/**
 * Χτίζει ένα {@link BlockEntity} από έναν in-session ορισμό + placement params.
 * Δεν αγγίζει τη σκηνή — ο καλών κάνει το commit. Τα members ΚΛΩΝΟΠΟΙΟΥΝΤΑΙ με φρέσκα ids
 * (ανεξάρτητο instance ανά τοποθέτηση).
 */
export function buildBlockEntityFromDef(
  def: InSessionBlockDef,
  params: BlockPlacementParams,
): BlockEntity {
  return assembleBlockEntity(def, params, cloneLocalMembers(def.localMembers), generateEntityId());
}

/** Σταθερό id για το transient ghost — δεν μπαίνει ποτέ στη σκηνή. */
const GHOST_BLOCK_ID = 'block-library-ghost';

/**
 * ADR-040 — TRANSIENT ghost για το footprint preview: ίδιο placement transform με το commit,
 * αλλά ΧΩΡΙΣ clone/id-gen (τρέχει ανά cursor move). Τα raw `def.localMembers` περνούν by-ref·
 * ο consumer (`getEntityBounds`/render) δεν τα μεταλλάσσει (επιστρέφει transformed αντίγραφα).
 */
export function buildGhostBlockEntity(
  def: InSessionBlockDef,
  params: BlockPlacementParams,
): BlockEntity {
  return assembleBlockEntity(def, params, def.localMembers, GHOST_BLOCK_ID);
}
