/**
 * @jest-environment node
 *
 * =============================================================================
 * ⚖️ ΑΓΚΥΡΑ — Ο ΕΝΑΣ ΓΡΑΦΕΑΣ της απόφασης παράδοσης ανά αρχείο (ADR-916 §5.18 Φ-Δ.4 · Ζ33)
 * =============================================================================
 *
 * Οι κανόνες (`handoverDecisionUnchanged`) κλείνουν τον **πελάτη**. Δεν βλέπουν το **Admin SDK**: ένας δεύτερος γραφέας στον
 * διακομιστή θα έστελνε εμπιστευτικό αρχείο χωρίς επιβεβαίωση, αιτιολογία ή ίχνος, και θα παρέκαμπτε το «ό,τι παραδόθηκε μένει».
 *
 * | #  | ερώτημα | μετάλλαξη που πιάνει |
 * |---|---|---|
 * | Η1 | η λίστα του κανόνα = το ΕΝΑ όνομα πεδίου του κώδικα; | μετονομασία στη μία πλευρά μόνο |
 * | Η2 | γράφει κανείς `handoverDecision` σε `.update/.set/updateDoc/setDoc` εκτός του γραφέα; | δεύτερος γραφέας |
 * | Η3 | ο σαρωτής ΒΛΕΠΕΙ γραφή (αυτοέλεγχος — αλλιώς το Η2 είναι πράσινο από τύφλωση) | σαρωτής που δεν πιάνει τίποτα |
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { FILE_HANDOVER_DECISION_FIELD } from '@/lib/property-handover/file-handover-decision';
import { codeSourcesMentioning, REPO_ROOT, writeKeyPattern, writesKeyIn } from '@/test-utils/one-writer-anchor';

const WRITER = 'src/services/property-handover/property-handover-file-decision.service.ts';
const KEY = writeKeyPattern(FILE_HANDOVER_DECISION_FIELD, 'FILE_HANDOVER_DECISION_FIELD');
const { rulesKeyListOf } = require('../../../../scripts/_shared/firestore-rules-parser.js') as {
  rulesKeyListOf: (rulesText: string, functionName: string) => string[];
};

describe('Η — ο ΕΝΑΣ γραφέας της απόφασης παράδοσης', () => {
  it('Η1 — ο κανόνας παγώνει ΑΚΡΙΒΩΣ το πεδίο του κώδικα', () => {
    const rules = readFileSync(join(REPO_ROOT, 'firestore.rules'), 'utf8');
    expect(rulesKeyListOf(rules, 'handoverDecisionKeys')).toEqual([FILE_HANDOVER_DECISION_FIELD]);
  });

  it('Η2 — κανένας δεύτερος γραφέας στο src/', () => {
    const candidates = codeSourcesMentioning([FILE_HANDOVER_DECISION_FIELD, 'FILE_HANDOVER_DECISION_FIELD']);
    expect(candidates).toContain(WRITER);
    const offenders = candidates
      .filter((file) => file !== WRITER)
      .filter((file) => writesKeyIn(readFileSync(join(REPO_ROOT, file), 'utf8'), KEY));
    expect(offenders).toEqual([]);
  });

  it('Η3 — ο σαρωτής ΒΛΕΠΕΙ γραφή: ο ίδιος ο γραφέας πιάνεται, όπως και τα συνήθη σχήματα', () => {
    expect(writesKeyIn(readFileSync(join(REPO_ROOT, WRITER), 'utf8'), KEY)).toBe(true);
    expect(writesKeyIn("await ref.update({ handoverDecision: { disposition: 'deliver' } });", KEY)).toBe(true);
    expect(writesKeyIn('tx.set(ref, { ...rest, handoverDecision: decision }, { merge: true });', KEY)).toBe(true);
    expect(writesKeyIn('await updateDoc(ref, { [FILE_HANDOVER_DECISION_FIELD]: decision });', KEY)).toBe(true);
    // Ανάγνωση και φορτίο που ΔΕΝ είναι γραφή:
    expect(writesKeyIn('const decision = readFileHandoverDecision(stored.handoverDecision);', KEY)).toBe(false);
    expect(writesKeyIn('return { ...label, handoverDecision: decision ?? undefined };', KEY)).toBe(false);
  });
});
