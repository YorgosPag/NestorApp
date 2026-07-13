/**
 * ADR-654 — Έπιπλα κάτοψης (entourage): thin wrapper πάνω στο `appendEntityToScene` SSoT,
 * ώστε η τοποθέτηση επίπλου να ταγκάρεται με `tool: 'furniture-plan'` (N.0.2 — κανένα
 * copy-paste του append+broadcast persistence trigger). Mirror του `add-block-to-scene.ts`.
 *
 * @see ../scene/append-entity-to-scene.ts — γενικό SSoT (undoable + drawing:entity-created)
 */
import { appendEntityToScene, type SceneAppendAccessor } from '../scene/append-entity-to-scene';
import type { ImageEntity } from '../../types/image';

/**
 * Append `furniture` (ImageEntity) στην ενεργή level scene ως undoable create + broadcast
 * `drawing:entity-created` (tool: 'furniture-plan'). No-op χωρίς ενεργό level/scene.
 */
export function addFurniturePlanToScene(
  furniture: ImageEntity,
  accessor: SceneAppendAccessor,
): void {
  appendEntityToScene(accessor, furniture, 'furniture-plan');
}
