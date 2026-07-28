/**
 * ADR-718 Μ3 — το `StretchEntityCommand` συμμετέχει πλέον στον universal associative cascade
 * (ADR-540), όπως οι δύο άλλες οικογένειες εντολών.
 *
 * **Γιατί υπάρχει αυτό το αρχείο:** ήταν το τυφλό σημείο που γέννησε ολόκληρο το Μ3. Το σύρσιμο
 * λαβής κορυφής — η **πιο άμεση** αλλαγή γεωμετρίας που κάνει ο χρήστης — περνά από εδώ, και
 * ήταν η μόνη διαδρομή που δεν ενημέρωνε κανένα εξαρτημένο παράγωγο. Ένας reconciler χωρίς
 * κλήση δεν είναι reconciler· είναι σχόλιο (ADR-587 §6.1, το ίδιο μάθημα με τα anchors).
 *
 * Ελέγχεται **η καλωδίωση, όχι η αριθμητική**: τι ξανα-derive-άρεται ζει στο
 * `topo-source-cascade.test.ts` και στα δικά του suites· εδώ φυλάμε ότι ο cascade **καλείται
 * καθόλου**, και στους τρεις χρόνους (execute / undo / redo) — γιατί μια αναίρεση που δεν
 * επαναφέρει τα παράγωγα αφήνει την ίδια ακριβώς μπαγιάτικη κατάσταση από την άλλη μεριά.
 */

import type { ISceneManager, SceneEntity } from '../../interfaces';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';

jest.mock('../../../../bim/cascade/associative-geometry-reconcile', () => ({
  reconcileAssociativeGeometry: jest.fn(),
}));

import { StretchEntityCommand, type StretchParams } from '../StretchEntityCommand';
import { reconcileAssociativeGeometry } from '../../../../bim/cascade/associative-geometry-reconcile';

const mockReconcile = reconcileAssociativeGeometry as jest.Mock;

const POLY_ID = 'ent-poly';

const polyline = (): SceneEntity =>
  ({
    id: POLY_ID,
    type: 'polyline',
    layerId: 'lyr_test',
    closed: true,
    vertices: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
  } as unknown as SceneEntity);

/** Σύρσιμο της κορυφής 1 κατά (10, 0) — το σχήμα του «οικοπέδου» αλλάζει. */
const DRAG_VERTEX_1: StretchParams = {
  vertexMoves: [
    { entityId: POLY_ID, refs: [{ entityId: POLY_ID, kind: 'polyline-vertex', index: 1 }] },
  ],
  anchorMoves: [],
  displacement: { x: 10, y: 0 },
};

function command(): { cmd: StretchEntityCommand; sm: ISceneManager } {
  const sm = createMockSceneManager([polyline()], { getEntityIndex: () => -1 });
  return { cmd: new StretchEntityCommand(DRAG_VERTEX_1, sm), sm };
}

beforeEach(() => {
  mockReconcile.mockReset();
});

describe('StretchEntityCommand — universal associative cascade (ADR-540)', () => {
  it('execute ⇒ ο cascade τρέχει με την οντότητα που άλλαξε', () => {
    const { cmd, sm } = command();

    cmd.execute();

    expect(mockReconcile).toHaveBeenCalledTimes(1);
    expect(mockReconcile).toHaveBeenCalledWith([POLY_ID], sm);
  });

  it('undo ⇒ ο ΙΔΙΟΣ cascade, ώστε τα παράγωγα να γυρίσουν κι αυτά πίσω', () => {
    const { cmd } = command();
    cmd.execute();
    mockReconcile.mockReset();

    cmd.undo();

    expect(mockReconcile).toHaveBeenCalledWith([POLY_ID], expect.anything());
  });

  it('redo ⇒ ξανά, ταυτόσημα με το execute', () => {
    const { cmd } = command();
    cmd.execute();
    cmd.undo();
    mockReconcile.mockReset();

    cmd.redo();

    expect(mockReconcile).toHaveBeenCalledWith([POLY_ID], expect.anything());
  });

  it('χειρονομία που δεν άλλαξε τίποτα ⇒ κανένας cascade (μηδέν περιττή δουλειά)', () => {
    const sm = createMockSceneManager([], { getEntityIndex: () => -1 });
    const cmd = new StretchEntityCommand(DRAG_VERTEX_1, sm);

    cmd.execute();

    expect(mockReconcile).not.toHaveBeenCalled();
  });
});
