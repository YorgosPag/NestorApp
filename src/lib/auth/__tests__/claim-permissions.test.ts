/**
 * =============================================================================
 * ΑΓΚΥΡΕΣ ΤΟΥ ΕΝΟΣ ΑΝΑΓΝΩΣΤΗ (ADR-801 §2.8)
 * =============================================================================
 *
 * Φυλάει τον κανόνα *«τι ικανότητες κουβαλά αυτό το token;»* — τον κανόνα που
 * μέχρι τη Φάση 3γ υπήρχε **τρεις φορές, διαφορετικός**.
 *
 * ⚠️ **Κ0 = ο παρονομαστής**: χωρίς αυτόν, ένα τυπογραφικό στο `VALID` θα έκανε
 * **κάθε** άγκυρα να περνά μέσω του κλάδου «άκυρο ⇒ πεταμένο» — όλες πράσινες,
 * καμία να μην κοιτά (πρότυπο `Κ0` του `authority.test.ts`).
 */

import { readPermissionsClaim } from '../claim-permissions';
import { PERMISSIONS, isValidPermission, type PermissionId } from '../types';

/** Ικανότητα που **όντως** υπάρχει στο μητρώο. */
const VALID: PermissionId = 'admin_access';
/** Δεύτερη, ώστε να ελέγχεται σειρά και πλήθος. */
const VALID_2: PermissionId = 'projects:projects:view';

describe('ADR-801 §2.8 — readPermissionsClaim', () => {
  // ---------------------------------------------------------------------------
  describe('Κ0 — ο παρονομαστής', () => {
    it('Κ0.1 — οι δοκιμαζόμενες ικανότητες ΥΠΑΡΧΟΥΝ στο μητρώο', () => {
      expect(Object.hasOwn(PERMISSIONS, VALID)).toBe(true);
      expect(Object.hasOwn(PERMISSIONS, VALID_2)).toBe(true);
    });

    it('Κ0.2 — οι «άκυρες» τιμές ΟΝΤΩΣ δεν είναι ικανότητες', () => {
      expect(isValidPermission('dfx:view')).toBe(false);
      expect(isValidPermission('')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Κ1 — απουσία ≠ κενό', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
      ['συμβολοσειρά', 'admin_access'],
      ['αριθμός', 7],
      ['αντικείμενο', { admin_access: true }],
    ])('Κ1 — μη-πίνακας (%s) ⇒ undefined, ΟΧΙ []', (_label, raw) => {
      expect(readPermissionsClaim(raw)).toBeUndefined();
    });

    it('Κ1β — άδειος πίνακας ⇒ [] («το φέρει, και είναι άδειο»)', () => {
      expect(readPermissionsClaim([])).toEqual([]);
    });

    it('Κ1γ — πίνακας με μόνο σκουπίδια ⇒ [], ΟΧΙ undefined', () => {
      // Το κανάλι **υπάρχει** στο token· απλώς δεν έχει τίποτα χρήσιμο.
      // Η διάκριση δεν είναι αισθητική: `undefined` θα σήμαινε «δεν μου το
      // έστειλαν», που είναι άλλη διάγνωση.
      expect(readPermissionsClaim(['nope', 42, null])).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Κ2 — επικύρωση', () => {
    it('Κ2.1 — κρατά μόνο γνωστές ικανότητες', () => {
      expect(readPermissionsClaim([VALID, 'dfx:view', VALID_2])).toEqual([VALID, VALID_2]);
    });

    it('Κ2.2 — πετά μη-συμβολοσειρές χωρίς να σκάει', () => {
      expect(readPermissionsClaim([VALID, 42, null, undefined, {}, []])).toEqual([VALID]);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Κ3 — ΤΡΥΠΑ PROTOTYPE (§2.9)', () => {
    it.each(['toString', 'constructor', 'valueOf', 'hasOwnProperty', '__proto__'])(
      'Κ3 — `%s` ΔΕΝ γίνεται δεκτή ως ικανότητα',
      (poison) => {
        // 🔴 Πριν το §2.9 το `isValidPermission` έκανε `permission in PERMISSIONS`,
        //    και το `in` βλέπει ΟΛΟ το prototype ⇒ αυτές περνούσαν.
        expect(readPermissionsClaim([poison])).toEqual([]);
      },
    );

    it('Κ3β — και ο ίδιος ο επικυρωτής, ρητά', () => {
      expect(isValidPermission('toString')).toBe(false);
      expect(isValidPermission('constructor')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Κ4 — κανονικοποίηση', () => {
    it('Κ4.1 — διπλότυπα συγχωνεύονται', () => {
      expect(readPermissionsClaim([VALID, VALID, VALID_2, VALID])).toEqual([VALID, VALID_2]);
    });

    it('Κ4.2 — η σειρά εμφάνισης διατηρείται', () => {
      expect(readPermissionsClaim([VALID_2, VALID])).toEqual([VALID_2, VALID]);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Κ5 — το αποτέλεσμα είναι παγωμένο', () => {
    it('Κ5 — κανείς καταναλωτής δεν μπορεί να «συμπληρώσει» τη λίστα', () => {
      const result = readPermissionsClaim([VALID]);
      expect(Object.isFrozen(result)).toBe(true);
      // Ο μεταβλητός πίνακας θα καλούσε τον επόμενο να κάνει `push` — δηλαδή να
      // γεννήσει τέταρτο κανόνα, ακριβώς ό,τι έκλεισε αυτή η φάση.
      expect(() => (result as PermissionId[]).push(VALID_2)).toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  describe('Κ6 — το πραγματικό claim της παραγωγής', () => {
    it('Κ6 — `["admin_access"]` (και τα 2 ζωντανά έγγραφα) διαβάζεται ακέραιο', () => {
      expect(readPermissionsClaim(['admin_access'])).toEqual(['admin_access']);
    });
  });
});
