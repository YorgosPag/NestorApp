/**
 * @fileoverview Άγκυρες ADR-915 §21 — «ποιος μπορεί να ΕΚΔΩΣΕΙ αυτό το έγγραφο;» στον κατάλογο `/pro`, και οι άδειες
 * της βιτρίνας (σχηματισμός · ανάγνωση).
 * @related lib/agency/occupation-query.ts · lib/agency/showcase-licence.ts · config/document-validity/document-issuers.ts
 */

import { ELECTRICAL_INSTALLER_ESCO_URIS } from '@/config/electrical-installer-occupations';
import { PROJECT_ROLE_BRIDGE } from '@/config/profession-bridge.config';
import { escoOccupationUri } from '@/lib/esco/esco-uri';
import type { PublicShowcase, ShowcaseCredential, ShowcaseLicence } from '@/types/agency-profile';
import type { ProfessionalAttestation } from '@/types/professional-identity';

import { showcaseFixture } from '../__fixtures__/showcase-fixture';
import { documentToken, readOccupationQuery, showcaseOffersOccupation } from '../occupation-query';
import {
  formShowcaseLicences,
  licenceDeclaredTwice,
  licencesHeldThroughCredentials,
  readShowcaseLicences,
} from '../showcase-licence';
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

// ── ADR-915 §34 — άδεια ηλεκτρολόγου εγκαταστάτη ανά Περιφερειακή Ενότητα ──────────────────────────────────────
const ELECTRICIAN = ELECTRICAL_INSTALLER_ESCO_URIS[0];
// 7411 «ηλεκτρολόγος οικιακών συσκευών»: ίδια ομάδα ISCO, ΔΕΝ ελέγχει εγκατάσταση (ADR-915 §32 Υ5).
const APPLIANCE_ELECTRICIAN = escoOccupationUri('5dbb9cf0-b226-402c-a295-2f42ef05ff8b');
const REGIONAL: ProfessionalAttestation = {
  state: 'declared',
  registration: { authorityKind: 'chapter', authority: 'regional-authority', chapter: 'ΠΕ Θεσσαλονίκης', number: '4521' },
};
const TEE: ProfessionalAttestation = {
  state: 'declared',
  registration: { authorityKind: 'national', authority: 'tee', number: '98765' },
};
const INSTALLER_LICENCE: ShowcaseLicence = { licence: 'electrical-installer', attestation: REGIONAL };

function attested(escoUri: string, iscoCode: string, attestation: ProfessionalAttestation): ShowcaseCredential {
  return { ...credential(escoUri, iscoCode), attestation };
}

describe('ADR-915 §34 — «Βρες ηλεκτρολόγο για ΥΔΕ» = όσοι μπορούν να την υπογράψουν', () => {
  const yde = documentToken('electrical-installation');

  it('Η1: ηλεκτρολόγος 7411 ΧΩΡΙΣ αριθμό Περιφέρειας ⇒ όχι (π.δ. 108/2013 άρθ. 12) · ΜΕ αριθμό + ΠΕ ⇒ ναι', () => {
    expect(offers(showcase([credential(ELECTRICIAN, '7411')]), yde)).toBe(false);
    expect(offers(showcase([attested(ELECTRICIAN, '7411', REGIONAL)]), yde)).toBe(true);
  });

  it('Η2: η εγγραφή πρέπει να είναι στην ΙΔΙΑ αρχή — ηλεκτρολόγος με «αριθμό ΤΕΕ» δεν έχει άδεια εγκαταστάτη', () => {
    expect(offers(showcase([attested(ELECTRICIAN, '7411', TEE)]), yde)).toBe(false);
  });

  it('Η3: ηλεκτρολόγος οικιακών συσκευών, ακόμη και με αριθμό Περιφέρειας ⇒ όχι', () => {
    expect(offers(showcase([attested(APPLIANCE_ELECTRICIAN, '7411', REGIONAL)]), yde)).toBe(false);
  });

  it('Η4: μηχανικός ΤΕΕ μόνο ⇒ όχι · με δηλωμένη βεβαίωση αναγγελίας (ρητή άδεια) ⇒ ναι', () => {
    expect(offers(showcase([attested(MECHANICAL, '2144', TEE)]), yde)).toBe(false);
    expect(offers(showcase([attested(MECHANICAL, '2144', TEE)], [INSTALLER_LICENCE]), yde)).toBe(true);
  });

  it('Η5: η άδεια εγκαταστάτη ΔΕΝ κάνει κάποιον ενεργειακό επιθεωρητή (καμία διαρροή μεταξύ αδειών)', () => {
    const electrician = showcase([attested(ELECTRICIAN, '7411', REGIONAL)], [INSTALLER_LICENCE]);
    expect(offers(electrician, documentToken('energy-certificate'))).toBe(false);
  });
});

describe('ADR-915 §34 — άδεια με Περιφερειακή Ενότητα: σχηματισμός · ανάγνωση · μία δήλωση', () => {
  it('Π1: αρχή με παραρτήματα ⇒ ο εκδότης ΥΠΟΧΡΕΩΤΙΚΟΣ (ονομασμένη άρνηση) · με εκδότη ⇒ εγγραφή `chapter`', () => {
    const missing = { reason: 'licence-chapter-missing' };
    expect(formShowcaseLicences([{ licence: 'electrical-installer', registrationNumber: '4521' }])).toEqual(missing);
    expect(
      formShowcaseLicences([{ licence: 'electrical-installer', registrationNumber: '4521', registrationChapter: '  ' }]),
    ).toEqual(missing);
    expect(
      formShowcaseLicences([
        { licence: 'electrical-installer', registrationNumber: ' 4521 ', registrationChapter: ' ΠΕ Θεσσαλονίκης ' },
      ]),
    ).toEqual({ licences: [INSTALLER_LICENCE] });
  });

  it('Π2: εθνική αρχή ΑΓΝΟΕΙ τον εκδότη — ο επιθεωρητής δεν αποκτά «παράρτημα» ΥΠΕΝ', () => {
    expect(
      formShowcaseLicences([{ licence: 'energy-inspector', registrationNumber: '12345', registrationChapter: 'ΠΕ Χ' }]),
    ).toEqual({ licences: [INSPECTOR_LICENCE] });
  });

  it('Π3: αποθηκευμένη άδεια εγκαταστάτη χωρίς ΠΕ ή σε άλλη αρχή ⇒ παραλείπεται · σωστή ⇒ πλήρης κύκλος', () => {
    const noChapter = {
      licence: 'electrical-installer',
      attestation: { state: 'declared', registration: { authority: 'regional-authority', number: '1' } },
    };
    expect(readShowcaseLicences([noChapter, { licence: 'electrical-installer', attestation: TEE }])).toEqual([]);
    expect(readShowcaseLicences([INSTALLER_LICENCE])).toEqual([INSTALLER_LICENCE]);
  });

  it('Π4: η ειδικότητα ΕΙΝΑΙ η άδεια — μία ανά άδεια, με την απόδειξη του credential · `unknown` ⇒ καμία', () => {
    const credentials = [
      attested(ELECTRICIAN, '7411', REGIONAL),
      attested(ELECTRICAL_INSTALLER_ESCO_URIS[1], '7411', REGIONAL),
    ];
    expect(licencesHeldThroughCredentials(credentials)).toEqual([INSTALLER_LICENCE]);
    expect(licencesHeldThroughCredentials([credential(ELECTRICIAN, '7411')])).toEqual([]);
  });

  it('Π5: καμία διπλή δήλωση — ρητή άδεια που δίνει ήδη η ειδικότητα ⇒ ονομασμένη άρνηση · αλλιώς τίποτα', () => {
    const electrician = [attested(ELECTRICIAN, '7411', REGIONAL)];
    expect(licenceDeclaredTwice([INSTALLER_LICENCE], electrician)).toBe('licence-held-through-occupation');
    expect(licenceDeclaredTwice([INSTALLER_LICENCE], [attested(MECHANICAL, '2144', TEE)])).toBeNull();
    expect(licenceDeclaredTwice([INSPECTOR_LICENCE], electrician)).toBeNull();
  });
});
