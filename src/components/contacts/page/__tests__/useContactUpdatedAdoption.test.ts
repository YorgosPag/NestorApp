/**
 * Άγκυρα — η ΣΥΝΔΕΣΗ: η λίστα επαφών ακούει το `CONTACT_UPDATED` και υιοθετεί τις διευθύνσεις
 * που γράφτηκαν (ADR-332 D27 Β-ΙΙ).
 *
 * Η καθαρή συνάρτηση έχει δική της άγκυρα (`contact-realtime-updates.test.ts`)· αυτό εδώ φυλάει
 * ότι **καλείται**. Ως τις 2026-09-11 η σύνδεση ζούσε μέσα στο `useContactsPageState` και η
 * μετάλλαξη «ο handler δεν εφαρμόζει την απήχηση» **επιβίωνε** (M29).
 */

import { renderHook, act } from '@testing-library/react';
import type { Contact } from '@/types/contacts';

var mockHandlers: Record<string, (payload: unknown) => void> = {};
jest.mock('@/services/realtime', () => ({
  RealtimeService: {
    subscribe: jest.fn((event: string, handler: (payload: unknown) => void) => {
      mockHandlers[event] = handler;
      return () => { delete mockHandlers[event]; };
    }),
  },
}));

import { useContactUpdatedAdoption } from '../useContactUpdatedAdoption';

const HUMAN = { lat: 40.63, lng: 22.94 };
const alfa = {
  id: 'cont_1', type: 'company', companyName: 'ALFA',
  customFields: { activities: [{ code: '41.20' }], companyAddresses: [{ id: 'addr_hq', type: 'headquarters', street: 'Α', number: '1', postalCode: '1', city: 'Χ' }] },
} as unknown as Contact;
const beta = { id: 'cont_2', type: 'company', companyName: 'BETA' } as unknown as Contact;

it('απήχηση με διευθύνσεις ⇒ ΜΟΝΟ η σωστή επαφή τις υιοθετεί, τα αδέλφια του customFields μένουν', () => {
  let contacts: Contact[] = [alfa, beta];
  const setContacts = jest.fn((next: Contact[] | ((prev: Contact[]) => Contact[])) => {
    contacts = typeof next === 'function' ? next(contacts) : next;
  });
  const { unmount } = renderHook(() => useContactUpdatedAdoption(setContacts));

  act(() => mockHandlers.CONTACT_UPDATED({
    contactId: 'cont_1',
    updates: { companyAddresses: [{ id: 'addr_hq', type: 'headquarters', street: 'Α', number: '1', postalCode: '1', city: 'Χ', coordinates: HUMAN }] },
    timestamp: 1,
  }));

  const custom = contacts[0].customFields as { activities: unknown[]; companyAddresses: Array<{ coordinates?: unknown }> };
  expect(custom.companyAddresses[0].coordinates).toEqual(HUMAN);
  expect(custom.activities).toEqual([{ code: '41.20' }]);
  expect(contacts[1]).toBe(beta);

  unmount();
  expect(mockHandlers.CONTACT_UPDATED).toBeUndefined();
});
