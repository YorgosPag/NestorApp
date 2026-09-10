/**
 * Άγκυρες — το επιβεβαιωμένο σύρσιμο στις διευθύνσεις επαφής (ADR-332 D27 Β-ΙΙ Φ4)
 *
 * Τρέχει ο **πραγματικός** ιδιοκτήτης της έδρας (`useHqAddressMutations`) — ό,τι φτάνει στο
 * `setFormData` είναι ό,τι θα αποθηκευτεί. Καμία mock πέρα από το ίδιο το `setFormData`.
 *
 * 🔴 Φυλάνε και δύο σφάλματα του παλιού `applyDragToBranch` (μετρημένα στον κώδικα, 2026-09-11):
 * σύρσιμο **υποκαταστήματος** μηδένιζε την ιεραρχία **της έδρας**, και **δεν** μηδένιζε τη δική του.
 */

import type { SetStateAction } from 'react';
import { act, renderHook } from '@testing-library/react';
import type { CompanyAddress, ContactFormData } from '@/types/ContactFormTypes';
import { initialFormData } from '@/types/ContactFormTypes';
import { useHqAddressMutations } from '../use-hq-address-mutations';
import { toContactDraggedAddress, type DragResolvedAddress } from '@/components/contacts/details/contact-pin-drop';

const POINT = { lat: 40.6329, lng: 22.9480 };
const DRAGGED: DragResolvedAddress = {
  street: 'Εγνατίας', number: '12', postalCode: '54630', city: 'Θεσσαλονίκη',
  neighborhood: 'Κέντρο', region: 'Κεντρική Μακεδονία', country: 'Ελλάδα',
};

const HQ: CompanyAddress = {
  id: 'addr_hq', type: 'headquarters', street: 'Αγγελάκη', number: '5', postalCode: '54621',
  city: 'Θεσσαλονίκη', municipalityName: 'Θεσσαλονίκης', municipalityId: 'm_thess',
};
const BRANCH: CompanyAddress = {
  id: 'addr_br', type: 'branch', street: 'Μοναστηρίου', number: '10', postalCode: '56121', city: 'Εύοσμος',
  municipalityName: 'Κορδελιού-Ευόσμου', municipalityId: 'm_kord',
  coordinates: { lat: 40.66, lng: 22.91 }, source: 'geocoded', verifiedAt: 5,
  geocodingMetadata: { confidence: 0.9, accuracy: 'exact', variantUsed: 1 },
};

function form(partial: Partial<ContactFormData> = {}): ContactFormData {
  return {
    ...initialFormData,
    type: 'company', companyName: 'ALFA',
    street: HQ.street, streetNumber: HQ.number, postalCode: HQ.postalCode, city: HQ.city,
    municipality: 'Θεσσαλονίκης', municipalityId: 'm_thess', neighborhood: 'Άνω Πόλη',
    companyAddresses: [HQ, BRANCH],
    ...partial,
  };
}

/** Το `formData` μένει ΣΤΑΘΕΡΟ ανάμεσα στις κλήσεις — ακριβώς το κλειστό `formData` του γονιού. */
function setup(formData: ContactFormData) {
  const writes: ContactFormData[] = [];
  const setFormData = jest.fn((value: SetStateAction<ContactFormData>) => {
    writes.push(typeof value === 'function' ? value(formData) : value);
  });
  const onDragMissingNumber = jest.fn();
  const { result } = renderHook(() => useHqAddressMutations({
    formData,
    setFormData,
    effectiveAddresses: formData.companyAddresses ?? [],
    onDragMissingNumber,
  }));
  const last = () => writes[writes.length - 1];
  return { result, writes, last, onDragMissingNumber };
}

describe('ADR-332 D27 Β-ΙΙ Φ4 — υποκατάστημα', () => {
  it('«Ναι, ενημέρωσε» ⇒ κείμενο + θέση + ΔΙΚΗ ΤΟΥ ιεραρχία καθαρή· η έδρα ΑΝΕΓΓΙΧΤΗ', () => {
    const { result, last } = setup(form());
    act(() => result.current.applyConfirmedDrag(DRAGGED, 1, POINT));

    const branch = last().companyAddresses![1];
    expect(branch).toMatchObject({ id: 'addr_br', street: 'Εγνατίας', number: '12', coordinates: POINT, source: 'dragged' });
    expect(branch.municipalityName).toBe('');
    expect(branch.municipalityId).toBeNull();
    // Τα επίπεδα πεδία της ΕΔΡΑΣ δεν αγγίζονται από σύρσιμο υποκαταστήματος.
    expect(last().municipality).toBe('Θεσσαλονίκης');
    expect(last().municipalityId).toBe('m_thess');
    expect(last().neighborhood).toBe('Άνω Πόλη');
  });

  it('«Μόνο η θέση» ⇒ μόνο θέση· κείμενο ίδιο· τα μπαγιάτικα μεταδεδομένα της μηχανής φεύγουν', () => {
    const { result, last } = setup(form());
    act(() => result.current.applyConfirmedDrag(null, 1, POINT));

    const branch = last().companyAddresses![1];
    expect(branch).toMatchObject({ street: 'Μοναστηρίου', municipalityName: 'Κορδελιού-Ευόσμου', coordinates: POINT, source: 'dragged' });
    expect(branch.verifiedAt).toBeUndefined();
    expect(branch.geocodingMetadata).toBeUndefined();
  });
});

describe('ADR-332 D27 Β-ΙΙ Φ4 — έδρα', () => {
  it('«Ναι, ενημέρωσε» ⇒ θέση στη θέση 0 ΚΑΙ επίπεδα πεδία με καθαρή ιεραρχία (ADR-277)', () => {
    const { result, last, onDragMissingNumber } = setup(form());
    act(() => result.current.applyConfirmedDrag(DRAGGED, 0, POINT));

    expect(last().companyAddresses![0]).toMatchObject({ street: 'Εγνατίας', coordinates: POINT, source: 'dragged' });
    expect(last()).toMatchObject({ street: 'Εγνατίας', streetNumber: '12', municipality: '', settlement: 'Θεσσαλονίκη', neighborhood: 'Κέντρο' });
    expect(onDragMissingNumber).toHaveBeenCalledWith(DRAGGED);
  });

  it('επαφή ΜΟΝΟ με επίπεδα πεδία ⇒ η πρώτη θέση υλοποιεί τη θέση 0, ΜΕ την ιεραρχία της', () => {
    const { result, last } = setup(form({ companyAddresses: [] }));
    act(() => result.current.applyConfirmedDrag(null, 0, POINT));

    const list = last().companyAddresses!;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ street: 'Αγγελάκη', municipalityName: 'Θεσσαλονίκης', coordinates: POINT, source: 'dragged' });
  });

  it('placement → «Ναι, ενημέρωσε» στον ΙΔΙΟ κύκλο ⇒ η τελευταία εγγραφή κουβαλά ΚΑΙ θέση ΚΑΙ κείμενο', () => {
    const { result, last } = setup(form());
    act(() => {
      result.current.hqPlacement.onPlace(POINT);
      result.current.handleHqDragApplied({ street: 'Εγνατίας', number: '12', postalCode: '54630', city: 'Θεσσαλονίκη' });
    });

    expect(last().companyAddresses![0]).toMatchObject({ street: 'Εγνατίας', coordinates: POINT, source: 'dragged' });
  });

  it('αναίρεση ως την αρχή ⇒ η έδρα επιστρέφει στη θέση που είχε ΠΡΙΝ τη φόρμα (εδώ: καμία)', () => {
    const { result, last } = setup(form());
    act(() => result.current.hqPlacement.onPlace(POINT));
    act(() => result.current.hqPlacement.onRestore(null));

    expect(last().companyAddresses![0].coordinates).toBeUndefined();
  });
});

describe('ADR-332 D27 Β-ΙΙ — το κείμενο της μηχανής στο λεξιλόγιο επαφής', () => {
  it('αριθμός χωριστά ⇒ αυτούσιος', () => {
    expect(toContactDraggedAddress({ street: 'Εγνατίας', number: '5' })).toMatchObject({ street: 'Εγνατίας', number: '5' });
  });

  it('αριθμός κολλημένος ⇒ η ΜΙΑ γραμματική αριθμού του έργου (όχι ιδιωτικό regex)', () => {
    expect(toContactDraggedAddress({ street: '25ης Μαρτίου 12' })).toMatchObject({ street: '25ης Μαρτίου', number: '12' });
  });
});
