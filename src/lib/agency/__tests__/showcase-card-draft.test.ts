/**
 * ADR-841 §7 Α21.16 — πρόχειρο ⇄ σύρμα: οι καταστάσεις της φόρμας που το σύρμα απαγορεύει.
 */

import {
  draftOfLocation,
  emptyLocationDraft,
  wireOfDrafts,
} from '../showcase-card-draft';
import type { OwnedShowcaseLocation } from '@/types/showcase-card';

const OWNED: OwnedShowcaseLocation = {
  id: 'sloc_1',
  role: 'headquarters',
  label: null,
  place: { landId: 'land_1', buildingId: null },
  position: { lat: 40.63, lng: 22.94 },
  street: { street: 'Τσιμισκή', number: '12', postalCode: '54624' },
  hours: null,
  channelKinds: ['phone'],
  emailConfirmedAt: null,
  channels: { phones: [{ e164: '+302310123456', extension: '5' }], emails: [], emailConfirmations: [] },
};

describe('showcase-card-draft', () => {
  it('αποθηκευμένο → πρόχειρο: τηλέφωνο ΜΟΡΦΟΠΟΙΗΜΕΝΟ, όχι ωμό E.164', () => {
    const draft = draftOfLocation(OWNED);
    expect(draft.phones).toEqual([{ number: '+30 231 012 3456', extension: '5' }]);
    expect(draft.publishStreet).toBe(true);
    expect(draft.hoursEnabled).toBe(false);
  });

  it('🔴 κατάστημα χωρίς τόπο ΟΝΟΜΑΖΕΤΑΙ — δεν εξαφανίζεται σιωπηλά', () => {
    expect(wireOfDrafts([draftOfLocation(OWNED), emptyLocationDraft('branch')], '')).toEqual({ missingPlaceIndex: 1 });
  });

  it('🔑 διακόπτης οδού κλειστός ⇒ street: null, αλλά η οδός ΚΡΑΤΙΕΤΑΙ στο πρόχειρο', () => {
    const draft = { ...draftOfLocation(OWNED), publishStreet: false };
    const formed = wireOfDrafts([draft], '');
    if (!('wire' in formed)) throw new Error('missing place');
    expect(formed.wire.locations[0].street).toBeNull();
    expect(draft.street.street).toBe('Τσιμισκή');
  });

  it('ωράριο απενεργοποιημένο ⇒ hours: null στο σύρμα, ό,τι κι αν κρατά το πρόχειρο', () => {
    // Α21.16.8: η ανάδραση ανά ημέρα ζει πλέον στη φόρμα (`weeklyHoursDefects`)· εδώ μένει η εγγύηση
    // ότι ένα ΚΛΕΙΣΤΟ ωράριο με άκυρες κρατημένες ώρες δεν φτάνει ποτέ στον διακομιστή.
    const draft = {
      ...draftOfLocation(OWNED),
      hoursEnabled: false,
      hours: { 1: [{ opens: '18:00', closes: '18:00' }], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] },
    };
    const formed = wireOfDrafts([draft], '');
    if (!('wire' in formed)) throw new Error('missing place');
    expect(formed.wire.locations[0].hours).toBeNull();
  });

  it('κενή ετικέτα/εσωτερικό → null στο σύρμα', () => {
    const formed = wireOfDrafts([{ ...draftOfLocation(OWNED), label: '  ', phones: [{ number: '2310123456', extension: ' ' }] }], '');
    if (!('wire' in formed)) throw new Error('missing place');
    expect(formed.wire.locations[0].label).toBeNull();
    expect(formed.wire.locations[0].phones[0].extension).toBeNull();
  });

  it('🔑 Α21.17 — ιστοσελίδα: κενή ⇒ null (η ΑΦΑΙΡΕΣΗ είναι δήλωση), αλλιώς κομμένα κενά — η κρίση μένει στον διακομιστή', () => {
    const empty = wireOfDrafts([draftOfLocation(OWNED)], '   ');
    const typed = wireOfDrafts([draftOfLocation(OWNED)], '  www.vafes.gr ');
    if (!('wire' in empty) || !('wire' in typed)) throw new Error('missing place');
    expect(empty.wire.website).toBeNull();
    expect(typed.wire.website).toBe('www.vafes.gr');
  });
});
