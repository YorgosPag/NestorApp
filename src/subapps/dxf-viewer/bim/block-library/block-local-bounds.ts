/**
 * Block Library — BLOCK-LOCAL bounds ενός ορισμού (canonical mm), για palette preview +
 * footprint. Καθαρή SSoT ΕΠΑΝΑΧΡΗΣΗ: το union των member bounds το κάνει το ίδιο
 * `calculateTightBounds` (getEntityBounds ανά member) που τρέχει το import auto-fit — καμία
 * νέα loop/union math εδώ (N.18).
 *
 * Τα members είναι σε BLOCK-LOCAL space (base στο origin), οπότε τα bounds είναι ανεξάρτητα
 * placement — υπολογίζονται ΜΙΑ φορά στο capture και διαβάζονται πολλές (Google-level).
 *
 * @see ../../systems/zoom/utils/bounds-entity.ts — calculateTightBounds / getEntityBounds (SSoT)
 */

import type { Entity } from '../../types/entities';
import { calculateTightBounds, type BoundsEntity } from '../../systems/zoom/utils/bounds-entity';
import type { BlockBoundsMm } from './block-library-types';

/**
 * Union AABB των BLOCK-LOCAL members σε canonical mm, ή `null` αν δεν υπάρχει μετρήσιμη
 * γεωμετρία. `normalize:false` → δεν μεταλλάσσει τα members.
 */
export function computeBlockLocalBoundsMm(members: readonly Entity[]): BlockBoundsMm | null {
  if (members.length === 0) return null;
  const b = calculateTightBounds(members as unknown as BoundsEntity[], false);
  return { minX: b.min.x, minY: b.min.y, maxX: b.max.x, maxY: b.max.y };
}
