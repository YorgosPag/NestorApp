/**
 * 🔴 ADR-767 Δ3 — **Η ΡΗΤΗ ΕΝΕΡΓΕΙΑ**, και οι τρεις παγίδες της.
 *
 * 1. **Βήμα undo για το τίποτα** (§8 #2 / handoff §5 #3). Το early cutoff επιστρέφει το
 *    **ίδιο** μοντέλο by-reference — αν ο ξενιστής κατασκευάσει νέο «για σιγουριά», ο χρήστης
 *    πατά «Ανανέωση» σε καθαρό έργο και βλέπει το `Ctrl+Z` να γεμίζει με βήματα που δεν
 *    αναιρούν τίποτα.
 * 2. **Μία χειρονομία, ΕΝΑ undo** (§9). Η ανανέωση αλλάζει κελιά **και** αποτύπωμα· δύο
 *    εντολές θα σήμαιναν ότι ένα `Ctrl+Z` αφήνει τον πίνακα να δηλώνει «ενημερωμένος»
 *    δείχνοντας τα παλιά νούμερα.
 * 3. **Η ένδειξη οθόνης χωρίς έλεγχο** — το `null` του store σημαίνει «κανείς δεν κοίταξε»,
 *    και μόνο ένας πραγματικός έλεγχος επιτρέπεται να το αλλάξει.
 *
 * @see ui/table-cell-editor/use-table-binding-actions.ts
 * @see docs/centralized-systems/reference/adrs/ADR-767-table-bound-mode.md §4 Δ3, §5
 */

import { renderHook, act } from '@testing-library/react';
import { useTableBindingActions } from '../use-table-binding-actions';
import { fingerprintExportableTable } from '../../../bim/table/binding/table-binding-fingerprint';
import { buildCoordinateTable } from '../../../systems/topography/deliverables/survey-tables';
import {
  __resetTableBindingFreshnessForTests,
  getTableBindingFreshness,
} from '../../../state/table-binding-freshness-store';
import * as TopoPointStore from '../../../systems/topography/TopoPointStore';
import type { TopoPoint } from '../../../systems/topography/topo-types';
import type { TableEntity } from '../../../types/table-entity';
import type { ICommand } from '../../../core/commands';
import type { LevelManagerLike } from '../../../hooks/canvas/canvas-click-types';

/**
 * Το store της αποτύπωσης, με **πραγματικούς** συνδρομητές: η συνδρομή ΕΙΝΑΙ ο καταναλωτής
 * του `check` (§8 #7), οπότε ένα `jest.fn()` που δεν καλεί ποτέ πίσω θα άφηνε το πιο κρίσιμο
 * test να περνά χωρίς να έχει τρέξει τίποτα.
 */
const topoListeners = new Set<() => void>();
const emitTopoChange = (): void => { for (const listener of topoListeners) listener(); };

jest.mock('../../../systems/topography/TopoPointStore', () => ({
  getTopoPoints: jest.fn(),
  subscribeTopo: (listener: () => void) => {
    topoListeners.add(listener);
    return () => topoListeners.delete(listener);
  },
}));
jest.mock('../../../rendering/core/frame-scheduler-api', () => ({ markSystemsDirty: jest.fn() }));

/** Ο ιστορικός εντολών, με καταγραφή — η μόνη απόδειξη «πόσα undo βήματα». */
const executed: ICommand[] = [];
jest.mock('../../../core/commands', () => ({
  ...jest.requireActual('../../../core/commands'),
  useCommandHistory: () => ({ execute: (command: ICommand) => { executed.push(command); } }),
}));

const getTopoPoints = TopoPointStore.getTopoPoints as jest.MockedFunction<
  typeof TopoPointStore.getTopoPoints
>;

const P1: TopoPoint = { x: 1000, y: 2000, z: 3000, code: 'Κ1' };
const P2: TopoPoint = { x: 4000, y: 5000, z: 6000, code: 'Κ2' };
/** Ίδιος κωδικός, **μετακινημένο** — αλλάζει η τιμή, όχι τα όρια της σκηνής. */
const P2_MOVED: TopoPoint = { x: 4500, y: 5000, z: 6000, code: 'Κ2' };

const revisionFor = (points: readonly TopoPoint[]): string =>
  fingerprintExportableTable(buildCoordinateTable(points));

function tableEntity(revision: string): TableEntity {
  return {
    id: 'tbl_1',
    type: 'table',
    layerId: 'lyr',
    position: { x: 0, y: 0 },
    angleRad: 0,
    styleId: 'standard',
    model: {
      columns: [
        { id: 'cX', sizing: { kind: 'fixed', widthMm: 20 }, valueType: 'text', align: 'right', sourceKey: 'x' },
      ],
      rows: [
        { id: 'r1', rowClass: 'data', heightMm: 6 },
        { id: 'r2', rowClass: 'data', heightMm: 6 },
      ],
      cells: [],
      merges: [],
    },
    binding: { mode: 'bound', sourceRef: { kind: 'survey-coordinates' }, revision },
  } as TableEntity;
}

/** Πίνακας **χωρίς** δεσμό — ο συνηθισμένος, στατικός. */
function staticEntity(): TableEntity {
  const { binding: _drop, ...rest } = tableEntity('x');
  return rest as TableEntity;
}

const levelManager = {
  currentLevelId: 'lvl_1',
  getLevelScene: () => ({ entities: [] }),
  setLevelScene: () => undefined,
} as unknown as LevelManagerLike;

function actions(entity: TableEntity | null) {
  return renderHook(() => useTableBindingActions({ levelManager, table: () => entity })).result;
}

beforeEach(() => {
  topoListeners.clear();
  executed.length = 0;
  __resetTableBindingFreshnessForTests();
  jest.clearAllMocks();
  getTopoPoints.mockReturnValue([P1, P2]);
});

// ─── 1. isBound ───────────────────────────────────────────────────────────────

describe('isBound — η παρουσία του δεσμού, ποτέ η φρεσκάδα του', () => {
  it('δεμένος πίνακας ⇒ true· στατικός ⇒ false· κανένας ⇒ false', () => {
    expect(actions(tableEntity(revisionFor([P1, P2]))).current.isBound()).toBe(true);
    expect(actions(staticEntity()).current.isBound()).toBe(false);
    expect(actions(null).current.isBound()).toBe(false);
  });
});

// ─── 2. 🔴 Το early cutoff φτάνει ΩΣ ΤΟ UNDO ─────────────────────────────────

describe('🔴 refresh — καμία εντολή όταν τίποτα δεν άλλαξε', () => {
  it('🔴 ΙΔΙΑ ΔΕΔΟΜΕΝΑ ⇒ ΜΗΔΕΝ ΕΝΤΟΛΕΣ (κανένα βήμα undo για το τίποτα)', () => {
    const api = actions(tableEntity(revisionFor([P1, P2]))).current;

    act(() => { api.refresh(); });

    expect(executed).toHaveLength(0);
  });

  it('…και όμως ΚΑΤΑΓΡΑΦΕΙ ότι ο πίνακας είναι ενημερωμένος', () => {
    const api = actions(tableEntity(revisionFor([P1, P2]))).current;

    act(() => { api.refresh(); });

    expect(getTableBindingFreshness('tbl_1')).toEqual({ status: 'fresh' });
  });

  it('🔴 ΑΛΛΑΓΜΕΝΗ ΚΟΡΥΦΗ ⇒ ΑΚΡΙΒΩΣ ΜΙΑ ΕΝΤΟΛΗ — μία χειρονομία, ένα `Ctrl+Z`', () => {
    getTopoPoints.mockReturnValue([P1, P2_MOVED]);
    const api = actions(tableEntity(revisionFor([P1, P2]))).current;

    act(() => { api.refresh(); });

    expect(executed).toHaveLength(1);
  });

  it('🔴 Η ΜΙΑ ΕΝΤΟΛΗ ΓΡΑΦΕΙ **ΚΑΙ** ΤΟ ΜΟΝΤΕΛΟ **ΚΑΙ** ΤΟ ΑΠΟΤΥΠΩΜΑ', () => {
    getTopoPoints.mockReturnValue([P1, P2_MOVED]);
    const api = actions(tableEntity(revisionFor([P1, P2]))).current;

    act(() => { api.refresh(); });

    // Δύο εντολές θα άφηναν ένα `Ctrl+Z` να επαναφέρει τα νούμερα κρατώντας το νέο
    // αποτύπωμα — δηλαδή πίνακα που δηλώνει «ενημερωμένος» δείχνοντας τα παλιά.
    //
    // 🔴 ADR-833 Φάση 2 — τα δύο ζουν πλέον στο **ίδιο φύλλο**, οπότε η ατομικότητα που αυτό
    // το anchor φυλά έγινε **δομική**: ένα αντικείμενο, μία αντικατάσταση, αδύνατο να χωριστούν.
    // Ο έλεγχος ρωτά το ίδιο πράγμα στο νέο σχήμα — και **ονομαστικά** τα δύο πεδία, όχι απλώς
    // «κάτι γράφτηκε»: με ένα μόνο από τα δύο, ο πίνακας θα δήλωνε «ενημερωμένος» δείχνοντας
    // τα παλιά νούμερα.
    const patch = (executed[0] as unknown as {
      patch: { worksheets?: readonly { model?: unknown; binding?: { revision: string } }[] };
    }).patch;
    expect(patch.worksheets).toHaveLength(1);
    expect(patch.worksheets?.[0].model).toBeDefined();
    expect(patch.worksheets?.[0].binding).toBeDefined();
    expect(patch.worksheets?.[0].binding?.revision).toBe(revisionFor([P1, P2_MOVED]));
  });
});

// ─── 3. Η πηγή που δεν απαντά ─────────────────────────────────────────────────

describe('refresh — η πηγή δεν απαντά', () => {
  it('🔴 ΑΣΥΝΔΕΤΟΣ ΚΛΑΔΟΣ ⇒ «άγνωστο» ΜΕ ΛΟΓΟ, καμία εντολή, κανένα ψεύτικο «fresh»', () => {
    const entity = tableEntity('x');
    const notWired = {
      ...entity,
      binding: { mode: 'bound' as const, sourceRef: { kind: 'survey-volumes' as const }, revision: 'x' },
    } as TableEntity;
    const api = actions(notWired).current;

    act(() => { api.refresh(); });

    expect(executed).toHaveLength(0);
    expect(getTableBindingFreshness('tbl_1')).toEqual({
      status: 'unknown',
      reason: 'source-not-wired',
    });
  });
});

// ─── 4. Ο στατικός πίνακας ────────────────────────────────────────────────────

describe('refresh / check — τίποτα να κάνουν χωρίς δεσμό', () => {
  it('στατικός πίνακας: καμία εντολή, καμία ετυμηγορία, κανένα σφάλμα', () => {
    const api = actions(staticEntity()).current;

    act(() => { api.refresh(); api.check(); });

    expect(executed).toHaveLength(0);
    expect(getTableBindingFreshness('tbl_1')).toBeNull();
  });

  it('κανένας πίνακας: το ίδιο, χωρίς εξαίρεση', () => {
    const api = actions(null).current;

    expect(() => act(() => { api.refresh(); api.check(); })).not.toThrow();
  });
});

// ─── 5. 🔴 Ο έλεγχος ΔΕΝ είναι ανανέωση ──────────────────────────────────────

describe('🔴 check — ρωτά ΧΩΡΙΣ να γράψει (Δ3: το «κοίταξε» δεν είναι «ξαναγέμισε»)', () => {
  it('🔴 ΜΠΑΓΙΑΤΙΚΟΣ ΠΙΝΑΚΑΣ: το δηλώνει ΚΑΙ ΔΕΝ ΤΟΝ ΑΓΓΙΖΕΙ', () => {
    getTopoPoints.mockReturnValue([P1, P2_MOVED]);
    const api = actions(tableEntity(revisionFor([P1, P2]))).current;

    act(() => { api.check(); });

    expect(getTableBindingFreshness('tbl_1')).toEqual({
      status: 'stale',
      freshRevision: revisionFor([P1, P2_MOVED]),
    });
    // 🔴 Η καρδιά του Δ3: αν εδώ υπήρχε εντολή, ο πίνακας θα ξαναγέμιζε **μόνος του**.
    expect(executed).toHaveLength(0);
  });

  it('ενημερωμένος πίνακας: `fresh`, και πάλι καμία εντολή', () => {
    const api = actions(tableEntity(revisionFor([P1, P2]))).current;

    act(() => { api.check(); });

    expect(getTableBindingFreshness('tbl_1')).toEqual({ status: 'fresh' });
    expect(executed).toHaveLength(0);
  });
});

// ─── 6. 🔴 Ο ΚΑΤΑΝΑΛΩΤΗΣ του ελέγχου ─────────────────────────────────────────

/**
 * Χωρίς αυτόν, το `check` θα ήταν πεδίο χωρίς αναγνώστη — ακριβώς η αστοχία που το ADR-767
 * §8 #7 απαγορεύει ονομαστικά, μετατοπισμένη μία θέση.
 */
describe('🔴 ο έλεγχος τρέχει ΜΟΝΟΣ του — και ΠΟΤΕ δεν γράφει', () => {
  it('🔴 ΜΕ ΤΟ ΠΟΥ ΜΠΑΙΝΕΙ ΔΕΜΕΝΟΣ ΠΙΝΑΚΑΣ, Η ΟΘΟΝΗ ΞΕΡΕΙ', () => {
    getTopoPoints.mockReturnValue([P1, P2_MOVED]);

    actions(tableEntity(revisionFor([P1, P2])));

    expect(getTableBindingFreshness('tbl_1')).toEqual({
      status: 'stale',
      freshRevision: revisionFor([P1, P2_MOVED]),
    });
    expect(executed).toHaveLength(0);
  });

  it('🔴 ΜΕΤΑΚΙΝΗΣΗ ΚΟΡΥΦΗΣ ⇒ Η ΕΝΔΕΙΞΗ ΚΟΚΚΙΝΙΖΕΙ ΧΩΡΙΣ ΚΑΜΙΑ ΕΝΤΟΛΗ', () => {
    // Ξεκινά ενημερωμένος…
    actions(tableEntity(revisionFor([P1, P2])));
    expect(getTableBindingFreshness('tbl_1')).toEqual({ status: 'fresh' });

    // …και η αποτύπωση αλλάζει κάτω από αυτόν.
    getTopoPoints.mockReturnValue([P1, P2_MOVED]);
    act(() => { emitTopoChange(); });

    expect(getTableBindingFreshness('tbl_1')?.status).toBe('stale');
    // 🔴 Η καρδιά του Δ3: η εφαρμογή **κοίταξε**, ο πίνακας **δεν ξαναγέμισε**.
    expect(executed).toHaveLength(0);
  });

  it('στατικός πίνακας: η αλλαγή αποτύπωσης δεν γεννά καμία ετυμηγορία', () => {
    actions(staticEntity());

    act(() => { emitTopoChange(); });

    expect(getTableBindingFreshness('tbl_1')).toBeNull();
  });
});
