/**
 * ADR-915 §18 — άγκυρες του λεξιλογίου εκδοτών: κάθε είδος λέει ποιος το εκδίδει και ποιος το φέρνει, και κανένα URI
 * ESCO δεν είναι επινοημένο.
 */

import { PROJECT_ROLE_BRIDGE } from '@/config/profession-bridge.config';
import { PROFESSIONAL_LICENCE_SPECS } from '@/config/professional-licences';
import { REGISTRY_AUTHORITY_PRESENTATION } from '@/constants/professional-registries';
import {
  ISSUER_QUALIFICATION_LABEL_KEYS,
  LICENCE_REGISTRY_LABEL_KEYS,
} from '@/components/document-registry/document-registry-labels';
import {
  AUTHORITY_SERVICES,
  AUTHORITY_SERVICE_SPECS,
  ISSUER_QUALIFICATIONS,
  ISSUER_QUALIFICATION_SPECS,
  issuerAuthorityOf,
} from '@/config/document-validity/document-issuers';
import { DOCUMENT_KINDS, documentKindSpec } from '@/config/document-validity/document-validity';
import { escoDocIdOf, ESCO_OCCUPATION_URI_PREFIX } from '@/lib/esco/esco-uri';

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

  it('κάθε URI ESCO είναι πραγματικό occupation URI, χωρίς διπλά ανάμεσα σε προσόντα (κανένας επινοημένος κωδικός)', () => {
    const uris = ISSUER_QUALIFICATIONS.flatMap((q) => {
      const spec = ISSUER_QUALIFICATION_SPECS[q];
      return spec.kind === 'occupation' ? spec.escoUris : [];
    });
    expect(uris.filter((uri) => !uri.startsWith(ESCO_OCCUPATION_URI_PREFIX) || escoDocIdOf(uri) === null)).toEqual([]);
    expect(new Set(uris).size).toBe(uris.length);
  });

  it('τα προσόντα-ειδικότητες που εισάγονται από τη γέφυρα ρόλων ΣΥΜΦΩΝΟΥΝ μαζί της', () => {
    const civil = ISSUER_QUALIFICATION_SPECS['civil-engineer'];
    expect(civil).toEqual({ kind: 'occupation', escoUris: [PROJECT_ROLE_BRIDGE.structural_engineer.escoUri] });
  });

  it('το ΠΕΑ το εκδίδει ΜΟΝΟ προσόν-άδεια (άδεια ≠ επάγγελμα, ADR-915 §21)', () => {
    const { issuer } = documentKindSpec('energy-certificate');
    expect(issuer.kind).toBe('professional');
    if (issuer.kind !== 'professional') return;
    expect(issuer.qualifications.map((q) => ISSUER_QUALIFICATION_SPECS[q])).toEqual([{ kind: 'licence', licence: 'energy-inspector' }]);
  });

  it('χαρακτηρισμός: ΑΑΔΕ για φορολογική/ΕΝΦΙΑ · ΕΦΚΑ για ασφαλιστική · υπόχρεος πάντα ο ιδιοκτήτης', () => {
    const issuers = Object.fromEntries(
      DOCUMENT_KINDS.map((kind) => {
        const { issuer, obligor } = documentKindSpec(kind);
        return [kind, `${issuer.kind === 'authority' ? issuerAuthorityOf(issuer) : 'professional'}/${obligor}`];
      }),
    );
    expect(issuers).toEqual({
      'energy-certificate': 'professional/owner',
      'building-identity': 'professional/owner',
      'tax-clearance': 'aade/owner',
      'insurance-clearance': 'efka/owner',
      'enfia-certificate': 'aade/owner',
      // ADR-915 §32 — ηλεκτρολόγος εγκαταστάτης· «Έχω ενημερώσει τον ιδιοκτήτη […]» (ΥΔΕ, δήλωση 5)
      'electrical-installation': 'professional/owner',
    });
  });

  it('ο μηχανολόγος ΔΕΝ υπογράφει βεβαίωση άρθρου 83 (απόφαση Δ.Ε. ΤΕΕ)', () => {
    const { issuer } = documentKindSpec('building-identity');
    if (issuer.kind !== 'professional') throw new Error('expected professional issuer');
    const mechanical = PROJECT_ROLE_BRIDGE.mechanical_engineer.escoUri ?? '';
    const accepts = issuer.qualifications.some((q) => {
      const spec = ISSUER_QUALIFICATION_SPECS[q];
      return spec.kind === 'occupation' && spec.escoUris.includes(mechanical);
    });
    expect(accepts).toBe(false);
  });
});

describe('ADR-915 §21 — οι ετικέτες των αδειών ΔΕΝ ξαναγράφονται', () => {
  it('το κλειδί του προσόντος-άδειας και του μητρώου του = τα κλειδιά της πηγής (άδεια · αρχή)', () => {
    const spec = PROFESSIONAL_LICENCE_SPECS['energy-inspector'];
    expect(ISSUER_QUALIFICATION_LABEL_KEYS['energy-inspector-registered']).toBe(spec.nameKey);
    expect(LICENCE_REGISTRY_LABEL_KEYS['energy-inspector']).toBe(REGISTRY_AUTHORITY_PRESENTATION[spec.authority].nameKey);
  });

  it('§23 — κάθε υπηρεσία αυτοεξυπηρέτησης χρησιμοποιείται, δείχνει επίσημη είσοδο https (gov.gr) και έχει ημερομηνία', () => {
    const used = new Set(DOCUMENT_KINDS.flatMap((kind) => {
      const { issuer } = documentKindSpec(kind);
      return issuer.kind === 'authority' ? [issuer.service] : [];
    }));
    expect([...used].sort()).toEqual([...AUTHORITY_SERVICES].sort());
    const bad = AUTHORITY_SERVICES.filter((service) => {
      const { entryUrl, verifiedAt, pathSource } = AUTHORITY_SERVICE_SPECS[service];
      const host = new URL(entryUrl).hostname;
      return !entryUrl.startsWith('https://') || !host.endsWith('.gov.gr')
        || Number.isNaN(Date.parse(verifiedAt)) || pathSource.trim() === '';
    });
    expect(bad).toEqual([]);
  });
});
