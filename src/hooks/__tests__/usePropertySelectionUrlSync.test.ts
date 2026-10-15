/**
 * @fileoverview ADR-840 Σ3 — η επιλογή ακινήτου ⇄ `?selected=`, αμφίδρομα και χωρίς βρόχο.
 *
 * Οι τρεις τρόποι αστοχίας που φυλάγονται (όλοι «φαίνονται» σωστοί σε απλή δοκιμή):
 *  1. η άφιξη με `?selected=` **σβήνεται** από την αρχική κενή επιλογή (εγγραφή πριν την ανάγνωση)·
 *  2. το «πίσω» (αλλαγή URL) **ξαναγράφεται** από την παλιά επιλογή (η εγγραφή ακούει και το URL)·
 *  3. η πολλαπλή επιλογή **καθαρίζεται** επειδή το URL χωρά μόνο μία.
 */

import { act, renderHook } from '@testing-library/react';

import {
  NEW_PROPERTY_SELECTION_ID,
  primarySelection,
  usePropertySelectionUrlSync,
  type PropertySelectionUrlSyncArgs,
} from '../usePropertySelectionUrlSync';

const CATALOG = [
  { id: 'p1', floorId: 'f1' },
  { id: 'p2', floorId: 'f2' },
  { id: 'p3' },
];

function startAt(url: string): void {
  window.history.replaceState(null, '', url);
}

const selectedParam = (): string | null => new URLSearchParams(window.location.search).get('selected');

/** Η ειδοποίηση του `url-query-state` φεύγει σε microtask. */
const flush = () => act(async () => { await Promise.resolve(); });

type Props = Pick<PropertySelectionUrlSyncArgs, 'urlSelectedId' | 'selectedIds' | 'properties'> & { enabled?: boolean };

function setup(initial: Props) {
  const select = jest.fn();
  const onSelectFloor = jest.fn();
  const view = renderHook(
    (props: Props) => usePropertySelectionUrlSync({ enabled: true, select, onSelectFloor, ...props }),
    { initialProps: initial },
  );
  return { ...view, select, onSelectFloor };
}

describe('primarySelection', () => {
  it('μόνο ΜΙΑ επιλογή είναι κύρια· ποτέ το πρότυπο δημιουργίας', () => {
    expect(primarySelection(['p1'])).toBe('p1');
    expect(primarySelection(['p1', 'p2'])).toBeNull();
    expect(primarySelection([NEW_PROPERTY_SELECTION_ID])).toBeNull();
  });
});

describe('usePropertySelectionUrlSync', () => {
  beforeEach(() => startAt('/o/ws/properties'));

  it('άφιξη με `?selected=` ⇒ επιλέγεται (και ο όροφός του) — ΔΕΝ σβήνεται από την κενή επιλογή', async () => {
    startAt('/o/ws/properties?selected=p2');
    const { select, onSelectFloor } = setup({ urlSelectedId: 'p2', selectedIds: [], properties: CATALOG });
    await flush();
    expect(select).toHaveBeenCalledWith(['p2']);
    expect(onSelectFloor).toHaveBeenCalledWith('f2');
    expect(selectedParam()).toBe('p2');
  });

  it('η επιλογή περιμένει τον κατάλογο — δεν «καθαρίζει» πριν φτάσουν τα δεδομένα', async () => {
    startAt('/o/ws/properties?selected=p2');
    const { select, rerender } = setup({ urlSelectedId: 'p2', selectedIds: [], properties: [] });
    await flush();
    expect(select).not.toHaveBeenCalled();
    rerender({ urlSelectedId: 'p2', selectedIds: [], properties: CATALOG });
    expect(select).toHaveBeenCalledWith(['p2']);
  });

  it('ο άνθρωπος επιλέγει ⇒ γράφεται `?selected=` (replace — καμία νέα εγγραφή ιστορικού)', async () => {
    const { rerender } = setup({ urlSelectedId: null, selectedIds: [], properties: CATALOG });
    const before = window.history.length;
    rerender({ urlSelectedId: null, selectedIds: ['p1'], properties: CATALOG });
    await flush();
    expect(selectedParam()).toBe('p1');
    expect(window.history.length).toBe(before);
  });

  it('«πίσω» σε άλλη επιλογή ⇒ ακολουθείται, ΔΕΝ ξαναγράφεται η παλιά', async () => {
    // ⛔ MUTATION: βάλε το `urlSelectedId` στις εξαρτήσεις της εγγραφής ⇒ η p1 ξαναγράφεται ⇒ κόκκινο.
    startAt('/o/ws/properties?selected=p1');
    const { rerender, select } = setup({ urlSelectedId: 'p1', selectedIds: ['p1'], properties: CATALOG });
    startAt('/o/ws/properties?selected=p3');
    rerender({ urlSelectedId: 'p3', selectedIds: ['p1'], properties: CATALOG });
    await flush();
    expect(select).toHaveBeenLastCalledWith(['p3']);
    expect(selectedParam()).toBe('p3');
  });

  it('πολλαπλή επιλογή ⇒ το κλειδί σβήνεται, η επιλογή ΔΕΝ καθαρίζεται', async () => {
    startAt('/o/ws/properties?selected=p1');
    const { rerender, select } = setup({ urlSelectedId: 'p1', selectedIds: ['p1'], properties: CATALOG });
    rerender({ urlSelectedId: 'p1', selectedIds: ['p1', 'p2'], properties: CATALOG });
    await flush();
    expect(selectedParam()).toBeNull();
    rerender({ urlSelectedId: null, selectedIds: ['p1', 'p2'], properties: CATALOG });
    expect(select).not.toHaveBeenCalledWith([]);
  });

  it('η δημιουργία δεν γράφει ποτέ `__new__` — σβήνει την επιλογή (καμία μπαγιάτικη μετά από ακύρωση)', async () => {
    startAt('/o/ws/properties?selected=p1');
    const { rerender } = setup({ urlSelectedId: 'p1', selectedIds: ['p1'], properties: CATALOG });
    rerender({ urlSelectedId: 'p1', selectedIds: [NEW_PROPERTY_SELECTION_ID], properties: CATALOG });
    await flush();
    expect(selectedParam()).toBeNull();
  });

  it('άγνωστη ταυτότητα στον σύνδεσμο ⇒ αγνοείται, η οθόνη δεν σκάει', async () => {
    const { select } = setup({ urlSelectedId: 'ghost', selectedIds: [], properties: CATALOG });
    await flush();
    expect(select).not.toHaveBeenCalled();
  });

  it('όταν τη ταυτότητα την ξέρει η ΔΙΑΔΡΟΜΗ (`/properties/[id]`) ⇒ καμία επαφή με τη διεύθυνση', async () => {
    const { rerender, select } = setup({ urlSelectedId: null, selectedIds: [], properties: CATALOG, enabled: false });
    rerender({ urlSelectedId: null, selectedIds: ['p1'], properties: CATALOG, enabled: false });
    await flush();
    expect(selectedParam()).toBeNull();
    expect(select).not.toHaveBeenCalled();
  });
});
