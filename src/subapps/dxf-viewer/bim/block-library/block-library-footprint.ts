/**
 * Block Library — footprint preview (ghost) του placement tool. Επιστρέφει τις 4 γωνίες του
 * WORLD-space AABB όπου θα κάτσει το block, ώστε το ghost overlay να δείχνει ακριβώς το
 * αποτύπωμα πριν το κλικ.
 *
 * SSoT: το AABB το βγάζει το ΙΔΙΟ `getEntityBounds` (case 'block' → expand + union) που τρέφει
 * το zoom-extents/selection — άρα το preview ταιριάζει byte-identical με το πού ζωγραφίζεται το
 * block. Χρησιμοποιεί το transient `buildGhostBlockEntity` (ΧΩΡΙΣ clone/id-gen, ADR-040).
 *
 * @see ./place-block-from-library.ts — buildGhostBlockEntity (transient, raw members)
 * @see ../../systems/zoom/utils/bounds-entity.ts — getEntityBounds (case 'block')
 */

import type { Point3D } from '../types/bim-base';
import { getEntityBounds, type BoundsEntity } from '../../systems/zoom/utils/bounds-entity';
import type { InSessionBlockDef } from './block-library-types';
import { buildGhostBlockEntity, type BlockPlacementParams } from './place-block-from-library';

/**
 * 4 γωνίες (z=0) του transformed AABB του block στα δοσμένα placement params, ή `[]` όταν το
 * block δεν έχει μετρήσιμη γεωμετρία. Pure projection (ADR-040) — καμία παρενέργεια.
 */
export function computeBlockFootprint(
  def: InSessionBlockDef,
  params: BlockPlacementParams,
): Point3D[] {
  const ghost = buildGhostBlockEntity(def, params);
  const b = getEntityBounds(ghost as unknown as BoundsEntity);
  if (!b) return [];
  return [
    { x: b.min.x, y: b.min.y, z: 0 },
    { x: b.max.x, y: b.min.y, z: 0 },
    { x: b.max.x, y: b.max.y, z: 0 },
    { x: b.min.x, y: b.max.y, z: 0 },
  ];
}
