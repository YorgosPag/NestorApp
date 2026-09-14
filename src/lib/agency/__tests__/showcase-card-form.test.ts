/**
 * ADR-841 §7 Α21.16 — ο κριτής της κάρτας: κάθε κανόνας εκτελείται χωρίς Firestore.
 */

import { formCard, isCardRejection, type VerifiedLocationDeclaration } from '../showcase-card-form';
import type { ShowcaseLocationWire } from '@/types/showcase-card';

const WIRE: ShowcaseLocationWire = {
  id: null,
  role: 'headquarters',
  label: '  Κεντρικό  ',
  place: { landId: 'land_1', buildingId: null },
  street: null,
  hours: null,
  phones: [{ number: '2310 123456', extension: null }],
  emails: [' Office@Example.GR '],
};

function declared(overrides: Partial<ShowcaseLocationWire> = {}): VerifiedLocationDeclaration {
  return { wire: { ...WIRE, ...overrides }, position: { lat: 40.63, lng: 22.94 } };
}

let counter = 0;
const newId = () => `sloc_new_${(counter += 1)}`;

beforeEach(() => {
  counter = 0;
});

describe('formCard — τα δύο μισά από ΕΝΑ πέρασμα', () => {
  it('κανονικοποιεί και χωρίζει δημόσιο/ιδιωτικό', () => {
    const formed = formCard([declared()], new Set(), newId);
    if (isCardRejection(formed)) throw new Error(formed.reason);

    expect(formed.locations).toEqual([
      expect.objectContaining({ id: 'sloc_new_1', label: 'Κεντρικό', channelKinds: ['phone', 'email'] }),
    ]);
    expect(formed.channels.locations.sloc_new_1).toEqual({
      phones: [{ e164: '+302310123456', extension: null }],
      emails: ['office@example.gr'],
    });
  });

  it('🔴 ΤΟ ΔΗΜΟΣΙΟ ΜΙΣΟ ΔΕΝ ΚΡΑΤΑ ΠΟΤΕ ΤΙΜΗ ΚΑΝΑΛΙΟΥ', () => {
    const formed = formCard([declared()], new Set(), newId);
    if (isCardRejection(formed)) throw new Error(formed.reason);

    const serialized = JSON.stringify(formed.locations);
    expect(serialized).not.toContain('2310123456');
    expect(serialized).not.toContain('@');
  });

  it('🔑 υπάρχουσα ταυτότητα διατηρείται — άγνωστη ΔΕΝ γίνεται δεκτή (κλοπή καναλιών)', () => {
    const kept = formCard([declared({ id: 'sloc_old' })], new Set(['sloc_old']), newId);
    const forged = formCard([declared({ id: 'sloc_somebody_else' })], new Set(['sloc_old']), newId);
    if (isCardRejection(kept) || isCardRejection(forged)) throw new Error('rejected');

    expect(kept.locations[0].id).toBe('sloc_old');
    expect(forged.locations[0].id).toBe('sloc_new_1');
  });

  it('ίδια ταυτότητα δύο φορές → η δεύτερη παίρνει νέα (ένα κατάστημα, ένα κλειδί καναλιών)', () => {
    const formed = formCard([declared({ id: 'sloc_old' }), declared({ id: 'sloc_old', role: 'branch' })], new Set(['sloc_old']), newId);
    if (isCardRejection(formed)) throw new Error(formed.reason);
    expect(formed.locations.map(({ id }) => id)).toEqual(['sloc_old', 'sloc_new_1']);
  });

  it('κενές γραμμές αγνοούνται, διπλότυπα ενώνονται', () => {
    const formed = formCard(
      [declared({ phones: [{ number: '', extension: null }, { number: '+30 2310 123456', extension: null }, { number: '2310123456', extension: null }], emails: ['', 'a@b.gr', 'A@B.GR'] })],
      new Set(),
      newId,
    );
    if (isCardRejection(formed)) throw new Error(formed.reason);
    expect(formed.channels.locations.sloc_new_1.phones).toHaveLength(1);
    expect(formed.channels.locations.sloc_new_1.emails).toEqual(['a@b.gr']);
  });

  it('χωρίς κανάλια → channelKinds = []', () => {
    const formed = formCard([declared({ phones: [], emails: [] })], new Set(), newId);
    if (isCardRejection(formed)) throw new Error(formed.reason);
    expect(formed.locations[0].channelKinds).toEqual([]);
  });
});

describe('formCard — οι ονομασμένες αρνήσεις', () => {
  const reasonOf = (list: readonly VerifiedLocationDeclaration[]) => {
    const formed = formCard(list, new Set(), newId);
    return isCardRejection(formed) ? formed.reason : null;
  };

  it.each([
    ['agency-profile-card-phone-invalid', [declared({ phones: [{ number: '123', extension: null }] })]],
    ['agency-profile-card-email-invalid', [declared({ emails: ['not-an-email'] })]],
    ['agency-profile-card-two-headquarters', [declared(), declared()]],
    ['agency-profile-card-too-many-locations', Array.from({ length: 11 }, () => declared({ role: 'branch' }))],
    ['agency-profile-card-too-many-channels', [declared({ emails: ['a@b.gr', 'c@d.gr', 'e@f.gr', 'g@h.gr'] })]],
    ['agency-profile-card-street-incomplete', [declared({ street: { street: 'Τσιμισκή', number: '12', postalCode: '' } })]],
    [
      'agency-profile-card-hours-invalid',
      [declared({ hours: { 1: [{ opens: '18:00', closes: '09:00' }], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } })],
    ],
  ] as const)('%s', (reason, list) => {
    expect(reasonOf(list)).toBe(reason);
  });

  it('εντελώς κενή οδός = «μόνο περιοχή», όχι άρνηση', () => {
    const formed = formCard([declared({ street: { street: ' ', number: '', postalCode: '' } })], new Set(), newId);
    if (isCardRejection(formed)) throw new Error(formed.reason);
    expect(formed.locations[0].street).toBeNull();
  });
});
