/**
 * @fileoverview Άγκυρες του **«κλεισμένη στο ΓΕΜΗ;»** — ADR-841 §7 Α23 Φ3.2 (Απόφαση 1).
 * @related lib/agency/showcase-registry-closure.ts · services/realtime/hooks/usePublicAgencies.ts
 *
 * 🔴 Ο κατάλογος, η αρχική αναζήτηση και οι δύο πόρτες ενεργειών ρωτούν **αυτή** τη συνάρτηση.
 */

import { showcaseFixture } from '@/lib/agency/__fixtures__/showcase-fixture';
import type { ShowcaseLegalIdentity } from '@/types/showcase-legal-identity';

import { isListedInDirectory, registryClosureOf } from '../showcase-registry-closure';

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
