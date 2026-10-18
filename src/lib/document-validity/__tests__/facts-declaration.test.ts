/**
 * ⚓ ADR-915 §33 — «Συμπλήρωση στοιχείων»: πότε προσφέρεται (Δ4) και ο ΕΝΑΣ κριτής της δήλωσης (Δ6), κοινός σε διάλογο
 * και διακομιστή.
 */

import { classificationHintOf } from '@/config/document-validity/document-validity';
import type { RegistryDocument } from '../document-registry';
import {
  FACTS_DECLARATION_ERROR_CODES,
  FACTS_DECLARATION_REFUSALS,
  FACTS_DECLARATION_SERVER_REFUSALS,
  factsDeclarationOf,
  factsDeclarationRefusalOfCode,
  judgeFactsDeclaration,
} from '../facts-declaration';

const file: Pick<RegistryDocument, 'origin' | 'source'> = { origin: { kind: 'file', fileId: 'f1' }, source: null };

describe('Δ4 — πότε προσφέρεται', () => {
  it('αρχείο χωρίς γεγονότα ⇒ «Συμπλήρωση»', () => {
    expect(factsDeclarationOf(file)).toBe('declare');
  });

  it('δήλωση του μητρώου ⇒ «Διόρθωση»', () => {
    expect(factsDeclarationOf({ ...file, source: { kind: 'attested', via: 'registry-declaration' } })).toBe('correct');
  });

  it('⛔ ανάγνωση του εγγράφου · έγκριση ελεγκτή ⇒ τίποτα (διορθώνονται εκεί όπου γεννήθηκαν)', () => {
    expect(factsDeclarationOf({ ...file, source: { kind: 'document-text', reader: 'pea-text' } })).toBeNull();
    expect(factsDeclarationOf({ ...file, source: { kind: 'attested', via: 'conveyance-review' } })).toBeNull();
  });

  it('⛔ δήλωση ΠΕΑ στο ακίνητο · έγκριση υπόθεσης χωρίς γεγονότα ⇒ τίποτα (δεν είναι αρχείο)', () => {
    expect(factsDeclarationOf({ origin: { kind: 'declared' }, source: null })).toBeNull();
    expect(factsDeclarationOf({ origin: { kind: 'attested', caseId: 'c1', fileId: 'f1' }, source: null })).toBeNull();
  });
});

describe('Δ6 — ο ΕΝΑΣ κριτής', () => {
  const yde = { kind: 'electrical-installation', issuedOn: '2022-03-01', printedValidUntil: '2032-03-01', classification: 'A' } as const;

  it('ΥΔΕ με έκδοση · τυπωμένη · κατηγορία ⇒ δεκτή, αυτούσια', () => {
    expect(judgeFactsDeclaration(yde)).toEqual({ ok: true, facts: { issuedOn: '2022-03-01', printedValidUntil: '2032-03-01', classification: 'A' } });
  });

  it('κατηγορία `null` («δεν τη γράφει») ⇒ δεκτή — ισχύει το μέγιστο ως ανώτατο (Υ4)', () => {
    expect(judgeFactsDeclaration({ ...yde, classification: null })).toMatchObject({ ok: true, facts: { classification: null } });
  });

  it('μόνο τυπωμένη λήξη, χωρίς έκδοση ⇒ δεκτή (ADR-915 §14 Ε3)', () => {
    expect(judgeFactsDeclaration({ ...yde, issuedOn: null }).ok).toBe(true);
  });

  it('⛔ λήξη πριν από την έκδοση ⇒ `validity-before-issue` (Ε4: άρνηση, ποτέ διόρθωση)', () => {
    expect(judgeFactsDeclaration({ ...yde, printedValidUntil: '2022-02-28' })).toEqual({ ok: false, refusal: 'validity-before-issue' });
  });

  it('⛔ καμία ημερομηνία ⇒ `empty`', () => {
    expect(judgeFactsDeclaration({ ...yde, issuedOn: null, printedValidUntil: null })).toEqual({ ok: false, refusal: 'empty' });
  });

  it('⛔ μη έγκυρη ημέρα ⇒ `invalid-date`', () => {
    expect(judgeFactsDeclaration({ ...yde, issuedOn: '2022-02-30' })).toEqual({ ok: false, refusal: 'invalid-date' });
    expect(judgeFactsDeclaration({ ...yde, printedValidUntil: 'αύριο' })).toEqual({ ok: false, refusal: 'invalid-date' });
  });

  it('⛔ κατηγορία εκτός λεξιλογίου του είδους ⇒ `classification-invalid` (και σε είδος που δεν κατατάσσεται)', () => {
    expect(judgeFactsDeclaration({ ...yde, classification: 'D' })).toEqual({ ok: false, refusal: 'classification-invalid' });
    const tax = { kind: 'tax-clearance', issuedOn: '2026-10-01', printedValidUntil: '2026-12-01', classification: 'A' } as const;
    expect(judgeFactsDeclaration(tax)).toEqual({ ok: false, refusal: 'classification-invalid' });
  });

  it('⛔ τυπωμένη λήξη σε είδος που ΔΕΝ τυπώνει (ΠΕΑ: 10 έτη από την έκδοση) ⇒ `not-printed`', () => {
    const pea = { kind: 'energy-certificate', issuedOn: '2026-01-01', printedValidUntil: '2036-01-01', classification: null } as const;
    expect(judgeFactsDeclaration(pea)).toEqual({ ok: false, refusal: 'not-printed' });
    expect(judgeFactsDeclaration({ ...pea, printedValidUntil: null }).ok).toBe(true);
  });
});

describe('οι κωδικοί της απόκρισης — ένας πίνακας για route και οθόνη', () => {
  it('κάθε άρνηση έχει ΔΙΚΟ της κωδικό και γυρίζει πίσω από αυτόν', () => {
    const all = [...FACTS_DECLARATION_REFUSALS, ...FACTS_DECLARATION_SERVER_REFUSALS];
    expect(new Set(all.map((refusal) => FACTS_DECLARATION_ERROR_CODES[refusal])).size).toBe(all.length);
    for (const refusal of all) expect(factsDeclarationRefusalOfCode(FACTS_DECLARATION_ERROR_CODES[refusal])).toBe(refusal);
  });

  it('άγνωστος κωδικός · δίκτυο ⇒ `null`', () => {
    expect(factsDeclarationRefusalOfCode('NOT_AN_OWNER')).toBeNull();
    expect(factsDeclarationRefusalOfCode(null)).toBeNull();
  });
});

describe('Δ7 — υπόδειξη κατηγορίας από τον τύπο ακινήτου (ΜΟΝΟ προεπιλογή του διαλόγου)', () => {
  it('ΥΔΕ: κατοικία ⇒ Α · επαγγελματικό ⇒ Β · οικόπεδο / άγνωστος τύπος ⇒ καμία υπόδειξη', () => {
    expect(classificationHintOf('electrical-installation', 'residential')).toBe('A');
    expect(classificationHintOf('electrical-installation', 'commercial')).toBe('B');
    expect(classificationHintOf('electrical-installation', 'land')).toBeNull();
    expect(classificationHintOf('electrical-installation', null)).toBeNull();
  });

  it('είδος που δεν κατατάσσεται ⇒ ποτέ υπόδειξη', () => {
    expect(classificationHintOf('energy-certificate', 'residential')).toBeNull();
  });
});
