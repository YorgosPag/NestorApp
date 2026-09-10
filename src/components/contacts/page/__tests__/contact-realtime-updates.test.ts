/**
 * Άγκυρα — η λίστα επαφών ΥΙΟΘΕΤΕΙ τις διευθύνσεις που γράφτηκαν (ADR-332 D27 Β-ΙΙ)
 *
 * Χωρίς αυτό, ένα «Μετακίνησε» γράφεται σωστά αλλά η ανοιχτή επαφή δείχνει την παλιά πινέζα
 * ως την επαναφόρτωση — «ό,τι βλέπεις ≠ ό,τι αποθηκεύτηκε», από την άλλη πλευρά.
 */

import type { Contact } from '@/types/contacts';
import { applyContactRealtimeUpdates } from '../contact-realtime-updates';

const HUMAN = { lat: 40.63, lng: 22.94 };
const stored = {
  id: 'cont_1', type: 'company', companyName: 'ALFA',
  customFields: {
    activities: [{ code: '41.20' }],
    companyAddresses: [{ id: 'addr_hq', type: 'headquarters', street: 'Α', number: '1', postalCode: '1', city: 'Χ' }],
  },
} as unknown as Contact;

it('υιοθετεί αυθεντική λίστα ΚΑΙ παράγωγο — χωρίς να αγγίξει τα αδέλφια του customFields', () => {
  const next = applyContactRealtimeUpdates(stored, {
    addresses: [{ id: 'addr_hq', street: 'Α', city: 'Χ', postalCode: '1', country: 'GR', type: 'work', isPrimary: true, coordinates: HUMAN }],
    companyAddresses: [{ id: 'addr_hq', type: 'headquarters', street: 'Α', number: '1', postalCode: '1', city: 'Χ', coordinates: HUMAN }],
  });

  const custom = next.customFields as { activities: unknown[]; companyAddresses: Array<{ coordinates?: unknown }> };
  expect(custom.companyAddresses[0].coordinates).toEqual(HUMAN);
  expect(custom.activities).toEqual([{ code: '41.20' }]);
  expect(next.addresses?.[0].coordinates).toEqual(HUMAN);
});

it('απήχηση χωρίς διευθύνσεις ⇒ οι διευθύνσεις μένουν ως είχαν', () => {
  const next = applyContactRealtimeUpdates(stored, { isFavorite: true });
  expect(next.customFields).toBe(stored.customFields);
});
