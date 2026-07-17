/**
 * ADR-652 M6 — «Δημιουργία Block από επιλογή» (AutoCAD BLOCK/BMAKE): pure κατασκευή ενός
 * {@link InSessionBlockDef} από N επιλεγμένες world-space οντότητες.
 *
 * Ο ΑΝΤΙΣΤΡΟΦΟΣ του capture-from-import: εκεί τα named blocks έρχονται ήδη BLOCK-LOCAL από το
 * `createBlockInstance`· εδώ ο χρήστης σχεδίασε loose γεωμετρία σε WORLD space και την «κλείνουμε»
 * σε ορισμό block. Ίδιο μοντέλο βάσης (base baked → origin) ώστε ο ορισμός να είναι byte-συμβατός
 * με ό,τι παράγει το import → ΜΙΑ διαδρομή τοποθέτησης ({@link buildBlockEntityFromDef}).
 *
 * Base point = κάτω-αριστερή γωνία του AABB της επιλογής (ντετερμινιστικό v1· διαδραστική επιλογή
 * σημείου = μελλοντικό follow-up). Bake: κάθε member μεταφέρεται κατά −base μέσω του SSoT
 * `translateEntityByAnchor` (ΙΔΙΟ μονοπάτι με το `createBlockInstance`), ώστε ο ορισμός να
 * αναπτύσσεται με base (0,0) και να εξάγεται ως BLOCK με base (0,0).
 *
 * Pure — καμία εγγραφή σε registry/σκηνή. Ο καλών κάνει `upsertSessionBlockDef` + (προαιρετικά)
 * το replace command.
 *
 * @see ../../bim/block-library/place-block-from-library.ts — buildBlockEntityFromDef (def → BlockEntity)
 * @see ./block-instance.ts — createBlockInstance (import path, ίδιο base-bake)
 * @see ../../bim/block-library/block-local-bounds.ts — computeBlockLocalBoundsMm (bounds SSoT)
 */

import type { Entity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import { calculateTightBounds, type BoundsEntity } from '../zoom/utils/bounds-entity';
import { translateEntityByAnchor } from '../stretch/stretch-entity-transform';
import { generateEntityId } from '../entity-creation/utils';
import { computeBlockLocalBoundsMm } from '../../bim/block-library/block-local-bounds';
import type { InSessionBlockDef } from '../../bim/block-library/block-library-types';

export interface BuiltBlockDef {
  readonly def: InSessionBlockDef;
  /** Το base point (world) — placement position για το «replace with instance». */
  readonly base: Point2D;
}

/**
 * Χτίζει έναν {@link InSessionBlockDef} από world-space οντότητες. Επιστρέφει `null` όταν δεν
 * υπάρχει μετρήσιμη γεωμετρία (κενή επιλογή ή degenerate bounds) — ο καλών κάνει no-op + hint.
 *
 * Τα member ids ΑΝΑΓΕΝΝΩΝΤΑΙ ώστε ο ορισμός να μη μοιράζεται ταυτότητα με τις ζωντανές οντότητες
 * της σκηνής (στο WBLOCK path η επιλογή παραμένει στη σκηνή) — ο ορισμός είναι πρότυπο, όχι alias.
 */
export function buildBlockDefFromSelection(
  worldEntities: readonly Entity[],
  name: string,
): BuiltBlockDef | null {
  if (worldEntities.length === 0) return null;

  const bounds = calculateTightBounds(worldEntities as unknown as BoundsEntity[], false);
  const base: Point2D = { x: bounds.min.x, y: bounds.min.y };
  const negBase = { x: -base.x, y: -base.y };

  // Bake base → origin: ΙΔΙΟ μονοπάτι με createBlockInstance — το translateEntityByAnchor επιστρέφει
  // ΜΟΝΟ τα αλλαγμένα geometry fields, οπότε τα κάνουμε merge πάνω στο member.
  const localMembers: Entity[] = worldEntities.map(
    (m) =>
      ({
        ...m,
        ...translateEntityByAnchor(m, negBase),
        id: generateEntityId(),
        selected: false,
      }) as Entity,
  );

  const boundsMm = computeBlockLocalBoundsMm(localMembers);
  if (!boundsMm) return null;

  return {
    def: { name, localMembers, boundsMm },
    base,
  };
}
