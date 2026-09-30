/**
 * @fileoverview Ισχυρισμοί συμβολαίου — **ερωτήματα** (`where` · `orderBy` · δρομέας · `count` · `collectionGroup`).
 *
 * @module test-utils/fake-firestore/contract/firestore-contract-queries
 */

import { contractValues, idsOf, seedDocs, type ContractCase } from './firestore-contract-kit';

const { Timestamp } = contractValues;

export const contractCasesQueries: readonly ContractCase[] = [
  {
    id: 'Q1',
    title: '`orderBy` ΕΞΑΙΡΕΙ έγγραφα χωρίς το πεδίο (ADR-890 §17)',
    async run(db) {
      await seedDocs(db, 'q1', { a: { at: 2 }, b: {}, c: { at: 1 } });
      expect(await idsOf(db.collection('q1').orderBy('at'))).toEqual(['c', 'a']);
    },
  },
  {
    id: 'Q2',
    title: 'ισοπαλία `orderBy` λύνεται κατά id, με την ίδια φορά',
    async run(db) {
      await seedDocs(db, 'q2', { m: { k: 1 }, a: { k: 1 }, z: { k: 0 } });
      expect(await idsOf(db.collection('q2').orderBy('k'))).toEqual(['z', 'a', 'm']);
      expect(await idsOf(db.collection('q2').orderBy('k', 'desc'))).toEqual(['m', 'a', 'z']);
    },
  },
  {
    id: 'Q3',
    title: 'ανισότητα: ανόμοιοι τύποι ΔΕΝ συγκρίνονται (το `"5"` δεν είναι `<= 10`)',
    async run(db) {
      await seedDocs(db, 'q3', { n: { v: 5 }, s: { v: '5' }, big: { v: 50 } });
      expect(await idsOf(db.collection('q3').where('v', '<=', 10))).toEqual(['n']);
    },
  },
  {
    id: 'Q4',
    title: 'εύρος σε ISO κείμενο και σε `Timestamp` — χρονολογικά',
    async run(db) {
      await seedDocs(db, 'q4', {
        old: { iso: '2026-01-01T00:00:00.000Z', ts: Timestamp.fromMillis(1_000) },
        new: { iso: '2026-06-01T00:00:00.000Z', ts: Timestamp.fromMillis(9_000) },
      });
      expect(await idsOf(db.collection('q4').where('iso', '<', '2026-03-01T00:00:00.000Z'))).toEqual(['old']);
      expect(await idsOf(db.collection('q4').where('ts', '>=', Timestamp.fromMillis(5_000)))).toEqual(['new']);
    },
  },
  {
    id: 'Q5',
    title: '`!=` εξαιρεί έγγραφα χωρίς το πεδίο',
    async run(db) {
      await seedDocs(db, 'q5', { a: { s: 'x' }, b: { s: 'y' }, c: {} });
      expect(await idsOf(db.collection('q5').where('s', '!=', 'x'))).toEqual(['b']);
    },
  },
  {
    id: 'Q6',
    title: '`in` και `array-contains`',
    async run(db) {
      await seedDocs(db, 'q6', { a: { s: 'x', tags: ['p'] }, b: { s: 'y', tags: ['q'] }, c: { s: 'z' } });
      expect(await idsOf(db.collection('q6').where('s', 'in', ['x', 'z']))).toEqual(['a', 'c']);
      expect(await idsOf(db.collection('q6').where('tags', 'array-contains', 'q'))).toEqual(['b']);
    },
  },
  {
    id: 'Q7',
    title: 'σελιδοποίηση `limit` + `startAfter` δεν χάνει έγγραφα με ίδια τιμή στο όριο',
    async run(db) {
      await seedDocs(db, 'q7', { a: { k: 1 }, b: { k: 1 }, c: { k: 1 }, d: { k: 2 } });
      const first = await db.collection('q7').orderBy('k').limit(2).get();
      const last = first.docs[first.docs.length - 1];
      if (last === undefined) throw new Error('empty first page');
      expect(first.docs.map((doc) => doc.id)).toEqual(['a', 'b']);
      expect(await idsOf(db.collection('q7').orderBy('k').startAfter(last).limit(2))).toEqual(['c', 'd']);
    },
  },
  {
    id: 'Q8',
    title: '`count()` μετρά ό,τι θα επέστρεφε το ερώτημα, με το `limit` του',
    async run(db) {
      await seedDocs(db, 'q8', { a: { on: true }, b: { on: true }, c: { on: false } });
      expect((await db.collection('q8').where('on', '==', true).count().get()).data().count).toBe(2);
      expect((await db.collection('q8').limit(1).count().get()).data().count).toBe(1);
    },
  },
  {
    id: 'Q9',
    title: 'υποσυλλογή: ίδιο όνομα κάτω από άλλον γονέα είναι ΑΛΛΗ συλλογή· `collectionGroup` τις βλέπει όλες',
    async run(db) {
      await db.collection('q9').doc('p1').collection('items').doc('x').set({ n: 1 });
      await db.collection('q9').doc('p2').collection('items').doc('y').set({ n: 2 });
      expect(await idsOf(db.collection('q9').doc('p1').collection('items'))).toEqual(['x']);
      expect(await idsOf(db.collectionGroup('items').orderBy('n'))).toEqual(['x', 'y']);
    },
  },
  {
    id: 'Q10',
    title: 'αποτέλεσμα ερωτήματος: `size`, `empty`, `id` και `get(διαδρομή)` σε κάθε έγγραφο',
    async run(db) {
      await seedDocs(db, 'q10', { a: { nested: { v: 7 } } });
      const hit = await db.collection('q10').get();
      const miss = await db.collection('q10').where('nested.v', '==', 0).get();
      expect([hit.size, hit.empty, miss.size, miss.empty]).toEqual([1, false, 0, true]);
      expect([hit.docs[0]?.id, hit.docs[0]?.get('nested.v')]).toEqual(['a', 7]);
    },
  },
  {
    id: 'Q11',
    title: 'χωρίς `orderBy` η σειρά είναι κατά id εγγράφου — όχι σειρά εισαγωγής',
    async run(db) {
      await seedDocs(db, 'q11', { z: { n: 1 }, a: { n: 2 }, m: { n: 3 } });
      expect(await idsOf(db.collection('q11'))).toEqual(['a', 'm', 'z']);
    },
  },
];
