/**
 * ΑΓΚΥΡΕΣ — ADR-782 §24: **η μονιμότητα της χειροκίνητης τοποθέτησης**.
 *
 * Τρεις ομάδες, τρία διαφορετικά ερωτήματα:
 *
 * | Ομάδα | Ερώτημα |
 * |---|---|
 * | `Ε` | Επιβιώνει η τιμή του κύκλου **έγγραφο → runtime → έγγραφο**; (μέτρα ⇄ mm) |
 * | `Δ` | Ποιος γράφει, πότε, και ποιος **δεν** γράφει ποτέ; (οι τέσσερις πόρτες) |
 * | `Π` | Τι ακριβώς φεύγει για τη βάση; (**η κόκκινη γραμμή του §23.1**) |
 *
 * 🔑 Η `Π1` δεν ρωτά «γράψαμε στη γεωαναφορά;» με grep — **διαβάζει το πραγματικό patch** που
 * παραδόθηκε στην πύλη μεταβολών. Ένας κανόνας που κάποιος πρέπει να θυμηθεί θα είχε σπάσει· ένα
 * patch που δεν περιέχει το πεδίο δεν μπορεί να το γράψει.
 *
 * ⚠️ Η `Δ5` είναι η μόνη άγκυρα με **μετρημένη** αιτία και όχι θεωρητική: η άγκυρα διεύθυνσης και
 * η τοποθέτηση διαβάζονται από **δύο ανεξάρτητες** αναγνώσεις του **ίδιου** εγγράφου, χωρίς
 * εγγυημένη σειρά. Αν η άγκυρα φτάσει πρώτη, το εργαλείο ξεκλειδώνει και ο χρήστης μπορεί να
 * σύρει **πριν** φτάσει η αποθηκευμένη τιμή.
 */

const mockUpdateProjectWithPolicy = jest.fn(
  async (_input: { projectId: string; updates: Record<string, unknown> }) => ({ success: true }),
);
let mockDocData: Record<string, unknown> | null = null;

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  getDoc: jest.fn(async () => ({
    exists: () => mockDocData !== null,
    data: () => mockDocData,
  })),
}));
jest.mock('@/lib/firebase', () => ({ db: { __mockDb: true } }));
jest.mock('@/services/projects/project-mutation-gateway', () => ({
  updateProjectWithPolicy: (...args: Parameters<typeof mockUpdateProjectWithPolicy>) =>
    mockUpdateProjectWithPolicy(...args),
}));

// SUT imports AFTER mocks
import {
  basemapPlacementFromProject,
  basemapPlacementToProject,
} from '../basemap-placement-schema';
import {
  loadProjectBasemapPlacement,
  persistProjectBasemapPlacement,
} from '../basemap-placement-persistence';
import {
  clearBasemapPlacement,
  detachBasemapPlacement,
  flushBasemapPlacementWrite,
  getBasemapPlacement,
  hydrateBasemapPlacement,
  resetBasemapPlacementStore,
  setBasemapPlacement,
  setBasemapPlacementPersister,
} from '../basemap-placement-store';
import type { GeoReference } from '../../geo-referencing/geo-transform';

/** Θεσσαλονίκη, ΕΓΣΑ'87 — πραγματικές τάξεις μεγέθους, όχι στρογγυλά νούμερα δοκιμής. */
const THESSALONIKI: GeoReference = {
  originWorld: { x: 410_527_123, y: 4_499_881_456 },
  rotationDeg: 12.5,
};

beforeEach(() => {
  jest.useFakeTimers();
  mockUpdateProjectWithPolicy.mockClear();
  mockDocData = null;
  resetBasemapPlacementStore();
});

afterEach(() => {
  resetBasemapPlacementStore();
  jest.useRealTimers();
});

// ─── Ε — ο κύκλος έγγραφο ⇄ runtime ─────────────────────────────────────────

describe('Ε — μέτρα στο έγγραφο, χιλιοστά στη μνήμη', () => {
  test('Ε1: ο κύκλος runtime → έγγραφο → runtime επιστρέφει την ίδια θέση', () => {
    const back = basemapPlacementFromProject({
      basemapPlacement: basemapPlacementToProject(THESSALONIKI),
    });
    expect(back).toEqual(THESSALONIKI);
  });

  test('Ε2: το έγγραφο κρατά ΜΕΤΡΑ — χίλιες φορές μικρότερος αριθμός από το runtime', () => {
    const field = basemapPlacementToProject(THESSALONIKI);
    expect(field.eastingM).toBeCloseTo(410_527.123, 6);
    expect(field.northingM).toBeCloseTo(4_499_881.456, 6);
    expect(field.rotationDeg).toBe(12.5);
  });

  test('Ε3: απόν πεδίο ⇒ null — «κανείς δεν τοποθέτησε», όχι «τοποθέτησε στο μηδέν»', () => {
    expect(basemapPlacementFromProject({})).toBeNull();
    expect(basemapPlacementFromProject({ basemapPlacement: null })).toBeNull();
    expect(basemapPlacementFromProject(undefined)).toBeNull();
  });

  test('Ε4: κατεστραμμένο έγγραφο ⇒ null, ΠΟΤΕ εξαίρεση — ο viewer δεν πέφτει από παλιό έγγραφο', () => {
    const broken = { eastingM: Number.NaN, northingM: 1, rotationDeg: 0 };
    expect(basemapPlacementFromProject({ basemapPlacement: broken })).toBeNull();
  });

  test('Ε5: στροφή που λείπει ⇒ 0, αλλά η ΘΕΣΗ που λείπει ⇒ null (δεν μαντεύεται)', () => {
    const noRotation = { eastingM: 1_000, northingM: 2_000 } as never;
    expect(basemapPlacementFromProject({ basemapPlacement: noRotation })).toEqual({
      originWorld: { x: 1_000_000, y: 2_000_000 },
      rotationDeg: 0,
    });
  });
});

// ─── Δ — οι τέσσερις πόρτες του store ───────────────────────────────────────

describe('Δ — ποιος γράφει και ποιος δεν γράφει ποτέ', () => {
  test('Δ1: η τοποθέτηση από τον χρήστη αποθηκεύεται, με καθυστέρηση', () => {
    const persist = jest.fn(async () => {});
    setBasemapPlacementPersister(persist);

    setBasemapPlacement(THESSALONIKI);
    expect(persist).not.toHaveBeenCalled(); // όχι σε κάθε καρέ συρσίματος

    jest.runAllTimers();
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith(THESSALONIKI);
  });

  test('Δ2: ένα σύρσιμο = ΜΙΑ εγγραφή, όχι μία ανά καρέ', () => {
    const persist = jest.fn(async () => {});
    setBasemapPlacementPersister(persist);

    for (let step = 1; step <= 60; step += 1) {
      setBasemapPlacement({ ...THESSALONIKI, rotationDeg: step });
    }
    jest.runAllTimers();

    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith({ ...THESSALONIKI, rotationDeg: 60 });
  });

  test('Δ3: η ΕΠΑΝΑΦΟΡΑ του χρήστη γράφει null — αλλιώς ξαναζωντανεύει στην ανανέωση σελίδας', () => {
    const persist = jest.fn(async () => {});
    setBasemapPlacementPersister(persist);
    hydrateBasemapPlacement(THESSALONIKI);

    clearBasemapPlacement();
    jest.runAllTimers();

    expect(getBasemapPlacement()).toBeNull();
    expect(persist).toHaveBeenCalledWith(null);
  });

  test('Δ4: η ΥΔΑΤΩΣΗ δεν γράφει ΠΟΤΕ — αλλιώς κάθε φόρτωση ξαναγράφει ό,τι μόλις διάβασε', () => {
    const persist = jest.fn(async () => {});
    setBasemapPlacementPersister(persist);

    hydrateBasemapPlacement(THESSALONIKI);
    jest.runAllTimers();

    expect(getBasemapPlacement()).toEqual(THESSALONIKI);
    expect(persist).not.toHaveBeenCalled();
  });

  test('Δ5: η υδάτωση ΔΕΝ πατά πρόθεση χρήστη που δεν έχει προλάβει να γραφτεί', () => {
    const persist = jest.fn(async () => {});
    setBasemapPlacementPersister(persist);

    // Η άγκυρα έφτασε πρώτη, ο χρήστης έσυρε…
    const dragged: GeoReference = { ...THESSALONIKI, rotationDeg: 90 };
    setBasemapPlacement(dragged);
    // …και μόλις τώρα απαντά η ανάγνωση του εγγράφου με την ΠΑΛΙΑ τιμή.
    hydrateBasemapPlacement(THESSALONIKI);

    expect(getBasemapPlacement()).toEqual(dragged);
    jest.runAllTimers();
    expect(persist).toHaveBeenCalledWith(dragged);
  });

  test('Δ6: η αλλαγή έργου ακυρώνει την εκκρεμή εγγραφή — δεν γράφεται στο ΕΠΟΜΕΝΟ έργο', () => {
    const persist = jest.fn(async () => {});
    setBasemapPlacementPersister(persist);

    setBasemapPlacement(THESSALONIKI);
    detachBasemapPlacement();
    jest.runAllTimers();

    expect(getBasemapPlacement()).toBeNull();
    expect(persist).not.toHaveBeenCalled();
  });

  test('Δ7: ίδια τιμή ⇒ καμία εγγραφή — ο δείκτης κουνήθηκε λιγότερο από ένα χιλιοστό', () => {
    const persist = jest.fn(async () => {});
    setBasemapPlacementPersister(persist);
    hydrateBasemapPlacement(THESSALONIKI);

    setBasemapPlacement({ ...THESSALONIKI });
    jest.runAllTimers();

    expect(persist).not.toHaveBeenCalled();
  });

  test('Δ8: αποτυχία εγγραφής ΔΕΝ αναιρεί την οθόνη — ο χάρτης μένει εκεί που τον άφησαν', async () => {
    setBasemapPlacementPersister(async () => {
      throw new Error('offline');
    });
    setBasemapPlacement(THESSALONIKI);
    jest.runAllTimers();
    await Promise.resolve();

    expect(getBasemapPlacement()).toEqual(THESSALONIKI);
  });
});

// ─── Π — τι ακριβώς φεύγει για τη βάση (η κόκκινη γραμμή) ───────────────────

describe('Π — το πραγματικό patch, όχι η πρόθεση του συγγραφέα', () => {
  test('Π1: 🔴 το patch αγγίζει ΜΟΝΟ το basemapPlacement — ποτέ basePoint/northRotation/surveyPoint', async () => {
    await persistProjectBasemapPlacement('prj_test', THESSALONIKI);

    const { updates } = mockUpdateProjectWithPolicy.mock.calls[0]![0];
    expect(Object.keys(updates)).toEqual(['basemapPlacement']);
    expect(updates).not.toHaveProperty('basePoint');
    expect(updates).not.toHaveProperty('northRotation');
    expect(updates).not.toHaveProperty('surveyPoint');
  });

  test('Π2: το patch γράφει ΜΕΤΡΑ, όχι τα χιλιοστά του runtime', async () => {
    await persistProjectBasemapPlacement('prj_test', THESSALONIKI);

    const { updates } = mockUpdateProjectWithPolicy.mock.calls[0]![0];
    expect(updates.basemapPlacement).toEqual({
      eastingM: expect.closeTo(410_527.123, 6) as unknown as number,
      northingM: expect.closeTo(4_499_881.456, 6) as unknown as number,
      rotationDeg: 12.5,
    });
  });

  test('Π3: η επαναφορά γράφει ρητό null — δεν αφήνει την παλιά τιμή στο έγγραφο', async () => {
    await persistProjectBasemapPlacement('prj_test', null);

    const { updates } = mockUpdateProjectWithPolicy.mock.calls[0]![0];
    expect(updates).toEqual({ basemapPlacement: null });
  });

  test('Π4: η ανάγνωση φέρνει πίσω ό,τι έγραψε η εγγραφή (πλήρης κύκλος μέσω εγγράφου)', async () => {
    mockDocData = { basemapPlacement: basemapPlacementToProject(THESSALONIKI) };
    await expect(loadProjectBasemapPlacement('prj_test')).resolves.toEqual(THESSALONIKI);
  });

  test('Π5: έργο χωρίς έγγραφο ή χωρίς πεδίο ⇒ null, όχι εξαίρεση', async () => {
    mockDocData = null;
    await expect(loadProjectBasemapPlacement('prj_missing')).resolves.toBeNull();
    mockDocData = { name: 'Έργο χωρίς τοποθέτηση' };
    await expect(loadProjectBasemapPlacement('prj_plain')).resolves.toBeNull();
  });

  test('Π6: το flush γράφει την ΤΡΕΧΟΥΣΑ τιμή του store, όχι μια παλιά κλεισμένη σε closure', () => {
    const persist = jest.fn(async () => {});
    setBasemapPlacementPersister(persist);

    setBasemapPlacement(THESSALONIKI);
    flushBasemapPlacementWrite();

    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith(THESSALONIKI);
  });
});
