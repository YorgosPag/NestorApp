/**
 * @fileoverview Ισχυρισμοί συμβολαίου — **εγγραφές** (`create` · `set` · `update` · `delete` · δέσμη · συναλλαγή · `getAll`).
 *
 * @module test-utils/fake-firestore/contract/firestore-contract-writes
 */

import { contractValues, type ContractCase, type ContractDb } from './firestore-contract-kit';

const { FieldValue } = contractValues;

async function dataOf(db: ContractDb, path: string, id: string): Promise<Record<string, unknown> | undefined> {
  return (await db.collection(path).doc(id).get()).data();
}

/** Ο κωδικός gRPC της απόρριψης (6 = ALREADY_EXISTS, 5 = NOT_FOUND) — αυτό ρωτά ο κώδικας, όχι το μήνυμα. */
async function rejectionCode(work: () => Promise<unknown>): Promise<unknown> {
  try {
    await work();
  } catch (error) {
    return (error as { code?: unknown }).code;
  }
  return 'resolved';
}

export const contractCasesWrites: readonly ContractCase[] = [
  {
    id: 'W1',
    title: '`create` σε υπάρχον ⇒ ALREADY_EXISTS (6), το έγγραφο μένει ως ήταν',
    async run(db) {
      await db.collection('w1').doc('a').set({ v: 1 });
      expect(await rejectionCode(() => db.collection('w1').doc('a').create({ v: 2 }))).toBe(6);
      expect(await dataOf(db, 'w1', 'a')).toEqual({ v: 1 });
    },
  },
  {
    id: 'W2',
    title: '`update` σε ανύπαρκτο ⇒ NOT_FOUND (5), και ΔΕΝ το δημιουργεί',
    async run(db) {
      expect(await rejectionCode(() => db.collection('w2').doc('a').update({ v: 1 }))).toBe(5);
      expect((await db.collection('w2').doc('a').get()).exists).toBe(false);
    },
  },
  {
    id: 'W3',
    title: '`update` με διαδρομή: γράφει εμφωλευμένα, κρατά τα αδέλφια, `delete()` σβήνει, `increment()` προσθέτει',
    async run(db) {
      await db.collection('w3').doc('a').set({ caps: { x: 1, y: 2 }, drop: true, n: 5 });
      await db.collection('w3').doc('a').update({ 'caps.x': 9, drop: FieldValue.delete(), n: FieldValue.increment(2) });
      expect(await dataOf(db, 'w3', 'a')).toEqual({ caps: { x: 9, y: 2 }, n: 7 });
    },
  },
  {
    id: 'W4',
    title: '`set` χωρίς merge ΑΝΤΙΚΑΘΙΣΤΑ· με merge κρατά τα άλλα πεδία και εφαρμόζει `increment()`',
    async run(db) {
      await db.collection('w4').doc('a').set({ keep: 1, n: 1 });
      await db.collection('w4').doc('a').set({ n: FieldValue.increment(1) }, { merge: true });
      expect(await dataOf(db, 'w4', 'a')).toEqual({ keep: 1, n: 2 });
      await db.collection('w4').doc('a').set({ only: true });
      expect(await dataOf(db, 'w4', 'a')).toEqual({ only: true });
    },
  },
  {
    id: 'W5',
    title: '`set` με merge σε εμφωλευμένο αντικείμενο: ΣΥΓΧΩΝΕΥΕΙ και το εσωτερικό',
    async run(db) {
      await db.collection('w5').doc('a').set({ profile: { name: 'Α', role: 'x' } });
      await db.collection('w5').doc('a').set({ profile: { role: 'y' } }, { merge: true });
      expect(await dataOf(db, 'w5', 'a')).toEqual({ profile: { name: 'Α', role: 'y' } });
    },
  },
  {
    id: 'W12',
    title: '`set` με merge: `FieldValue.delete()` σβήνει το πεδίο, και μέσα σε εμφωλευμένο αντικείμενο',
    async run(db) {
      await db.collection('w12').doc('a').set({ gone: 1, keep: 2, inner: { gone: 3, keep: 4 } });
      await db.collection('w12').doc('a').set({ gone: FieldValue.delete(), inner: { gone: FieldValue.delete() } }, { merge: true });
      expect(await dataOf(db, 'w12', 'a')).toEqual({ keep: 2, inner: { keep: 4 } });
    },
  },
  {
    id: 'W6',
    title: '`delete` ανύπαρκτου είναι αθόρυβα επιτυχές· στιγμιότυπο ανύπαρκτου: `exists` false, `data()` undefined',
    async run(db) {
      await db.collection('w6').doc('ghost').delete();
      const snapshot = await db.collection('w6').doc('ghost').get();
      expect([snapshot.id, snapshot.exists, snapshot.data()]).toEqual(['ghost', false, undefined]);
    },
  },
  {
    id: 'W7',
    title: 'δέσμη: ΟΛΑ ή ΤΙΠΟΤΑ — `create` σε υπάρχον ακυρώνει και τις υπόλοιπες εγγραφές',
    async run(db) {
      await db.collection('w7').doc('taken').set({ v: 1 });
      const batch = db.batch();
      batch.set(db.collection('w7').doc('fresh'), { v: 2 });
      batch.create(db.collection('w7').doc('taken'), { v: 3 });
      expect(await rejectionCode(() => batch.commit())).toBe(6);
      expect((await db.collection('w7').doc('fresh').get()).exists).toBe(false);
    },
  },
  {
    id: 'W8',
    title: 'δέσμη χωρίς `commit` δεν γράφει τίποτα· με `commit` εφαρμόζει με τη σειρά κλήσης',
    async run(db) {
      const ref = db.collection('w8').doc('a');
      db.batch().set(ref, { v: 1 });
      expect((await ref.get()).exists).toBe(false);
      const batch = db.batch();
      batch.set(ref, { v: 1 });
      batch.delete(ref);
      batch.set(ref, { v: 3 });
      await batch.commit();
      expect(await dataOf(db, 'w8', 'a')).toEqual({ v: 3 });
    },
  },
  {
    id: 'W9',
    title: 'συναλλαγή: `create` σε υπάρχον απορρίπτει το `runTransaction` και ΚΑΜΙΑ εγγραφή δεν μένει',
    async run(db) {
      await db.collection('w9').doc('taken').set({ v: 1 });
      const work = () => db.runTransaction(async (tx) => {
        await tx.get(db.collection('w9').doc('taken'));
        tx.create(db.collection('w9').doc('taken'), { v: 2 });
        return 'ok';
      });
      expect(await rejectionCode(work)).toBe(6);
      expect(await dataOf(db, 'w9', 'taken')).toEqual({ v: 1 });
    },
  },
  {
    id: 'W10',
    title: 'συναλλαγή: οι εγγραφές εφαρμόζονται στο commit και επιστρέφεται το αποτέλεσμα του σώματος',
    async run(db) {
      await db.collection('w10').doc('c').set({ n: 1 });
      const result = await db.runTransaction(async (tx) => {
        const snapshot = await tx.get(db.collection('w10').doc('c'));
        tx.update(db.collection('w10').doc('c'), { n: Number(snapshot.get('n')) + 1 });
        return 'done';
      });
      expect([result, await dataOf(db, 'w10', 'c')]).toEqual(['done', { n: 2 }]);
    },
  },
  {
    id: 'W11',
    title: '`getAll`: σειρά ένα-προς-ένα με τις αναφορές, και για τα ανύπαρκτα',
    async run(db) {
      await db.collection('w11').doc('b').set({ v: 1 });
      const snapshots = await db.getAll(db.collection('w11').doc('x'), db.collection('w11').doc('b'));
      expect(snapshots.map((snapshot) => [snapshot.id, snapshot.exists])).toEqual([['x', false], ['b', true]]);
    },
  },
];
