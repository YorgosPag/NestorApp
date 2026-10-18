/**
 * ADR-915 §24 · §27 — άγκυρες του «Επόμενου βήματος»: οι ενέργειες παράγονται από τον εκδότη, εμφανίζονται μόνο όταν
 * χρειάζεται νέο έγγραφο, και ο σύνδεσμος του καταλόγου γράφεται/διαβάζεται από τον ΙΔΙΟ σειριοποιητή. §27: για
 * επαγγελματία η «Ανάθεση» έρχεται **πρώτη**, το «Βρες» δεύτερο.
 */

import { documentIssuerSearchHref } from '@/components/mandate/agency-directory-route';
import { DOCUMENT_KINDS, documentKindSpec } from '@/config/document-validity/document-validity';
import { readOccupationQuery } from '@/lib/agency/occupation-query';
import { parseShowcaseFilters } from '@/lib/agency/showcase-filter';
import { REGISTRY_ROW_STATES } from '@/lib/document-validity/document-registry';
import {
  documentNextSteps,
  needsIssuanceAssignment,
  needsProfessionalSearch,
  NEXT_STEP_STATES,
} from '@/lib/document-validity/document-next-step';

const AREA = 'municipality:0501';

describe('ADR-915 §24 — «Επόμενο βήμα»', () => {
  it('κάθε είδος, σε κάθε κατάσταση που θέλει νέο έγγραφο: επαγγελματίας ⇒ ΔΥΟ ενέργειες · αρχή ⇒ ΜΙΑ', () => {
    const expected = (kind: (typeof DOCUMENT_KINDS)[number]) => (documentKindSpec(kind).issuer.kind === 'professional' ? 2 : 1);
    const bad = DOCUMENT_KINDS.flatMap((kind) =>
      NEXT_STEP_STATES.filter((state) => documentNextSteps(kind, state).length !== expected(kind)).map((state) => `${kind}/${state}`));
    expect(bad).toEqual([]);
  });

  it('έγκυρο · αντικατεστημένο · άγνωστης λήξης ⇒ καμία ενέργεια', () => {
    const quiet = REGISTRY_ROW_STATES.filter((state) => !(NEXT_STEP_STATES as readonly string[]).includes(state));
    expect(quiet.sort()).toEqual(['expiry-unknown', 'superseded', 'valid']);
    const bad = DOCUMENT_KINDS.flatMap((kind) => quiet.filter((state) => documentNextSteps(kind, state).length > 0));
    expect(bad).toEqual([]);
  });

  it('οι ενέργειες ΠΑΡΑΓΟΝΤΑΙ από τον εκδότη: επαγγελματίας ⇒ «Ανάθεση» ΠΡΩΤΑ, μετά «Βρες» · αρχή ⇒ η υπηρεσία της', () => {
    const steps = Object.fromEntries(DOCUMENT_KINDS.map((kind) => [kind, documentNextSteps(kind, 'expired')]));
    expect(steps).toEqual({
      'energy-certificate': [
        { kind: 'assign-professional', documentKind: 'energy-certificate' },
        { kind: 'find-professional', documentKind: 'energy-certificate' },
      ],
      'building-identity': [
        { kind: 'assign-professional', documentKind: 'building-identity' },
        { kind: 'find-professional', documentKind: 'building-identity' },
      ],
      'tax-clearance': [{ kind: 'self-service', service: 'aade-tax-clearance' }],
      'insurance-clearance': [{ kind: 'self-service', service: 'efka-insurance-clearance' }],
      'enfia-certificate': [{ kind: 'self-service', service: 'aade-enfia-certificate' }],
      'electrical-installation': [
        { kind: 'assign-professional', documentKind: 'electrical-installation' },
        { kind: 'find-professional', documentKind: 'electrical-installation' },
      ],
    });
    const professional = DOCUMENT_KINDS.filter((kind) => documentKindSpec(kind).issuer.kind === 'professional');
    expect(DOCUMENT_KINDS.filter((kind) => needsProfessionalSearch(kind, 'missing'))).toEqual(professional);
    // §27 — ο διακομιστής διαβάζει αναθέσεις ΑΚΡΙΒΩΣ όπου η οθόνη δείχνει «Ανάθεση».
    expect(DOCUMENT_KINDS.filter((kind) => needsIssuanceAssignment(kind, 'missing'))).toEqual(professional);
    expect(DOCUMENT_KINDS.filter((kind) => needsIssuanceAssignment(kind, 'valid'))).toEqual([]);
  });

  it('κύκλος διεύθυνσης: ό,τι γράφει το «Βρες» το διαβάζει ο κατάλογος ως {έγγραφο, δήμος}', () => {
    for (const kind of DOCUMENT_KINDS) {
      for (const area of [AREA, null]) {
        const href = documentIssuerSearchHref(kind, area);
        const [path, query = ''] = href.split('?');
        expect(path).toBe('/pro');
        const filters = parseShowcaseFilters(new URLSearchParams(query));
        expect(readOccupationQuery(filters.occupation ?? '')).toEqual({ kind: 'document', documentKind: kind });
        expect(filters.where).toEqual(area === null ? null : { adminId: area });
      }
    }
  });
});
