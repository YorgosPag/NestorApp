/**
 * ADR-915 §18 — άγκυρες του λεξιλογίου εκδοτών: κάθε είδος λέει ποιος το εκδίδει και ποιος το φέρνει, και κανένα URI
 * ESCO δεν είναι επινοημένο.
 */

import { PROJECT_ROLE_BRIDGE } from '@/config/profession-bridge.config';
import {
  ISSUER_QUALIFICATIONS,
  ISSUER_QUALIFICATION_SPECS,
} from '@/config/document-validity/document-issuers';
import { DOCUMENT_KINDS, documentKindSpec } from '@/config/document-validity/document-validity';

describe('ADR-915 §18 — εκδότες εγγράφων', () => {
  it('κάθε επαγγελματικός εκδότης έχει ≥1 προσόν, χωρίς διπλά, και ISO ή null επαλήθευση', () => {
    const bad = DOCUMENT_KINDS.filter((kind) => {
      const { issuer } = documentKindSpec(kind);
      if (issuer.kind !== 'professional') return false;
      const unique = new Set(issuer.qualifications).size === issuer.qualifications.length;
      const dated = issuer.verifiedAt === null || !Number.isNaN(Date.parse(issuer.verifiedAt));
      return issuer.qualifications.length === 0 || !unique || !dated || issuer.statute.trim() === '';
    });
    expect(bad).toEqual([]);
  });

  it('κάθε μη-null URI ESCO είναι ήδη επαληθευμένο στη γέφυρα ρόλων (κανένας επινοημένος κωδικός)', () => {
    const verified = new Set(Object.values(PROJECT_ROLE_BRIDGE).map((entry) => entry.escoUri).filter(Boolean));
    const invented = ISSUER_QUALIFICATIONS.filter((q) => {
      const uri = ISSUER_QUALIFICATION_SPECS[q].escoUri;
      return uri !== null && !verified.has(uri);
    });
    expect(invented).toEqual([]);
  });

  it('το ΠΕΑ το εκδίδει ΜΟΝΟ προσόν με εγγραφή σε μητρώο (προσόν ≠ επάγγελμα)', () => {
    const { issuer } = documentKindSpec('energy-certificate');
    expect(issuer.kind).toBe('professional');
    if (issuer.kind !== 'professional') return;
    expect(issuer.qualifications.every((q) => ISSUER_QUALIFICATION_SPECS[q].registry !== null)).toBe(true);
  });

  it('χαρακτηρισμός: ΑΑΔΕ για φορολογική/ΕΝΦΙΑ · ΕΦΚΑ για ασφαλιστική · υπόχρεος πάντα ο ιδιοκτήτης', () => {
    const issuers = Object.fromEntries(
      DOCUMENT_KINDS.map((kind) => {
        const { issuer, obligor } = documentKindSpec(kind);
        return [kind, `${issuer.kind === 'authority' ? issuer.authority : 'professional'}/${obligor}`];
      }),
    );
    expect(issuers).toEqual({
      'energy-certificate': 'professional/owner',
      'building-identity': 'professional/owner',
      'tax-clearance': 'aade/owner',
      'insurance-clearance': 'efka/owner',
      'enfia-certificate': 'aade/owner',
    });
  });

  it('ο μηχανολόγος ΔΕΝ υπογράφει βεβαίωση άρθρου 83 (απόφαση Δ.Ε. ΤΕΕ)', () => {
    const { issuer } = documentKindSpec('building-identity');
    if (issuer.kind !== 'professional') throw new Error('expected professional issuer');
    const mechanical = PROJECT_ROLE_BRIDGE.mechanical_engineer.escoUri;
    expect(issuer.qualifications.some((q) => ISSUER_QUALIFICATION_SPECS[q].escoUri === mechanical)).toBe(false);
  });
});
