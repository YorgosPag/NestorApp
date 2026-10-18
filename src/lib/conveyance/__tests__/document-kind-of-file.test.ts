/**
 * ⚓ ADR-915 §20 — «τι έγγραφο είναι αυτό το αρχείο;» διαβάζεται ΑΝΑΠΟΔΑ από τον ΕΝΑ κατάλογο, ποτέ από δεύτερη λίστα.
 */

import { CONVEYANCE_CHECKLIST } from '@/config/conveyance-checklist/catalog';
import { DOCUMENT_KINDS, documentKindSpec } from '@/config/document-validity/document-validity';
import { findEntryPoint } from '@/config/upload-entry-points/queries';
import { LEVEL_ENTITY_TYPES } from '@/lib/conveyance/evidence-match';
import {
  documentKindsOfFile,
  namedDocumentFileKeys,
  namedDocumentKindOfFile,
} from '@/lib/conveyance/document-kind-of-file';

describe('documentKindsOfFile (ADR-915 §20)', () => {
  it('ενημερότητες του πωλητή (επαφή) ⇒ το είδος της γραμμής τους', () => {
    expect(documentKindsOfFile({ entityType: 'contact', purpose: 'tax-clearance' })).toEqual(['tax-clearance']);
    expect(documentKindsOfFile({ entityType: 'contact', purpose: 'insurance-clearance' })).toEqual(['insurance-clearance']);
    expect(documentKindsOfFile({ entityType: 'contact', purpose: 'owner-enfia' })).toEqual(['enfia-certificate']);
  });

  it('το ΙΔΙΟ σκοπός σε επίπεδο που η γραμμή δεν ακούει ⇒ τίποτα (το επίπεδο μετρά, όπως στον κατάλογο)', () => {
    expect(documentKindsOfFile({ entityType: 'project', purpose: 'tax-clearance' })).toEqual([]);
  });

  it('άγνωστος σκοπός · ελλιπή πεδία ⇒ τίποτα — ποτέ μαντεψιά', () => {
    expect(documentKindsOfFile({ entityType: 'contact', purpose: 'document' })).toEqual([]);
    expect(documentKindsOfFile({ entityType: 'contact' })).toEqual([]);
    expect(documentKindsOfFile({ entityType: 42, purpose: 'tax-clearance' })).toEqual([]);
  });

  // Άγκυρα ταυτότητας: για ΚΑΘΕ γραμμή με είδος, κάθε (entityType, purpose) που την ικανοποιεί δίνει πίσω το είδος της.
  it('round-trip σε όλο τον κατάλογο: κανένα entry point γραμμής-με-είδος δεν χάνεται', () => {
    let checked = 0;
    for (const item of CONVEYANCE_CHECKLIST) {
      if (item.documentKind === undefined || item.satisfaction.kind !== 'files') continue;
      for (const matcher of item.satisfaction.matchers) {
        for (const entityType of LEVEL_ENTITY_TYPES[matcher.level]) {
          for (const id of matcher.entryPointIds) {
            const entry = findEntryPoint(entityType, id);
            if (entry === undefined) continue;
            expect(documentKindsOfFile({ entityType, purpose: entry.purpose })).toContain(item.documentKind);
            checked += 1;
          }
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(6);
  });
});

describe('ADR-915 §32 — είδη ΕΚΤΟΣ καταλόγου (`standaloneEvidence`)', () => {
  it('ΥΔΕ στο ακίνητο ⇒ ηλεκτρική εγκατάσταση· ο ΙΔΙΟΣ σκοπός στην επαφή (αρχείο του ηλεκτρολόγου) ⇒ τίποτα', () => {
    expect(documentKindsOfFile({ entityType: 'property', purpose: 'yde-declaration' })).toEqual(['electrical-installation']);
    expect(documentKindsOfFile({ entityType: 'contact', purpose: 'yde-declaration' })).toEqual([]);
  });

  it('ΕΝΑΣ ιδιοκτήτης ανά είδος: κανένα είδος δεν δηλώνει entry points ΚΑΙ στη γραμμή του καταλόγου ΚΑΙ στο είδος', () => {
    const inChecklist = new Set(CONVEYANCE_CHECKLIST.flatMap((item) => (item.documentKind === undefined ? [] : [item.documentKind])));
    const both = DOCUMENT_KINDS.filter((kind) => documentKindSpec(kind).standaloneEvidence !== null && inChecklist.has(kind));
    expect(both).toEqual([]);
  });

  it('κάθε δηλωμένο entry point ΥΠΑΡΧΕΙ σε κάποιον τύπο του επιπέδου του — αλλιώς το είδος δεν θα έβρισκε ποτέ αρχείο', () => {
    const missing = DOCUMENT_KINDS.flatMap((kind) =>
      (documentKindSpec(kind).standaloneEvidence ?? []).flatMap((matcher) =>
        matcher.entryPointIds.filter((id) =>
          LEVEL_ENTITY_TYPES[matcher.level].every((entityType) => findEntryPoint(entityType, id) === undefined)),
      ),
    );
    expect(missing).toEqual([]);
  });
});

describe('ADR-915 §33 — υπόσχεση vs φιλοξενία (`namedDocumentKindOfFile`)', () => {
  it('⛔ η γενική θέση «Πιστοποιητικό» ΦΙΛΟΞΕΝΕΙ ΠΕΑ (ο αναγνώστης κρίνει) αλλά ΔΕΝ το υπόσχεται', () => {
    expect(documentKindsOfFile({ entityType: 'property', purpose: 'certificate' })).toEqual(['energy-certificate']);
    expect(namedDocumentKindOfFile({ entityType: 'property', purpose: 'certificate' })).toBeNull();
  });

  it('ονομαστικές θέσεις ⇒ το είδος τους: ΥΔΕ ακινήτου · ΠΕΑ έργου · ενημερότητες επαφής', () => {
    expect(namedDocumentKindOfFile({ entityType: 'property', purpose: 'yde-declaration' })).toBe('electrical-installation');
    expect(namedDocumentKindOfFile({ entityType: 'project', purpose: 'study-energy-cert' })).toBe('energy-certificate');
    expect(namedDocumentKindOfFile({ entityType: 'contact', purpose: 'tax-clearance' })).toBe('tax-clearance');
  });

  it('ΥΔΕ στην επαφή (αρχείο του ηλεκτρολόγου) · άγνωστος σκοπός ⇒ τίποτα', () => {
    expect(namedDocumentKindOfFile({ entityType: 'contact', purpose: 'yde-declaration' })).toBeNull();
    expect(namedDocumentKindOfFile({ entityType: 'property', purpose: 'invoice' })).toBeNull();
  });

  it('οι σκοποί του ερωτήματος ΠΑΡΑΓΟΝΤΑΙ: κάθε κλειδί δίνει πίσω είδος, και ο γενικός σκοπός ΔΕΝ είναι μέσα', () => {
    const keys = namedDocumentFileKeys();
    expect(keys.length).toBeGreaterThanOrEqual(6);
    for (const key of keys) expect(namedDocumentKindOfFile(key)).not.toBeNull();
    expect(keys).not.toContainEqual({ entityType: 'property', purpose: 'certificate' });
  });

  it('το `in` του Firestore δέχεται ως 30 τιμές — οι σκοποί χωράνε', () => {
    expect(new Set(namedDocumentFileKeys().map((key) => key.purpose)).size).toBeLessThanOrEqual(30);
  });
});
