/**
 * @jest-environment node
 *
 * @fileoverview **ΤΟ ΟΡΓΑΝΟ ΜΕΤΡΙΕΤΑΙ ΚΙ ΑΥΤΟ** — το συμβόλαιο του `update()` του πλαστού.
 * @related services/places/__tests__/fake-firestore.ts · ADR-827 §9.13
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΓΚΥΡΑ ΓΙΑ ΤΟ **ΨΕΥΤΙΚΟ** FIRESTORE
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο `FakeFirestore` **δεν** είναι κώδικας παραγωγής — είναι **όργανο μέτρησης**, και
 * ένα χαλασμένο όργανο δεν βγάζει κόκκινο: βγάζει **πράσινο για λάθος λόγο**. Το
 * αρχείο του το ομολογεί ήδη τρεις φορές (*«ΕΛΕΙΠΕ, ΚΑΙ Η ΑΠΟΥΣΙΑ ΤΟΥ…»* για τα
 * `delete`, `getAll`, και τη σύγκριση συμβολοσειρών), κάθε φορά **αφού** είχε
 * παραπλανήσει μια σουίτα.
 *
 * 🔑 **ΤΟ ΜΕΤΡΗΜΕΝΟ ΓΕΓΟΝΟΣ ΠΟΥ ΤΟ ΓΕΝΝΗΣΕ (2026-08-29)**: στη μεταλλαξιογένεση του
 * Β0, η μετάλλαξη *«ο πλαστός δημιουργεί σιωπηλά αντί να πετάξει `NOT_FOUND`»* βγήκε
 * **ΠΡΑΣΙΝΗ** σε 13 άγκυρες. Δηλαδή το συμβόλαιο ήταν γραμμένο στην τεκμηρίωση και
 * **καμία** άγκυρα δεν μπορούσε να το πυροδοτήσει — *σχόλιο που μοιάζει με έλεγχο*
 * (μάθημα Μ3). Ο κανόνας εφαρμόστηκε **στον εαυτό του**: ή αποκτά άγκυρα, ή η
 * υπόσχεση φεύγει.
 *
 * ⚠️ **Γιατί δεν αρκούσε άγκυρα μέσω καταναλωτή**: ο γραφέας της ικανότητας ρωτά
 * `get()` **πριν** και επιστρέφει `absent`, άρα **δεν φτάνει ποτέ** σε `update`
 * ανύπαρκτου εγγράφου. Το συμβόλαιο δεν φυλάει *αυτόν* τον καταναλωτή — φυλάει τον
 * **επόμενο**, που θα γράψει `update` χωρίς προηγούμενη ανάγνωση και οφείλει να
 * κοκκινίσει εδώ αντί να ανακαλύψει το `NOT_FOUND` στην παραγωγή.
 */

import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';

const COLLECTION = 'companies';
const ID = 'comp_a';

function seeded(): FakeFirestore {
  const fake = new FakeFirestore();
  fake.seed(COLLECTION, ID, {
    name: 'ΠΑΓΩΝΗΣ Ι.Κ.Ε.',
    settings: { locale: 'el', theme: 'dark' },
    capabilities: { brokerage_listings: { status: 'active', revocationReason: null } },
  });
  return fake;
}

async function read(fake: FakeFirestore): Promise<Record<string, unknown>> {
  const snap = await fake.collection(COLLECTION).doc(ID).get();
  return snap.data() as Record<string, unknown>;
}

describe('Φ — το συμβόλαιο του `update()` του πλαστού Firestore', () => {
  it('🔑 Φ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: απλό πεδίο γράφεται', async () => {
    const fake = seeded();
    await fake.collection(COLLECTION).doc(ID).update({ name: 'ΝΕΟ ΟΝΟΜΑ' });
    expect((await read(fake)).name).toBe('ΝΕΟ ΟΝΟΜΑ');
  });

  it('🔴 Φ1 — ΤΟ ΚΛΕΙΔΙ ΜΕ ΤΕΛΕΙΑ ΕΙΝΑΙ ΜΟΝΟΠΑΤΙ, ΟΧΙ ΟΝΟΜΑ ΠΕΔΙΟΥ', async () => {
    const fake = seeded();

    await fake.collection(COLLECTION).doc(ID).update({ 'settings.theme': 'light' });

    const doc = await read(fake);
    // Ένας πλαστός με `Object.assign` θα έφτιαχνε κλειδί `"settings.theme"` — και
    // κάθε ανάγνωση της παραγωγής θα έβρισκε `undefined`.
    expect(doc['settings.theme']).toBeUndefined();
    expect((doc.settings as Record<string, unknown>).theme).toBe('light');
  });

  it('🔴 Φ2 — ΤΑ ΑΔΕΛΦΙΑ ΤΟΥ ΜΟΝΟΠΑΤΙΟΥ ΕΠΙΒΙΩΝΟΥΝ', async () => {
    const fake = seeded();

    await fake.collection(COLLECTION).doc(ID).update({ 'settings.theme': 'light' });

    const settings = (await read(fake)).settings as Record<string, unknown>;
    expect(settings.locale).toBe('el');
    // Και τα αδέλφια **του γονέα**: ένα ολικό `set` εδώ θα έσβηνε το `capabilities`.
    expect((await read(fake)).capabilities).toBeDefined();
  });

  it('🔑 Φ3 — ΑΝΥΠΑΡΚΤΟ ΕΓΓΡΑΦΟ ΠΕΤΑ `NOT_FOUND` — ΔΕΝ ΤΟ ΔΗΜΙΟΥΡΓΕΙ', async () => {
    const fake = seeded();

    // 🔴 Η άγκυρα που έλειπε. Το Admin SDK **πετά**· ένας πλαστός που δημιουργούσε
    //    σιωπηλά θα άφηνε κάθε «δεν υπάρχει ⇒ absent» κλάδο **αδοκίμαστο**, και τον
    //    επόμενο γραφέα να ανακαλύψει τη διαφορά στην παραγωγή.
    await expect(
      fake.collection(COLLECTION).doc('comp_pote_den_yprxe').update({ name: 'X' }),
    ).rejects.toThrow('NOT_FOUND');

    expect((await fake.collection(COLLECTION).doc('comp_pote_den_yprxe').get()).exists).toBe(false);
  });

  it('🔴 Φ4 — ΤΟ ΣΤΙΓΜΙΟΤΥΠΟ ΠΟΥ ΔΙΑΒΑΣΤΗΚΕ ΠΡΙΝ ΔΕΝ ΑΛΛΑΖΕΙ ΑΝΑΔΡΟΜΙΚΑ', async () => {
    const fake = seeded();
    const before = await read(fake);

    await fake.collection(COLLECTION).doc(ID).update({ name: 'ΝΕΟ ΟΝΟΜΑ' });

    // Επιτόπια μετάλλαξη θα άλλαζε **και** το `before` ⇒ μια άγκυρα «η τιμή ήταν Χ
    // πριν και Ψ μετά» θα ήταν πράσινη για κατάσταση που δεν υπήρξε ποτέ.
    expect(before.name).toBe('ΠΑΓΩΝΗΣ Ι.Κ.Ε.');
  });

  it('Φ5 — η γραφή ΜΕΤΡΙΕΤΑΙ: οι άγκυρες μπορούν να ρωτήσουν «πόσες πράξεις;»', async () => {
    const fake = seeded();
    const before = fake.writes;

    await fake.collection(COLLECTION).doc(ID).update({ name: 'ΝΕΟ' });

    expect(fake.writes).toBe(before + 1);
  });
});
