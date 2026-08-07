/**
 * 🔴 ADR-769 Δ1 — **Ο ΕΚΤΕΛΕΣΤΗΣ**: εγκεκριμένο πλάνο → ΥΠΑΡΧΟΥΣΑ εντολή.
 *
 * Το αρχείο φυλάει τρία πράγματα που δεν φαίνονται πουθενά αλλού:
 *
 *  1. Ότι εκτελείται ο **ιδιοκτήτης του ADR-662** και όχι κάποια νέα εντολή — και ότι η
 *     εκτέλεση όντως **μετακινεί το σημείο στην απόλυτη τιμή** που ζήτησε ο πίνακας.
 *  2. Ότι πηγή **χωρίς ιδιοκτήτη** επιστρέφει `null` αντί να εκτελέσει κάτι άλλο. Οι τέσσερις
 *     ασύνδετες πηγές είναι σήμερα **δομικά απρόσιτες** (ο κριτής τις κόβει με `no-owner`),
 *     αλλά η κενή θέση θα γινόταν `undefined` σε χρόνο εκτέλεσης την ημέρα που κάποιος
 *     συνδέσει στήλη και ξεχάσει τον εκτελεστή.
 *  3. Ότι το `null` του «δεν μπόρεσε» ξεχωρίζει από κάθε άρνηση του κριτή.
 *
 * @see bim/table/write-back/table-write-back-owner.ts
 */

import { buildTableWriteBackCommand } from '../write-back/table-write-back-owner';
import { setTopoPoints } from '../../../systems/topography/TopoPointStore';
import { invalidateTopoSurveyPointIndex } from '../../../systems/topography/topo-survey-point-resolve';
import { getTopoPoints } from '../../../systems/topography/TopoPointStore';
import type { ISceneManager, SceneEntity } from '../../../core/commands';
import type { TopoPoint } from '../../../systems/topography/topo-types';

const P1 = { x: 391_600_000, y: 4_204_000_000, z: 12_000, code: 'ΣΤ1' } as TopoPoint;
const P2 = { x: 391_698_400, y: 4_204_500_000, z: 14_500, code: 'ΣΤ3' } as TopoPoint;

/** Σκηνή με **ένα** περίγραμμα επιφάνειας — ο δεύτερος μισός της ταυτότητας της εντολής. */
function scene(entities: readonly Partial<SceneEntity>[]): ISceneManager {
  const store = new Map(entities.map((e) => [String(e.id), e as SceneEntity]));
  return {
    getEntity: (id: string) => store.get(id),
    getEntities: () => [...store.values()],
    updateEntity: () => undefined,
  } as unknown as ISceneManager;
}

const withFootprint = () =>
  scene([{ id: 'surf-1', type: 'topo-surface', surfaceId: 'existing', footprint: [[]] } as unknown as SceneEntity]);

beforeEach(() => {
  invalidateTopoSurveyPointIndex();
  setTopoPoints([P1, P2]);
});

const ask = (overrides: Record<string, unknown> = {}) => ({
  sourceRef: { kind: 'survey-coordinates' } as const,
  sourceRowIndex: 1,
  field: 'x' as const,
  storeValue: 391_698_500,
  sceneManager: withFootprint(),
  ...overrides,
});

// ─── 1. Ο ιδιοκτήτης εκτελεί ─────────────────────────────────────────────────

describe('ADR-769 Δ1 — εκτελείται ο ΥΠΑΡΧΩΝ ιδιοκτήτης (ADR-662 §13)', () => {
  it('🏆 η εντολή μετακινεί την κορυφή στην ΑΠΟΛΥΤΗ τιμή — Υ και Ζ ανέγγιχτα', () => {
    const command = buildTableWriteBackCommand(ask());
    if (command === null) throw new Error('αναμενόταν εντολή');

    command.execute();
    expect(getTopoPoints()[1].x).toBe(391_698_500);
    expect(getTopoPoints()[1].y).toBe(P2.y);
    expect(getTopoPoints()[1].z).toBe(P2.z);
    expect(getTopoPoints()[0].x).toBe(P1.x);
  });

  it('🔴 το undo επαναφέρει — η γραφή του πίνακα είναι ΕΝΑ βήμα ιστορικού, όπως κάθε άλλη', () => {
    const command = buildTableWriteBackCommand(ask());
    if (command === null) throw new Error('αναμενόταν εντολή');
    command.execute();
    command.undo?.();
    expect(getTopoPoints()[1].x).toBe(P2.x);
  });

  it('γραφή στον άξονα Υ αγγίζει ΜΟΝΟ τον Υ — το delta του άλλου άξονα είναι μηδέν', () => {
    const command = buildTableWriteBackCommand(ask({ field: 'y', storeValue: 4_204_599_999 }));
    if (command === null) throw new Error('αναμενόταν εντολή');
    command.execute();
    expect(getTopoPoints()[1].y).toBe(4_204_599_999);
    expect(getTopoPoints()[1].x).toBe(P2.x);
  });
});

// ─── 2. Τα τρία «δεν μπόρεσε» ────────────────────────────────────────────────

describe('ADR-769 — ο κόσμος δεν επιτρέπει: ρητό null, ποτέ σιωπηλή γραφή', () => {
  it('🔴 ΧΩΡΙΣ περίγραμμα στη σκηνή ⇒ null — το βήμα «ξαναπαράγε το παράγωγο» δεν έχει στόχο', () => {
    expect(buildTableWriteBackCommand(ask({ sceneManager: scene([]) }))).toBeNull();
  });

  it('δείκτης εκτός ορίων ⇒ null, ποτέ γραφή στην πρώτη κορυφή', () => {
    expect(buildTableWriteBackCommand(ask({ sourceRowIndex: 7 }))).toBeNull();
  });

  it('μηδενική μετατόπιση ⇒ null — καμία κενή εγγραφή στο ιστορικό (N.7.2 #3)', () => {
    expect(buildTableWriteBackCommand(ask({ storeValue: P2.x }))).toBeNull();
  });

  it('περίγραμμα ΑΛΛΗΣ επιφάνειας δεν χρησιμεύει — η ταυτότητα ελέγχεται, δεν μαντεύεται', () => {
    const other = scene([
      { id: 'surf-2', type: 'topo-surface', surfaceId: 'proposed', footprint: [[]] } as unknown as SceneEntity,
    ]);
    expect(buildTableWriteBackCommand(ask({ sceneManager: other }))).toBeNull();
  });
});

// ─── 3. Οι πηγές ΧΩΡΙΣ ιδιοκτήτη ─────────────────────────────────────────────

describe('ADR-769 — ασύνδετη πηγή: δηλωμένη ονομαστικά, ποτέ κενή θέση', () => {
  it('🔴 καμία από τις τέσσερις δεν εκτελεί τίποτα — και ΔΕΝ πέφτει σε undefined', () => {
    for (const kind of ['survey-plot-boundary', 'survey-volumes', 'survey-tolerance'] as const) {
      expect(buildTableWriteBackCommand(ask({ sourceRef: { kind } }))).toBeNull();
      // Η κορυφή δεν κουνήθηκε ούτε κατά λάθος από κάποιον κοινό δρόμο.
      expect(getTopoPoints()[1].x).toBe(P2.x);
    }
  });

  it('το bim-schedule (ο ΔΕΥΤΕΡΟΣ καταναλωτής, Δ9) επίσης — μπαίνει με δική του απόφαση', () => {
    const request = { kind: 'bim-schedule', entityType: 'wall' } as const;
    expect(buildTableWriteBackCommand(ask({ sourceRef: request }))).toBeNull();
  });
});
