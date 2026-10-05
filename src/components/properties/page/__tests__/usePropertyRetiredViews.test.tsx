/**
 * 🗑️🗄️ usePropertyRetiredViews — η καλωδίωση κάδου + αρχείου της σελίδας ακινήτων (ADR-281 · ADR-329 §3.9).
 *
 * Οι δύο μηχανές κατάστασης έχουν δικά τους tests (`trash-state-bindings.test.tsx`). Εδώ κλειδώνεται ό,τι
 * ανήκει ΜΟΝΟ σε αυτό το hook, και που κανένα από εκείνα δεν μπορεί να κοκκινίσει:
 *   Α — αμοιβαίος αποκλεισμός: ποτέ και οι δύο προβολές ανοιχτές
 *   Σ — ποιες γραμμές δείχνει το σώμα (`retiredView`)
 *   Μ — ο μετρητής του αρχείου ξαναρωτιέται όταν αλλάζει το πλήθος των ενεργών — όχι με το αρχείο ανοιχτό
 */
import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { usePropertyRetiredViews } from '../usePropertyRetiredViews';

const mockFetchArchived = jest.fn().mockResolvedValue(undefined);
const TRASHED = [{ id: 't1' }];
const ARCHIVED = [{ id: 'a1' }, { id: 'a2' }];

// Ψεύτικες μηχανές με ΑΛΗΘΙΝΗ κατάσταση: ο αποκλεισμός είναι ιδιότητα της αλληλεπίδρασης δύο toggles,
// και ένα στατικό mock δεν θα μπορούσε να τον διαψεύσει.
jest.mock('@/hooks/usePropertiesTrashState', () => ({
  usePropertiesTrashState: () => {
    const [showTrash, setShowTrash] = useState(false);
    return {
      showTrash,
      trashCount: TRASHED.length,
      trashedProperties: TRASHED,
      loadingTrash: false,
      handleToggleTrash: async () => setShowTrash((open) => !open),
    };
  },
}));
jest.mock('@/hooks/usePropertiesArchiveState', () => ({
  usePropertiesArchiveState: () => {
    const [showArchive, setShowArchive] = useState(false);
    return {
      showArchive,
      archiveCount: ARCHIVED.length,
      archivedProperties: ARCHIVED,
      loadingArchive: false,
      handleToggleArchive: async () => setShowArchive((open) => !open),
      fetchArchivedProperties: mockFetchArchived,
    };
  },
}));
jest.mock('@/services/realtime', () => ({
  useRealtimePropertiesTrashCount: () => ({ trashCount: 7 }),
}));
jest.mock('@/components/properties/trash/PropertyTrashActionsBar', () => ({ PropertyTrashActionsBar: () => null }));
jest.mock('@/components/properties/trash/PropertyArchiveActionsBar', () => ({ PropertyArchiveActionsBar: () => null }));
jest.mock('@/components/properties/trash/PropertyTrashDialogs', () => ({ PropertyTrashDialogs: () => null }));

const setSelectedProperties = jest.fn();
const forceDataRefresh = jest.fn();

function renderViews(activePropertyCount = 10) {
  return renderHook(
    ({ count }: { count: number }) =>
      usePropertyRetiredViews({
        selectedPropertyIds: [],
        setSelectedProperties,
        forceDataRefresh,
        activePropertyId: null,
        activePropertyCount: count,
      }),
    { initialProps: { count: activePropertyCount } },
  );
}

beforeEach(() => jest.clearAllMocks());

describe('Α — αμοιβαίος αποκλεισμός', () => {
  it('Α1 — ανοίγοντας το αρχείο με τον κάδο ανοιχτό, ο κάδος κλείνει (και αντίστροφα)', async () => {
    // ⛔ MUTATION: βγάλε το `if (showTrash) void handleToggleTrash()` ⇒ και οι δύο ανοιχτές ⇒ κόκκινο.
    const { result } = renderViews();

    await act(async () => result.current.headerProps.onToggleTrash?.());
    expect(result.current.headerProps.showTrash).toBe(true);
    expect(result.current.headerProps.showArchive).toBe(false);

    await act(async () => result.current.headerProps.onToggleArchive?.());
    expect(result.current.headerProps.showTrash).toBe(false);
    expect(result.current.headerProps.showArchive).toBe(true);

    await act(async () => result.current.headerProps.onToggleTrash?.());
    expect(result.current.headerProps.showTrash).toBe(true);
    expect(result.current.headerProps.showArchive).toBe(false);
  });

  it('Α2 — το ίδιο κουμπί δύο φορές γυρίζει στην κανονική λίστα, χωρίς να ανοίξει η άλλη προβολή', async () => {
    const { result } = renderViews();
    await act(async () => result.current.headerProps.onToggleArchive?.());
    await act(async () => result.current.headerProps.onToggleArchive?.());
    expect(result.current.headerProps.showArchive).toBe(false);
    expect(result.current.headerProps.showTrash).toBe(false);
    expect(result.current.retiredView).toBeNull();
  });
});

describe('Σ — τι δείχνει το σώμα', () => {
  it('Σ1 — κανονική λίστα ⇒ null· κάδος ⇒ οι σβησμένες· αρχείο ⇒ οι αρχειοθετημένες', async () => {
    const { result } = renderViews();
    expect(result.current.retiredView).toBeNull();

    await act(async () => result.current.headerProps.onToggleTrash?.());
    expect(result.current.retiredView).toEqual({ loading: false, properties: TRASHED });

    await act(async () => result.current.headerProps.onToggleArchive?.());
    expect(result.current.retiredView).toEqual({ loading: false, properties: ARCHIVED });
  });

  it('Σ2 — οι μετρητές: ο κάδος από το realtime, το αρχείο από τη μηχανή του', () => {
    const { result } = renderViews();
    expect(result.current.headerProps.trashCount).toBe(7);
    expect(result.current.headerProps.archiveCount).toBe(ARCHIVED.length);
  });
});

describe('Μ — φρεσκάδα του μετρητή του αρχείου', () => {
  it('Μ1 — η πρώτη τιμή αγνοείται· αλλαγή στο πλήθος των ενεργών ξαναρωτά το αρχείο', () => {
    const { rerender } = renderViews(10);
    expect(mockFetchArchived).not.toHaveBeenCalled();

    rerender({ count: 10 });
    expect(mockFetchArchived).not.toHaveBeenCalled();

    rerender({ count: 9 });
    expect(mockFetchArchived).toHaveBeenCalledTimes(1);
  });

  it('Μ2 — με το αρχείο ΑΝΟΙΧΤΟ δεν ξαναρωτά (η πράξη ανανεώνει ήδη· δεύτερο fetch = αναβόσβημα φόρτωσης)', async () => {
    const { result, rerender } = renderViews(10);
    await act(async () => result.current.headerProps.onToggleArchive?.());

    rerender({ count: 11 });
    expect(mockFetchArchived).not.toHaveBeenCalled();
  });
});
