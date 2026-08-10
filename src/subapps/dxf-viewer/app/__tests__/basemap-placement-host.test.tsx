/**
 * @jest-environment jsdom
 *
 * ΑΓΚΥΡΕΣ — ADR-782 §24: **ο κύκλος ζωής** της μόνιμης τοποθέτησης υποβάθρου (`Υ1`-`Υ6`).
 *
 * Το §21 έκλεισε το «κανείς δεν **γράφει**» και το §23 το «κανείς δεν **διαβάζει**». Εδώ το
 * ερώτημα είναι το τρίτο: **πότε** και **για ποιο έργο**. Οι δύο βλάβες που κλειδώνονται δεν
 * φαίνονται σε καμία οθόνη τη στιγμή που συμβαίνουν:
 *
 * - `Υ3` — η τοποθέτηση του **προηγούμενου** έργου επιβιώνει και μετακινεί τον χάρτη του επόμενου
 *   κατά την ίδια ακριβώς διόρθωση: λάθος που μοιάζει απόλυτα σωστό.
 * - `Υ4` — ο γραφέας συνδέεται **αφού** επιστρέψει η ανάγνωση, οπότε ένα σύρσιμο στο ενδιάμεσο
 *   φαίνεται να δουλεύει και **δεν αποθηκεύεται ποτέ**. Το παράθυρο δεν είναι θεωρητικό: το
 *   εργαλείο ξεκλειδώνει με την **άγκυρα**, που είναι άλλη ανάγνωση χωρίς εγγυημένη σειρά.
 */

import React from 'react';
import { render, act } from '@testing-library/react';

const mockLoad = jest.fn<Promise<unknown>, [string]>();
const mockPersist = jest.fn(async (_projectId: string, _geo: unknown) => {});

jest.mock('../../systems/basemap/basemap-placement-persistence', () => ({
  loadProjectBasemapPlacement: (projectId: string) => mockLoad(projectId),
  persistProjectBasemapPlacement: (projectId: string, geo: unknown) =>
    mockPersist(projectId, geo),
}));

import { BasemapPlacementHost } from '../BasemapPlacementHost';
import {
  getBasemapPlacement,
  resetBasemapPlacementStore,
  setBasemapPlacement,
} from '../../systems/basemap/basemap-placement-store';
import type { GeoReference } from '../../systems/geo-referencing/geo-transform';

const SAVED: GeoReference = { originWorld: { x: 410_527_000, y: 4_499_881_000 }, rotationDeg: 12.5 };
const DRAGGED: GeoReference = { originWorld: { x: 1_000, y: 2_000 }, rotationDeg: 90 };

/** Αφήνει τις εκκρεμείς υποσχέσεις να λυθούν μέσα σε `act` — η ανάγνωση είναι ασύγχρονη. */
async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockLoad.mockReset();
  mockPersist.mockClear();
  resetBasemapPlacementStore();
});

afterEach(() => {
  resetBasemapPlacementStore();
  jest.useRealTimers();
});

describe('Υ — υδάτωση και ιδιοκτησία του κύκλου ζωής', () => {
  test('Υ1: η αποθηκευμένη τοποθέτηση υδατώνεται στο store', async () => {
    mockLoad.mockResolvedValue(SAVED);
    render(<BasemapPlacementHost projectId="prj_a" />);
    await settle();

    expect(mockLoad).toHaveBeenCalledWith('prj_a');
    expect(getBasemapPlacement()).toEqual(SAVED);
  });

  test('Υ2: έργο χωρίς αποθηκευμένη τοποθέτηση ⇒ null (ο χάρτης ακολουθεί τη διεύθυνση)', async () => {
    mockLoad.mockResolvedValue(null);
    render(<BasemapPlacementHost projectId="prj_plain" />);
    await settle();

    expect(getBasemapPlacement()).toBeNull();
  });

  test('Υ3: 🔴 η αλλαγή έργου ΔΕΝ αφήνει την τοποθέτηση του προηγούμενου να επιβιώσει', async () => {
    mockLoad.mockResolvedValue(SAVED);
    const view = render(<BasemapPlacementHost projectId="prj_a" />);
    await settle();
    expect(getBasemapPlacement()).toEqual(SAVED);

    // Το επόμενο έργο δεν έχει τοποθέτηση — και η ανάγνωσή του αργεί.
    let resolveSecond: (value: unknown) => void = () => {};
    mockLoad.mockReturnValue(new Promise((resolve) => { resolveSecond = resolve; }));
    view.rerender(<BasemapPlacementHost projectId="prj_b" />);

    // ΠΡΙΝ απαντήσει η ανάγνωση: ο χάρτης δεν επιτρέπεται να κάθεται στη γειτονιά του prj_a.
    expect(getBasemapPlacement()).toBeNull();

    await act(async () => { resolveSecond(null); });
    expect(getBasemapPlacement()).toBeNull();
  });

  test('Υ4: 🔴 ο γραφέας είναι συνδεδεμένος ΠΡΙΝ επιστρέψει η ανάγνωση', async () => {
    let resolveLoad: (value: unknown) => void = () => {};
    mockLoad.mockReturnValue(new Promise((resolve) => { resolveLoad = resolve; }));
    render(<BasemapPlacementHost projectId="prj_a" />);

    // Η άγκυρα έφτασε πρώτη, ο χρήστης έσυρε ενώ η τοποθέτηση φορτώνει ακόμη.
    setBasemapPlacement(DRAGGED);
    act(() => { jest.runAllTimers(); });

    expect(mockPersist).toHaveBeenCalledWith('prj_a', DRAGGED);

    // …και η καθυστερημένη ανάγνωση ΔΕΝ σβήνει τη δουλειά του (η εγγραφή είχε ήδη φύγει, άρα
    // εδώ κλειδώνεται ότι η υδάτωση δεν ξαναγράφει από πάνω αυθαίρετα).
    await act(async () => { resolveLoad(SAVED); });
    expect(mockPersist).toHaveBeenCalledTimes(1);
  });

  test('Υ5: χωρίς έργο ⇒ κανένας γραφέας, καμία ανάγνωση', async () => {
    render(<BasemapPlacementHost projectId={null} />);
    await settle();

    expect(mockLoad).not.toHaveBeenCalled();

    setBasemapPlacement(DRAGGED);
    act(() => { jest.runAllTimers(); });
    expect(mockPersist).not.toHaveBeenCalled();
  });

  test('Υ6: μετά την αποπροσάρτηση καμία εγγραφή δεν φεύγει για το έργο που έφυγε', async () => {
    mockLoad.mockResolvedValue(SAVED);
    const view = render(<BasemapPlacementHost projectId="prj_a" />);
    await settle();

    view.unmount();
    setBasemapPlacement(DRAGGED);
    act(() => { jest.runAllTimers(); });

    expect(mockPersist).not.toHaveBeenCalled();
  });
});
