/**
 * ADR-718 — CAPABILITY ANCHOR: **η καλωδίωση της κοπής, όχι μόνο η ραφή της.**
 *
 * Το `topo-crop-persistence.test.ts` αποδεικνύει ότι η ραφή είναι σωστή: `collectTopoState` →
 * `topoSettingsDocFields` → `docToTopoState` → `applyTopoState` διατηρεί την κοπή, και η
 * υπογραφή την προσέχει. Δεν αποδεικνύει όμως ότι **κάποιος καλεί αυτή τη ραφή**. Αυτή η
 * διάκριση δεν είναι ακαδημαϊκή — είναι το μάθημα του ADR-587 §6.1: ένα anchor χωρίς gate δεν
 * είναι anchor· ένας reconciler χωρίς κλήση δεν είναι reconciler· **μια σωστή ραφή που κανείς
 * δεν διασχίζει είναι νεκρός κώδικας που δείχνει υγιής**.
 *
 * Το `useTopoPersistence` δεν είχε **κανένα** test. Είναι ο ΕΝΑΣ κρίκος όπου συναντιούνται
 * τέσσερα ανεξάρτητα πράγματα που κανένα pure test δεν βλέπει:
 *
 *   1. **debounce → doSave** — η κοπή φεύγει όντως για το Firestore, μία φορά, με το σωστό ωφέλιμο·
 *   2. **anti-echo guard** — απόμακρη αλλαγή που διαφέρει ΜΟΝΟ στην κοπή δεν απορρίπτεται ως «δική μας»·
 *   3. **per-project reset** — η κοπή του προηγούμενου έργου δεν επιβιώνει στο επόμενο·
 *   4. **crop → reconciler** — τα ΨΗΜΕΝΑ παράγωγα της κάτοψης (ισοϋψείς, footprint) ξαναχτίζονται
 *      όταν αλλάζει ο δακτύλιος, και **δεν** ξαναχτίζονται σε άσχετη αλλαγή αποτύπωσης.
 *
 * Το #4 είναι το πιο ύπουλο και των δύο κατευθύνσεων. Αν δεν πυροδοτεί: το 3Δ κόβεται και η
 * **κάτοψη μένει ολόκληρη** — δύο όψεις του ίδιου εδάφους λένε διαφορετικά πράγματα. Αν πυροδοτεί
 * υπερβολικά: κάθε εισαγωγή σημείου ξαναχτίζει ισοϋψείς, ενώ η παραγωγή τους είναι **σκόπιμα
 * χειροκίνητη**. Το κριτήριο («ταυτότητα δακτυλίου», όχι «άλλαξε το store») είναι ρητή απόφαση
 * του ADR-718 — και εδώ κλειδώνει.
 *
 * Στρατηγική (ίδια με το `useGridGuidePersistence.test.tsx`): **τα topo stores είναι ΠΡΑΓΜΑΤΙΚΑ**
 * (αληθινό round-trip). Ψεύτικα μόνο τα σύνορα — Firestore, levels, και ο reconciler (τον οποίο
 * μετράμε: είναι το ζητούμενο, όχι θόρυβος προς απομόνωση).
 *
 * @see ../useTopoPersistence.ts
 * @see ../../../systems/topography/persistence/__tests__/topo-crop-persistence.test.ts — η ΡΑΦΗ
 */

import { renderHook, act } from '@testing-library/react';

import { useTopoPersistence, type UseTopoPersistenceParams } from '../useTopoPersistence';
import {
  clearTopo, getActiveCropRing, getTopoCrop, setTopoBoundary, setTopoCrop, setTopoPoints,
} from '../../../systems/topography/TopoPointStore';
import { invalidateTopoSurface } from '../../../systems/topography/topo-surface';
import { TOPO_CROP_OFF } from '../../../systems/topography/topo-types';
import type { TopoSurfaceDoc } from '../../../systems/topography/persistence/topo-persistence-types';
import type { Point2D } from '../../../rendering/types/Types';
import type { TopoPoint } from '../../../systems/topography/topo-types';

// `mock`-prefixed vars are allowed inside jest.mock factories (hoisting rule).
let mockService: ReturnType<typeof makeService>;
const mockReconcile = jest.fn(() => ({
  derivedCount: 0, movedByGroup: {}, unstampedGroups: [], unsupportedGroups: [],
}));
const mockSetLevelScene = jest.fn();

jest.mock('../../../systems/levels', () => ({
  useLevels: () => ({
    currentLevelId: 'lvl_1',
    sceneLoading: false,
    getLevelScene: () => ({ entities: [] }),
    setLevelScene: mockSetLevelScene,
  }),
}));

jest.mock('../../../systems/topography/persistence/topo-firestore-service', () => ({
  createTopoSurfaceFirestoreService: jest.fn(() => mockService),
  TopoSurfaceFirestoreService: class {},
}));

jest.mock('../../../systems/topography/persistence/topo-frame-reconcile', () => ({
  reconcileTopoFrame: (...args: unknown[]) => mockReconcile(...(args as [])),
}));

// ============================================================================
// FIXTURES / FAKES
// ============================================================================

const M = 1000;

/** Σχάρα 4×4 — αρκετά σημεία ώστε το έγγραφο να μη θεωρηθεί «κενό». */
function surveyPoints(): TopoPoint[] {
  const pts: TopoPoint[] = [];
  for (let gx = 0; gx <= 3; gx++) {
    for (let gy = 0; gy <= 3; gy++) pts.push({ x: gx * 5 * M, y: gy * 5 * M, z: M + gx * 100 });
  }
  return pts;
}

const HALF: Point2D[] = [
  { x: 0, y: 0 }, { x: 7 * M, y: 0 }, { x: 7 * M, y: 15 * M }, { x: 0, y: 15 * M },
];

/**
 * Ψεύτικο `TopoSurfaceFirestoreService`. Το `subscribeTopo` στέλνει το αρχικό στιγμιότυπο
 * σύγχρονα (όπως ο πραγματικός onSnapshot) και κρατά τον listener ώστε ένα test να μπορεί να
 * σπρώξει **απομακρυσμένη** αλλαγή αργότερα — εκεί ζει ο anti-echo guard.
 */
function makeService(remoteDocs: readonly TopoSurfaceDoc[] = []) {
  let push: ((docs: readonly TopoSurfaceDoc[]) => void) | null = null;
  return {
    subscribeTopo: jest.fn((onChange: (docs: readonly TopoSurfaceDoc[]) => void) => {
      push = onChange;
      onChange(remoteDocs);
      return () => { push = null; };
    }),
    createTopo: jest.fn(async () => 'topo_created'),
    updateTopo: jest.fn(async () => {}),
    readSurfacesBlob: jest.fn(async () => ({
      existing: { points: [], breaklines: [] }, proposed: { points: [], breaklines: [] },
    })),
    /** Test helper — απομακρυσμένη ενημέρωση (άλλη καρτέλα / άλλος χρήστης). */
    __push: (docs: readonly TopoSurfaceDoc[]) => { push?.(docs); },
  };
}

/** Έγγραφο όπως θα ερχόταν από το Firestore. `crop` παραλείπεται ⇒ legacy. */
function remoteDoc(overrides: Partial<TopoSurfaceDoc> = {}): TopoSurfaceDoc {
  return {
    id: 'topo_remote', companyId: 'comp_x', projectId: 'proj_x', floorplanId: 'file_x',
    surfaces: { existing: { points: surveyPoints(), breaklines: [] }, proposed: { points: [], breaklines: [] } },
    boundary: { vertices: HALF },
    contourConfig: { intervalMm: 500, majorEvery: 5, baseElevationMm: 0, labelMajors: true, labelDecimals: 2 },
    contourDisplayStyle: 'exact',
    terrain3d: { visible: false, style: 'shaded' },
    cutFill: { mode: 'datum', datumZMm: 0 },
    version: 1,
    ...overrides,
  } as unknown as TopoSurfaceDoc;
}

const SCOPE: UseTopoPersistenceParams = {
  companyId: 'comp_x', projectId: 'proj_x', floorplanId: 'file_x', floorId: 'flr_x', userId: 'u',
};

/** DXF_TIMING.persist.TOPO_SURFACE = 1000ms· περνάμε λίγο πιο πέρα και αδειάζουμε τις υποσχέσεις. */
const flushSave = async (): Promise<void> => {
  await act(async () => {
    jest.advanceTimersByTime(1200);
    await Promise.resolve();
    await Promise.resolve();
  });
};

/** Το ωφέλιμο της τελευταίας εγγραφής (create ή update) — ό,τι θα έφτανε στο Firestore. */
function lastWrittenState(): { crop?: { enabled: boolean; showOutside: boolean } } | null {
  const creates = mockService.createTopo.mock.calls;
  const updates = mockService.updateTopo.mock.calls;
  if (updates.length > 0) return (updates[updates.length - 1]![1] as { state: never }).state;
  if (creates.length > 0) return (creates[creates.length - 1]![0] as { state: never }).state;
  return null;
}

beforeEach(() => {
  jest.useFakeTimers();
  clearTopo();
  invalidateTopoSurface();
  mockReconcile.mockClear();
  mockSetLevelScene.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

// ============================================================================
// 1. Ο διακόπτης φτάνει όντως στο Firestore
// ============================================================================

describe('useTopoPersistence — η κοπή διασχίζει την καλωδίωση', () => {
  it('🔴 άναμμα κοπής ⇒ ΜΙΑ εγγραφή, με `crop.enabled` μέσα στο ωφέλιμο', () => {
    mockService = makeService([remoteDoc()]);
    renderHook((p: UseTopoPersistenceParams) => useTopoPersistence(p), { initialProps: SCOPE });

    return (async () => {
      await flushSave();
      mockService.updateTopo.mockClear();
      mockService.createTopo.mockClear();

      act(() => { setTopoCrop({ enabled: true }); });
      await flushSave();

      // Ακριβώς εδώ έσπαγε πριν: η υπογραφή αγνοούσε το `crop`, το `doSave` έκανε early-return
      // και ΚΑΜΙΑ εγγραφή δεν έφευγε. Καμία εξαίρεση — απλώς χαμένη απόφαση του χρήστη.
      const writes = mockService.updateTopo.mock.calls.length + mockService.createTopo.mock.calls.length;
      expect(writes).toBe(1);
      expect(lastWrittenState()?.crop).toEqual({ enabled: true, showOutside: false });
    })();
  });

  it('το `showOutside` ταξιδεύει κι αυτό (δεύτερο πεδίο, ίδια διαδρομή)', async () => {
    mockService = makeService([remoteDoc({ crop: { enabled: true, showOutside: false } })]);
    renderHook((p: UseTopoPersistenceParams) => useTopoPersistence(p), { initialProps: SCOPE });
    await flushSave();
    mockService.updateTopo.mockClear();

    act(() => { setTopoCrop({ showOutside: true }); });
    await flushSave();

    expect(lastWrittenState()?.crop).toEqual({ enabled: true, showOutside: true });
  });

  it('σβήσιμο κοπής γράφεται κι αυτό — αλλιώς δεν ξε-αποθηκεύεται ποτέ', async () => {
    mockService = makeService([remoteDoc({ crop: { enabled: true, showOutside: true } })]);
    renderHook((p: UseTopoPersistenceParams) => useTopoPersistence(p), { initialProps: SCOPE });
    await flushSave();
    mockService.updateTopo.mockClear();

    act(() => { setTopoCrop({ enabled: false }); });
    await flushSave();

    expect(lastWrittenState()?.crop).toEqual(TOPO_CROP_OFF);
  });

  it('ΚΑΜΙΑ εγγραφή κατά τη φόρτωση — το `suppressSave` κρατά (αλλιώς βρόχος save↔hydrate)', async () => {
    mockService = makeService([remoteDoc({ crop: { enabled: true, showOutside: false } })]);
    renderHook((p: UseTopoPersistenceParams) => useTopoPersistence(p), { initialProps: SCOPE });
    await flushSave();

    expect(mockService.createTopo).not.toHaveBeenCalled();
    expect(mockService.updateTopo).not.toHaveBeenCalled();
    expect(getTopoCrop().enabled).toBe(true); // φορτώθηκε, απλώς δεν ξαναγράφτηκε
  });

  it('κενή αποτύπωση ⇒ κανένα έγγραφο (ο διακόπτης μόνος του δεν δικαιολογεί doc)', async () => {
    mockService = makeService([]);
    renderHook((p: UseTopoPersistenceParams) => useTopoPersistence(p), { initialProps: SCOPE });
    act(() => { setTopoCrop({ enabled: true }); });
    await flushSave();

    expect(mockService.createTopo).not.toHaveBeenCalled();
  });
});

// ============================================================================
// 2. Ο anti-echo guard δεν καταπίνει την κοπή
// ============================================================================

describe('useTopoPersistence — απομακρυσμένη αλλαγή κοπής', () => {
  it('🔴 έγγραφο που διαφέρει ΜΟΝΟ στην κοπή ΕΦΑΡΜΟΖΕΤΑΙ (δεν απορρίπτεται ως δικό μας ηχώ)', async () => {
    mockService = makeService([remoteDoc()]); // ξεκινά χωρίς κοπή
    renderHook((p: UseTopoPersistenceParams) => useTopoPersistence(p), { initialProps: SCOPE });
    await flushSave();
    expect(getActiveCropRing()).toBeNull();

    // Άλλη καρτέλα άναψε την κοπή. Ο guard συγκρίνει ΥΠΟΓΡΑΦΕΣ: όσο το `crop` έλειπε από
    // εκείνην, αυτό το έγγραφο ήταν «ίδιο με ό,τι γράψαμε» → σιωπηλά αγνοημένο.
    await act(async () => {
      mockService.__push([remoteDoc({ crop: { enabled: true, showOutside: false } })]);
      await Promise.resolve();
    });

    expect(getTopoCrop().enabled).toBe(true);
    expect(getActiveCropRing()).not.toBeNull();
  });
});

// ============================================================================
// 3. Το προηγούμενο έργο δεν μολύνει το επόμενο
// ============================================================================

describe('useTopoPersistence — per-project reset', () => {
  it('🔴 legacy έγγραφο (χωρίς `crop`) ΣΒΗΝΕΙ την κοπή που ίσχυε στην ίδια συνεδρία', async () => {
    mockService = makeService([remoteDoc({ crop: { enabled: true, showOutside: true } })]);
    const { rerender } = renderHook(
      (p: UseTopoPersistenceParams) => useTopoPersistence(p),
      { initialProps: SCOPE },
    );
    await flushSave();
    expect(getActiveCropRing()).not.toBeNull();

    // Άλλο έργο, παλιό έγγραφο — το πεδίο `crop` δεν υπήρχε καν όταν αποθηκεύτηκε.
    mockService = makeService([remoteDoc({ id: 'topo_legacy' })]);
    await act(async () => {
      rerender({ ...SCOPE, projectId: 'proj_legacy' });
      await Promise.resolve();
    });

    // Σιωπηλή κληρονομιά εδώ = μικρότεροι όγκοι εκσκαφής σε έργο που κανείς δεν ζήτησε να κοπεί.
    expect(getTopoCrop()).toEqual(TOPO_CROP_OFF);
    expect(getActiveCropRing()).toBeNull();
  });
});

// ============================================================================
// 4. Ο κρίκος προς τα ΨΗΜΕΝΑ παράγωγα — και προς τις δύο κατευθύνσεις
// ============================================================================

describe('useTopoPersistence — η κοπή σκανδαλίζει τον reconciler', () => {
  it('🔴 άναμμα κοπής ⇒ ο reconciler τρέχει (αλλιώς 3Δ κομμένο, ΚΑΤΟΨΗ ολόκληρη)', async () => {
    mockService = makeService([remoteDoc()]);
    renderHook((p: UseTopoPersistenceParams) => useTopoPersistence(p), { initialProps: SCOPE });
    await flushSave();
    mockReconcile.mockClear();

    act(() => { setTopoCrop({ enabled: true }); });

    // Ισοϋψείς και footprint είναι ΨΗΜΕΝΕΣ οντότητες: δεν ανανεώνονται μόνες τους. Χωρίς αυτή
    // την κλήση οι δύο όψεις του ίδιου εδάφους δείχνουν διαφορετικό σχήμα.
    expect(mockReconcile).toHaveBeenCalled();
  });

  it('αλλαγή του ΟΡΙΟΥ με ενεργή κοπή ⇒ ξανατρέχει (νέος δακτύλιος = νέα ταυτότητα)', async () => {
    mockService = makeService([remoteDoc({ crop: { enabled: true, showOutside: false } })]);
    renderHook((p: UseTopoPersistenceParams) => useTopoPersistence(p), { initialProps: SCOPE });
    await flushSave();
    mockReconcile.mockClear();

    act(() => {
      setTopoBoundary({ vertices: [{ x: 0, y: 0 }, { x: 3 * M, y: 0 }, { x: 3 * M, y: 9 * M }] });
    });

    expect(mockReconcile).toHaveBeenCalled();
  });

  it('🔴 ΑΝΤΙΣΤΡΟΦΑ: εισαγωγή σημείων ΔΕΝ τον σκανδαλίζει — η παραγωγή ισοϋψών μένει χειροκίνητη', async () => {
    mockService = makeService([remoteDoc()]);
    renderHook((p: UseTopoPersistenceParams) => useTopoPersistence(p), { initialProps: SCOPE });
    await flushSave();
    mockReconcile.mockClear();

    act(() => { setTopoPoints([...surveyPoints(), { x: 2 * M, y: 2 * M, z: 9 * M }]); });

    // Το κριτήριο είναι η ταυτότητα του ΔΑΚΤΥΛΙΟΥ, όχι «άλλαξε το TopoPointStore». Αν ήταν το
    // δεύτερο, κάθε σημείο που εισάγει ο τοπογράφος θα ξαναχτίζε ισοϋψείς εν αγνοία του.
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('ο διακόπτης ΧΩΡΙΣ όριο δεν σκανδαλίζει τίποτα (δακτύλιος ακόμα null)', async () => {
    mockService = makeService([remoteDoc({ boundary: null })]);
    renderHook((p: UseTopoPersistenceParams) => useTopoPersistence(p), { initialProps: SCOPE });
    await flushSave();
    mockReconcile.mockClear();

    act(() => { setTopoCrop({ enabled: true }); });

    expect(mockReconcile).not.toHaveBeenCalled();
  });
});
