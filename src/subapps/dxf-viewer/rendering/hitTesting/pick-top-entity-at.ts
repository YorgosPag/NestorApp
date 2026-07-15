/**
 * ADR-650 M2-Β (κεντρικοποίηση N.0.2/N.18) — ο **world-coords topmost pick SSoT**.
 *
 * Ένα ερώτημα: «ποια οντότητα (από ένα υποσύνολο) βρίσκεται κάτω από αυτό το world
 * σημείο, με την ΠΑΝΩ-ΠΑΝΩ να κερδίζει;». Χτίζεται πάνω στο `performDetailedHitTest`
 * (ο per-entity hit-test SSoT — ίδια γεωμετρία με τους renderers· μηδέν νέα μαθηματικά)
 * και σαρώνει **αντίστροφα**, επειδή τα τελευταία entities της σκηνής ζωγραφίζονται
 * από πάνω.
 *
 * Γιατί ξεχωριστό από το screen-coords `HitTestingService`: το click-select ΚΑΙ το
 * hover-highlight εργαλείων τρέχουν σε σημεία που είναι ΗΔΗ world (snapped), χωρίς
 * transform/viewport στο χέρι. Linear scan — bulletproof, χωρίς εξάρτηση από το
 * spatial-index sync.
 *
 * Το `predicate` είναι το φίλτρο «τι κυνηγάει το εργαλείο» (π.χ. μόνο γραμμοσκιάσεις,
 * μόνο γραμμικές οντότητες), ώστε το pick να ΜΗΝ «κλέβεται» από υπερκείμενες οντότητες
 * άλλου τύπου.
 *
 * @see ./hit-test-entity-tests — performDetailedHitTest (per-entity SSoT)
 * @see ../../bim/hatch/hatch-pick-at — hatch-only delegate (ADR-507)
 * @see ../../systems/topography/topo-breakline-pick — breakline delegate (ADR-650)
 */

import type { Point2D } from '../types/Types';
import type { Entity } from '../../types/entities';
import { performDetailedHitTest } from './hit-test-entity-tests';
import { isPointInsideClosedEntity } from './enclosure-hit';

/** Opt-in εκτροπές του pick (default = big-player stroke-only). */
export interface PickTopOptions {
  /**
   * Δέξου ΕΠΙΠΛΕΟΝ «κλικ ΜΕΣΑ» σε κλειστή περιοχή (`enclosure-hit`) — ρητή δυνατότητα για εργαλεία
   * που τη θέλουν (π.χ. επιλογή ορίου οικοπέδου, ADR-650 M6: κλικ οπουδήποτε μέσα στο οικόπεδο
   * επιλέγει το κλειστό όριο). Η ΓΕΝΙΚΗ επιλογή/hover την αφήνει `false` → stroke-only, ώστε
   * ομόκεντρα κλειστά σχήματα (π.χ. ισοϋψείς) να μην «καταπίνονται» από τον εξωτερικό δακτύλιο.
   */
  readonly includeEnclosure?: boolean;
}

/**
 * Id της κορυφαίας οντότητας που περνά το `predicate` ΚΑΙ δέχεται hit στο `worldPoint`, ή `null`.
 * Topmost-first (αντίστροφη σάρωση = z-order). Default = **stroke-only** (big-player: τα κλειστά
 * wireframe επιλέγονται από το περίγραμμα)· `includeEnclosure` προσθέτει το opt-in inside-hit.
 */
export function pickTopEntityAt(
  worldPoint: Point2D,
  entities: readonly Entity[],
  predicate: (entity: Entity) => boolean,
  tolerance = 0,
  opts: PickTopOptions = {},
): string | null {
  for (let i = entities.length - 1; i >= 0; i--) {
    const entity = entities[i];
    if (!predicate(entity)) continue;
    if (performDetailedHitTest(entity, worldPoint, tolerance) !== null) return entity.id;
    if (opts.includeEnclosure && isPointInsideClosedEntity(entity, worldPoint)) return entity.id;
  }
  return null;
}
