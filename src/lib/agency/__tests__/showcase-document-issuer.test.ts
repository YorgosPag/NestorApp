/**
 * @fileoverview Άγκυρες ADR-915 §21 — «ποιος μπορεί να ΕΚΔΩΣΕΙ αυτό το έγγραφο;» στον κατάλογο `/pro`, και οι άδειες
 * της βιτρίνας (σχηματισμός · ανάγνωση).
 * @related lib/agency/occupation-query.ts · lib/agency/showcase-licence.ts · config/document-validity/document-issuers.ts
 */

import { PROJECT_ROLE_BRIDGE } from '@/config/profession-bridge.config';
import { escoOccupationUri } from '@/lib/esco/esco-uri';
import type { PublicShowcase, ShowcaseCredential, ShowcaseLicence } from '@/types/agency-profile';

import { showcaseFixture } from '../__fixtures__/showcase-fixture';
import { documentToken, readOccupationQuery, showcaseOffersOccupation } from '../occupation-query';
import { formShowcaseLicences, readShowcaseLicences } from '../showcase-licence';
import { parseShowcaseFilters, serializeShowcaseFilters } from '../showcase-filter';

function uriOf(role: 'structural_engineer' | 'architect' | 'mechanical_engineer'): string {
  const uri = PROJECT_ROLE_BRIDGE[role].escoUri;
  if (uri === null) throw new Error(`no ESCO URI for ${role}`);
  return uri;
}

const CIVIL = uriOf('structural_engineer');
const MECHANICAL = uriOf('mechanical_engineer');
const URBAN_PLANNER = escoOccupationUri('e14548c8-c2b9-4ef8-8670-d5967d7ad804');
const INSPECTOR_LICENCE: ShowcaseLicence = {
  licence: 'energy-inspector',
  attestation: { state: 'declared', registration: { authorityKind: 'national', authority: 'ypen', number: '12345' } },
};

function credential(escoUri: string, iscoCode: string): ShowcaseCredential {
  return {
    standing: 'self-declared',
    occupation: { escoUri, label: { el: escoUri, en: escoUri }, iscoCode },
    attestation: { state: 'unknown' },
  };
}

function showcase(credentials: readonly ShowcaseCredential[], licences: readonly ShowcaseLicence[] = []): PublicShowcase {
  return showcaseFixture({ credentials, licences });
}

function offers(target: PublicShowcase, token: string): boolean {
  const query = readOccupationQuery(token);
  if (query === null) throw new Error(`unreadable token ${token}`);
  return showcaseOffersOccupation(target, query);
}

describe('ADR-915 §21 — `?occupation=document:<είδος>`', () => {
  it('Ε1: γνωστό είδος ⇒ ερώτημα εγγράφου· άγνωστο ⇒ null (ποτέ «κανείς δεν ταιριάζει»)', () => {
    expect(readOccupationQuery(documentToken('energy-certificate'))).toEqual({ kind: 'document', documentKind: 'energy-certificate' });
    expect(readOccupationQuery('document:nope')).toBeNull();
  });

  it('Ε2: το URL κάνει πλήρη κύκλο — ο άξονας μένει ΕΝΑΣ (occupation)', () => {
    const filters = parseShowcaseFilters(new URLSearchParams({ occupation: documentToken('building-identity') }));
    expect(filters.occupation).toBe('document:building-identity');
    expect(serializeShowcaseFilters(filters).get('occupation')).toBe('document:building-identity');
  });

  it('Ε3: ΠΕΑ ⇒ ΜΟΝΟ με δηλωμένη άδεια ΥΠΕΝ — ο μηχανολόγος χωρίς άδεια ΔΕΝ εμφανίζεται', () => {
    expect(offers(showcase([credential(MECHANICAL, '2144')], [INSPECTOR_LICENCE]), documentToken('energy-certificate'))).toBe(true);
    expect(offers(showcase([credential(MECHANICAL, '2144')]), documentToken('energy-certificate'))).toBe(false);
  });

  it('Ε4: ταυτότητα κτιρίου ⇒ οι ειδικότητες της απόφασης ΤΕΕ (και ο πολεοδόμος)· ΟΧΙ ο μηχανολόγος', () => {
    expect(offers(showcase([credential(CIVIL, '2142')]), documentToken('building-identity'))).toBe(true);
    expect(offers(showcase([credential(URBAN_PLANNER, '2164')]), documentToken('building-identity'))).toBe(true);
    expect(offers(showcase([credential(MECHANICAL, '2144')]), documentToken('building-identity'))).toBe(false);
  });

  it('Ε5: έγγραφο που εκδίδει ΑΡΧΗ (ΑΑΔΕ) ⇒ κανείς επαγγελματίας', () => {
    expect(offers(showcase([credential(CIVIL, '2142')], [INSPECTOR_LICENCE]), documentToken('tax-clearance'))).toBe(false);
  });
});

describe('ADR-915 §21 — οι άδειες της βιτρίνας', () => {
  it('Λ1: σχηματισμός ⇒ πάντα `declared`, η αρχή ΠΑΡΑΓΕΤΑΙ από την άδεια, ο αριθμός κόβεται', () => {
    expect(formShowcaseLicences([{ licence: 'energy-inspector', registrationNumber: ' 12345 ' }])).toEqual({ licences: [INSPECTOR_LICENCE] });
  });

  it('Λ2: άδεια χωρίς αριθμό ⇒ ονομασμένη άρνηση · διπλή ⇒ ονομασμένη άρνηση', () => {
    expect(formShowcaseLicences([{ licence: 'energy-inspector', registrationNumber: '  ' }])).toEqual({ reason: 'licence-number-missing' });
    expect(
      formShowcaseLicences([
        { licence: 'energy-inspector', registrationNumber: '1' },
        { licence: 'energy-inspector', registrationNumber: '2' },
      ]),
    ).toEqual({ reason: 'licence-duplicate' });
  });

  it('Λ3: ανάγνωση — παλιό έγγραφο ⇒ [] · ξένη αρχή / χωρίς αριθμό / άγνωστη άδεια ⇒ παραλείπεται · πλήρης κύκλος', () => {
    expect(readShowcaseLicences(undefined)).toEqual([]);
    expect(readShowcaseLicences([INSPECTOR_LICENCE])).toEqual([INSPECTOR_LICENCE]);
    const foreignAuthority = { ...INSPECTOR_LICENCE, attestation: { state: 'declared', registration: { authorityKind: 'national', authority: 'tee', number: '1' } } };
    const unknownState = { ...INSPECTOR_LICENCE, attestation: { state: 'unknown' } };
    expect(readShowcaseLicences([foreignAuthority, unknownState, { licence: 'nope', attestation: INSPECTOR_LICENCE.attestation }])).toEqual([]);
  });
});
