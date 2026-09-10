/**
 * @fileoverview **Ο ΔΙΑΛΟΓΟΣ ΤΗΣ ΠΡΟΒΟΛΗΣ: κλεισμένη χειρονομία ΔΕΝ ξανανοίγει** — ADR-332 D27 Β13.
 * @related components/projects/tabs/locations/useLocationsMap (`useLocationsDragRouting`)
 *
 * 🔑 Ο διάλογος ανοίγει με `pending` και η ίδια χειρονομία ξαναφτάνει όταν απαντήσει η μηχανή. Αν
 * στο μεταξύ ο άνθρωπος πάτησε «Μόνο η θέση» / «Ακύρωση», η απάντηση δεν επιτρέπεται να τον ξανανοίξει.
 */

import { renderHook, act } from '@testing-library/react';
import type { ProjectAddress } from '@/types/project/addresses';
import type { PinDrop } from '@/components/shared/addresses/pin-drop';
import { useLocationsDragRouting, type VisibleAddress } from '../useLocationsMap';

const ADDRESS: ProjectAddress = {
  id: 'addr-16',
  street: 'Σαμοθράκης',
  number: '16',
  city: 'Ελευθέριο Κορδελιό',
  postalCode: '56334',
  country: 'Greece',
  type: 'site',
  isPrimary: true,
};
const VISIBLE: readonly VisibleAddress[] = [{ address: ADDRESS, originalIndex: 0 }];
const POINT = { lat: 40.6641899, lng: 22.8974273 };

const pending = (gesture: number): PinDrop => ({ point: POINT, gesture, text: { kind: 'pending' } });
const answered = (gesture: number): PinDrop => ({
  point: POINT,
  gesture,
  text: { kind: 'resolved', address: { street: 'Σαμοθράκης' } },
});

function mount() {
  return renderHook(() => useLocationsDragRouting({
    visibleAddresses: VISIBLE,
    isAddFormOpen: false,
    editingIndex: null,
    addEditorRef: { current: null },
    editEditorRef: { current: null },
  }));
}

describe('Β13 — ο διάλογος της προβολής έργου', () => {
  it('ΠΑΡΟΝΟΜΑΣΤΗΣ: η απάντηση της ΑΝΟΙΧΤΗΣ χειρονομίας αντικαθιστά την αναμονή', () => {
    const { result } = mount();

    act(() => result.current.handleCombinedDragUpdate(pending(101), 0));
    expect(result.current.pendingViewDrag?.drop.text.kind).toBe('pending');

    act(() => result.current.handleCombinedDragUpdate(answered(101), 0));
    expect(result.current.pendingViewDrag?.drop.text.kind).toBe('resolved');
  });

  it('🔴 «Μόνο η θέση» / «Ακύρωση» ενώ περίμενε ⇒ η καθυστερημένη απάντηση ΔΕΝ ξανανοίγει τον διάλογο', () => {
    const { result } = mount();

    act(() => result.current.handleCombinedDragUpdate(pending(102), 0));
    act(() => result.current.clearViewDrag());
    act(() => result.current.handleCombinedDragUpdate(answered(102), 0));

    expect(result.current.pendingViewDrag).toBeNull();
  });

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ: ΝΕΟΤΕΡΗ χειρονομία μετά το κλείσιμο ανοίγει κανονικά', () => {
    const { result } = mount();

    act(() => result.current.handleCombinedDragUpdate(pending(103), 0));
    act(() => result.current.clearViewDrag());
    act(() => result.current.handleCombinedDragUpdate(pending(104), 0));

    expect(result.current.pendingViewDrag?.drop.gesture).toBe(104);
  });
});
