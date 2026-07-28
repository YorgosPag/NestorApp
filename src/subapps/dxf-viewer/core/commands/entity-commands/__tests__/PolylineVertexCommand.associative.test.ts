/**
 * ADR-718 §Β — η **ζωντανή** διαδρομή «Προσθήκη / Αφαίρεση κορυφής» μπαίνει στον universal
 * associative cascade (ADR-540).
 *
 * ── Το κενό που κλείνει ─────────────────────────────────────────────────────────────────────
 * Το Μ3 έβαλε τον cascade στην οικογένεια `EntityVertexCommand` (`AddVertexCommand`,
 * `RemoveVertexCommand`, `MoveVertexCommand`) — και ο έλεγχος έδειξε πράσινο. Μόνο που οι δύο
 * πρώτες είναι **νεκρές**: καμία χειρονομία δεν τις δημιουργεί (φτάνουν μόνο με replay
 * σειριοποιημένης εντολής). Η πραγματική «Προσθήκη κορυφής» του multifunctional grip menu
 * περνά από τον **`PolylineVertexCommand`**, που δεν καλούσε κανέναν reconciler.
 *
 * Αποτέλεσμα στο σχέδιο: το όριο οικοπέδου ακολουθούσε το **σύρσιμο** λαβής αλλά **όχι** την
 * προσθήκη κορυφής — η κοπή έμενε στο παλιό σχήμα, σιωπηλά, δηλαδή με λάθος όγκους εκσκαφής.
 * Ίδιο κενό, άλλη πόρτα· και ήταν αόρατο ακριβώς επειδή ο δίδυμος ήταν καλυμμένος.
 *
 * @see ../PolylineVertexCommand
 * @see ./SetPolylineClosureCommand.test.ts — η αδελφή εντολή του §Β
 * @see ./SnapshotTransformCommand.topo-cascade.test.ts — το ίδιο idiom για την οικογένεια μετασχηματισμού
 */

import type { SceneEntity } from '../../interfaces';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';

jest.mock('../../../../bim/cascade/associative-geometry-reconcile', () => ({
  reconcileAssociativeGeometry: jest.fn(),
}));

import { PolylineVertexCommand, type PolylineVertexOp } from '../PolylineVertexCommand';
import { reconcileAssociativeGeometry } from '../../../../bim/cascade/associative-geometry-reconcile';

const mockReconcile = reconcileAssociativeGeometry as jest.Mock;

const ID = 'ent-boundary-poly';

const polyline = (): SceneEntity =>
  ({
    id: ID,
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

const OPS: ReadonlyArray<[string, PolylineVertexOp]> = [
  ['add', { kind: 'add', index: 2, position: { x: 100, y: 50 } }],
  ['remove', { kind: 'remove', index: 1 }],
];

beforeEach(() => {
  mockReconcile.mockReset();
});

describe.each(OPS)('PolylineVertexCommand «%s» — universal associative cascade', (_label, op) => {
  it('execute ⇒ ο cascade τρέχει με την πολυγραμμή που άλλαξε σχήμα', () => {
    const sm = createMockSceneManager([polyline()]);

    new PolylineVertexCommand({ entityId: ID, op }, sm).execute();

    expect(mockReconcile).toHaveBeenCalledTimes(1);
    expect(mockReconcile).toHaveBeenCalledWith([ID], sm);
  });

  it('undo ⇒ ο ΙΔΙΟΣ cascade — αλλιώς η αναίρεση αφήνει το όριο στο νέο σχήμα', () => {
    const cmd = new PolylineVertexCommand({ entityId: ID, op }, createMockSceneManager([polyline()]));
    cmd.execute();
    mockReconcile.mockReset();

    cmd.undo();

    expect(mockReconcile).toHaveBeenCalledTimes(1);
  });

  it('redo ⇒ ξανά', () => {
    const cmd = new PolylineVertexCommand({ entityId: ID, op }, createMockSceneManager([polyline()]));
    cmd.execute();
    cmd.undo();
    mockReconcile.mockReset();

    cmd.redo();

    expect(mockReconcile).toHaveBeenCalledTimes(1);
  });
});

describe('πύλη κόστους — άπρακτη εντολή δεν ξυπνά τον cascade', () => {
  it('άγνωστη οντότητα ⇒ κανένας cascade', () => {
    const sm = createMockSceneManager([polyline()]);

    new PolylineVertexCommand({ entityId: 'ent-missing', op: OPS[1][1] }, sm).execute();

    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('αφαίρεση που θα άφηνε λιγότερες από 2 κορυφές ⇒ καμία εγγραφή, κανένας cascade', () => {
    const two = {
      ...(polyline() as unknown as { id: string }),
      id: ID,
      type: 'polyline',
      layerId: 'lyr_test',
      closed: false,
      vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    } as unknown as SceneEntity;
    const sm = createMockSceneManager([two]);

    new PolylineVertexCommand({ entityId: ID, op: { kind: 'remove', index: 0 } }, sm).execute();

    expect(mockReconcile).not.toHaveBeenCalled();
  });
});
