/**
 * Ο ΚΑΘΑΡΟΣ πυρήνας του επανυπολογισμού ενώσεων τοίχων (ADR-363 Phase 1E / 1L-J): σβήνει τα
 * τέσσερα πεδία ένωσης (`startMiter`/`endMiter`/`startBevel`/`endBevel`) από ΚΑΘΕ τοίχο,
 * ξαναϋπολογίζει από την τρέχουσα γεωμετρία + τις ρητές παρακάμψεις ένωσης, και τα εφαρμόζει.
 * Συνάρτηση ΜΟΝΟ των οντοτήτων — το αποτέλεσμα δεν εξαρτάται από το τι ένωση είχε ο τοίχος πριν.
 *
 * Γιατί «σβήσε πρώτα»: το `applyTrimPatches` μόνο ΠΡΟΣΘΕΤΕΙ. Τοίχος που δεν λοξοτομεί ΠΙΑ
 * (ο γείτονας διαγράφηκε, απορροφήθηκε σε ενωμένο τοίχο, ή το άκρο του μετακινήθηκε) θα κρατούσε
 * παγωμένη τη λοξοτομή του.
 *
 * Δύο καταναλωτές, ένα αποτέλεσμα:
 *   · `recomputeWallTrims` (`add-wall-to-scene.ts`) — μετά από διαγραφή τοίχου / grip commit /
 *     αλλαγή παράκαμψης ένωσης· γράφει στη σκηνή και ξανασώζει.
 *   · `planOpeningWrite` (ADR-911 Φ4-2) — το σχέδιο εγγραφής ανοιγμάτων ενώνει και επεκτείνει
 *     τοίχους. Με τον ΙΔΙΟ πυρήνα καταλήγει ακριβώς εκεί που θα κατέληγε το
 *     `recomputeWallTrimsAfterDelete` του persistence hook ⇒ εκείνο δεν έχει τίποτα να αλλάξει.
 *
 * Ζει χωριστά από το `add-wall-to-scene.ts` ώστε ένας καθαρός σχεδιασμός να ΜΗΝ σέρνει το
 * γράφημα του command history.
 */

import type { AnySceneEntity } from '../../types/entities';
import { isWallEntity } from '../../types/entities';
import { computeWallGeometry } from '../geometry/wall-geometry';
import type { WallEntity, WallParams } from '../types/wall-types';
import { applyTrimPatches, collectColumnFootprints, computeWallTrims } from './wall-trims';

export function retrimWallEntities(entities: readonly AnySceneEntity[]): AnySceneEntity[] {
  // Strip all existing trim data from every wall before the fresh recompute. This clears
  // miter patches that referred to endpoints which no longer exist (deleted / merged / moved).
  const stripped = entities.map((e) => {
    if (!isWallEntity(e)) return e;
    const { startMiter, endMiter, startBevel, endBevel, ...rest } = e.params;
    if (!startMiter && !endMiter && !startBevel && !endBevel) return e;
    // The four trim fields are destructured out; rest is a valid subset of WallParams.
    const cleanParams = rest as WallParams;
    return {
      ...e,
      params: cleanParams,
      geometry: computeWallGeometry(cleanParams, e.kind),
    } as WallEntity;
  });
  const trims = computeWallTrims(stripped.filter(isWallEntity), collectColumnFootprints(stripped));
  return applyTrimPatches(stripped, trims);
}
