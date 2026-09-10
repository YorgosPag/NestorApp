/**
 * Άγκυρα — ο «Καθαρισμός» της έδρας σβήνει ΚΑΙ τη θέση (ADR-332 D27 Β-ΙΙ · D20)
 *
 * Από το Β-ΙΙ μια θέση **χωρίς** κείμενο μετρά ως περιεχόμενο (`isBlankContactAddress`): τη
 * γεννά μόνο άνθρωπος («Μόνο η θέση»). Αν ο «Καθαρισμός» κρατούσε την πινέζα, η καθαρισμένη
 * έδρα θα επιβίωνε του κλαδέματος ως «εγγραφή μόνο με θέση» — το αντίθετο από ό,τι πάτησε ο
 * άνθρωπος. Εδώ φυλάγεται ότι η καθαρισμένη εγγραφή είναι **νέα**: χωρίς θέση, χωρίς ταυτότητα.
 */
import { renderHook, act } from '@testing-library/react';
import type { SetStateAction } from 'react';
import type { ContactFormData } from '@/types/ContactFormTypes';
import { initialFormData } from '@/types/ContactFormTypes';
import { useClearCompanyHqAddress } from '../useClearCompanyHqAddress';
import { isBlankContactAddress } from '@/utils/contacts/contact-address-blankness';

jest.mock('@/providers/NotificationProvider', () => ({ useNotifications: () => ({ notify: jest.fn() }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

it('η καθαρισμένη έδρα δεν κρατά ούτε πινέζα ούτε ταυτότητα — άρα κλαδεύεται κανονικά', () => {
  const formData: ContactFormData = {
    ...initialFormData,
    type: 'company',
    street: 'Αγγελάκη', streetNumber: '5', postalCode: '54621', city: 'Θεσσαλονίκη',
    companyAddresses: [{
      id: 'addr_hq', type: 'headquarters', street: 'Αγγελάκη', number: '5', postalCode: '54621', city: 'Θεσσαλονίκη',
      coordinates: { lat: 40.63, lng: 22.94 }, source: 'dragged', verifiedAt: 7,
    }],
  };
  let written: ContactFormData | null = null;
  const setFormData = (value: SetStateAction<ContactFormData>) => {
    written = typeof value === 'function' ? value(formData) : value;
  };

  const { result } = renderHook(() => useClearCompanyHqAddress(formData, setFormData));
  act(() => result.current.clearHq());

  const hq = written!.companyAddresses![0];
  expect(hq.coordinates).toBeUndefined();
  expect(hq.source).toBeUndefined();
  expect(hq.id).toBeUndefined();
  expect(isBlankContactAddress(hq)).toBe(true);
});
