/**
 * @fileoverview Άγκυρες του **«κλεισμένη στο ΓΕΜΗ;»** — ADR-841 §7 Α23 Φ3.2 (Απόφαση 1).
 * @related lib/agency/showcase-registry-closure.ts · services/realtime/hooks/usePublicAgencies.ts
 *
 * 🔴 Ο κατάλογος, η αρχική αναζήτηση και οι δύο πόρτες ενεργειών ρωτούν **αυτή** τη συνάρτηση.
 */

import { BROKER_CREDENTIAL, showcaseFixture, TRADE_CREDENTIAL } from '@/lib/agency/__fixtures__/showcase-fixture';
import type { ShowcaseLocation } from '@/types/showcase-card';
import type { ShowcaseLegalIdentity } from '@/types/showcase-legal-identity';

import {
  contactableShowcase,
  isListedInDirectory,
  mandateRefusalOf,
  registryClosureOf,
} from '../showcase-registry-closure';

const CLOSURE = { issuer: 'gemi', checkedAt: '2026-09-14T11:00:00.000Z' } as const;

function identity(registryClosure: ShowcaseLegalIdentity['registryClosure']): ShowcaseLegalIdentity {
  return {
    publicName: 'legal-name',
    legalName: 'ΠΑΓΩΝΗΣ ΑΝΩΝΥΜΗ ΕΤΑΙΡΕΙΑ',
    legalForm: 'ae',
    gemiNumber: '123456789000',
    seat: { disclosure: 'municipality', streetLine: null, postalCode: null, locality: 'Θεσσαλονίκη' },
    attestation: { state: 'declared' },
    registryClosure,
  };
}

describe('Κ — κλεισμένη στο ΓΕΜΗ', () => {
  it('🔴 Κ1 — κλειστή ⇒ ΕΚΤΟΣ καταλόγου, και το κλείσιμο διαβάζεται με πηγή και ημερομηνία', () => {
    const closed = showcaseFixture({ legalIdentity: identity(CLOSURE) });

    expect(isListedInDirectory(closed)).toBe(false);
    expect(registryClosureOf(closed)).toEqual(CLOSURE);
  });

  it.each([
    ['ενεργή', identity(null)],
    ['βιτρίνα πριν την Α23 (καμία νομική ταυτότητα)', null],
  ])('🔑 Κ2 — %s ⇒ ΜΕΣΑ στον κατάλογο (ο παρονομαστής)', (_label, legalIdentity) => {
    const showcase = showcaseFixture({ legalIdentity });

    expect(isListedInDirectory(showcase)).toBe(true);
    expect(registryClosureOf(showcase)).toBeNull();
  });
});

/** Α23.8 Γ4 φέτα 2 — ένα κατάστημα με **όλα**: κανάλια, επιβεβαίωση email, οδό, ωράριο. */
const LOCATION: ShowcaseLocation = {
  id: 'sloc_closure',
  role: 'headquarters',
  label: 'Κεντρικό',
  place: { landId: 'land_closure', buildingId: null },
  position: { lat: 40.63, lng: 22.94 },
  street: { street: 'Τσιμισκή', number: '10', postalCode: '54623' },
  hours: null,
  channelKinds: ['phone', 'email'],
  emailConfirmedAt: '2026-09-01T09:00:00.000Z',
};

describe('Γ — τι βλέπει ο επισκέπτης (contactableShowcase)', () => {
  it('🔴 Γ1 — κλειστή ⇒ κανένα κανάλι και καμία επιβεβαίωση email· ΟΛΑ τα άλλα αυτούσια', () => {
    const closed = showcaseFixture({ legalIdentity: identity(CLOSURE), locations: [LOCATION] });

    const seen = contactableShowcase(closed);

    expect(seen.locations).toEqual([{ ...LOCATION, channelKinds: [], emailConfirmedAt: null }]);
    expect({ ...seen, locations: closed.locations }).toEqual(closed);
    // 🔑 Καθαρή: το έγγραφο που διαβάστηκε ΔΕΝ αλλοιώνεται.
    expect(closed.locations[0]).toEqual(LOCATION);
  });

  it.each([
    ['ενεργή', identity(null)],
    ['βιτρίνα πριν την Α23', null],
  ])('🔑 Γ2 — %s ⇒ η ΙΔΙΑ βιτρίνα, κανάλια όπως δηλώθηκαν (ο θετικός μάρτυρας)', (_label, legalIdentity) => {
    const open = showcaseFixture({ legalIdentity, locations: [LOCATION] });

    expect(contactableShowcase(open)).toBe(open);
    expect(contactableShowcase(open).locations[0].channelKinds).toEqual(['phone', 'email']);
  });
});

describe('Ε — «δέχεται νέα εντολή;» (mandateRefusalOf, Φ3.3)', () => {
  it.each([
    // 🔴 Η σειρά: κλειστή ΚΑΙ τεχνίτης ⇒ `agency-closed`, όχι `agency-not-brokerage` (ίδια με τον γραφέα).
    ['κλειστή μεσιτική', CLOSURE, BROKER_CREDENTIAL, 'agency-closed'],
    ['κλειστή ΚΑΙ τεχνίτης (η σειρά)', CLOSURE, TRADE_CREDENTIAL, 'agency-closed'],
    ['ενεργή τεχνική', null, TRADE_CREDENTIAL, 'agency-not-brokerage'],
    ['ενεργή μεσιτική (ο παρονομαστής)', null, BROKER_CREDENTIAL, null],
  ] as const)('Ε — %s ⇒ %s', (_label, closure, credential, expected) => {
    const showcase = showcaseFixture({ legalIdentity: identity(closure), credentials: [credential] });

    expect(mandateRefusalOf(showcase)).toBe(expected);
  });
});
