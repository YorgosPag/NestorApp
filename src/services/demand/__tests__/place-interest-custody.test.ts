/**
 * =============================================================================
 * ΘΕΜΑΤΟΦΥΛΑΚΗ ΣΤΟΝ ΕΝΤΟΠΙΣΜΟ ΤΟΥ ΑΚΙΝΗΤΟΥ — ADR-777 §8.42
 * =============================================================================
 *
 * 🔴 **Η ΤΡΙΤΗ ΕΜΦΑΝΙΣΗ ΤΟΥ ΙΔΙΟΥ ΕΛΑΤΤΩΜΑΤΟΣ.** Το §8.39 ένωσε το «ποιος
 * διαχειρίζεται;» σε ένα SSoT (`listing-custody.ts`) — και το
 * `place-interest.service.ts` εξακολουθούσε να το απαντά μόνο του, με κριτήριο
 * **κατά χρήστη** (`authorUserId !== uid`) πάνω σε πόρο που μπορεί να ζει σε
 * **εταιρικό** χώρο. Το `readCompanyProperty` δεν κάλυπτε το κενό: διαβάζει
 * **άλλη συλλογή** (`PROPERTIES`), οπότε αγγελία ιδιώτη σε εταιρική
 * θεματοφυλακή ήταν `absent` για **κάθε** άλλον υπάλληλο του γραφείου.
 *
 * ⚠️ **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΕΙΝΑΙ ΤΟ Θ1**: χωρίς αυτό, το Θ2 θα μπορούσε να είναι
 * πράσινο επειδή η συνάρτηση δέχεται **τα πάντα**. Ο ιδιωτικός χώρος οφείλει να
 * παραμείνει **ταυτόσημος** με πριν — η θεραπεία ΠΡΟΣΘΕΤΕΙ χώρο, δεν διευρύνει.
 */

import { lookupOwnedPlace } from '@/services/demand/place-interest.service';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

const OWNER = 'user_owner';
const COLLEAGUE = 'user_colleague';
const OFFICE = 'comp_office';
const OTHER_OFFICE = 'comp_rival';

/** Ελάχιστο ακίνητο — μόνο όσα διαβάζει η προβολή, με τα δύο πεδία χώρου ρητά. */
const listing = (authorUserId: string, authorCompanyId: string | null) => ({
  id: 'ownp_1',
  authorUserId,
  authorCompanyId,
  type: 'apartment',
  title: 'Δοκιμαστικό',
  areaSqm: 80,
  bedrooms: 2,
  floor: 1,
  layout: null,
  areas: null,
  offers: null,
  mandate: { kind: 'owner' },
  place: { kind: 'declined' },
});

/** Firestore που απαντά ΜΟΝΟ για τη συλλογή των ακινήτων ιδιώτη. */
const fakeDb = (data: Record<string, unknown> | undefined): AdminFirestore =>
  ({
    collection: (name: string) => ({
      doc: () => ({
        get: async () => ({
          data: () => (name === 'owner_properties' ? data : undefined),
        }),
      }),
    }),
  }) as unknown as AdminFirestore;

describe('Θ — ο εντοπισμός ρωτά τη ΘΕΜΑΤΟΦΥΛΑΚΗ, όχι τον συγγραφέα', () => {
  it('Θ1 — ΠΑΡΟΝΟΜΑΣΤΗΣ: ιδιωτικός χώρος, ξένος χρήστης ⇒ absent (αμετάβλητο)', async () => {
    const db = fakeDb(listing(OWNER, null));
    const out = await lookupOwnedPlace(db, 'ownp_1', COLLEAGUE, OFFICE);
    expect(out.kind).toBe('absent');
  });

  it('Θ2 — ιδιωτικός χώρος, ο κάτοχος ⇒ found (αμετάβλητο)', async () => {
    const db = fakeDb(listing(OWNER, null));
    const out = await lookupOwnedPlace(db, 'ownp_1', OWNER, OFFICE);
    expect(out.kind).toBe('found');
  });

  // 🔴 Η ΘΕΡΑΠΕΙΑ: πριν το §8.42 αυτό ήταν `absent` — το γραφείο δεν έβλεπε τη
  // δική του αγγελία επειδή την είχε καταχωρίσει άλλος υπάλληλος.
  it('Θ3 — ΕΤΑΙΡΙΚΟΣ χώρος, συνάδελφος ΙΔΙΑΣ εταιρείας ⇒ found', async () => {
    const db = fakeDb(listing(OWNER, OFFICE));
    const out = await lookupOwnedPlace(db, 'ownp_1', COLLEAGUE, OFFICE);
    expect(out.kind).toBe('found');
  });

  it('Θ4 — ΕΤΑΙΡΙΚΟΣ χώρος, ΑΛΛΗ εταιρεία ⇒ absent', async () => {
    const db = fakeDb(listing(OWNER, OFFICE));
    const out = await lookupOwnedPlace(db, 'ownp_1', COLLEAGUE, OTHER_OFFICE);
    expect(out.kind).toBe('absent');
  });

  // ⚠️ Η ΠΑΓΙΔΑ ΠΟΥ ΟΝΟΜΑΖΕΙ ΤΟ `tenant-ownership.ts`: δύο κενές τιμές «ταιριάζουν»
  // σε αφελή `===`. Το `mayAdminister` απαιτεί `hasTenant` ΚΑΙ στις δύο πλευρές,
  // άρα εδώ η ωμή σύγκριση θα έλεγε ΝΑΙ και η πύλη λέει ΟΧΙ.
  it('Θ5 — κενό companyId ΔΕΝ είναι tenant: κενό ⇄ κενό ⇒ absent', async () => {
    const db = fakeDb(listing(OWNER, ''));
    const out = await lookupOwnedPlace(db, 'ownp_1', COLLEAGUE, '');
    expect(out.kind).toBe('absent');
  });

  it('Θ6 — ανύπαρκτο έγγραφο ⇒ absent', async () => {
    const out = await lookupOwnedPlace(fakeDb(undefined), 'ownp_1', OWNER, OFFICE);
    expect(out.kind).toBe('absent');
  });
});
