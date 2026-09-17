/**
 * @fileoverview Άγκυρες του CHECK 3.88 — η πύλη της αρχής της ομάδας έργου (ADR-862 Φ0 Β14).
 *
 * Κάθε κριτήριο δοκιμάζεται ΚΑΙ στο «πυροδοτεί» ΚΑΙ στο «σιωπά» — πύλη που δεν μπορεί να
 * κοκκινίσει είναι σχόλιο (ADR-587 §6.1). Και ο παρονομαστής μετριέται στο ΠΡΑΓΜΑΤΙΚΟ δέντρο:
 * «0 δεύτερες γεννήσεις» σημαίνει κάτι μόνο αν ο σαρωτής είδε την ΠΡΩΤΗ.
 */

'use strict';

const gate = require('../check-project-member-authority');

function findingsOf(code, rel = 'src/services/rogue.ts') {
  return gate.findingsIn(gate.sourceFileOf(rel, code), rel).map((f) => f.state);
}

describe('Κ1 — το μονοπάτι μελών χτίζεται ΜΟΝΟ στο ref', () => {
  it('⛔ χειρόγραφο μονοπάτι μελών εκτός ref', () => {
    const code = "db.collection(COLLECTIONS.COMPANIES).doc(c).collection(SUBCOLLECTIONS.COMPANY_PROJECTS).doc(p).collection(SUBCOLLECTIONS.PROJECT_MEMBERS).get();";
    expect(findingsOf(code)).toEqual([gate.STATES.PATH_OUTSIDE_REF]);
  });

  it('✅ το ίδιο μονοπάτι μέσα στο ref', () => {
    expect(findingsOf('x.collection(SUBCOLLECTIONS.PROJECT_MEMBERS);', gate.REF_FILE)).toEqual([]);
  });

  it('✅ ένα ΣΧΟΛΙΟ που ονομάζει το μονοπάτι δεν είναι κώδικας (AST, όχι κείμενο)', () => {
    expect(findingsOf('// SUBCOLLECTIONS.PROJECT_MEMBERS ζει στο ref\nconst x = 1;')).toEqual([]);
  });
});

describe('Κ2 — δηλωμένοι καταναλωτές, και οι αναγνώστες δεν γράφουν', () => {
  it('⛔ αδήλωτος καταναλωτής του μονοπατιού', () => {
    expect(findingsOf('projectMembersCollection(db, c, p).get();')).toEqual([gate.STATES.UNDECLARED_CONSUMER]);
  });

  it('⛔ δηλωμένος αναγνώστης που ΓΡΑΦΕΙ μέλος', () => {
    const reader = Object.keys(gate.READERS)[0];
    expect(findingsOf("projectMembersCollection(db, c, p).doc('mbr_x').set({ uid });", reader))
      .toEqual(expect.arrayContaining([gate.STATES.READER, gate.STATES.READER_WRITES]));
  });

  it('✅ ο γραφέας γράφει, ο αναγνώστης διαβάζει', () => {
    expect(findingsOf("projectMembersCollection(db, c, p).doc('mbr_x').set({ uid });", gate.WRITER))
      .toEqual([gate.STATES.WRITER]);
    expect(findingsOf('projectMembersCollection(db, c, p).get();', Object.keys(gate.READERS)[0]))
      .toEqual([gate.STATES.READER]);
  });

  it('🔓 εξαίρεση ΜΟΝΟ με λόγο', () => {
    expect(findingsOf('// project-member-authority-exempt: εργαλείο εξαγωγής GDPR\nprojectMembersCollection(db, c, p).get();'))
      .toEqual([gate.STATES.EXEMPT]);
    expect(findingsOf('// project-member-authority-exempt:\nprojectMembersCollection(db, c, p).get();'))
      .toEqual([gate.STATES.EXEMPT_NO_REASON]);
  });
});

describe('Κ3 — νέο έργο ΜΟΝΟ από τη γέννηση', () => {
  it('⛔ σκέτο `.set()` σε `projects` — η βλάβη που γέννησε το Β14', () => {
    expect(findingsOf('await db.collection(COLLECTIONS.PROJECTS).doc(id).set({ name });'))
      .toEqual([gate.STATES.SECOND_BIRTH]);
  });

  it('⛔ `batch.set(ref, data)` με αλυσίδα ως όρισμα', () => {
    expect(findingsOf('batch.set(db.collection(COLLECTIONS.PROJECTS).doc(id), data);'))
      .toEqual([gate.STATES.SECOND_BIRTH]);
  });

  it('⛔ `tx.create(ref, data)` μέσω μεταβλητής', () => {
    const code = 'const projectRef = db.collection(COLLECTIONS.PROJECTS).doc(id);\ntx.create(projectRef, data);';
    expect(findingsOf(code)).toEqual([gate.STATES.SECOND_BIRTH]);
  });

  it('⛔ `setDoc(doc(db, COLLECTIONS.PROJECTS, id), data)` του client SDK', () => {
    expect(findingsOf('await setDoc(doc(db, COLLECTIONS.PROJECTS, id), data);'))
      .toEqual([gate.STATES.SECOND_BIRTH]);
  });

  it('✅ ενημέρωση υπάρχοντος έργου ΔΕΝ είναι γέννηση (`update` · `set` με `merge`)', () => {
    expect(findingsOf('await db.collection(COLLECTIONS.PROJECTS).doc(id).update({ name });')).toEqual([]);
    expect(findingsOf('await db.collection(COLLECTIONS.PROJECTS).doc(id).set({ name }, { merge: true });')).toEqual([]);
    expect(findingsOf('const projectRef = db.collection(COLLECTIONS.PROJECTS).doc(id);\ntx.update(projectRef, data);')).toEqual([]);
  });

  it('✅ η ΜΙΑ γέννηση', () => {
    const code = 'const projectRef = db.collection(COLLECTIONS.PROJECTS).doc(id);\ntransaction.create(projectRef, document);';
    expect(findingsOf(code, gate.BIRTH)).toEqual([gate.STATES.BIRTH]);
  });
});

describe('Κ4 + παρονομαστής — στο ΠΡΑΓΜΑΤΙΚΟ δέντρο', () => {
  const result = gate.measure();

  it('ο σαρωτής ΕΙΔΕ τον γραφέα, τους αναγνώστες και τη γέννηση', () => {
    expect(result.tally[gate.STATES.WRITER]).toBeGreaterThan(0);
    expect(result.tally[gate.STATES.READER]).toBe(Object.keys(gate.READERS).length);
    expect(result.tally[gate.STATES.BIRTH]).toBe(1);
  });

  it('κανένα μπλοκάρον εύρημα σήμερα', () => {
    expect(result.findings.filter((f) => gate.BLOCKING.includes(f.state))).toEqual([]);
  });

  it('η πολιτική στελέχωσης έχει και τους δύο καταναλωτές', () => {
    expect(gate.wiringFindings(require('path').resolve(__dirname, '..', '..'))).toEqual([]);
  });
});
