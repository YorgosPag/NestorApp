/**
 * ADR-729 — Η ΠΑΡΑΓΩΓΙΚΗ ΔΙΑΔΡΟΜΗ: `completeEntities` N οντοτήτων = **ΑΚΡΙΒΩΣ 1 εγγραφή**.
 *
 * Το `atomic-undo-group.test.ts` κλειδώνει τον **μηχανισμό** (`runAsSingleUndo`). Εδώ κλειδώνεται
 * ότι ο μηχανισμός είναι όντως **συνδεδεμένος** στη ΜΙΑ ραφή απ' όπου περνούν υποχρεωτικά όλοι
 * οι παραγωγοί παρτίδας (ADR-057 SSoT) — αλλιώς η εγγύηση θα ήταν διαθέσιμη αλλά αχρησιμοποίητη,
 * που είναι ακριβώς το σχήμα «anchor χωρίς gate = σχόλιο».
 *
 * Τρέχει με **πραγματική** σκηνή στη μνήμη και **πραγματικό** `CommandHistory` — όχι mocks: το
 * ζητούμενο είναι η συμπεριφορά ολόκληρης της αλυσίδας
 * `completeEntities → completeEntity → CreateEntityCommand → CommandHistory`.
 */

import { completeEntities } from '../completeEntity';
import { getGlobalCommandHistory, resetGlobalCommandHistory } from '../../../core/commands/CommandHistory';
import { createSceneLayer } from '../../../types/scene-types';
import type { Entity } from '../../../types/entities';
import type { SceneModel } from '../../../types/scene';

const LEVEL_ID = 'flr_test';
const layer = createSceneLayer({ name: '0', color: '#FFFFFF', visible: true, locked: false });

function makeScene(): SceneModel {
  return {
    entities: [],
    layersById: { [layer.id]: layer } as unknown as SceneModel['layersById'],
    bounds: { min: { x: 0, y: 0 }, max: { x: 1000, y: 1000 } },
    units: 'mm',
  } as SceneModel;
}

function lineEntity(i: number): Entity {
  return {
    id: `ent_${i}`,
    type: 'line',
    layerId: layer.id,
    visible: true,
    start: { x: i, y: 0 },
    end: { x: i, y: 100 },
  } as unknown as Entity;
}

describe('ADR-729 — completeEntities: μια ενέργεια χρήστη = μια αναίρεση', () => {
  let scene: SceneModel;

  const getScene = (): SceneModel => scene;
  const setScene = (_levelId: string, next: SceneModel): void => { scene = next; };

  const complete = (count: number): void => {
    completeEntities(
      Array.from({ length: count }, (_, i) => lineEntity(i)),
      { tool: 'line', levelId: LEVEL_ID, getScene, setScene },
    );
  };

  beforeEach(() => {
    resetGlobalCommandHistory();
    scene = makeScene();
  });
  afterEach(() => { resetGlobalCommandHistory(); });

  /**
   * 🔴 ΤΟ ΠΑΡΑΔΟΤΕΟ. Ζωντανή μέτρηση 2026-07-29: 186 ετικέτες → 187 εγγραφές σε ταβάνι 100.
   * Εδώ 186 οντότητες → **1**. Αφαίρεσε την εμβέλεια από το `completeEntities` και σκάει.
   */
  it('186 οντότητες → ΑΚΡΙΒΩΣ 1 εγγραφή ιστορικού (ήταν 186)', () => {
    complete(186);
    expect(getGlobalCommandHistory().size()).toBe(1);
    expect(scene.entities).toHaveLength(186);
  });

  it('ΜΙΑ αναίρεση αδειάζει ΟΛΗ την παρτίδα — καμία ορφανή οντότητα', () => {
    complete(186);
    expect(getGlobalCommandHistory().undo()).toBe(true);
    expect(scene.entities).toHaveLength(0); // ήταν: 86 ορφανές έμεναν πίσω
    expect(getGlobalCommandHistory().canUndo()).toBe(false);
  });

  it('redo επαναφέρει ΟΛΗ την παρτίδα με ΕΝΑ βήμα', () => {
    complete(186);
    const history = getGlobalCommandHistory();
    history.undo();
    expect(history.redo()).toBe(true);
    expect(scene.entities).toHaveLength(186);
  });

  /**
   * 🔴 Η ΣΟΒΑΡΗ ΣΥΝΕΠΕΙΑ: πριν τη διόρθωση, μια παρτίδα > `maxHistorySize` έσβηνε ΟΛΟ το
   * προηγούμενο ιστορικό της συνεδρίας — ο χρήστης έχανε **άσχετη** δουλειά.
   */
  it('παρτίδα 186 δεν σαρώνει προηγούμενη άσχετη δουλειά (ταβάνι = 100 ΕΝΕΡΓΕΙΕΣ)', () => {
    const history = getGlobalCommandHistory();
    completeEntities([lineEntity(9001)], { tool: 'line', levelId: LEVEL_ID, getScene, setScene });
    const sizeAfterEarlierWork = history.size();
    expect(sizeAfterEarlierWork).toBe(1);

    complete(186);

    expect(history.size()).toBe(2); // η παλιά δουλειά + η παρτίδα — ΟΧΙ 100 (κορεσμός)
    history.undo(); // η παρτίδα
    expect(history.undo()).toBe(true); // …και η παλιά δουλειά είναι ΑΚΟΜΑ αναστρέψιμη
    expect(scene.entities).toHaveLength(0);
  });

  it('μονή οντότητα μέσω completeEntities → 1 εγγραφή (καμία αλλαγή συμπεριφοράς)', () => {
    complete(1);
    expect(getGlobalCommandHistory().size()).toBe(1);
    expect(scene.entities).toHaveLength(1);
  });

  it('άδεια παρτίδα → καμία εγγραφή-φάντασμα', () => {
    complete(0);
    expect(getGlobalCommandHistory().size()).toBe(0);
  });
});
