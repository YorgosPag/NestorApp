'use client';

/**
 * ADR-833 Φάση 3 — **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΟΝΤΟΤΗΤΑΣ ΧΩΡΙΣ ΙΣΤΟΡΙΚΟ**: μπάλωμα πάνω στη ζωντανή
 * οντότητα του ορόφου, χωρίς `UpdateEntityCommand`, χωρίς βήμα αναίρεσης.
 *
 * ## Γιατί βγήκε από το `use-table-scene-writers.ts`
 * Το σώμα ζούσε εκεί ως ιδιωτικό `useCallback` (`previewPatch`) και τον χρειάζονταν **μόνο**
 * καταναλωτές που είναι hooks. Η αλλαγή καρτέλας (ADR-833 Φ3) είναι ο πρώτος καταναλωτής που
 * **δεν** περνά από εκείνο το hook: ζει στον ακροατή των οπλισμένων χειριστηρίων, δίπλα στα
 * `⊕`/`⊖`, ο οποίος έχει `levelManager` και τίποτε άλλο.
 *
 * Ένα αντίγραφο εκεί θα ήταν ο sibling clone του N.18 — και το ακριβό δεν είναι οι έξι
 * γραμμές: είναι ότι **δύο** σημεία θα έπρεπε να θυμούνται τον ίδιο κανόνα, γραμμένο ήδη μία
 * φορά και επαληθευμένο: *«νέο αντικείμενο οντότητας ⇒ οι απομνημονεύσεις της διάταξης
 * ακυρώνονται από μόνες τους»*. Το δεύτερο αντίγραφο είναι πάντα εκείνο που θα ξεχάσει γιατί.
 *
 * ⚠️ **Καθαρή μετακίνηση**: το σώμα ήρθε αυτούσιο. Δεν είναι hook — δεν χρειάζεται να είναι:
 * ο `levelManager` έρχεται ως όρισμα, και οι δύο καλούντες τον έχουν ήδη.
 *
 * @module subapps/dxf-viewer/ui/table-cell-editor/table-scene-patch
 * @see ui/table-cell-editor/use-table-scene-writers.ts — ο πρώτος καταναλωτής (προεπισκοπήσεις)
 * @see ui/table-cell-editor/use-table-worksheet-tab-click.ts — ο δεύτερος (αλλαγή καρτέλας)
 */

import type { LevelManagerLike } from '../../hooks/canvas/canvas-click-types';
import type { TableEntity } from '../../types/table-entity';

/**
 * Γράφει τα πεδία του `patch` πάνω στην οντότητα **μέσα στη σκηνή του τρέχοντος ορόφου**.
 *
 * No-op όταν δεν υπάρχει όροφος, γραφέας ή σκηνή — τρεις σιωπές που σημαίνουν όλες «ο κόσμος
 * άλλαξε από κάτω μας» (αλλαγή επιπέδου, κλείσιμο viewer) και καμία από τις οποίες δεν είναι
 * σφάλμα του καλούντος.
 */
export function applyTableScenePatch(
  levelManager: LevelManagerLike,
  entity: TableEntity,
  patch: Partial<TableEntity>,
): void {
  const { currentLevelId, getLevelScene, setLevelScene } = levelManager;
  if (!currentLevelId || !setLevelScene) return;
  const scene = getLevelScene(currentLevelId);
  if (!scene) return;
  setLevelScene(currentLevelId, {
    ...scene,
    entities: scene.entities.map((e) => (e.id === entity.id ? { ...entity, ...patch } : e)),
  });
}
