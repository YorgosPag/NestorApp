/**
 * ADR-834 §8 — ΑΓΚΥΡΕΣ του **ΕΝΟΣ κριτή ταυτότητας**.
 *
 * 🔴 **ΤΟ ΕΛΑΤΤΩΜΑ**: ο κριτής ρωτούσε **ΑΦΜ + email** και **δεν ρωτούσε ΟΝΟΜΑ** — ενώ
 * το άρθρο 200 §2 Ν.4072/2012 απαιτεί η σύμβαση να **ονομάζει** τον εντολέα. Ζωντανή
 * απόδειξη: `contacts/cont_da84f8c4-…` με `firstName: ""`, `lastName: ""` — **ανώνυμη
 * καρτέλα** στο βιβλίο του γραφείου, με ΑΦΜ και email δίπλα της.
 *
 *   Κ-0  🔑 **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ** — πλήρες προφίλ ⇒ ταυτότητα (αλλιώς τα Κ-1…Κ-6 θα
 *        μπορούσαν να είναι πράσινα επειδή ο κριτής αρνείται **τα πάντα**)
 *   Κ-1  🔴 χωρίς **όνομα** ⇒ άρνηση *(το κενό που έκλεισε)*
 *   Κ-2  🔴 χωρίς **επώνυμο** ⇒ άρνηση *(«και τα δύο», απόφαση Giorgio 30/08)*
 *   Κ-3  χωρίς email ⇒ άρνηση · Κ-4 άκυρο ΑΦΜ ⇒ άρνηση · Κ-5 κανένα έγγραφο ⇒ άρνηση
 *   Κ-6  ⛔ **ΚΑΜΙΑ ΕΦΕΔΡΕΙΑ `displayName`** — σκεπάζει το περιστατικό της 24/08
 *   Α-1  🔴 **ΒΛΑΒΗ ≠ ΕΛΛΕΙΨΗ** (N.12): αναγνωστικό σφάλμα ⇒ `unavailable`
 *   Α-2  ο αναγνώστης δεν κρίνει μόνος του — δίνει ό,τι λέει ο κριτής
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import {
  ownerIdentityOf,
  readOwnerIdentity,
} from '@/services/mandate/mandate-owner-identity';
import type { UserProfileDocument } from '@/auth/types/auth.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ο FakeFirestore μιμείται το Admin SDK· η μετάφραση γίνεται ΜΙΑ φορά, εδώ.
const asAdmin = (fake: FakeFirestore) => fake as unknown as Parameters<typeof readOwnerIdentity>[0];

const UID = 'user-idiotis';

/** Ένα προφίλ όπου **όλα** είναι εντάξει — κάθε δοκιμή χαλάει ΕΝΑ πεδίο. */
function profile(overrides: Partial<UserProfileDocument> = {}): UserProfileDocument {
  return {
    uid: UID,
    givenName: 'Γεώργιος',
    familyName: 'Παγώνης',
    email: 'idiotis@example.com',
    // ⚠️ Έγκυρο κατά **mod-11** — ο κριτής το επαληθεύει πραγματικά. Ένας αυθαίρετος
    //    εννιαψήφιος θα έκανε τον παρονομαστή ψεύτικο.
    vatNumber: '094259216',
    ...overrides,
  } as UserProfileDocument;
}

// ============================================================================
describe('Κ — ο κριτής της ταυτότητας', () => {
  it('Κ-0 🔑 ΠΑΡΟΝΟΜΑΣΤΗΣ: πλήρες προφίλ ⇒ ταυτότητα, ακέραιη', () => {
    expect(ownerIdentityOf(profile())).toEqual({
      givenName: 'Γεώργιος',
      familyName: 'Παγώνης',
      email: 'idiotis@example.com',
      vatNumber: '094259216',
    });
  });

  it('Κ-1 🔴 ΧΩΡΙΣ ΟΝΟΜΑ ⇒ καμία ταυτότητα (το κενό της ζωντανής βάσης)', () => {
    expect(ownerIdentityOf(profile({ givenName: null }))).toBeNull();
    expect(ownerIdentityOf(profile({ givenName: '   ' }))).toBeNull();
  });

  it('Κ-2 🔴 ΧΩΡΙΣ ΕΠΩΝΥΜΟ ⇒ καμία ταυτότητα («και τα δύο», όχι «κάποιο»)', () => {
    expect(ownerIdentityOf(profile({ familyName: null }))).toBeNull();
    expect(ownerIdentityOf(profile({ familyName: '' }))).toBeNull();
  });

  it('Κ-3 χωρίς email ⇒ καμία ταυτότητα (η επαφή δεν έχει πού να σταλεί)', () => {
    expect(ownerIdentityOf(profile({ email: '' }))).toBeNull();
  });

  it('Κ-4 ΑΚΥΡΟ ΑΦΜ ⇒ καμία ταυτότητα — ο mod-11 ΕΚΤΕΛΕΙΤΑΙ, δεν εισάγεται μόνο', () => {
    // 094259216 με χαλασμένο **ψηφίο ελέγχου**: εννιαψήφιο, σωστής μορφής, άκυρο.
    expect(ownerIdentityOf(profile({ vatNumber: '094259217' }))).toBeNull();
    expect(ownerIdentityOf(profile({ vatNumber: '' }))).toBeNull();
    expect(ownerIdentityOf(profile({ vatNumber: '12345' }))).toBeNull();
  });

  it('Κ-5 κανένα έγγραφο ⇒ καμία ταυτότητα, ποτέ εξαίρεση', () => {
    expect(ownerIdentityOf(undefined)).toBeNull();
  });

  it('Κ-6 ⛔ ΚΑΜΙΑ ΕΦΕΔΡΕΙΑ `displayName` — σκεπάζει την απώλεια δεδομένων της 24/08', () => {
    // 🔴 Ακριβώς το ζωντανό έγγραφο `users/WKBWEg3D…`: το `displayName` **υπάρχει**,
    //    τα δύο πεδία είναι `null`. Ο πειρασμός να διαβαστεί εκείνο είναι προφανής —
    //    και θα ταυτοποιούσε συμβαλλόμενο από **παραγόμενο κείμενο οθόνης**.
    const googleUser = profile({
      givenName: null,
      familyName: null,
      displayName: 'Georgios Pagonis',
    });
    expect(ownerIdentityOf(googleUser)).toBeNull();
  });
});

// ============================================================================
describe('Α — ο αναγνώστης', () => {
  it('Α-2 πλήρες έγγραφο ⇒ `complete`· ανώνυμο ⇒ `incomplete`', async () => {
    const fake = new FakeFirestore();
    fake.seed(COLLECTIONS.USERS, UID, profile());
    await expect(readOwnerIdentity(asAdmin(fake), UID)).resolves.toEqual({
      kind: 'complete',
      identity: {
        givenName: 'Γεώργιος',
        familyName: 'Παγώνης',
        email: 'idiotis@example.com',
        vatNumber: '094259216',
      },
    });

    const anonymous = new FakeFirestore();
    anonymous.seed(COLLECTIONS.USERS, UID, profile({ givenName: null, familyName: null }));
    await expect(readOwnerIdentity(asAdmin(anonymous), UID)).resolves.toEqual({
      kind: 'incomplete',
    });
  });

  it('Α-1 🔴 ΒΛΑΒΗ ≠ ΕΛΛΕΙΨΗ: αναγνωστικό σφάλμα δίνει `unavailable`', async () => {
    // Ένα `incomplete` εδώ θα έστελνε τον άνθρωπο να διορθώσει προφίλ που είναι
    // **ήδη σωστό** — και θα το έκανε κάθε φορά που τρεμοπαίζει το δίκτυο (N.12).
    const fake = new FakeFirestore();
    fake.seed(COLLECTIONS.USERS, UID, profile());
    fake.failReads = true;

    await expect(readOwnerIdentity(asAdmin(fake), UID)).resolves.toEqual({
      kind: 'unavailable',
    });
  });
});
