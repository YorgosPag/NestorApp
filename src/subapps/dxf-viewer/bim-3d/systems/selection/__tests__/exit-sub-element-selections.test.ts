/**
 * ADR-715 Φ2 — **ΕΝΑ drill-down τη φορά.** Η δικλείδα της αμοιβαίας αποκλειστικότητας.
 *
 * Το 3D έχει τρία «click-into» drill-downs (σκάλα / κιγκλίδωμα / Τμήμα κολώνας). Δύο ενεργά
 * ταυτόχρονα **δεν** ρίχνουν σφάλμα — απλώς το swatch routing του `PolygonMaterialPanel`
 * (first-match-wins) βάφει άλλο πράγμα από ό,τι βλέπει φωτισμένο ο χρήστης. Σιωπηλό, και σε
 * θαμμένη ζώνη σημαίνει **λάθος γραμμή επιμέτρησης**.
 *
 * Πριν το Φ2 η αποκλειστικότητα ήταν 7 χειροκίνητα ζευγάρια `clear()` μέσα στο pointer handler.
 * Εδώ κλειδώνεται ότι είναι **ένας** μηχανισμός, και ότι τον τιμούν και τα τρία stores.
 *
 * @see ../exit-sub-element-selections.ts
 */

import {
  exitSubElementSelections,
  hasSubElementSelection,
} from '../exit-sub-element-selections';
import { useStairSubElementSelectionStore } from '../../../../bim/stairs/stair-sub-element-selection-store';
import { useRailingComponentSelectionStore } from '../../../../bim/railings/railing-component-selection-store';
import {
  useBuriedPartSelectionStore,
  getSelectedBuriedPart,
} from '../../../../bim/parts/buried-part-selection-store';

/** Γεμίζει ΚΑΙ τα τρία stores — η κατάσταση που ο μηχανισμός οφείλει να αδειάσει ολόκληρη. */
function fillAllThree(): void {
  useStairSubElementSelectionStore.getState().selectSub({ stairId: 's1', part: 'tread', index: 2 });
  useRailingComponentSelectionStore.getState().selectComponent({ railingId: 'r1', component: 'rail' });
  useBuriedPartSelectionStore.getState().selectPart('col_1');
}

beforeEach(() => {
  exitSubElementSelections();
});

describe('ADR-715 Φ2 — exitSubElementSelections', () => {
  it('αδειάζει ΚΑΙ τα τρία stores με μία κλήση', () => {
    fillAllThree();
    expect(hasSubElementSelection()).toBe(true);
    exitSubElementSelections();
    expect(useStairSubElementSelectionStore.getState().selected).toBeNull();
    expect(useRailingComponentSelectionStore.getState().selected).toBeNull();
    expect(getSelectedBuriedPart()).toBeNull();
    expect(hasSubElementSelection()).toBe(false);
  });

  it('είναι idempotent (κλήση σε καθαρή κατάσταση = no-op, χωρίς σφάλμα)', () => {
    exitSubElementSelections();
    exitSubElementSelections();
    expect(hasSubElementSelection()).toBe(false);
  });

  it('`hasSubElementSelection` ανιχνεύει ΚΑΘΕΝΑ από τα τρία μόνο του', () => {
    // Αν ξεχαστεί store στο `hasSubElementSelection`, ένα gate που το χρησιμοποιεί ως «είμαστε
    // μέσα σε υπο-στοιχείο;» θα απαντούσε λάθος για εκείνο το drill-down.
    useStairSubElementSelectionStore.getState().selectSub({ stairId: 's1', part: 'riser', index: 0 });
    expect(hasSubElementSelection()).toBe(true);
    exitSubElementSelections();

    useRailingComponentSelectionStore.getState().selectComponent({ railingId: 'r1', component: 'post' });
    expect(hasSubElementSelection()).toBe(true);
    exitSubElementSelections();

    useBuriedPartSelectionStore.getState().selectPart('col_9');
    expect(hasSubElementSelection()).toBe(true);
  });

  it('το μοτίβο «exit → enter» αφήνει ΑΚΡΙΒΩΣ ένα ενεργό (ο ζωντανός κλάδος)', () => {
    fillAllThree();
    exitSubElementSelections();
    useBuriedPartSelectionStore.getState().selectPart('col_7');
    expect(getSelectedBuriedPart()).toEqual({ columnId: 'col_7' });
    expect(useStairSubElementSelectionStore.getState().selected).toBeNull();
    expect(useRailingComponentSelectionStore.getState().selected).toBeNull();
  });
});

describe('ADR-715 — buried-part-selection-store', () => {
  it('κενό columnId ΔΕΝ γίνεται επιλογή (ανώνυμο Τμήμα δεν καθαρίζεται ποτέ από lifecycle guard)', () => {
    useBuriedPartSelectionStore.getState().selectPart('');
    expect(getSelectedBuriedPart()).toBeNull();
  });

  it('δεύτερη επιλογή αντικαθιστά την πρώτη (ένα Τμήμα τη φορά, όχι multi)', () => {
    useBuriedPartSelectionStore.getState().selectPart('col_1');
    useBuriedPartSelectionStore.getState().selectPart('col_2');
    expect(getSelectedBuriedPart()).toEqual({ columnId: 'col_2' });
  });
});
