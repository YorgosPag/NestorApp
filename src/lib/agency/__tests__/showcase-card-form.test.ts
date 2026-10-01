/**
 * ADR-841 §7 Α21.16 — ο κριτής της κάρτας: κάθε κανόνας εκτελείται χωρίς Firestore.
 */

import {
  declaresAreaOnly,
  formCard,
  isCardRejection,
  type VerifiedLocationDeclaration,
} from '../showcase-card-form';
import type { ShowcaseEmailConfirmation, ShowcaseLocationWire } from '@/types/showcase-card';

const WIRE: ShowcaseLocationWire = {
  id: null,
  role: 'headquarters',
  label: '  Κεντρικό  ',
  place: { landId: 'land_1', buildingId: null },
  street: null,
  hours: null,
  specialHours: [],
  phones: [{ number: '2310 123456', extension: null }],
  emails: [' Office@Example.GR '],
};

/** Α21.21 — «σήμερα» στην Ελλάδα, εγχεόμενο στον κριτή. */
const TODAY = '2026-09-15';

const OFFICE = {
  1: [{ opens: '09:00', closes: '17:00' }], 2: [{ opens: '09:00', closes: '17:00' }], 3: [{ opens: '09:00', closes: '17:00' }],
  4: [{ opens: '09:00', closes: '17:00' }], 5: [{ opens: '09:00', closes: '17:00' }], 6: [], 7: [],
};

const POINT = { lat: 40.63, lng: 22.94 };
const AREA = { adminId: 'municipality:0701' };

/** Το σκέλος διαλέγεται με τον **ίδιο** κανόνα που ρωτά η πόρτα (`verifyLocation`) — ADR-896 §6. */
function declared(overrides: Partial<ShowcaseLocationWire> = {}): VerifiedLocationDeclaration {
  const wire = { ...WIRE, ...overrides };
  return declaresAreaOnly(wire) ? { wire, area: AREA } : { wire, position: POINT };
}

const STREET = { street: 'Τσιμισκή', number: '12', postalCode: '54624' };

let counter = 0;
const newId = () => `sloc_new_${(counter += 1)}`;
/** Καμία αποθηκευμένη επιβεβαίωση (Α21.18). */
const NONE = (): readonly ShowcaseEmailConfirmation[] => [];

beforeEach(() => {
  counter = 0;
});

describe('formCard — τα δύο μισά από ΕΝΑ πέρασμα', () => {
  it('κανονικοποιεί και χωρίζει δημόσιο/ιδιωτικό', () => {
    const formed = formCard([declared()], new Set(), newId, NONE, TODAY);
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
    const formed = formCard([declared()], new Set(), newId, NONE, TODAY);
    if (isCardRejection(formed)) throw new Error(formed.reason);

    const serialized = JSON.stringify(formed.locations);
    expect(serialized).not.toContain('2310123456');
    expect(serialized).not.toContain('@');
  });

  it('🔑 υπάρχουσα ταυτότητα διατηρείται — άγνωστη ΔΕΝ γίνεται δεκτή (κλοπή καναλιών)', () => {
    const kept = formCard([declared({ id: 'sloc_old' })], new Set(['sloc_old']), newId, NONE, TODAY);
    const forged = formCard([declared({ id: 'sloc_somebody_else' })], new Set(['sloc_old']), newId, NONE, TODAY);
    if (isCardRejection(kept) || isCardRejection(forged)) throw new Error('rejected');

    expect(kept.locations[0].id).toBe('sloc_old');
    expect(forged.locations[0].id).toBe('sloc_new_1');
  });

  it('ίδια ταυτότητα δύο φορές → η δεύτερη παίρνει νέα (ένα κατάστημα, ένα κλειδί καναλιών)', () => {
    const formed = formCard([declared({ id: 'sloc_old' }), declared({ id: 'sloc_old', role: 'branch' })], new Set(['sloc_old']), newId, NONE, TODAY);
    if (isCardRejection(formed)) throw new Error(formed.reason);
    expect(formed.locations.map(({ id }) => id)).toEqual(['sloc_old', 'sloc_new_1']);
  });

  it('κενές γραμμές αγνοούνται, διπλότυπα ενώνονται', () => {
    const formed = formCard(
      [declared({ phones: [{ number: '', extension: null }, { number: '+30 2310 123456', extension: null }, { number: '2310123456', extension: null }], emails: ['', 'a@b.gr', 'A@B.GR'] })],
      new Set(),
      newId,
      NONE,
      TODAY,
    );
    if (isCardRejection(formed)) throw new Error(formed.reason);
    expect(formed.channels.locations.sloc_new_1.phones).toHaveLength(1);
    expect(formed.channels.locations.sloc_new_1.emails).toEqual(['a@b.gr']);
  });

  it('χωρίς κανάλια → channelKinds = []', () => {
    const formed = formCard([declared({ phones: [], emails: [] })], new Set(), newId, NONE, TODAY);
    if (isCardRejection(formed)) throw new Error(formed.reason);
    expect(formed.locations[0].channelKinds).toEqual([]);
  });
});

describe('formCard — οι επιβεβαιώσεις email (Α21.18)', () => {
  const CONFIRMED = '2026-09-10T08:00:00.000Z';
  const stored = (locationId: string): readonly ShowcaseEmailConfirmation[] =>
    locationId === 'sloc_old' ? [{ email: 'office@example.gr', confirmedAt: CONFIRMED }] : [];

  it('🔑 ίδιο κατάστημα + ίδια διεύθυνση ⇒ η επιβεβαίωση επιβιώνει, και στα δύο μισά', () => {
    const formed = formCard([declared({ id: 'sloc_old' })], new Set(['sloc_old']), newId, stored, TODAY);
    if (isCardRejection(formed)) throw new Error(formed.reason);

    expect(formed.channels.locations.sloc_old.emailConfirmations).toEqual([
      { email: 'office@example.gr', confirmedAt: CONFIRMED },
    ]);
    expect(formed.locations[0].emailConfirmedAt).toBe(CONFIRMED);
  });

  it('🔴 αλλαγμένη διεύθυνση ⇒ το σήμα ΧΑΝΕΤΑΙ στο ίδιο πέρασμα', () => {
    const formed = formCard([declared({ id: 'sloc_old', emails: ['sales@example.gr'] })], new Set(['sloc_old']), newId, stored, TODAY);
    if (isCardRejection(formed)) throw new Error(formed.reason);

    expect(formed.channels.locations.sloc_old.emailConfirmations).toEqual([]);
    expect(formed.locations[0].emailConfirmedAt).toBeNull();
  });

  it('🔴 πλαστή ταυτότητα ΔΕΝ κληρονομεί σήμα — ούτε ρωτιέται', () => {
    const asked: string[] = [];
    const formed = formCard([declared({ id: 'sloc_somebody_else' })], new Set(['sloc_old']), newId, (id) => {
      asked.push(id);
      return stored('sloc_old');
    }, TODAY);
    if (isCardRejection(formed)) throw new Error(formed.reason);

    expect(asked).toEqual([]);
    expect(formed.locations[0].emailConfirmedAt).toBeNull();
  });
});

describe('formCard — οι ονομασμένες αρνήσεις', () => {
  const reasonOf = (list: readonly VerifiedLocationDeclaration[]) => {
    const formed = formCard(list, new Set(), newId, NONE, TODAY);
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
    // Α21.21 — ο ΕΝΑΣ κριτής των ειδικών ωρών: διπλή ημερομηνία, πέρα από τον ορίζοντα, άκυρα διαστήματα.
    [
      'agency-profile-card-special-hours-invalid',
      [declared({ hours: OFFICE, specialHours: [{ date: '2026-12-25', kind: 'closed' }, { date: '2026-12-25', kind: 'regular' }] })],
    ],
    ['agency-profile-card-special-hours-invalid', [declared({ hours: OFFICE, specialHours: [{ date: '2028-01-01', kind: 'closed' }] })]],
    [
      'agency-profile-card-special-hours-invalid',
      [declared({ hours: OFFICE, specialHours: [{ date: '2026-12-24', kind: 'custom', intervals: [{ opens: '10:00', closes: '10:00' }] }] })],
    ],
  ] as const)('%s', (reason, list) => {
    expect(reasonOf(list)).toBe(reason);
  });

  it('🔑 Α21.21 — περασμένη ειδική μέρα ΚΛΑΔΕΥΕΤΑΙ (όχι άρνηση)· χωρίς εβδομαδιαίο ωράριο ΠΕΦΤΟΥΝ όλες', () => {
    const special = [{ date: '2026-12-25', kind: 'closed' as const }, { date: '2026-09-14', kind: 'closed' as const }];
    const kept = formCard([declared({ hours: OFFICE, specialHours: special })], new Set(), newId, NONE, TODAY);
    const withoutWeek = formCard([declared({ hours: null, specialHours: special })], new Set(), newId, NONE, TODAY);
    if (isCardRejection(kept) || isCardRejection(withoutWeek)) throw new Error('rejected');
    expect(kept.locations[0].specialHours).toEqual([{ date: '2026-12-25', kind: 'closed' }]);
    expect(withoutWeek.locations[0].specialHours).toEqual([]);
  });

  it('εντελώς κενή οδός = «μόνο περιοχή», όχι άρνηση', () => {
    const formed = formCard([declared({ street: { street: ' ', number: '', postalCode: '' } })], new Set(), newId, NONE, TODAY);
    if (isCardRejection(formed)) throw new Error(formed.reason);
    expect(formed.locations[0].street).toBeNull();
  });
});

describe('formCard — «μόνο περιοχή» ΔΕΝ δημοσιεύει τόπο (ADR-896 §6)', () => {
  it('🔴 το δημόσιο κατάστημα δεν έχει ΚΑΝ πεδίο place/position — μόνο τον δήμο· ο τόπος πάει στο ιδιωτικό', () => {
    const formed = formCard([declared()], new Set(), newId, NONE, TODAY);
    if (isCardRejection(formed)) throw new Error(formed.reason);
    const [location] = formed.locations;
    expect(location).not.toHaveProperty('place');
    expect(location).not.toHaveProperty('position');
    expect(location).toMatchObject({ street: null, area: AREA });
    expect(formed.premises).toEqual({ sloc_new_1: { landId: 'land_1', buildingId: null } });
    // Το δημόσιο μισό, σειριοποιημένο, δεν αναφέρει πουθενά τη γη.
    expect(JSON.stringify(formed.locations)).not.toContain('land_1');
  });

  it('κατάστημα με οδό: δημόσιος τόπος, ΚΑΝΕΝΑ ιδιωτικό αντίγραφο', () => {
    const formed = formCard([declared({ street: STREET })], new Set(), newId, NONE, TODAY);
    if (isCardRejection(formed)) throw new Error(formed.reason);
    expect(formed.locations[0]).toMatchObject({ street: STREET, place: { landId: 'land_1' }, position: POINT });
    expect(formed.premises).toEqual({});
  });

  it('δήμος που δεν αποδόθηκε ⇒ area: null — ποτέ εφεδρεία στο σημείο', () => {
    const formed = formCard([{ wire: WIRE, area: null }], new Set(), newId, NONE, TODAY);
    if (isCardRejection(formed)) throw new Error(formed.reason);
    expect(formed.locations[0]).toMatchObject({ street: null, area: null });
    expect(formed.locations[0]).not.toHaveProperty('position');
  });

  it('🔴 πόρτα και κριτής που διαφωνούν ⇒ ΑΡΝΗΣΗ, όχι δημοσίευση σημείου', () => {
    expect(isCardRejection(formCard([{ wire: WIRE, position: POINT }], new Set(), newId, NONE, TODAY))).toBe(true);
    expect(isCardRejection(formCard([{ wire: { ...WIRE, street: STREET }, area: AREA }], new Set(), newId, NONE, TODAY))).toBe(true);
  });

  it.each([
    [null, true],
    [{ street: ' ', number: '', postalCode: ' ' }, true],
    [{ street: 'Τσιμισκή', number: '', postalCode: '' }, false],
  ] as const)('declaresAreaOnly(%j) = %s — ο ΕΝΑΣ κανόνας πόρτας και κριτή', (street, areaOnly) => {
    expect(declaresAreaOnly({ street })).toBe(areaOnly);
  });
});
