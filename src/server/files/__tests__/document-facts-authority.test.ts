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

import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

import { DOCUMENT_FACTS_FIELD } from '@/lib/document-validity/document-facts';

const ROOT = join(__dirname, '..', '..', '..', '..');
const WRITER = 'src/server/files/document-facts-writer.ts';
const { rulesKeyListOf } = require('../../../../scripts/_shared/firestore-rules-parser.js') as {
  rulesKeyListOf: (rulesText: string, functionName: string) => string[];
};

/** Κλήσεις γραφής Firestore και το κοντινό τους φορτίο. */
const WRITE_CALL = /\b(?:update|set|create|updateDoc|setDoc)\s*\(/g;
const FACTS_KEY = new RegExp(String.raw`(?:\b${DOCUMENT_FACTS_FIELD}\s*:|\[\s*DOCUMENT_FACTS_FIELD\s*\]\s*:)`);
const WINDOW = 400;

/** Γράφει αυτό το κείμενο το πεδίο μέσα σε όρισμα κλήσης γραφής; */
function writesDocumentFacts(source: string): boolean {
  for (const match of source.matchAll(WRITE_CALL)) {
    const start = (match.index ?? 0) + match[0].length;
    if (FACTS_KEY.test(source.slice(start, start + WINDOW))) return true;
  }
  return false;
}

/** Μόνο τα αρχεία που **αναφέρουν** το πεδίο — `git grep` (tracked + untracked), όχι ανάγνωση 19.000 αρχείων. */
function candidateSources(): string[] {
  const out = execFileSync(
    'git',
    ['grep', '-l', '--untracked', '-e', DOCUMENT_FACTS_FIELD, '-e', 'DOCUMENT_FACTS_FIELD', '--', 'src'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  return out.split('\n').filter((file) => /\.tsx?$/.test(file) && !/__tests__|\.test\.|\.spec\./.test(file));
}

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
