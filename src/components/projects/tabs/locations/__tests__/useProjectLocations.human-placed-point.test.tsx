/**
 * @fileoverview **ΤΟ ΤΟΠΟΘΕΤΗΣΕ ΑΝΘΡΩΠΟΣ;** — η μία διάκριση, με δύο καταναλωτές. ADR-332 **D25 §πινέζα** · **D27 Βήμα Β**.
 * @related components/projects/tabs/locations/useProjectLocations · shared/addresses/useFormPlacedPoint
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — Η ΔΙΑΚΡΙΣΗ ΗΤΑΝ ΑΦΥΛΑΚΤΗ ΚΑΙ ΤΩΡΑ ΚΡΑΤΑΕΙ ΔΥΟ ΠΡΑΓΜΑΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η ερώτηση *«κάθεται η πινέζα εκεί που τη βρήκε, ή εκεί που την έβαλε άνθρωπος;»*
 * τρέφει την **αποθήκευση** και, από το **D25**, την **αφετηρία εγγύτητας**. Λάθος απάντηση
 * σημαίνει ότι οι προτάσεις μετριούνται από το **προεπιλεγμένο κέντρο Αθήνας**.
 *
 * 🔴 **Βήμα Β** — η ερώτηση ισχύει πλέον και για την **επεξεργασία**, όπου ως τις 2026-09-10
 * η συρμένη θέση **δεν αποθηκευόταν ποτέ** (Β2). Γι' αυτό η δεύτερη ομάδα **εκτελεί** την
 * πραγματική αποθήκευση (mock μόνο στον gateway) και διαβάζει **τι στάλθηκε**.
 */

import { renderHook, act } from '@testing-library/react';
import type { Project } from '@/types/project';
import type { ProjectAddress } from '@/types/project/addresses';
import { updateProjectWithPolicy } from '@/services/projects/project-mutation-gateway';
import { useProjectLocations } from '../useProjectLocations';

// --- Mocks ---

jest.mock('@/hooks/notifications/useProjectNotifications', () => {
  const address = {
    cityRequired: jest.fn(),
    added: jest.fn(),
    updated: jest.fn(),
    deleted: jest.fn(),
    cleared: jest.fn(),
    primaryUpdated: jest.fn(),
    saveError: jest.fn(),
    updateError: jest.fn(),
    deleteError: jest.fn(),
    clearError: jest.fn(),
    soleAddressMustBePrimary: jest.fn(),
  };
  return { useProjectNotifications: () => ({ address }) };
});

jest.mock('@/services/projects/project-mutation-gateway', () => ({
  updateProjectWithPolicy: jest.fn().mockResolvedValue({ success: true }),
}));

// --- Fixtures ---

/** Καλαμαριά — εκεί που ο άνθρωπος σέρνει την πινέζα. */
const DRAGGED_POINT = { lat: 40.58, lng: 22.95 };

/** Η πόρτα της Σαμοθράκης 16 (μετρημένη, ADR-332 D27). */
const DOOR = { lat: 40.6642462, lng: 22.8975146 };

/** Εκεί που την είχε βάλει η μηχανή: ο άξονας του δρόμου. */
const STREET_POINT = { lat: 40.6643548, lng: 22.8975059 };

const EMPTY_PROJECT = { id: 'p-1', addresses: [] } as unknown as Project;

const SAMOTHRAKIS_16: ProjectAddress = {
  id: 'addr-16',
  street: 'Σαμοθράκης',
  number: '16',
  city: 'Ελευθέριο Κορδελιό',
  postalCode: '56334',
  country: 'Greece',
  type: 'site',
  isPrimary: true,
  coordinates: STREET_POINT,
  source: 'geocoded',
  geocodingMetadata: { confidence: 0.6, accuracy: 'interpolated', variantUsed: 1 },
};

const PROJECT_16 = { id: 'p-16', addresses: [SAMOTHRAKIS_16] } as unknown as Project;

/** Ό,τι έφυγε προς τον διακομιστή στην τελευταία αποθήκευση. */
function lastSentAddresses(): ProjectAddress[] {
  const calls = jest.mocked(updateProjectWithPolicy).mock.calls;
  const updates = calls[calls.length - 1][0].updates as { addresses: ProjectAddress[] };
  return updates.addresses;
}

beforeEach(() => {
  jest.mocked(updateProjectWithPolicy).mockClear();
});

// --- Tests ---

describe('useProjectLocations — «το τοποθέτησε άνθρωπος;» (D25) · φόρμα ΠΡΟΣΘΗΚΗΣ', () => {
  it('🔴 μόλις ανοίξει η φόρμα: η πινέζα ΥΠΑΡΧΕΙ, αλλά ΔΕΝ είναι ανθρώπινη', () => {
    const { result } = renderHook(() => useProjectLocations(EMPTY_PROJECT));

    act(() => { result.current.handleOpenAddForm(); });

    // Η μαντεψιά υπάρχει — γι' αυτό ακριβώς χρειάζεται η διάκριση.
    expect(result.current.pendingDragCoords).not.toBeNull();
    expect(result.current.humanPlacedPoint).toBeNull();
  });

  it('μετά την ΕΠΙΒΕΒΑΙΩΣΗ: το σημείο γίνεται ανθρώπινο, είναι ΑΥΤΟ που έσυρε, και η πινέζα το δείχνει', () => {
    const { result } = renderHook(() => useProjectLocations(EMPTY_PROJECT));

    act(() => { result.current.handleOpenAddForm(); });
    act(() => { result.current.addPlacement.onPlace(DRAGGED_POINT); });

    expect(result.current.humanPlacedPoint).toEqual(DRAGGED_POINT);
    expect(result.current.pendingDragCoords).toEqual(DRAGGED_POINT);
  });

  it('ακύρωση: η ανθρώπινη πινέζα ΣΒΗΝΕΤΑΙ — δεν διαρρέει στην επόμενη εγγραφή', () => {
    const { result } = renderHook(() => useProjectLocations(EMPTY_PROJECT));

    act(() => { result.current.handleOpenAddForm(); });
    act(() => { result.current.addPlacement.onPlace(DRAGGED_POINT); });
    act(() => { result.current.handleCancelAdd(); });

    expect(result.current.humanPlacedPoint).toBeNull();
  });

  it('🔴 Β1β — η ΜΑΝΤΕΜΕΝΗ πινέζα δεν αποθηκεύεται ΠΟΤΕ: χωρίς επιβεβαίωση ⇒ καμία θέση στο payload', async () => {
    const { result } = renderHook(() => useProjectLocations(EMPTY_PROJECT));

    act(() => { result.current.handleOpenAddForm(); });
    act(() => { result.current.setAddHierarchy({ street: 'Εγνατία', settlementName: 'Θεσσαλονίκη' }); });
    await act(async () => { await result.current.handleSaveNewAddress(); });

    const [created] = lastSentAddresses();
    expect(created.coordinates).toBeUndefined();
    expect(created.source).toBeUndefined();
  });

  it('επιβεβαιωμένη θέση ⇒ ΔΗΛΩΝΕΤΑΙ (`dragged`) — ο διακομιστής αποφασίζει, ο πελάτης δηλώνει', async () => {
    const { result } = renderHook(() => useProjectLocations(EMPTY_PROJECT));

    act(() => { result.current.handleOpenAddForm(); });
    act(() => { result.current.setAddHierarchy({ street: 'Εγνατία', settlementName: 'Θεσσαλονίκη' }); });
    act(() => { result.current.addPlacement.onPlace(DRAGGED_POINT); });
    await act(async () => { await result.current.handleSaveNewAddress(); });

    const [created] = lastSentAddresses();
    expect(created.coordinates).toEqual(DRAGGED_POINT);
    expect(created.source).toBe('dragged');
  });
});

describe('Βήμα Β (Β2) — φόρμα ΕΠΕΞΕΡΓΑΣΙΑΣ: η θέση του χεριού ΑΠΟΘΗΚΕΥΕΤΑΙ', () => {
  it('«Μόνο η θέση» στην πόρτα ⇒ payload: σημείο της πόρτας, `dragged`, και ο αριθμός 16 ΜΕΝΕΙ', async () => {
    const { result } = renderHook(() => useProjectLocations(PROJECT_16));

    act(() => { result.current.handleStartEdit(0); });
    act(() => { result.current.editPlacement.onPlace(DOOR); });
    await act(async () => { await result.current.handleSaveEdit(); });

    const [edited] = lastSentAddresses();
    // Πριν: η επεξεργασία έστελνε τον ΔΡΟΜΟ (STREET_POINT) — η πόρτα χανόταν.
    expect(edited.coordinates).toEqual(DOOR);
    expect(edited.source).toBe('dragged');
    expect(edited.number).toBe('16');
    expect(edited.street).toBe('Σαμοθράκης');
  });

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ: επεξεργασία ΧΩΡΙΣ σύρσιμο ⇒ καμία δήλωση — μένει η αποθηκευμένη θέση και προέλευση', async () => {
    const { result } = renderHook(() => useProjectLocations(PROJECT_16));

    act(() => { result.current.handleStartEdit(0); });
    await act(async () => { await result.current.handleSaveEdit(); });

    const [edited] = lastSentAddresses();
    expect(edited.coordinates).toEqual(STREET_POINT);
    expect(edited.source).toBe('geocoded');
  });

  it('🔴 Β5 — ο πελάτης ΥΙΟΘΕΤΕΙ ό,τι έγραψε ο διακομιστής, όχι το αντίγραφο με το μπαγιάτικο `geocodingMetadata`', async () => {
    // Ο γραφέας θέσης σβήνει το `geocodingMetadata` σε ανθρώπινη πινέζα (`applyAddressPosition`).
    const { geocodingMetadata: _dropped, ...written } = {
      ...SAMOTHRAKIS_16, coordinates: DOOR, source: 'dragged' as const, verifiedAt: 1,
    };
    jest.mocked(updateProjectWithPolicy).mockResolvedValueOnce({ success: true, addresses: [written] });
    const { result } = renderHook(() => useProjectLocations(PROJECT_16));

    act(() => { result.current.handleStartEdit(0); });
    act(() => { result.current.editPlacement.onPlace(DOOR); });
    await act(async () => { await result.current.handleSaveEdit(); });

    // ΠΑΡΟΝΟΜΑΣΤΗΣ: ο πελάτης ΕΣΤΕΙΛΕ ακόμη το `interpolated` — γι' αυτό η κάρτα έλεγε «Στον δρόμο».
    expect(lastSentAddresses()[0].geocodingMetadata).toEqual(SAMOTHRAKIS_16.geocodingMetadata);
    expect(result.current.localAddresses[0]).toEqual(written);
    expect(result.current.localAddresses[0].geocodingMetadata).toBeUndefined();
  });

  it('αναίρεση του συρσίματος (`onRestore(null)`) ⇒ η αποθήκευση ΔΕΝ δηλώνει τίποτα', async () => {
    const { result } = renderHook(() => useProjectLocations(PROJECT_16));

    act(() => { result.current.handleStartEdit(0); });
    act(() => { result.current.editPlacement.onPlace(DOOR); });
    act(() => { result.current.editPlacement.onRestore(null); });
    await act(async () => { await result.current.handleSaveEdit(); });

    const [edited] = lastSentAddresses();
    expect(edited.coordinates).toEqual(STREET_POINT);
    expect(edited.source).toBe('geocoded');
  });
});

describe('Βήμα Β (Φ2β) — η ΑΠΟΚΛΙΣΗ της κρατημένης πινέζας φτάνει στον άνθρωπο, και η απάντησή του στον διακομιστή', () => {
  const ADVISORY = { addressId: 'addr-16', distanceMetres: 4_600, toleranceMetres: 50 };

  it('η απόκλιση της απάντησης γίνεται κατάσταση — και «Κράτα» τη σβήνει ΧΩΡΙΣ αποθήκευση', async () => {
    jest.mocked(updateProjectWithPolicy).mockResolvedValueOnce({ success: true, positionAdvisories: [ADVISORY] });
    const { result } = renderHook(() => useProjectLocations(PROJECT_16));

    act(() => { result.current.handleStartEdit(0); });
    await act(async () => { await result.current.handleSaveEdit(); });
    expect(result.current.positionAdvisories).toEqual([ADVISORY]);

    const savesBefore = jest.mocked(updateProjectWithPolicy).mock.calls.length;
    act(() => { result.current.handleKeepAddressPin('addr-16'); });

    expect(result.current.positionAdvisories).toEqual([]);
    expect(jest.mocked(updateProjectWithPolicy).mock.calls).toHaveLength(savesBefore);
  });

  it('«Μετακίνησε» ⇒ ρητή δήλωση `relocateAddressIds` για ΑΥΤΗ τη διεύθυνση — και μόνο αυτή', async () => {
    const { result } = renderHook(() => useProjectLocations(PROJECT_16));

    await act(async () => { await result.current.handleRelocateAddress('addr-16'); });

    const calls = jest.mocked(updateProjectWithPolicy).mock.calls;
    const updates = calls[calls.length - 1][0].updates as { relocateAddressIds?: string[] };
    expect(updates.relocateAddressIds).toEqual(['addr-16']);
  });

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ: συνηθισμένη αποθήκευση ΔΕΝ στέλνει δήλωση μετακίνησης', async () => {
    const { result } = renderHook(() => useProjectLocations(PROJECT_16));

    act(() => { result.current.handleStartEdit(0); });
    await act(async () => { await result.current.handleSaveEdit(); });

    const calls = jest.mocked(updateProjectWithPolicy).mock.calls;
    const updates = calls[calls.length - 1][0].updates as { relocateAddressIds?: string[] };
    expect(updates.relocateAddressIds).toBeUndefined();
  });
});
