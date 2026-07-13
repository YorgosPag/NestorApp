/**
 * Block Library — capture wiring (Milestone 1). Ο ΜΟΝΟΣ side-effectful συνδετής μεταξύ του
 * import και του in-session registry: μετά από κάθε import, εντοπίζει τα distinct named blocks
 * της σκηνής, υπολογίζει ΜΙΑ φορά τα BLOCK-LOCAL bounds τους, και τα κάνει upsert στο registry.
 *
 * Upsert (όχι replace) → η session βιβλιοθήκη «Τα Blocks μου» ΜΕΓΑΛΩΝΕΙ σε διαδοχικά imports
 * (Revit-like), και είναι idempotent (ίδιο import ξανά = ίδιο αποτέλεσμα, last-wins ανά name).
 *
 * Καθαρός διαχωρισμός ευθυνών: το pure `captureBlockDefsFromScene` παραμένει side-effect-free
 * (& tested)· εδώ ζει η ενορχήστρωση (bounds enrichment + store write).
 *
 * @see ./capture-blocks-from-scene.ts — pure scan (distinct named defs)
 * @see ./block-local-bounds.ts — bounds SSoT reuse
 * @see ./block-library-registry.ts — in-session store
 */

import type { Entity } from '../../types/entities';
import { captureBlockDefsFromScene } from './capture-blocks-from-scene';
import { computeBlockLocalBoundsMm } from './block-local-bounds';
import { upsertSessionBlockDef } from './block-library-registry';

/**
 * Εντοπίζει τα named blocks του `entities` και τα προσθέτει (upsert) στο in-session registry,
 * με προϋπολογισμένα `boundsMm`. No-op όταν δεν υπάρχουν επαναχρησιμοποιήσιμα blocks.
 */
export function captureSessionBlocksFromScene(entities: readonly Entity[]): void {
  for (const def of captureBlockDefsFromScene(entities)) {
    upsertSessionBlockDef({
      ...def,
      boundsMm: def.boundsMm ?? computeBlockLocalBoundsMm(def.localMembers),
    });
  }
}
