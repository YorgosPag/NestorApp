/**
 * @fileoverview **ΤΟ ΤΟΠΟΘΕΤΗΣΕ ΑΝΘΡΩΠΟΣ;** — η μία διάκριση, με δύο καταναλωτές. ADR-332 **D25 §πινέζα**.
 * @related components/projects/tabs/locations/useProjectLocations · utils/address/proximity-anchor
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — Η ΔΙΑΚΡΙΣΗ ΗΤΑΝ ΑΦΥΛΑΚΤΗ ΚΑΙ ΤΩΡΑ ΚΡΑΤΑΕΙ ΔΥΟ ΠΡΑΓΜΑΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η ερώτηση *«κάθεται η πινέζα εκεί που τη βρήκε, ή εκεί που την έβαλε άνθρωπος;»*
 * ζούσε ενσωματωμένη στην αποθήκευση, **χωρίς καμία άγκυρα** *(ο φάκελος είχε ένα μόνο
 * αρχείο test, για τους μετατροπείς)*. Ήταν ανεκτό όσο η λάθος απάντηση χαλούσε **ένα**
 * πράγμα: μια διεύθυνση αποθηκευμένη στην προεπιλεγμένη θέση.
 *
 * Από το **D25** η ίδια τιμή τρέφει και την **αφετηρία εγγύτητας**. Λάθος απάντηση τώρα
 * σημαίνει ότι η κατάταξη των προτάσεων μετριέται από το **προεπιλεγμένο κέντρο Αθήνας**
 * για κάθε νέο έργο — δηλαδή ανεβάζει τη λάθος πόλη **πρώτη**, εκεί ακριβώς που πατάει ο
 * κόσμος. **Δύο καταναλωτές μιας αφύλακτης τιμής δεν είναι αφύλακτη τιμή· είναι διπλή.**
 *
 * ⚠️ **Δεν είναι test του χάρτη ούτε της αποθήκευσης**: μοναδικό ερώτημα είναι η
 * **διάκριση**. Ό,τι άλλο κάνει το hook αντικαθίσταται όσο δεν έχει γνώμη γι' αυτήν.
 */

import { renderHook, act } from '@testing-library/react';
import type { Project } from '@/types/project';
import { useProjectLocations } from '../useProjectLocations';

// --- Mocks ---

jest.mock('@/hooks/notifications/useProjectNotifications', () => ({
  useProjectNotifications: () => ({
    address: {
      cityRequired: jest.fn(),
      saved: jest.fn(),
      saveFailed: jest.fn(),
      deleted: jest.fn(),
      updated: jest.fn(),
    },
  }),
}));

jest.mock('@/services/projects/project-mutation-gateway', () => ({
  updateProjectWithPolicy: jest.fn().mockResolvedValue({ success: true }),
}));

// --- Fixtures ---

/** Καλαμαριά — εκεί που ο άνθρωπος σέρνει την πινέζα. */
const DRAGGED_POINT = { lat: 40.58, lng: 22.95 };

const EMPTY_PROJECT = { id: 'p-1', addresses: [] } as unknown as Project;

// --- Tests ---

describe('useProjectLocations — «το τοποθέτησε άνθρωπος;» (D25)', () => {
  it('🔴 μόλις ανοίξει η φόρμα: η πινέζα ΥΠΑΡΧΕΙ, αλλά ΔΕΝ είναι ανθρώπινη', () => {
    const { result } = renderHook(() => useProjectLocations(EMPTY_PROJECT));

    act(() => { result.current.handleOpenAddForm(); });

    // Η μαντεψιά υπάρχει — γι' αυτό ακριβώς χρειάζεται η διάκριση.
    expect(result.current.pendingDragCoords).not.toBeNull();
    expect(result.current.humanPlacedPoint).toBeNull();
  });

  it('μετά το σύρσιμο: το σημείο γίνεται ανθρώπινο και είναι ΑΥΤΟ που έσυρε', () => {
    const { result } = renderHook(() => useProjectLocations(EMPTY_PROJECT));

    act(() => { result.current.handleOpenAddForm(); });
    act(() => { result.current.handlePendingDragUpdate({ coordinates: DRAGGED_POINT }); });

    expect(result.current.humanPlacedPoint).toEqual(DRAGGED_POINT);
  });

  it('🔴 ενημέρωση ΧΩΡΙΣ συντεταγμένες (αντίστροφη γεωκωδικοποίηση) δεν κάνει την πινέζα ανθρώπινη', () => {
    // Το `handlePendingDragUpdate` καλείται και για να γεμίσει πεδία της φόρμας. Μόνο η
    // κλήση που κουβαλά **σημείο** είναι σύρσιμο· μια υλοποίηση που σήκωνε τη σημαία σε
    // κάθε κλήση θα έκανε ανθρώπινη μια πινέζα που κανείς δεν άγγιξε.
    const { result } = renderHook(() => useProjectLocations(EMPTY_PROJECT));

    act(() => { result.current.handleOpenAddForm(); });
    act(() => { result.current.handlePendingDragUpdate({ street: 'Εγνατία' }); });

    expect(result.current.humanPlacedPoint).toBeNull();
  });

  it('ακύρωση: η ανθρώπινη πινέζα ΣΒΗΝΕΤΑΙ — δεν διαρρέει στην επόμενη εγγραφή', () => {
    const { result } = renderHook(() => useProjectLocations(EMPTY_PROJECT));

    act(() => { result.current.handleOpenAddForm(); });
    act(() => { result.current.handlePendingDragUpdate({ coordinates: DRAGGED_POINT }); });
    act(() => { result.current.handleCancelAdd(); });

    expect(result.current.humanPlacedPoint).toBeNull();
  });
});
