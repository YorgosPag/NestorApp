/**
 * ADR-841 §7 Α21.16 — ο κριτής της κάρτας: κάθε κανόνας εκτελείται χωρίς Firestore.
 */

import { formCard, isCardRejection, type VerifiedLocationDeclaration } from '../showcase-card-form';
import type { ShowcaseEmailConfirmation, ShowcaseLocationWire } from '@/types/showcase-card';

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
/** Καμία αποθηκευμένη επιβεβαίωση (Α21.18). */
const NONE = (): readonly ShowcaseEmailConfirmation[] => [];

beforeEach(() => {
  counter = 0;
});

describe('formCard — τα δύο μισά από ΕΝΑ πέρασμα', () => {
  it('κανονικοποιεί και χωρίζει δημόσιο/ιδιωτικό', () => {
    const formed = formCard([declared()], new Set(), newId, NONE);
    if (isCardRejection(formed)) throw new Error(formed.reason);

    expect(formed.locations).toEqual([
      expect.objectContaining({ id: 'sloc_new_1', label: 'Κεντρικό', channelKinds: ['phone', 'email'] }),
    ]);
    expect(formed.channels.locations.sloc_new_1).toEqual({
      phones: [{ e164: '+302310123456', extension: null }],
      emails: ['office@example.gr'],
      emailConfirmations: [],
    });
    expect(formed.locations[0].emailConfirmedAt).toBeNull();
  });

  it('🔴 ΤΟ ΔΗΜΟΣΙΟ ΜΙΣΟ ΔΕΝ ΚΡΑΤΑ ΠΟΤΕ ΤΙΜΗ ΚΑΝΑΛΙΟΥ', () => {
    const formed = formCard([declared()], new Set(), newId, NONE);
    if (isCardRejection(formed)) throw new Error(formed.reason);

    const serialized = JSON.stringify(formed.locations);
    expect(serialized).not.toContain('2310123456');
    expect(serialized).not.toContain('@');
  });

  it('🔑 υπάρχουσα ταυτότητα διατηρείται — άγνωστη ΔΕΝ γίνεται δεκτή (κλοπή καναλιών)', () => {
    const kept = formCard([declared({ id: 'sloc_old' })], new Set(['sloc_old']), newId, NONE);
    const forged = formCard([declared({ id: 'sloc_somebody_else' })], new Set(['sloc_old']), newId, NONE);
    if (isCardRejection(kept) || isCardRejection(forged)) throw new Error('rejected');

    expect(kept.locations[0].id).toBe('sloc_old');
    expect(forged.locations[0].id).toBe('sloc_new_1');
  });

  it('ίδια ταυτότητα δύο φορές → η δεύτερη παίρνει νέα (ένα κατάστημα, ένα κλειδί καναλιών)', () => {
    const formed = formCard([declared({ id: 'sloc_old' }), declared({ id: 'sloc_old', role: 'branch' })], new Set(['sloc_old']), newId, NONE);
    if (isCardRejection(formed)) throw new Error(formed.reason);
    expect(formed.locations.map(({ id }) => id)).toEqual(['sloc_old', 'sloc_new_1']);
  });

  it('κενές γραμμές αγνοούνται, διπλότυπα ενώνονται', () => {
    const formed = formCard(
      [declared({ phones: [{ number: '', extension: null }, { number: '+30 2310 123456', extension: null }, { number: '2310123456', extension: null }], emails: ['', 'a@b.gr', 'A@B.GR'] })],
      new Set(),
      newId,
      NONE,
    );
    if (isCardRejection(formed)) throw new Error(formed.reason);
    expect(formed.channels.locations.sloc_new_1.phones).toHaveLength(1);
    expect(formed.channels.locations.sloc_new_1.emails).toEqual(['a@b.gr']);
  });

  it('χωρίς κανάλια → channelKinds = []', () => {
    const formed = formCard([declared({ phones: [], emails: [] })], new Set(), newId, NONE);
    if (isCardRejection(formed)) throw new Error(formed.reason);
    expect(formed.locations[0].channelKinds).toEqual([]);
  });
});

describe('formCard — οι επιβεβαιώσεις email (Α21.18)', () => {
  const CONFIRMED = '2026-09-10T08:00:00.000Z';
  const stored = (locationId: string): readonly ShowcaseEmailConfirmation[] =>
    locationId === 'sloc_old' ? [{ email: 'office@example.gr', confirmedAt: CONFIRMED }] : [];

  it('🔑 ίδιο κατάστημα + ίδια διεύθυνση ⇒ η επιβεβαίωση επιβιώνει, και στα δύο μισά', () => {
    const formed = formCard([declared({ id: 'sloc_old' })], new Set(['sloc_old']), newId, stored);
    if (isCardRejection(formed)) throw new Error(formed.reason);

    expect(formed.channels.locations.sloc_old.emailConfirmations).toEqual([
      { email: 'office@example.gr', confirmedAt: CONFIRMED },
    ]);
    expect(formed.locations[0].emailConfirmedAt).toBe(CONFIRMED);
  });

  it('🔴 αλλαγμένη διεύθυνση ⇒ το σήμα ΧΑΝΕΤΑΙ στο ίδιο πέρασμα', () => {
    const formed = formCard([declared({ id: 'sloc_old', emails: ['sales@example.gr'] })], new Set(['sloc_old']), newId, stored);
    if (isCardRejection(formed)) throw new Error(formed.reason);

    expect(formed.channels.locations.sloc_old.emailConfirmations).toEqual([]);
    expect(formed.locations[0].emailConfirmedAt).toBeNull();
  });

  it('🔴 πλαστή ταυτότητα ΔΕΝ κληρονομεί σήμα — ούτε ρωτιέται', () => {
    const asked: string[] = [];
    const formed = formCard([declared({ id: 'sloc_somebody_else' })], new Set(['sloc_old']), newId, (id) => {
      asked.push(id);
      return stored('sloc_old');
    });
    if (isCardRejection(formed)) throw new Error(formed.reason);

    expect(asked).toEqual([]);
    expect(formed.locations[0].emailConfirmedAt).toBeNull();
  });
});

describe('formCard — οι ονομασμένες αρνήσεις', () => {
  const reasonOf = (list: readonly VerifiedLocationDeclaration[]) => {
    const formed = formCard(list, new Set(), newId, NONE);
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
      // Α21.16.8: το 18:00–09:00 είναι πλέον ΕΓΚΥΡΗ βάρδια μετά τα μεσάνυχτα — άκυρο μένει το ίσο.
      [declared({ hours: { 1: [{ opens: '18:00', closes: '18:00' }], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } })],
    ],
  ] as const)('%s', (reason, list) => {
    expect(reasonOf(list)).toBe(reason);
  });

  it('εντελώς κενή οδός = «μόνο περιοχή», όχι άρνηση', () => {
    const formed = formCard([declared({ street: { street: ' ', number: '', postalCode: '' } })], new Set(), newId, NONE);
    if (isCardRejection(formed)) throw new Error(formed.reason);
    expect(formed.locations[0].street).toBeNull();
  });
});
