/**
 * 🔴 ADR-767 §11.2 — **Η ΓΕΦΥΡΑ**: πώς γεμίζει το `TableSourceContext` από τη ζωντανή σκηνή.
 *
 * ## Γιατί χρειάζεται δικό της αρχείο
 * Ο resolver είναι **καθαρός** επίτηδες (μηδέν store, μηδέν I/O) — αλλά κάποιος πρέπει να
 * ρωτήσει τη σκηνή, και **αυτός** είναι το μοναδικό ακάθαρτο σημείο ολόκληρης της
 * οικογένειας. Αν η ερώτηση γραφτεί σε τρία σημεία (ανανέωση · έλεγχος φρεσκάδας · φραγμός
 * εξαγωγής), τα τρία θα μπορούσαν κάποτε να ρωτήσουν **άλλη** επιφάνεια — και ο φραγμός θα
 * έκρινε με δεδομένα που ο πίνακας δεν είδε ποτέ.
 *
 * ## 🔴 `undefined` ≠ `[]` — και η γέφυρα δεν επιτρέπεται να τα ισοπεδώσει
 * Ο τύπος διακρίνει «κανείς δεν ρώτησε» (⇒ `source-unavailable` ⇒ **μπλοκάρει** την εξαγωγή)
 * από «η αποτύπωση δεν έχει σημεία» (⇒ έγκυρος **άδειος** πίνακας). Η γέφυρα **πάντα** ρωτά,
 * άρα επιστρέφει πάντα πίνακα — ενδεχομένως κενό. Αν επέστρεφε `undefined` σε κενή αποτύπωση,
 * ο φραγμός θα γινόταν θόρυβος σε **κάθε καθαρό έργο**.
 *
 * @see bim/table/binding/table-source-context.ts
 * @see systems/topography/deliverables/useSurveyExport.ts — ο υπάρχων καταναλωτής του store
 */

import { readTableSourceContext } from '../binding/table-source-context';
import * as TopoPointStore from '../../../systems/topography/TopoPointStore';
import type { TopoPoint } from '../../../systems/topography/topo-types';

jest.mock('../../../systems/topography/TopoPointStore', () => ({
  getTopoPoints: jest.fn(),
}));

const getTopoPoints = TopoPointStore.getTopoPoints as jest.MockedFunction<
  typeof TopoPointStore.getTopoPoints
>;

const P1: TopoPoint = { x: 1000, y: 2000, z: 3000, code: 'Κ1' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('readTableSourceContext — μία ερώτηση, ένας τόπος', () => {
  it('παίρνει τα σημεία από το ΥΠΑΡΧΟΝ store, χωρίς δεύτερο τρόπο', () => {
    getTopoPoints.mockReturnValue([P1]);

    expect(readTableSourceContext()).toEqual({ topoPoints: [P1] });
    expect(getTopoPoints).toHaveBeenCalledTimes(1);
  });

  it('🔴 ΚΕΝΗ ΑΠΟΤΥΠΩΣΗ ΔΙΝΕΙ `[]`, ΠΟΤΕ `undefined` — αλλιώς ο φραγμός γίνεται θόρυβος', () => {
    getTopoPoints.mockReturnValue([]);

    const context = readTableSourceContext();

    expect(context.topoPoints).toEqual([]);
    expect(context.topoPoints).toBeDefined();
  });

  it('δεν αντιγράφει: περνά αυτούσια την αναφορά του store (καμία δεύτερη αλήθεια)', () => {
    const points: readonly TopoPoint[] = [P1];
    getTopoPoints.mockReturnValue(points);

    expect(readTableSourceContext().topoPoints).toBe(points);
  });
});
