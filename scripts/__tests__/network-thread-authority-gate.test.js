/**
 * @fileoverview Άγκυρες του CHECK 3.89 — η πύλη της αρχής του νήματος (ADR-867 Β4).
 *
 * Κάθε κριτήριο δοκιμάζεται ΚΑΙ στο «πυροδοτεί» ΚΑΙ στο «σιωπά» — πύλη που δεν μπορεί να
 * κοκκινίσει είναι σχόλιο (ADR-587 §6.1, CHECK 3.54). Και ο παρονομαστής μετριέται στο
 * ΠΡΑΓΜΑΤΙΚΟ δέντρο: «0 δεύτεροι γραφείς» σημαίνει κάτι μόνο αν ο σαρωτής είδε τον ΠΡΩΤΟ.
 */

'use strict';

const gate = require('../check-network-thread-authority');

function findingsOf(code, rel = 'src/services/rogue.ts') {
  return gate.findingsIn(gate.sourceFileOf(rel, code), rel).map((f) => f.state);
}

describe('Κ1 — το μονοπάτι του νήματος χτίζεται ΜΟΝΟ στο ref', () => {
  it('⛔ χειρόγραφο μονοπάτι ακροατηρίου εκτός ref', () => {
    const code = "db.collection(COLLECTIONS.NETWORK_THREADS).doc(t).collection(SUBCOLLECTIONS.NETWORK_THREAD_AUDIENCE).get();";
    expect(findingsOf(code)).toEqual([
      gate.STATES.PATH_OUTSIDE_REF,
      gate.STATES.PATH_OUTSIDE_REF,
    ]);
  });

  it('✅ το ίδιο μονοπάτι μέσα στο ref', () => {
    expect(findingsOf('x.collection(SUBCOLLECTIONS.NETWORK_THREAD_MESSAGES);', gate.REF_FILE)).toEqual([]);
  });

  it('✅ και μέσα στο αρχείο που ΟΡΙΖΕΙ τα ονόματα', () => {
    expect(findingsOf('export const X = COLLECTIONS.NETWORK_THREADS;', 'src/config/firestore-collections.ts')).toEqual([]);
  });

  it('✅ ένα ΣΧΟΛΙΟ που ονομάζει το μονοπάτι δεν είναι κώδικας (AST, όχι κείμενο)', () => {
    expect(findingsOf('// COLLECTIONS.NETWORK_THREADS ζει στο ref\nconst x = 1;')).toEqual([]);
  });
});

describe('Κ2 — δηλωμένοι καταναλωτές', () => {
  it('⛔ αδήλωτος καταναλωτής του μονοπατιού', () => {
    expect(findingsOf('networkThreadRef(db, threadId).get();')).toEqual([gate.STATES.UNDECLARED_CONSUMER]);
  });

  it('✅ δηλωμένος καταναλωτής', () => {
    expect(findingsOf('networkThreadMessages(db, threadId).get();', gate.MESSAGE_WRITER))
      .toEqual([gate.STATES.CONSUMER]);
  });

  it('🔓 εξαίρεση ΜΟΝΟ με λόγο', () => {
    expect(findingsOf('// network-thread-authority-exempt: εργαλείο εξαγωγής GDPR\nnetworkThreadRef(db, t).get();'))
      .toEqual([gate.STATES.EXEMPT]);
    expect(findingsOf('// network-thread-authority-exempt:\nnetworkThreadRef(db, t).get();'))
      .toEqual([gate.STATES.EXEMPT_NO_REASON]);
  });
});

describe('Κ3 — ΑΚΡΟΑΤΗΡΙΟ: ένας γραφέας', () => {
  it('⛔ δεύτερος γραφέας με άμεση αλυσίδα', () => {
    expect(findingsOf("networkAudienceRef(db, t, uid).set({ until: null });", gate.MESSAGE_WRITER))
      .toEqual(expect.arrayContaining([gate.STATES.SECOND_AUDIENCE_WRITER]));
  });

  it('⛔ δεύτερος γραφέας μέσω ΜΕΤΑΒΛΗΤΗΣ — η μορφή που γράφει πραγματικά ο κόσμος', () => {
    const code = 'const seat = networkAudienceRef(db, t, uid);\ntransaction.set(seat, entry);';
    expect(findingsOf(code, gate.MESSAGE_WRITER))
      .toEqual(expect.arrayContaining([gate.STATES.SECOND_AUDIENCE_WRITER]));
  });

  it('⛔ δεύτερος γραφέας μέσω ΠΕΔΙΟΥ `audienceRef` — το ψευδώνυμο που ταξιδεύει σε άλλη συνάρτηση', () => {
    expect(findingsOf('transaction.set(slot.audienceRef.doc(uid), entry);'))
      .toEqual([gate.STATES.SECOND_AUDIENCE_WRITER]);
  });

  it('✅ ο ΕΝΑΣ γραφέας γράφει', () => {
    const code = 'const seat = networkAudienceRef(db, t, uid);\ntransaction.set(seat, entry);';
    expect(findingsOf(code, gate.AUDIENCE_WRITER)).toEqual([gate.STATES.CONSUMER]);
  });

  it('✅ ΑΝΑΓΝΩΣΗ ακροατηρίου από δηλωμένο καταναλωτή δεν είναι γραφή', () => {
    expect(findingsOf('await networkAudienceRef(db, t, uid).get();', gate.MESSAGE_WRITER))
      .toEqual([gate.STATES.CONSUMER]);
  });
});

describe('Κ4 — ΜΗΝΥΜΑΤΑ: ένας γραφέας', () => {
  it('⛔ γραφή μηνύματος εκτός του γραφέα μηνυμάτων', () => {
    expect(findingsOf("networkThreadMessages(db, t).doc(id).set(message);", gate.AUDIENCE_WRITER))
      .toEqual(expect.arrayContaining([gate.STATES.SECOND_MESSAGE_WRITER]));
  });

  it('✅ ο γραφέας μηνυμάτων γράφει', () => {
    expect(findingsOf("networkThreadMessages(db, t).doc(id).set(message);", gate.MESSAGE_WRITER))
      .toEqual([gate.STATES.CONSUMER]);
  });
});

describe('Κ5 + Κ6 + παρονομαστής — στο ΠΡΑΓΜΑΤΙΚΟ δέντρο', () => {
  const result = gate.measure();

  it('ο σαρωτής ΕΙΔΕ το ref και τους δηλωμένους καταναλωτές', () => {
    expect(result.tally[gate.STATES.REF]).toBeGreaterThan(0);
    expect(result.tally[gate.STATES.CONSUMER]).toBeGreaterThan(0);
  });

  it('κανένα μπλοκάρον εύρημα σήμερα', () => {
    expect(result.findings.filter((f) => gate.BLOCKING.includes(f.state))).toEqual([]);
  });

  it('🔑 ΚΑΘΕ γραφέας ομάδας ρωτά την προβολή ακροατηρίου (Κ6)', () => {
    expect(gate.wiringFindings(require('path').resolve(__dirname, '..', '..'))).toEqual([]);
    expect(gate.PROJECTION_CONSUMERS.length).toBeGreaterThan(1);
  });
});
