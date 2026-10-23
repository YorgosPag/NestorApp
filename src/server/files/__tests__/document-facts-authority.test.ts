/**
 * @jest-environment node
 *
 * =============================================================================
 * 📅 ΑΓΚΥΡΑ — Ο ΕΝΑΣ ΓΡΑΦΕΑΣ των γεγονότων εγγράφου (ADR-915 Φ3)
 * =============================================================================
 *
 * Οι κανόνες (`documentFactsUnchanged`) κλείνουν τον **πελάτη**. Δεν βλέπουν το **Admin SDK**: ένας δεύτερος γραφέας στον
 * διακομιστή θα περνούσε κάθε κανόνα και θα παρέκαμπτε την ιεραρχία προέλευσης (ο άνθρωπος θα έσβηνε ό,τι διάβασε το
 * έγγραφο). Ίδιο κενό με αυτό που κλείνει η Κ1 της πύλης 3.87 για το CDE.
 *
 * | #  | ερώτημα | μετάλλαξη που πιάνει |
 * |---|---|---|
 * | Ε1 | η λίστα του κανόνα = το ΕΝΑ όνομα πεδίου του κώδικα; | μετονομασία στη μία πλευρά μόνο |
 * | Ε2 | γράφει κανείς `documentFacts` σε `.update/.set/updateDoc/setDoc` εκτός του γραφέα; | δεύτερος γραφέας |
 * | Ε3 | ο σαρωτής ΒΛΕΠΕΙ γραφή (αυτοέλεγχος — αλλιώς το Ε2 είναι πράσινο από τύφλωση) | σαρωτής που δεν πιάνει τίποτα |
 *
 * ⚠️ **Δηλωμένο όριο**: άγκυρα jest, **όχι** πύλη pre-commit. Πιάνει τα κυριολεκτικά (`documentFacts:` ·
 * `[DOCUMENT_FACTS_FIELD]`)· ένα κλειδί χτισμένο σε μεταβλητή μένει αόρατο (ίδιο όριο με την 3.17).
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { DOCUMENT_FACTS_FIELD } from '@/lib/document-validity/document-facts';
import { codeSourcesMentioning, REPO_ROOT as ROOT, writeKeyPattern, writesKeyIn } from '@/test-utils/one-writer-anchor';

const WRITER = 'src/server/files/document-facts-writer.ts';
const { rulesKeyListOf } = require('../../../../scripts/_shared/firestore-rules-parser.js') as {
  rulesKeyListOf: (rulesText: string, functionName: string) => string[];
};

// ADR-916 Φ-Δ.4 — ο σαρωτής έγινε κοινός (`test-utils/one-writer-anchor`): δεύτερη άγκυρα ενός γραφέα (`handoverDecision`).
const FACTS_KEY = writeKeyPattern(DOCUMENT_FACTS_FIELD, 'DOCUMENT_FACTS_FIELD');
const writesDocumentFacts = (source: string): boolean => writesKeyIn(source, FACTS_KEY);
const candidateSources = (): string[] => codeSourcesMentioning([DOCUMENT_FACTS_FIELD, 'DOCUMENT_FACTS_FIELD']);

describe('Ε — ο ΕΝΑΣ γραφέας των γεγονότων εγγράφου', () => {
  it('Ε1 — ο κανόνας παγώνει ΑΚΡΙΒΩΣ το πεδίο του κώδικα', () => {
    const rules = readFileSync(join(ROOT, 'firestore.rules'), 'utf8');
    expect(rulesKeyListOf(rules, 'documentFactsKeys')).toEqual([DOCUMENT_FACTS_FIELD]);
  });

  it('Ε2 — κανένας δεύτερος γραφέας στο src/', () => {
    const candidates = candidateSources();
    expect(candidates).toContain(WRITER);
    const offenders = candidates
      .filter((file) => file !== WRITER)
      .filter((file) => writesDocumentFacts(readFileSync(join(ROOT, file), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('Ε3 — ο σαρωτής ΒΛΕΠΕΙ γραφή: ο ίδιος ο γραφέας πιάνεται, όπως και τα συνήθη σχήματα', () => {
    expect(writesDocumentFacts(readFileSync(join(ROOT, WRITER), 'utf8'))).toBe(true);
    expect(writesDocumentFacts("await ref.update({ documentFacts: { kind: 'energy-certificate' } });")).toBe(true);
    expect(writesDocumentFacts('tx.set(ref, { ...rest, documentFacts: facts }, { merge: true });')).toBe(true);
    expect(writesDocumentFacts('await updateDoc(ref, { [DOCUMENT_FACTS_FIELD]: facts });')).toBe(true);
    // Ανάγνωση και φορτίο που ΔΕΝ είναι γραφή:
    expect(writesDocumentFacts('const facts = readDocumentFacts(data.documentFacts);')).toBe(false);
    expect(writesDocumentFacts('return { fileId, documentFacts: readDocumentFacts(data.documentFacts) };')).toBe(false);
  });
});
