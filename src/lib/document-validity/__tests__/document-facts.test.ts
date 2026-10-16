/**
 * ⚓ ADR-915 Φ3 — τα γεγονότα εγγράφου: ανεκτικός αναγνώστης («δεν ξέρουμε», ποτέ «ισχύει»), ιεραρχία προέλευσης
 * (το έγγραφο κερδίζει τον άνθρωπο), ιδεμπότητα, και η γέφυρα προς την Α4 (η νωρίτερη από τυπωμένη και κανόνα).
 */

import {
  contradictsDocumentText,
  documentFactsExpiry,
  documentFactsVerdict,
  isDocumentText,
  readDocumentFacts,
  readDocumentFactsView,
  resolvedDocumentExpiry,
  type DocumentFacts,
} from '../document-facts';

const fromText: DocumentFacts = {
  kind: 'energy-certificate',
  issuedOn: '2026-07-16',
  printedValidUntil: '2036-07-16',
  source: { kind: 'document-text', reader: 'pea-text' },
  recordedBy: 'u1',
  recordedAt: '2026-10-14T10:00:00.000Z',
};

const attested: DocumentFacts = {
  ...fromText,
  printedValidUntil: null,
  source: { kind: 'attested', via: 'conveyance-review' },
  recordedBy: 'u2',
};

describe('Δ1 — ο ανεκτικός αναγνώστης', () => {
  it('έγκυρα γεγονότα διαβάζονται αυτούσια', () => {
    expect(readDocumentFacts(fromText)).toEqual(fromText);
    expect(readDocumentFacts(attested)).toEqual(attested);
  });

  it.each([
    ['απόν (κάθε αρχείο πριν τη Φ3)', undefined],
    ['null', null],
    ['πίνακας', [fromText]],
    ['άγνωστο είδος', { ...fromText, kind: 'tax-clearance' }],
    ['άγνωστη προέλευση', { ...fromText, source: { kind: 'ai-guess' } }],
    ['άγνωστος αναγνώστης', { ...fromText, source: { kind: 'document-text', reader: 'ocr' } }],
    ['άγνωστη διαδρομή δήλωσης', { ...fromText, source: { kind: 'attested', via: 'email' } }],
    ['χωρίς recordedBy', { ...fromText, recordedBy: ' ' }],
    ['χωρίς recordedAt', { ...fromText, recordedAt: undefined }],
  ])('⛔ %s ⇒ null («δεν ξέρουμε»)', (_label, raw) => {
    expect(readDocumentFacts(raw)).toBeNull();
  });

  it('ημερομηνία που δεν διαβάζεται χάνεται ΜΟΝΗ της', () => {
    expect(readDocumentFacts({ ...fromText, issuedOn: '16/07/2026' })).toEqual({ ...fromText, issuedOn: null });
    expect(readDocumentFacts({ ...fromText, printedValidUntil: 42 })).toEqual({ ...fromText, printedValidUntil: null });
  });

  it('⛔ τυπωμένη λήξη ΠΡΙΝ από την έκδοση είναι αδύνατη ⇒ απορρίπτεται μόνη της, η έκδοση μένει', () => {
    expect(readDocumentFacts({ ...fromText, printedValidUntil: '2026-07-15' })).toEqual({ ...fromText, printedValidUntil: null });
  });
});

describe('Δ2 — η ιεραρχία προέλευσης (ο γραφέας ρωτά εδώ)', () => {
  it('κενό ⇒ write', () => {
    expect(documentFactsVerdict(null, fromText)).toBe('write');
    expect(documentFactsVerdict(null, attested)).toBe('write');
  });

  it('ίδια γεγονότα ⇒ already-recorded, ανεξάρτητα από ποιον/πότε (ιδεμπότητα)', () => {
    expect(documentFactsVerdict(fromText, { ...fromText, recordedBy: 'u9', recordedAt: '2027-01-01T00:00:00.000Z' })).toBe('already-recorded');
  });

  it('⛔ δήλωση ανθρώπου πάνω σε ανάγνωση του εγγράφου ⇒ outranked (το έγγραφο δεν σβήνεται)', () => {
    expect(documentFactsVerdict(fromText, attested)).toBe('outranked');
    expect(documentFactsVerdict(fromText, { ...attested, issuedOn: '2026-01-01' })).toBe('outranked');
  });

  it('ανάγνωση πάνω σε δήλωση ⇒ write (το έγγραφο κερδίζει)', () => {
    expect(documentFactsVerdict(attested, fromText)).toBe('write');
  });

  it('διόρθωση δήλωσης από άνθρωπο ⇒ write', () => {
    expect(documentFactsVerdict(attested, { ...attested, issuedOn: '2026-07-17' })).toBe('write');
  });

  it('νέα ανάγνωση των ΙΔΙΩΝ bytes με άλλο αποτέλεσμα (νεότερος αναγνώστης) ⇒ write', () => {
    expect(documentFactsVerdict(fromText, { ...fromText, printedValidUntil: '2036-07-15' })).toBe('write');
  });
});

describe('Δ3 — η γέφυρα προς τη λήξη (Α4: η νωρίτερη)', () => {
  it('τυπωμένη = κανόνας ⇒ η ίδια μέρα, καμία ασυμφωνία (σε ισοπαλία κερδίζει το έγγραφο — Φ1)', () => {
    expect(documentFactsExpiry(fromText)).toEqual({ expiresOn: '2036-07-16', source: 'printed', discrepancy: null });
  });

  it('τυπωμένη νωρίτερα ⇒ ισχύει η τυπωμένη, με ασυμφωνία για τον ελεγκτή', () => {
    expect(documentFactsExpiry({ ...fromText, printedValidUntil: '2035-01-01' })).toEqual({
      expiresOn: '2035-01-01',
      source: 'printed',
      discrepancy: { rule: '2036-07-16', printed: '2035-01-01' },
    });
  });

  it('χωρίς τυπωμένη ⇒ ο κανόνας του είδους', () => {
    expect(documentFactsExpiry(attested).expiresOn).toBe('2036-07-16');
  });

  it('χωρίς έκδοση και χωρίς τυπωμένη ⇒ null, ποτέ «ισχύει»', () => {
    expect(documentFactsExpiry({ ...attested, issuedOn: null }).expiresOn).toBeNull();
  });
});

describe('Δ4 — Α3: το αρχείο κερδίζει, ανά πεδίο (η ΜΙΑ γέφυρα καταναλωτών)', () => {
  it('γεγονότα ίδιου είδους κερδίζουν την πληκτρολογημένη ημερομηνία', () => {
    expect(resolvedDocumentExpiry('energy-certificate', fromText, '2020-01-01').expiresOn).toBe('2036-07-16');
  });

  it('η τυπωμένη νωρίτερη κερδίζει τον κανόνα (Α4) — μαζί με την ασυμφωνία', () => {
    const facts = { ...fromText, printedValidUntil: '2035-01-01' };
    expect(resolvedDocumentExpiry('energy-certificate', facts, null)).toEqual(documentFactsExpiry(facts));
  });

  it('ό,τι δεν ξέρει το αρχείο το συμπληρώνει ο άνθρωπος', () => {
    expect(resolvedDocumentExpiry('energy-certificate', { ...attested, issuedOn: null }, '2026-07-16').expiresOn).toBe('2036-07-16');
  });

  it('⛔ γεγονότα ΑΛΛΟΥ είδους αγνοούνται — μένει η εφεδρεία', () => {
    expect(resolvedDocumentExpiry('building-identity', fromText, '2026-07-16')).toEqual({ expiresOn: '2026-09-16', source: 'rule', discrepancy: null });
  });

  it('χωρίς γεγονότα ⇒ ακριβώς ο κανόνας με την εφεδρεία (όπως πριν τη Φ3β)', () => {
    expect(resolvedDocumentExpiry('energy-certificate', null, '2026-07-16')).toEqual({ expiresOn: '2036-07-16', source: 'rule', discrepancy: null });
  });
});

describe('Δ5 — η προβολή δεν κουβαλά «ποιος/πότε»', () => {
  it('🔒 κανένα recordedBy/recordedAt σε ό,τι ταξιδεύει σε τρίτους', () => {
    const view = readDocumentFactsView(fromText);
    expect(view).toEqual({ kind: fromText.kind, issuedOn: fromText.issuedOn, printedValidUntil: fromText.printedValidUntil, source: fromText.source });
    expect(view).not.toHaveProperty('recordedBy');
    expect(readDocumentFactsView(undefined)).toBeNull();
  });

  it('isDocumentText: μόνο η ανάγνωση κειμένου κλειδώνει', () => {
    expect(isDocumentText(fromText)).toBe(true);
    expect(isDocumentText(attested)).toBe(false);
    expect(isDocumentText(null)).toBe(false);
  });
});

describe('Δ6 — ο ΕΝΑΣ φρουρός αντίφασης (μεταβίβαση + ακίνητο, ADR-915 Φ3β-2)', () => {
  it.each([
    ['ίδια ημερομηνία', 'energy-certificate', fromText, '2026-07-16', false],
    ['άλλη ημερομηνία ⇒ αντίφαση', 'energy-certificate', fromText, '2026-07-15', true],
    ['«δεν ξέρω» (null) δεν αντιλέγει', 'energy-certificate', fromText, null, false],
    ['δήλωση ανθρώπου δεν αντιλέγει', 'energy-certificate', { ...attested, issuedOn: '2020-01-01' }, '2026-07-16', false],
    ['ανάγνωση χωρίς έκδοση', 'energy-certificate', { ...fromText, issuedOn: null }, '2026-07-16', false],
    ['άλλο είδος', 'building-identity', fromText, '2026-07-15', false],
    ['άγνωστο είδος γραμμής', undefined, fromText, '2026-07-15', false],
    ['κανένα γεγονός', 'energy-certificate', null, '2026-07-15', false],
  ] as const)('%s', (_label, kind, facts, declared, expected) => {
    expect(contradictsDocumentText(kind, facts, declared)).toBe(expected);
  });
});
