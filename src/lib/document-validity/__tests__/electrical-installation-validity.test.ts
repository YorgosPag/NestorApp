/**
 * ⚓ ADR-915 §32 — ΥΔΕ: η λήξη ζει ΤΥΠΩΜΕΝΗ («ΕΠΟΜΕΝΟΣ ΤΑΚΤΙΚΟΣ ΕΠΑΝΕΛΕΓΧΟΣ — μέχρι:»), μέσα σε ανώτατο ανά καθεστώς
 * έκδοσης × κατηγορία που γράφει ο ΕΚΔΟΤΗΣ (ΦΕΚ Β' 4654/2021, Παράρτημα ΙΙ παρ. 1).
 *
 * | Μετάλλαξη | Κοκκινίζει |
 * |---|---|
 * | `classifiedMonthsOf`: άγνωστη κατηγορία ⇒ `Math.min` αντί για `Math.max` | Υ6 |
 * | `regimeOn`: `issuedOn >= regime.from` → `issuedOn > regime.from` | Υ7 (η ίδια η 08.10.2021) |
 * | `printedBoundsOf`: η κατηγορία δεν περνά στο ανώτατο | Υ4 · Υ5 |
 * | `readDocumentFacts`: κατηγορία χωρίς έλεγχο είδους | Υ10 |
 */

import { ELECTRICAL_INSTALLER_ESCO_URIS } from '@/config/electrical-installer-occupations';
import { ISSUER_QUALIFICATION_SPECS } from '@/config/document-validity/document-issuers';
import {
  DOCUMENT_CLASSIFICATIONS,
  ELECTRICAL_REINSPECTION_REGIMES,
  classificationsOf,
  documentKindSpec,
  isClassificationOf,
  type DocumentClassification,
} from '@/config/document-validity/document-validity';
import { OCCUPATION_FAMILIES } from '@/config/occupation-families';
import { PROFESSIONAL_LICENCE_SPECS } from '@/config/professional-licences';
import { escoOccupationUri } from '@/lib/esco/esco-uri';
import { documentExpiry, ruleExpires } from '@/lib/document-validity/document-expiry';
import { documentFactsExpiry, readDocumentFacts } from '@/lib/document-validity/document-facts';

const YDE = documentKindSpec('electrical-installation').rule;

const expiryOf = (issuedOn: string, printedValidUntil: string | null, classification: DocumentClassification | null) =>
  documentExpiry({ rule: YDE, issuedOn, printedValidUntil, classification });

describe('Υ — ο κανόνας της ΥΔΕ (ΦΕΚ Β\' 4654/2021)', () => {
  it('Υ1 χωρίς τυπωμένη ⇒ «δεν ξέρουμε»: ο συντάκτης μπορεί να ορίσει μικρότερο διάστημα, άρα κανένα κατώτατο', () => {
    expect(YDE).toMatchObject({ kind: 'printed', floor: null });
    expect(ruleExpires(YDE)).toBe(true);
    expect(expiryOf('2024-05-10', null, 'A')).toEqual({ expiresOn: null, source: null, discrepancy: null });
  });

  it('Υ2 τυπωμένη μέσα στο ανώτατο ⇒ η τυπωμένη, χωρίς ασυμφωνία', () => {
    expect(expiryOf('2024-05-10', '2034-05-10', 'A')).toEqual({ expiresOn: '2034-05-10', source: 'printed', discrepancy: null });
  });

  it('Υ3 ΜΙΚΡΟΤΕΡΗ τυπωμένη ⇒ η τυπωμένη, ΧΩΡΙΣ ασυμφωνία (Παράρτημα ΙΙ παρ. 4: «για λόγους ασφάλειας»)', () => {
    expect(expiryOf('2024-05-10', '2027-05-10', 'A')).toEqual({ expiresOn: '2027-05-10', source: 'printed', discrepancy: null });
  });

  it('Υ4 κατηγορία Β (5 έτη) με τυπωμένη 10 ετών ⇒ το ανώτατο + ασυμφωνία — ποτέ «σε ισχύ» πέρα από τον νόμο', () => {
    expect(expiryOf('2024-05-10', '2034-05-10', 'B')).toEqual({
      expiresOn: '2029-05-10',
      source: 'rule',
      discrepancy: { rule: '2029-05-10', printed: '2034-05-10' },
    });
  });

  it('Υ5 κατηγορία Γ (χώροι συνάθροισης κοινού) ⇒ 2 έτη', () => {
    expect(expiryOf('2024-05-10', '2026-05-10', 'C').discrepancy).toBeNull();
    expect(expiryOf('2024-05-10', '2026-05-11', 'C').expiresOn).toBe('2026-05-10');
  });

  it('Υ6 άγνωστη κατηγορία ⇒ το ΜΕΓΙΣΤΟ του καθεστώτος ως ανώτατο (μόνο ανώτατο — ποτέ εγγύηση)', () => {
    expect(expiryOf('2024-05-10', '2034-05-10', null)).toEqual({ expiresOn: '2034-05-10', source: 'printed', discrepancy: null });
    expect(expiryOf('2024-05-10', '2035-05-10', null).expiresOn).toBe('2034-05-10');
  });

  it('Υ7 άρθρο 6 παρ. 1: ΥΔΕ πριν από τις 08.10.2021 κρατά το παλιό διάστημα (κατοικίες 14 έτη)· από την ίδια μέρα, 10', () => {
    expect(expiryOf('2021-10-07', '2035-10-07', 'A')).toEqual({ expiresOn: '2035-10-07', source: 'printed', discrepancy: null });
    expect(expiryOf('2021-10-08', '2035-10-08', 'A').expiresOn).toBe('2031-10-08');
  });

  it('Υ8 ο πίνακας καθεστώτων: νεότερο πρώτα, τελευταίο χωρίς αρχή, κάθε καθεστώς απαντά για ΚΑΘΕ κατηγορία', () => {
    const froms = ELECTRICAL_REINSPECTION_REGIMES.map((regime) => regime.from);
    expect(froms[froms.length - 1]).toBeNull();
    const dated = froms.filter((from): from is string => from !== null);
    expect(dated).toEqual([...dated].sort().reverse());
    for (const regime of ELECTRICAL_REINSPECTION_REGIMES) {
      expect(Object.keys(regime.months).sort()).toEqual([...DOCUMENT_CLASSIFICATIONS['electrical-installation']].sort());
    }
  });
});

describe('Κ — η κατάταξη είναι γεγονός του ΕΓΓΡΑΦΟΥ, ανά είδος', () => {
  it('Υ9 λεξιλόγιο ανά είδος: η ΥΔΕ Α/Β/C· το ελληνικό «Γ» δεν είναι κωδικός· τα άλλα είδη δεν κατατάσσονται', () => {
    expect(classificationsOf('electrical-installation')).toEqual(['A', 'B', 'C']);
    expect(isClassificationOf('electrical-installation', 'Γ')).toBe(false);
    expect(classificationsOf('energy-certificate')).toEqual([]);
    expect(isClassificationOf('energy-certificate', 'A')).toBe(false);
  });

  it('Υ10 ο ανεκτικός αναγνώστης κρατά κατηγορία ΜΟΝΟ του είδους της· απουσία ⇒ `null`, ποτέ απόρριψη', () => {
    const base = {
      kind: 'electrical-installation',
      issuedOn: '2024-05-10',
      printedValidUntil: '2034-05-10',
      source: { kind: 'attested', via: 'conveyance-review' },
      recordedBy: 'u1',
      recordedAt: '2026-10-18T10:00:00.000Z',
    };
    expect(readDocumentFacts({ ...base, classification: 'B' })?.classification).toBe('B');
    expect(readDocumentFacts({ ...base, classification: 'Z' })?.classification).toBeNull();
    expect(readDocumentFacts(base)?.classification).toBeNull();
    expect(readDocumentFacts({ ...base, kind: 'energy-certificate', classification: 'A' })?.classification).toBeNull();
    const read = readDocumentFacts({ ...base, classification: 'B' });
    expect(read === null ? null : documentFactsExpiry(read).expiresOn).toBe('2029-05-10');
  });
});

describe('Ε — ποιος την εκδίδει, πού ελέγχεται', () => {
  it('Υ11 ηλεκτρολόγος εγκαταστάτης: υποσύνολο της ομάδας «Ηλεκτρολόγος», ΧΩΡΙΣ οικιακών συσκευών / ηλιακής ενέργειας', () => {
    const { issuer } = documentKindSpec('electrical-installation');
    expect(issuer).toMatchObject({ kind: 'professional', qualifications: ['electrical-installer'], appointedBy: 'owner' });
    // ADR-915 §34: το προσόν είναι η ΑΔΕΙΑ· οι ειδικότητες 7411 την έχουν μέσα από την εγγραφή Περιφέρειας.
    expect(ISSUER_QUALIFICATION_SPECS['electrical-installer']).toEqual({ kind: 'licence', licence: 'electrical-installer' });
    expect(PROFESSIONAL_LICENCE_SPECS['electrical-installer']).toMatchObject({
      authority: 'regional-authority',
      heldThroughOccupations: ELECTRICAL_INSTALLER_ESCO_URIS,
    });
    const family = OCCUPATION_FAMILIES.find((candidate) => candidate.id === 'electrician');
    for (const uri of ELECTRICAL_INSTALLER_ESCO_URIS) expect(family?.escoUris).toContain(uri);
    expect(ELECTRICAL_INSTALLER_ESCO_URIS).not.toContain(escoOccupationUri('5dbb9cf0-b226-402c-a295-2f42ef05ff8b'));
    expect(ELECTRICAL_INSTALLER_ESCO_URIS).not.toContain(escoOccupationUri('75b63949-1b93-4bf2-a777-ccf978dc3e8a'));
  });

  it('Υ12 δημόσιος έλεγχος στον ΔΕΔΔΗΕ (σύνδεσμος, όχι scraping)· η αγγελία δεν οφείλει να την αναγράφει', () => {
    const spec = documentKindSpec('electrical-installation');
    expect(spec.publicLookup?.url).toBe('https://apps.deddie.gr/LicensedElectricianCertification/');
    expect(spec.advertisingDisclosure).toBeNull();
  });
});
