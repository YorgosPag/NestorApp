/**
 * @fileoverview 🔴 **ΑΠΟΘΗΚΕΥΕΙ Η ΔΙΕΥΘΥΝΣΗ ΚΤΙΡΙΟΥ ΤΗ ΘΕΣΗ ΠΟΥ ΕΒΑΛΕ Ο ΑΝΘΡΩΠΟΣ;** — ADR-332 D27 Βήμα Β (Β3).
 * @related building-addresses-card/useBuildingAddressesCardState · shared/addresses/useFormPlacedPoint
 *
 * Ως τις 2026-09-10 **όχι**: ο συντάκτης κτιρίου έδινε στην αποθήκευση **μόνο κείμενο**
 * (`hierarchyToPartial`), οπότε ο διακομιστής ξαναρωτούσε τη μηχανή και η πινέζα του ανθρώπου
 * χανόταν — σε **κάθε** σύρσιμο, σιωπηλά.
 *
 * 🔑 **Εκτελείται ο πραγματικός** `useBuildingAddressesCardState` (εκεί ζει η αποθήκευση, άρα και
 * η θέση)· mock **μόνο** ο gateway, για να διαβαστεί **τι στάλθηκε**.
 */

import { act, renderHook } from '@testing-library/react';
import type { ProjectAddress } from '@/types/project/addresses';
import { updateBuildingWithPolicy } from '@/services/building/building-mutation-gateway';
import { useBuildingAddressesCardState } from '../building-addresses-card/useBuildingAddressesCardState';

jest.mock('@/services/building/building-mutation-gateway', () => ({
  updateBuildingWithPolicy: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock('../../../building-services', () => ({
  getProjectAddresses: jest.fn().mockResolvedValue({ addresses: [] }),
}));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock('@/hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({ confirm: jest.fn(), dialogProps: { open: false } }),
}));

/** Η πόρτα της Σαμοθράκης 16 (μετρημένη, ADR-332 D27) και ο δρόμος όπου την είχε η μηχανή. */
const DOOR = { lat: 40.6642462, lng: 22.8975146 };
const STREET_POINT = { lat: 40.6643548, lng: 22.8975059 };

const MANUAL_16: ProjectAddress = {
  id: 'bld-addr-16',
  street: 'Σαμοθράκης',
  number: '16',
  city: 'Ελευθέριο Κορδελιό',
  postalCode: '56334',
  country: 'Greece',
  type: 'site',
  isPrimary: true,
  coordinates: STREET_POINT,
  source: 'geocoded',
};

function lastSent(): ProjectAddress[] {
  const calls = jest.mocked(updateBuildingWithPolicy).mock.calls;
  return (calls[calls.length - 1][0].updates as { addresses: ProjectAddress[] }).addresses;
}

function renderCard(addresses: ProjectAddress[]) {
  return renderHook(() => useBuildingAddressesCardState({ buildingId: 'bld_dokimi', addresses }));
}

beforeEach(() => {
  jest.mocked(updateBuildingWithPolicy).mockClear();
});

describe('Β3 — επεξεργασία διεύθυνσης κτιρίου', () => {
  it('«Μόνο η θέση» ⇒ στάλθηκε η ΠΟΡΤΑ, `dragged`, και ο αριθμός 16 έμεινε', async () => {
    const { result } = renderCard([MANUAL_16]);

    act(() => { result.current.openEditEditor(0); });
    act(() => { result.current.editorPlacement.onPlace(DOOR); });
    await act(async () => { await result.current.saveEditor(); });

    const [sent] = lastSent();
    expect(sent.coordinates).toEqual(DOOR);
    expect(sent.source).toBe('dragged');
    expect(sent.number).toBe('16');
  });

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ: αποθήκευση ΧΩΡΙΣ σύρσιμο ⇒ καμία δήλωση, μένει η θέση της μηχανής', async () => {
    const { result } = renderCard([MANUAL_16]);

    act(() => { result.current.openEditEditor(0); });
    await act(async () => { await result.current.saveEditor(); });

    const [sent] = lastSent();
    expect(sent.coordinates).toEqual(STREET_POINT);
    expect(sent.source).toBe('geocoded');
  });

  it('ακύρωση ⇒ η θέση ΔΕΝ διαρρέει στην επόμενη εγγραφή', () => {
    const { result } = renderCard([MANUAL_16]);

    act(() => { result.current.openEditEditor(0); });
    act(() => { result.current.editorPlacement.onPlace(DOOR); });
    act(() => { result.current.cancelEditor(); });

    expect(result.current.editorPlacedPoint).toBeNull();
  });
});

describe('Β3 — νέα διεύθυνση κτιρίου', () => {
  it('η επιβεβαιωμένη θέση φτάνει στη ΝΕΑ εγγραφή — δηλωμένη', async () => {
    const { result } = renderCard([MANUAL_16]);

    act(() => { result.current.openCreateEditor(); });
    act(() => {
      result.current.setEditorAddress({ street: 'Σαμοθράκης', number: '18', city: 'Ελευθέριο Κορδελιό' });
    });
    act(() => { result.current.editorPlacement.onPlace(DOOR); });
    await act(async () => { await result.current.saveEditor(); });

    const created = lastSent()[1];
    expect(created.coordinates).toEqual(DOOR);
    expect(created.source).toBe('dragged');
  });
});
