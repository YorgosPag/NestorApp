/**
 * @jest-environment node
 *
 * @fileoverview **ΤΟ ΟΡΓΑΝΟ ΜΕΤΡΙΕΤΑΙ ΚΙ ΑΥΤΟ** — το συμβόλαιο του Firestore πάνω στο `FakeFirestore`, και οι
 * **όργανα** που έχει μόνο το fake (μετρητής, ημερολόγιο, βλάβη, ανταγωνιστής).
 *
 * Το ίδιο `describeFirestoreContract` τρέχει στον emulator (`tests/firestore-contract/`): εκεί αποδεικνύεται ότι ό,τι
 * ισχυρίζεται **εδώ** το fake ισχύει και στο αληθινό. Ό,τι ακολουθεί το `describeFirestoreContract` **δεν** έχει
 * αντίστοιχο στο αληθινό — είναι εργαλεία μέτρησης, και ένα χαλασμένο όργανο βγάζει **πράσινο για λάθος λόγο**
 * (ADR-827 §9.13: η μετάλλαξη «δημιουργεί σιωπηλά αντί για `NOT_FOUND`» βγήκε πράσινη σε 13 άγκυρες).
 *
 * @see adrs/ADR-742 §7sexdecies
 */

import { FakeFirestore } from '../fake-firestore';
import { describeFirestoreContract } from '../contract/firestore-contract';
import type { ContractDb } from '../contract/firestore-contract-kit';

let fake = new FakeFirestore();

describeFirestoreContract({
  name: 'fake',
  db: () => fake as unknown as ContractDb,
  reset: async () => {
    fake = new FakeFirestore();
  },
});

describe('όργανα του fake (χωρίς αντίστοιχο στο αληθινό)', () => {
  beforeEach(() => {
    fake = new FakeFirestore();
    fake.seed('c', 'a', { name: 'ΠΑΛΙΟ', n: 1 });
  });

  it('🔴 Ι1 — το στιγμιότυπο που διαβάστηκε πριν ΔΕΝ αλλάζει αναδρομικά', async () => {
    const before = (await fake.collection('c').doc('a').get()).data();
    await fake.collection('c').doc('a').update({ name: 'ΝΕΟ' });
    expect(before?.name).toBe('ΠΑΛΙΟ');
  });

  it('Ι2 — κάθε εγγραφή μετριέται και καταγράφεται με σειρά· η σπορά όχι', async () => {
    await fake.collection('c').doc('b').create({ v: 1 });
    await fake.collection('c').doc('a').update({ n: 2 });
    await fake.collection('c').doc('b').delete();
    expect(fake.writes).toBe(3);
    expect(fake.writeLog().map((entry) => `${entry.kind}:${entry.docId}`)).toEqual(['set:b', 'update:a', 'delete:b']);
    fake.clearWriteLog();
    expect([fake.writeLog().length, fake.writes]).toEqual([0, 3]);
  });

  it('Ι3 — η δέσμη μετράει κάθε πράξη + ένα βήμα για το commit', async () => {
    const batch = fake.batch();
    batch.set(fake.collection('c').doc('x'), { v: 1 });
    batch.update(fake.collection('c').doc('a'), { n: 5 });
    await batch.commit();
    expect(fake.writes).toBe(3);
  });

  it('🔴 Ι4 — `failReads`: έγγραφο, ερώτημα, `getAll` ΚΑΙ υποσυλλογή πετούν — ο διακόπτης πιάνει και μετά τη δημιουργία αναφοράς', async () => {
    const ref = fake.collection('c').doc('a');
    fake.failReads = true;
    await expect(ref.get()).rejects.toThrow('FAKE_FIRESTORE_UNAVAILABLE');
    await expect(fake.collection('c').where('n', '==', 1).get()).rejects.toThrow('FAKE_FIRESTORE_UNAVAILABLE');
    await expect(fake.getAll(ref)).rejects.toThrow('FAKE_FIRESTORE_UNAVAILABLE');
    await expect(ref.collection('sub').get()).rejects.toThrow('FAKE_FIRESTORE_UNAVAILABLE');
  });

  it('🔴 Ι5 — ο ανταγωνιστής ανάμεσα σε ανάγνωση και commit ⇒ το σώμα ΞΑΝΑΤΡΕΧΕΙ με τη φρέσκια τιμή', async () => {
    fake.interfere = () => fake.write('c', 'a', { name: 'ΣΥΝΑΔΕΛΦΟΣ', n: 10 });
    const seen: unknown[] = [];
    await fake.runTransaction(async (tx) => {
      const snapshot = await tx.get(fake.collection('c').doc('a'));
      seen.push(snapshot.get('n'));
      tx.update(fake.collection('c').doc('a'), { n: Number(snapshot.get('n')) + 1 });
    });
    expect(seen).toEqual([1, 10]);
    expect(fake.getData('c', 'a')?.n).toBe(11);
  });

  it('Ι6 — διαρκής ανταγωνισμός ⇒ ABORTED (10), καμία εγγραφή', async () => {
    const work = fake.runTransaction(async (tx) => {
      const snapshot = await tx.get(fake.collection('c').doc('a'));
      fake.write('c', 'a', { name: 'ΠΑΛΙΟ', n: Number(snapshot.get('n')) + 100 });
      tx.update(fake.collection('c').doc('a'), { name: 'ΠΟΤΕ' });
    });
    await expect(work).rejects.toMatchObject({ code: 10 });
    expect(fake.getData('c', 'a')?.name).toBe('ΠΑΛΙΟ');
  });

  it('Ι7 — `seedCollection` αντικαθιστά τη συλλογή με ΑΝΤΙΓΡΑΦΑ· `reset` αδειάζει δεδομένα, μετρητή, ημερολόγιο, διακόπτες', async () => {
    const source = { v: 1 };
    fake.seedCollection('c', { z: source });
    source.v = 2;
    expect(fake.getAllDocs('c')).toEqual({ z: { v: 1 } });
    await fake.collection('c').doc('z').delete();
    fake.failReads = true;
    fake.interfere = () => undefined;
    fake.reset();
    expect([fake.writes, fake.writeLog().length, fake.failReads, fake.interfere, fake.all('c').length]).toEqual([0, 0, false, null, 0]);
  });
});
