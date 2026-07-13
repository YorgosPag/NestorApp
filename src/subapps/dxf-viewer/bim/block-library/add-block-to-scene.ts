/**
 * Block Library — thin wrapper πάνω στο `appendEntityToScene` SSoT, ώστε η επανατοποθέτηση
 * block από τη βιβλιοθήκη να ταγκάρεται με `tool: 'block-library'` (N.0.2 — κανένα copy-paste
 * του append+broadcast persistence trigger). Mirror του `add-furniture-to-scene.ts`.
 *
 * @see ../scene/append-entity-to-scene.ts — γενικό SSoT (undoable + drawing:entity-created)
 */
import { appendEntityToScene, type SceneAppendAccessor } from '../scene/append-entity-to-scene';
import type { BlockEntity } from '../../types/entities';

/**
 * Append `block` στην ενεργή level scene ως undoable create + broadcast
 * `drawing:entity-created` (tool: 'block-library'). No-op χωρίς ενεργό level/scene.
 */
export function addBlockToScene(block: BlockEntity, accessor: SceneAppendAccessor): void {
  appendEntityToScene(accessor, block, 'block-library');
}
