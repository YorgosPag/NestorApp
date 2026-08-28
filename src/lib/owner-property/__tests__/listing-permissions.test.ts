/**
 * @fileoverview **Ο ΠΙΝΑΚΑΣ ΑΛΗΘΕΙΑΣ ΤΩΝ ΔΙΚΑΙΩΜΑΤΩΝ** (ADR-827 §5 Φάση Α).
 * @related lib/owner-property/listing-permissions.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΑΚΡΙΒΩΣ ΦΥΛΑΕΙ ΑΥΤΗ Η ΑΓΚΥΡΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η αλλαγή του ADR-827 είναι **μία γραμμή σημασίας**: ο άνθρωπος που έγραψε την
 * αγγελία **δεν χάνει τα δικαιώματά του** όταν αυτή περάσει στον χώρο ενός γραφείου.
 * Πριν, το `mayAdminister` τού έλεγε «όχι» — σωστά, γιατί απαντούσε **άλλη** ερώτηση.
 *
 * Άρα φυλάγονται **δύο** πράγματα, και το δεύτερο είναι εξίσου κρίσιμο:
 *
 * 1. ✅ ότι ο συγγραφέας **κρατά** (Κ1) — η νέα συμπεριφορά
 * 2. ⛔ ότι το `mayAdminister` **ΔΕΝ άλλαξε** (Κ8) — αλλιώς η διεύρυνση θα διέρρεε
 *    στους **επτά** άλλους καλούντες του, ανάμεσά τους το `place-interest.service`
 *
 * ⚠️ Η εξουσιοδότηση έχει **ασύμμετρα** σφάλματα: το «αρνήθηκε σε κάποιον που έπρεπε»
 * το βλέπει ο άνθρωπος και παραπονιέται· το «**επέτρεψε σε κάποιον που δεν έπρεπε**»
 * δεν το βλέπει κανείς. Γι' αυτό ο πίνακας απαριθμεί **και τις αρνήσεις**.
 */

import {
  LISTING_ACTIONS,
  mayPerform,
  permissionsOn,
  type ListingAction,
} from '../listing-permissions';
import { custodyOf, mayAdminister, type ListingActor } from '../listing-custody';

const ANNA = 'user-anna';
const BORIS = 'user-boris';
const CARL = 'user-carl';
const AGENCY = 'company-agency';
const RIVAL = 'company-rival';

/** Η αγγελία της Άννας, πριν καλέσει γραφείο. */
const PERSONAL = { authorUserId: ANNA, authorCompanyId: null } as const;
/** 🔑 Η ΙΔΙΑ αγγελία, **μετά** την ανάθεση: ίδιος συγγραφέας, χώρος γραφείου. */
const ASSIGNED = { authorUserId: ANNA, authorCompanyId: AGENCY } as const;
/** Αγγελία που το γραφείο κατέγραψε εξαρχής για τρίτον. */
const AGENCY_OWN = { authorUserId: BORIS, authorCompanyId: AGENCY } as const;

const actor = (uid: string, companyId: string | null): ListingActor => ({ uid, companyId });

const granted = (p: Readonly<Record<ListingAction, boolean>>): ListingAction[] =>
  LISTING_ACTIONS.filter((a) => p[a]);

// =============================================================================
describe('🔑 Π — ο ΠΑΡΟΝΟΜΑΣΤΗΣ', () => {
  it('Π0 — ο πίνακας περιέχει ΚΑΙ ΤΙΣ ΔΥΟ ετυμηγορίες', () => {
    // Χωρίς αυτό, ένας πίνακας με μόνο `true` θα ήταν πράσινος πάνω σε συνάρτηση που
    // δεν αρνείται ποτέ — δηλαδή πάνω στο μοναδικό σφάλμα που δεν βλέπει κανείς.
    const verdicts = new Set([
      mayPerform(PERSONAL, actor(ANNA, null), 'editContent'),
      mayPerform(PERSONAL, actor(CARL, null), 'editContent'),
    ]);
    expect(verdicts).toEqual(new Set([true, false]));
  });

  it('Π1 — ΚΑΘΕ πράξη του κλειστού συνόλου απαντιέται, καμία `undefined`', () => {
    const p = permissionsOn(ASSIGNED, actor(ANNA, null));
    for (const action of LISTING_ACTIONS) {
      expect(typeof p[action]).toBe('boolean');
    }
    expect(LISTING_ACTIONS.length).toBeGreaterThan(0);
  });
});

// =============================================================================
describe('🔴 Κ1 — Η ΚΑΡΔΙΑ ΤΟΥ ADR-827: ο συγγραφέας ΔΕΝ χάνει την αγγελία του', () => {
  it('η Άννα κρατά ΟΛΑ τα δικαιώματα του ιδιοκτήτη μετά την ανάθεση', () => {
    const before = permissionsOn(PERSONAL, actor(ANNA, null));
    const after = permissionsOn(ASSIGNED, actor(ANNA, null));

    // 🔑 Η ανάθεση **δεν αφαιρεί τίποτα**. Ό,τι μπορούσε, μπορεί.
    for (const action of LISTING_ACTIONS) {
      if (before[action]) expect(after[action]).toBe(true);
    }
  });

  it('και συγκεκριμένα: τιμή, περιεχόμενο, απόσυρση, ανάκληση εντολής (ADR-827 Α3)', () => {
    const p = permissionsOn(ASSIGNED, actor(ANNA, null));
    expect(p.view).toBe(true);
    expect(p.setPrice).toBe(true);
    expect(p.editContent).toBe(true);
    expect(p.withdraw).toBe(true);
    expect(p.endMandate).toBe(true);
  });

  it('🔴 ΤΟ ΠΡΙΝ: το `mayAdminister` τής έλεγε «όχι» — γι΄ αυτό υπάρχει αυτό το αρχείο', () => {
    // Δεν είναι ελάττωμα εκείνου: απαντά «ο **χώρος** είναι δικός σου;» — και δεν είναι.
    expect(mayAdminister(custodyOf(ASSIGNED), actor(ANNA, null))).toBe(false);
    // Και ακριβώς γι' αυτό χρειάστηκε δεύτερη ερώτηση, όχι αλλαγμένη πρώτη.
    expect(mayPerform(ASSIGNED, actor(ANNA, null), 'editContent')).toBe(true);
  });
});

// =============================================================================
describe('Κ2-Κ5 — οι αρνήσεις, ονομαστικά', () => {
  const CASES: ReadonlyArray<
    readonly [string, PermissionFieldsLike, ListingActor, readonly ListingAction[]]
  > = [
    ['ο τρίτος, χωρίς εταιρεία', ASSIGNED, actor(CARL, null), []],
    ['ο τρίτος με ΞΕΝΟ γραφείο', ASSIGNED, actor(CARL, RIVAL), []],
    // ⚠️ ΟΧΙ ο BORIS εδώ: είναι ο **συγγραφέας** του `AGENCY_OWN`, οπότε θα κρατούσε
    //    δικαιώματα ιδιοκτήτη — σωστά. Η ερώτηση εδώ είναι ο **ξένος** υπάλληλος.
    ['🔴 υπάλληλος ΑΝΤΑΓΩΝΙΣΤΗ', AGENCY_OWN, actor(CARL, RIVAL), []],
    ['ο υπάλληλος στο ΠΡΟΣΩΠΙΚΟ ακίνητο ξένου', PERSONAL, actor(BORIS, AGENCY), []],
  ];

  for (const [label, property, who, expected] of CASES) {
    it(`${label} ⇒ ${expected.length === 0 ? 'ΤΙΠΟΤΑ' : expected.join(', ')}`, () => {
      expect(granted(permissionsOn(property, who))).toEqual([...expected]);
    });
  }

  it('Κ5 — ο ΣΥΝΑΔΕΛΦΟΣ στο γραφείο τα έχει όλα, ακόμη κι αν δεν έγραψε αυτός', () => {
    const p = permissionsOn(ASSIGNED, actor(BORIS, AGENCY));
    expect(granted(p)).toEqual([...LISTING_ACTIONS]);
  });
});

// =============================================================================
describe('Κ6 — η ΜΙΑ ασυμμετρία ιδιοκτήτη ⇄ γραφείου', () => {
  it('ο ιδιοκτήτης ΔΕΝ διαχειρίζεται τον σύνδεσμο που στέλνεται σε αυτόν', () => {
    expect(mayPerform(ASSIGNED, actor(ANNA, null), 'manageConsentLink')).toBe(false);
    expect(mayPerform(ASSIGNED, actor(BORIS, AGENCY), 'manageConsentLink')).toBe(true);
  });

  it('🔑 και είναι η ΜΟΝΗ διαφορά — αλλιώς τα δύο σύνολα θα ήταν το ίδιο πράγμα', () => {
    const owner = permissionsOn(PERSONAL, actor(ANNA, null));
    const agency = permissionsOn(AGENCY_OWN, actor(BORIS, AGENCY));
    const differing = LISTING_ACTIONS.filter((a) => owner[a] !== agency[a]);
    expect(differing).toEqual(['manageConsentLink']);
  });
});

// =============================================================================
describe('Κ7 — ΚΕΝΟ δεν ταιριάζει με ΚΕΝΟ (ίδια παγίδα με το `hasTenant`)', () => {
  it('κενός συγγραφέας δεν δίνει δικαίωμα σε αιτούντα με κενό uid', () => {
    const broken = { authorUserId: '', authorCompanyId: AGENCY } as const;
    expect(granted(permissionsOn(broken, actor('', AGENCY)))).toEqual([...LISTING_ACTIONS]);
    // ⚠️ Το παραπάνω περνά **μόνο** από το σκέλος του ΧΩΡΟΥ (ο actor έχει το γραφείο).
    //    Το κρίσιμο είναι ότι το σκέλος του ΣΥΓΓΡΑΦΕΑ δεν πυροδότησε:
    expect(granted(permissionsOn(broken, actor('', null)))).toEqual([]);
  });

  it('κενή εταιρεία δεν ταιριάζει με κενή εταιρεία', () => {
    const broken = { authorUserId: CARL, authorCompanyId: '' } as const;
    expect(granted(permissionsOn(broken, actor(BORIS, '')))).toEqual([]);
  });
});

// =============================================================================
describe('⛔ Κ8 — ΤΟ ΣΥΜΒΟΛΑΙΟ ΜΕ ΤΟΥΣ ΑΛΛΟΥΣ ΕΠΤΑ ΚΑΛΟΥΝΤΕΣ', () => {
  /**
   * 🔴 Αν κάποιος «απλοποιήσει» το `mayAdminister` ώστε να δέχεται τον συγγραφέα, η
   * διεύρυνση φτάνει σιωπηλά στο `place-interest.service.ts:144` και στις δύο άγκυρες
   * του `personal-scope-runtime`. Αυτό το test κοκκινίζει **πριν** συμβεί.
   */
  it('το `mayAdminister` κρίνει ΜΟΝΟ χώρο — ο συγγραφέας δεν το επηρεάζει', () => {
    expect(mayAdminister(custodyOf(ASSIGNED), actor(ANNA, null))).toBe(false);
    expect(mayAdminister(custodyOf(ASSIGNED), actor(BORIS, AGENCY))).toBe(true);
    expect(mayAdminister(custodyOf(PERSONAL), actor(ANNA, null))).toBe(true);
    expect(mayAdminister(custodyOf(PERSONAL), actor(BORIS, AGENCY))).toBe(false);
  });
});

/** Ό,τι δέχεται ο κριτής — δηλωμένο τοπικά ώστε τα σταθερά να μένουν `as const`. */
type PermissionFieldsLike = {
  readonly authorUserId: string;
  readonly authorCompanyId: string | null;
};
