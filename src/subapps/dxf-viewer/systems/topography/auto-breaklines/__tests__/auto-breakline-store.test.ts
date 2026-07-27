/**
 * ADR-650 M8β/Γ — auto-breakline review store: ΕΓΚΡΙΣΗ και ΕΣΤΙΑΣΗ είναι δύο ανεξάρτητα πράγματα.
 *
 * Το store κρατά δύο σημάνσεις ανά υποψήφια που μοιάζουν αλλά δεν είναι: το `selected` (τικ =
 * «θα γραφτεί») και το `focusedId` (κλικ στη γραμμή = «αυτήν κοιτάω»). Αν μπλεχτούν, το σφάλμα
 * είναι **δεδομένων**: ένα κλικ για να δει κάποιος μια υποψήφια θα την πρόσθετε — ή θα την
 * αφαιρούσε — από ό,τι γράφεται στην αποτύπωση, σιωπηλά, χωρίς κανένα type error. Γι' αυτό οι
 * έλεγχοι εδώ καρφώνουν την ΑΝΕΞΑΡΤΗΣΙΑ τους, όχι τα setters χωριστά.
 *
 * Καρφώνουν επίσης δύο ακόμη συμβόλαια που δεν είναι προφανή διαβάζοντας τον κώδικα:
 *   - το `report` περνά by REFERENCE σε κάθε `focus`, αλλιώς το 3Δ layer θα ξανα-προβάλλει κάθε
 *     υποψήφια σε κάθε κλικ (και το `sameInputs` του θα ήταν διακοσμητικό)·
 *   - ένα νέο πάσο ΜΗΔΕΝΙΖΕΙ την εστίαση: τα ids είναι per-report review keys.
 */

import {
  autoBreaklineStore,
  subscribeAutoBreakline,
} from '../auto-breakline-store';
import type { AutoBreaklineCandidate, AutoBreaklineReport } from '../auto-breakline-types';

function candidate(id: string): AutoBreaklineCandidate {
  return {
    id,
    vertices: [{ x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 100 }],
    closed: false,
    lengthMm: 1000,
    avgFoldDeg: 40,
    edgeCount: 1,
  };
}

function report(...ids: string[]): AutoBreaklineReport {
  return {
    surfaceId: 'existing',
    candidates: ids.map(candidate),
    droppedByCap: 0,
    notEnoughData: false,
  };
}

describe('ADR-650 M8β/Γ — auto-breakline review store', () => {
  beforeEach(() => autoBreaklineStore.reset());

  it('arrives with every candidate approved and NOTHING focused', () => {
    autoBreaklineStore.setReport(report('a', 'b'));
    const state = autoBreaklineStore.get();
    expect([...state.selected].sort()).toEqual(['a', 'b']);
    expect(state.focusedId).toBeNull();
  });

  it('focusing a row does not touch approval', () => {
    autoBreaklineStore.setReport(report('a', 'b'));
    autoBreaklineStore.toggle('a'); // ο μηχανικός απέρριψε την «a»
    autoBreaklineStore.focus('a');  // …και μετά την πάτησε για να τη δει

    const state = autoBreaklineStore.get();
    expect(state.focusedId).toBe('a');
    expect(state.selected.has('a')).toBe(false); // ΠΑΡΑΜΕΝΕΙ απορριφθείσα
  });

  it('ticking a row does not move the focus', () => {
    autoBreaklineStore.setReport(report('a', 'b'));
    autoBreaklineStore.focus('a');
    autoBreaklineStore.toggle('b');
    expect(autoBreaklineStore.getFocusedId()).toBe('a');

    autoBreaklineStore.setAll(false);
    expect(autoBreaklineStore.getFocusedId()).toBe('a');
    expect(autoBreaklineStore.get().selected.size).toBe(0);
  });

  it('passes the report through by reference on focus (the 3D layer memoises on it)', () => {
    const r = report('a', 'b');
    autoBreaklineStore.setReport(r);
    const before = autoBreaklineStore.get();
    autoBreaklineStore.focus('b');
    const after = autoBreaklineStore.get();

    expect(after.report).toBe(before.report);
    expect(after.selected).toBe(before.selected);
  });

  it('a fresh pass drops the focus (ids are per-report review keys)', () => {
    autoBreaklineStore.setReport(report('a'));
    autoBreaklineStore.focus('a');
    autoBreaklineStore.setReport(report('a', 'b'));
    expect(autoBreaklineStore.getFocusedId()).toBeNull();
  });

  it('Clear drops everything', () => {
    autoBreaklineStore.setReport(report('a'));
    autoBreaklineStore.focus('a');
    autoBreaklineStore.reset();
    expect(autoBreaklineStore.get()).toEqual({ report: null, selected: new Set(), focusedId: null });
  });

  it('notifies non-React subscribers on a focus change (the 3D layer has no React tree)', () => {
    const seen: (string | null)[] = [];
    const off = subscribeAutoBreakline(() => seen.push(autoBreaklineStore.getFocusedId()));
    autoBreaklineStore.setReport(report('a', 'b'));
    autoBreaklineStore.focus('b');
    off();
    autoBreaklineStore.focus('a'); // μετά το unsubscribe — δεν πρέπει να καταγραφεί

    expect(seen).toEqual([null, 'b']);
  });
});
