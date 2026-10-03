/**
 * ============================================================================
 * useEntityPageState — η διεύθυνση ΔΕΝ νικά τη χειροκίνητη επιλογή
 * (ADR-777 §8.31.12 · εύρημα Ε5 του ADR-898 §21.6)
 * ============================================================================
 *
 * 🔴 Μετρημένο ζωντανά 2026-10-03 στο `/buildings?buildingId=<Α>`: κλικ σε άλλο
 * κτίριο ⇒ η επιλογή έμενε Α· «Νέο Κτίριο» ⇒ η φόρμα άνοιγε με τις τιμές του Α
 * σε **επεξεργασία** ⇒ η αποθήκευση θα έγραφε **πάνω** στο Α. Αιτία: ο setter δεν
 * έγραφε τη διεύθυνση, και το effect επιλογής ξανάγραφε το Α σε κάθε αλλαγή.
 *
 * Τα tests οδηγούν το **πραγματικό** hook (όχι τον κώδικά του ως κείμενο).
 */

import { renderHook, act } from '@testing-library/react';
import { useEntityPageState, type EntityPageStateConfig } from '../useEntityPageState';
import { DRAFT_ENTITY_ID } from '@/lib/draft-entity-id';

interface Row {
  readonly id: string;
  readonly name: string;
}

const A: Row = { id: 'bldg_a', name: 'Α' };
const B: Row = { id: 'bldg_b', name: 'Β' };
const DRAFT: Row = { id: DRAFT_ENTITY_ID, name: '' };
const ITEMS: Row[] = [A, B];

const passThrough = (items: Row[]): Row[] => items;

const CONFIG: EntityPageStateConfig<Row, Record<string, never>> = {
  urlParamName: 'buildingId',
  loggerName: 'useEntityPageState.test',
  defaultFilters: {},
  filterFn: passThrough,
  hasAnswered: true,
};

function startAt(url: string): void {
  window.history.replaceState(null, '', url);
}

/** Η ειδοποίηση του `url-query-state` φεύγει σε microtask — βλ. `useSelectedEntityUrlState.test`. */
async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

async function mountAt(url: string, autoSelectFirstItem = true) {
  startAt(url);
  const hook = renderHook(() => useEntityPageState(ITEMS, { ...CONFIG, autoSelectFirstItem }));
  await settle();
  return hook;
}

const urlId = (): string | null => new URLSearchParams(window.location.search).get('buildingId');

describe('ADR-777 §8.31.12 — η χειροκίνητη επιλογή γράφει τη διεύθυνση (Ε5)', () => {
  it('ο σύνδεσμος ανοίγει την εγγραφή που ζητήθηκε', async () => {
    const { result } = await mountAt('/buildings?buildingId=bldg_a');
    expect(result.current.selectedItem?.id).toBe('bldg_a');
  });

  it('🔴 κλικ σε άλλη εγγραφή ⇒ μένει η νέα επιλογή, και η διεύθυνση την ακολουθεί', async () => {
    const { result } = await mountAt('/buildings?buildingId=bldg_a');

    act(() => result.current.setSelectedItem(B));
    await settle();

    expect(result.current.selectedItem?.id).toBe('bldg_b');
    expect(urlId()).toBe('bldg_b');
  });

  it('🔴 «Νέο» ⇒ κενή φόρμα — ΠΟΤΕ επεξεργασία της εγγραφής της διεύθυνσης', async () => {
    const { result } = await mountAt('/buildings?buildingId=bldg_a');

    act(() => result.current.setSelectedItem(DRAFT));
    await settle();

    expect(result.current.selectedItem).toBe(DRAFT);
    // Η ψευδο-ταυτότητα δεν είναι εγγραφή: ΔΕΝ γράφεται στη διεύθυνση.
    expect(urlId()).toBeNull();
    expect(window.location.search).not.toContain(DRAFT_ENTITY_ID);
  });

  it('αποεπιλογή ⇒ η παράμετρος σβήνει (αλλιώς ξαναγεννιέται η παλιά επιλογή)', async () => {
    const { result } = await mountAt('/buildings?buildingId=bldg_a', false);

    act(() => result.current.setSelectedItem(null));
    await settle();

    expect(result.current.selectedItem).toBeNull();
    expect(urlId()).toBeNull();
  });

  it('επεξεργασία με συνάρτηση ⇒ ίδια ταυτότητα, ίδια διεύθυνση', async () => {
    const { result } = await mountAt('/buildings?buildingId=bldg_a');

    act(() => result.current.setSelectedItem((prev) => (prev ? { ...prev, name: 'Α′' } : prev)));
    await settle();

    expect(result.current.selectedItem?.id).toBe('bldg_a');
    expect(urlId()).toBe('bldg_a');
  });

  it('εξωτερική πλοήγηση (σύνδεσμος / πίσω-εμπρός) εξακολουθεί να νικά', async () => {
    const { result } = await mountAt('/buildings?buildingId=bldg_a');
    act(() => result.current.setSelectedItem(B));
    await settle();

    act(() => startAt('/buildings?buildingId=bldg_a'));
    await settle();

    expect(result.current.selectedItem?.id).toBe('bldg_a');
  });

  it('σύνδεσμος που δεν οδηγεί πουθενά ⇒ η επόμενη χειροκίνητη επιλογή ΔΕΝ σβήνεται', async () => {
    const { result } = await mountAt('/buildings?buildingId=bldg_missing', false);
    expect(result.current.selection.kind).toBe('not-found');

    act(() => result.current.setSelectedItem(B));
    await settle();

    expect(result.current.selectedItem?.id).toBe('bldg_b');
    expect(result.current.selection.kind).toBe('selected');
  });

  it('άσχετες παράμετροι της διεύθυνσης επιβιώνουν', async () => {
    const { result } = await mountAt('/buildings?buildingId=bldg_a&floor=flr_1');

    act(() => result.current.setSelectedItem(B));
    await settle();

    expect(new URLSearchParams(window.location.search).get('floor')).toBe('flr_1');
  });
});
