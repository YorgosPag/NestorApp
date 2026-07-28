/**
 * ADR-722 — ΤΟ ΑΓΚΙΣΤΡΟ ΤΟΥ ΞΑΝΑ-ΨΗΣΙΜΑΤΟΣ: αντικατάσταση, και ποιος κατέχει τη θέση.
 *
 * Τρία πράγματα καρφώνονται εδώ, και κανένα δεν είναι «τα νούμερα βγαίνουν»:
 *
 *   1. **Η ομάδα αντικαθίσταται, δεν στοιβάζεται.** Το δεύτερο ψήσιμο σχεδιάζει την αφαίρεση
 *      ΟΛΩΝ των υπαρχουσών οντοτήτων της ομάδας — συμπεριλαμβανομένων των **legacy**, που είναι
 *      ακριβώς αυτές που κάθονται σε άγνωστο πλαίσιο και τις οποίες η σφραγίδα θα ισχυριζόταν
 *      ψευδώς ότι περιγράφει.
 *   2. **`placement: 'user'` ⇒ η τοποθέτηση του χρήστη επιβιώνει.** Ο βορράς που ο χρήστης
 *      έσυρε στη γωνιά του φύλλου δεν επιστρέφει στο άγκιστρο. Με **αρνητικό μάρτυρα**: η ίδια
 *      ακριβώς κατάσταση σε ομάδα `derived` ΟΦΕΙΛΕΙ να επιστρέψει στην προεπιλεγμένη θέση —
 *      αλλιώς ο έλεγχος θα ήταν πράσινος και για έναν σχεδιαστή που δεν μετακινεί ποτέ τίποτα.
 *   3. **Το πρώτο ψήσιμο δεν πληρώνει τίποτα.** Καμία υπάρχουσα οντότητα ⇒ **η ίδια αναφορά**
 *      πίνακα (όχι απλώς ίση): ο συνήθης δρόμος δεν αντιγράφει γεωμετρία για χάρη μιας
 *      δυνατότητας που αφορά το *δεύτερο* πάτημα του κουμπιού.
 */

import { planBakedUpsert } from '../topo-bake-upsert';
import { TOPO_GRID_LAYER_NAME } from '../topo-grid-config';
import { TOPO_NORTH_LAYER_NAME } from '../north-arrow-config';
import { TOPO_POINT_ELEV_LAYER_NAME } from '../topo-point-label-config';
import { createSceneLayer } from '../../../types/scene-types';
import type { Entity } from '../../../types/entities';
import type { SceneModel, AnySceneEntity } from '../../../types/scene';
import type { Point2D } from '../../../rendering/types/Types';

const gridLayer = createSceneLayer({ name: TOPO_GRID_LAYER_NAME, color: '#5B6B7B', visible: true, locked: false });
const northLayer = createSceneLayer({ name: TOPO_NORTH_LAYER_NAME, color: '#1A1A1A', visible: true, locked: false });
const elevLayer = createSceneLayer({ name: TOPO_POINT_ELEV_LAYER_NAME, color: '#1A1A1A', visible: true, locked: false });
const wallLayer = createSceneLayer({ name: 'A-WALL', color: '#000000', visible: true, locked: false });

function makeScene(entities: AnySceneEntity[]): SceneModel {
  const layersById: Record<string, ReturnType<typeof createSceneLayer>> = {};
  for (const l of [gridLayer, northLayer, elevLayer, wallLayer]) layersById[l.id] = l;
  return {
    entities,
    layersById: layersById as unknown as SceneModel['layersById'],
    bounds: { min: { x: 0, y: 0 }, max: { x: 1000, y: 1000 } },
    units: 'mm',
  } as SceneModel;
}

const line = (id: string, layerId: string, start: Point2D, end: Point2D): AnySceneEntity =>
  ({ id, type: 'line', layerId, start, end }) as unknown as AnySceneEntity;

/** Το ίδιο σχήμα ως **φρέσκο** προϊόν παραγωγού (δηλαδή `Entity`, όχι σκηνής). */
const freshLine = (id: string, layerId: string, start: Point2D, end: Point2D): Entity =>
  ({ id, type: 'line', layerId, start, end }) as unknown as Entity;

describe('ADR-722 — η ομάδα ΑΝΤΙΚΑΘΙΣΤΑΤΑΙ, δεν στοιβάζεται', () => {
  it('πρώτο ψήσιμο: τίποτα να αντικατασταθεί, ΤΟ ΙΔΙΟ αντικείμενο πίνακα (μηδέν κόστος)', () => {
    const fresh = [freshLine('new_1', gridLayer.id, { x: 0, y: 0 }, { x: 100, y: 0 })];
    const plan = planBakedUpsert(makeScene([]), 'grid', fresh);
    expect(plan.replacedIds).toEqual([]);
    expect(plan.entities).toBe(fresh);
    expect(plan.userPlacementMm).toBeNull();
  });

  it('δεύτερο ψήσιμο: ΟΛΕΣ οι υπάρχουσες της ομάδας αντικαθίστανται', () => {
    const scene = makeScene([
      line('old_1', gridLayer.id, { x: 0, y: 0 }, { x: 100, y: 0 }),
      line('old_2', gridLayer.id, { x: 0, y: 100 }, { x: 100, y: 100 }),
    ]);
    const plan = planBakedUpsert(scene, 'grid', [
      freshLine('new_1', gridLayer.id, { x: 0, y: 0 }, { x: 200, y: 0 }),
    ]);
    expect(plan.replacedIds).toEqual(['old_1', 'old_2']);
  });

  it('🔴 οι LEGACY (ασφράγιστες) οντότητες είναι ΑΚΡΙΒΩΣ αυτές που καθαρίζονται', () => {
    // Αυτό είναι όλο το σφάλμα του Giorgio: 66 ετικέτες σε άγνωστο πλαίσιο, αόρατες, και μια
    // σφραγίδα από πάνω που ισχυριζόταν ότι όλη η ομάδα κάθεται στο ενεργό πλαίσιο.
    const scene = makeScene([
      line('legacy_1', elevLayer.id, { x: 0, y: 0 }, { x: 1, y: 0 }),
      line('legacy_2', elevLayer.id, { x: 5, y: 5 }, { x: 6, y: 5 }),
    ]);
    const plan = planBakedUpsert(scene, 'pointLabels', [
      freshLine('new_1', elevLayer.id, { x: 10, y: 10 }, { x: 11, y: 10 }),
    ]);
    expect(plan.replacedIds).toEqual(['legacy_1', 'legacy_2']);
  });

  it('οντότητες ΕΚΤΟΣ της ομάδας δεν αγγίζονται ποτέ (ούτε άλλης ψημένης ομάδας)', () => {
    const scene = makeScene([
      line('wall', wallLayer.id, { x: 0, y: 0 }, { x: 5000, y: 0 }),
      line('north_old', northLayer.id, { x: 0, y: 0 }, { x: 10, y: 0 }),
      line('grid_old', gridLayer.id, { x: 0, y: 0 }, { x: 100, y: 0 }),
    ]);
    const plan = planBakedUpsert(scene, 'grid', [
      freshLine('grid_new', gridLayer.id, { x: 0, y: 0 }, { x: 100, y: 0 }),
    ]);
    expect(plan.replacedIds).toEqual(['grid_old']);
  });

  it('σκηνή που δεν φορτώθηκε (null) ⇒ ταυτοτικό σχέδιο, καμία εικασία', () => {
    const fresh = [freshLine('n', gridLayer.id, { x: 0, y: 0 }, { x: 1, y: 0 })];
    expect(planBakedUpsert(null, 'grid', fresh)).toEqual({
      replacedIds: [], entities: fresh, userPlacementMm: null,
    });
  });
});

describe('ADR-722 — `placement`: ποιος κατέχει τη θέση', () => {
  /** Ο χρήστης έσυρε τον βορρά 250 m δεξιά και 120 m κάτω, στη γωνιά του φύλλου. */
  const USER_DRAG: Point2D = { x: 250_000, y: -120_000 };
  const ANCHOR: Point2D = { x: 1000, y: 2000 };

  const northAtAnchor = (id: string): AnySceneEntity =>
    line(id, northLayer.id, ANCHOR, { x: ANCHOR.x + 3000, y: ANCHOR.y + 6000 });
  const northDragged = (id: string): AnySceneEntity =>
    line(
      id, northLayer.id,
      { x: ANCHOR.x + USER_DRAG.x, y: ANCHOR.y + USER_DRAG.y },
      { x: ANCHOR.x + 3000 + USER_DRAG.x, y: ANCHOR.y + 6000 + USER_DRAG.y },
    );
  const freshNorth = (): Entity =>
    freshLine('north_fresh', northLayer.id, ANCHOR, { x: ANCHOR.x + 3000, y: ANCHOR.y + 6000 });

  it('🎯 `user` (βορράς): το ξανα-ψήσιμο ΣΕΒΕΤΑΙ το σύρσιμο του χρήστη', () => {
    const plan = planBakedUpsert(makeScene([northDragged('north_old')]), 'north', [freshNorth()]);

    expect(plan.userPlacementMm?.x).toBeCloseTo(USER_DRAG.x, 6);
    expect(plan.userPlacementMm?.y).toBeCloseTo(USER_DRAG.y, 6);
    const placed = plan.entities[0] as unknown as { start: Point2D };
    expect(placed.start.x).toBeCloseTo(ANCHOR.x + USER_DRAG.x, 6);
    expect(placed.start.y).toBeCloseTo(ANCHOR.y + USER_DRAG.y, 6);
  });

  it('`user` χωρίς σύρσιμο: μηδενική μετατόπιση ⇒ ΤΟ ΙΔΙΟ αντικείμενο πίνακα', () => {
    const fresh = [freshNorth()];
    const plan = planBakedUpsert(makeScene([northAtAnchor('north_old')]), 'north', fresh);
    expect(plan.userPlacementMm).toBeNull();
    expect(plan.entities).toBe(fresh);
  });

  it('ΑΡΝΗΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: ομάδα `derived` ΟΝΤΩΣ επιστρέφει στην προεπιλεγμένη θέση', () => {
    // Ίδια ακριβώς κατάσταση — μια σερνόμενη υπάρχουσα οντότητα — αλλά σε ομάδα της οποίας τη
    // θέση κατέχει ο παραγωγός. Αν ΚΑΙ εδώ διατηρούνταν το σύρσιμο, η ετικέτα ενός σημείου που
    // μετακινήθηκε δεν θα το ακολουθούσε ποτέ.
    const dragged = line(
      'grid_old', gridLayer.id,
      { x: ANCHOR.x + USER_DRAG.x, y: ANCHOR.y + USER_DRAG.y },
      { x: ANCHOR.x + 3000 + USER_DRAG.x, y: ANCHOR.y + 6000 + USER_DRAG.y },
    );
    const fresh = [freshLine('grid_new', gridLayer.id, ANCHOR, { x: ANCHOR.x + 3000, y: ANCHOR.y + 6000 })];
    const plan = planBakedUpsert(makeScene([dragged]), 'grid', fresh);

    expect(plan.userPlacementMm).toBeNull();
    expect(plan.entities).toBe(fresh);
    expect((plan.entities[0] as unknown as { start: Point2D }).start.x).toBeCloseTo(ANCHOR.x, 6);
  });

  it('`user` με ΑΛΛΑΓΜΕΝΟ σχήμα (νέα γωνία βορρά): το κέντρο κρατά τη θέση, όχι η γωνία', () => {
    // Το ελάχιστο άκρο ενός στραμμένου σχήματος μετακινείται με τη στροφή· αν το σημείο
    // αναφοράς ήταν η γωνία των ορίων, η αλλαγή γωνίας θα καταγραφόταν ως «σύρσιμο» και το
    // σύμβολο θα μετακινούνταν λίγο σε ΚΑΘΕ ξανα-ψήσιμο (ερπυσμός).
    const center: Point2D = { x: ANCHOR.x + 1500, y: ANCHOR.y + 3000 };
    const old = line(
      'north_old', northLayer.id,
      { x: center.x - 3000, y: center.y - 1500 },  // «οριζόντιο» σχήμα, ίδιο κέντρο
      { x: center.x + 3000, y: center.y + 1500 },
    );
    const plan = planBakedUpsert(makeScene([old]), 'north', [freshNorth()]);
    expect(plan.userPlacementMm).toBeNull(); // ίδιο κέντρο ⇒ ο χρήστης δεν το μετακίνησε
  });
});
