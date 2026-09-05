/**
 * @fileoverview **Η ΥΙΟΘΕΤΗΣΗ ΣΥΝΕΔΡΙΑΣ ΤΡΕΧΕΙ** — και η αποτυχία της ΔΕΝ πετά ποτέ.
 * @related auth/citizen-session.ts · ADR-844 Β4
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ΤΟ ΣΚΕΛΟΣ ΤΗΣ ΑΠΟΤΥΧΙΑΣ ΕΙΝΑΙ Ο ΛΟΓΟΣ ΠΟΥ ΓΡΑΦΤΗΚΕ ΤΟ ΑΡΧΕΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κώδικας που **καλεί** αυτή τη συνάρτηση έχει μόλις ανακοινώσει στον άνθρωπο
 * *«το μήνυμά σας έφυγε»* — και **έχει δίκιο**: η πράξη γράφτηκε στον διακομιστή πριν
 * εκδοθεί το εφήμερο κλειδί. Αν το `signInWithCustomToken` **πετούσε**, η εξαίρεση θα
 * ανέβαινε σε `useEffect` και θα έριχνε **λευκή σελίδα πάνω σε επιτυχία**.
 *
 * ⚠️ Και είναι **η κανονικότητα εδώ, όχι η εξαίρεση**: ο άνθρωπος έρχεται από email —
 * μίνι-φυλλομετρητής του Gmail, κλειδωμένο storage, ληγμένο κλειδί.
 */

const signInWithCustomToken = jest.fn();

jest.mock('firebase/auth', () => ({
  signInWithCustomToken: (...args: unknown[]) => signInWithCustomToken(...args),
}));

// ⚠️ **Ο πλαστός του `@/lib/firebase` είναι ΑΝΑΓΚΑΙΟΣ, όχι ευκολία**: το πραγματικό
//    module τρέχει `initializeApp` **στο import** και στήνει IndexedDB/emulator probes.
//    Η άγκυρα ρωτά *«τι κάνει η συνάρτησή μας;»*, όχι *«σηκώνεται το Firebase;»*.
jest.mock('@/lib/firebase', () => ({ auth: { __brand: 'fake-auth' } }));

import { adoptCitizenSession } from '@/auth/citizen-session';

describe('Κ — ο πολίτης παίρνει συνεδρία', () => {
  beforeEach(() => {
    signInWithCustomToken.mockReset();
  });

  it('🔑 Κ1 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: επιτυχία ⇒ `signed-in` με το uid', async () => {
    signInWithCustomToken.mockResolvedValue({ user: { uid: 'uid_maria' } });

    await expect(adoptCitizenSession('token_abc')).resolves.toEqual({
      kind: 'signed-in',
      uid: 'uid_maria',
    });
  });

  it('🔑 Κ2 — το κλειδί φτάνει ΑΥΤΟΥΣΙΟ στο SDK, μαζί με το ΕΝΑ `auth`', async () => {
    // ⚠️ Χωρίς αυτό, μια υλοποίηση που στέλνει `token.trim()` ή δικό της `getAuth()` θα
    //    περνούσε κάθε άλλο σκέλος — και θα έσπαγε **μόνο** στην παραγωγή.
    signInWithCustomToken.mockResolvedValue({ user: { uid: 'uid_maria' } });

    await adoptCitizenSession('  token_abc  ');

    expect(signInWithCustomToken).toHaveBeenCalledWith(
      { __brand: 'fake-auth' },
      '  token_abc  ',
    );
  });

  it('🔴 Κ3 — ΑΠΟΤΥΧΙΑ ⇒ `not-signed-in`, ΠΟΤΕ εξαίρεση', async () => {
    // 🔴 **Το σκέλος που δικαιολογεί το αρχείο.** Ένα `throw` εδώ θα ανέβαινε σε
    //    `useEffect` και θα έριχνε ΛΕΥΚΗ ΣΕΛΙΔΑ πάνω σε πράξη που **πέτυχε**.
    signInWithCustomToken.mockRejectedValue(new Error('auth/invalid-custom-token'));

    await expect(adoptCitizenSession('token_dead')).resolves.toEqual({ kind: 'not-signed-in' });
  });

  it('🔴 Κ4 — ούτε όταν το SDK πετά κάτι που ΔΕΝ είναι Error', async () => {
    // ⚠️ Οι φυλλομετρητές πετούν και σκέτες συμβολοσειρές· ένα `cause.message` χωρίς
    //    φρουρό θα έσκαγε **μέσα στο catch** — δηλαδή στο ίδιο το δίχτυ ασφαλείας.
    signInWithCustomToken.mockRejectedValue('storage is blocked');

    await expect(adoptCitizenSession('token_dead')).resolves.toEqual({ kind: 'not-signed-in' });
  });
});
