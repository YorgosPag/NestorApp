/**
 * ADR-441 — Foundation top-level derivation (SSoT, scene-read).
 *
 * ΕΝΑΣ τόπος που διαβάζει τη **στάθμη θεμελίωσης** μιας σκηνής = το `topElevationMm`
 * των φερόντων footings (πεδιλοδοκοί `strip` / μεμονωμένα πέδιλα `pad`). Καταναλώνεται
 * από:
 *   - την **εδαφόπλακα** (`slab-grid-commit`) → top της κοιτόστρωσης στη στάθμη θεμελίωσης
 *   - τις **κολώνες από κάναβο** (`column-from-grid`) → βάση κολώνας κατεβαίνει στη
 *     θεμελίωση (στατική συνέχεια — η κολώνα πατά στον πεδιλοδοκό, όχι στο δάπεδο)
 *
 * Οι **συνδετήριες** (`tie-beam`) εξαιρούνται: κάθονται ψηλότερα (Eurocode 8), δεν είναι
 * το footing όπου εδράζεται η κολώνα/κοιτόστρωση. `min` = το βαθύτερο footing top (το
 * χαμηλότερο σημείο έδρασης) → καμία οντότητα δεν «κρέμεται» πάνω από το θεμέλιο.
 *
 * @see ./foundation-types.ts — defaultFoundationTopElevationMm (fallback constant)
 * @see ../slabs/slab-grid-commit.ts — εδαφόπλακα consumer
 * @see ../columns/column-from-grid.ts — κολώνες consumer
 */

import { isFoundationEntity, type Entity } from '../../types/entities';

/**
 * Στάθμη άνω παρειάς (mm) των φερόντων footings (strip/pad) της σκηνής, ή `null` αν
 * δεν υπάρχει κανένα. Total/pure — μηδέν side-effects. Ο caller αποφασίζει το fallback
 * (εδαφόπλακα → SSoT default· κολώνες → καμία επέκταση).
 */
export function sceneFoundationTopMm(entities: readonly Entity[]): number | null {
  let top: number | null = null;
  for (const e of entities) {
    if (!isFoundationEntity(e)) continue;
    if (e.params.kind === 'strip' || e.params.kind === 'pad') {
      const t = e.params.topElevationMm;
      if (top === null || t < top) top = t;
    }
  }
  return top;
}
