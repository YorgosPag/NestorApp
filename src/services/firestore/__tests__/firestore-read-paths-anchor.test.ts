/**
 * @fileoverview **ΑΓΚΥΡΑ Α22 — οι δρόμοι ανάγνωσης των λιστών `files`** (ADR-862 Φ0 Β11).
 * @related services/firestore/firestore-read-paths · services/firestore/read-scope-config ·
 *          lib/files/file-visibility-scope · firestore.rules `allow list`
 *
 * 🔴 Το Firestore κρίνει τα `list` από τα φίλτρα: κάθε client λίστα `files` ΠΡΕΠΕΙ να
 * δηλώνει `cdeReadReach == tenant` **ή** `createdBy == uid`, αλλιώς απορρίπτεται ΟΛΟΚΛΗΡΗ.
 * Η άγκυρα κλειδώνει:
 *  (α) τους ΔΥΟ δρόμους των `files` και τον ΕΝΑ δρόμο χωρίς φίλτρο των άλλων συλλογών,
 *  (β) την ένωση: διπλότυπα κατά `id`, σειρά πρώτου δρόμου, όριο αποτελεσμάτων,
 *  (γ) καμία μερική παράδοση στην ακρόαση, και σφάλμα οποιουδήποτε δρόμου ⇒ `onError`.
 */

type Snapshot = { docs: { id: string; data: () => Record<string, unknown> }[] };
type SnapshotHandler = (snapshot: Snapshot) => void;

const mockListeners: { next: SnapshotHandler; error: (e: Error) => void }[] = [];

jest.mock('firebase/firestore', () => ({
  where: jest.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  onSnapshot: jest.fn((_q: unknown, next: SnapshotHandler, error: (e: Error) => void) => {
    mockListeners.push({ next, error });
    return jest.fn();
  }),
}));

import type { Query, QuerySnapshot } from 'firebase/firestore';

import {
  listenToPaths,
  mergePathDocuments,
  resultOfSnapshots,
} from '../firestore-read-paths';
import { buildReadPaths, hasReadPaths, READ_PATH_FIELDS } from '../read-scope-config';

const snap = (...ids: string[]): Snapshot => ({
  docs: ids.map(id => ({ id, data: () => ({ name: id }) })),
});
const asSnapshot = (s: Snapshot): QuerySnapshot => s as unknown as QuerySnapshot;
const QUERY = {} as Query;

beforeEach(() => {
  mockListeners.length = 0;
});

describe('Α22 (α) — οι δρόμοι ανά συλλογή', () => {
  it('files: ΔΥΟ δρόμοι — φράχτης γραφείου και «τα δικά μου»', () => {
    expect(buildReadPaths('FILES', 'u-1')).toEqual([
      [{ field: 'cdeReadReach', op: '==', value: 'tenant' }],
      [{ field: 'createdBy', op: '==', value: 'u-1' }],
    ]);
    expect(hasReadPaths('FILES')).toBe(true);
  });

  it('ο πίνακας πεδίων της πύλης 3.15 ΣΥΜΦΩΝΕΙ με ό,τι παράγουν οι δρόμοι — ποτέ δεύτερη αλήθεια', () => {
    const produced = buildReadPaths('FILES', 'u-1').map(
      path => (path[0] as unknown as { field: string }).field,
    );
    expect(produced).toEqual(READ_PATH_FIELDS.FILES);
  });

  it('συλλογή χωρίς φράχτη: ΕΝΑΣ δρόμος, κανένα φίλτρο — η σημερινή συμπεριφορά', () => {
    expect(buildReadPaths('PROJECTS', 'u-1')).toEqual([[]]);
    expect(hasReadPaths('PROJECTS')).toBe(false);
  });
});

describe('Α22 (β) — η ένωση', () => {
  it('διπλότυπο κατά id εμφανίζεται ΜΙΑ φορά, στη θέση του πρώτου δρόμου', () => {
    const merged = mergePathDocuments([
      [{ id: 'a' }, { id: 'b' }],
      [{ id: 'b' }, { id: 'c' }],
    ]);
    expect(merged.map(d => d.id)).toEqual(['a', 'b', 'c']);
  });

  it('ένας δρόμος: ο δρομέας σελιδοποίησης μένει· πολλοί: `null`', () => {
    const single = resultOfSnapshots<{ id: string }>([asSnapshot(snap('a', 'b'))]);
    expect(single.lastDocument).not.toBeNull();
    const union = resultOfSnapshots<{ id: string }>([asSnapshot(snap('a')), asSnapshot(snap('b'))]);
    expect(union.lastDocument).toBeNull();
    expect(union.size).toBe(2);
  });

  it('το όριο κόβεται ΞΑΝΑ μετά την ένωση (findByHash με όριο 1 ⇒ 1, όχι 2)', () => {
    const union = resultOfSnapshots<{ id: string }>(
      [asSnapshot(snap('a')), asSnapshot(snap('b'))],
      1,
    );
    expect(union.documents.map(d => d.id)).toEqual(['a']);
  });
});

describe('Α22 (γ) — η ακρόαση', () => {
  it('ΚΑΜΙΑ μερική παράδοση: μόνο όταν απαντήσουν ΟΛΟΙ οι δρόμοι', () => {
    const deliver = jest.fn();
    listenToPaths<{ id: string }>([QUERY, QUERY], undefined, deliver, jest.fn());
    mockListeners[0].next(snap('a'));
    expect(deliver).not.toHaveBeenCalled();
    mockListeners[1].next(snap('b'));
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver.mock.calls[0][0].documents.map((d: { id: string }) => d.id)).toEqual(['a', 'b']);
  });

  it('σφάλμα ΟΠΟΙΟΥΔΗΠΟΤΕ δρόμου φτάνει στον onError — ποτέ σιωπηλή απώλεια του WIP μου', () => {
    const onError = jest.fn();
    listenToPaths<{ id: string }>([QUERY, QUERY], undefined, jest.fn(), onError);
    mockListeners[1].error(new Error('missing-index'));
    expect(onError).toHaveBeenCalledWith(new Error('missing-index'));
  });
});
