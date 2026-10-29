/**
 * ΑΓΚΥΡΑ — **ΕΝΑ λεξιλόγιο τύπου τηλεφώνου**, και κάθε σημείο που το απαριθμεί μιλά την ίδια γλώσσα
 * (ADR-327 §8.5.4, 2026-10-29).
 *
 * Μετρημένο ζωντανά: η MACON ATEE (εταιρεία) είχε `mobile` και η λίστα «Τύπος» έμενε κενή — το UI της εταιρείας
 * προσφέρει `main/department/…`. Έξι δηλώσεις διαφωνούσαν· εδώ δένονται ο πίνακας της φόρμας, οι χάρτες του AI και
 * οι εφεδρείες του πελάτη στη ρίζα `lib/contact/phone-type-vocabulary.ts`.
 */

/* global describe, it, expect */

import {
  DEFAULT_PHONE_TYPE, PHONE_TYPES, PHONE_TYPES_BY_OWNER, isPhoneType, isPhoneTypeOfferedFor, phoneOwnerKindOf,
  type PhoneOwnerKind,
} from '../phone-type-vocabulary';
import { getEntityAwareCommunicationConfig } from '@/components/contacts/dynamic/communication/config/CommunicationConfigs';
import { communicationItemsToPhones } from '@/components/contacts/dynamic/communication/utils/communication-item-mappers';
import { buildEnterpriseContactArrays } from '@/utils/contactForm/extractors/arrays';
import type { ContactFormData } from '@/types/ContactFormTypes';

const OWNERS: readonly PhoneOwnerKind[] = ['individual', 'company', 'service'];

describe('ρίζα', () => {
  it('Λ1 — κάθε υποσύνολο και κάθε προεπιλογή ανήκουν στη ρίζα· η προεπιλογή προσφέρεται από τον κάτοχό της', () => {
    for (const owner of OWNERS) {
      for (const type of PHONE_TYPES_BY_OWNER[owner]) expect(PHONE_TYPES).toContain(type);
      expect(isPhoneTypeOfferedFor(DEFAULT_PHONE_TYPE[owner], owner)).toBe(true);
    }
  });

  it('Λ2 — εταιρεία/υπηρεσία ⇒ `main`· τα `work`/`mobile` ΔΕΝ προσφέρονται σε εταιρεία (η ρίζα του κενού)', () => {
    expect(DEFAULT_PHONE_TYPE.company).toBe('main');
    expect(DEFAULT_PHONE_TYPE.service).toBe('main');
    expect(isPhoneTypeOfferedFor('work', 'company')).toBe(false);
    expect(isPhoneTypeOfferedFor('mobile', 'company')).toBe(false);
  });

  it('Λ3 — `isPhoneType` / `phoneOwnerKindOf` στα σύνορα', () => {
    expect(isPhoneType('main')).toBe(true);
    expect(isPhoneType('cell')).toBe(false);
    expect(isPhoneType(undefined)).toBe(false);
    expect(phoneOwnerKindOf('company')).toBe('company');
    expect(phoneOwnerKindOf('service')).toBe('service');
    expect(phoneOwnerKindOf(undefined)).toBe('individual');
    expect(phoneOwnerKindOf('weird')).toBe('individual');
  });
});

describe('UI φόρμας (CommunicationConfigs)', () => {
  it('Λ4 — οι επιλογές «Τύπος» κάθε κατόχου ΕΙΝΑΙ το υποσύνολό του, με την ίδια σειρά και προεπιλογή', () => {
    for (const owner of OWNERS) {
      const config = getEntityAwareCommunicationConfig('phone', owner);
      expect(config.types.map((o) => o.value)).toEqual([...PHONE_TYPES_BY_OWNER[owner]]);
      expect(config.defaultType).toBe(DEFAULT_PHONE_TYPE[owner]);
      for (const option of config.types) expect(option.label).toMatch(/^communication\./);
    }
  });

  it('Λ5 — γραμμές φόρμας → PhoneInfo: έγκυρη τιμή διατηρείται, άγνωστη ⇒ προεπιλογή του κατόχου', () => {
    const items = [{ type: 'sales', number: '1' }, { type: 'bogus', number: '2' }];
    expect(communicationItemsToPhones(items, 'company').map((p) => p.type)).toEqual(['sales', 'main']);
    expect(communicationItemsToPhones(items, 'individual').map((p) => p.type)).toEqual(['sales', 'mobile']);
  });
});

describe('εφεδρείες πελάτη', () => {
  it('Λ6 — φόρμα με μόνο πεδίο `phone` ⇒ ο τύπος είναι η προεπιλογή του ΚΑΤΟΧΟΥ (όχι `work`/`mobile` για όλους)', () => {
    const form = { phone: '2310428900', email: '' } as unknown as ContactFormData;
    for (const owner of OWNERS) {
      expect(buildEnterpriseContactArrays(form, owner).phones[0]?.type).toBe(DEFAULT_PHONE_TYPE[owner]);
    }
  });
});
