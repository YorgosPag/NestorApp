/**
 * ADR-654 M6 — Entourage (άνθρωποι/οχήματα): thin wrapper πάνω στο `appendEntityToScene` SSoT,
 * ώστε η τοποθέτηση να ταγκάρεται με το ToolType της οικογένειας (`people-plan`/`vehicles-plan`) —
 * κανένα copy-paste του append+broadcast persistence trigger (N.0.2). Γενίκευση του
 * `add-furniture-plan-to-scene.ts`: ο tool tag είναι παράμετρος.
 *
 * @see ../scene/append-entity-to-scene.ts — γενικό SSoT (undoable + drawing:entity-created)
 */
import { appendEntityToScene, type SceneAppendAccessor } from '../scene/append-entity-to-scene';
import type { ImageEntity } from '../../types/image';

/**
 * Append `entity` (ImageEntity) στην ενεργή level scene ως undoable create + broadcast
 * `drawing:entity-created` με το δοσμένο `toolTag`. No-op χωρίς ενεργό level/scene.
 */
export function addEntourageToScene(
  entity: ImageEntity,
  accessor: SceneAppendAccessor,
  toolTag: string,
): void {
  appendEntityToScene(accessor, entity, toolTag);
}
